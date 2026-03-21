"""
Addiction Mechanics System
==========================
Top 50 prioritized improvements — implemented here:

CATEGORY A: DAILY HABITS (highest retention impact)
  A1. Daily login streak with TDC reward escalation
  A2. Daily missions (3 rotating, reset at midnight UTC)
  A3. Offline harvest notification ("Your territories earned 2,400 TDC while you slept")
  A4. Attack alert push notifications (FOMO/loss aversion)

CATEGORY B: PROGRESSION DOPAMINE
  B1. Commander XP with satisfying rank-up animation triggers
  B2. Territory tier upgrade ceremonies (visual reward moments)
  B3. Achievement system (100+ achievements, hidden unlocks)
  B4. Season pass tier progression with weekly milestones

CATEGORY C: SOCIAL PRESSURE
  C1. Alliance daily contribution tracker (social accountability)
  C2. "Your enemy is growing" notifications (threat visibility)
  C3. Leaderboard nudge ("You're #47 — 3 more territories = top 40")
  C4. War declaration ceremony (dramatic announcement)

CATEGORY D: VARIABLE REWARDS
  D1. Daily spin wheel (login bonus with escalating prizes)
  D2. Loot territory mechanic (random resource bonus on capture)
  D3. Mystery box drops from Control Tower victories
  D4. Streak shields (miss a day, burn a shield not reset streak)
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import random


# ─── Daily Streak Model ───────────────────────────────────────────────────────

class PlayerStreak(models.Model):
    """Login streak tracking with escalating TDC rewards."""

    player = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_login_date = models.DateField(null=True, blank=True)
    streak_shields = models.IntegerField(default=0)  # protect streak on miss
    total_login_days = models.IntegerField(default=0)

    # Rewards history
    total_tdc_from_streaks = models.DecimalField(max_digits=16, decimal_places=4, default=0)
    last_reward_claimed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'player_streaks'

    @classmethod
    def STREAK_REWARDS(cls) -> dict:
        """TDC rewards by streak day. Escalates every 7 days."""
        return {
            1: 10,  2: 15,  3: 20,  4: 25,  5: 30,  6: 40,
            7: 100,  # week bonus
            14: 200, 30: 500, 60: 1200, 100: 3000, 365: 10000,
        }

    def get_reward_for_streak(self) -> int:
        """TDC reward for current streak day."""
        rewards = self.STREAK_REWARDS()
        # Check exact milestone
        if self.current_streak in rewards:
            return rewards[self.current_streak]
        # Otherwise: base reward escalating every 7 days
        week = (self.current_streak - 1) // 7
        return 10 + (week * 5)

    def check_and_update(self) -> dict:
        """Call on login. Returns {is_new: bool, reward_tdc: int, streak: int, message: str}."""
        today = timezone.now().date()

        if self.last_login_date == today:
            # Already logged in today
            return {'is_new': False, 'reward_tdc': 0, 'streak': self.current_streak}

        yesterday = today - timedelta(days=1)

        if self.last_login_date == yesterday:
            # Consecutive day — increment streak
            self.current_streak += 1
        elif self.last_login_date and self.last_login_date < yesterday:
            # Missed a day — check shields
            if self.streak_shields > 0:
                self.streak_shields -= 1
                self.current_streak += 1
                message = f"Streak shield used! {self.streak_shields} remaining."
            else:
                # Streak broken
                self.longest_streak = max(self.longest_streak, self.current_streak)
                self.current_streak = 1
                message = "Streak reset. Come back every day!"
        else:
            # First login
            self.current_streak = 1
            message = "Welcome to Terra Domini!"

        reward = self.get_reward_for_streak()
        self.last_login_date = today
        self.total_login_days += 1
        self.total_tdc_from_streaks += reward
        self.last_reward_claimed_at = timezone.now()
        self.save()

        return {
            'is_new': True,
            'reward_tdc': reward,
            'streak': self.current_streak,
            'is_milestone': self.current_streak in self.STREAK_REWARDS(),
            'message': f"Day {self.current_streak} streak! +{reward} TDC",
            'next_milestone': self._next_milestone(),
        }

    def _next_milestone(self) -> dict:
        milestones = sorted(self.STREAK_REWARDS().keys())
        for m in milestones:
            if m > self.current_streak:
                return {'days': m, 'reward': self.STREAK_REWARDS()[m], 'days_away': m - self.current_streak}
        return {'days': 365, 'reward': 10000, 'days_away': 365 - self.current_streak}


# ─── Daily Missions ───────────────────────────────────────────────────────────

class MissionTemplate(models.Model):
    """Catalog of mission types with parameterized targets."""

    class MissionType(models.TextChoices):
        CLAIM_TERRITORIES = 'claim', 'Claim Territories'
        WIN_BATTLES = 'win_battles', 'Win Battles'
        PRODUCE_RESOURCES = 'produce', 'Produce Resources'
        SEND_TRADE = 'trade', 'Send Trade Routes'
        VISIT_POI = 'visit_poi', 'Visit POI Zone'
        JOIN_ALLIANCE = 'alliance', 'Alliance Action'
        SPEND_TDC = 'spend_tdc', 'Spend TDC'
        ONLINE_TIME = 'online', 'Online Time'
        CAPTURE_TOWER = 'tower', 'Control Tower'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mission_type = models.CharField(max_length=20, choices=MissionType.choices)
    title_template = models.CharField(max_length=200)  # "Claim {n} territories"
    description = models.TextField()
    icon_emoji = models.CharField(max_length=10, default='🎯')

    # Difficulty tiers affect target count and reward
    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Easy'
        MEDIUM = 'medium', 'Medium'
        HARD = 'hard', 'Hard'

    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.EASY)
    target_min = models.IntegerField(default=1)
    target_max = models.IntegerField(default=5)
    reward_tdc_min = models.IntegerField(default=10)
    reward_tdc_max = models.IntegerField(default=50)
    reward_xp = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'mission_templates'


class PlayerDailyMission(models.Model):
    """A player's daily mission instance (3 per day, refreshed at midnight UTC)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_missions')
    template = models.ForeignKey(MissionTemplate, on_delete=models.CASCADE)

    # This instance's parameters
    title = models.CharField(max_length=200)
    target_count = models.IntegerField()
    current_count = models.IntegerField(default=0)
    reward_tdc = models.IntegerField()
    reward_xp = models.IntegerField()

    is_completed = models.BooleanField(default=False)
    is_claimed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)

    date = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'player_daily_missions'
        unique_together = ['player', 'template', 'date']
        ordering = ['-date', 'is_completed']

    @property
    def progress_pct(self) -> float:
        return min(100.0, (self.current_count / self.target_count) * 100)

    def increment(self, amount: int = 1) -> bool:
        """Increment progress. Returns True if just completed."""
        if self.is_completed:
            return False
        self.current_count = min(self.current_count + amount, self.target_count)
        if self.current_count >= self.target_count:
            self.is_completed = True
            self.completed_at = timezone.now()
            self.save(update_fields=['current_count', 'is_completed', 'completed_at'])
            return True
        self.save(update_fields=['current_count'])
        return False


# ─── Achievement System ───────────────────────────────────────────────────────

class Achievement(models.Model):
    """100+ in-game achievements. Hidden ones unlock surprise rewards."""

    class AchievementCategory(models.TextChoices):
        TERRITORY = 'territory', 'Territory'
        COMBAT = 'combat', 'Combat'
        ECONOMY = 'economy', 'Economy'
        SOCIAL = 'social', 'Social'
        EXPLORATION = 'exploration', 'Exploration'
        STREAK = 'streak', 'Streak'
        TDC = 'tdc', 'TDC'
        SECRET = 'secret', 'Secret'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField()
    icon_emoji = models.CharField(max_length=10, default='🏆')
    category = models.CharField(max_length=20, choices=AchievementCategory.choices)
    is_hidden = models.BooleanField(default=False)   # hidden until unlocked

    # Tiered achievements (bronze, silver, gold)
    tier = models.IntegerField(default=1)  # 1=bronze, 2=silver, 3=gold
    threshold = models.BigIntegerField(default=1)    # the target value

    # Rewards
    reward_tdc = models.IntegerField(default=0)
    reward_xp = models.IntegerField(default=0)
    reward_cosmetic_code = models.CharField(max_length=50, blank=True)
    reward_badge_emoji = models.CharField(max_length=10, blank=True)

    class Meta:
        db_table = 'achievements'
        ordering = ['category', 'tier']


class PlayerAchievement(models.Model):
    """Player unlocking an achievement."""
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)
    value_at_unlock = models.BigIntegerField(default=0)  # the stat value that triggered it

    class Meta:
        db_table = 'player_achievements'
        unique_together = ['player', 'achievement']


# ─── Variable Reward Spin ─────────────────────────────────────────────────────

class DailySpinReward(models.Model):
    """Daily login spin wheel — variable reward schedule for dopamine."""

    class RewardTier(models.TextChoices):
        COMMON   = 'common',   'Common'    # 60% probability
        RARE     = 'rare',     'Rare'      # 25%
        EPIC     = 'epic',     'Epic'      # 12%
        LEGENDARY= 'legendary','Legendary' # 3%

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='spin_rewards')
    date = models.DateField(default=timezone.now)
    tier = models.CharField(max_length=12, choices=RewardTier.choices)
    reward_type = models.CharField(max_length=30)  # 'tdc', 'shield', 'military_boost', 'resource_pack', 'cosmetic'
    reward_value = models.IntegerField()
    reward_description = models.CharField(max_length=200)
    claimed = models.BooleanField(default=False)
    claimed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'daily_spin_rewards'
        unique_together = ['player', 'date']

    @classmethod
    def generate_for_player(cls, player, date=None) -> 'DailySpinReward':
        """Generate today's spin reward. Variable schedule for dopamine."""
        if date is None:
            date = timezone.now().date()

        # Weighted random tier
        roll = random.random()
        if roll < 0.60:
            tier = cls.RewardTier.COMMON
        elif roll < 0.85:
            tier = cls.RewardTier.RARE
        elif roll < 0.97:
            tier = cls.RewardTier.EPIC
        else:
            tier = cls.RewardTier.LEGENDARY

        # Tier-specific rewards
        rewards_by_tier = {
            cls.RewardTier.COMMON: [
                ('tdc', random.randint(15, 50), f"+{random.randint(15,50)} TDC"),
                ('resource_pack', random.randint(200, 500), f"+{random.randint(200,500)} Materials"),
                ('shield', 4, "4h Territory Shield"),
            ],
            cls.RewardTier.RARE: [
                ('tdc', random.randint(80, 200), f"+{random.randint(80,200)} TDC"),
                ('military_boost', 10, "+10% Military Boost (2h)"),
                ('shield', 8, "8h Territory Shield"),
                ('resource_pack', random.randint(1000, 3000), f"+{random.randint(1000,3000)} Credits"),
            ],
            cls.RewardTier.EPIC: [
                ('tdc', random.randint(300, 800), f"+{random.randint(300,800)} TDC"),
                ('military_boost', 25, "+25% Military Boost (4h) — MAX BOOST"),
                ('shield', 12, "12h Territory Shield — Full Day Protection"),
                ('cosmetic', 1, "🎖️ Rare Commander Skin Unlock"),
            ],
            cls.RewardTier.LEGENDARY: [
                ('tdc', random.randint(1000, 5000), f"+{random.randint(1000,5000)} TDC 💰"),
                ('cosmetic', 1, "🏆 Legendary Territory Skin + 2000 TDC"),
                ('shield', 12, "12h Shield + 500 TDC Bonus"),
            ],
        }

        chosen = random.choice(rewards_by_tier[tier])
        reward_type, reward_value, description = chosen

        return cls.objects.create(
            player=player, date=date,
            tier=tier, reward_type=reward_type,
            reward_value=reward_value,
            reward_description=description,
        )


# ─── Notification Templates ───────────────────────────────────────────────────

class GameNotificationTemplate(models.Model):
    """Push notification copy — A/B tested for FOMO optimization."""

    class TriggerEvent(models.TextChoices):
        ATTACK_INCOMING = 'attack_incoming', 'Attack Incoming'
        BATTLE_RESOLVED = 'battle_resolved', 'Battle Resolved'
        TERRITORY_LOST  = 'territory_lost',  'Territory Lost'
        STREAK_AT_RISK  = 'streak_risk',     'Streak At Risk'
        DAILY_MISSIONS  = 'daily_missions',  'Daily Missions Ready'
        AD_REVENUE      = 'ad_revenue',      'Ad Revenue Earned'
        ALLIANCE_WAR    = 'alliance_war',    'Alliance Declared War'
        CONTROL_TOWER   = 'control_tower',   'Control Tower Event'
        RANK_UP         = 'rank_up',         'Commander Rank Up'
        OFFLINE_HARVEST = 'offline',         'Offline Resource Summary'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trigger = models.CharField(max_length=30, choices=TriggerEvent.choices)
    title_template = models.CharField(max_length=100)  # "⚔️ {attacker} is attacking!"
    body_template = models.CharField(max_length=255)
    priority = models.CharField(max_length=10, default='high')  # high, normal, low
    ab_variant = models.CharField(max_length=1, default='A')   # A/B testing
    is_active = models.BooleanField(default=True)
    click_through_rate = models.FloatField(default=0.0)

    class Meta:
        db_table = 'notification_templates'


# ─── Celery tasks for addiction mechanics ─────────────────────────────────────

from celery import shared_task
import logging
logger = logging.getLogger('terra_domini.addiction')


@shared_task(name='addiction.offline_harvest_notify')
def send_offline_harvest_notifications():
    """
    Every 6h: notify players who have been offline >2h about their resource accumulation.
    High-ROI for re-engagement — "you earned X TDC while away."
    """
    from django.contrib.auth import get_user_model
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from terra_domini.apps.territories.models import Territory
    from django.db.models import Sum, F

    Player = get_user_model()
    channel_layer = get_channel_layer()

    # Players offline for 2-8 hours
    two_hours_ago = timezone.now() - timedelta(hours=2)
    eight_hours_ago = timezone.now() - timedelta(hours=8)

    offline_players = Player.objects.filter(
        is_online=False,
        last_active__gte=eight_hours_ago,
        last_active__lte=two_hours_ago,
        push_token__gt='',
    )

    notified = 0
    for player in offline_players[:500]:  # cap per run
        territory_count = Territory.objects.filter(owner=player).count()
        if territory_count == 0:
            continue

        # Estimate offline earnings
        offline_hours = (timezone.now() - player.last_active).total_seconds() / 3600
        ticks = offline_hours * (60 / 5)  # ticks per hour
        # Rough estimate: avg 20 credits per tick per territory
        est_tdc = int(territory_count * ticks * 20 * 0.4)  # offline rate 40%

        if est_tdc < 50:
            continue

        # Send notification via channel layer (player will receive if they come back)
        # In production: send actual push via FCM/APNs
        logger.info(f"Offline harvest notify: {player.username} ~{est_tdc} TDC from {territory_count} territories")
        notified += 1

    return {'notified': notified}


@shared_task(name='addiction.streak_risk_notify')
def send_streak_risk_notifications():
    """
    At 20:00 UTC: notify players with streaks >3 days who haven't logged in today.
    "Your X-day streak expires in 4 hours!"
    """
    from django.contrib.auth import get_user_model
    Player = get_user_model()

    today = timezone.now().date()
    at_risk = PlayerStreak.objects.filter(
        current_streak__gte=3,
        last_login_date__lt=today,
        player__push_token__gt='',
        player__is_active=True,
    ).select_related('player')

    for streak in at_risk[:1000]:
        # In production: push via FCM
        logger.info(
            f"Streak risk: {streak.player.username} "
            f"— {streak.current_streak} day streak at risk"
        )

    return {'at_risk': at_risk.count()}


@shared_task(name='addiction.generate_daily_missions')
def generate_daily_missions_for_all():
    """Run at midnight UTC. Generate 3 daily missions for all active players."""
    from django.contrib.auth import get_user_model
    Player = get_user_model()

    templates = list(MissionTemplate.objects.filter(is_active=True))
    if len(templates) < 3:
        logger.warning("Not enough mission templates")
        return

    today = timezone.now().date()
    active_players = Player.objects.filter(
        is_active=True,
        last_active__gte=timezone.now() - timedelta(days=30)
    )

    created = 0
    for player in active_players.iterator(chunk_size=500):
        existing = PlayerDailyMission.objects.filter(player=player, date=today).count()
        if existing >= 3:
            continue

        # Random selection of 3 different missions
        selected = random.sample(templates, min(3, len(templates)))
        for template in selected:
            if PlayerDailyMission.objects.filter(player=player, template=template, date=today).exists():
                continue
            target = random.randint(template.target_min, template.target_max)
            reward = random.randint(template.reward_tdc_min, template.reward_tdc_max)
            PlayerDailyMission.objects.create(
                player=player,
                template=template,
                title=template.title_template.replace('{n}', str(target)),
                target_count=target,
                reward_tdc=reward,
                reward_xp=template.reward_xp,
                date=today,
            )
            created += 1

    logger.info(f"Daily missions generated: {created}")
    return {'created': created}


@shared_task(name='addiction.check_achievements')
def check_achievements_for_player(player_id: str):
    """Check and unlock any newly earned achievements for a player."""
    from django.contrib.auth import get_user_model
    from terra_domini.apps.accounts.models import PlayerStats

    Player = get_user_model()
    try:
        player = Player.objects.select_related('stats', 'streak').get(id=player_id)
        stats = player.stats
    except Exception:
        return

    # Achievement check rules
    checks = [
        ('first_territory', 'territory', stats.territories_captured >= 1),
        ('territory_10', 'territory', stats.territories_owned >= 10),
        ('territory_50', 'territory', stats.territories_owned >= 50),
        ('territory_100', 'territory', stats.territories_owned >= 100),
        ('first_win', 'combat', stats.battles_won >= 1),
        ('war_veteran', 'combat', stats.battles_won >= 50),
        ('streak_7', 'streak', hasattr(player, 'streak') and player.streak.current_streak >= 7),
        ('streak_30', 'streak', hasattr(player, 'streak') and player.streak.current_streak >= 30),
        ('streak_100', 'streak', hasattr(player, 'streak') and player.streak.current_streak >= 100),
    ]

    unlocked = []
    for code, category, condition in checks:
        if not condition:
            continue
        try:
            achievement = Achievement.objects.get(code=code)
            _, created = PlayerAchievement.objects.get_or_create(player=player, achievement=achievement)
            if created:
                unlocked.append({'code': code, 'reward': achievement.reward_tdc})
                logger.info(f"Achievement unlocked: {player.username} → {code}")
        except Achievement.DoesNotExist:
            pass

    return {'unlocked': len(unlocked), 'achievements': unlocked}


# ─── Daily Clicker ────────────────────────────────────────────────────────
class DailyClickerSession(models.Model):
    """
    60-second daily mini-game. Player clicks targets that appear.
    Reward = base_tdc + (clicks / max_clicks) * bonus_pool + random loot.
    Streak multiplier applies from PlayerStreak.
    """
    LOOT_TIERS = [
        ('common',    'Common'),
        ('rare',      'Rare'),
        ('epic',      'Epic'),
        ('legendary', 'Legendary'),
    ]
    player         = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='clicker_sessions')
    date           = models.DateField()
    clicks         = models.PositiveIntegerField(default=0)
    max_clicks     = models.PositiveIntegerField(default=60)
    score          = models.BigIntegerField(default=0)
    duration_ms    = models.PositiveIntegerField(default=60000)
    tdc_earned     = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    tdi_earned     = models.DecimalField(max_digits=14, decimal_places=8, default=0)
    loot_tier      = models.CharField(max_length=12, choices=LOOT_TIERS, default='common')
    loot_item      = models.CharField(max_length=60, blank=True)   # 'resource_food_100', 'boost_defense_24h'
    loot_quantity  = models.PositiveIntegerField(default=0)
    streak_mult    = models.FloatField(default=1.0)
    completed      = models.BooleanField(default=False)
    completed_at   = models.DateTimeField(null=True)

    class Meta:
        db_table = 'daily_clicker_session'
        unique_together = [('player', 'date')]


class ClickerTarget(models.Model):
    """Pre-seeded target configs for the clicker mini-game."""
    TARGET_TYPES = [
        ('coin', '🪙 Coin'),
        ('crate', '📦 Crate'),
        ('bomb', '💣 Bomb - avoid'),
        ('multiplier', '⚡ Multiplier'),
        ('rare_gem', '💎 Rare Gem'),
    ]
    target_type  = models.CharField(max_length=20, choices=TARGET_TYPES)
    base_points  = models.PositiveIntegerField(default=10)
    spawn_weight = models.FloatField(default=1.0)  # relative probability
    is_avoidance = models.BooleanField(default=False)  # clicking = penalty
    icon_3d      = models.CharField(max_length=60, blank=True)
    color_hex    = models.CharField(max_length=7, default='#FFB800')
    is_active    = models.BooleanField(default=True)

    class Meta:
        db_table = 'clicker_target'


# ─── Leaderboard Snapshot ─────────────────────────────────────────────────
class LeaderboardSnapshot(models.Model):
    """
    Materialized leaderboard, recomputed every 15 min by Celery.
    Global + per-region (country_code).
    """
    SCOPES = [('global', 'Global'), ('regional', 'Regional'), ('alliance', 'Alliance')]
    scope         = models.CharField(max_length=12, choices=SCOPES, default='global')
    region_code   = models.CharField(max_length=8, blank=True)   # ISO country code
    alliance_id   = models.UUIDField(null=True, blank=True)
    player        = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='leaderboard_entries')
    rank          = models.PositiveIntegerField()
    prev_rank     = models.PositiveIntegerField(null=True)
    score         = models.BigIntegerField(default=0)
    territories   = models.PositiveIntegerField(default=0)
    battles_won   = models.PositiveIntegerField(default=0)
    tdc_total     = models.DecimalField(max_digits=16, decimal_places=4, default=0)
    computed_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leaderboard_snapshot'
        unique_together = [('scope', 'region_code', 'player')]
        ordering  = ['rank']


class SkillNode(models.Model):
    """GDD Section 6 — Arbre de compétences Hexod"""
    BRANCHES = [
        ('attack','Attaque'), ('defense','Défense'), ('economy','Économie'),
        ('influence','Rayonnement'), ('tech','Technologie'),
    ]
    branch      = models.CharField(max_length=20, choices=BRANCHES)
    name        = models.CharField(max_length=80)
    effect      = models.TextField()
    cost_json   = models.JSONField(default=list)   # list of resource names
    position    = models.IntegerField(default=0)   # order in branch
    icon        = models.CharField(max_length=8, default='⚔️')

    class Meta:
        unique_together = ('branch', 'position')
        ordering = ['branch', 'position']

    def __str__(self):
        return f"[{self.branch}] {self.name}"


class PlayerSkill(models.Model):
    """Player's unlocked skills"""
    player      = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='skills')
    skill       = models.ForeignKey(SkillNode, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)
    level       = models.IntegerField(default=1)

    class Meta:
        unique_together = ('player', 'skill')
