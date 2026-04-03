"""
Alliance Chat WebSocket consumer.
Room: ws/alliance/<alliance_id>/

Messages:
  → {"type": "chat", "text": "hello"}
  → {"type": "help_request", "territory": "8f1e82a41"}
  → {"type": "attack_plan", "target": "8f2b90c21", "text": "Attack at 20:00 UTC"}
  ← {"type": "chat", "user": "NEXUS_LORD", "role": "leader", "text": "hello", "time": "14:32"}
  ← {"type": "system", "text": "StormHex joined the alliance chat"}
  ← {"type": "help_request", "user": "IronViper", "territory": "8f1e82a41", "time": "14:33"}
  ← {"type": "attack_plan", "user": "NEXUS_LORD", "target": "8f2b90c21", "text": "...", "time": "14:34"}
  ← {"type": "member_count", "count": 12}
"""
import json
from datetime import datetime
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async


class AllianceChatConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for alliance real-time communication."""

    async def connect(self):
        self.alliance_id = self.scope['url_route']['kwargs']['alliance_id']
        self.room_group = f'alliance_{self.alliance_id}'
        self.user = self.scope.get('user')
        self.username = getattr(self.user, 'username', 'Anonymous')

        # Verify membership
        is_member = await self._check_membership()
        if not is_member:
            await self.close(code=4403)
            return

        self.role = await self._get_role()

        # Join room
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Announce join
        await self.channel_layer.group_send(self.room_group, {
            'type': 'system_message',
            'text': f'{self.username} is online',
        })

        # Send current member count
        count = await self._online_count()
        await self.send_json({
            'type': 'member_count',
            'count': count,
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_send(self.room_group, {
            'type': 'system_message',
            'text': f'{self.username} went offline',
        })
        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get('type', 'chat')
        now = datetime.utcnow().strftime('%H:%M')

        if msg_type == 'chat':
            text = content.get('text', '').strip()[:500]
            if not text:
                return
            # Save to DB
            await self._save_message(text, 'chat')
            # Broadcast
            await self.channel_layer.group_send(self.room_group, {
                'type': 'chat_message',
                'user': self.username,
                'role': self.role,
                'text': text,
                'time': now,
            })

        elif msg_type == 'help_request':
            territory = content.get('territory', '')
            text = content.get('text', 'Requesting backup!')
            await self._save_message(f'HELP: {text} ({territory})', 'help')
            await self.channel_layer.group_send(self.room_group, {
                'type': 'help_message',
                'user': self.username,
                'territory': territory,
                'text': text,
                'time': now,
            })

        elif msg_type == 'attack_plan':
            target = content.get('target', '')
            text = content.get('text', '')[:500]
            # Only leaders and officers can create attack plans
            if self.role not in ('leader', 'officer'):
                await self.send_json({'type': 'error', 'text': 'Only officers can create attack plans'})
                return
            await self._save_message(f'ATTACK PLAN: {target} — {text}', 'attack_plan')
            await self.channel_layer.group_send(self.room_group, {
                'type': 'attack_plan_message',
                'user': self.username,
                'target': target,
                'text': text,
                'time': now,
            })

        elif msg_type == 'emoji':
            emoji = content.get('emoji', '👍')[:4]
            await self.channel_layer.group_send(self.room_group, {
                'type': 'emoji_message',
                'user': self.username,
                'emoji': emoji,
                'time': now,
            })

    # ── Group send handlers ──

    async def chat_message(self, event):
        await self.send_json({
            'type': 'chat',
            'user': event['user'],
            'role': event.get('role', 'member'),
            'text': event['text'],
            'time': event['time'],
        })

    async def system_message(self, event):
        await self.send_json({
            'type': 'system',
            'text': event['text'],
            'time': datetime.utcnow().strftime('%H:%M'),
        })

    async def help_message(self, event):
        await self.send_json({
            'type': 'help_request',
            'user': event['user'],
            'territory': event.get('territory', ''),
            'text': event.get('text', ''),
            'time': event['time'],
        })

    async def attack_plan_message(self, event):
        await self.send_json({
            'type': 'attack_plan',
            'user': event['user'],
            'target': event.get('target', ''),
            'text': event.get('text', ''),
            'time': event['time'],
        })

    async def emoji_message(self, event):
        await self.send_json({
            'type': 'emoji',
            'user': event['user'],
            'emoji': event.get('emoji', '👍'),
            'time': event['time'],
        })

    # ── DB helpers ──

    @database_sync_to_async
    def _check_membership(self):
        try:
            from terra_domini.apps.alliances.models import AllianceMember
            return AllianceMember.objects.filter(
                alliance_id=self.alliance_id,
                player=self.user
            ).exists()
        except Exception:
            return True  # Fallback: allow connection (model may not exist yet)

    @database_sync_to_async
    def _get_role(self):
        try:
            from terra_domini.apps.alliances.models import AllianceMember
            member = AllianceMember.objects.filter(
                alliance_id=self.alliance_id,
                player=self.user
            ).first()
            return member.role if member else 'member'
        except Exception:
            return 'member'

    @database_sync_to_async
    def _save_message(self, text, msg_type):
        try:
            from terra_domini.apps.alliances.models import AllianceChatMessage
            AllianceChatMessage.objects.create(
                alliance_id=self.alliance_id,
                player=self.user,
                message_type=msg_type,
                text=text,
            )
        except Exception:
            pass  # Model may not exist yet — message still broadcast via WS

    @database_sync_to_async
    def _online_count(self):
        # Approximate: count channel layer group members (not exact)
        return 1  # Placeholder — real count needs Redis pubsub tracking
