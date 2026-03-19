"""
Celery tasks for async game processing.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('terra_domini.tasks')


# ─── Territory Tasks ──────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, queue='territory', name='territories.process_tick')
def process_territory_tick(self):
    """
    Main resource generation tick — runs every 5 minutes.
    Processes ALL owned territories in batches.
    """
    from terra_domini.apps.territories.models import Territory
    from terra_domini.apps.territories.engine import TerritoryEngine

    owned = Territory.objects.filter(
        owner__isnull=False,
        territory_type__in=['urban', 'rural', 'industrial', 'coastal', 'landmark', 'mountain', 'forest']
    ).select_related('owner').prefetch_related('buildings')

    processed = 0
    errors = 0

    for territory in owned.iterator(chunk_size=500):
        try:
            TerritoryEngine.apply_production_tick(territory)
            processed += 1
        except Exception as e:
            logger.error(f"Tick error on {territory.h3_index}: {e}", exc_info=True)
            errors += 1

    logger.info(f"Territory tick complete: {processed} processed, {errors} errors")
    return {'processed': processed, 'errors': errors}


@shared_task(bind=True, queue='territory', name='territories.start_construction')
def start_construction(self, h3_index: str, player_id: str, building_type: str):
    """Start a building construction on a territory."""
    from terra_domini.apps.territories.models import Territory, Building
    from terra_domini.apps.economy.models import ActiveBoost
    from datetime import timedelta
    import json

    CONSTRUCTION_TIMES = {
        'farm': 3600, 'mine': 7200, 'power_plant': 14400,
        'factory': 21600, 'market': 10800, 'barracks': 18000,
        'radar': 28800, 'control_tower': 72000, 'ad_billboard': 7200,
        'culture_center': 14400, 'intel_hq': 21600, 'trade_depot': 10800,
        'armory': 18000,
    }

    CONSTRUCTION_COSTS = {
        'farm': {'food': 200, 'materials': 100},
        'mine': {'materials': 300, 'energy': 150},
        'power_plant': {'materials': 500, 'credits': 200},
        'factory': {'materials': 800, 'energy': 300},
        'market': {'credits': 600, 'materials': 200},
        'barracks': {'materials': 400, 'credits': 200},
        'radar': {'materials': 1000, 'intel': 200},
        'ad_billboard': {'materials': 300, 'credits': 500},
    }

    try:
        territory = Territory.objects.select_related('owner').prefetch_related('buildings').get(
            h3_index=h3_index, owner_id=player_id
        )
    except Territory.DoesNotExist:
        return {'error': 'Territory not found or not owned by player'}

    # Check not already being built
    if territory.buildings.filter(building_type=building_type, under_construction=True).exists():
        return {'error': 'Building already under construction'}

    # Deduct resources
    cost = CONSTRUCTION_COSTS.get(building_type, {})
    for resource, amount in cost.items():
        stockpile_field = f'stockpile_{resource}'
        current = getattr(territory, stockpile_field, 0)
        if current < amount:
            return {'error': f'Insufficient {resource}: need {amount}, have {current:.0f}'}

    for resource, amount in cost.items():
        stockpile_field = f'stockpile_{resource}'
        setattr(territory, stockpile_field, getattr(territory, stockpile_field) - amount)

    territory.save(update_fields=[f'stockpile_{r}' for r in cost.keys()])

    # Apply construction speed boost
    base_time = CONSTRUCTION_TIMES.get(building_type, 3600)
    speed_boost = ActiveBoost.objects.filter(
        player_id=player_id,
        boost_type='construction',
        expires_at__gt=timezone.now()
    ).order_by('-boost_value').first()

    if speed_boost:
        reduction = min(speed_boost.boost_value, 50) / 100.0
        actual_time = int(base_time * (1 - reduction))
    else:
        actual_time = base_time

    Building.objects.create(
        territory=territory,
        building_type=building_type,
        level=1,
        is_operational=False,
        under_construction=True,
        construction_ends_at=timezone.now() + timedelta(seconds=actual_time),
        construction_started_by_id=player_id,
    )

    # Schedule completion check
    complete_construction.apply_async(
        args=[h3_index, building_type],
        countdown=actual_time + 60  # +60s buffer
    )

    logger.info(f"Construction started: {building_type} on {h3_index}, ETA {actual_time}s")
    return {'status': 'started', 'eta_seconds': actual_time}


@shared_task(queue='territory', name='territories.complete_construction')
def complete_construction(h3_index: str, building_type: str):
    """Mark construction complete and activate building."""
    from terra_domini.apps.territories.models import Territory, Building
    try:
        territory = Territory.objects.get(h3_index=h3_index)
        building = territory.buildings.get(
            building_type=building_type, under_construction=True
        )
        if timezone.now() >= building.construction_ends_at:
            building.is_operational = True
            building.under_construction = False
            building.save(update_fields=['is_operational', 'under_construction'])
            logger.info(f"Construction complete: {building_type} on {h3_index}")
    except Exception as e:
        logger.error(f"complete_construction error: {e}", exc_info=True)


@shared_task(queue='territory', name='territories.refresh_leaderboards')
def refresh_leaderboards():
    """Refresh cached leaderboards — top players by territory count, season score."""
    from terra_domini.apps.accounts.models import Player, PlayerStats
    from django.core.cache import caches
    game_cache = caches['game_state']

    # Top 100 by territories_owned
    top_territory = list(
        PlayerStats.objects.order_by('-territories_owned')
        .values('player__username', 'territories_owned', 'season_score')[:100]
    )
    game_cache.set('leaderboard:territory', top_territory)

    # Top 100 by season_score
    top_season = list(
        PlayerStats.objects.order_by('-season_score')
        .values('player__username', 'territories_owned', 'season_score')[:100]
    )
    game_cache.set('leaderboard:season', top_season)

    logger.debug("Leaderboards refreshed")


# ─── Combat Tasks ─────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, queue='combat', name='combat.resolve_pending')
def resolve_pending_battles(self):
    """Check for battles whose timer has expired and resolve them."""
    from terra_domini.apps.combat.engine import Battle, CombatEngine
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from terra_domini.apps.websocket.consumers import broadcast_territory_update, notify_player
    from terra_domini.apps.territories.engine import TerritoryEngine

    expired = Battle.objects.filter(
        status=Battle.BattleStatus.ACTIVE,
        resolves_at__lte=timezone.now()
    ).select_related('target_territory', 'defender').prefetch_related('participants')

    channel_layer = get_channel_layer()
    resolved = 0

    for battle in expired:
        try:
            battle.status = Battle.BattleStatus.RESOLVING
            battle.save(update_fields=['status'])

            outcome = CombatEngine.resolve_battle(battle)

            # Broadcast territory update
            territory = battle.target_territory
            TerritoryEngine.set_territory_state_cache(territory)
            state = TerritoryEngine.get_territory_state_cached(territory.h3_index)

            async_to_sync(broadcast_territory_update)(channel_layer, state)

            # Notify participants
            for participant in battle.participants.select_related('player'):
                async_to_sync(notify_player)(
                    channel_layer,
                    str(participant.player_id),
                    {
                        'type': 'battle_resolved',
                        'battle_id': str(battle.id),
                        'territory_h3': territory.h3_index,
                        'winner': outcome['winner'],
                        'your_side': participant.side,
                        'territory_captured': outcome['territory_captured'],
                        'resources_looted': outcome['resources_looted'],
                    }
                )

            resolved += 1
        except Exception as e:
            logger.error(f"Battle resolution error {battle.id}: {e}", exc_info=True)

    if resolved > 0:
        logger.info(f"Resolved {resolved} battles")
    return {'resolved': resolved}


# ─── Blockchain Tasks ─────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=5, default_retry_delay=30, queue='blockchain',
             name='blockchain.fulfill_purchase')
def fulfill_tdc_purchase(self, payment_intent_id: str):
    """
    Fulfill a completed Stripe payment by minting TDC.
    Called by Stripe webhook after payment_intent.succeeded.
    """
    from terra_domini.apps.blockchain.service import BlockchainService, TDCTransaction, PurchaseOrder
    from terra_domini.apps.accounts.models import Player
    from django.db.models import F
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from terra_domini.apps.websocket.consumers import notify_tdc_update

    try:
        order = PurchaseOrder.objects.select_related('player').get(
            payment_intent_id=payment_intent_id,
            status=PurchaseOrder.OrderStatus.PAID
        )
    except PurchaseOrder.DoesNotExist:
        logger.error(f"Order not found for intent {payment_intent_id}")
        return

    order.status = PurchaseOrder.OrderStatus.MINTING
    order.save(update_fields=['status'])

    total_tdc = order.tdc_amount + order.bonus_tdc
    player = order.player

    tx_hash = None
    if player.wallet_address:
        # Mint to player's wallet
        service = BlockchainService.get()
        tx_hash = service.mint_for_purchase(
            player.wallet_address,
            order.eur_amount,
            str(order.id)
        )

    if player.wallet_address and not tx_hash:
        # Chain mint failed — retry
        raise self.retry(exc=Exception("Blockchain mint failed"))

    # Credit in-game balance regardless (in-game balance is always credited)
    Player.objects.filter(id=player.id).update(
        tdc_in_game=F('tdc_in_game') + total_tdc,
        total_tdc_purchased=F('total_tdc_purchased') + total_tdc,
    )

    # Log transaction
    tdc_tx = TDCTransaction.objects.create(
        player=player,
        transaction_type=TDCTransaction.TransactionType.PURCHASE,
        amount_tdc=total_tdc,
        amount_eur=order.eur_amount,
        tx_hash=tx_hash or '',
        status='completed',
        confirmed_at=timezone.now(),
    )

    order.status = PurchaseOrder.OrderStatus.COMPLETED
    order.tdc_transaction = tdc_tx
    order.completed_at = timezone.now()
    order.save(update_fields=['status', 'tdc_transaction', 'completed_at'])

    # Notify player
    player.refresh_from_db()
    channel_layer = get_channel_layer()
    async_to_sync(notify_tdc_update)(
        channel_layer,
        str(player.id),
        {'in_game': float(player.tdc_in_game), 'purchased': float(total_tdc)}
    )

    logger.info(f"TDC purchase fulfilled: {total_tdc} TDC for player {player.username}")


@shared_task(queue='blockchain', name='blockchain.update_tdc_rate')
def update_tdc_market_rate():
    """Fetch TDC/EUR market rate from DEX and cache it."""
    from terra_domini.apps.blockchain.service import BlockchainService
    from django.core.cache import cache
    try:
        rate = BlockchainService.get().get_tdc_market_price_eur()
        cache.set('tdc_market_rate_eur', rate, timeout=600)
    except Exception as e:
        logger.warning(f"TDC rate update failed: {e}")


@shared_task(queue='blockchain', name='blockchain.distribute_ad_revenue')
def distribute_ad_revenue(campaign_id: str, date_str: str):
    """
    Distribute ad revenue earned by territory owners.
    Player gets 70%, platform keeps 30%.
    """
    from terra_domini.apps.blockchain.service import BlockchainService, AdCampaignRevenue
    from terra_domini.apps.accounts.models import Player
    from django.db.models import F

    revenues = AdCampaignRevenue.objects.filter(
        campaign_id=campaign_id,
        date=date_str,
        paid_out=False,
        player_share_tdc__gt=0,
    ).select_related('player')

    service = BlockchainService.get()

    for rev in revenues:
        player = rev.player
        player_share = rev.player_share_tdc

        tx_hash = None
        if player.wallet_address:
            tx_hash = service.credit_ad_revenue(
                player.wallet_address,
                player_share,
                rev.territory_id,
            )

        # Always credit in-game balance
        Player.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + player_share,
            total_tdc_earned_ads=F('total_tdc_earned_ads') + player_share,
        )

        rev.paid_out = True
        rev.payout_tx = tx_hash or ''
        rev.save(update_fields=['paid_out', 'payout_tx'])

    logger.info(f"Ad revenue distributed for campaign {campaign_id} on {date_str}")


# ─── Anti-Cheat Tasks ─────────────────────────────────────────────────────────

@shared_task(queue='default', name='accounts.anticheat_analysis')
def run_anticheat_analysis():
    """
    Behavioral analysis for bot detection.
    Analyzes click patterns, geographic impossibilities, resource anomalies.
    """
    from terra_domini.apps.accounts.models import Player
    from django.core.cache import caches
    import json

    game_cache = caches['game_state']

    # Get players who have been active in last 10 minutes
    suspicious_players = []
    online_keys = game_cache.keys('online:*')

    for key in (online_keys or []):
        player_id = key.split(':', 1)[1]
        action_key = f'actions:{player_id}:minute'
        action_count = game_cache.get(action_key, 0)

        # Threshold: >120 actions/minute = bot-like behavior
        if action_count > 120:
            suspicious_players.append(player_id)
            Player.objects.filter(id=player_id).update(
                anticheat_score=min(1.0, Player.objects.get(id=player_id).anticheat_score + 0.1)
            )
            logger.warning(f"Anti-cheat: player {player_id} flagged — {action_count} actions/min")

    if suspicious_players:
        # Escalate players with score > 0.8 to auto-review
        Player.objects.filter(id__in=suspicious_players, anticheat_score__gt=0.8).update(
            ban_status=Player.BanStatus.WARNING,
            ban_reason='Automated: high-frequency action pattern'
        )

    return {'flagged': len(suspicious_players)}


@shared_task(queue='territory', name='economy.offline_income')
def calculate_offline_income():
    """Process offline income for players not currently online."""
    # This is already handled by the territory tick (checks is_player_online)
    # This task exists as a stub for future offline-specific logic
    pass


# ─── Bot Tasks ────────────────────────────────────────────────────────────────

@shared_task(name='territories.run_bot_ticks', queue='default')
def run_bot_ticks():
    """Run all 8 regional bots. Called every 5 minutes by Celery beat."""
    from terra_domini.apps.territories.bots import BOT_REGIONS, run_bot_tick
    results = []
    for bot_key in BOT_REGIONS:
        try:
            result = run_bot_tick(bot_key)
            results.append(result)
        except Exception as e:
            import logging
            logging.getLogger('terra_domini.bots').error(f"Bot {bot_key} tick failed: {e}")
    return {'ticks': len(results), 'results': results}
