from celery import shared_task
import logging
logger = logging.getLogger('terra_domini.combat')


@shared_task(name='combat.resolve_battles', queue='combat')
def resolve_pending_battles():
    """Run every 5 minutes — resolve battles whose timer has expired."""
    from django.utils import timezone
    from terra_domini.apps.combat.engine import Battle, CombatEngine, BattleStatus

    due = Battle.objects.filter(
        status=BattleStatus.IN_PROGRESS,
        estimated_end__lte=timezone.now(),
    ).select_related('territory', 'attacker')[:50]

    resolved = 0
    for battle in due:
        try:
            engine = CombatEngine(battle)
            engine.resolve()
            resolved += 1
        except Exception as e:
            logger.error(f'Battle {battle.id} resolution failed: {e}')

    return {'resolved': resolved}


@shared_task(name='combat.expire_old_battles', queue='combat')
def expire_old_battles():
    """Mark battles older than 7 days as expired."""
    from django.utils import timezone
    from datetime import timedelta
    from terra_domini.apps.combat.engine import Battle, BattleStatus

    cutoff = timezone.now() - timedelta(days=7)
    expired = Battle.objects.filter(
        status=BattleStatus.IN_PROGRESS,
        started_at__lt=cutoff,
    ).update(status=BattleStatus.CANCELLED)

    return {'expired': expired}
