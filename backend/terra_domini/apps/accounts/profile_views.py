"""
GET /api/players/me/profile-stats/ — the profile screen, every number from the live game (owner 2026-10-18:
"profile panel is not connected to anything"): empire, army, battle record, collection, rank, streak, recent battles.
"""
from django.db.models import Count, Q, Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_stats(request):
    from terra_domini.apps.combat.engine import Battle, BattleParticipant
    from terra_domini.apps.economy.balance import player_hex_per_day
    from terra_domini.apps.events.news_models import EventCard
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.territories.upgrades import clusters
    me = request.user

    owned = dict(Territory.objects.filter(owner=me).values_list('h3_index', 'rarity'))
    comps = clusters(set(owned))
    by_rarity = {}
    for r in owned.values():
        by_rarity[r] = by_rarity.get(r, 0) + 1

    pts = Territory.objects.filter(owner=me).aggregate(a=Sum('atk_pts'), d=Sum('def_pts'), s=Sum('spy_pts'))
    army = {'attack': pts['a'] or 0, 'defense': pts['d'] or 0, 'spy': pts['s'] or 0}      # forces (combat/forces.py)

    done = Battle.objects.filter(status='completed')
    atk = done.filter(participants__player=me, participants__side='attacker').distinct()
    dfn = done.filter(defender=me)
    record = {'attacks_won': atk.filter(winner='attacker').count(), 'attacks_lost': atk.filter(winner='defender').count(),
              'defenses_won': dfn.filter(winner='defender').count(), 'defenses_lost': dfn.filter(winner='attacker').count(),
              'territories_captured': atk.filter(territory_captured=True).count()}
    lost = 0
    for d in BattleParticipant.objects.filter(player=me).values_list('units_lost', flat=True):
        lost += sum(v for v in (d or {}).values() if isinstance(v, (int, float)))
    record['units_lost'] = int(lost)

    recent = []
    ids = set(atk.values_list('id', flat=True)) | set(dfn.values_list('id', flat=True))
    for b in Battle.objects.filter(id__in=ids).select_related('target_territory', 'defender').order_by('-completed_at')[:6]:
        mine_atk = b.defender_id != me.id
        t = b.target_territory
        recent.append({'id': str(b.id), 'role': 'attack' if mine_atk else 'defense',
                       'won': (b.winner == 'attacker') == mine_atk, 'captured': b.territory_captured,
                       'place': (t.custom_name or t.poi_name or t.place_name or t.h3_index[:8]) if t else '',
                       'opponent': (b.defender.username if mine_atk and b.defender else
                                    BattleParticipant.objects.filter(battle=b, side='attacker', is_commander=True)
                                    .values_list('player__username', flat=True).first()) or 'unclaimed',
                       'at': (b.completed_at or b.started_at).isoformat()})

    pois = UnifiedPOI.objects.filter(h3_index__in=list(owned), is_active=True).count()
    collection = {'landmarks': pois, 'event_tokens': EventCard.objects.filter(player=me).count(), 'by_rarity': by_rarity}

    # Rank by territories held (the Ladder's main criterion)
    counts = Territory.objects.filter(owner__isnull=False).values('owner').annotate(n=Count('h3_index'))
    rank = 1 + sum(1 for c in counts if c['n'] > len(owned))
    players = len(counts) or 1

    streak = {'current': 0, 'longest': 0, 'days': 0}
    try:
        s = me.streak
    except Exception:
        s = None
    if s:
        streak = {'current': s.current_streak, 'longest': s.longest_streak, 'days': s.total_login_days}

    return Response({
        'empire': {'territories': len(owned), 'kingdoms': sum(1 for c in comps if len(c) > 1),
                   'largest_kingdom': max((len(c) for c in comps), default=0), 'hex_per_day': player_hex_per_day(me),
                   'balance': float(me.tdc_in_game or 0)},
        'army': army, 'record': record, 'recent_battles': recent, 'collection': collection,
        'rank': {'position': rank, 'players': players}, 'streak': streak,
        'joined': me.date_joined.isoformat() if me.date_joined else None,
    })
