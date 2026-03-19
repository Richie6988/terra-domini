"""
WebSocket Consumers — real-time game state delivery.
Players connect to: territory viewport updates, battle events, chat, notifications.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.core.cache import caches

logger = logging.getLogger('terra_domini.websocket')


class TerritoryMapConsumer(AsyncWebsocketConsumer):
    """
    Primary game WebSocket — receives viewport and broadcasts territory updates.
    One connection per player session.
    
    Client → Server messages:
      - {type: 'viewport', lat, lon, radius_km}  → get territories in view
      - {type: 'subscribe_territory', h3_index}  → real-time updates for 1 hex
      - {type: 'unsubscribe_territory', h3_index}
      - {type: 'ping'}
    
    Server → Client messages:
      - {type: 'territory_state', territories: [...]}
      - {type: 'territory_update', territory: {...}}
      - {type: 'battle_event', battle: {...}}
      - {type: 'pong'}
    """

    VIEWPORT_GROUP_PREFIX = 'viewport'
    TERRITORY_GROUP_PREFIX = 'territory'
    PLAYER_GROUP_PREFIX = 'player'

    async def connect(self):
        self.player = self.scope.get('user')
        if not self.player or not self.player.is_authenticated:
            await self.close(code=4001)
            return

        self.player_id = str(self.player.id)
        self.subscribed_territories = set()
        self.player_group = f"{self.PLAYER_GROUP_PREFIX}_{self.player_id}"

        # Join player-specific group for direct notifications
        await self.channel_layer.group_add(self.player_group, self.channel_name)

        await self.accept()
        await self._mark_player_online()

        # Send initial state
        await self.send(json.dumps({
            'type': 'connected',
            'player_id': self.player_id,
            'server_time': timezone.now().isoformat(),
        }))

        logger.debug(f"Player {self.player.username} connected via WebSocket")

    async def disconnect(self, close_code):
        if not hasattr(self, 'player'):
            return

        # Leave all groups
        await self.channel_layer.group_discard(self.player_group, self.channel_name)
        for h3_idx in self.subscribed_territories:
            await self.channel_layer.group_discard(
                f"{self.TERRITORY_GROUP_PREFIX}_{h3_idx}", self.channel_name
            )

        await self._mark_player_offline()
        logger.debug(f"Player {self.player.username} disconnected")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')

            if msg_type == 'viewport':
                await self._handle_viewport(data)
            elif msg_type == 'subscribe_territory':
                await self._handle_subscribe_territory(data)
            elif msg_type == 'unsubscribe_territory':
                await self._handle_unsubscribe_territory(data)
            elif msg_type == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
            elif msg_type == 'click_territory':
                await self._handle_territory_click(data)
            else:
                logger.warning(f"Unknown WS message type: {msg_type}")

        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from player {self.player_id}")
        except Exception as e:
            logger.error(f"WS receive error: {e}", exc_info=True)

    # ─── Message handlers ─────────────────────────────────────────────────────

    async def _handle_viewport(self, data):
        """Player moved map — send visible territories."""
        lat = float(data.get('lat', 0))
        lon = float(data.get('lon', 0))
        radius_km = min(float(data.get('radius_km', 5)), 50)  # Max 50km radius

        territories = await self._get_map_region(lat, lon, radius_km)

        await self.send(json.dumps({
            'type': 'territory_state',
            'territories': territories,
            'viewport': {'lat': lat, 'lon': lon, 'radius_km': radius_km},
        }))

        # Track viewport for ad impression counting
        await self._record_viewport_impressions(territories)

    async def _handle_subscribe_territory(self, data):
        """Subscribe to real-time updates for a specific hex."""
        h3_idx = data.get('h3_index', '')
        if not h3_idx or len(h3_idx) > 20:
            return
        if h3_idx not in self.subscribed_territories:
            group = f"{self.TERRITORY_GROUP_PREFIX}_{h3_idx}"
            await self.channel_layer.group_add(group, self.channel_name)
            self.subscribed_territories.add(h3_idx)

    async def _handle_unsubscribe_territory(self, data):
        h3_idx = data.get('h3_index', '')
        if h3_idx in self.subscribed_territories:
            group = f"{self.TERRITORY_GROUP_PREFIX}_{h3_idx}"
            await self.channel_layer.group_discard(group, self.channel_name)
            self.subscribed_territories.discard(h3_idx)

    async def _handle_territory_click(self, data):
        """Player clicked a territory — return detailed state."""
        h3_idx = data.get('h3_index', '')
        territory_detail = await self._get_territory_detail(h3_idx)
        if territory_detail:
            await self.send(json.dumps({
                'type': 'territory_detail',
                'territory': territory_detail,
            }))

    # ─── Channel layer event handlers (from backend broadcasts) ──────────────

    async def territory_update(self, event):
        """Receive territory update from channel layer and forward to client."""
        await self.send(json.dumps({
            'type': 'territory_update',
            'territory': event['territory'],
        }))

    async def battle_event(self, event):
        """Battle started/updated/resolved — forward to client."""
        await self.send(json.dumps({
            'type': 'battle_event',
            'battle': event['battle'],
        }))

    async def notification(self, event):
        """Direct player notification."""
        await self.send(json.dumps({
            'type': 'notification',
            'notification': event['notification'],
        }))

    async def tdc_update(self, event):
        """TDC balance changed."""
        await self.send(json.dumps({
            'type': 'tdc_update',
            'balance': event['balance'],
        }))

    # ─── Database helpers ─────────────────────────────────────────────────────

    @database_sync_to_async
    def _get_map_region(self, lat: float, lon: float, radius_km: float) -> list:
        from terra_domini.apps.territories.engine import TerritoryEngine
        return TerritoryEngine.get_map_region(lat, lon, radius_km)

    @database_sync_to_async
    def _get_territory_detail(self, h3_index: str) -> dict | None:
        from terra_domini.apps.territories.models import Territory
        from terra_domini.apps.territories.serializers import TerritoryDetailSerializer
        try:
            t = Territory.objects.select_related(
                'owner', 'alliance', 'current_battle'
            ).prefetch_related('buildings').get(h3_index=h3_index)
            return TerritoryDetailSerializer(t).data
        except Territory.DoesNotExist:
            return None

    @database_sync_to_async
    def _mark_player_online(self):
        from django.core.cache import caches
        game_cache = caches['game_state']
        game_cache.set(f'online:{self.player_id}', True, timeout=120)
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=self.player_id).update(
            is_online=True, last_active=timezone.now()
        )

    @database_sync_to_async
    def _mark_player_offline(self):
        from django.core.cache import caches
        game_cache = caches['game_state']
        game_cache.delete(f'online:{self.player_id}')
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=self.player_id).update(
            is_online=False, last_active=timezone.now()
        )

    @database_sync_to_async
    def _record_viewport_impressions(self, territories: list):
        """Increment view counts for ad traffic scoring."""
        if not territories:
            return
        from terra_domini.apps.territories.models import Territory
        h3_indices = [t['h3'] for t in territories if t.get('ad_slot_enabled')]
        if h3_indices:
            Territory.objects.filter(h3_index__in=h3_indices).update(
                view_count_today=models.F('view_count_today') + 1,
                view_count_total=models.F('view_count_total') + 1,
            )


# ─── Broadcast helpers (called from views/tasks to push updates) ─────────────

async def broadcast_territory_update(channel_layer, territory_data: dict):
    """Broadcast territory state change to all subscribers."""
    h3_idx = territory_data['h3']
    await channel_layer.group_send(
        f"territory_{h3_idx}",
        {'type': 'territory_update', 'territory': territory_data}
    )


async def notify_player(channel_layer, player_id: str, notification: dict):
    """Send direct notification to a specific player."""
    await channel_layer.group_send(
        f"player_{player_id}",
        {'type': 'notification', 'notification': notification}
    )


async def notify_tdc_update(channel_layer, player_id: str, balance: dict):
    """Notify player of TDC balance change."""
    await channel_layer.group_send(
        f"player_{player_id}",
        {'type': 'tdc_update', 'balance': balance}
    )


# Need this for the F() expression in _record_viewport_impressions
from django.db import models
