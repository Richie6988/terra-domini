"""
seed_bots — Populate game with bot players and a starter alliance.

Usage:
  python manage.py seed_bots              # 20 bots + 1 alliance
  python manage.py seed_bots --count 50   # 50 bots
"""
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

Player = get_user_model()

BOT_NAMES = [
    'IRON_HAWK', 'SHADOW_VIPER', 'CRIMSON_WOLF', 'CYBER_PHOENIX', 'DARK_TITAN',
    'FROST_RAVEN', 'GOLDEN_SERPENT', 'JADE_EMPRESS', 'NEXUS_LORD', 'OBSIDIAN_KING',
    'PLASMA_GHOST', 'QUANTUM_FOX', 'RUBY_DRAGON', 'SILVER_STORM', 'THUNDER_BEAR',
    'ULTRA_REAPER', 'VOID_HUNTER', 'WARP_KNIGHT', 'XENON_BLADE', 'ZERO_FALCON',
    'ALPHA_STRIKE', 'BETA_CORE', 'DELTA_FORCE', 'ECHO_PRIME', 'GAMMA_RAY',
    'HELIX_DRONE', 'ION_SPARK', 'KRYPTON_ACE', 'LUNAR_SHADE', 'MARS_RIDER',
    'NOVA_BLAST', 'OMEGA_EDGE', 'PULSE_WIRE', 'QUASAR_INK', 'RIFT_BOLT',
    'SIGMA_WAVE', 'TURBO_LYNX', 'UMBRA_CLAW', 'VENOM_AXE', 'WRAITH_COIL',
    'APEX_FURY', 'BLITZ_SHARD', 'CRYO_FANG', 'DUSK_EMBER', 'FLUX_GRID',
    'HAZE_SPARK', 'INFRA_PULSE', 'JINX_STORM', 'KARMA_EDGE', 'LOKI_PRIME',
]

AVATAR_ICONS = ['eagle','dragon','lion','wolf','fox','bear','bat','shark','snake','scorpion','octopus','squid','crab','bee','butterfly','horse','deer','elephant','rhino','bison']
AVATAR_COLORS = ['#0099cc','#dc2626','#22c55e','#8b5cf6','#f59e0b','#ec4899','#0ea5e9','#10b981','#f97316','#6366f1']


class Command(BaseCommand):
    help = 'Seed game with bot players and a starter alliance'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=20, help='Number of bots')
        parser.add_argument('--no-alliance', action='store_true', help='Skip alliance creation')

    def handle(self, *args, **options):
        count = min(options['count'], len(BOT_NAMES))
        created_players = 0

        for i in range(count):
            name = BOT_NAMES[i]
            username = name.lower().replace('_', '')
            email = f'{username}@hexod.bot'

            if Player.objects.filter(username=username).exists():
                continue

            player = Player.objects.create_user(
                username=username,
                email=email,
                password='BotPass123!',
                display_name=name,
                is_bot=True if hasattr(Player, 'is_bot') else False,
            )
            # Set avatar
            player.avatar_emoji = random.choice(AVATAR_ICONS)
            player.avatar_color = random.choice(AVATAR_COLORS)
            player.tdc_in_game = random.randint(500, 50000)
            player.save(update_fields=['avatar_emoji', 'avatar_color', 'tdc_in_game'])
            created_players += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created_players} bot players'))

        # Create alliance
        if not options['no_alliance']:
            self._create_alliance(count)

    def _create_alliance(self, bot_count):
        try:
            from terra_domini.apps.alliances.models import Alliance, AllianceMember
        except ImportError:
            self.stdout.write(self.style.WARNING('Alliance app not found, skipping'))
            return

        tag = 'HEXO'
        name = 'Hexod Founders'

        if Alliance.objects.filter(tag=tag).exists():
            self.stdout.write(f'Alliance [{tag}] already exists')
            return

        # Use first bot as leader
        bots = list(Player.objects.filter(email__endswith='@hexod.bot').order_by('?')[:min(bot_count, 15)])
        if not bots:
            self.stdout.write(self.style.WARNING('No bots found for alliance'))
            return

        leader = bots[0]
        alliance = Alliance.objects.create(
            tag=tag,
            name=name,
            description='The founding guild of HEXOD. Join us to conquer the world!',
            leader=leader,
            member_count=len(bots),
            treasury_tdc=random.randint(10000, 100000),
            min_rank_to_join=0,
            is_recruiting=True,
        )

        roles = ['leader'] + ['officer'] * 2 + ['veteran'] * 3 + ['member'] * 50
        for i, bot in enumerate(bots):
            role = roles[min(i, len(roles) - 1)]
            AllianceMember.objects.create(
                alliance=alliance,
                player=bot,
                role=role,
            )

        self.stdout.write(self.style.SUCCESS(f'Alliance [{tag}] {name} created with {len(bots)} members'))
