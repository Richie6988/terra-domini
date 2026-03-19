"""
Development settings — overrides base.py for local dev.
Uses .env but with debug-friendly defaults.
Import: DJANGO_SETTINGS_MODULE=terra_domini.settings.dev
"""
from terra_domini.settings.base import *  # noqa

DEBUG = True

# Relax allowed hosts for dev
ALLOWED_HOSTS = ['*']
CORS_ALLOW_ALL_ORIGINS = True

# Disable HTTPS redirect in dev
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Use console email backend
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Use local file storage (no S3 in dev)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# More verbose logging in dev
LOGGING['root']['level'] = 'DEBUG'
LOGGING['loggers']['terra_domini']['level'] = 'DEBUG'

# Disable Sentry in dev
SENTRY_DSN = ''

# Relax rate limiting in dev
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '10000/hour',
    'user': '100000/hour',
    'game_actions': '100000/hour',
    'blockchain': '10000/hour',
    'combat': '10000/hour',
}

# Stripe test keys (replace with your test keys)
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY', default='sk_test_placeholder')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='whsec_placeholder')

# Kafka optional in dev (anti-cheat works without it)
KAFKA_BOOTSTRAP_SERVERS = env('KAFKA_BOOTSTRAP_SERVERS', default='kafka:29092')

print("⚙️  Running with DEV settings")
