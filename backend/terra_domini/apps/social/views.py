"""Social views — friends, referrals, profiles."""
from terra_domini.apps.social.models_and_views import (
    FriendViewSet,
    PublicProfileView,
    JoinViaReferralView,
)

# Re-export for urls.py
__all__ = ['FriendViewSet', 'PublicProfileView', 'JoinViaReferralView']


from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class TradeViewSet(viewsets.GenericViewSet):
    """Player-to-player trade proposals."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['POST'], url_path='propose-trade')
    def propose_trade(self, request):
        from terra_domini.apps.accounts.models import Player
        target_id = request.data.get('target_player_id')
        offer_resource = request.data.get('offer_resource', 'tdc')
        offer_amount = float(request.data.get('offer_amount', 0))
        request_resource = request.data.get('request_resource', 'food')
        request_amount = float(request.data.get('request_amount', 0))

        if not target_id:
            return Response({'error': 'target_player_id required'}, status=400)
        try:
            target = Player.objects.get(id=target_id, is_bot=False)
        except Player.DoesNotExist:
            return Response({'error': 'Player not found'}, status=404)

        # Store proposal (simplified — extend with TradeProposal model later)
        # For now just validate and return success
        return Response({
            'success': True,
            'proposal': {
                'from': request.user.username,
                'to': target.username,
                'offer': f'{offer_amount} {offer_resource}',
                'request': f'{request_amount} {request_resource}',
                'status': 'pending',
            }
        })

    @action(detail=False, methods=['GET'], url_path='proposals')
    def proposals(self, request):
        return Response({'incoming': [], 'outgoing': []})

    @action(detail=False, methods=['GET', 'POST'], url_path='trades')
    def trades(self, request):
        if request.method == 'GET':
            return Response({'results': [], 'count': 0})
        # POST = create trade proposal
        return self.propose_trade(request)

    @action(detail=True, methods=['POST'], url_path='accept')
    def accept_trade(self, request, pk=None):
        return Response({'success': True, 'status': 'accepted'})

    @action(detail=True, methods=['POST'], url_path='reject')
    def reject_trade(self, request, pk=None):
        return Response({'success': True, 'status': 'rejected'})
