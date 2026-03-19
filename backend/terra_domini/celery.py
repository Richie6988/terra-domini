"""
Celery configuration for Terra Domini.
Workers: default, combat, territory, blockchain
"""
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.base')

app = Celery('terra_domini')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ─── Periodic Tasks ──────────────────────────────────────────────────────────
app.conf.beat_schedule = {
    # Territory resource tick — every 5 minutes
    'territory-resource-tick': {
        'task': 'terra_domini.apps.territories.tasks.process_territory_tick',
        'schedule': 300.0,
        'options': {'queue': 'territory'},
    },
    # Control Tower event scheduler — every hour check
    'control-tower-scheduler': {
        'task': 'terra_domini.apps.events.tasks.schedule_control_tower_events',
        'schedule': crontab(minute=0),
        'options': {'queue': 'default'},
    },
    # Resolve pending battles — every 60 seconds
    'resolve-pending-battles': {
        'task': 'terra_domini.apps.combat.tasks.resolve_pending_battles',
        'schedule': 60.0,
        'options': {'queue': 'combat'},
    },
    # Anti-cheat behavioral analysis — every 10 minutes
    'anticheat-analysis': {
        'task': 'terra_domini.apps.accounts.tasks.run_anticheat_analysis',
        'schedule': 600.0,
        'options': {'queue': 'default'},
    },
    # TDC rate update from DEX — every 5 minutes
    'tdc-rate-update': {
        'task': 'terra_domini.apps.blockchain.tasks.update_tdc_market_rate',
        'schedule': 300.0,
        'options': {'queue': 'blockchain'},
    },
    # Offline income calculation — every 5 minutes
    'offline-income': {
        'task': 'terra_domini.apps.economy.tasks.calculate_offline_income',
        'schedule': 300.0,
        'options': {'queue': 'territory'},
    },
    # Season leaderboard refresh — every 5 minutes
    'leaderboard-refresh': {
        'task': 'terra_domini.apps.territories.tasks.refresh_leaderboards',
        'schedule': 300.0,
        'options': {'queue': 'default'},
    },
    # Daily metrics snapshot
    'daily-metrics': {
        'task': 'terra_domini.apps.accounts.tasks.daily_metrics_snapshot',
        'schedule': crontab(hour=0, minute=5),
        'options': {'queue': 'default'},
    },
}

app.conf.timezone = 'UTC'


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
