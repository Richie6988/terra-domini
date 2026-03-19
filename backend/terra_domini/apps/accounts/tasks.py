from celery import shared_task
import logging
logger = logging.getLogger(__name__)

@shared_task(name='accounts.run_anticheat_analysis')
def run_anticheat_analysis():
    from django.core.cache import caches
    from terra_domini.apps.accounts.models import Player
    game_cache = caches['game_state']
    flagged = 0
    try:
        keys = game_cache.keys('actions:*:minute') or []
        for key in keys:
            count = game_cache.get(key, 0)
            if count and int(count) > 120:
                player_id = key.split(':')[1]
                Player.objects.filter(id=player_id, anticheat_score__lt=1.0).update(
                    anticheat_score=min(1.0, 0.1)
                )
                flagged += 1
    except Exception as e:
        logger.warning(f'anticheat: {e}')
    return {'flagged': flagged}

@shared_task(name='accounts.daily_metrics_snapshot')
def daily_metrics_snapshot():
    from terra_domini.apps.accounts.models import Player
    online = Player.objects.filter(is_online=True).count()
    total = Player.objects.filter(is_active=True).count()
    logger.info(f'Daily snapshot — online: {online}, total: {total}')
    return {'online': online, 'total': total}
