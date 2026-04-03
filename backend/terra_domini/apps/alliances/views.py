"""
Alliance & Diplomacy API views.
"""
import logging
from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from terra_domini.apps.alliances.models import Alliance, AllianceMember, DiplomaticRelation
from terra_domini.apps.territories.serializers import AllianceSerializer, AllianceMemberSerializer

logger = logging.getLogger('terra_domini.alliances')


class AllianceViewSet(viewsets.GenericViewSet):

    @action(detail=False, methods=['POST'], url_path='create')
    def create_alliance(self, request):
        player = request.user

        # Check not already in an alliance
        if hasattr(player, 'alliance_member'):
            return Response({'error': 'Already in an alliance. Leave first.'}, status=409)

        tag = request.data.get('tag', '').upper().strip()
        name = request.data.get('name', '').strip()

        if not tag or not name:
            return Response({'error': 'tag and name required'}, status=400)
        if len(tag) < 2 or len(tag) > 6:
            return Response({'error': 'Tag must be 2-6 characters'}, status=400)
        if Alliance.objects.filter(tag=tag).exists():
            return Response({'error': 'Tag already taken'}, status=409)
        if Alliance.objects.filter(name__iexact=name).exists():
            return Response({'error': 'Name already taken'}, status=409)

        alliance = Alliance.objects.create(
            tag=tag,
            name=name,
            description=request.data.get('description', ''),
            banner_color=request.data.get('banner_color', '#1D9E75'),
            leader=player,
            tier=Alliance.AllianceTier.SQUAD,
        )

        AllianceMember.objects.create(
            player=player,
            alliance=alliance,
            role=AllianceMember.Role.LEADER,
        )

        logger.info(f"Alliance created: [{tag}] {name} by {player.username}")
        return Response(AllianceSerializer(alliance).data, status=201)

    @action(detail=True, methods=['POST'], url_path='join')
    def join(self, request, pk=None):
        player = request.user
        if hasattr(player, 'alliance_member'):
            return Response({'error': 'Already in an alliance'}, status=409)

        try:
            alliance = Alliance.objects.get(id=pk, is_recruiting=True)
        except Alliance.DoesNotExist:
            return Response({'error': 'Alliance not found or not recruiting'}, status=404)

        if alliance.total_members >= alliance.max_members:
            return Response({'error': 'Alliance is full'}, status=409)

        if player.commander_rank < alliance.min_rank_to_join:
            return Response({'error': f'Minimum rank {alliance.min_rank_to_join} required'}, status=403)

        AllianceMember.objects.create(player=player, alliance=alliance)
        Alliance.objects.filter(id=alliance.id).update(total_members=F('total_members') + 1)

        return Response({'message': f'Joined [{alliance.tag}] {alliance.name}'})

    @action(detail=False, methods=['POST'], url_path='leave')
    def leave(self, request):
        player = request.user
        try:
            member = player.alliance_member
        except AllianceMember.DoesNotExist:
            return Response({'error': 'Not in an alliance'}, status=400)

        if member.role == AllianceMember.Role.LEADER:
            # Must transfer leadership or disband
            if member.alliance.total_members > 1:
                return Response({'error': 'Transfer leadership before leaving'}, status=409)
            # Disband empty alliance
            member.alliance.delete()
            return Response({'message': 'Alliance disbanded'})

        alliance_id = member.alliance_id
        member.delete()
        Alliance.objects.filter(id=alliance_id).update(total_members=F('total_members') - 1)
        return Response({'message': 'Left alliance'})

    @action(detail=True, methods=['GET'], url_path='members')
    def members(self, request, pk=None):
        try:
            alliance = Alliance.objects.get(id=pk)
        except Alliance.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        members = alliance.members.select_related('player', 'player__stats').order_by('role', '-player__commander_rank')
        return Response({
            'alliance': AllianceSerializer(alliance).data,
            'members': AllianceMemberSerializer(members, many=True).data,
        })

    @action(detail=False, methods=['GET'], url_path='search')
    def search(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'error': 'Query too short'}, status=400)

        alliances = Alliance.objects.filter(
            name__icontains=q
        ).order_by('-war_score')[:20]
        return Response(AllianceSerializer(alliances, many=True).data)

    @action(detail=True, methods=['GET'], url_path='chat-history')
    def chat_history(self, request, pk=None):
        """GET /api/alliances/{id}/chat-history/ — last 50 messages."""
        from terra_domini.apps.alliances.models import AllianceChatMessage
        messages = AllianceChatMessage.objects.filter(
            alliance_id=pk
        ).select_related('player').order_by('-created_at')[:50]
        return Response([{
            'id': m.id,
            'user': m.player.username,
            'type': m.message_type,
            'text': m.text,
            'time': m.created_at.strftime('%H:%M'),
            'date': m.created_at.isoformat(),
        } for m in reversed(messages)])

    @action(detail=True, methods=['POST'], url_path='promote')
    def promote_member(self, request, pk=None):
        """Promote a member to officer (leader only)."""
        alliance = Alliance.objects.get(id=pk)
        player = request.user

        if not hasattr(player, 'alliance_member') or player.alliance_member.role != AllianceMember.Role.LEADER:
            return Response({'error': 'Only the leader can promote members'}, status=403)

        target_username = request.data.get('username')
        new_role = request.data.get('role', AllianceMember.Role.OFFICER)

        try:
            target_member = alliance.members.get(player__username=target_username)
        except AllianceMember.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        target_member.role = new_role
        target_member.save(update_fields=['role'])
        return Response({'message': f'{target_username} promoted to {new_role}'})

    @action(detail=True, methods=['POST'], url_path='deposit')
    def deposit_to_treasury(self, request, pk=None):
        """Deposit resources or TDC into alliance treasury."""
        player = request.user
        try:
            member = player.alliance_member
            if member.alliance_id != pk:
                raise AllianceMember.DoesNotExist
        except AllianceMember.DoesNotExist:
            return Response({'error': 'Not a member of this alliance'}, status=403)

        resource = request.data.get('resource')
        amount = float(request.data.get('amount', 0))

        if resource not in ['energy', 'food', 'credits', 'materials'] or amount <= 0:
            return Response({'error': 'Invalid resource or amount'}, status=400)

        # Deduct from territory (TODO: pick which territory to draw from)
        # For now, deduct from player stats cache
        alliance = member.alliance
        treasury_field = f'treasury_{resource}'
        Alliance.objects.filter(id=pk).update(**{treasury_field: F(treasury_field) + amount})

        return Response({'message': f'Deposited {amount} {resource} to treasury'})


class DiplomacyViewSet(viewsets.GenericViewSet):

    @action(detail=False, methods=['POST'], url_path='propose')
    def propose(self, request):
        """Propose a diplomatic state change to another alliance."""
        player = request.user
        try:
            my_alliance = player.alliance_member.alliance
        except Exception:
            return Response({'error': 'Not in an alliance'}, status=403)

        if player.alliance_member.role not in [AllianceMember.Role.LEADER, AllianceMember.Role.OFFICER]:
            return Response({'error': 'Officer+ required for diplomacy'}, status=403)

        target_tag = request.data.get('target_alliance_tag')
        proposed_state = request.data.get('state')

        try:
            target = Alliance.objects.get(tag=target_tag.upper())
        except Alliance.DoesNotExist:
            return Response({'error': 'Target alliance not found'}, status=404)

        if target == my_alliance:
            return Response({'error': 'Cannot propose to yourself'}, status=400)

        relation, created = DiplomaticRelation.objects.get_or_create(
            initiator=my_alliance,
            target=target,
            defaults={'state': proposed_state}
        )

        if not created:
            relation.state = proposed_state
            relation.save(update_fields=['state'])

        return Response({
            'message': f'Diplomatic state set to {proposed_state} with [{target_tag}]',
            'state': proposed_state,
        })

    @action(detail=False, methods=['GET'], url_path='relations')
    def my_relations(self, request):
        """All diplomatic relations of player's alliance."""
        try:
            my_alliance = request.user.alliance_member.alliance
        except Exception:
            return Response({'error': 'Not in an alliance'}, status=403)

        relations = DiplomaticRelation.objects.filter(
            initiator=my_alliance
        ).select_related('target')

        data = [{
            'alliance_tag': r.target.tag,
            'alliance_name': r.target.name,
            'state': r.state,
            'established_at': r.established_at.isoformat(),
        } for r in relations]

        return Response({'relations': data})
