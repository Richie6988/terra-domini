"""
Auction Chat WebSocket consumer.
Each auction has a room: ws/auction/<auction_id>/

Messages:
  → {"type": "chat", "text": "hello"}
  → {"type": "bid", "amount": 500}
  ← {"type": "chat", "user": "NEXUS_LORD", "text": "hello", "time": "14:32"}
  ← {"type": "bid", "user": "NEXUS_LORD", "amount": 500, "time": "14:32"}
  ← {"type": "system", "text": "New high bid: 500 HEX by NEXUS_LORD"}
"""
import json
from datetime import datetime
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AuctionChatConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for auction room chat + live bidding."""

    async def connect(self):
        self.auction_id = self.scope['url_route']['kwargs']['auction_id']
        self.room_group = f'auction_{self.auction_id}'
        self.user = self.scope.get('user')
        self.username = getattr(self.user, 'username', 'Anonymous')

        # Join room
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Send join notification
        await self.channel_layer.group_send(self.room_group, {
            'type': 'system_message',
            'text': f'{self.username} joined the auction',
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_send(self.room_group, {
            'type': 'system_message',
            'text': f'{self.username} left the auction',
        })
        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get('type', 'chat')
        now = datetime.now().strftime('%H:%M')

        if msg_type == 'chat':
            text = content.get('text', '').strip()
            if not text or len(text) > 200:
                return
            await self.channel_layer.group_send(self.room_group, {
                'type': 'chat_message',
                'user': self.username,
                'text': text,
                'time': now,
            })

        elif msg_type == 'bid':
            amount = content.get('amount', 0)
            if not isinstance(amount, (int, float)) or amount <= 0:
                return
            # In production: validate bid against DB, check funds, update auction
            await self.channel_layer.group_send(self.room_group, {
                'type': 'bid_message',
                'user': self.username,
                'amount': int(amount),
                'time': now,
            })
            await self.channel_layer.group_send(self.room_group, {
                'type': 'system_message',
                'text': f'New high bid: {int(amount)} HEX by {self.username}',
            })

        elif msg_type == 'emoji':
            emoji = content.get('emoji', '👍')
            await self.channel_layer.group_send(self.room_group, {
                'type': 'emoji_reaction',
                'user': self.username,
                'emoji': emoji,
                'time': now,
            })

    # ── Group message handlers ──

    async def chat_message(self, event):
        await self.send_json({
            'type': 'chat',
            'user': event['user'],
            'text': event['text'],
            'time': event['time'],
        })

    async def bid_message(self, event):
        await self.send_json({
            'type': 'bid',
            'user': event['user'],
            'amount': event['amount'],
            'time': event['time'],
        })

    async def system_message(self, event):
        await self.send_json({
            'type': 'system',
            'text': event['text'],
        })

    async def emoji_reaction(self, event):
        await self.send_json({
            'type': 'emoji',
            'user': event['user'],
            'emoji': event['emoji'],
        })
