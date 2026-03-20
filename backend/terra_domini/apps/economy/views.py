"""
Main API views — territory, combat, shop, TDC.
All endpoints require JWT authentication unless noted.
"""
import logging
from django.conf import settings

# Safe game config — works without GAME in settings
def _game(key, default=None):
    cfg = getattr(settings, 'GAME', {})
    return cfg.get(key, default)

from django.core.cache import cache
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
            for poi in nearby_pois:
                hx = poi['h3_index']
                if hx and hx not in poi_index:
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
                'territory_type': t.territory_type if t else ('landmark' if poi_data else 'rural'),
                'type': t.territory_type if t else ('landmark' if poi_data else 'rural'),
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
        return Response(ShopItemSerializer(items, many=True).data)

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

        total_cost = item.price_tdc * quantity

        # Check balance
        if float(player.tdc_in_game) < float(total_cost):
            return Response({'error': 'Insufficient TDC balance'}, status=402)

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
            _apply_item_effect(player, item, quantity, territory_h3)

            # Update sold count
            item.__class__.objects.filter(id=item.id).update(
                sold_count=F('sold_count') + quantity
            )

        return Response({
            'message': 'Purchase successful',
            'item': item_code,
            'quantity': quantity,
            'tdc_spent': float(total_cost),
            'tdc_remaining': float(player.tdc_in_game),
        })


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

        if event['type'] == 'payment_intent.succeeded':
            intent = event['data']['object']
            from terra_domini.apps.blockchain.tasks import fulfill_tdc_purchase
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
