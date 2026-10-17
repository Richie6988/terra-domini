# Load the Celery app with Django so .delay() honours CELERY_* settings
# (dev: memory broker + ALWAYS_EAGER). Without it, .delay() targets amqp://localhost → 500.
from .celery import app as celery_app

__all__ = ('celery_app',)
