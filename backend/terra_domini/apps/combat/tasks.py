from celery import shared_task
import logging
logger = logging.getLogger('terra_domini.combat')


@shared_task(name='combat.resolve_battles', queue='combat')
def resolve_pending_battles():
    """Run every 60s (celery beat) — resolve battles whose timer has expired."""
    from terra_domini.apps.combat.engine import Battle, CombatEngine
    return {'resolved': CombatEngine.resolve_due(Battle.objects.all())}


@shared_task(name='combat.expire_old_battles', queue='combat')
def expire_old_battles():
    """Mark battles older than 7 days as expired."""
    from django.utils import timezone
    from datetime import timedelta
    from terra_domini.apps.combat.engine import Battle

    cutoff = timezone.now() - timedelta(days=7)
    expired = Battle.objects.filter(
        status=Battle.BattleStatus.PREPARING,
        started_at__lt=cutoff,
    ).update(status=Battle.BattleStatus.CANCELLED)

    return {'expired': expired}
