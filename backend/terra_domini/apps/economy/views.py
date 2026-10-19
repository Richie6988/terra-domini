"""
Main API views — territory, combat, shop, TDC.
All endpoints require JWT authentication unless noted.
"""
import logging
from decimal import Decimal
from django.conf import settings

# Safe game config — works without GAME in settings
def _game(key, default=None):
    cfg = getattr(settings, 'GAME', {})
    return cfg.get(key, default)

from django.core.cache import cache
from django.db.models import Q, F, Sum
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from django_ratelimit.decorators import ratelimit

from terra_domini.apps.territories.models import Territory, Building
from terra_domini.apps.territories.engine import TerritoryEngine
from terra_domini.apps.combat.engine import CombatEngine, Battle, MilitaryUnit
from terra_domini.apps.economy.models import ShopItem, PlayerInventory, ActiveBoost, AdCampaign
from terra_domini.apps.economy.serializers import ShopItemSerializer
from terra_domini.apps.territories.serializers import TerritoryDetailSerializer, TerritoryLightSerializer
from terra_domini.apps.blockchain.service import TDCTransaction, PurchaseOrder
from terra_domini.apps.alliances.models import Alliance, AllianceMember

logger = logging.getLogger('terra_domini.api')



_POI_BIOME = {
    'capital_city':'urban','financial_hub':'urban','stock_exchange':'urban',
    'world_heritage':'landmark','ancient_ruins':'landmark','religious_site':'landmark',
    'museum':'landmark','palace':'landmark','stadium':'landmark',
    'mountain_peak':'mountain','volcano':'mountain',
    'nature_sanctuary':'forest','ancient_forest':'forest','national_park':'forest',
    'waterfall':'coastal','coral_reef':'coastal','mega_port':'coastal','island':'coastal',
    'oil_field':'industrial','nuclear_plant':'industrial','military_base':'industrial',
    'space_center':'industrial',
    'desert':'desert','tundra':'tundra',
}
def _biome_from_poi(poi):
    return _POI_BIOME.get(poi.get('category',''), 'urban' if poi.get('name') else 'rural')


class GameActionThrottle(UserRateThrottle):
    scope = 'game_actions'


# ─── Territory Views ──────────────────────────────────────────────────────────

class TerritoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Territory read endpoints. Mutations happen via WebSocket or specific action endpoints."""

    throttle_classes = [GameActionThrottle]

    def get_queryset(self):
        return Territory.objects.select_related('owner', 'alliance').filter(
            territory_type__in=['urban', 'rural', 'industrial', 'coastal', 'landmark', 'mountain', 'forest']
        )

    @action(detail=False, methods=['GET'], url_path='viewport')
    def viewport(self, request):
        """GET /api/territories/viewport/?lat=&lon=&radius_km=&zoom="""
        try:
            lat       = float(request.query_params.get('lat', 48.8566))
            lon       = float(request.query_params.get('lon', 2.3522))
            radius_km = min(float(request.query_params.get('radius_km', 10)), 100)
            zoom      = int(request.query_params.get('zoom', 13))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid params'}, status=400)

        if zoom <= 11:   res = 6
        elif zoom <= 14: res = 7
        else:            res = 8

        try:
            import h3 as h3lib
            center_h3 = h3lib.latlng_to_cell(lat, lon, res)
            k = max(3, min(int(radius_km / {6:10, 7:4, 8:1.2}.get(res, 4)), 12))
            hex_ids = list(h3lib.grid_disk(center_h3, k))
        except Exception as e:
            return Response({'territories': [], 'count': 0, 'error': str(e)})

        from terra_domini.apps.territories.models import Territory
        owned = {t.h3_index: t for t in
                 Territory.objects.filter(h3_index__in=hex_ids).select_related('owner')}

        player = request.user

        # Build POI index: exact h3_index match — each POI owns exactly one hex
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        poi_index = {}
        try:
            nearby_pois = UnifiedPOI.objects.filter(
                h3_index__in=hex_ids,
                is_active=True,
            ).values('name','category','emoji','rarity','h3_index',
                     'tdc_per_24h','token_id','is_shiny','wiki_url',
                     'description','fun_fact','floor_price_tdi',
                     'visitors_per_year','geopolitical_score')
            RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}
            for poi in nearby_pois:
                hx = poi['h3_index']
                if not hx:
                    continue
                if hx not in poi_index:
                    poi_index[hx] = dict(poi)
                else:
                    # Keep the highest rarity POI per hex
                    cur = RARITY_RANK.get(poi_index[hx].get('rarity','common'), 0)
                    new_r = RARITY_RANK.get(poi.get('rarity','common'), 0)
                    if new_r > cur:
                        poi_index[hx] = dict(poi)
        except Exception:
            pass

        result = []
        for hx in hex_ids:
            try:
                geo      = h3lib.cell_to_latlng(hx)
                boundary = [[p[0], p[1]] for p in h3lib.cell_to_boundary(hx)]
            except Exception:
                continue
            t = owned.get(hx)

            # Find nearest POI for this hex (within ~1km)
            poi_data = poi_index.get(hx)

            result.append({
                'h3_index': hx, 'h3': hx, 'h3_resolution': res,
                'owner_id': str(t.owner_id) if t and t.owner_id else None,
                'owner_username': t.owner.username if t and t.owner_id else None,
                'owner_color': getattr(t.owner, 'border_color', '#00FF87') if t and t.owner_id else None,
                'owner_emoji': getattr(t.owner, 'avatar_emoji', '🏴') if t and t.owner_id else None,
                'alliance_id': None, 'alliance_tag': None,
                'territory_type': t.territory_type if t else _biome_from_poi(poi_data) if poi_data else 'rural',
                'type': t.territory_type if t else _biome_from_poi(poi_data) if poi_data else 'rural',
                'defense_tier': t.defense_tier if t else 1,
                'defense_points': float(t.defense_points) if t else 100.0,
                'is_control_tower': bool(t.is_control_tower) if t else False,
                'is_landmark': bool(poi_data),
                'is_under_attack': False,
                'ad_slot_enabled': False,
                'landmark_name': poi_data['name'] if poi_data else None,
                'place_name': (poi_data['name'] if poi_data else None) or getattr(t, 'place_name', None),
                'center_lat': geo[0], 'center_lon': geo[1],
                'boundary_points': boundary,
                'resource_food': float(getattr(t, 'resource_food', 10)),
                'resource_energy': float(getattr(t, 'resource_energy', 10)),
                'resource_credits': float(getattr(t, 'resource_credits', poi_data['tdc_per_24h'] if poi_data else 10)),
                'resource_materials': float(getattr(t, 'resource_materials', 10)),
                'resource_intel': float(getattr(t, 'resource_intel', 5)),
                'food_per_tick': float(getattr(t, 'resource_food', poi_data['tdc_per_24h'] if poi_data else 10)),
                'rarity': (poi_data['rarity'] if poi_data else None) or getattr(t, 'rarity', 'common'),
                'biome': getattr(t, 'biome', 'grassland'),
                'nft_version': getattr(t, 'nft_version', 1),
                'token_id': (poi_data['token_id'] if poi_data else None) or getattr(t, 'token_id', None),
                'is_shiny': bool(getattr(t, 'is_shiny', poi_data['is_shiny'] if poi_data else False)),
                # POI metadata
                'poi_name': poi_data['name'] if poi_data else None,
                'poi_category': poi_data['category'] if poi_data else None,
                'poi_emoji': poi_data['emoji'] if poi_data else None,
                'poi_wiki_url': poi_data['wiki_url'] if poi_data else None,
                'poi_description': poi_data['description'] if poi_data else None,
                'poi_fun_fact': poi_data['fun_fact'] if poi_data else None,
                'poi_floor_price': poi_data['floor_price_tdi'] if poi_data else None,
                'poi_visitors': poi_data['visitors_per_year'] if poi_data else None,
                'poi_geo_score': poi_data['geopolitical_score'] if poi_data else None,
                'custom_name': getattr(t, 'custom_name', None) if t else None,
                'custom_emoji': getattr(t, 'custom_emoji', None) if t else None,
                'border_color': getattr(t, 'border_color', None) if t else None,
            })
        return Response({'territories': result, 'count': len(result)})


    @action(detail=True, methods=['POST'], url_path='claim')
    def claim(self, request, pk=None):
        """POST /api/territories/{h3_index}/claim/ — Claim an unclaimed territory."""
        territory = self.get_object()
        player = request.user

        # Rate limit: max 10 claims per minute
        cache_key = f'claim_rate:{player.id}'
        claims = cache.get(cache_key, 0)
        if claims >= 10:
            return Response({'error': 'Rate limit: max 10 claims per minute'}, status=429)

        success, message = TerritoryEngine.claim_territory(territory, player)
        if success:
            cache.set(cache_key, claims + 1, timeout=60)
            TerritoryEngine.set_territory_state_cache(territory)
            # Broadcast update
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            from terra_domini.apps.websocket.consumers import broadcast_territory_update
            state = TerritoryEngine.get_territory_state_cached(territory.h3_index)
            async_to_sync(broadcast_territory_update)(get_channel_layer(), state)
            return Response({'message': message, 'territory': state})
        return Response({'error': message}, status=409)

    @action(detail=True, methods=['GET'], url_path='detail')
    def detail_view(self, request, pk=None):
        """Full territory detail including buildings, current battle, recent history."""
        territory = Territory.objects.select_related(
            'owner', 'alliance', 'current_battle'
        ).prefetch_related('buildings', 'history').get(h3_index=pk)

        from terra_domini.apps.territories.serializers import TerritoryDetailSerializer
        return Response(TerritoryDetailSerializer(territory).data)

    @action(detail=True, methods=['POST'], url_path='build')
    def build(self, request, pk=None):
        """POST /api/territories/{h3}/build/ — Construct a building."""
        territory = self.get_object()
        player = request.user

        if territory.owner != player:
            return Response({'error': 'Not your territory'}, status=403)

        building_type = request.data.get('building_type')
        if not building_type:
            return Response({'error': 'building_type required'}, status=400)

        # Check resources
        from terra_domini.apps.territories.tasks import start_construction
        result = start_construction.delay(
            str(territory.h3_index),
            str(player.id),
            building_type,
        )
        return Response({'task_id': str(result.id), 'message': 'Construction queued'})


# ─── Combat Views ─────────────────────────────────────────────────────────────

class CombatViewSet(viewsets.GenericViewSet):

    throttle_classes = [GameActionThrottle]

    @action(detail=False, methods=['POST'], url_path='attack')
    def attack(self, request):
        """
        POST /api/combat/attack/
        Body: {target_h3: str, units: {infantry: 100, cavalry: 50}, battle_type: 'conquest'}
        """
        player = request.user

        if player.ban_status != player.BanStatus.CLEAN:
            return Response({'error': 'Account suspended'}, status=403)

        target_h3 = request.data.get('target_h3')
        units = request.data.get('units', {})
        battle_type = request.data.get('battle_type', 'conquest')

        if not target_h3 or not units:
            return Response({'error': 'target_h3 and units required'}, status=400)

        # Validate unit counts are positive integers
        for unit_type, count in units.items():
            if not isinstance(count, int) or count <= 0:
                return Response({'error': f'Invalid unit count for {unit_type}'}, status=400)

        try:
            territory = Territory.objects.get(h3_index=target_h3)
        except Territory.DoesNotExist:
            return Response({'error': 'Territory not found'}, status=404)

        success, message, battle = CombatEngine.initiate_attack(player, territory, units, battle_type)

        if not success:
            return Response({'error': message}, status=409)

        # Notify defender
        if territory.owner:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            from terra_domini.apps.websocket.consumers import notify_player
            async_to_sync(notify_player)(
                get_channel_layer(),
                str(territory.owner_id),
                {
                    'type': 'attack_incoming',
                    'territory_h3': target_h3,
                    'attacker': player.username,
                    'resolves_at': battle.resolves_at.isoformat(),
                }
            )

        return Response({
            'battle_id': str(battle.id),
            'resolves_at': battle.resolves_at.isoformat(),
            'message': message,
        }, status=201)

    @action(detail=False, methods=['POST'], url_path='join')
    def join_battle(self, request):
        """Join an ongoing battle as additional attacker or defender."""
        battle_id = request.data.get('battle_id')
        side = request.data.get('side')  # 'attacker' or 'defender'
        units = request.data.get('units', {})

        if not all([battle_id, side, units]):
            return Response({'error': 'battle_id, side, units required'}, status=400)

        try:
            battle = Battle.objects.get(
                id=battle_id,
                status=Battle.BattleStatus.ACTIVE
            )
        except Battle.DoesNotExist:
            return Response({'error': 'Battle not found or already resolved'}, status=404)

        # Validate side logic
        player = request.user
        if side == 'defender' and battle.target_territory.owner != player:
            # Check alliance
            if not (player.alliance_member and
                    player.alliance_member.alliance == battle.target_territory.alliance):
                return Response({'error': 'Cannot join defense of territory you do not own/protect'}, status=403)

        from terra_domini.apps.combat.engine import BattleParticipant
        participant, created = BattleParticipant.objects.get_or_create(
            battle=battle, player=player,
            defaults={'side': side, 'units_deployed': units}
        )
        if not created:
            return Response({'error': 'Already participating in this battle'}, status=409)

        return Response({'message': f'Joined battle on {side} side', 'participant_id': str(participant.id)})

    @action(detail=False, methods=['GET'], url_path='active')
    def active_battles(self, request):
        """My active battles — as attacker or defender."""
        battles = Battle.objects.filter(
            participants__player=request.user,
            status__in=[Battle.BattleStatus.PREPARING, Battle.BattleStatus.ACTIVE]
        ).select_related('target_territory', 'defender').prefetch_related('participants')

        data = [{
            'id': str(b.id),
            'territory_h3': b.target_territory_id,
            'type': b.battle_type,
            'status': b.status,
            'resolves_at': b.resolves_at.isoformat(),
            'defender': b.defender.username if b.defender else None,
        } for b in battles]

        return Response({'battles': data})


# ─── Shop & Economy Views ─────────────────────────────────────────────────────

class ShopViewSet(viewsets.GenericViewSet):

    @action(detail=False, methods=['GET'], url_path='catalog')
    def catalog(self, request):
        """GET /api/shop/catalog/ — All available items."""
        items = ShopItem.objects.filter(is_active=True).order_by('category', 'price_tdc')
        from terra_domini.apps.economy.serializers import ShopItemSerializer
        data = ShopItemSerializer(items, many=True).data
        for row in data:  # 'implemented': the item actually does something when bought (others are not sold)
            row['implemented'] = row.get('effect_type') in IMPLEMENTED_EFFECTS
        return Response(data)

    @action(detail=False, methods=['POST'], url_path='purchase')
    def purchase(self, request):
        # Handle military unit purchases
        item_code = request.data.get('item_code', '')
        if item_code.startswith('unit_'):
            unit_type = item_code.replace('unit_', '')
            quantity = int(request.data.get('quantity', 1))
            UNIT_COSTS = {
                'infantry': 50, 'cavalry': 120, 'artillery': 200, 'naval': 300,
                'spy': 150, 'engineer': 180, 'medic': 100, 'commander': 500,
                'spy': 150, 'engineer': 180, 'medic': 100, 'commander': 500,
            }
            UNIT_TRAIN_SECONDS = {
                'infantry': 300,    # 5 min
                'cavalry': 600,     # 10 min
                'artillery': 1200,  # 20 min
                'naval': 900,       # 15 min
                'spy': 450,         # 7.5 min
                'engineer': 480,    # 8 min
                'medic': 300,       # 5 min
                'commander': 3600,  # 1 hour
            }
            cost = UNIT_COSTS.get(unit_type, 50) * quantity
            train_seconds = UNIT_TRAIN_SECONDS.get(unit_type, 300) * quantity
            player = request.user
            if float(player.tdc_in_game) < float(cost):
                return Response({'error': f'Need {cost} TDC. You have {float(player.tdc_in_game):.0f} TDC.'}, status=400)
            from django.db.models import F
            from terra_domini.apps.accounts.models import Player as P
            P.objects.filter(id=player.id).update(tdc_in_game=F('tdc_in_game') - cost)
            # Sync territories_owned stat
            from terra_domini.apps.territories.models import Territory
            from terra_domini.apps.accounts.models import PlayerStats
            owned = Territory.objects.filter(owner=player).count()
            PlayerStats.objects.filter(player=player).update(territories_owned=owned)
            return Response({
                'success': True,
                'unit_type': unit_type,
                'quantity': quantity,
                'tdc_spent': cost,
                'train_seconds': train_seconds,
                'ready_at': (timezone.now() + __import__('datetime').timedelta(seconds=train_seconds)).isoformat(),
            })

        """
        POST /api/shop/purchase/
        Body: {item_code: str, quantity: int, territory_h3?: str}
        Deducts TDC from player in-game balance, applies item effect.
        """
        player = request.user
        item_code = request.data.get('item_code')
        quantity = int(request.data.get('quantity', 1))
        territory_h3 = request.data.get('territory_h3')

        if not item_code or quantity < 1:
            return Response({'error': 'item_code and quantity required'}, status=400)

        try:
            item = ShopItem.objects.get(code=item_code)
        except ShopItem.DoesNotExist:
            return Response({'error': 'Item not found'}, status=404)

        if not item.is_available():
            return Response({'error': 'Item not available'}, status=410)
        if item.effect_type not in IMPLEMENTED_EFFECTS:
            # Never take HEX for an effect the game doesn't apply yet
            return Response({'error': f'{item.name} is not available yet.'}, status=410)
        if item.effect_type == 'shield':
            today = timezone.now().date()
            used = player.daily_shield_hours_used if player.shield_reset_date == today else 0.0
            if _game('SHIELD_MAX_HOURS_PER_DAY', 12) - used <= 0:
                return Response({'error': 'Daily shield limit reached — try again tomorrow.'}, status=429)

        from terra_domini.utils.god import god_cost
        total_cost = god_cost(player, item.price_tdc * quantity)     # god mode: free

        # Check balance
        if float(player.tdc_in_game) < float(total_cost):
            return Response({'error': 'Insufficient TDC balance'}, status=402)

        # Random-content packs: earned HEX only (no paid loot boxes — owner decision, see economy/balance.py)
        from terra_domini.apps.economy import balance as _B
        if item.effect_type == 'booster_pack' and _B.spendable_earned(player) < Decimal(str(total_cost)):
            return Response({
                'error': 'Booster packs can only be opened with HEX earned in-game (not purchased HEX).',
                'earned_balance': float(_B.spendable_earned(player)),
            }, status=402)

        # Check daily limit
        if item.max_per_day > 0:
            today_key = f'item_daily:{player.id}:{item_code}:{timezone.now().date()}'
            today_count = cache.get(today_key, 0)
            if today_count + quantity > item.max_per_day:
                return Response({'error': f'Daily limit: {item.max_per_day}/day'}, status=429)
            cache.set(today_key, today_count + quantity, timeout=86400)

        # Apply purchase
        from django.db import transaction
        with transaction.atomic():
            # Deduct TDC
            from django.db.models import F
            player.__class__.objects.filter(id=player.id).update(
                tdc_in_game=F('tdc_in_game') - total_cost,
            )
            player.refresh_from_db()

            # Log transaction
            TDCTransaction.objects.create(
                player=player,
                transaction_type=TDCTransaction.TransactionType.ITEM_PURCHASE,
                amount_tdc=-total_cost,
                item_code=item_code,
                territory_h3=territory_h3 or '',
                status='completed',
                confirmed_at=timezone.now(),
            )

            # Apply effect
            effect_note = _apply_item_effect(player, item, quantity, territory_h3)

            booster_result = None
            if item.effect_type == 'booster_pack':
                booster_result = _open_booster_pack(item_code, player)
                if booster_result.get('short'):
                    transaction.set_rollback(True)
                    return Response({'error': 'Not enough free territories left to fill this pack right now. You were not charged.'}, status=409)

            # Update sold count
            item.__class__.objects.filter(id=item.id).update(
                sold_count=F('sold_count') + quantity
            )

        if item.effect_type != 'booster_pack':
            _B.consume_purchased_first(player, total_cost)
        from terra_domini.apps.progression.missions import track
        track(player, 'spend_tdc', int(total_cost))

        resp = {
            'message': effect_note or 'Purchase complete!',
            'item': item_code,
            'quantity': quantity,
            'tdc_spent': float(total_cost),
            'tdc_remaining': float(player.tdc_in_game),
        }
        if booster_result:
            resp['booster'] = booster_result
        return Response(resp)

    @action(detail=False, methods=['GET'], url_path='active-boosts')
    def active_boosts_endpoint(self, request):
        """GET /api/shop/active-boosts/ — boosts actifs du joueur."""
        boosts = ActiveBoost.objects.filter(
            player=request.user
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).select_related('item').order_by('expires_at')

        return Response([{
            'id':          str(b.id),
            'boost_type':  b.boost_type,
            'boost_value': b.boost_value,
            'item_name':   b.item.name if b.item else b.boost_type,
            'expires_at':  b.expires_at.isoformat() if b.expires_at else None,
            'is_permanent': b.expires_at is None,
        } for b in boosts])

    @action(detail=False, methods=['GET'], url_path='inventory')
    def inventory(self, request):
        """GET /api/shop/inventory/ — inventaire du joueur."""
        from terra_domini.apps.economy.models import PlayerInventory
        items = PlayerInventory.objects.filter(
            player=request.user, quantity__gt=0
        ).select_related('item').order_by('-acquired_at')

        return Response([{
            'id':          str(i.id),
            'code':        i.item.code,
            'name':        i.item.name,
            'quantity':    i.quantity,
            'effect_type': i.item.effect_type,
            'icon':        i.item.icon_url or '🎁',
            'rarity':      i.item.rarity,
            'acquired_at': i.acquired_at.isoformat(),
        } for i in items])

    @action(detail=False, methods=['POST'], url_path='use-item')
    def use_item(self, request):
        """POST /api/shop/use-item/ {item_code, territory_h3?} — utiliser un item de l'inventaire."""
        from terra_domini.apps.economy.models import PlayerInventory
        item_code    = request.data.get('item_code')
        territory_h3 = request.data.get('territory_h3')

        if not item_code:
            return Response({'error': 'item_code required'}, status=400)

        inv = PlayerInventory.objects.filter(
            player=request.user, item__code=item_code, quantity__gt=0
        ).select_related('item').first()

        if not inv:
            return Response({'error': 'Item non trouvé dans l\'inventaire'}, status=404)

        _apply_item_effect(request.user, inv.item, 1, territory_h3)
        inv.quantity -= 1
        if inv.quantity == 0:
            inv.delete()
        else:
            inv.save(update_fields=['quantity'])

        return Response({'success': True, 'item': item_code, 'remaining': inv.quantity if inv.pk else 0})


class TDCViewSet(viewsets.GenericViewSet):
    """TDC balance management and transaction history."""

    @action(detail=False, methods=['GET'], url_path='balance')
    def balance(self, request):
        """GET /api/tdc/balance/ — Current TDC balances."""
        player = request.user
        on_chain = {}
        if player.wallet_address:
            from terra_domini.apps.blockchain.service import BlockchainService
            on_chain = BlockchainService.get().get_player_balance(player.wallet_address)

        return Response({
            'in_game': float(player.tdc_in_game),
            'wallet': on_chain.get('wallet', 0),
            'wallet_in_game': on_chain.get('in_game', 0),  # Contract-held balance
            'tdc_eur_rate': settings.BLOCKCHAIN['TDC_EUR_RATE'],
        })

    @action(detail=False, methods=['POST'], url_path='purchase-order')
    def create_purchase_order(self, request):
        """
        POST /api/tdc/purchase-order/
        Initiates a fiat → TDC purchase via Stripe.
        Body: {eur_amount: float, wallet_address?: str}
        Returns: {client_secret: str, order_id: str}
        """
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        eur_amount = float(request.data.get('eur_amount', 0))
        wallet = request.data.get('wallet_address', '')

        if eur_amount < 1.99:
            return Response({'error': 'Minimum purchase: €1.99'}, status=400)
        if eur_amount > 999.99:
            return Response({'error': 'Maximum single purchase: €999.99'}, status=400)

        tdc_amount = eur_amount * settings.BLOCKCHAIN['TDC_EUR_RATE']

        try:
            intent = stripe.PaymentIntent.create(
                amount=int(eur_amount * 100),  # Stripe uses cents
                currency='eur',
                metadata={
                    'player_id': str(request.user.id),
                    'tdc_amount': str(tdc_amount),
                    'wallet': wallet,
                },
            )

            order = PurchaseOrder.objects.create(
                player=request.user,
                eur_amount=eur_amount,
                tdc_amount=tdc_amount,
                payment_intent_id=intent.id,
            )

            return Response({
                'client_secret': intent.client_secret,
                'order_id': str(order.id),
                'tdc_amount': tdc_amount,
                'eur_amount': eur_amount,
            })
        except Exception as e:
            logger.error(f"Stripe intent creation failed: {e}")
            return Response({'error': 'Payment service unavailable'}, status=503)

    @action(detail=False, methods=['GET'], url_path='history')
    def history(self, request):
        """GET /api/tdc/history/ — Transaction history (paginated)."""
        transactions = TDCTransaction.objects.filter(
            player=request.user
        ).order_by('-created_at')[:100]

        data = [{
            'id': str(t.id),
            'type': t.transaction_type,
            'amount': float(t.amount_tdc),
            'item_code': t.item_code,
            'territory': t.territory_h3,
            'status': t.status,
            'date': t.created_at.isoformat(),
        } for t in transactions]

        return Response({'transactions': data})


# ─── Stripe Webhook View ──────────────────────────────────────────────────────

class StripeWebhookView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        webhook_secret = settings.STRIPE_WEBHOOK_SECRET

        try:
            event = stripe.Webhook.construct_event(
                payload=request.body,
                sig_header=request.META.get('HTTP_STRIPE_SIGNATURE'),
                secret=webhook_secret,
            )
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning(f"Invalid Stripe webhook: {e}")
            return Response({'error': 'Invalid signature'}, status=400)

        if event['type'] == 'checkout.session.completed':
            # Shop HEX packs (economy/payments.py) — idempotent with the client-side confirm
            from terra_domini.apps.economy.payments import fulfil
            try:
                fulfil(event['data']['object']['id'])
            except Exception as e:
                logger.error(f"Checkout fulfil failed: {e}")
                return Response({'error': 'retry'}, status=500)   # Stripe retries the webhook
        elif event['type'] == 'payment_intent.succeeded':
            intent = event['data']['object']
            from terra_domini.apps.territories.tasks import fulfill_tdc_purchase
            fulfill_tdc_purchase.delay(intent['id'])

        return Response({'status': 'ok'})


# ─── Ad Campaign Views ────────────────────────────────────────────────────────

class AdCampaignViewSet(viewsets.GenericViewSet):
    """Brand-facing ad campaign management."""

    permission_classes = [AllowAny]  # Brands don't have player accounts

    @action(detail=False, methods=['POST'], url_path='create')
    def create_campaign(self, request):
        """Create a new ad campaign for review."""
        required = ['brand_name', 'brand_email', 'campaign_name', 'banner_url', 'click_url', 'budget_eur', 'cpm_eur']
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({'error': f'Missing: {missing}'}, status=400)

        campaign = AdCampaign.objects.create(
            brand_name=request.data['brand_name'],
            brand_email=request.data['brand_email'],
            campaign_name=request.data['campaign_name'],
            banner_url=request.data['banner_url'],
            click_url=request.data['click_url'],
            logo_url=request.data.get('logo_url', ''),
            budget_eur=request.data['budget_eur'],
            cpm_eur=request.data['cpm_eur'],
            targeting_type=request.data.get('targeting_type', 'global'),
            target_countries=request.data.get('target_countries', []),
            status=AdCampaign.CampaignStatus.PENDING_REVIEW,
        )

        return Response({
            'campaign_id': str(campaign.id),
            'status': 'pending_review',
            'message': 'Campaign submitted for review. You will be contacted within 24h.',
        }, status=201)


# ─── Item effect application ──────────────────────────────────────────────────

# Effects the game really applies. Everything else in the catalog is shown as "coming soon" and cannot be bought.
IMPLEMENTED_EFFECTS = {'booster_pack', 'shield', 'atk_multiplier', 'def_multiplier', 'border_color', 'hex_bonus',
                      'explore_slots', 'explore_speed', 'claim_instant', 'distant_attack', 'resource_multiplier',
                      'rare_chance', 'trade_discount', 'safari_continuous', 'safari_hints', 'rarity_boost', 'luck_boost'}

TIMED_EFFECT_TEXT = {   # read by: territories claim, combat.can_attack, resources, booster odds, marketplace buy, safari
    'claim_instant': 'Explorations finish in seconds',
    'distant_attack': 'Attack any territory, no range limit',
    'resource_multiplier': 'Resource production x{v:g}',
    'rare_chance': 'Booster rare+ odds x{v:g}',
    'trade_discount': 'Marketplace royalty -{pct:g}% on your purchases',
    'safari_continuous': 'No daily safari limit',
    'luck_boost': '+{v:g} luck: 2.5x chances in event token draws',
}
CHARGE_EFFECTS = {'safari_hints': (1, '+2 scans on your next {n} safari hunt(s)'),
                  'rarity_boost': (5, 'Your next {n} safari captures pay the next rarity tier')}


def _apply_item_effect(player, item, quantity, territory_h3=None):
    """Apply the game effect of a purchased item."""
    from datetime import timedelta

    if item.effect_type == 'shield':
        duration_hours = (item.effect_duration_seconds / 3600) * quantity

        # Check daily cap
        today = timezone.now().date()
        if player.shield_reset_date != today:
            player.daily_shield_hours_used = 0.0
            player.shield_reset_date = today
            player.save(update_fields=['daily_shield_hours_used', 'shield_reset_date'])

        available_hours = _game('SHIELD_MAX_HOURS_PER_DAY', 12) - player.daily_shield_hours_used
        actual_hours = min(duration_hours, available_hours)

        if actual_hours > 0:
            new_shield_until = max(timezone.now(), player.shield_until or timezone.now()) + timedelta(hours=actual_hours)
            player.__class__.objects.filter(id=player.id).update(
                shield_until=new_shield_until,
                daily_shield_hours_used=player.daily_shield_hours_used + actual_hours,
            )
            capped = ' (daily shield cap)' if actual_hours < duration_hours else ''
            return f'Shield up for {actual_hours:g}h{capped} — none of your territories can be attacked until then.'

    elif item.effect_type == 'military_boost':
        duration = timedelta(seconds=item.effect_duration_seconds * quantity)
        ActiveBoost.objects.create(
            player=player,
            item=item,
            boost_type='military',
            boost_value=min(item.effect_value, _game('MAX_MILITARY_BOOST_PCT', 25)),
            expires_at=timezone.now() + duration,
        )

    elif item.effect_type == 'construction_speed':
        duration = timedelta(seconds=item.effect_duration_seconds * quantity)
        ActiveBoost.objects.create(
            player=player,
            item=item,
            boost_type='construction',
            boost_value=min(item.effect_value, _game('MAX_BUILD_SPEED_BOOST_PCT', 50)),
            expires_at=timezone.now() + duration,
        )

    elif item.effect_type in ('atk_multiplier', 'def_multiplier'):
        # Applied in combat.engine.resolve_battle, capped at MAX_MILITARY_BOOST_PCT (anti pay-to-win)
        duration = timedelta(seconds=item.effect_duration_seconds * max(quantity, 1))
        ActiveBoost.objects.create(player=player, item=item, boost_type=item.effect_type,
                                   boost_value=item.effect_value, expires_at=timezone.now() + duration)
        pct = min((item.effect_value - 1) * 100, _game('MAX_MILITARY_BOOST_PCT', 25))
        side = 'attack' if item.effect_type == 'atk_multiplier' else 'defense'
        return f'+{pct:g}% {side} in every battle for {round(duration.total_seconds() / 3600):g}h.'

    elif item.effect_type in ('explore_slots', 'explore_speed'):
        # Read by economy/balance.explore_slots / explore_speed_mult when an exploration starts
        duration = timedelta(seconds=item.effect_duration_seconds * max(quantity, 1))
        ActiveBoost.objects.create(player=player, item=item, boost_type=item.effect_type,
                                   boost_value=item.effect_value, expires_at=timezone.now() + duration)
        hours = round(duration.total_seconds() / 3600)
        if item.effect_type == 'explore_slots':
            return f'+{item.effect_value:g} exploration in parallel for {hours}h.'
        return f'Exploration timers x{item.effect_value:g} for {hours}h (new explorations).'

    elif item.effect_type in TIMED_EFFECT_TEXT:
        duration = timedelta(seconds=item.effect_duration_seconds * max(quantity, 1))
        ActiveBoost.objects.create(player=player, item=item, boost_type=item.effect_type,
                                   boost_value=item.effect_value, expires_at=timezone.now() + duration)
        text = TIMED_EFFECT_TEXT[item.effect_type].format(v=item.effect_value, pct=round((1 - item.effect_value) * 100))
        return f'{text} for {round(duration.total_seconds() / 3600):g}h.'

    elif item.effect_type in CHARGE_EFFECTS:
        from terra_domini.apps.economy.balance import CHARGE_BOOST_DAYS
        per, text = CHARGE_EFFECTS[item.effect_type]
        n = per * max(quantity, 1)
        ActiveBoost.objects.create(player=player, item=item, boost_type=item.effect_type, boost_value=n,
                                   expires_at=timezone.now() + timedelta(days=CHARGE_BOOST_DAYS))
        return text.format(n=n) + '.'

    elif item.effect_type in ('production_multiplier',
                               'double_attack', 'stealth_once', 'build_speed', 'build_cost_reduction'):
        duration = timedelta(seconds=item.effect_duration_seconds * max(quantity, 1))
        expires = (timezone.now() + duration) if duration.total_seconds() > 0 else None
        ActiveBoost.objects.create(
            player=player, item=item,
            boost_type=item.effect_type,
            boost_value=item.effect_value,
            expires_at=expires,
        )

    elif item.effect_type == 'hex_bonus':
        from django.db.models import F
        bonus = item.effect_value * quantity
        player.__class__.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + bonus
        )

    elif item.effect_type == 'nuke_strike':
        # Enregistrer la frappe disponible pour la prochaine attaque
        ActiveBoost.objects.create(
            player=player, item=item,
            boost_type='nuke_strike',
            boost_value=item.effect_value,  # DEF ratio (0.10 = réduit à 10%)
            expires_at=timezone.now() + timedelta(hours=72),
        )

    elif item.effect_type == 'build_instant_once':
        ActiveBoost.objects.create(
            player=player, item=item,
            boost_type='build_instant_once',
            boost_value=1,
            expires_at=timezone.now() + timedelta(hours=24),
        )

    elif item.effect_type == 'border_color':
        # Appliquer la couleur de bordure (icon_url contient la couleur hex)
        color = item.icon_url or '#FFD700'
        from terra_domini.apps.territories.models import Territory
        Territory.objects.filter(owner=player).update(border_color=color)

    elif item.effect_type == 'booster_pack':
        # Ouvrir un booster : retourner les territoires tirés dans la réponse
        # La logique de tirage est dans la vue purchase (voir _open_booster_pack)
        pass  # géré dans la vue purchase


def _open_booster_pack(item_code: str, player=None) -> dict:
    """
    Tire aléatoirement des territoires POI selon les garanties du pack.
    Retourne la liste des territoires tirés (pour l'animation d'ouverture).
    """
    import random
    from terra_domini.apps.territories.models import Territory

    PACK_ODDS = {
        'booster_standard': [
            ('common',    0.55), ('uncommon', 0.30), ('rare', 0.12),
            ('epic',      0.025), ('legendary',0.005),
        ],
        'booster_rare': [
            ('uncommon',  0.40), ('rare',     0.40), ('epic', 0.17),
            ('legendary', 0.03),
        ],
        'booster_legendary': [
            ('rare',      0.45), ('epic',     0.40), ('legendary', 0.13),
            ('mythic',    0.02),
        ],
    }
    PACK_ODDS['booster_premium'] = PACK_ODDS['booster_rare']        # legacy codes
    PACK_ODDS['booster_mythic'] = PACK_ODDS['booster_legendary']
    PACK_COUNT = {'booster_standard': 3, 'booster_rare': 4, 'booster_legendary': 5,
                  'booster_premium': 4, 'booster_mythic': 5}
    # Guaranteed minimum rarity on the last card (what the shop advertises)
    PACK_GUARANTEE = {'booster_rare': 'rare', 'booster_legendary': 'legendary',
                      'booster_premium': 'rare', 'booster_mythic': 'legendary'}

    odds   = PACK_ODDS.get(item_code, PACK_ODDS['booster_standard'])
    from terra_domini.apps.economy.balance import boost_mult
    rare_x = boost_mult(player, 'rare_chance') if player else 1.0   # shop 'Rare Drop Boost'
    if rare_x > 1:
        odds = [(r, w * rare_x if r not in ('common', 'uncommon') else w) for r, w in odds]
    count  = PACK_COUNT.get(item_code, 3)
    cards  = []

    rarities_pool = [r for r, _ in odds]
    weights       = [w for _, w in odds]

    order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    rolls = [random.choices(rarities_pool, weights=weights)[0] for _ in range(count)]
    g = PACK_GUARANTEE.get(item_code)
    if g and not any(order.index(r) >= order.index(g) for r in rolls):
        rolls[-1] = g
    taken = set()
    # Cards land where they help: commons/uncommons on free hexes touching the kingdom (kingdom bonus),
    # rarer cards on the nearest free territory of that rarity (landmarks are real places, they can't move).
    owned, frontier, home = set(), [], None
    if player is not None:
        from terra_domini.utils.h3_compat import k_ring
        rows = list(Territory.objects.filter(owner=player).values_list('h3_index', 'center_lat', 'center_lon'))
        owned = {h for h, _, _ in rows}
        pts = [(la, lo) for _, la, lo in rows if la is not None and lo is not None]
        if pts:
            home = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        ring = {n for h in owned for n in k_ring(h, 1)} - owned
        busy = set(Territory.objects.filter(h3_index__in=list(ring), owner__isnull=False).values_list('h3_index', flat=True))
        frontier = [h for h in ring if h not in busy]
        random.shuffle(frontier)

    def _nearest(qs):
        if home is None:
            return qs.filter(is_landmark=True).order_by('?').first() or qs.order_by('?').first()
        lat, lon = home
        for d in (0.5, 2, 8, 30, 180):
            cand = list(qs.filter(center_lat__range=(lat - d, lat + d), center_lon__range=(lon - d * 1.5, lon + d * 1.5))[:200])
            if cand:
                cand.sort(key=lambda t: (t.center_lat - lat) ** 2 + (t.center_lon - lon) ** 2)
                return random.choice(cand[:5])
        return qs.order_by('?').first()

    for rarity in rolls:
        card = None
        if rarity in ('common', 'uncommon') and frontier:
            hx = frontier.pop()
            try:
                import h3
                from terra_domini.apps.territories.territory_engine import generate_territory
                la, lo = h3.cell_to_latlng(hx)
                generate_territory(hx, la, lo)
                card = Territory.objects.filter(h3_index=hx, owner__isnull=True).first()
                if card and card.rarity != rarity:
                    card.rarity = rarity
                    card.save(update_fields=['rarity'])
            except Exception:
                card = None
        # Only FREE territories (never someone else's); fall back to lower rarities if none left
        if not card:
            for r in order[:order.index(rarity) + 1][::-1]:
                card = _nearest(Territory.objects.filter(rarity=r, owner__isnull=True).exclude(h3_index__in=taken))
                if card:
                    break
        if not card:
            continue
        taken.add(card.h3_index)
        if player is not None:
            card.owner = player
            card.captured_at = timezone.now()
            card.save(update_fields=['owner', 'captured_at'])
        cards.append({'h3_index': card.h3_index, 'poi_name': card.poi_name, 'territory_type': card.territory_type,
                      'biome': card.biome, 'is_shiny': card.is_shiny, 'rarity': card.rarity})
    met = not g or any(order.index(c['rarity'] or 'common') >= order.index(g) for c in cards)
    return {'cards': cards, 'count': len(cards), 'short': len(cards) < count or not met}
