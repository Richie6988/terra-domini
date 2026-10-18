"""Daily missions — generation + progress tracking hooks (call track() from game actions)."""
import logging
import random
from django.utils import timezone

logger = logging.getLogger('terra_domini.progression')


def ensure_today_missions(player):
    """3 missions per player per UTC day, generated from active MissionTemplates."""
    from terra_domini.apps.progression.models import MissionTemplate, PlayerDailyMission
    today = timezone.now().date()
    qs = PlayerDailyMission.objects.filter(player=player, date=today).select_related('template')
    if qs.exists():
        return qs
    templates = list(MissionTemplate.objects.filter(is_active=True))
    # Stage-appropriate: a brand-new player (0-1 zone, no army) can't "launch 2 attacks" today
    try:
        from terra_domini.apps.territories.models import Territory
        if Territory.objects.filter(owner=player).count() < 2:
            templates = [t for t in templates if t.mission_type != 'win_battles'] or templates
    except Exception:
        pass
    random.shuffle(templates)
    for tmpl in templates[:3]:
        target = random.randint(tmpl.target_min, tmpl.target_max)
        try:
            PlayerDailyMission.objects.create(
                player=player, template=tmpl, date=today,
                title=tmpl.title_template.replace('{target}', str(target)).replace('{s}', '' if target == 1 else 's').replace('{ies}', 'y' if target == 1 else 'ies'),
                target_count=target,
                reward_tdc=random.randint(tmpl.reward_tdc_min, tmpl.reward_tdc_max),
                reward_xp=tmpl.reward_xp,
            )
        except Exception:
            pass  # unique_together race
    return PlayerDailyMission.objects.filter(player=player, date=today).select_related('template')


def track(player, mission_type: str, amount: int = 1) -> None:
    """Advance today's missions of this type. Never breaks the calling action."""
    try:
        for m in ensure_today_missions(player):
            if m.template.mission_type == mission_type and not m.is_completed:
                m.increment(int(amount))
    except Exception:
        logger.exception('mission tracking failed')
