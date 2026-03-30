"""
territory_engine.py — Hexod Territory Generation Engine
=========================================================
Architecture:
  1. POI territories → pre-seeded at startup from UnifiedPOI (1102 hexes)
  2. Standard territories → generated on first click (biome-based, proximity-weighted)
  3. Rarity = POI rarity | biome quality + proximity bonus + 1/10 shiny roll
  4. Resources = biome base × rarity multiplier + POI bonus if applicable

GDD rules:
  - POI territory: rarity from POI, resources boosted
  - Standard territory: rarity = common/uncommon/rare by biome + adjacency to rare hexes
  - Shiny: 10% chance on generation, 1/64 on POI
  - Adjacency bonus: neighbors of POI hexes get +1 resource tier
"""
import random
import math
import h3
from django.db import transaction
from django.utils import timezone

# ── Biome resource tables ──────────────────────────────────────────────────
BIOME_RESOURCES = {
    'urban':      {'res_donnees':12,   'res_influence':8,   'res_main_oeuvre':15, 'res_hex_cristaux':8},
    'rural':      {'res_nourriture':20, 'res_eau':15,        'res_main_oeuvre':10, 'res_hex_cristaux':3},
    'forest':     {'res_nourriture':15, 'res_eau':12,        'res_stabilite':8,    'res_hex_cristaux':4},
    'mountain':   {'res_fer':18,        'res_titanium':5,    'res_charbon':10,     'res_hex_cristaux':5},
    'coastal':    {'res_nourriture':12, 'res_eau':20,        'res_gaz':8,          'res_hex_cristaux':5},
    'desert':     {'res_petrole':15,   'res_silicium':10,   'res_terres_rares':4, 'res_hex_cristaux':4},
    'tundra':     {'res_gaz':12,        'res_uranium':3,     'res_eau':8,          'res_hex_cristaux':4},
    'industrial': {'res_acier':15,      'res_composants':8, 'res_petrole':10,     'res_hex_cristaux':6},
    'landmark':   {'res_donnees':10,   'res_influence':12,  'res_stabilite':10,   'res_hex_cristaux':10},
    'grassland':  {'res_nourriture':18, 'res_main_oeuvre':8,'res_stabilite':6,    'res_hex_cristaux':3},
}

# Rarity multipliers on resource production
RARITY_MULT = {
    'common':   1.0,
    'uncommon': 1.3,
    'rare':     1.7,
    'epic':     2.2,
    'legendary':3.0,
    'mythic':   5.0,
}

# Rarity → base daily HEX Coin income
RARITY_INCOME = {
    'common':   10,
    'uncommon': 30,
    'rare':     80,
    'epic':     200,
    'legendary':500,
    'mythic':  2000,
}

POI_BIOME_MAP = {
    'capital_city':'urban',     'financial_hub':'urban',   'stock_exchange':'urban',
    'museum':'urban',           'palace':'urban',          'stadium':'urban',
    'world_heritage':'landmark','ancient_ruins':'landmark','religious_site':'landmark',
    'mountain_peak':'mountain', 'volcano':'mountain',
    'nature_sanctuary':'forest','forest':'forest',
    'coastal':'coastal',        'port':'coastal',          'island':'coastal',
    'oil_field':'desert',       'nuclear_plant':'industrial','military_base':'industrial',
    'space_center':'industrial','research_center':'urban',
    'desert':'desert',          'tundra':'tundra',
}

RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}


def _biome_from_category(category: str) -> str:
    return POI_BIOME_MAP.get(category, 'rural')


def _roll_standard_rarity(biome: str, near_poi_rarities: list[str]) -> str:
    """
    Roll rarity for a standard (non-POI) territory.
    Influenced by biome quality and neighboring POI rarities.
    """
    # Base probabilities by biome
    biome_tier = {
        'urban':2, 'landmark':2, 'industrial':1, 'coastal':1,
        'mountain':1, 'desert':1, 'forest':0, 'grassland':0, 'rural':0, 'tundra':0,
    }.get(biome, 0)

    # Neighbor influence
    neighbor_bonus = 0
    for nr in near_poi_rarities:
        neighbor_bonus += RARITY_RANK.get(nr, 0)
    neighbor_bonus = min(neighbor_bonus, 4)  # cap

    total = biome_tier + neighbor_bonus * 0.4
    r = random.random()

    if total >= 4 and r < 0.02:  return 'legendary'
    if total >= 3 and r < 0.08:  return 'epic'
    if total >= 2 and r < 0.18:  return 'rare'
    if total >= 1 and r < 0.38:  return 'uncommon'
    return 'common'


def _compute_resources(biome: str, rarity: str, is_poi: bool, poi_bonus_pct: int = 0) -> dict:
    """Compute all resource values for a territory."""
    base = dict(BIOME_RESOURCES.get(biome, BIOME_RESOURCES['rural']))
    mult = RARITY_MULT.get(rarity, 1.0)

    # POI bonus
    if is_poi and poi_bonus_pct > 0:
        mult *= (1 + poi_bonus_pct / 100)

    result = {}
    for field, val in base.items():
        result[field] = round(val * mult, 2)

    # Daily HEX Coin income
    result['resource_credits'] = RARITY_INCOME.get(rarity, 10)

    return result


def seed_poi_territories():
    """
    Pre-seed all 1102 POI territories into the Territory table.
    Called at startup / management command. Idempotent.
    """
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.events.unified_poi import UnifiedPOI

    RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}
    
    pois = list(UnifiedPOI.objects.filter(is_active=True)
                .exclude(h3_index='').exclude(h3_index__isnull=True)
                .values('name','category','h3_index','rarity','bonus_pct',
                       'latitude','longitude','country_code','wiki_url',
                       'description','fun_fact','floor_price_tdi',
                       'visitors_per_year','geopolitical_score','is_shiny',
                       'tdc_per_24h','emoji'))

    # One POI per hex — keep highest rarity
    hex_best: dict[str, dict] = {}
    for p in pois:
        hx = p['h3_index']
        cur = hex_best.get(hx)
        if cur is None or RARITY_RANK.get(p['rarity'],0) > RARITY_RANK.get(cur['rarity'],0):
            hex_best[hx] = p

    created = updated = 0
    with transaction.atomic():
        for hx, p in hex_best.items():
            try:
                geo    = h3.cell_to_latlng(hx)          # (lat, lon)
                pts    = h3.cell_to_boundary(hx)  # list of (lat,lon)
                biome  = _biome_from_category(p.get('category',''))
                rarity = p.get('rarity','uncommon')
                is_shiny = bool(p.get('is_shiny', False)) or (random.random() < 1/64)
                resources = _compute_resources(biome, rarity, True, p.get('bonus_pct', 0) or 0)

                from django.db import connection as _conn
                _c = _conn.cursor()
                _c.execute("SELECT id FROM territories WHERE h3_index=?", [hx])
                existing_row = _c.fetchone()

                fields = {
                    'h3_index':       hx,
                    'h3_resolution':  7,
                    'center_lat':     geo[0],
                    'center_lon':     geo[1],
                    'territory_type': biome,
                    'country_code':   (p.get('country_code') or '')[:10],
                    'place_name':     p['name'],
                    'is_landmark':    1,
                    'landmark_name':  p['name'],
                    'rarity':         rarity,
                    'is_shiny':       1 if is_shiny else 0,
                    'tdc_per_day':    resources['resource_credits'],
                    'poi_name':       p['name'],
                    'poi_wiki_url':   p.get('wiki_url') or '',
                    'nft_version':    1,
                    'resource_credits': resources['resource_credits'],
                    'res_fer':        resources.get('res_fer',0),
                    'res_petrole':    resources.get('res_petrole',0),
                    'res_silicium':   resources.get('res_silicium',0),
                    'res_donnees':    resources.get('res_donnees',0),
                    'res_influence':  resources.get('res_influence',0),
                    'res_hex_cristaux': resources.get('res_hex_cristaux',0),
                    'res_nourriture': resources.get('res_nourriture',0),
                    'res_eau':        resources.get('res_eau',0),
                    'res_stabilite':  resources.get('res_stabilite',0),
                    'res_main_oeuvre':resources.get('res_main_oeuvre',0),
                    'res_acier':      resources.get('res_acier',0),
                    'res_composants': resources.get('res_composants',0),
                    'res_uranium':    resources.get('res_uranium',0),
                    'res_charbon':    resources.get('res_charbon',0),
                    'res_titanium':   resources.get('res_titanium',0),
                    'res_aluminium':  0, 'res_cuivre': 0, 'res_gaz': 0,
                    'res_terres_rares': resources.get('res_terres_rares',0),
                }

                if not existing_row:
                    cols = ', '.join(fields.keys())
                    placeholders = ', '.join(['?'] * len(fields))
                    _c.execute(f"INSERT INTO territories ({cols}) VALUES ({placeholders})", list(fields.values()))
                    created += 1
                else:
                    sets = ', '.join(f"{k}=?" for k in fields if k != 'h3_index')
                    vals = [v for k,v in fields.items() if k != 'h3_index'] + [hx]
                    _c.execute(f"UPDATE territories SET {sets} WHERE h3_index=?", vals)
                    updated += 1

            except Exception as e:
                print(f"  skip {hx}: {e}")

    return created, updated


def generate_territory(h3_index: str, lat: float, lon: float, poi_category: str = '') -> dict:
    """
    Generate or retrieve a standard territory on first click.
    Biome assigned by biome_engine (Köppen + geo), not random.
    Resources computed from biome × rarity.
    """
    from terra_domini.apps.territories.models import Territory

    # Already exists? Return existing (biome + resources already set)
    existing = Territory.objects.filter(h3_index=h3_index).first()
    if existing:
        return _territory_to_dict(existing)

    # Neighbor POI rarities for rarity roll
    try:
        ring1 = [c for c in h3.grid_disk(h3_index, 1) if c != h3_index]
        ring2 = [c for c in h3.grid_disk(h3_index, 2) if c not in ring1 and c != h3_index]
        near_pois = Territory.objects.filter(
            h3_index__in=ring1 + ring2, is_landmark=True
        ).values_list('rarity', flat=True)
        near_rarities = list(near_pois)
    except Exception:
        near_rarities = []

    # Biome from biome_engine (precise, deterministic, Köppen-based)
    from terra_domini.apps.territories.biome_engine import assign_biome, BIOME_PRODUCTION
    biome = assign_biome(lat, lon, poi_category, '')

    # Roll rarity (influenced by biome + neighbor POIs)
    rarity   = _roll_standard_rarity(biome, near_rarities)
    is_shiny = random.random() < 0.10

    # Resources from biome_engine table (not legacy BIOME_RESOURCES)
    rarity_mult = RARITY_MULT.get(rarity, 1.0) * (1.5 if is_shiny else 1.0)
    base_res = BIOME_PRODUCTION.get(biome, BIOME_PRODUCTION['rural'])
    resources = {field: round(val * rarity_mult, 2) for field, val in base_res.items()}
    tdc_per_day = RARITY_INCOME.get(rarity, 10)

    try:
        geo = h3.cell_to_latlng(h3_index)
        with transaction.atomic():
            t = Territory.objects.create(
                h3_index       = h3_index,
                h3_resolution  = 7,
                center_lat     = geo[0],
                center_lon     = geo[1],
                territory_type = biome,
                biome          = biome,
                rarity         = rarity,
                is_shiny       = is_shiny,
                is_landmark    = False,
                hex_type       = 'standard',
                tdc_per_day    = tdc_per_day,
                nft_version    = 1,
                resource_credits = tdc_per_day,
                **{k: v for k, v in resources.items()
                   if k in {f.name for f in Territory._meta.get_fields() if hasattr(f,'name')}},
            )
        return _territory_to_dict(t)
    except Exception:
        return {
            'h3_index': h3_index, 'rarity': rarity, 'is_shiny': is_shiny,
            'territory_type': biome, 'biome': biome, 'is_landmark': False,
            'resource_credits': tdc_per_day, 'tdc_per_day': tdc_per_day,
            **resources,
        }


def _guess_biome(lat: float, lon: float) -> str:
    """Simple biome heuristic from coordinates."""
    # Tundra: high latitudes
    if abs(lat) > 65: return 'tundra'
    # Desert: subtropical dry bands + known desert regions
    if (15 < lat < 35 and -20 < lon < 60):  return 'desert'  # Sahara/Middle East
    if (-35 < lat < -15 and -75 < lon < -65): return 'desert'  # Atacama
    # Coastal: rough approximation (border areas — improve with actual coastline data)
    # Mountain: high regions
    # Default urban/rural mix
    import random as rnd
    return rnd.choice(['rural','rural','rural','forest','forest','grassland','urban','coastal'])


def _territory_to_dict(t) -> dict:
    """Convert Territory model to API dict."""
    return {
        'h3_index':        t.h3_index,
        'rarity':          t.rarity or 'common',
        'is_shiny':        bool(t.is_shiny),
        'territory_type':  t.territory_type or 'rural',
        'is_landmark':     bool(t.is_landmark),
        'poi_name':        t.poi_name or t.landmark_name,
        'poi_wiki_url':    t.poi_wiki_url or '',
        'place_name':      t.place_name or '',
        'resource_credits':float(t.resource_credits or 10),
        'res_hex_cristaux':float(getattr(t,'res_hex_cristaux',0) or 0),
        'res_fer':         float(getattr(t,'res_fer',0) or 0),
        'res_petrole':     float(getattr(t,'res_petrole',0) or 0),
        'res_donnees':     float(getattr(t,'res_donnees',0) or 0),
        'res_influence':   float(getattr(t,'res_influence',0) or 0),
        'tdc_per_day':     float(t.tdc_per_day or 10),
        'center_lat':      float(t.center_lat or 0),
        'center_lon':      float(t.center_lon or 0),
    }
