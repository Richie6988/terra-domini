"""Progression views — streaks, daily missions, achievements, daily spin."""
from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from terra_domini.apps.progression.models import (
    PlayerStreak, PlayerDailyMission, Achievement,
    PlayerAchievement, DailySpinReward,
)


class ProgressionViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['POST'], url_path='login-streak')
    def login_streak(self, request):
        """Called on every login. Updates streak, returns reward."""
        streak, _ = PlayerStreak.objects.get_or_create(player=request.user)
        result = streak.check_and_update()

        if result['is_new'] and result['reward_tdc'] > 0:
            from django.db.models import F
            from terra_domini.apps.accounts.models import Player
            Player.objects.filter(id=request.user.id).update(
                tdc_in_game=F('tdc_in_game') + result['reward_tdc']
            )

        return Response({
            'streak': result,
            'current_streak': streak.current_streak,
            'longest_streak': streak.longest_streak,
            'shields': streak.streak_shields,
        })

    @action(detail=False, methods=['GET'], url_path='daily-missions')
    def daily_missions(self, request):
        """Get today's 3 daily missions. Auto-generates if none exist for today."""
        today = timezone.now().date()
        missions = PlayerDailyMission.objects.filter(
            player=request.user, date=today
        ).select_related('template').order_by('is_completed')

        # Auto-generate 3 missions if none exist for today
        if not missions.exists():
            from terra_domini.apps.progression.models import MissionTemplate
            import random as _r
            templates = list(MissionTemplate.objects.filter(is_active=True))
            _r.shuffle(templates)
            for tmpl in templates[:3]:
                target = _r.randint(tmpl.target_min, tmpl.target_max)
                reward = _r.randint(tmpl.reward_tdc_min, tmpl.reward_tdc_max)
                title  = tmpl.title_template.replace('{target}', str(target))
                try:
                    PlayerDailyMission.objects.create(
                        player=request.user, template=tmpl, date=today,
                        title=title, target_count=target,
                        reward_tdc=reward, reward_xp=tmpl.reward_xp,
                    )
                except Exception:
                    pass  # unique_together conflict — skip
            missions = PlayerDailyMission.objects.filter(
                player=request.user, date=today
            ).select_related('template').order_by('is_completed')

        return Response({
            'missions': [
                {
                    'id': str(m.id),
                    'title': m.title,
                    'icon': m.template.icon_emoji,
                    'target': m.target_count,
                    'current': m.current_count,
                    'progress_pct': m.progress_pct,
                    'reward_tdc': m.reward_tdc,
                    'reward_xp': m.reward_xp,
                    'completed': m.is_completed,
                    'claimed': m.is_claimed,
                }
                for m in missions
            ],
            'all_complete': all(m.is_completed for m in missions),
            'total_tdc_available': sum(m.reward_tdc for m in missions if not m.is_claimed),
        })

    @action(detail=True, methods=['POST'], url_path='claim-mission')
    def claim_mission(self, request, pk=None):
        """Claim reward for a completed mission."""
        try:
            mission = PlayerDailyMission.objects.get(
                id=pk, player=request.user, is_completed=True, is_claimed=False
            )
        except PlayerDailyMission.DoesNotExist:
            return Response({'error': 'Mission not found or not claimable'}, status=404)

        from django.db.models import F
        from terra_domini.apps.accounts.models import Player
        Player.objects.filter(id=request.user.id).update(
            tdc_in_game=F('tdc_in_game') + mission.reward_tdc,
            commander_xp=F('commander_xp') + mission.reward_xp,
        )
        mission.is_claimed = True
        mission.claimed_at = timezone.now()
        mission.save(update_fields=['is_claimed', 'claimed_at'])

        return Response({
            'claimed': True,
            'tdc_earned': mission.reward_tdc,
            'xp_earned': mission.reward_xp,
        })

    @action(detail=False, methods=['GET', 'POST'], url_path='daily-spin')
    def daily_spin(self, request):
        """GET: check today's spin. POST: spin and claim."""
        today = timezone.now().date()
        existing = DailySpinReward.objects.filter(player=request.user, date=today).first()

        if request.method == 'GET':
            if existing:
                return Response({
                    'spun_today': True,
                    'claimed': existing.claimed,
                    'reward': {
                        'tier': existing.tier,
                        'type': existing.reward_type,
                        'value': existing.reward_value,
                        'description': existing.reward_description,
                    } if existing.claimed else None,
                })
            return Response({'spun_today': False, 'available': True})

        # POST — spin
        if existing and existing.claimed:
            return Response({'error': 'Already spun today'}, status=400)

        if not existing:
            existing = DailySpinReward.generate_for_player(request.user, today)

        # Apply reward
        from django.db.models import F
        from terra_domini.apps.accounts.models import Player
        if existing.reward_type == 'tdc':
            Player.objects.filter(id=request.user.id).update(
                tdc_in_game=F('tdc_in_game') + existing.reward_value
            )

        existing.claimed = True
        existing.claimed_at = timezone.now()
        existing.save(update_fields=['claimed', 'claimed_at'])

        return Response({
            'tier': existing.tier,
            'reward_type': existing.reward_type,
            'reward_value': existing.reward_value,
            'description': existing.reward_description,
            'is_legendary': existing.tier == DailySpinReward.RewardTier.LEGENDARY,
        })

    @action(detail=False, methods=['GET'], url_path='achievements')
    def achievements(self, request):
        """List all achievements with unlock status."""
        all_achievements = Achievement.objects.all().order_by('category', 'tier')
        unlocked_ids = set(
            PlayerAchievement.objects.filter(player=request.user).values_list('achievement_id', flat=True)
        )

        return Response({
            'achievements': [
                {
                    'id': str(a.id),
                    'code': a.code,
                    'name': a.name if (not a.is_hidden or a.id in unlocked_ids) else '???',
                    'description': a.description if (not a.is_hidden or a.id in unlocked_ids) else 'Hidden achievement',
                    'icon': a.icon_emoji,
                    'category': a.category,
                    'tier': a.tier,
                    'reward_tdc': a.reward_tdc,
                    'unlocked': a.id in unlocked_ids,
                }
                for a in all_achievements
            ],
            'unlocked_count': len(unlocked_ids),
            'total_count': all_achievements.count(),
        })


class TutorialCompleteView(APIView):
    """POST /api/progression/tutorial-complete/ — grant 100 TDC for tutorial."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.db.models import F
        from terra_domini.apps.accounts.models import Player

        # Only grant once
        player = request.user
        if getattr(player, 'tutorial_completed', False):
            return Response({'already_claimed': True})

        Player.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + 100,
            tutorial_completed=True,
        )
        return Response({'tdc_granted': 100, 'message': 'Tutorial complete! +100 TDC 🎉'})


class SkillTreeView(generics.ListAPIView):
    """GET /api/progression/skills/ — full skill tree + player unlocks"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from terra_domini.apps.progression.models import SkillNode, PlayerSkill
        import json

        nodes = list(SkillNode.objects.all().values(
            'id','branch','name','effect','cost_json','position','icon'))
        unlocked = set(PlayerSkill.objects.filter(
            player=request.user).values_list('skill_id', flat=True))

        for n in nodes:
            n['unlocked'] = n['id'] in unlocked

        # Group by branch
        tree = {}
        for n in nodes:
            tree.setdefault(n['branch'], []).append(n)

        return Response({'tree': tree, 'unlocked_count': len(unlocked)})


class SkillUnlockView(generics.GenericAPIView):
    """POST /api/progression/skills/<id>/unlock/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from terra_domini.apps.progression.models import SkillNode, PlayerSkill
        try:
            skill = SkillNode.objects.get(pk=pk)
        except SkillNode.DoesNotExist:
            return Response({'error': 'Skill not found'}, status=404)

        if PlayerSkill.objects.filter(player=request.user, skill=skill).exists():
            return Response({'error': 'Already unlocked'}, status=400)

        # TODO: deduct resources (cost_json)
        PlayerSkill.objects.create(player=request.user, skill=skill)
        return Response({'ok': True, 'skill': skill.name})
