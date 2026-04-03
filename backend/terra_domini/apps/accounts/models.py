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
    avatar_emoji = models.CharField(max_length=8, default='🎖️', blank=True)
    bio           = models.TextField(max_length=500, blank=True, default='')
    avatar_url = models.URLField(blank=True)

    # ─── Django auth fields ───────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    email_verified = models.BooleanField(default=False)
    email_verification_code = models.CharField(max_length=6, blank=True, default='')
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    # ─── Initial geolocation (from GeoIP on registration) ───────────────────
    initial_lat = models.FloatField(null=True, blank=True)
    initial_lon = models.FloatField(null=True, blank=True)
    initial_country = models.CharField(max_length=64, blank=True, default='')

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


    # ── Action Stamina System ──────────────────────────────────────────────
    # Each attack costs 1 action slot. Slots regenerate over 24h (or faster with bonuses).
    # Base: 3 slots, max 10 with upgrades. Full regen = 24h / max_action_slots per slot.
    action_slots_max     = models.PositiveSmallIntegerField(default=3)   # max concurrent attacks
    action_slots_used    = models.PositiveSmallIntegerField(default=0)   # currently in use
    last_slot_regen_at   = models.DateTimeField(null=True, blank=True)   # last regen tick
    regen_bonus_pct      = models.FloatField(default=0.0)                # % faster regen (from boosts)
    attack_power_bonus   = models.FloatField(default=0.0)                # % bonus to attack strength
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
    is_bot = models.BooleanField(default=False, db_index=True)

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


    # ── Stamina helpers ────────────────────────────────────────────────────
    @property
    def regen_seconds_per_slot(self) -> float:
        """Time to regenerate 1 action slot. Base 24h, faster with bonuses."""
        base = 86400.0 / max(1, self.action_slots_max)  # 24h / max_slots
        return base / (1 + self.regen_bonus_pct / 100)

    @property
    def action_slots_available(self) -> int:
        """Slots currently available (auto-regens on access)."""
        self._apply_regen()
        return max(0, self.action_slots_max - self.action_slots_used)

    @property
    def next_slot_ready_in_seconds(self) -> float:
        """Seconds until next slot is available (0 if slots free)."""
        if self.action_slots_available > 0:
            return 0.0
        if not self.last_slot_regen_at:
            return 0.0
        from django.utils import timezone
        elapsed = (timezone.now() - self.last_slot_regen_at).total_seconds()
        remaining = self.regen_seconds_per_slot - elapsed
        return max(0.0, remaining)

    @property
    def regen_progress_pct(self) -> float:
        """0-100 progress toward next slot regen."""
        if not self.last_slot_regen_at or self.action_slots_used == 0:
            return 100.0
        from django.utils import timezone
        elapsed = (timezone.now() - self.last_slot_regen_at).total_seconds()
        return min(100.0, (elapsed / self.regen_seconds_per_slot) * 100)

    def _apply_regen(self):
        """Called on read — silently regens slots if enough time has passed."""
        if self.action_slots_used == 0 or not self.last_slot_regen_at:
            return
        from django.utils import timezone
        now = timezone.now()
        elapsed = (now - self.last_slot_regen_at).total_seconds()
        slots_to_regen = int(elapsed // self.regen_seconds_per_slot)
        if slots_to_regen > 0:
            from django.apps import apps
            Player = apps.get_model('accounts', 'Player')
            new_used = max(0, self.action_slots_used - slots_to_regen)
            new_regen_at = self.last_slot_regen_at
            if new_used < self.action_slots_used:
                # Advance regen timer by consumed slots
                import datetime
                new_regen_at = self.last_slot_regen_at + datetime.timedelta(
                    seconds=slots_to_regen * self.regen_seconds_per_slot
                )
            Player.objects.filter(pk=self.pk).update(
                action_slots_used=new_used,
                last_slot_regen_at=new_regen_at,
            )
            self.action_slots_used = new_used
            self.last_slot_regen_at = new_regen_at

    def consume_action_slot(self) -> bool:
        """Try to use 1 slot. Returns True if successful, False if exhausted."""
        from django.utils import timezone
        from django.apps import apps
        Player = apps.get_model('accounts', 'Player')
        self._apply_regen()
        if self.action_slots_used >= self.action_slots_max:
            return False
        now = timezone.now()
        first_use = self.action_slots_used == 0
        Player.objects.filter(pk=self.pk).update(
            action_slots_used=self.action_slots_used + 1,
            last_slot_regen_at=now if first_use else self.last_slot_regen_at,
        )
        self.action_slots_used += 1
        if first_use:
            self.last_slot_regen_at = now
        return True

    def release_action_slot(self):
        """Called when a battle completes — frees 1 slot immediately."""
        from django.apps import apps
        Player = apps.get_model('accounts', 'Player')
        new_used = max(0, self.action_slots_used - 1)
        Player.objects.filter(pk=self.pk).update(action_slots_used=new_used)
        self.action_slots_used = new_used

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


class FavoritePin(models.Model):
    """Player-saved map locations for quick teleport."""
    player    = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='pins')
    name      = models.CharField(max_length=120, default='📍 Saved Location')
    emoji     = models.CharField(max_length=4, default='📍')
    lat       = models.FloatField()
    lon       = models.FloatField()
    zoom      = models.IntegerField(default=15)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'favorite_pins'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.player.username}: {self.name} ({self.lat:.4f}, {self.lon:.4f})"
