"""
Kingdom screen (owner 2026-10-18: "click my kingdom / territory: all its military units by type, its defense points
and the upgrades I can buy — influence, science…") + the Risk-style daily draft.

GET  /api/kingdom/<h3>/overview/   units stationed in the kingdom, defense, upgrades (level, next cost, effect)
POST /api/kingdom/<h3>/upgrade/    {upgrade}  buy the next level with HEX (stored as a Building on that hex)
POST /api/combat/draft/            once a day: free attack + defense points on your biggest kingdom (supplies)
"""
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.territories import upgrades as U


def _overview(player, h3_index):
    from terra_domini.apps.combat import forces as Fz
    from terra_domini.apps.territories.models import Territory
    t = Territory.objects.filter(h3_index=h3_index, owner=player).first()
    if not t:
        return None
    hexes = U.kingdom_of(player.id, h3_index)
    levels = U.levels_for(hexes)
    ups = []
    for key, u in U.UPGRADES.items():
        lvl = levels[key]
        rng = lambda n: f" · +{n * U.RANGE_PER_INFLUENCE} hexes range" if key == 'influence' else ''
        ups.append({'key': key, 'name': u['name'], 'level': lvl, 'max_level': U.MAX_LEVEL, 'stat': u['stat'],
                    'mult': round(1 + lvl * u['per_level'] / 100, 2),
                    'effect': f"+{lvl * u['per_level']}{u['unit']}{rng(lvl)}",
                    'next_effect': f"+{(lvl + 1) * u['per_level']}{u['unit']}{rng(lvl + 1)}" if lvl < U.MAX_LEVEL else None,
                    'cost': U.upgrade_cost(key, lvl) if lvl < U.MAX_LEVEL else None})
    d = U.draft_size(player)
    # HEX harvesting of this kingdom, detailed: zones × plain value, kingdom bonus, every token, then the multipliers
    from terra_domini.apps.economy import balance as B
    connected = len(hexes) > 1
    toks = B.hex_tokens(hexes)
    token_rows = sorted(({'h3': h, 'name': n, 'category': c, 'rarity': r, 'hex_per_day': round(B.token_hex_per_day(r, c)),
                          'bonus': (B.token_bonus(c) or (None, 0))[1]}
                         for h, lst in toks.items() for n, c, r in lst), key=lambda x: -x['hex_per_day'])
    base = len(hexes) * B.PLAIN_HEX_PER_DAY
    kb = len(hexes) * B.KINGDOM_BONUS if connected else 0
    raw = base + kb + sum(t['hex_per_day'] for t in token_rows)
    rates = B.territory_rates(player)
    total = round(sum(rates.get(h, 0) for h in hexes))
    income = {'zones': len(hexes), 'plain_each': B.PLAIN_HEX_PER_DAY, 'plain': base,
              'kingdom_bonus_each': B.KINGDOM_BONUS if connected else 0, 'kingdom_bonus': kb,
              'tokens': token_rows[:50], 'token_count': len(token_rows), 'tokens_total': sum(t['hex_per_day'] for t in token_rows),
              'before_multipliers': raw, 'total': total,
              'multiplier': round(total / raw, 2) if raw else 1,
              'beginner': B.BEGINNER_MULT if B.is_beginner(player) else 1,
              'science': round(U.kingdom_mult(hexes, 'science'), 2)}
    return {
        'income': income,
        'h3': h3_index, 'name': t.custom_name or t.poi_name or t.place_name or f'Zone {h3_index[:8]}',
        'size': len(hexes), 'kind': 'kingdom' if len(hexes) > 1 else 'territory', 'hexes': sorted(hexes),
        'forces': Fz.pools(hexes), 'point_cost': Fz.POINT_COST,
        'spy_discount': {'per_point': round(Fz.SPY_DISCOUNT * U.kingdom_mult(hexes, 'education'), 4), 'max_points': Fz.SPY_MAX},
        # what each counter is worth in this kingdom (upgrades: influence, fortification, education, science)
        'multipliers': {u['stat']: round(1 + levels[k] * u['per_level'] / 100, 2) for k, u in U.UPGRADES.items()},
        'under_attack': bool(t.is_under_attack),
        'shield_until': t.shield_until.isoformat() if t.shield_until and t.shield_until > timezone.now() else None,
        'upgrades': ups,
        'draft': {**d, 'available': U.draft_available(player)},
        'balance': float(player.tdc_in_game or 0),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def kingdom_overview(request, h3_index):
    data = _overview(request.user, h3_index)
    if data is None:
        return Response({'error': 'Not your territory'}, status=404)
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kingdom_upgrade(request, h3_index):
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.economy.balance import consume_purchased_first
    from terra_domini.apps.territories.models import Building, Territory
    key = request.data.get('upgrade', '')
    if key not in U.UPGRADES:
        return Response({'error': 'Unknown upgrade'}, status=400)
    t = Territory.objects.filter(h3_index=h3_index, owner=request.user).first()
    if not t:
        return Response({'error': 'Not your territory'}, status=404)
    btype = U.UPGRADES[key]['building']
    hexes = U.kingdom_of(request.user.id, h3_index)
    with transaction.atomic():
        player = Player.objects.select_for_update().get(pk=request.user.pk)
        best = Building.objects.select_for_update().filter(territory__h3_index__in=list(hexes), building_type=btype,
                                                           is_active=True).order_by('-level').first()
        lvl = best.level if best else 0
        if lvl >= U.MAX_LEVEL:
            return Response({'error': f"{U.UPGRADES[key]['name']} already at max level"}, status=400)
        from terra_domini.utils.god import god_cost
        cost = god_cost(player, U.upgrade_cost(key, lvl))     # god mode: free
        if float(player.tdc_in_game or 0) < cost:
            return Response({'error': f'Need {cost:,} HEX', 'cost': cost}, status=400)
        Player.objects.filter(pk=player.pk).update(tdc_in_game=F('tdc_in_game') - cost)
        player.refresh_from_db(fields=['tdc_in_game'])
        consume_purchased_first(player, cost)
        if best:
            best.level += 1
            best.upgraded_at = timezone.now()
            best.save(update_fields=['level', 'upgraded_at'])
        else:
            Building.objects.create(territory=t, building_type=btype, level=1)
    try:
        from terra_domini.apps.progression.missions import track
        track(player, 'spend_tdc', cost)
    except Exception:
        pass
    data = _overview(player, h3_index)
    data['bought'] = {'upgrade': key, 'level': lvl + 1, 'cost': cost}
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def daily_draft(request):
    """Risk reinforcements: once a day, free infantry into the reserve (then station them anywhere)."""
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat import forces as Fz
    from terra_domini.apps.territories.models import Territory
    with transaction.atomic():
        player = Player.objects.select_for_update().get(pk=request.user.pk)
        if not U.draft_available(player):
            return Response({'error': 'Supplies already taken today — come back tomorrow'}, status=400)
        d = U.draft_size(player)
        owned = set(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
        if not owned:
            return Response({'error': 'Claim a territory first'}, status=400)
        biggest = max(U.clusters(owned), key=len)
        anchor = sorted(biggest)[0]
        for kind in Fz.DAILY_SUPPLY_KINDS:
            Fz.add(anchor, kind, d['points'])
        player.last_draft_at = timezone.now()
        player.save(update_fields=['last_draft_at'])
    return Response({'success': True, 'points': d['points'], 'kinds': list(Fz.DAILY_SUPPLY_KINDS), 'kingdom_size': len(biggest), 'detail': d})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_regions(request):
    """GET /api/regions/ — the regions where I hold land: my count, the controller, what it takes to win it."""
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.territories import regions as R
    me = str(request.user.id)
    rows, leaders = [], set()
    for rid, e in R.standings().items():
        mine = e['counts'].get(me, 0)
        if not mine:
            continue
        lead, lead_n = R.leader_of(e)
        best_other = max((n for o, n in e['counts'].items() if o != me), default=0)
        rows.append({'id': rid, 'name': e['name'], 'mine': mine, 'players': len(e['counts']),
                     'controlled': lead == me, 'leader_id': lead, 'leader_count': lead_n,
                     'rival_best': best_other,
                     # territories to add to take (or keep a 1-hex margin on) the region
                     'to_take': 0 if lead == me else max(R.REGION_MIN - mine, best_other - mine + 1)})
        if lead:
            leaders.add(lead)
    names = {str(i): u for i, u in Player.objects.filter(id__in=list(leaders)).values_list('id', 'username')}
    for r in rows:
        r['leader'] = names.get(r.pop('leader_id') or '', None)
    rows.sort(key=lambda r: (not r['controlled'], -r['mine'], r['to_take']))
    n = sum(r['controlled'] for r in rows)
    return Response({'regions': rows, 'controlled': n, 'bonus': {'draft': n * R.REGION_DRAFT, 'hex_pct': R.REGION_HEX_PCT},
                     'rules': {'min': R.REGION_MIN, 'draft_per_region': R.REGION_DRAFT, 'hex_pct': R.REGION_HEX_PCT}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def forces_buy(request):
    """POST /api/forces/buy/ {h3, kind: attack|defense|spy, qty} — points on one of your hexes (combat/forces.py)."""
    from terra_domini.apps.combat.views import Fz_buy
    res = Fz_buy(request.user, request.data.get('h3', ''), request.data.get('kind', ''), request.data.get('qty'))
    if 'error' in res:
        return Response(res, status=res.pop('status', 400))
    return Response(res)
