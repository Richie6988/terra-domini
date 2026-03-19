"""
Territory Resource Generation Engine
=====================================
Assigns randomized resource values to territories based on:
- Territory type (urban/forest/water/desert/etc.)
- Proximity to real-world ResourcePOIs
- Random variance (±30%)
- Hidden sub-surface resources (rare discovery mechanic)

Called on:
- Territory creation/claim
- Weekly resource reseed (Celery task)
- Scout action (reveals hidden resources)
"""
import random
import logging
from typing import Dict

logger = logging.getLogger('terra_domini.resources')

# ─── Base resource rates by territory type ──────────────────────────────────
# Values = per-tick production rate (normalized: 1.0 = standard)
BASE_RATES: Dict[str, Dict[str, float]] = {
    'urban': {
        'credits':   8.0,  # commerce + tax
        'culture':   6.0,  # arts, media, population density
        'intel':     5.0,  # surveillance, data centers, finance
        'energy':    3.0,  # grid consumption (high demand)
        'materials': 2.0,  # construction, recycling
        'food':      1.0,  # urban farms, markets
        'water':     2.5,  # municipal water systems
    },
    'rural': {
        'food':      9.0,  # agriculture, livestock
        'water':     7.0,  # aquifers, rivers, wells
        'materials': 4.0,  # timber, stone, clay
        'energy':    2.0,  # biomass, solar farms
        'credits':   2.5,  # farming income
        'culture':   1.5,  # traditions, heritage
        'intel':     0.5,  # low connectivity
    },
    'forest': {
        'food':      6.0,  # hunting, foraging, timber trade
        'materials': 8.0,  # wood, resin, rare plants
        'water':     9.0,  # watershed, springs
        'culture':   4.0,  # biodiversity, eco-tourism
        'energy':    3.0,  # biomass, hydroelectric potential
        'credits':   2.0,  # timber export
        'intel':     1.0,
    },
    'water': {
        'water':     15.0, # ★ primary resource — fishing, shipping
        'food':      8.0,  # fishing, aquaculture
        'credits':   6.0,  # shipping lanes, port tolls
        'energy':    4.0,  # tidal, wave, offshore wind
        'materials': 1.0,  # seabed minerals (rare)
        'culture':   2.0,
        'intel':     2.0,  # naval intelligence
    },
    'coastal': {
        'food':      7.0,  # fishing
        'water':     8.0,  # desalination + fishing
        'credits':   7.0,  # trade, tourism
        'energy':    5.0,  # offshore wind, tidal
        'materials': 3.0,
        'culture':   5.0,  # tourism, beaches
        'intel':     3.0,
    },
    'industrial': {
        'materials': 12.0, # ★ manufacturing, mining
        'energy':    8.0,  # power plants, industry demand
        'credits':   6.0,  # exports
        'intel':     4.0,  # industrial espionage value
        'food':      1.0,
        'culture':   1.0,
        'water':     3.0,  # industrial cooling
    },
    'mountain': {
        'materials': 10.0, # ore mining, stone quarry
        'water':     11.0, # glaciers, mountain springs
        'energy':    6.0,  # hydroelectric, wind
        'food':      3.0,  # alpine agriculture
        'credits':   3.0,  # mining exports, ski tourism
        'culture':   4.0,  # heritage, trekking
        'intel':     2.0,
    },
    'desert': {
        'energy':    12.0, # ★ solar, oil/gas (hidden)
        'materials': 5.0,  # sand, minerals, rare earths (hidden)
        'credits':   3.0,  # resource export
        'food':      1.0,  # oasis, date palms
        'water':     0.5,  # extreme scarcity — very valuable
        'culture':   2.0,  # ancient sites
        'intel':     2.0,
    },
    'arctic': {
        'water':     6.0,  # glacial fresh water
        'energy':    5.0,  # oil/gas (hidden), wind
        'materials': 7.0,  # rare minerals under ice
        'food':      2.0,  # hunting, fishing
        'credits':   2.0,
        'culture':   3.0,  # indigenous heritage
        'intel':     4.0,  # strategic surveillance
    },
    'landmark': {
        'culture':   15.0, # ★ heritage, tourism
        'credits':   10.0, # tourism revenue
        'intel':     8.0,  # observation, prestige
        'food':      3.0,
        'energy':    2.0,
        'materials': 2.0,
        'water':     3.0,
    },
}

# ─── Hidden resource probability by territory type ─────────────────────────
HIDDEN_RESOURCE_CHANCES: Dict[str, list] = {
    'desert':     [('oil_field',0.25),('gas_reserve',0.20),('rare_earth',0.15),('uranium_mine',0.05)],
    'arctic':     [('oil_field',0.20),('gas_reserve',0.15),('uranium_mine',0.08),('rare_earth',0.10)],
    'mountain':   [('gold_mine',0.15),('diamond_mine',0.05),('copper_mine',0.20),('iron_ore',0.25),('rare_earth',0.10),('lithium_deposit',0.08)],
    'rural':      [('fertile_land',0.30),('freshwater',0.20),('iron_ore',0.10),('coal_mine',0.10)],
    'forest':     [('ancient_forest',0.25),('freshwater',0.25),('fertile_land',0.15),('gold_mine',0.05)],
    'water':      [('deep_sea_fish',0.35),('freshwater',0.20),('oil_field',0.10)],
    'coastal':    [('deep_sea_fish',0.25),('port_megacity',0.10),('oil_field',0.08)],
    'industrial': [('coal_mine',0.20),('iron_ore',0.20),('copper_mine',0.15),('nuclear_plant',0.03)],
    'urban':      [('military_base',0.08),('nuclear_plant',0.03),('space_center',0.01)],
    'landmark':   [('nature_sanctuary',0.20),('military_base',0.10),('chokepoint',0.10)],
}

RARITY_WEIGHTS = {
    'common':    0.55,
    'uncommon':  0.25,
    'rare':      0.15,
    'legendary': 0.05,
}

RARITY_MULTIPLIERS = {
    'common':    1.0,
    'uncommon':  1.5,
    'rare':      2.5,
    'legendary': 5.0,
}


def generate_territory_resources(territory) -> Dict[str, float]:
    """
    Generate resource rates for a territory based on its type.
    Returns dict of resource_type → per-tick value.
    Applies ±30% random variance to each resource.
    """
    t_type = getattr(territory, 'territory_type', 'rural')
    base   = BASE_RATES.get(t_type, BASE_RATES['rural'])

    # Normalize to game scale (base 10 = 10 units/tick)
    scale = 10.0
    rates = {}
    for resource, base_val in base.items():
        variance = random.uniform(0.7, 1.3)
        rates[resource] = round(base_val * scale * variance, 2)

    return rates


def assign_hidden_resource(territory) -> dict | None:
    """
    Maybe assign a hidden sub-surface resource.
    Returns {type, amount, rarity} or None.
    Roll: 40% base chance of having any hidden resource.
    """
    t_type = getattr(territory, 'territory_type', 'rural')
    chances = HIDDEN_RESOURCE_CHANCES.get(t_type, [])
    if not chances:
        return None

    # Base 40% chance of a hidden resource on any territory
    if random.random() > 0.40:
        return None

    # Pick resource type
    r = random.random()
    cumulative = 0
    chosen_type = None
    for res_type, prob in chances:
        cumulative += prob
        if r <= cumulative:
            chosen_type = res_type
            break
    if not chosen_type:
        chosen_type = chances[0][0]  # fallback

    # Pick rarity
    rarity = random.choices(
        list(RARITY_WEIGHTS.keys()),
        weights=list(RARITY_WEIGHTS.values())
    )[0]

    from terra_domini.apps.events.poi_models_resources import RESOURCE_CONFIG
    cfg    = RESOURCE_CONFIG.get(chosen_type, {})
    base_bonus = cfg.get('bonus_pct', 25)
    amount = base_bonus * RARITY_MULTIPLIERS[rarity] * random.uniform(0.8, 1.2)

    return {
        'type':   chosen_type,
        'amount': round(amount, 1),
        'rarity': rarity,
    }


def initialize_territory_resources(territory, save: bool = True) -> None:
    """
    Full resource initialization for a territory.
    Called on creation or reset.
    """
    rates = generate_territory_resources(territory)

    territory.resource_water     = rates.get('water',     0)
    territory.resource_food      = rates.get('food',      0)
    territory.resource_energy    = rates.get('energy',    0)
    territory.resource_credits   = rates.get('credits',   0)
    territory.resource_culture   = rates.get('culture',   0)
    territory.resource_materials = rates.get('materials', 0)
    territory.resource_intel     = rates.get('intel',     0)

    # Hidden resource
    hidden = assign_hidden_resource(territory)
    if hidden:
        territory.hidden_resource_type   = hidden['type']
        territory.hidden_resource_amount = hidden['amount']
        territory.hidden_resource_rarity = hidden['rarity']
        territory.hidden_resource_found  = False  # starts undiscovered

    if save:
        update_fields = [
            'resource_water', 'resource_food', 'resource_energy',
            'resource_credits', 'resource_culture', 'resource_materials',
            'resource_intel', 'hidden_resource_type', 'hidden_resource_amount',
            'hidden_resource_rarity', 'hidden_resource_found',
        ]
        territory.save(update_fields=update_fields)


def scout_hidden_resource(territory, player) -> dict:
    """
    Player scouts a territory to discover hidden resources.
    Costs intel units. Returns discovery result.
    """
    if territory.hidden_resource_found:
        return {
            'already_known': True,
            'type':   territory.hidden_resource_type,
            'amount': territory.hidden_resource_amount,
            'rarity': territory.hidden_resource_rarity,
        }

    if not territory.hidden_resource_type:
        return {'found': False, 'message': 'No hidden resources in this zone.'}

    # Reveal
    territory.hidden_resource_found = True
    territory.save(update_fields=['hidden_resource_found'])

    from terra_domini.apps.events.poi_models_resources import RESOURCE_CONFIG
    cfg = RESOURCE_CONFIG.get(territory.hidden_resource_type, {})

    return {
        'found':  True,
        'type':   territory.hidden_resource_type,
        'emoji':  cfg.get('emoji', '📍'),
        'amount': territory.hidden_resource_amount,
        'rarity': territory.hidden_resource_rarity,
        'message': f"Discovered {cfg.get('emoji','')} {territory.hidden_resource_type.replace('_',' ').title()} ({territory.hidden_resource_rarity})! +{territory.hidden_resource_amount:.0f}% bonus when mined.",
    }
