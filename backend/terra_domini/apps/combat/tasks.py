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


@shared_task(name='combat.bot_raids', queue='combat')
def bot_raids(probability: float = 0.2):
    """Every ~2h: bots raid some human players (≥3 territories, unprotected). Never the capital.
    The player sees "under attack" in /api/loop/status/ and can reinforce — or loses the hex."""
    import random
    from django.db.models import Q
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.combat.engine import CombatEngine
    from terra_domini.apps.territories.models import Territory

    bots = list(Player.objects.filter(Q(is_bot=True) | Q(email__endswith='@bot.hexod.io')))
    if not bots:
        return {'raids': 0}
    raids = 0
    humans = Player.objects.filter(is_bot=False, is_active=True).exclude(email__endswith='@bot.hexod.io')
    for p in humans:
        if p.is_protected or random.random() > probability:
            continue
        owned = list(Territory.objects.filter(owner=p).order_by('captured_at'))
        if len(owned) < 3:
            continue
        targets = [t for t in owned[1:] if not t.is_under_attack and not t.is_shielded()]
        if not targets:
            continue
        t = random.choice(targets)
        defense = CombatEngine.calculate_defense_power(t, {})
        infantry = max(5, int(defense / 10 * random.uniform(0.8, 1.3)))  # roughly even: reinforcing matters
        # 'conquest': a lost raid really costs the hex (a 'raid' type never captures, so the nudge would be an empty threat)
        CombatEngine.npc_attack(random.choice(bots), t, {'infantry': infantry}, battle_type='conquest')
        raids += 1
    return {'raids': raids}
