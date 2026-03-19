from celery import shared_task
import logging
logger = logging.getLogger('terra_domini.social')


@shared_task(name='social.update_referral_stats')
def update_referral_stats():
    """Daily: recalculate active referrals and monthly commission."""
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Sum, Count, Q
    from terra_domini.apps.social.models import ReferralLink, Referral

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    thirty_days_ago = now - timedelta(days=30)

    for link in ReferralLink.objects.all():
        active = Referral.objects.filter(
            referrer=link.referrer,
            referred__last_active__gte=thirty_days_ago,
            is_active=True,
        ).count()
        link.active_referrals = active
        link.save(update_fields=['active_referrals'])

    return {'updated': ReferralLink.objects.count()}
