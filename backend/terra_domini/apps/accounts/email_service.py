"""
HEXOD Email Service.
Sends transactional emails using Django templates.

Usage:
    from terra_domini.apps.accounts.email_service import send_hexod_email
    send_hexod_email(user, 'welcome', {'referral_code': 'ABC123'})

SMTP Config (in .env):
    # Local dev with Mailpit:
    SMTP_HOST=localhost
    SMTP_PORT=1025
    SMTP_USE_TLS=False

    # Production:
    SMTP_HOST=smtp.your-provider.com
    SMTP_PORT=587
    SMTP_USER=noreply@hexod.io
    SMTP_PASSWORD=your-password
"""
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)

TEMPLATES = {
    'welcome': {
        'subject': 'Welcome to HEXOD — Your Empire Begins! ⬡',
        'template': 'emails/welcome.html',
    },
    'verify_email': {
        'subject': '⬡ HEXOD — Verify Your Email',
        'template': 'emails/verify_email.html',
    },
    'password_reset': {
        'subject': 'Reset Your HEXOD Password',
        'template': 'emails/password_reset.html',
    },
    'territory_claimed': {
        'subject': '🏴 Territory Claimed — {territory_name}',
        'template': 'emails/territory_claimed.html',
    },
    'event_result': {
        'subject': '🎁 Event Result — {event_name}',
        'template': 'emails/event_result.html',
    },
    'auction_won': {
        'subject': '🏆 Auction Won — {token_name}',
        'template': 'emails/auction_won.html',
    },
    'auction_outbid': {
        'subject': '⚠️ You\'ve Been Outbid — {token_name}',
        'template': 'emails/auction_outbid.html',
    },
    'alliance_invite': {
        'subject': '🏰 Alliance Invitation — {alliance_name}',
        'template': 'emails/alliance_invite.html',
    },
    'attack_alert': {
        'subject': '⚔️ Your Territory is Under Attack!',
        'template': 'emails/attack_alert.html',
    },
    'verify_email': {
        'subject': '⬡ HEXOD — Verify Your Email',
        'template': 'emails/verify_email.html',
    },
}

SITE_URL = getattr(settings, 'SITE_URL', 'http://localhost:8000')


def send_hexod_email(user, template_key: str, context: dict = None):
    """
    Send a transactional email to a user.

    Args:
        user: Django User instance (needs .email and .username)
        template_key: One of TEMPLATES keys
        context: Extra template context (merged with defaults)
    """
    if not user.email:
        logger.warning(f"No email for user {user.username}, skipping {template_key}")
        return False

    tmpl = TEMPLATES.get(template_key)
    if not tmpl:
        logger.error(f"Unknown email template: {template_key}")
        return False

    ctx = {
        'username': user.username,
        'email': user.email,
        'site_url': SITE_URL,
        'unsubscribe_token': f'{user.pk}',  # Simple token, improve in prod
        **(context or {}),
    }

    subject = tmpl['subject'].format(**ctx) if '{' in tmpl['subject'] else tmpl['subject']

    try:
        html_message = render_to_string(tmpl['template'], ctx)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f"{settings.EMAIL_SUBJECT_PREFIX}{subject}",
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Email sent: {template_key} → {user.email}")
        return True

    except Exception as e:
        logger.error(f"Email failed: {template_key} → {user.email}: {e}")
        return False


def send_welcome_email(user):
    """Convenience: send welcome email on registration."""
    return send_hexod_email(user, 'welcome', {
        'referral_code': f'HEXOD_{user.username.upper()[:10]}',
    })


def send_territory_claimed_email(user, territory):
    """Convenience: send email when territory is claimed."""
    return send_hexod_email(user, 'territory_claimed', {
        'territory_name': territory.poi_name or territory.place_name or territory.h3_index[:12],
        'rarity': getattr(territory, 'rarity', 'common'),
        'h3_index': territory.h3_index,
    })


def send_auction_outbid_email(user, auction_name, current_bid):
    """Convenience: notify when outbid."""
    return send_hexod_email(user, 'auction_outbid', {
        'token_name': auction_name,
        'current_bid': current_bid,
    })


def generate_verification_code():
    """Generate a 6-digit numeric code."""
    import random
    return f'{random.randint(100000, 999999)}'


def send_verification_email(user, code: str):
    """Send email verification code after registration."""
    return send_hexod_email(user, 'verify_email', {
        'code': code,
    })
