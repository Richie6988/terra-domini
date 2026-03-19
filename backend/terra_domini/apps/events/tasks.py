from celery import shared_task
import logging
logger = logging.getLogger(__name__)

@shared_task(name='events.schedule_control_tower_events')
def schedule_control_tower_events():
    """Auto-schedule 3 Control Tower events per day."""
    from django.utils import timezone
    from datetime import timedelta
    from terra_domini.apps.events.models import ControlTowerEvent
    from terra_domini.apps.territories.models import Territory

    now = timezone.now()
    tomorrow = now + timedelta(days=1)
    existing = ControlTowerEvent.objects.filter(starts_at__gte=now, starts_at__lte=tomorrow).count()
    if existing >= 3:
        return {'scheduled': 0, 'existing': existing}

    towers = Territory.objects.filter(is_control_tower=True).order_by('?')[:3 - existing]
    created = 0
    for i, tower in enumerate(towers):
        offset_hours = 8 + (i * 6)
        event_start = now.replace(hour=0, minute=0, second=0) + timedelta(hours=offset_hours)
        if not ControlTowerEvent.objects.filter(territory=tower, starts_at=event_start).exists():
            ControlTowerEvent.objects.create(
                territory=tower,
                announced_at=now,
                starts_at=event_start,
                ends_at=event_start + timedelta(hours=2),
                status=ControlTowerEvent.EventStatus.SCHEDULED,
            )
            created += 1
    return {'scheduled': created}
