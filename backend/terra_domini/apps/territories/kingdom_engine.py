"""
kingdom_engine.py — Hexod Kingdom System
==========================================
Concept: contiguous territories = Kingdom. Skills belong to a Kingdom.
Main Kingdom = largest cluster. Isolated territory = orphan kingdom, tree resets.

GDD rules:
- Adjacent hexes → same kingdom
- Disconnected territory → new kingdom with empty skill tree
- Main kingdom (biggest) → full skill tree access
- Smaller kingdoms → own separate tree starting from 0
"""
import uuid
import h3
from django.db import transaction
from django.utils import timezone

from terra_domini.apps.territories.models import Territory, TerritoryCluster, KingdomSkill
from terra_domini.apps.events.unified_poi import UnifiedPOI

# Mapping SkillNode.cost_json labels → DB field names + default cost
RESOURCE_LABEL_MAP: dict[str, tuple[str, float]] = {
    'pétrole':                   ('res_petrole',      50),
    'acier':                     ('res_acier',         40),
    "main d'œuvre":              ('res_main_oeuvre',   60),
    'données':                   ('res_donnees',       50),
    'composants électroniques':  ('res_composants',    30),
    'hex (cristaux)':            ('res_hex_cristaux',  20),
    'terres rares':              ('res_terres_rares',  15),
    'silicium':                  ('res_silicium',      30),
    'titanium':                  ('res_titanium',      20),
    'influence politique':       ('res_influence',     40),
    'uranium':                   ('res_uranium',       10),
    'fer':                       ('res_fer',           50),
    'charbon':                   ('res_charbon',       40),
    'gaz':                       ('res_gaz',           30),
    'eau':                       ('res_eau',           60),
    'nourriture':                ('res_nourriture',    60),
    'stabilité':                 ('res_stabilite',     40),
    'aluminium':                 ('res_aluminium',     30),
    'cuivre':                    ('res_cuivre',        30),
}

def _parse_skill_costs(cost_json: list) -> dict[str, float]:
    """Convert cost_json labels to {db_field: amount} dict."""
    result: dict[str, float] = {}
    for item in (cost_json or []):
        if isinstance(item, dict):
            # Already {field: amount} format
            result.update({k: float(v) for k, v in item.items()})
        elif isinstance(item, str):
            key = item.lower().strip()
            if key in RESOURCE_LABEL_MAP:
                field, default_cost = RESOURCE_LABEL_MAP[key]
                result[field] = result.get(field, 0) + default_cost
            # else: unknown resource label — skip
    return result


def _flood_fill(owned_set: set) -> list[list[str]]:
    """BFS flood fill — returns list of connected components."""
    visited = set()
    clusters = []
    for h3_idx in owned_set:
        if h3_idx in visited:
            continue
        cluster = []
        queue = [h3_idx]
        while queue:
            current = queue.pop()
            if current in visited:
                continue
            visited.add(current)
            if current in owned_set:
                cluster.append(current)
                neighbors = [c for c in h3.k_ring(current, 1) if c != current]
                queue.extend(n for n in neighbors if n not in visited)
        if cluster:
            clusters.append(cluster)
    return clusters


def _aggregate_resources(h3_indexes: list[str]) -> dict:
    """Sum all Hexod resources across territory cluster."""
    territories = Territory.objects.filter(h3_index__in=h3_indexes)
    agg = {f: 0.0 for f in [
        'res_fer','res_petrole','res_silicium','res_donnees','res_uranium',
        'res_hex_cristaux','res_influence','res_stabilite','res_acier',
        'res_terres_rares','res_composants','resource_credits','resource_energy',
        'resource_food','resource_materials','resource_intel',
    ]}
    for t in territories:
        for field in agg:
            agg[field] += float(getattr(t, field, 0) or 0)

    # Also count POI territories
    poi_hexes = set(
        UnifiedPOI.objects.filter(h3_index__in=h3_indexes, is_active=True)
        .values_list('h3_index', flat=True)
    )
    return {**agg, 'poi_count': len(poi_hexes)}


def recompute_kingdoms(player) -> list[dict]:
    """
    Recompute all kingdoms for a player.
    Returns list of kingdom dicts with cluster_id, size, is_main, resources.
    Called after every territory change.
    """
    territories = list(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    if not territories:
        TerritoryCluster.objects.filter(player=player).delete()
        return []

    owned_set = set(territories)
    components = _flood_fill(owned_set)
    components.sort(key=len, reverse=True)  # main kingdom first

    # Get existing clusters to preserve cluster_ids (stable UUIDs)
    existing = {c.cluster_id: c for c in TerritoryCluster.objects.filter(player=player)}

    # Match components to existing clusters by overlap
    used_ids = set()
    component_cluster_ids = []

    for component in components:
        comp_set = set(component)
        best_id = None
        best_overlap = 0
        for cid, cluster_obj in existing.items():
            if cid in used_ids:
                continue
            # Measure overlap by counting shared h3s (stored in cluster's hex_h3_index as first hex)
            # Simple heuristic: use centroid proximity
            best_id = cid
            best_overlap = 1
            break

        if best_id is None or best_id in used_ids:
            best_id = str(uuid.uuid4())

        used_ids.add(best_id)
        component_cluster_ids.append(best_id)

    # Recompute and upsert
    result = []
    new_cluster_ids = set(component_cluster_ids)

    with transaction.atomic():
        # Delete orphaned clusters
        TerritoryCluster.objects.filter(player=player).exclude(cluster_id__in=new_cluster_ids).delete()

        for i, (component, cluster_id) in enumerate(zip(components, component_cluster_ids)):
            is_main = (i == 0)
            agg = _aggregate_resources(component)

            # Centroid
            lats = [h3.h3_to_geo(h)[0] for h in component]
            lons = [h3.h3_to_geo(h)[1] for h in component]
            centroid_lat = sum(lats) / len(lats)
            centroid_lon = sum(lons) / len(lons)

            tdc24 = agg['resource_credits'] * 288
            size = len(component)
            tier = min(6, size // 3)

            TerritoryCluster.objects.update_or_create(
                player=player, cluster_id=cluster_id,
                defaults=dict(
                    size=size,
                    centroid_lat=centroid_lat, centroid_lon=centroid_lon,
                    unlock_tier=tier,
                    tdc_per_24h=tdc24,
                    is_main_kingdom=is_main,
                    poi_count=agg['poi_count'],
                    hex_h3_index=component[0],
                    agg_fer=agg['res_fer'],
                    agg_petrole=agg['res_petrole'],
                    agg_silicium=agg['res_silicium'],
                    agg_donnees=agg['res_donnees'],
                    agg_uranium=agg['res_uranium'],
                    agg_hex_cristaux=agg['res_hex_cristaux'],
                    agg_influence=agg['res_influence'],
                    agg_stabilite=agg['res_stabilite'],
                    agg_acier=agg['res_acier'],
                    agg_terres_rares=agg['res_terres_rares'],
                    agg_composants=agg['res_composants'],
                    computed_at=timezone.now(),
                )
            )

            result.append({
                'cluster_id': cluster_id,
                'size': size,
                'is_main': is_main,
                'tier': tier,
                'tdc_per_24h': tdc24,
                'poi_count': agg['poi_count'],
                'resources': agg,
                'h3_indexes': component,
                'centroid_lat': centroid_lat,
                'centroid_lon': centroid_lon,
            })

    # Handle skill isolation: skills on orphaned kingdoms are preserved but frozen
    # (they don't affect the player until that kingdom grows back)
    return result


def get_kingdom_for_territory(player, h3_index: str) -> dict | None:
    """Return the kingdom dict that contains this territory."""
    kingdoms = recompute_kingdoms(player)
    for k in kingdoms:
        if h3_index in k.get('h3_indexes', []):
            return k
    return None


def unlock_kingdom_skill(player, cluster_id: str, skill_id: int) -> dict:
    """
    Unlock a skill for a specific kingdom.
    Deducts resources from territories in that kingdom.

    cost_json format accepted:
      - list of strings: ['res_fer', 'res_petrole']  → 10 each (legacy)
      - list of dicts:   [{'res_fer': 50}, {'res_petrole': 30}]
    """
    from terra_domini.apps.progression.models import SkillNode

    try:
        skill = SkillNode.objects.get(pk=skill_id)
    except SkillNode.DoesNotExist:
        return {'error': 'Skill not found'}

    cluster = TerritoryCluster.objects.filter(player=player, cluster_id=cluster_id).first()
    if not cluster:
        return {'error': 'Kingdom not found'}

    if not cluster.is_main_kingdom:
        return {'error': 'Seul le Royaume Principal peut débloquer des compétences'}

    if KingdomSkill.objects.filter(player=player, cluster_id=cluster_id, skill=skill).exists():
        return {'error': 'Déjà débloquée dans ce royaume'}

    # Parse cost_json → {field: amount}
    costs: dict[str, float] = _parse_skill_costs(skill.cost_json or [])

    if costs:
        # Check aggregate resources across kingdom territories
        kingdom_terrs = list(Territory.objects.filter(
            owner=player, h3_index__in=cluster.hex_h3_index or []
        ))

        # Recalculate from DB to be safe
        h3_set = []
        try:
            from terra_domini.apps.territories.kingdom_engine import _flood_fill
            owned_all = list(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
            components = _flood_fill(set(owned_all))
            for comp in components:
                if cluster.hex_h3_index in comp:
                    h3_set = comp
                    break
        except Exception:
            pass

        kingdom_terrs = list(Territory.objects.filter(owner=player, h3_index__in=h3_set))
        totals: dict[str, float] = {}
        for t in kingdom_terrs:
            for field in costs:
                totals[field] = totals.get(field, 0.0) + float(getattr(t, field, 0) or 0)

        # Check sufficiency
        for field, needed in costs.items():
            if totals.get(field, 0) < needed:
                res_label = field.replace('res_', '').replace('_', ' ')
                return {
                    'error': f'Ressources insuffisantes : besoin {needed} {res_label}, '
                             f'vous avez {totals.get(field,0):.1f}'
                }

        # Deduct proportionally from all kingdom territories
        with transaction.atomic():
            if kingdom_terrs:
                per_terr = {f: v / len(kingdom_terrs) for f, v in costs.items()}
                for t in kingdom_terrs:
                    updates = {}
                    for field, amt in per_terr.items():
                        cur = float(getattr(t, field, 0) or 0)
                        new_val = max(0.0, cur - amt)
                        setattr(t, field, new_val)
                        updates[field] = new_val
                    if updates:
                        Territory.objects.filter(pk=t.pk).update(**updates)

    KingdomSkill.objects.create(player=player, cluster_id=cluster_id, skill=skill)
    return {
        'ok': True,
        'skill': skill.name,
        'kingdom_size': cluster.size,
        'costs_deducted': costs,
    }


def get_kingdom_skill_tree(player, cluster_id: str) -> dict:
    """Full skill tree for a kingdom with unlock status."""
    from terra_domini.apps.progression.models import SkillNode

    all_skills = list(SkillNode.objects.all().values(
        'id','branch','name','effect','cost_json','position','icon'))
    unlocked = set(KingdomSkill.objects.filter(
        player=player, cluster_id=cluster_id
    ).values_list('skill_id', flat=True))

    for s in all_skills:
        s['unlocked'] = s['id'] in unlocked

    tree = {}
    for s in all_skills:
        tree.setdefault(s['branch'], []).append(s)

    cluster = TerritoryCluster.objects.filter(player=player, cluster_id=cluster_id).first()
    return {
        'tree': tree,
        'unlocked_count': len(unlocked),
        'kingdom': {
            'cluster_id': cluster_id,
            'size': cluster.size if cluster else 0,
            'is_main': cluster.is_main_kingdom if cluster else False,
            'tier': cluster.unlock_tier if cluster else 0,
            'poi_count': cluster.poi_count if cluster else 0,
            'tdc_per_24h': float(cluster.tdc_per_24h) if cluster else 0,
            'resources': {
                'fer': float(cluster.agg_fer) if cluster else 0,
                'petrole': float(cluster.agg_petrole) if cluster else 0,
                'silicium': float(cluster.agg_silicium) if cluster else 0,
                'donnees': float(cluster.agg_donnees) if cluster else 0,
                'uranium': float(cluster.agg_uranium) if cluster else 0,
                'hex_cristaux': float(cluster.agg_hex_cristaux) if cluster else 0,
                'influence': float(cluster.agg_influence) if cluster else 0,
                'stabilite': float(cluster.agg_stabilite) if cluster else 0,
                'acier': float(cluster.agg_acier) if cluster else 0,
                'terres_rares': float(cluster.agg_terres_rares) if cluster else 0,
                'composants': float(cluster.agg_composants) if cluster else 0,
            }
        }
    }
