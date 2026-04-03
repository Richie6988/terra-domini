"""
manage.py spawn_bots — Create and run bot players for HEXOD.

Bots play the game for real:
- Claim territories near random world cities
- Build kingdoms (auto-detected via adjacency)
- Generate realistic names and stats

Usage:
  python manage.py spawn_bots --count 20        # Create 20 bots
  python manage.py spawn_bots --count 50 --claim 10  # 50 bots, each claims 10 territories
"""
import random
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger('hexod.bots')

# Bot name components
PREFIXES = ['Storm', 'Iron', 'Dark', 'Nova', 'Blaze', 'Shadow', 'Crystal', 'Hex', 'Titan', 'Cyber',
            'Neon', 'Frost', 'Terra', 'Void', 'Solar', 'Lunar', 'Echo', 'Omega', 'Zenith', 'Apex',
            'Ghost', 'Steel', 'Flame', 'Drift', 'Pulse', 'Quantum', 'Viper', 'Raven', 'Bolt', 'Surge']
SUFFIXES = ['King', 'Lord', 'Wolf', 'Hawk', 'General', 'Master', 'Hunter', 'Rider', 'Guard', 'Knight',
            'Serpent', 'Phoenix', 'Dragon', 'Archer', 'Forge', 'Blade', 'Storm', 'Fury', 'Fang', 'Claw']

# Major cities for bot territory placement
CITIES = [
    (48.8566, 2.3522, 'Paris'), (51.5074, -0.1278, 'London'), (40.7128, -74.0060, 'New York'),
    (35.6762, 139.6503, 'Tokyo'), (55.7558, 37.6173, 'Moscow'), (-33.8688, 151.2093, 'Sydney'),
    (39.9042, 116.4074, 'Beijing'), (19.4326, -99.1332, 'Mexico City'), (-23.5505, -46.6333, 'São Paulo'),
    (28.6139, 77.2090, 'New Delhi'), (37.5665, 126.9780, 'Seoul'), (41.0082, 28.9784, 'Istanbul'),
    (52.5200, 13.4050, 'Berlin'), (40.4168, -3.7038, 'Madrid'), (41.9028, 12.4964, 'Rome'),
    (59.3293, 18.0686, 'Stockholm'), (60.1699, 24.9384, 'Helsinki'), (45.7640, 4.8357, 'Lyon'),
    (43.2965, 5.3698, 'Marseille'), (50.8503, 4.3517, 'Brussels'), (52.3676, 4.9041, 'Amsterdam'),
    (47.3769, 8.5417, 'Zurich'), (48.2082, 16.3738, 'Vienna'), (50.0755, 14.4378, 'Prague'),
    (38.7223, -9.1393, 'Lisbon'), (37.9838, 23.7275, 'Athens'), (30.0444, 31.2357, 'Cairo'),
    (-1.2921, 36.8219, 'Nairobi'), (33.5731, -7.5898, 'Casablanca'), (6.5244, 3.3792, 'Lagos'),
]


def generate_bot_name():
    return f"{random.choice(PREFIXES)}{random.choice(SUFFIXES)}{random.randint(10, 99)}"


class Command(BaseCommand):
    help = 'Spawn bot players that claim territories and build kingdoms'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=20, help='Number of bots to create')
        parser.add_argument('--claim', type=int, default=8, help='Territories per bot')
        parser.add_argument('--prefix', type=str, default='', help='Username prefix filter (for cleanup)')

    def handle(self, *args, **options):
        count = options['count']
        claims_per_bot = options['claim']

        from terra_domini.apps.accounts.models import Player, PlayerStats
        from terra_domini.apps.territories.models import Territory

        created = 0
        total_claimed = 0

        for i in range(count):
            username = generate_bot_name()
            email = f"{username.lower()}@bot.hexod.io"

            # Skip if already exists
            if Player.objects.filter(username=username).exists():
                continue
            if Player.objects.filter(email=email).exists():
                continue

            # Create bot player
            player = Player.objects.create_user(
                email=email,
                username=username,
                password=f"BotPass_{random.randint(100000, 999999)}",
                display_name=username,
                is_bot=True if hasattr(Player, 'is_bot') else None,
            )
            player.email_verified = True

            # Random city as home base
            city = random.choice(CITIES)
            player.initial_lat = city[0] + random.uniform(-0.1, 0.1)
            player.initial_lon = city[1] + random.uniform(-0.1, 0.1)
            player.save()

            PlayerStats.objects.get_or_create(player=player)

            # Claim territories near home city
            try:
                import h3
                center_h3 = h3.latlng_to_cell(city[0], city[1], 8)
                # Get a cluster of adjacent hexes
                candidates = list(h3.grid_disk(center_h3, 4))
                random.shuffle(candidates)

                claimed = 0
                for h3_index in candidates[:claims_per_bot]:
                    # Check if already claimed
                    if Territory.objects.filter(h3_index=h3_index, owner__isnull=False).exists():
                        continue

                    lat, lon = h3.cell_to_latlng(h3_index)
                    territory, _ = Territory.objects.get_or_create(
                        h3_index=h3_index,
                        defaults={
                            'h3_resolution': 8,
                            'center_lat': lat,
                            'center_lon': lon,
                            'territory_type': random.choice(['urban', 'rural', 'forest', 'mountain', 'coastal']),
                        }
                    )
                    if territory.owner is None:
                        territory.owner = player
                        territory.captured_at = timezone.now()
                        territory.save(update_fields=['owner', 'captured_at'])
                        claimed += 1

                # Update stats
                owned_count = Territory.objects.filter(owner=player).count()
                PlayerStats.objects.filter(player=player).update(
                    territories_owned=owned_count,
                    territories_captured=owned_count,
                )
                total_claimed += claimed
                created += 1

                self.stdout.write(f"  ✓ {username} @ {city[2]} — {claimed} territories")

            except ImportError:
                self.stderr.write("h3 library not available — creating bot without territories")
                created += 1
            except Exception as e:
                self.stderr.write(f"  ✗ {username} — error: {e}")
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Created {created} bots, claimed {total_claimed} territories"
        ))
