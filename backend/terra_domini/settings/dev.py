"""
Dev settings — SQLite, no PostGIS, no Redis required, minimal deps.
Works in Codespace without any system packages.
"""
import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env(DEBUG=(bool, True))

# Read .env if it exists, else use defaults
env_file = BASE_DIR.parent / '.env.dev'
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env('DJANGO_SECRET_KEY', default='dev-secret-key-not-for-production-change-me-please')
DEBUG = True
ALLOWED_HOSTS = ['*']
# Codespace WebSocket: also needed for channels security
CSRF_TRUSTED_ORIGINS = [
    'https://*.app.github.dev',
    'https://*.github.dev',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]
CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'channels',
    'drf_spectacular',
    'django_celery_beat',
    'django_celery_results',
    'django_extensions',
    # Local apps
    'terra_domini.apps.accounts',
    'terra_domini.apps.territories',
    'terra_domini.apps.combat',
    'terra_domini.apps.economy',
    'terra_domini.apps.alliances',
    'terra_domini.apps.blockchain',
    'terra_domini.apps.events',
    'terra_domini.apps.websocket',
    'terra_domini.apps.progression',
    'terra_domini.apps.social',
    'terra_domini.apps.admin_gm',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'terra_domini.urls'
WSGI_APPLICATION = 'terra_domini.wsgi.application'
ASGI_APPLICATION = 'terra_domini.asgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

# ── Database: SQLite for Codespace, Postgres for Docker ──────────────────────
_use_postgres = env('POSTGRES_HOST', default='') != ''

if _use_postgres:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',  # NO PostGIS
            'NAME': env('POSTGRES_DB', default='terradomini'),
            'USER': env('POSTGRES_USER', default='td_user'),
            'PASSWORD': env('POSTGRES_PASSWORD', default='devpassword123'),
            'HOST': env('POSTGRES_HOST', default='localhost'),
            'PORT': env('POSTGRES_PORT', default='5432'),
        }
    }
else:
    # Codespace: pure SQLite, zero setup
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ── Cache: memory when no Redis ───────────────────────────────────────────────
_redis_host = env('REDIS_HOST', default='')
if _redis_host:
    _redis_url = f"redis://:{env('REDIS_PASSWORD', default='')}@{_redis_host}:{env('REDIS_PORT', default='6379')}"
    CACHES = {
        'default':    {'BACKEND': 'django_redis.cache.RedisCache', 'LOCATION': f'{_redis_url}/0', 'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'}},
        'game_state': {'BACKEND': 'django_redis.cache.RedisCache', 'LOCATION': f'{_redis_url}/3', 'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'}},
    }
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [(_redis_host, int(env('REDIS_PORT', default='6379')))]},
        }
    }
else:
    # No Redis — use in-memory (works for single-process dev)
    CACHES = {
        'default':    {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'td-default'},
        'game_state': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'td-game'},
    }
    CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'accounts.Player'
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=90),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,  # disabled
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',           # Player.id (UUID)
    'USER_ID_CLAIM': 'user_id',      # claim name in JWT payload
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_RATES': {'anon': '1000/hour', 'user': '10000/hour'},
}

# ── Celery ────────────────────────────────────────────────────────────────────
_broker = env('CELERY_BROKER_URL', default='')
CELERY_BROKER_URL = _broker if _broker else 'memory://'
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='cache+memory://')
CELERY_TASK_ALWAYS_EAGER = not bool(_broker)  # run sync when no broker
CELERY_TASK_EAGER_PROPAGATES = True

# ── Static / Media ────────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR.parent / 'frontend' / 'dist',
]
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
# Whitenoise: serve static files efficiently in production (no nginx needed)
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'  # dev: no compression/caching
WHITENOISE_ROOT = BASE_DIR.parent / 'frontend' / 'dist'
WHITENOISE_INDEX_FILE = True  # serve index.html for directory requests

# ── Game Config ───────────────────────────────────────────────────────────────
H3_DEFAULT_RESOLUTION = 10
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY', default='sk_test_placeholder')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='whsec_placeholder')
KAFKA_BOOTSTRAP_SERVERS = env('KAFKA_BOOTSTRAP_SERVERS', default='')
SENTRY_DSN = ''

BLOCKCHAIN = {
    'CHAIN_ID': int(env('BLOCKCHAIN_CHAIN_ID', default='80002')),  # Polygon Amoy
    'RPC_URL': env('BLOCKCHAIN_RPC_URL', default=''),
    'TDC_CONTRACT': env('TDC_CONTRACT_ADDRESS', default=''),
    'TREASURY_ADDRESS': env('TDC_TREASURY_ADDRESS', default=''),
    'TREASURY_PRIVATE_KEY': env('TDC_TREASURY_PRIVATE_KEY', default=''),
    'TDC_EUR_RATE': int(env('TDC_EUR_RATE', default='100')),
}


# ── Game Mechanics Config (required by combat engine + territory engine) ──────
GAME = {
    'H3_DEFAULT_RESOLUTION': 10,
    'TERRITORY_TICK_SECONDS': 300,
    'OFFLINE_INCOME_RATE': 0.40,
    'BEGINNER_PROTECTION_DAYS': 7,
    'BATTLE_TIMER': {
        'HEX': 4 * 3600,
        'DISTRICT': 12 * 3600,
        'CITY': 24 * 3600,
        'CAPITAL': 72 * 3600,
    },
    'MAX_ALLIANCE_SQUAD': 5,
    'MAX_ALLIANCE_GUILD': 25,
    'MAX_ALLIANCE_FEDERATION': 500,
    'CONTROL_TOWER_EVENTS_PER_DAY': 3,
    'CONTROL_TOWER_EVENT_DURATION_SECONDS': 7200,
    'SHIELD_MAX_HOURS_PER_DAY': 12,
    'MAX_MILITARY_BOOST_PCT': 25,
    'MAX_BUILD_SPEED_BOOST_PCT': 50,
}

# ── Email ────────────────────────────────────────────────────────────────────
# Priority: SMTP_HOST > RESEND_API_KEY > console (dev)
#
# SMTP (n'importe quel fournisseur — OVH, Gmail, Mailgun, Brevo...):
#   SMTP_HOST=smtp.mondomaine.com
#   SMTP_PORT=587
#   SMTP_USER=noreply@hexod.io
#   SMTP_PASSWORD=motdepasse
#   SMTP_USE_TLS=True
#
# Resend (3000/mois gratuit) :
#   RESEND_API_KEY=re_xxxx
#
_smtp_host    = env('SMTP_HOST', default='')
_resend_key   = env('RESEND_API_KEY', default='')

if _smtp_host:
    EMAIL_BACKEND   = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST      = _smtp_host
    EMAIL_PORT      = env.int('SMTP_PORT', default=587)
    EMAIL_HOST_USER = env('SMTP_USER', default='')
    EMAIL_HOST_PASSWORD = env('SMTP_PASSWORD', default='')
    EMAIL_USE_TLS   = env.bool('SMTP_USE_TLS', default=True)
    EMAIL_USE_SSL   = env.bool('SMTP_USE_SSL', default=False)
elif _resend_key:
    EMAIL_BACKEND = 'anymail.backends.resend.EmailBackend'
    ANYMAIL = {'RESEND_API_KEY': _resend_key}
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL   = env('DEFAULT_FROM_EMAIL', default='Hexod <noreply@hexod.io>')
EMAIL_SUBJECT_PREFIX = '[Hexod] '
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# ── WebSocket / Codespace ─────────────────────────────────────────────────────
# Allow github.dev Codespace URLs for WebSocket connections

SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'terra_domini': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'django.db.backends': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Terra Domini API',
    'DESCRIPTION': 'Real-world territory strategy game API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

print(f"⚙️  DEV settings — DB: {'PostgreSQL' if _use_postgres else 'SQLite'} · Cache: {'Redis' if _redis_host else 'Memory'} · Celery: {'Broker' if _broker else 'Sync'}")
