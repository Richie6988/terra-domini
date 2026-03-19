"""
Daily Clicker mini-game endpoints.
GET  /api/clicker/today/    — today's session state (or create)
POST /api/clicker/click/    — record a click batch (called every 500ms from frontend)
POST /api/clicker/finish/   — complete session, compute rewards
GET  /api/clicker/leaderboard/ — top scores today
"""
import random, logging
from decimal import Decimal
from datetime import date
from django.utils import timezone
from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from terra_domini.apps.progression.models import DailyClickerSession, PlayerStreak

logger = logging.getLogger('terra_domini.clicker')

LOOT_TABLE = [
    # (weight, tier, item, qty_range, tdc_bonus)
    (55, 'common',    'resource_food',      (50, 150),  Decimal('5')),
    (20, 'common',    'resource_materials', (20, 80),   Decimal('10')),
    (12, 'rare',      'resource_energy',    (10, 40),   Decimal('25')),
    (7,  'rare',      'boost_defense_6h',   (1, 1),     Decimal('50')),
    (4,  'epic',      'boost_income_24h',   (1, 1),     Decimal('100')),
    (1,  'epic',      'tdc_jackpot',        (1, 1),     Decimal('500')),
    (0.5,'legendary', 'nft_territory_skin', (1, 1),     Decimal('0')),
    (0.5,'legendary', 'tdi_bonus_10',       (10, 10),   Decimal('0')),
]

def roll_loot(score: int, streak: int):
    weights = [w * (1 + score / 5000) for w,*_ in LOOT_TABLE]
    total   = sum(weights)
    r       = random.uniform(0, total)
    acc     = 0
    for i, (w, tier, item, qty_range, tdc_bonus) in enumerate(LOOT_TABLE):
        acc += weights[i]
        if r <= acc:
            qty = random.randint(*qty_range)
            return tier, item, qty, tdc_bonus
    return 'common', 'resource_food', 50, Decimal('5')

def streak_multiplier(player) -> float:
    try:
        streak = PlayerStreak.objects.get(player=player)
        days   = streak.current_streak
        if days >= 30: return 3.0
        if days >= 14: return 2.0
        if days >= 7:  return 1.5
        if days >= 3:  return 1.25
        return 1.0
    except PlayerStreak.DoesNotExist:
        return 1.0


class ClickerViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='today')
    def today(self, request):
        today = date.today()
        session, created = DailyClickerSession.objects.get_or_create(
            player=request.user, date=today,
            defaults={'streak_mult': streak_multiplier(request.user)}
        )
        return Response({
            'session_id': session.id,
            'date': str(session.date),
            'clicks': session.clicks,
            'max_clicks': session.max_clicks,
            'score': session.score,
            'completed': session.completed,
            'tdc_earned': float(session.tdc_earned) if session.completed else None,
            'loot_tier': session.loot_tier if session.completed else None,
            'loot_item': session.loot_item if session.completed else None,
            'loot_qty': session.loot_quantity if session.completed else None,
            'streak_mult': session.streak_mult,
            'already_done': session.completed,
        })

    @action(detail=False, methods=['POST'], url_path='click')
    def click(self, request):
        """Record incremental clicks during the 60s session."""
        today = date.today()
        session = DailyClickerSession.objects.filter(player=request.user, date=today).first()
        if not session:
            return Response({'error': 'Start a session first (GET /api/clicker/today/)'}, status=400)
        if session.completed:
            return Response({'error': 'Session already completed'}, status=400)

        delta_clicks = min(int(request.data.get('clicks', 1)), 20)  # max 20 per batch
        delta_score  = int(request.data.get('score', delta_clicks * 10))

        DailyClickerSession.objects.filter(id=session.id).update(
            clicks=F('clicks') + delta_clicks,
            score=F('score') + delta_score,
        )
        session.refresh_from_db()
        return Response({'clicks': session.clicks, 'score': session.score})

    @action(detail=False, methods=['POST'], url_path='finish')
    def finish(self, request):
        """Complete session — compute and award rewards."""
        today = date.today()
        session = DailyClickerSession.objects.filter(player=request.user, date=today).first()
        if not session:
            return Response({'error': 'No session found'}, status=400)
        if session.completed:
            return Response({'error': 'Already completed', 'tdc_earned': float(session.tdc_earned)}, status=400)

        # Base reward: 10 TDC + (score / 100) TDC * streak
        base_tdc    = Decimal('10') + Decimal(str(session.score / 100))
        tdc_earned  = base_tdc * Decimal(str(session.streak_mult))
        tdi_earned  = tdc_earned * Decimal('0.001')

        # Roll loot
        tier, item, qty, bonus_tdc = roll_loot(session.score, 1)
        if item == 'tdc_jackpot':
            tdc_earned += bonus_tdc
        elif item == 'tdi_bonus_10':
            tdi_earned += Decimal('10')

        # Apply rewards
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=request.user.id).update(
            tdc_in_game=F('tdc_in_game') + tdc_earned
        )
        if tdi_earned > 0:
            from terra_domini.apps.blockchain.service import CryptoWallet, TDITransaction
            wallet, _ = CryptoWallet.objects.get_or_create(player=request.user)
            CryptoWallet.objects.filter(player=request.user).update(
                tdi_balance=F('tdi_balance') + tdi_earned,
                total_tdi_earned=F('total_tdi_earned') + tdi_earned,
            )
            TDITransaction.objects.create(
                player=request.user, tx_type='territory_yield',
                amount_tdi=tdi_earned,
                note=f'Daily clicker reward — score {session.score}'
            )

        DailyClickerSession.objects.filter(id=session.id).update(
            completed=True, completed_at=timezone.now(),
            tdc_earned=tdc_earned, tdi_earned=tdi_earned,
            loot_tier=tier, loot_item=item, loot_quantity=qty,
        )

        return Response({
            'success': True,
            'score': session.score,
            'clicks': session.clicks,
            'tdc_earned': float(tdc_earned),
            'tdi_earned': float(tdi_earned),
            'loot': {'tier': tier, 'item': item, 'quantity': qty},
            'streak_mult': session.streak_mult,
        })

    @action(detail=False, methods=['GET'], url_path='leaderboard')
    def leaderboard(self, request):
        today = date.today()
        top = DailyClickerSession.objects.filter(
            date=today, completed=True
        ).select_related('player').order_by('-score')[:20]
        return Response([{
            'rank': i+1,
            'username': s.player.username,
            'avatar': getattr(s.player, 'avatar_emoji', '🎖️'),
            'score': s.score,
            'tdc_earned': float(s.tdc_earned),
            'loot_tier': s.loot_tier,
        } for i, s in enumerate(top)])
