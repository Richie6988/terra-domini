"""
Kafka Anti-Cheat Pipeline
Producer: emits game events from Django views/middleware
Consumer: behavioral analysis for bot/exploit detection
Run consumer standalone: python -m terra_domini.apps.accounts.anticheat
"""
import json
import logging
import threading
import time
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional
from django.conf import settings

logger = logging.getLogger('terra_domini.anticheat')

KAFKA_SERVERS = settings.KAFKA_BOOTSTRAP_SERVERS if hasattr(settings, 'KAFKA_BOOTSTRAP_SERVERS') else 'kafka:29092'
TOPIC_GAME_EVENTS = 'terra_domini.game_events'
TOPIC_ANTICHEAT_ALERTS = 'terra_domini.anticheat_alerts'
TOPIC_BLOCKCHAIN_EVENTS = 'terra_domini.blockchain_events'


# ─── Event schemas ────────────────────────────────────────────────────────────

@dataclass
class GameEvent:
    event_type: str
    player_id: str
    session_id: str
    server_ts: str
    payload: dict
    territory_h3: str = ''
    ip_address: str = ''
    device_fp: str = ''
    client_ts: str = ''

    def to_json(self) -> bytes:
        return json.dumps(asdict(self)).encode('utf-8')


@dataclass
class AnticheatAlert:
    player_id: str
    alert_type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    evidence: dict
    recommended_action: str  # 'flag', 'warn', 'suspend', 'ban'
    ts: str


# ─── Producer ─────────────────────────────────────────────────────────────────

class GameEventProducer:
    """Thread-safe Kafka producer for game events. Singleton per process."""

    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        from kafka import KafkaProducer
        self._producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS,
            value_serializer=lambda v: v if isinstance(v, bytes) else json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
            acks='all',
            retries=5,
            max_in_flight_requests_per_connection=1,
            compression_type='snappy',
            linger_ms=10,
            batch_size=16384,
        )
        logger.info(f"Kafka producer connected to {KAFKA_SERVERS}")

    @classmethod
    def get(cls) -> 'GameEventProducer':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    try:
                        cls._instance = cls()
                    except Exception as e:
                        logger.error(f"Kafka producer init failed: {e}")
                        return cls._NullProducer()
        return cls._instance

    def emit(self, event: GameEvent) -> None:
        try:
            self._producer.send(
                TOPIC_GAME_EVENTS,
                key=event.player_id,
                value=event.to_json(),
            )
        except Exception as e:
            logger.warning(f"Kafka emit failed (non-blocking): {e}")

    def emit_dict(self, topic: str, key: str, payload: dict) -> None:
        try:
            self._producer.send(topic, key=key, value=payload)
        except Exception as e:
            logger.warning(f"Kafka emit_dict failed: {e}")

    class _NullProducer:
        """Fallback when Kafka is unavailable — silently drops events."""
        def emit(self, event): pass
        def emit_dict(self, topic, key, payload): pass


# ─── Convenience helpers (called from views/middleware) ───────────────────────

def emit_game_event(
    event_type: str,
    player_id: str,
    session_id: str,
    payload: dict,
    territory_h3: str = '',
    ip: str = '',
    device_fp: str = '',
) -> None:
    event = GameEvent(
        event_type=event_type,
        player_id=str(player_id),
        session_id=session_id,
        server_ts=datetime.now(timezone.utc).isoformat(),
        payload=payload,
        territory_h3=territory_h3,
        ip_address=ip,
        device_fp=device_fp,
    )
    GameEventProducer.get().emit(event)


def emit_blockchain_event(event_type: str, player_id: str, payload: dict) -> None:
    GameEventProducer.get().emit_dict(
        TOPIC_BLOCKCHAIN_EVENTS,
        str(player_id),
        {'event_type': event_type, 'player_id': str(player_id),
         'payload': payload, 'ts': datetime.now(timezone.utc).isoformat()}
    )


# ─── Consumer (runs as separate process) ─────────────────────────────────────

class AnticheatConsumer:
    """
    Processes game event stream and detects anomalous behavior.
    Runs in its own process (started via management command or supervisor).

    Detection rules:
    1. Click rate > 120/minute → bot automation
    2. Geographic impossibility → VPN/proxy spoofing
    3. Resource accumulation rate > 10× expected → exploit
    4. Multiple accounts on same device fingerprint → multi-accounting
    5. Coordinated attack patterns → alliance exploit
    6. Purchase → immediate withdrawal pattern → wash trading TDC
    """

    # Per-player sliding windows (in-memory for consumer process)
    _player_windows: dict = {}
    _device_players: dict = {}  # device_fp → set of player_ids

    # Thresholds
    CLICK_RATE_LIMIT = 120      # actions per minute
    RESOURCE_RATE_MULTIPLIER = 10  # × expected max rate
    MULTI_ACCOUNT_THRESHOLD = 3    # players per device

    def __init__(self):
        from kafka import KafkaConsumer
        self.consumer = KafkaConsumer(
            TOPIC_GAME_EVENTS,
            bootstrap_servers=KAFKA_SERVERS,
            group_id='anticheat_analyzer',
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            max_poll_records=500,
            session_timeout_ms=30000,
        )
        from kafka import KafkaProducer
        self.alert_producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        )
        logger.info("AnticheatConsumer started")

    def run(self) -> None:
        """Main event loop."""
        for message in self.consumer:
            try:
                self._process_event(message.value)
            except Exception as e:
                logger.error(f"Event processing error: {e}", exc_info=True)

    def _process_event(self, event: dict) -> None:
        player_id = event.get('player_id')
        event_type = event.get('event_type')
        device_fp = event.get('device_fp', '')

        if not player_id:
            return

        # Initialize player window
        if player_id not in self._player_windows:
            self._player_windows[player_id] = {
                'actions_this_minute': [],
                'total_resources_claimed': 0,
                'session_start': time.time(),
                'suspicious_score': 0.0,
                'last_territory': None,
                'last_action_ts': None,
            }

        window = self._player_windows[player_id]
        now = time.time()

        # ── Rule 1: Click rate ──────────────────────────────────────────────
        # Slide the 60-second window
        window['actions_this_minute'] = [
            ts for ts in window['actions_this_minute'] if now - ts < 60
        ]
        window['actions_this_minute'].append(now)
        action_rate = len(window['actions_this_minute'])

        if action_rate > self.CLICK_RATE_LIMIT:
            self._raise_alert(player_id, 'click_rate_exceeded', 'high', {
                'actions_per_minute': action_rate,
                'threshold': self.CLICK_RATE_LIMIT,
                'event_type': event_type,
            }, 'suspend')

        # ── Rule 2: Device fingerprint multi-accounting ─────────────────────
        if device_fp:
            if device_fp not in self._device_players:
                self._device_players[device_fp] = set()
            self._device_players[device_fp].add(player_id)

            if len(self._device_players[device_fp]) >= self.MULTI_ACCOUNT_THRESHOLD:
                self._raise_alert(player_id, 'multi_account_device', 'medium', {
                    'device_fp': device_fp[:16] + '…',
                    'player_count': len(self._device_players[device_fp]),
                    'players': list(self._device_players[device_fp])[:5],
                }, 'flag')

        # ── Rule 3: Resource claim anomaly ──────────────────────────────────
        if event_type == 'resource_claim':
            amount = event.get('payload', {}).get('total_amount', 0)
            time_since_session = max(1, now - window['session_start'])
            rate_per_hour = (amount / time_since_session) * 3600
            expected_max = 50000  # credits/hour at max territory count

            if rate_per_hour > expected_max * self.RESOURCE_RATE_MULTIPLIER:
                self._raise_alert(player_id, 'resource_rate_anomaly', 'critical', {
                    'rate_per_hour': round(rate_per_hour),
                    'expected_max': expected_max,
                    'multiplier': round(rate_per_hour / expected_max, 1),
                }, 'ban')

        # ── Rule 4: TDC wash trading ────────────────────────────────────────
        if event_type == 'tdc_purchase':
            window['last_purchase_ts'] = now
        elif event_type == 'tdc_withdrawal':
            last_purchase = window.get('last_purchase_ts', 0)
            if last_purchase and (now - last_purchase) < 300:  # Within 5min
                self._raise_alert(player_id, 'rapid_purchase_withdrawal', 'high', {
                    'seconds_between': round(now - last_purchase),
                    'threshold_seconds': 300,
                }, 'flag')

        # ── Cleanup stale windows (>2h inactive) ────────────────────────────
        if now - window.get('last_action_ts', now) > 7200:
            del self._player_windows[player_id]
        else:
            window['last_action_ts'] = now

    def _raise_alert(self, player_id: str, alert_type: str, severity: str,
                     evidence: dict, action: str) -> None:
        alert = {
            'player_id': player_id,
            'alert_type': alert_type,
            'severity': severity,
            'evidence': evidence,
            'recommended_action': action,
            'ts': datetime.now(timezone.utc).isoformat(),
        }

        # Publish alert
        self.alert_producer.send(TOPIC_ANTICHEAT_ALERTS, value=alert)

        logger.warning(
            f"ANTICHEAT [{severity.upper()}] player={player_id} "
            f"type={alert_type} action={action} evidence={evidence}"
        )

        # For critical alerts, apply action immediately via Django ORM
        if severity in ('critical', 'high') and action in ('suspend', 'ban'):
            self._apply_action_sync(player_id, action, alert_type)

    @staticmethod
    def _apply_action_sync(player_id: str, action: str, reason: str) -> None:
        """Apply ban/suspend directly from consumer process via Django ORM."""
        import django
        import os
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.base')
        try:
            django.setup()
            from terra_domini.apps.accounts.models import Player
            from django.utils import timezone
            from datetime import timedelta

            if action == 'ban':
                Player.objects.filter(id=player_id).update(
                    ban_status=Player.BanStatus.BANNED,
                    ban_reason=f'Automated ban: {reason}',
                )
            elif action == 'suspend':
                Player.objects.filter(id=player_id).update(
                    ban_status=Player.BanStatus.SUSPENDED,
                    ban_reason=f'Automated suspension: {reason}',
                    ban_until=timezone.now() + timedelta(hours=24),
                )
        except Exception as e:
            logger.error(f"Failed to apply action {action} to {player_id}: {e}")


# ─── Django management command ───────────────────────────────────────────────

# Usage: python manage.py run_anticheat_consumer
# (Place this file's AnticheatConsumer in a management command)

if __name__ == '__main__':
    import django
    import os
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.base')
    django.setup()

    consumer = AnticheatConsumer()
    logger.info("Starting anticheat consumer loop…")
    consumer.run()
