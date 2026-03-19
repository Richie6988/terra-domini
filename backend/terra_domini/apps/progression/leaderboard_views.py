"""
Leaderboard endpoints.
GET /api/leaderboard/global/     — top 100 global
GET /api/leaderboard/regional/   — top 50 in player's country
GET /api/leaderboard/alliance/   — top 20 in player's alliance
GET /api/leaderboard/player/{id}/territories/ — visit player's zones
"""
import logging
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger('terra_domini.leaderboard')


class LeaderboardViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def _score(self, player):
        """Composite score: territories * 100 + battles_won * 50 + TDC * 0.1"""
        try:
            s = player.stats
            return int(s.territories_owned * 100 + s.battles_won * 50 + float(player.tdc_in_game) * 0.1)
        except Exception:
            return 0

    @action(detail=False, methods=['GET'], url_path='global')
    def global_lb(self, request):
        from terra_domini.apps.accounts.models import Player
        players = Player.objects.filter(
            is_bot=False, is_active=True
        ).select_related('stats').prefetch_related('alliance_member__alliance')[:200]

        ranked = sorted(players, key=lambda p: -self._score(p))[:100]
        me_rank = next((i+1 for i,p in enumerate(ranked) if str(p.id)==str(request.user.id)), None)

        return Response({
            'me_rank': me_rank,
            'entries': [{
                'rank': i+1,
                'id': str(p.id),
                'username': p.username,
                'display_name': getattr(p, 'display_name', p.username),
                'avatar_emoji': getattr(p, 'avatar_emoji', '🎖️'),
                'commander_rank': p.commander_rank,
                'score': self._score(p),
                'territories': getattr(p.stats, 'territories_owned', 0) if hasattr(p, 'stats') else 0,
                'battles_won': getattr(p.stats, 'battles_won', 0) if hasattr(p, 'stats') else 0,
                'tdc': float(p.tdc_in_game),
                'alliance': p.alliance_member.alliance.name if hasattr(p, 'alliance_member') and p.alliance_member else None,
                'is_me': str(p.id) == str(request.user.id),
                'delta_rank': None,  # would come from LeaderboardSnapshot
            } for i, p in enumerate(ranked)]
        })

    @action(detail=False, methods=['GET'], url_path='regional')
    def regional(self, request):
        """Top players in requester's most-owned country."""
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.accounts.models import Player
        from django.db.models import Count

        # Find player's dominant country
        top_country = Territory.objects.filter(
            owner=request.user, country_code__isnull=False
        ).values('country_code').annotate(c=Count('id')).order_by('-c').first()

        country = (top_country or {}).get('country_code', 'FR')

        # Players with zones in that country
        player_ids = Territory.objects.filter(
            country_code=country
        ).exclude(owner=None).values_list('owner_id', flat=True).distinct()

        players = Player.objects.filter(
            id__in=player_ids, is_bot=False
        ).select_related('stats')[:50]
        ranked  = sorted(players, key=lambda p: -self._score(p))

        return Response({
            'country': country,
            'entries': [{
                'rank': i+1,
                'id': str(p.id),
                'username': p.username,
                'avatar_emoji': getattr(p, 'avatar_emoji', '🎖️'),
                'score': self._score(p),
                'territories': getattr(p.stats, 'territories_owned', 0) if hasattr(p, 'stats') else 0,
                'is_me': str(p.id) == str(request.user.id),
            } for i, p in enumerate(ranked)]
        })

    @action(detail=False, methods=['GET'], url_path=r'player/(?P<player_id>[^/.]+)/territories')
    def player_territories(self, request, player_id=None):
        """Public view of another player's territories — for leaderboard profile visit."""
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.accounts.models import Player

        try:
            target = Player.objects.get(id=player_id, is_bot=False)
        except Player.DoesNotExist:
            return Response({'error': 'Player not found'}, status=404)

        territories = Territory.objects.filter(owner=target).values(
            'h3_index', 'center_lat', 'center_lon', 'place_name',
            'country_code', 'is_control_tower', 'defense_tier',
        )[:200]

        return Response({
            'player': {
                'id': str(target.id),
                'username': target.username,
                'display_name': getattr(target, 'display_name', target.username),
                'avatar_emoji': getattr(target, 'avatar_emoji', '🎖️'),
                'commander_rank': target.commander_rank,
                'territories_owned': territories.count(),
            },
            'territories': list(territories),
        })
