"""
Admin workspace — Game Master Control Panel.
Accessible at /admin-gm/ (separate from Django admin at /admin/).

Features:
- Live server stats (players online, battles active, TDC in circulation)
- Control Tower management (create, schedule, force-resolve events)
- World POI management (activate/deactivate, edit effects)
- Player management (ban, reset, grant TDC, view stats)
- Economy controls (adjust TDC rate, circuit breaker for withdrawals)
- Live map view of all active battles
- Push broadcast to all players
"""
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Count, Sum, F, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from datetime import timedelta
import logging

logger = logging.getLogger('terra_domini.admin_gm')


class GMRequiredMixin:
    """Mixin for Game Master API views — requires staff status."""
    permission_classes = [IsAdminUser]


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

class GMDashboardView(GMRequiredMixin, APIView):
    """GET /api/gm/dashboard/ — live server snapshot."""

    def get(self, request):
        from terra_domini.apps.accounts.models import Player, PlayerStats
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.combat.engine import Battle, BattleStatus
        from terra_domini.apps.blockchain.service import TDCTransaction
        from terra_domini.apps.events.models import ControlTowerEvent

        now = timezone.now()
        five_min_ago  = now - timedelta(minutes=5)
        hour_ago      = now - timedelta(hours=1)
        day_ago       = now - timedelta(hours=24)

        # Player stats
        total_players  = Player.objects.filter(is_active=True).count()
        online_now     = Player.objects.filter(is_online=True).count()
        active_1h      = Player.objects.filter(last_active__gte=hour_ago).count()
        new_today      = Player.objects.filter(date_joined__gte=day_ago).count()

        # Territory stats
        total_territories  = Territory.objects.count()
        claimed            = Territory.objects.filter(owner__isnull=False).count()
        contested          = Territory.objects.filter(under_attack=True).count() if hasattr(Territory, 'under_attack') else 0

        # Battle stats
        active_battles = Battle.objects.filter(status=BattleStatus.IN_PROGRESS).count()
        resolved_today = Battle.objects.filter(
            resolved_at__gte=day_ago
        ).count()

        # Economy
        tdc_in_game = Player.objects.aggregate(t=Sum('tdc_in_game'))['t'] or 0
        purchases_today = TDCTransaction.objects.filter(
            transaction_type='purchase',
            created_at__gte=day_ago
        ).aggregate(total=Sum('amount_tdc'), count=Count('id'))

        # Tower events
        upcoming_towers = ControlTowerEvent.objects.filter(
            status='scheduled', starts_at__gte=now
        ).count()
        active_towers = ControlTowerEvent.objects.filter(status='active').count()

        return Response({
            'timestamp': now.isoformat(),
            'players': {
                'total': total_players,
                'online_now': online_now,
                'active_1h': active_1h,
                'new_today': new_today,
            },
            'territories': {
                'total': total_territories,
                'claimed': claimed,
                'unclaimed': total_territories - claimed,
                'claim_rate_pct': round((claimed / total_territories * 100) if total_territories else 0, 1),
                'contested': contested,
            },
            'battles': {
                'active': active_battles,
                'resolved_today': resolved_today,
            },
            'economy': {
                'tdc_in_game_total': float(tdc_in_game),
                'purchases_today_count': purchases_today['count'] or 0,
                'purchases_today_tdc': float(purchases_today['total'] or 0),
            },
            'events': {
                'towers_upcoming': upcoming_towers,
                'towers_active': active_towers,
            },
        })


# ─── Player Management ────────────────────────────────────────────────────────

class GMPlayerListView(GMRequiredMixin, APIView):
    """GET /api/gm/players/?search=&sort=rank&limit=50"""

    def get(self, request):
        from terra_domini.apps.accounts.models import Player
        search = request.query_params.get('search', '')
        sort   = request.query_params.get('sort', '-commander_rank')
        limit  = min(int(request.query_params.get('limit', 50)), 200)

        qs = Player.objects.filter(is_active=True).select_related('stats')
        if search:
            qs = qs.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )

        valid_sorts = ['commander_rank', '-commander_rank', 'tdc_in_game',
                       '-tdc_in_game', 'date_joined', '-date_joined',
                       'last_active', '-last_active']
        if sort in valid_sorts:
            qs = qs.order_by(sort)

        players = qs[:limit]
        return Response({
            'count': qs.count(),
            'players': [
                {
                    'id': str(p.id),
                    'username': p.username,
                    'email': p.email,
                    'rank': p.commander_rank,
                    'tdc': float(p.tdc_in_game),
                    'territories': getattr(p.stats, 'territories_owned', 0) if hasattr(p, 'stats') else 0,
                    'battles_won': getattr(p.stats, 'battles_won', 0) if hasattr(p, 'stats') else 0,
                    'is_online': p.is_online,
                    'last_active': p.last_active.isoformat() if p.last_active else None,
                    'date_joined': p.date_joined.isoformat(),
                    'ban_status': p.ban_status if hasattr(p, 'ban_status') else 'none',
                    'anticheat_score': float(p.anticheat_score) if hasattr(p, 'anticheat_score') else 0,
                }
                for p in players
            ],
        })


class GMPlayerActionView(GMRequiredMixin, APIView):
    """POST /api/gm/players/{id}/action/ — ban, grant TDC, reset stats, etc."""

    def post(self, request, player_id):
        from terra_domini.apps.accounts.models import Player
        action = request.data.get('action')
        reason = request.data.get('reason', 'GM action')

        try:
            player = Player.objects.get(id=player_id)
        except Player.DoesNotExist:
            return Response({'error': 'Player not found'}, status=404)

        if action == 'ban':
            player.ban_status = Player.BanStatus.BANNED if hasattr(Player, 'BanStatus') else 'banned'
            player.is_active = False
            player.save(update_fields=['is_active'])
            logger.warning(f'GM {request.user.username} banned {player.username}: {reason}')
            return Response({'done': True, 'action': 'banned', 'player': player.username})

        elif action == 'unban':
            player.is_active = True
            player.save(update_fields=['is_active'])
            return Response({'done': True, 'action': 'unbanned', 'player': player.username})

        elif action == 'grant_tdc':
            amount = int(request.data.get('amount', 0))
            if amount <= 0 or amount > 100000:
                return Response({'error': 'Amount must be 1-100000'}, status=400)
            Player.objects.filter(id=player_id).update(tdc_in_game=F('tdc_in_game') + amount)
            logger.info(f'GM {request.user.username} granted {amount} TDC to {player.username}')
            return Response({'done': True, 'granted_tdc': amount, 'player': player.username})

        elif action == 'reset_anticheat':
            if hasattr(player, 'anticheat_score'):
                Player.objects.filter(id=player_id).update(anticheat_score=0.0)
            return Response({'done': True, 'action': 'anticheat_reset'})

        elif action == 'send_notification':
            message = request.data.get('message', '')
            if not message:
                return Response({'error': 'message required'}, status=400)
            # WebSocket push
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            try:
                cl = get_channel_layer()
                async_to_sync(cl.group_send)(
                    f'player_{player_id}',
                    {'type': 'gm_notification', 'message': message, 'from': 'Game Master'}
                )
            except Exception:
                pass
            return Response({'done': True, 'notified': player.username})

        return Response({'error': f'Unknown action: {action}'}, status=400)


# ─── Control Tower Management ─────────────────────────────────────────────────

class GMTowerView(GMRequiredMixin, APIView):
    """
    GET  /api/gm/towers/        — list all tower events
    POST /api/gm/towers/        — create new tower event
    POST /api/gm/towers/{id}/   — update/resolve/cancel specific event
    """

    def get(self, request):
        from terra_domini.apps.events.models import ControlTowerEvent
        events = ControlTowerEvent.objects.select_related(
            'territory', 'winning_alliance'
        ).order_by('-starts_at')[:100]

        return Response({
            'towers': [
                {
                    'id': str(e.id),
                    'territory': e.territory.place_name if e.territory else '?',
                    'territory_id': str(e.territory_id),
                    'lat': e.territory.center_lat if hasattr(e.territory, 'center_lat') else None,
                    'lon': e.territory.center_lon if hasattr(e.territory, 'center_lon') else None,
                    'status': e.status,
                    'starts_at': e.starts_at.isoformat(),
                    'ends_at': e.ends_at.isoformat(),
                    'participants': e.total_participants,
                    'winner': e.winning_alliance.tag if e.winning_alliance else None,
                    'reward_bonus': e.reward_bonus,
                }
                for e in events
            ]
        })

    def post(self, request, event_id=None):
        from terra_domini.apps.events.models import ControlTowerEvent
        from terra_domini.apps.territories.models import Territory

        if event_id:
            # Update existing event
            try:
                event = ControlTowerEvent.objects.get(id=event_id)
            except ControlTowerEvent.DoesNotExist:
                return Response({'error': 'Event not found'}, status=404)

            action = request.data.get('action')
            if action == 'cancel':
                event.status = ControlTowerEvent.EventStatus.CANCELLED
                event.save(update_fields=['status'])
                return Response({'done': True, 'status': 'cancelled'})
            elif action == 'force_start':
                event.status = ControlTowerEvent.EventStatus.ACTIVE
                event.starts_at = timezone.now()
                event.save(update_fields=['status', 'starts_at'])
                return Response({'done': True, 'status': 'active'})
            elif action == 'force_end':
                event.status = ControlTowerEvent.EventStatus.COMPLETED
                event.ends_at = timezone.now()
                event.save(update_fields=['status', 'ends_at'])
                return Response({'done': True, 'status': 'completed'})

        else:
            # Create new tower event
            territory_id = request.data.get('territory_id')
            starts_in_minutes = int(request.data.get('starts_in_minutes', 60))
            duration_minutes  = int(request.data.get('duration_minutes', 120))

            try:
                territory = Territory.objects.get(id=territory_id, is_control_tower=True)
            except Territory.DoesNotExist:
                return Response({'error': 'Territory not found or not a tower'}, status=404)

            start = timezone.now() + timedelta(minutes=starts_in_minutes)
            event = ControlTowerEvent.objects.create(
                territory=territory,
                announced_at=timezone.now(),
                starts_at=start,
                ends_at=start + timedelta(minutes=duration_minutes),
                status=ControlTowerEvent.EventStatus.SCHEDULED,
                reward_bonus=request.data.get('reward_bonus', {}),
            )
            logger.info(f'GM {request.user.username} created tower event for {territory.place_name}')
            return Response({'created': str(event.id), 'starts_at': event.starts_at.isoformat()})


# ─── POI Management ───────────────────────────────────────────────────────────

class GMPOIView(GMRequiredMixin, APIView):
    """GET/POST/PATCH /api/gm/pois/ — manage world events."""

    def get(self, request):
        from terra_domini.apps.events.poi_models import WorldPOI
        pois = WorldPOI.objects.all().order_by('-is_featured', '-threat_level')[:100]
        return Response({
            'pois': [
                {
                    'id': str(p.id),
                    'name': p.name,
                    'slug': p.slug,
                    'category': p.category,
                    'threat': p.threat_level,
                    'status': p.status,
                    'lat': p.latitude,
                    'lon': p.longitude,
                    'radius_km': p.radius_km,
                    'featured': p.is_featured,
                    'pulse': p.pulse,
                    'effects': p.effects,
                }
                for p in pois
            ]
        })

    def post(self, request):
        """Activate/deactivate a POI or update its effects."""
        from terra_domini.apps.events.poi_models import WorldPOI
        poi_id = request.data.get('poi_id')
        action = request.data.get('action')

        try:
            poi = WorldPOI.objects.get(id=poi_id)
        except WorldPOI.DoesNotExist:
            return Response({'error': 'POI not found'}, status=404)

        if action == 'activate':
            poi.status = WorldPOI.POIStatus.ACTIVE
            poi.is_featured = True
            poi.pulse = True
            poi.event_started_at = timezone.now()
            poi.save(update_fields=['status', 'is_featured', 'pulse', 'event_started_at'])

        elif action == 'deactivate':
            poi.status = WorldPOI.POIStatus.RESOLVED
            poi.is_featured = False
            poi.pulse = False
            poi.save(update_fields=['status', 'is_featured', 'pulse'])

        elif action == 'update_effects':
            poi.effects = request.data.get('effects', poi.effects)
            poi.save(update_fields=['effects'])

        elif action == 'update_threat':
            poi.threat_level = request.data.get('threat_level', poi.threat_level)
            poi.save(update_fields=['threat_level'])

        logger.info(f'GM {request.user.username} {action} POI {poi.name}')
        return Response({'done': True, 'poi': poi.name, 'action': action})


# ─── Broadcast ────────────────────────────────────────────────────────────────

class GMBroadcastView(GMRequiredMixin, APIView):
    """POST /api/gm/broadcast/ — send message to all online players."""

    def post(self, request):
        message  = request.data.get('message', '').strip()
        msg_type = request.data.get('type', 'announcement')  # announcement | alert | event
        if not message:
            return Response({'error': 'message required'}, status=400)
        if len(message) > 280:
            return Response({'error': 'Max 280 characters'}, status=400)

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        try:
            cl = get_channel_layer()
            async_to_sync(cl.group_send)(
                'broadcast',
                {
                    'type': 'server_broadcast',
                    'message': message,
                    'msg_type': msg_type,
                    'from': f'Game Master ({request.user.username})',
                    'timestamp': timezone.now().isoformat(),
                }
            )
            logger.info(f'GM broadcast by {request.user.username}: {message[:50]}')
            return Response({'sent': True, 'message': message})
        except Exception as e:
            return Response({'error': f'Broadcast failed: {e}'}, status=503)


# ─── Economy Controls ─────────────────────────────────────────────────────────

class GMEconomyView(GMRequiredMixin, APIView):
    """GET/POST /api/gm/economy/ — TDC rate, circuit breakers."""

    def get(self, request):
        from django.core.cache import cache
        from terra_domini.apps.accounts.models import Player
        from django.db.models import Sum

        return Response({
            'tdc_eur_rate': float(cache.get('tdc_market_rate_eur', 0.01)),
            'withdrawals_enabled': cache.get('withdrawals_enabled', True),
            'purchases_enabled': cache.get('purchases_enabled', True),
            'total_tdc_supply': float(Player.objects.aggregate(t=Sum('tdc_in_game'))['t'] or 0),
            'max_withdrawal_daily': cache.get('max_withdrawal_daily', 500),
        })

    def post(self, request):
        from django.core.cache import cache
        action = request.data.get('action')

        if action == 'disable_withdrawals':
            cache.set('withdrawals_enabled', False, timeout=None)
            logger.warning(f'GM {request.user.username} DISABLED withdrawals')
            return Response({'done': True, 'withdrawals_enabled': False})

        elif action == 'enable_withdrawals':
            cache.set('withdrawals_enabled', True, timeout=None)
            return Response({'done': True, 'withdrawals_enabled': True})

        elif action == 'set_tdc_rate':
            rate = float(request.data.get('rate', 0.01))
            if not 0.001 <= rate <= 1.0:
                return Response({'error': 'Rate must be between 0.001 and 1.0'}, status=400)
            cache.set('tdc_market_rate_eur', rate, timeout=3600)
            logger.info(f'GM set TDC rate to {rate}')
            return Response({'done': True, 'new_rate': rate})

        return Response({'error': f'Unknown action: {action}'}, status=400)
