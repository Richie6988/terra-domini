"""
WSGI config for terra_domini project.
Used by gunicorn in production: gunicorn terra_domini.wsgi:application
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
application = get_wsgi_application()
