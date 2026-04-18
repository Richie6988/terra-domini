"""
seed_bots — Populate game with bot players, territories, and an alliance.
Creates a living game world for testing and demo.

Usage:
  python manage.py seed_bots                        # 20 bots, 5 territories each, 1 alliance
  python manage.py seed_bots --count 50 --claim 10  # 50 bots, 10 territories each
  python manage.py seed_bots --reset                # Delete all bots first, then recreate
"""
import random
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger('hexod.bots')

BOT_NAMES = [
    'IRON_HAWK','SHADOW_VIPER','CRIMSON_WOLF','CYBER_PHOENIX','DARK_TITAN',
    'FROST_RAVEN','GOLDEN_SERPENT','JADE_EMPRESS','NEXUS_LORD','OBSIDIAN_KING',
    'PLASMA_GHOST','QUANTUM_FOX','RUBY_DRAGON','SILVER_STORM','THUNDER_BEAR',
    'ULTRA_REAPER','VOID_HUNTER','WARP_KNIGHT','XENON_BLADE','ZERO_FALCON',
    'ALPHA_STRIKE','BETA_CORE','DELTA_FORCE','ECHO_PRIME','GAMMA_RAY',
    'HELIX_DRONE','ION_SPARK','KRYPTON_ACE','LUNAR_SHADE','MARS_RIDER',
    'NOVA_BLAST','OMEGA_EDGE','PULSE_WIRE','QUASAR_INK','RIFT_BOLT',
    'SIGMA_WAVE','TURBO_LYNX','UMBRA_CLAW','VENOM_AXE','WRAITH_COIL',
    'APEX_FURY','BLITZ_SHARD','CRYO_FANG','DUSK_EMBER','FLUX_GRID',
    'HAZE_SPARK','INFRA_PULSE','JINX_STORM','KARMA_EDGE','LOKI_PRIME',
]

AVATAR_ICONS = ['eagle','dragon','lion','wolf','fox','bear','bat','shark','snake',
    'scorpion','octopus','squid','crab','bee','butterfly','horse','deer','elephant','rhino','bison']
AVATAR_COLORS = ['#0099cc','#dc2626','#22c55e','#8b5cf6','#f59e0b','#ec4899','#0ea5e9','#10b981','#f97316','#6366f1']

CITIES = [
    (48.8566,2.3522,'Paris'),(51.5074,-0.1278,'London'),(40.7128,-74.0060,'New York'),
    (35.6762,139.6503,'Tokyo'),(55.7558,37.6173,'Moscow'),(-33.8688,151.2093,'Sydney'),
    (39.9042,116.4074,'Beijing'),(19.4326,-99.1332,'Mexico City'),(-23.5505,-46.6333,'Sao Paulo'),
    (28.6139,77.2090,'New Delhi'),(37.5665,126.9780,'Seoul'),(41.0082,28.9784,'Istanbul'),
    (52.5200,13.4050,'Berlin'),(34.0522,-118.2437,'Los Angeles'),(1.3521,103.8198,'Singapore'),
    (25.2048,55.2708,'Dubai'),(30.0444,31.2357,'Cairo'),(59.3293,18.0686,'Stockholm'),
    (45.4642,9.1900,'Milan'),(43.2965,5.3698,'Marseille'),
]

BIOMES = ['urban','rural','forest','mountain','coastal','desert','industrial','tundra','landmark','grassland']
RARITIES = ['common']*50 + ['uncommon']*25 + ['rare']*15 + ['epic']*7 + ['legendary']*3


class Command(BaseCommand):
    help = 'Seed game with bot players, territories, and an alliance'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=20, help='Number of bots')
        parser.add_argument('--claim', type=int, default=5, help='Territories per bot')
        parser.add_argument('--reset', action='store_true', help='Delete existing bots first')
        parser.add_argument('--no-alliance', action='store_true', help='Skip alliance creation')

    def handle(self, *args, **options):
        from terra_domini.apps.accounts.models import Player
        from terra_domini.apps.territories.models import Territory

        count = min(options['count'], len(BOT_NAMES))
        claims_per_bot = options['claim']

        if options['reset']:
            bots = Player.objects.filter(email__endswith='@bot.hexod.io')
            Territory.objects.filter(owner__in=bots).update(owner=None)
            deleted = bots.delete()
            self.stdout.write(f'Reset: deleted {deleted[0]} bot records')

        created_players = 0
        total_claimed = 0

        for i in range(count):
            name = BOT_NAMES[i]
            username = name.lower().replace('_', '')
            email = f'{username}@bot.hexod.io'

            if Player.objects.filter(username=username).exists():
                continue

            player = Player.objects.create_user(
                username=username, email=email, password='BotPass123!',
                display_name=name,
            )
            player.avatar_emoji = random.choice(AVATAR_ICONS)
            player.avatar_color = random.choice(AVATAR_COLORS)
            player.tdc_in_game = random.randint(500, 50000)
            player.commander_rank = random.randint(1, 15)
            player.battles_won = random.randint(0, 30)
            try:
                player.save(update_fields=['avatar_emoji','avatar_color','tdc_in_game','commander_rank','battles_won'])
            except Exception:
                player.save()

            city = CITIES[i % len(CITIES)]
            claimed = self._claim_territories(player, city, claims_per_bot)
            total_claimed += claimed
            created_players += 1
            self.stdout.write(f'  + {name} @ {city[2]} — {claimed} hex')

        self.stdout.write(self.style.SUCCESS(f'\n{created_players} bots, {total_claimed} territories'))

        if not options['no_alliance']:
            self._create_alliance()

    def _claim_territories(self, player, city, count):
        from terra_domini.apps.territories.models import Territory
        try:
            import h3
        except ImportError:
            self.stderr.write('  h3 not installed — skip territory claiming')
            return 0

        lat, lon, _ = city
        center_h3 = h3.latlng_to_cell(lat, lon, 8)
        candidates = list(h3.grid_disk(center_h3, 4))
        random.shuffle(candidates)

        claimed = 0
        for h3_index in candidates:
            if claimed >= count:
                break
            if Territory.objects.filter(h3_index=h3_index, owner__isnull=False).exists():
                continue

            h3_lat, h3_lon = h3.cell_to_latlng(h3_index)
            territory, _ = Territory.objects.get_or_create(
                h3_index=h3_index,
                defaults={
                    'h3_resolution': 8,
                    'center_lat': h3_lat, 'center_lon': h3_lon,
                    'territory_type': random.choice(BIOMES),
                    'rarity': random.choice(RARITIES),
                    'tdc_per_day': random.uniform(5, 50),
                    'defense_tier': random.randint(0, 3),
                }
            )
            if territory.owner is None:
                territory.owner = player
                territory.captured_at = timezone.now()
                territory.save(update_fields=['owner', 'captured_at'])
                claimed += 1

        try:
            from terra_domini.apps.accounts.models import PlayerStats
            owned = Territory.objects.filter(owner=player).count()
            PlayerStats.objects.update_or_create(player=player, defaults={'territories_owned': owned})
        except Exception:
            pass

        return claimed

    def _create_alliance(self):
        try:
            from terra_domini.apps.alliances.models import Alliance, AllianceMember
            from terra_domini.apps.accounts.models import Player
        except ImportError:
            self.stdout.write(self.style.WARNING('Alliance app not found'))
            return

        tag = 'HEXO'
        if Alliance.objects.filter(tag=tag).exists():
            self.stdout.write(f'Alliance [{tag}] already exists')
            return

        bots = list(Player.objects.filter(email__endswith='@bot.hexod.io').order_by('?')[:15])
        if not bots:
            self.stdout.write(self.style.WARNING('No bots for alliance'))
            return

        leader = bots[0]
        try:
            alliance = Alliance.objects.create(
                tag=tag, name='Hexod Founders',
                description='The founding guild of HEXOD. First to conquer, last to fall.',
                leader=leader, banner_color='#F59E0B', banner_symbol='crown',
            )
        except Exception as e:
            self.stderr.write(f'Alliance creation failed: {e}')
            return

        roles = ['leader'] + ['officer']*2 + ['veteran']*3 + ['member']*50
        members = 0
        for i, bot in enumerate(bots):
            role = roles[min(i, len(roles)-1)]
            try:
                AllianceMember.objects.create(alliance=alliance, player=bot, role=role)
                members += 1
            except Exception:
                pass

        self.stdout.write(self.style.SUCCESS(f'Alliance [{tag}] Hexod Founders — {members} members'))
