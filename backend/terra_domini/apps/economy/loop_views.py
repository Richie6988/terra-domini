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
            'cta': {'label': 'DEFEND', 'action': 'reinforce'},   # opens the war room (troops, walls, bonus)
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
    try:   # Risk regions (territories/regions.py): one more hex to take a region, or a rival closing in on yours
        from terra_domini.apps.territories import regions as R
        me = str(player.id)
        for rid, e in R.standings().items():
            mine_n = e['counts'].get(me, 0)
            if not mine_n:
                continue
            lead, _ = R.leader_of(e)
            rival = max((n for o, n in e['counts'].items() if o != me), default=0)
            if lead == me and rival >= mine_n - 1:
                nudges.append({'id': f'region-threat-{rid}-{rival}', 'type': 'region_threat', 'priority': 75,
                               'title': f'{e["name"]} is slipping away',
                               'body': f'A rival holds {rival} territories there, you {mine_n}. Expand or attack to keep +{R.REGION_DRAFT} troops a day.',
                               'cta': {'label': 'REGIONS', 'panel': 'empire', 'tab': 'regions'}})
            elif lead != me and max(R.REGION_MIN - mine_n, rival - mine_n + 1) == 1:
                nudges.append({'id': f'region-close-{rid}-{mine_n}', 'type': 'region_close', 'priority': 55,
                               'title': f'One territory away from {e["name"]}',
                               'body': f'Take one more hex there to control the region: +{R.REGION_DRAFT} troops a day, +{R.REGION_HEX_PCT}% HEX.',
                               'cta': {'label': 'REGIONS', 'panel': 'empire', 'tab': 'regions'}})
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
    track(player, 'produce')
    player.refresh_from_db(fields=['tdc_in_game', 'harvest_last_at'])
    return Response({
        'collected': h['pending'], 'lost': h['lost'], 'balance': float(player.tdc_in_game),
        'harvest': _harvest(player, now),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def codex_cards(request):
    """GET /api/codex/cards/ — the three card families of the HEXOD master DB, with what the player holds.
    rare: landmark POIs rare+ (plus any POI the player owns) · biomes: DB regions · resources: the resource tokens
    (real extraction sites: oil fields, gold and diamond mines… — economy/resources.RESOURCE_SITES)."""
    from terra_domini.apps.economy import resources as R
    from terra_domini.apps.events import hexod_db
    from terra_domini.apps.territories.models import Territory

    db = hexod_db.load()
    player = request.user
    owned = set(Territory.objects.filter(owner=player).values_list('h3_index', flat=True))
    # Album = every token edition the player ever took (CollectedToken); only the hexes held now produce (owner 2026-10-20)
    from terra_domini.apps.territories.models import CollectedToken
    coll = {}
    for h, ed in CollectedToken.objects.filter(player=player).values_list('h3_index', 'edition'):
        coll[h] = max(coll.get(h, 0), ed)
    rare = []
    on_map = [p for p in db.get('pois', []) if p.get('on_map')]
    for no, p in enumerate(on_map, 1):   # album number = position in the master DB
        mine = p.get('h3_r8') in owned
        if p.get('kind') in ('species', 'resource'):     # their own albums (creatures, resources)
            continue
        if p['rarity'] not in ('rare', 'epic', 'legendary', 'mythic') and not mine and p.get('h3_r8') not in coll:
            continue
        rare.append({
            'uid': p['uid'], 'name': p['name'], 'rarity': p['rarity'], 'category': p.get('codex_category') or '',
            'game_category': p.get('game_category'), 'h3_index': p.get('h3_r8'), 'lat': p.get('lat'), 'lon': p.get('lon'),
            'country_code': p.get('country_code') or '', 'description': (p.get('description') or '')[:400],
            'fun_fact': p.get('fun_fact_1') or '', 'wiki_url': p.get('wiki_url') or '', 'owned': mine, 'no': no,
            'image_url': p.get('image_url') or '', 'terrain': p.get('game_category') or '',
            'satellite_url': satellite_tile_url(p['lat'], p['lon']) if p.get('lat') is not None else '',
        })
    order = {'mythic': 0, 'legendary': 1, 'epic': 2, 'rare': 3, 'uncommon': 4, 'common': 5}
    rare.sort(key=lambda c: (not c['owned'], order.get(c['rarity'], 9), c['name']))

    mine_b = R.player_biomes(player)
    meta = R.resources()
    biomes = [{
        'id': b['id'], 'name': b['name'], 'continent': b['continent'], 'type': b['type'],
        'center': [round((b['lat_min'] + b['lat_max']) / 2, 2), round((b['lon_min'] + b['lon_max']) / 2, 2)],
        'territories': mine_b.get(b['id'], 0), 'owned': b['id'] in mine_b, 'no': n,
    } for n, b in enumerate(R.biomes(), 1)]
    biomes.sort(key=lambda b: (not b['owned'], b['continent'], b['name']))

    res = []
    for no, p in enumerate(on_map, 1):
        rid = R.site_resource(p.get('game_category'))
        if not rid:
            continue
        res.append({
            'uid': p['uid'], 'id': rid, 'resource': meta[rid]['name'], 'name': p['name'], 'rarity': p['rarity'],
            'category': meta[rid]['name'], 'hex_per_day': round(B.token_hex_per_day(p['rarity'])),
            'h3_index': p.get('h3_r8'), 'lat': p.get('lat'), 'lon': p.get('lon'), 'country_code': p.get('country_code') or '',
            'description': (p.get('description') or '')[:400], 'wiki_url': p.get('wiki_url') or '', 'image_url': p.get('image_url') or '',
            'satellite_url': satellite_tile_url(p['lat'], p['lon']) if p.get('lat') is not None else '',
            'owned': p.get('h3_r8') in owned, 'no': no,
        })
    res.sort(key=lambda r: (not r['owned'], -r['hex_per_day'], r['name']))

    # Creatures album: every capture is a card (numbered like the DB); counts per family for the empty slots
    from terra_domini.apps.territories.models import SafariCapture
    from collections import Counter
    creatures_db = db.get('creatures', [])
    totals = Counter(c.get('codex_category') or 'animal' for c in creatures_db)
    caught = Counter(SafariCapture.objects.filter(player=player).values_list('creature_id', flat=True))
    for p in on_map:      # a species token on one of my hexes is mine too (caught with the Safari, or held)
        if p.get('kind') == 'species' and p.get('h3_r8') in owned and p.get('creature_uid') not in caught:
            caught[p['creature_uid']] = 1
    creatures = []
    for no, c in enumerate(creatures_db, 1):
        if c['uid'] in caught:
            creatures.append({'uid': c['uid'], 'no': no, 'name': c['name'], 'rarity': c.get('rarity', 'common'),
                              'category': c.get('codex_category') or 'animal', 'description': c.get('description', ''),
                              'wiki_url': c.get('wiki_url', ''), 'count': caught[c['uid']], 'owned': True,
                              'image_url': c.get('image_url', ''), 'image_credit': c.get('image_credit', ''),
                              'fossil_count': c.get('fossil_count', 0), 'fossil_sites': c.get('fossil_sites', [])})
    # Fantastic creatures (SafariTarget.FANTASY): their own family, numbered after the DB species
    from terra_domini.apps.territories.models import SafariTarget
    for k, (uid, name, rarity, _, legend) in enumerate(SafariTarget.FANTASY, len(creatures_db) + 1):
        if uid in caught:
            creatures.append({'uid': uid, 'no': k, 'name': name, 'rarity': rarity, 'category': 'fantasy', 'description': legend,
                              'wiki_url': '', 'count': caught[uid], 'owned': True, 'image_url': '', 'image_credit': ''})
    totals['fantasy'] = len(SafariTarget.FANTASY)
    by_cat = Counter(c['category'] for c in creatures)

    # History album: retrospective tokens (history_event POIs) — own the hex to own the card
    history = [{
        'uid': p['uid'], 'name': p['name'], 'rarity': p['rarity'], 'category': 'history', 'event_date': p.get('event_date') or '',
        'h3_index': p.get('h3_r8'), 'lat': p.get('lat'), 'lon': p.get('lon'), 'country_code': p.get('country_code') or '',
        'description': (p.get('description') or '')[:400], 'wiki_url': p.get('wiki_url') or '', 'image_url': p.get('image_url') or '',
        'satellite_url': satellite_tile_url(p['lat'], p['lon']) if p.get('lat') is not None else '',
        'owned': p.get('h3_r8') in owned, 'no': no,
    } for no, p in enumerate(on_map, 1) if p.get('game_category') == 'history_event']
    history.sort(key=lambda c: (not c['owned'], c['event_date'] or '9999'))
    # News tokens won on world events (sport, geopolitics) — the hex holder at the end gets the card
    from terra_domini.apps.events.news_models import EventCard
    events = [{
        'uid': str(e.id), 'name': e.headline, 'rarity': e.rarity, 'category': e.kind or 'news', 'event_date': e.event_date.isoformat(),
        'h3_index': e.h3_index, 'lat': e.latitude, 'lon': e.longitude, 'location': e.location_name,
        'image_url': e.image_url, 'wiki_url': e.source_url, 'owned': True, 'no': n,
        'serial': e.serial, 'max_supply': e.max_supply, 'price': e.price_hex,     # x/10 edition, on sale if price
    } for n, e in enumerate(EventCard.objects.filter(player=player).order_by('event_date'), 1)]

    for lst in (rare, res, history):     # owned = in the album, producing = hex held now, edition = the player's copy
        for c in lst:
            held = c['owned']
            c['producing'] = held
            c['owned'] = held or c.get('h3_index') in coll
            c['edition'] = coll.get(c.get('h3_index')) or (1 if held else None)
    return Response({
        'rare': rare, 'biomes': biomes, 'resources': res, 'creatures': creatures, 'history': history, 'events': events,
        'creature_families': [{'id': k, 'total': v, 'owned': by_cat.get(k, 0)} for k, v in totals.most_common()],
        'summary': {
            'rare': {'owned': sum(c['owned'] for c in rare), 'total': sum(1 for c in rare if c['rarity'] in order and order[c['rarity']] <= 3)},
            'biomes': {'owned': len(mine_b), 'total': len(biomes)},
            'resources': {'owned': sum(r['owned'] for r in res), 'total': len(res)},
            'creatures': {'owned': len(creatures), 'total': len(creatures_db) + len(SafariTarget.FANTASY)},
            'history': {'owned': sum(c['owned'] for c in history), 'total': len(history)},
            'events': {'owned': len(events), 'total': len(events)},
        },
    })


TERRAIN_LABEL = {
    'urban': 'Urban district', 'rural': 'Countryside', 'farmland': 'Farmland', 'grassland': 'Grassland', 'forest': 'Forest',
    'mountain': 'Mountain land', 'coastal': 'Coastline', 'desert': 'Desert', 'tundra': 'Tundra', 'ice': 'Ice field',
    'ocean': 'Open sea', 'lake': 'Lake', 'wetland': 'Wetland', 'industrial': 'Industrial zone', 'arctic': 'Arctic land',
    'water': 'Water', 'landmark': 'Landmark site',
}


def _terrain_of(t, lat, lon) -> str:
    """Terrain shown on the card: the territory's measured biome, else the terrain rules for this point
    (hexes nobody created yet — open sea included)."""
    if t and t.biome and t.biome != 'grassland':
        return t.biome
    from terra_domini.apps.territories.terrain_rules import terrain
    return terrain(round(lat, 4), round(lon, 4))[0] if lat is not None else (t.territory_type if t else '')


def _place_description(t, terr, region, rates, meta) -> str:
    """Card text of a hex without a POI, only from what is known about it: measured terrain, place, region, elevation,
    what it produces. Never invented."""
    where = ', '.join(x for x in ((t.place_name if t else ''), region['name'] if region else '', (t.country_code if t else '')) if x)
    bits = [f"{TERRAIN_LABEL.get(terr, terr.title())}{' · ' + where if where else ''}."]
    if t and t.elevation_m is not None and t.elevation_m > 0 and terr not in ('ocean', 'lake'):
        bits.append(f'{t.elevation_m:,} m above sea level.')
    top = [meta[k]['name'] for k, _ in sorted(rates.items(), key=lambda kv: -kv[1])[:3] if k in meta]
    if top:
        bits.append('Produces ' + ', '.join(top) + '.')
    return ' '.join(bits)


def satellite_tile_url(lat, lon, z=15) -> str:
    """Same-origin sharp satellite picture centred on the hex (see satellite_card)."""
    import h3 as h3lib
    return f'/api/tiles/satcard/{h3lib.latlng_to_cell(lat, lon, 8)}.jpg?v=2'   # v2 = exactly centred


def _esri_tile(z, x, y):
    """One Esri World Imagery tile (bytes), cached on disk; None when unavailable."""
    from terra_domini.apps.territories.landcover import CACHE
    import urllib.request
    f = CACHE / 'sat' / str(z) / str(x) / f'{y}.jpg'
    if f.exists():
        return f.read_bytes() or None
    try:
        req = urllib.request.Request(f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                                     headers={'User-Agent': 'HEXOD/1.0 (https://hexod.paintit.click)'})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = r.read()
    except Exception:
        return None
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    return data


@api_view(['GET'])
@permission_classes([])
def satellite_card(request, h3_index):
    """GET /api/tiles/satcard/<h3>.jpg — 640×640 satellite picture of the hex, sharp (zoom-16 tiles) and exactly centred
    on the hex: the zoom-16 tiles covering the frame are stitched, then cropped. Cached on disk."""
    import io
    import math
    import h3 as h3lib
    from django.http import HttpResponse
    from PIL import Image
    from terra_domini.apps.territories.landcover import CACHE
    try:
        lat, lon = h3lib.cell_to_latlng(h3_index)
    except Exception:
        return HttpResponse(status=400)
    out = CACHE / 'satcard2' / f'{h3_index}.jpg'   # v2: exactly centred (v1 clamped its crop, hex up to 64 px off)
    if not out.exists():
        z, n, size = 16, 2 ** 16, 640
        fx = (lon + 180) / 360 * n
        lr = math.radians(max(-85.05, min(85.05, lat)))
        fy = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
        # the 640 px frame centred on the hex, in global zoom-16 pixels; fetch exactly the tiles it covers
        left, top = int(round(fx * 256)) - size // 2, int(round(fy * 256)) - size // 2
        tx0, ty0 = left // 256, top // 256
        tx1, ty1 = (left + size - 1) // 256, (top + size - 1) // 256
        canvas = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (12, 30, 60))
        got = 0
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                if not 0 <= ty < n:
                    continue
                data = _esri_tile(z, tx % n, ty)
                if data:
                    try:
                        canvas.paste(Image.open(io.BytesIO(data)).convert('RGB'), ((tx - tx0) * 256, (ty - ty0) * 256))
                        got += 1
                    except Exception:
                        pass
        if not got:
            return HttpResponse(status=502)
        ox, oy = left - tx0 * 256, top - ty0 * 256
        out.parent.mkdir(parents=True, exist_ok=True)
        canvas.crop((ox, oy, ox + size, oy + size)).save(out, 'JPEG', quality=86)
    resp = HttpResponse(out.read_bytes(), content_type='image/jpeg')
    resp['Cache-Control'] = 'public, max-age=2592000'
    return resp


@api_view(['GET'])
@permission_classes([])
def satellite_tile(request, z, x, y):
    """GET /api/tiles/sat/<z>/<x>/<y>.jpg — one Esri World Imagery tile, same-origin and cached (canvas-safe)."""
    from django.http import HttpResponse
    z, x, y = int(z), int(x), int(y)
    if not (0 <= z <= 18 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        return HttpResponse(status=400)
    data = _esri_tile(z, x, y)
    if not data:
        return HttpResponse(status=502)
    resp = HttpResponse(data, content_type='image/jpeg')
    resp['Cache-Control'] = 'public, max-age=2592000'
    return resp


def _yield_fields(h3_index, lat, lon, rarity, category, shiny, connected):
    """HEX/day of a hex: plain value (+ kingdom bonus) + each token on it (balance.hex_income)."""
    toks = B.hex_tokens([h3_index]).get(h3_index, [])
    tok = [{'name': n, 'category': c, 'rarity': r, 'hex_per_day': round(B.token_hex_per_day(r, c), 1)} for n, c, r in toks]
    bon = [{'resource': b[0], 'pct': b[1]} for b in (B.token_bonus(t['category']) for t in tok) if b]
    return {'hex_per_day': round(B.hex_income(h3_index, connected, toks), 1),
            'base_hex_per_day': B.plain_hex_per_day(connected), 'plain_hex_per_day': B.PLAIN_HEX_PER_DAY,
            'kingdom_bonus': B.KINGDOM_BONUS, 'tokens': tok, 'has_token': bool(tok),
            'hex_bonuses': bon, 'bonus_pct': sum(b['pct'] for b in bon), 'variation_pct': 0}


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
        'name', 'category', 'token_id', 'real_output', 'description', 'fun_fact', 'wiki_url', 'image_url', 'image_credit', 'event_date', 'rarity', 'country_code').first() or {}
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
        'edition': (t.nft_version if t else 1) or 1, 'edition_label': B.edition_label(t.nft_version if t else 1),
        'edition_value_mult': B.edition_value_mult(t.nft_version if t else 1),
        'terrain': _terrain_of(t, lat, lon), 'country_code': (t.country_code if t else '') or poi.get('country_code', '') or '',
        'rarity': rarity, 'is_shiny': bool(t and t.is_shiny),
        'owner': t.owner.username if t and t.owner_id else None,
        'captured_at': t.captured_at.date().isoformat() if t and t.captured_at else None,
        **_yield_fields(h3_index, lat, lon, rarity, poi.get('category', ''), bool(t and t.is_shiny), connected),
        'connected': connected,
        'region': {'id': region['id'], 'name': region['name'], 'continent': region['continent']} if region else None,
        # resource token (real extraction site): its resource and the HEX bonus it pays — regular hexes: []
        'resources': [{'id': k, 'name': meta[k]['name']} for k in rates],
        'poi_name': poi.get('name'), 'poi_category': poi.get('category'), 'token_id': (t.token_id if t else None) or poi.get('token_id'),
        # Front of the token: texts from the HEXOD master DB
        'title': poi.get('real_output') or '', 'description': poi.get('description') or _place_description(t, _terrain_of(t, lat, lon), region, rates, meta),
        'fun_fact': (poi.get('fun_fact') or '').split('\n')[0], 'wiki_url': poi.get('wiki_url') or '',
        'image_url': poi.get('image_url') or '',
        'satellite_url': satellite_tile_url(lat, lon),   # real view of the hex: picture of every non-POI card
        'image_credit': poi.get('image_credit') or '',   # author · license (CC BY-SA requires it next to the picture)
        'event_date': poi.get('event_date') or '',
        'minted': bool(t and t.token_minted_at),
        # Emission date of the current edition: genesis = when the place entered the game, later editions = the conquest
        'issued_at': ((t.captured_at if (t.nft_version or 1) > 1 and t.captured_at else t.created_at).date().isoformat()) if t else None,
    })
