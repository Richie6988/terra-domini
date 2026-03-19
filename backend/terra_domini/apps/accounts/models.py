"""
Player model — custom Django user with game-specific fields.
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class PlayerManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra):
        if not email:
            raise ValueError("Email required")
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, username, password, **extra)


class Player(AbstractBaseUser, PermissionsMixin):
    # ─── Identity ─────────────────────────────────────────────────────────────
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=32, unique=True, db_index=True)
    display_name = models.CharField(max_length=64, blank=True)
    avatar_url = models.URLField(blank=True)

    # ─── Django auth fields ───────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    email_verified = models.BooleanField(default=False)

    # ─── Game progression ─────────────────────────────────────────────────────
    class CommanderRank(models.IntegerChoices):
        RECRUIT = 1
        SOLDIER = 5
        SERGEANT = 10
        LIEUTENANT = 20
        CAPTAIN = 30
        MAJOR = 40
        COLONEL = 60
        GENERAL = 80
        MARSHAL = 100

    class SpecPath(models.TextChoices):
        MILITARY = 'military', 'Military'
        ECONOMIC = 'economic', 'Economic'
        DIPLOMATIC = 'diplomatic', 'Diplomatic'
        SCIENTIFIC = 'scientific', 'Scientific'

    commander_rank = models.PositiveSmallIntegerField(default=1)
    commander_xp = models.BigIntegerField(default=0)
    spec_path = models.CharField(max_length=20, choices=SpecPath.choices, default=SpecPath.MILITARY)

    # ─── Wallet ───────────────────────────────────────────────────────────────
    wallet_address = models.CharField(max_length=42, blank=True, db_index=True)
    tdc_in_game = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    total_tdc_purchased = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    total_tdc_spent = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    total_tdc_earned_ads = models.DecimalField(max_digits=20, decimal_places=6, default=0)

    # ─── Status / anti-cheat ──────────────────────────────────────────────────
    class BanStatus(models.TextChoices):
        CLEAN = 'clean', 'Clean'
        WARNING = 'warning', 'Warning'
        SUSPENDED = 'suspended', 'Suspended (temp)'
        BANNED = 'banned', 'Banned'

    ban_status = models.CharField(max_length=12, choices=BanStatus.choices, default=BanStatus.CLEAN)
    ban_reason = models.TextField(blank=True)
    ban_until = models.DateTimeField(null=True, blank=True)
    anticheat_score = models.FloatField(default=0.0)  # 0-1, higher = more suspicious

    # ─── Session tracking ─────────────────────────────────────────────────────
    last_active = models.DateTimeField(null=True, blank=True)
    last_ip = models.GenericIPAddressField(null=True, blank=True)
    total_playtime_seconds = models.BigIntegerField(default=0)
    is_online = models.BooleanField(default=False)

    # ─── Protection ───────────────────────────────────────────────────────────
    shield_until = models.DateTimeField(null=True, blank=True)
    beginner_protection_until = models.DateTimeField(null=True, blank=True)
    daily_shield_hours_used = models.FloatField(default=0.0)
    shield_reset_date = models.DateField(null=True, blank=True)

    # ─── Preferences ──────────────────────────────────────────────────────────
    preferred_language = models.CharField(max_length=5, default='en')
    notifications_enabled = models.BooleanField(default=True)
    push_token = models.CharField(max_length=512, blank=True)
    tutorial_completed = models.BooleanField(default=False)

    objects = PlayerManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'players'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['wallet_address']),
            models.Index(fields=['is_online', 'last_active']),
            models.Index(fields=['ban_status']),
        ]

    def __str__(self):
        return f"{self.username} (rank {self.commander_rank})"

    @property
    def is_protected(self) -> bool:
        """True if player cannot be attacked."""
        now = timezone.now()
        if self.beginner_protection_until and now < self.beginner_protection_until:
            return True
        if self.shield_until and now < self.shield_until:
            return True
        return False

    @property
    def is_banned(self) -> bool:
        now = timezone.now()
        if self.ban_status == self.BanStatus.BANNED:
            return True
        if self.ban_status == self.BanStatus.SUSPENDED:
            return self.ban_until and now < self.ban_until
        return False


class PlayerStats(models.Model):
    """Denormalized stats for fast leaderboard queries."""
    player = models.OneToOneField(Player, on_delete=models.CASCADE, related_name='stats')

    # Territory
    territories_owned = models.IntegerField(default=0)
    max_territories_owned = models.IntegerField(default=0)
    territories_captured = models.IntegerField(default=0)
    territories_lost = models.IntegerField(default=0)

    # Combat
    battles_fought = models.IntegerField(default=0)
    battles_won = models.IntegerField(default=0)
    battles_lost = models.IntegerField(default=0)
    units_killed = models.BigIntegerField(default=0)
    units_lost = models.BigIntegerField(default=0)

    # Economy
    resources_produced = models.JSONField(default=dict)  # {resource_type: amount}
    resources_traded = models.BigIntegerField(default=0)

    # Social
    alliances_formed = models.IntegerField(default=0)
    diplomacy_actions = models.IntegerField(default=0)

    # Season stats (reset quarterly)
    season_score = models.BigIntegerField(default=0)
    season_rank = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'player_stats'


class PlayerDevice(models.Model):
    """Anti-cheat device fingerprinting."""
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='devices')
    fingerprint = models.CharField(max_length=256, db_index=True)
    platform = models.CharField(max_length=20)  # web, ios, android
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'player_devices'
        unique_together = ['player', 'fingerprint']
