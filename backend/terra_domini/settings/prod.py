"""
Production settings for a single VPS (nginx + gunicorn/uvicorn + systemd), next to other apps.
Builds on dev.py (SQLite/Postgres + optional Redis, no PostGIS/S3) and locks it down.

Required env (backend/../.env.prod): DJANGO_SECRET_KEY, ALLOWED_HOSTS, SITE_URL.
Optional: SQLITE_PATH (default /home/hexod/data/hexod.sqlite3) or POSTGRES_HOST..., REDIS_HOST, SMTP_*.
"""
import os
from pathlib import Path
import environ

_env_file = Path(__file__).resolve().parent.parent.parent.parent / '.env.prod'
if _env_file.exists():
    environ.Env.read_env(str(_env_file))   # does not override real environment variables

from .dev import *  # noqa: E402,F401,F403

env = environ.Env()

DEBUG = False
SECRET_KEY = env('DJANGO_SECRET_KEY')                         # no default: must be set
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')
SITE_URL = env('SITE_URL')
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[SITE_URL])
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[SITE_URL])

# Database OUTSIDE the git checkout (backend/db.sqlite3 is versioned: git pull would overwrite it)
if not env('POSTGRES_HOST', default=''):
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': env('SQLITE_PATH', default='/home/hexod/data/hexod.sqlite3'),
        'OPTIONS': {'timeout': 20},
    }}

# Behind nginx (TLS terminated there)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
# Send our origin to tile servers: OpenStreetMap blocks tile requests without a Referer
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

MEDIA_ROOT = env('MEDIA_ROOT', default='/home/hexod/data/media')

LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {'terra_domini': {'handlers': ['console'], 'level': 'INFO', 'propagate': False}},
}
MIDDLEWARE = [*MIDDLEWARE, 'django.middleware.clickjacking.XFrameOptionsMiddleware']
