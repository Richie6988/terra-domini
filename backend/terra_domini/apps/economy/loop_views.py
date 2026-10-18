"""
Session loop API — the "5-minute session" backbone (2026-10-17).

GET  /api/loop/status/   harvest stock, streak (auto check-in), missions, battles, nudges
POST /api/loop/collect/  credit the harvest stock (capped at STORAGE_CAP_HOURS)

Nothing is credited automatically: production that overflows the cap is lost,
and status/collect say how much — that's the FOMO the owner asked for.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.economy import balance as B


def _tname(t):
    return t.custom_name or t.place_name or t.poi_name or 'Your territory'


def _fmt_left(delta):
    mins = max(0, int(delta.total_seconds() // 60))
    return f'{mins // 60}h {mins % 60:02d}m' if mins >= 60 else f'{mins} min'


def _resources(player, stored_h):
    """Resource cards produced into the same stock as HEX (collected together)."""
    from terra_domini.apps.economy import resources as R
    rates = R.player_resource_rates(player)
    pend = R.pending(rates, stored_h)
    meta = R.resources()
    return sorted(({'id': k, 'name': meta.get(k, {}).get('name', k), 'category': meta.get(k, {}).get('category', ''),
                    'rate_per_day': v, 'pending': pend.get(k, 0)} for k, v in rates.items()),
                  key=lambda r: -r['rate_per_day'])


def _harvest(player, now):
    rate = B.player_hex_per_day(player)
    last = player.harvest_last_at or now
    elapsed_h = max(0.0, (now - last).total_seconds() / 3600)
    stored_h = min(elapsed_h, B.STORAGE_CAP_HOURS)
    pending = rate * stored_h / 24
    lost = rate * max(0.0, elapsed_h - B.STORAGE_CAP_HOURS) / 24
    cap_amount = rate * B.STORAGE_CAP_HOURS / 24
    return {
        'rate_per_day': rate,
        'pending': int(pending),
        'cap_amount': int(cap_amount),
        'cap_hours': B.STORAGE_CAP_HOURS,
        'fill_pct': round(100 * stored_h / B.STORAGE_CAP_HOURS, 1) if rate else 0,
        'is_full': elapsed_h >= B.STORAGE_CAP_HOURS and rate > 0,
        'full_at': (last + timedelta(hours=B.STORAGE_CAP_HOURS)).isoformat(),
        'lost': int(lost),
        'resources': _resources(player, stored_h),
        'beginner_mult': B.BEGINNER_MULT if B.is_beginner(player) else 1,
        'beginner_until': (player.date_joined + timedelta(days=B.BEGINNER_DAYS)).isoformat() if B.is_beginner(player) else None,
    }


def _streak(player):
    from terra_domini.apps.progression.models import PlayerStreak
    from terra_domini.apps.accounts.models import Player
    streak, _ = PlayerStreak.objects.get_or_create(player=player)
    result = streak.check_and_update()
    if result.get('is_new') and result.get('reward_tdc', 0) > 0:
        Player.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') + result['reward_tdc'])
    return {
        'current': streak.current_streak, 'longest': streak.longest_streak, 'shields': streak.streak_shields,
        'reward_today': result.get('reward_tdc', 0) if result.get('is_new') else 0,
        'message': result.get('message', ''),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def loop_status(request):
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat.engine import Battle, BattleParticipant
    from terra_domini.apps.progression.missions import ensure_today_missions
    from terra_domini.apps.territories.models import Territory

    now = timezone.now()
    player = Player.objects.get(id=request.user.id)
    if player.harvest_last_at is None:
        Player.objects.filter(id=player.id).update(harvest_last_at=now)
        player.harvest_last_at = now

    streak = _streak(player)
    player.refresh_from_db(fields=['tdc_in_game', 'hex_purchased_balance'])
    if B.player_hex_per_day(player) <= 0:
        # No land → no stock. Keep the clock at "now" so the first zone starts from an empty stock
        # (otherwise a player who claims days after signing up gets an instant, unearned full stock).
        Player.objects.filter(id=player.id).update(harvest_last_at=now)
        player.harvest_last_at = now
    harvest = _harvest(player, now)
    owned = Territory.objects.filter(owner=player).count()

    missions = list(ensure_today_missions(player))
    claimable = [m for m in missions if m.is_completed and not m.is_claimed]

    from terra_domini.apps.combat.engine import CombatEngine
    from django.db.models import Q
    CombatEngine.resolve_due(Battle.objects.filter(Q(defender=player) | Q(participants__player=player)).distinct())
    incoming = list(Battle.objects.filter(defender=player, status=Battle.BattleStatus.ACTIVE)
                    .select_related('target_territory').order_by('resolves_at'))
    recent = list(Battle.objects.filter(
        participants__player=player, participants__side=BattleParticipant.Side.ATTACKER,
        status=Battle.BattleStatus.COMPLETED, completed_at__gte=now - timedelta(hours=12),
    ).select_related('target_territory').order_by('-completed_at')[:3])
    lost_recent = list(Battle.objects.filter(
        defender=player, status=Battle.BattleStatus.COMPLETED, territory_captured=True,
        completed_at__gte=now - timedelta(hours=24),
    ).select_related('target_territory')[:3])

    next_cost = B.buy_cost(owned, adjacent=True)
    earned = B.spendable_earned(player)

    nudges = []
    for b in incoming:
        t = b.target_territory
        try:
            from terra_domini.apps.combat.views import _hold_chance
            hold = round(100 * _hold_chance(b, t))
        except Exception:
            hold = None
        left = _fmt_left(b.resolves_at - now)
        body = (f'{_tname(t)}: battle ends in {left} — {hold}% chance to hold. Reinforce to be safe.'
                if hold is not None and hold >= 50 else f'{_tname(t)} falls in {left} unless you reinforce.')
        nudges.append({
            'id': f'attack-{b.id}', 'type': 'under_attack', 'priority': 100,
            'title': 'Your territory is under attack!',
            'body': body, 'hold_chance': hold,
            'ends_at': b.resolves_at.isoformat(), 'battle_id': str(b.id),
            'cta': {'label': f'REINFORCE ({B.REINFORCE_COST})', 'action': 'reinforce'},
        })
    for b in lost_recent:
        nudges.append({
            'id': f'lost-{b.id}', 'type': 'territory_lost', 'priority': 90,
            'title': 'Territory lost',
            'body': f'{_tname(b.target_territory)} was conquered while you were away. Strike back!',
            'cta': {'label': 'MILITARY', 'panel': 'combat'},
        })
    if harvest['is_full']:
        nudges.append({
            'id': 'harvest-full', 'type': 'harvest_full', 'priority': 80,
            'title': 'Stock full — production is being lost!',
            'body': f"{harvest['lost']} HEX already lost. Collect now." if harvest['lost'] else 'Collect now to keep producing.',
            'cta': {'label': f"COLLECT {harvest['pending']}", 'action': 'collect'},
        })
    elif harvest['pending'] >= max(1, harvest['cap_amount'] // 2):
        nudges.append({
            'id': 'harvest-ready', 'type': 'harvest_ready', 'priority': 50,
            'title': 'Harvest ready', 'body': f"{harvest['pending']} HEX waiting in your stock.",
            'ends_at': harvest['full_at'],
            'cta': {'label': 'COLLECT', 'action': 'collect'},
        })
    for b in recent:
        won = b.winner == 'attacker'
        nudges.append({
            'id': f'result-{b.id}', 'type': 'battle_result', 'priority': 70,
            'title': 'Victory!' if won else 'Attack repelled',
            'body': f"{_tname(b.target_territory)}: "
                    + ('territory captured.' if b.territory_captured else ('raid succeeded.' if won else 'regroup and try again.')),
            'cta': {'label': 'VIEW', 'panel': 'combat'},
        })
    if claimable:
        nudges.append({
            'id': 'missions', 'type': 'missions_claimable', 'priority': 60,
            'title': f'{len(claimable)} mission reward{"s" if len(claimable) > 1 else ""} to claim',
            'body': f'+{sum(m.reward_tdc for m in claimable)} HEX waiting.',
            'cta': {'label': 'CLAIM', 'panel': 'tasks'},
        })
    try:   # real-world events (apps/events/world_events.py): yours to defend, or the hottest one to grab
        from terra_domini.apps.events.news_models import NewsEvent
        live = list(NewsEvent.objects.filter(starts_at__lte=now, ends_at__gt=now).exclude(h3_index='').order_by('-hex_reward')[:20])
        mine = set(Territory.objects.filter(owner=player, h3_index__in=[e.h3_index for e in live]).values_list('h3_index', flat=True))
        for e in [e for e in live if e.h3_index in mine][:2]:
            nudges.append({'id': f'event-{e.id}', 'type': 'event_hold', 'priority': 85,
                           'title': f'Live event on your {e.poi_name}!',
                           'body': f'x3 production · hold it {_fmt_left(e.ends_at - now)} more to win {e.hex_reward} HEX.',
                           'cta': {'label': 'EVENTS', 'panel': 'events'}})
        top = next((e for e in live if e.h3_index not in mine), None)
        if top:
            nudges.append({'id': f'event-{top.id}', 'type': 'event_open', 'priority': 45,
                           'title': top.headline[:80], 'body': f'{top.poi_name}: hold it at the end → {top.hex_reward} HEX ({_fmt_left(top.ends_at - now)} left).',
                           'cta': {'label': 'SEE', 'panel': 'events'}})
    except Exception:
        pass
    if owned == 0:
        nudges.append({
            'id': 'first-claim', 'type': 'first_claim', 'priority': 95,
            'title': 'Claim your first territory — free',
            'body': 'Tap any hex near you on the map.', 'cta': None,
        })
    elif earned + Decimal(str(player.hex_purchased_balance or 0)) >= next_cost:
        nudges.append({
            'id': 'expand', 'type': 'can_expand', 'priority': 40,
            'title': 'You can afford a new territory',
            'body': f'Next adjacent hex from {next_cost} HEX. Grow your kingdom!', 'cta': None,
        })
    nudges.sort(key=lambda n: -n['priority'])

    return Response({
        'server_time': now.isoformat(),
        'balance': float(player.tdc_in_game),
        'earned_balance': float(earned),
        'harvest': harvest,
        'streak': streak,
        'territories': owned,
        'next_territory_cost': next_cost,
        'missions': {'total': len(missions), 'completed': sum(m.is_completed for m in missions),
                     'claimable': len(claimable)},
        'incoming_attacks': len(incoming),
        'nudges': nudges,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def loop_collect(request):
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.progression.missions import track

    now = timezone.now()
    with transaction.atomic():
        player = Player.objects.select_for_update().get(id=request.user.id)
        h = _harvest(player, now)
        if h['pending'] <= 0:
            return Response({'collected': 0, 'lost': h['lost'], 'balance': float(player.tdc_in_game),
                             'harvest': h, 'message': 'Nothing to collect yet.'})
        Player.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + h['pending'], harvest_last_at=now)
        from terra_domini.apps.economy import resources as R
        R.credit(player, {r['id']: r['pending'] for r in h['resources']})
    track(player, 'produce')
    player.refresh_from_db(fields=['tdc_in_game', 'harvest_last_at'])
    return Response({
        'collected': h['pending'], 'lost': h['lost'], 'balance': float(player.tdc_in_game),
        'resources_collected': {r['id']: r['pending'] for r in h['resources'] if r['pending'] > 0},
        'harvest': _harvest(player, now),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def codex_cards(request):
    """GET /api/codex/cards/ — the three card families of the HEXOD master DB, with what the player holds.
    rare: landmark POIs rare+ (plus any POI the player owns) · biomes: DB regions · resources: DB resources."""
    from terra_domini.apps.economy import resources as R
    from terra_domini.apps.economy.models import PlayerResource
    from terra_domini.apps.events import hexod_db
    from terra_domini.apps.territories.models import Territory

    db = hexod_db.load()
    player = request.user
    owned = set(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    rare = []
    on_map = [p for p in db.get('pois', []) if p.get('on_map')]
    for no, p in enumerate(on_map, 1):   # album number = position in the master DB
        mine = p.get('h3_r8') in owned
        if p['rarity'] not in ('rare', 'epic', 'legendary', 'mythic') and not mine:
            continue
        rare.append({
            'uid': p['uid'], 'name': p['name'], 'rarity': p['rarity'], 'category': p.get('codex_category') or '',
            'game_category': p.get('game_category'), 'h3_index': p.get('h3_r8'), 'lat': p.get('lat'), 'lon': p.get('lon'),
            'country_code': p.get('country_code') or '', 'description': (p.get('description') or '')[:400],
            'fun_fact': p.get('fun_fact_1') or '', 'wiki_url': p.get('wiki_url') or '', 'owned': mine, 'no': no,
        })
    order = {'mythic': 0, 'legendary': 1, 'epic': 2, 'rare': 3, 'uncommon': 4, 'common': 5}
    rare.sort(key=lambda c: (not c['owned'], order.get(c['rarity'], 9), c['name']))

    mine_b = R.player_biomes(player)
    meta = R.resources()
    biomes = [{
        'id': b['id'], 'name': b['name'], 'continent': b['continent'], 'type': b['type'],
        'resources': [{'id': r, 'name': meta[r]['name']} for r in b['resource_ids']],
        'center': [round((b['lat_min'] + b['lat_max']) / 2, 2), round((b['lon_min'] + b['lon_max']) / 2, 2)],
        'territories': mine_b.get(b['id'], 0), 'owned': b['id'] in mine_b, 'no': n,
    } for n, b in enumerate(R.biomes(), 1)]
    biomes.sort(key=lambda b: (not b['owned'], b['continent'], b['name']))

    rates = R.player_resource_rates(player)
    stock = {r.resource_id: r for r in PlayerResource.objects.filter(player=player)}
    res = [{
        'id': rid, 'name': r['name'], 'category': r.get('category', ''), 'rarity': r.get('rarity', ''),
        'strategic_use': r.get('strategic_use', ''), 'rate_per_day': rates.get(rid, 0),
        'amount': round(stock[rid].amount, 1) if rid in stock else 0,
        'total_produced': round(stock[rid].total_produced, 1) if rid in stock else 0,
        'owned': rid in rates or rid in stock, 'no': n,
    } for n, (rid, r) in enumerate(meta.items(), 1)]
    res.sort(key=lambda r: (not r['owned'], -r['rate_per_day'], r['name']))

    # Creatures album: every capture is a card (numbered like the DB); counts per family for the empty slots
    from terra_domini.apps.territories.models import SafariCapture
    from collections import Counter
    creatures_db = db.get('creatures', [])
    totals = Counter(c.get('codex_category') or 'animal' for c in creatures_db)
    caught = Counter(SafariCapture.objects.filter(player=player).values_list('creature_id', flat=True))
    creatures = []
    for no, c in enumerate(creatures_db, 1):
        if c['uid'] in caught:
            creatures.append({'uid': c['uid'], 'no': no, 'name': c['name'], 'rarity': c.get('rarity', 'common'),
                              'category': c.get('codex_category') or 'animal', 'description': c.get('description', ''),
                              'wiki_url': c.get('wiki_url', ''), 'count': caught[c['uid']], 'owned': True})
    by_cat = Counter(c['category'] for c in creatures)

    return Response({
        'rare': rare, 'biomes': biomes, 'resources': res, 'creatures': creatures,
        'creature_families': [{'id': k, 'total': v, 'owned': by_cat.get(k, 0)} for k, v in totals.most_common()],
        'summary': {
            'rare': {'owned': sum(c['owned'] for c in rare), 'total': sum(1 for c in rare if c['rarity'] in order and order[c['rarity']] <= 3)},
            'biomes': {'owned': len(mine_b), 'total': len(biomes)},
            'resources': {'owned': sum(r['owned'] for r in res), 'total': len(res)},
            'creatures': {'owned': len(creatures), 'total': len(creatures_db)},
        },
    })


def _yield_fields(h3_index, lat, lon, rarity, category, shiny, connected):
    from terra_domini.apps.economy.resources import hex_yield
    y = hex_yield(h3_index, lat, lon, rarity, category)
    return {'hex_per_day': round(B.territory_hex_per_day(rarity, shiny, connected) * y['mult'], 1),
            'base_hex_per_day': B.territory_hex_per_day(rarity, shiny, connected),
            'hex_bonuses': [{'resource': n, 'pct': p} for n, p in y['bonuses']],
            'bonus_pct': y['bonus_pct'], 'variation_pct': y['variation_pct']}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def territory_card(request, h3_index):
    """GET /api/codex/territory/<h3>/ — real data printed on the back of a territory token."""
    import h3 as h3lib
    from terra_domini.apps.economy import resources as R
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    from terra_domini.apps.territories.models import Territory
    from terra_domini.utils.h3_compat import k_ring

    try:
        lat, lon = h3lib.cell_to_latlng(h3_index)
    except Exception:
        return Response({'error': 'Invalid hex'}, status=400)
    t = Territory.objects.select_related('owner').filter(h3_index=h3_index).first()
    poi = UnifiedPOI.objects.filter(h3_index=h3_index, is_active=True).values(
        'name', 'category', 'token_id', 'real_output', 'description', 'fun_fact', 'wiki_url').first() or {}
    rarity = (t.rarity if t else None) or 'common'
    connected = False
    if t and t.owner_id:
        owned = set(Territory.objects.filter(owner_id=t.owner_id).values_list('h3_index', flat=True))
        connected = any(n in owned for n in k_ring(h3_index, 1) if n != h3_index)
    meta = R.resources()
    rates = R.territory_resource_rates(lat, lon, rarity, poi.get('category', ''))
    region = R.biome_for(round(lat, 3), round(lon, 3))
    return Response({
        'h3_index': h3_index, 'lat': round(lat, 4), 'lon': round(lon, 4),
        'rarity': rarity, 'is_shiny': bool(t and t.is_shiny),
        'owner': t.owner.username if t and t.owner_id else None,
        'captured_at': t.captured_at.date().isoformat() if t and t.captured_at else None,
        **_yield_fields(h3_index, lat, lon, rarity, poi.get('category', ''), bool(t and t.is_shiny), connected),
        'connected': connected,
        'region': {'id': region['id'], 'name': region['name'], 'continent': region['continent']} if region else None,
        'resources': sorted(({'id': k, 'name': meta[k]['name'], 'per_day': round(v, 1)} for k, v in rates.items()),
                            key=lambda r: -r['per_day']),
        'poi_name': poi.get('name'), 'poi_category': poi.get('category'), 'token_id': (t.token_id if t else None) or poi.get('token_id'),
        # Front of the token: texts from the HEXOD master DB
        'title': poi.get('real_output') or '', 'description': poi.get('description') or '',
        'fun_fact': (poi.get('fun_fact') or '').split('\n')[0], 'wiki_url': poi.get('wiki_url') or '',
        'minted': bool(t and t.token_minted_at),
    })
