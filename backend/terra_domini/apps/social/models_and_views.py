"""
Social API — Friend system, referral program, player profiles, share cards.
Mandated by: Social Agent (Zhang Wei, Priya, Yasmine personas)
"""
import uuid
import logging
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import F, Q
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

logger = logging.getLogger('terra_domini.social')


# ─── Models ───────────────────────────────────────────────────────────────────

class Friendship(models.Model):
    """Bidirectional friendship — one record per pair (user1 < user2 always)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user1 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friendships_as_1')
    user2 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friendships_as_2')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'friendships'
        unique_together = ['user1', 'user2']

    @classmethod
    def are_friends(cls, a, b) -> bool:
        u1, u2 = (a, b) if str(a.id) < str(b.id) else (b, a)
        return cls.objects.filter(user1=u1, user2=u2).exists()

    @classmethod
    def get_friends(cls, user):
        """Get all friend User objects for a player."""
        from terra_domini.apps.accounts.models import Player
        friend_ids = set()
        for f in cls.objects.filter(Q(user1=user) | Q(user2=user)):
            friend_ids.add(f.user2_id if f.user1_id == user.id else f.user1_id)
        return Player.objects.filter(id__in=friend_ids)


class FriendRequest(models.Model):
    class RequestStatus(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_requests')
    to_player   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'friend_requests'
        unique_together = ['from_player', 'to_player']


class ReferralLink(models.Model):
    """Creator referral — tracks who invited whom and commission earnings."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referrer = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referral_link')
    code = models.CharField(max_length=20, unique=True)  # referrer's player ID slice
    total_referrals = models.IntegerField(default=0)
    active_referrals = models.IntegerField(default=0)    # active in last 30 days
    total_commission_tdc = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    this_month_tdc = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'referral_links'


class Referral(models.Model):
    """A player who joined via a referral link."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referrals_made')
    referred = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='was_referred')
    commission_pct = models.FloatField(default=5.0)   # 5% of referred's purchases
    total_tdc_earned = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    expires_at = models.DateTimeField()               # 90-day commission window
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'referrals'


# ─── Views ────────────────────────────────────────────────────────────────────

class FriendViewSet(viewsets.GenericViewSet):

    @action(detail=False, methods=['GET'], url_path='friends')
    def list_friends(self, request):
        friends = Friendship.get_friends(request.user)
        data = [{
            'id': str(f.id),
            'username': f.username,
            'display_name': f.display_name,
            'commander_rank': f.commander_rank,
            'territories_owned': getattr(f, 'stats', None) and f.stats.territories_owned or 0,
            'is_online': f.is_online,
            'alliance_tag': (
                f.alliance_member.alliance.tag
                if hasattr(f, 'alliance_member') else None
            ),
        } for f in friends.select_related('stats').prefetch_related('alliance_member__alliance')]
        return Response({'friends': data})

    @action(detail=False, methods=['GET'], url_path='friend-requests')
    def list_requests(self, request):
        reqs = FriendRequest.objects.filter(
            to_player=request.user, status=FriendRequest.RequestStatus.PENDING
        ).select_related('from_player')
        data = [{
            'id': str(r.id),
            'from_player': {
                'id': str(r.from_player.id),
                'username': r.from_player.username,
                'commander_rank': r.from_player.commander_rank,
            },
            'created_at': r.created_at.isoformat(),
        } for r in reqs]
        return Response({'requests': data})

    @action(detail=False, methods=['POST'], url_path='friend-request')
    def send_request(self, request):
        target_id = request.data.get('target_player_id')
        if not target_id:
            return Response({'error': 'target_player_id required'}, status=400)

        from terra_domini.apps.accounts.models import Player
        try:
            target = Player.objects.get(id=target_id)
        except Player.DoesNotExist:
            return Response({'error': 'Player not found'}, status=404)

        if target == request.user:
            return Response({'error': 'Cannot add yourself'}, status=400)

        if Friendship.are_friends(request.user, target):
            return Response({'error': 'Already friends'}, status=409)

        _, created = FriendRequest.objects.get_or_create(
            from_player=request.user, to_player=target,
            defaults={'status': FriendRequest.RequestStatus.PENDING}
        )
        if not created:
            return Response({'error': 'Request already sent'}, status=409)

        # Notify via WebSocket
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from terra_domini.apps.websocket.consumers import notify_player
        async_to_sync(notify_player)(
            get_channel_layer(), str(target.id),
            {'type': 'friend_request', 'from': request.user.username, 'message': f'{request.user.username} wants to be your ally!'}
        )

        return Response({'message': 'Friend request sent'}, status=201)

    @action(detail=True, methods=['POST'], url_path='accept')
    def accept_request(self, request, pk=None):
        try:
            req = FriendRequest.objects.get(id=pk, to_player=request.user, status=FriendRequest.RequestStatus.PENDING)
        except FriendRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=404)

        # Create friendship (ensure user1 < user2 by ID for uniqueness)
        u1, u2 = ((req.from_player, req.to_player) if str(req.from_player.id) < str(req.to_player.id)
                  else (req.to_player, req.from_player))
        Friendship.objects.get_or_create(user1=u1, user2=u2)

        req.status = FriendRequest.RequestStatus.ACCEPTED
        req.responded_at = timezone.now()
        req.save(update_fields=['status', 'responded_at'])

        return Response({'message': f'You and {req.from_player.username} are now friends!'})

    @action(detail=True, methods=['POST'], url_path='decline')
    def decline_request(self, request, pk=None):
        try:
            req = FriendRequest.objects.get(id=pk, to_player=request.user)
        except FriendRequest.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        req.status = FriendRequest.RequestStatus.DECLINED
        req.responded_at = timezone.now()
        req.save(update_fields=['status', 'responded_at'])
        return Response({'message': 'Request declined'})

    @action(detail=False, methods=['GET'], url_path='referral-stats')
    def referral_stats(self, request):
        link, _ = ReferralLink.objects.get_or_create(
            referrer=request.user,
            defaults={'code': str(request.user.id)[:16]}
        )
        return Response({
            'code': link.code,
            'total_referrals': link.total_referrals,
            'active_referrals': link.active_referrals,
            'total_commission_tdc': float(link.total_commission_tdc),
            'this_month_tdc': float(link.this_month_tdc),
            'invite_url': f'https://terradomini.io/join?ref={link.code}',
        })


class PublicProfileView(generics.RetrieveAPIView):
    """GET /players/{username}/profile/ — public player profile (SEO-indexed)."""
    permission_classes = [AllowAny]

    def retrieve(self, request, username=None):
        from terra_domini.apps.accounts.models import Player, PlayerStats
        try:
            player = Player.objects.select_related('stats').prefetch_related(
                'alliance_member__alliance', 'achievements__achievement'
            ).get(username=username, is_active=True)
        except Player.DoesNotExist:
            return Response({'error': 'Player not found'}, status=404)

        # Public profile data (no sensitive info)
        achievements = [{
            'name': pa.achievement.name,
            'icon': pa.achievement.icon_emoji,
            'rarity': pa.achievement.tier,
            'unlocked_at': pa.unlocked_at.isoformat(),
        } for pa in player.achievements.select_related('achievement').order_by('-unlocked_at')[:12]]

        return Response({
            'username': player.username,
            'display_name': player.display_name,
            'commander_rank': player.commander_rank,
            'spec_path': player.spec_path,
            'is_online': player.is_online,
            'date_joined': player.date_joined.strftime('%B %Y'),
            'stats': {
                'territories_owned': player.stats.territories_owned if hasattr(player, 'stats') else 0,
                'territories_captured': player.stats.territories_captured if hasattr(player, 'stats') else 0,
                'battles_won': player.stats.battles_won if hasattr(player, 'stats') else 0,
                'season_score': player.stats.season_score if hasattr(player, 'stats') else 0,
                'season_rank': player.stats.season_rank if hasattr(player, 'stats') else 0,
            },
            'alliance': {
                'tag': player.alliance_member.alliance.tag,
                'name': player.alliance_member.alliance.name,
                'role': player.alliance_member.role,
            } if hasattr(player, 'alliance_member') else None,
            'achievements': achievements,
        })


class MyReferralView(APIView):
    """GET /api/social/my-referral/ — get or create le lien referral du joueur."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.conf import settings as _s
        player = request.user

        # get_or_create lien avec code basé sur username+id
        link, created = ReferralLink.objects.get_or_create(
            referrer=player,
            defaults={'code': f"{player.username[:8].lower()}{str(player.id)[:6]}"}
        )

        # Si le code existe déjà mais a une collision, ajouter suffix
        if created is False and not link.code:
            link.code = f"{player.username[:8].lower()}{str(player.id)[:6]}"
            link.save(update_fields=['code'])

        frontend_url = getattr(_s, 'FRONTEND_URL', 'https://hexod.io')
        invite_url   = f"{frontend_url}/register?ref={link.code}"

        # Liste des filleuls
        referrals = Referral.objects.filter(referrer=player).select_related('referred').order_by('-joined_at')[:20]

        return Response({
            'code': link.code,
            'invite_url': invite_url,
            'total_referrals': link.total_referrals,
            'total_commission_tdc': float(link.total_commission_tdc),
            'this_month_tdc': float(link.this_month_tdc),
            'referrals': [
                {
                    'username': r.referred.username,
                    'joined_at': r.joined_at.isoformat(),
                    'is_active': r.is_active,
                    'tdc_earned': float(r.total_tdc_earned),
                }
                for r in referrals
            ],
            'reward_per_referral': 50,   # HEX Coin offerts au filleul
            'commission_pct': 5.0,       # 5% des achats du filleul pendant 90j
        })


class JoinViaReferralView(APIView):
    """Called after registration when ?ref= param present in URL."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ref_code = request.data.get('ref_code')
        if not ref_code:
            return Response({'error': 'ref_code required'}, status=400)

        try:
            link = ReferralLink.objects.select_related('referrer').get(code=ref_code)
        except ReferralLink.DoesNotExist:
            return Response({'error': 'Invalid referral code'}, status=404)

        if link.referrer == request.user:
            return Response({'error': 'Cannot refer yourself'}, status=400)

        # Create referral record
        referral, created = Referral.objects.get_or_create(
            referred=request.user,
            defaults={
                'referrer': link.referrer,
                'commission_pct': 5.0,
                'expires_at': timezone.now() + __import__('datetime').timedelta(days=90),
            }
        )

        if created:
            ReferralLink.objects.filter(id=link.id).update(
                total_referrals=F('total_referrals') + 1
            )
            # Give welcome bonus to new player
            request.user.__class__.objects.filter(id=request.user.id).update(
                tdc_in_game=F('tdc_in_game') + 50  # 50 TDC welcome bonus
            )
            logger.info(f"Referral: {link.referrer.username} referred {request.user.username}")

        return Response({'message': 'Referral registered! +50 TDC welcome bonus added.'})
