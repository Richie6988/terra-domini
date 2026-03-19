from celery import shared_task
import logging
logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=5, default_retry_delay=30, queue='blockchain',
             name='blockchain.fulfill_purchase')
def fulfill_tdc_purchase(self, payment_intent_id: str):
    from terra_domini.apps.blockchain.service import PurchaseOrder, TDCTransaction, BlockchainService
    from terra_domini.apps.accounts.models import Player
    from django.db.models import F
    from django.utils import timezone
    try:
        order = PurchaseOrder.objects.select_related('player').get(
            payment_intent_id=payment_intent_id,
            status=PurchaseOrder.OrderStatus.PAID
        )
    except PurchaseOrder.DoesNotExist:
        logger.error(f'Order not found: {payment_intent_id}')
        return
    order.status = PurchaseOrder.OrderStatus.MINTING
    order.save(update_fields=['status'])
    total_tdc = order.tdc_amount + order.bonus_tdc
    player = order.player
    tx_hash = ''
    if player.wallet_address:
        try:
            tx_hash = BlockchainService.get().mint_for_purchase(
                player.wallet_address, order.eur_amount, str(order.id)) or ''
        except Exception as e:
            logger.error(f'Mint failed: {e}')
    Player.objects.filter(id=player.id).update(
        tdc_in_game=F('tdc_in_game') + total_tdc,
        total_tdc_purchased=F('total_tdc_purchased') + total_tdc,
    )
    tdc_tx = TDCTransaction.objects.create(
        player=player, transaction_type=TDCTransaction.TransactionType.PURCHASE,
        amount_tdc=total_tdc, amount_eur=order.eur_amount,
        tx_hash=tx_hash, status='completed', confirmed_at=timezone.now(),
    )
    order.status = PurchaseOrder.OrderStatus.COMPLETED
    order.tdc_transaction = tdc_tx
    order.completed_at = timezone.now()
    order.save(update_fields=['status','tdc_transaction','completed_at'])
    logger.info(f'TDC purchase fulfilled: {total_tdc} TDC for {player.username}')

@shared_task(queue='blockchain', name='blockchain.update_tdc_rate')
def update_tdc_market_rate():
    from django.core.cache import cache
    cache.set('tdc_market_rate_eur', 0.01, timeout=600)

@shared_task(queue='blockchain', name='blockchain.distribute_ad_revenue')
def distribute_ad_revenue(campaign_id: str, date_str: str):
    pass
