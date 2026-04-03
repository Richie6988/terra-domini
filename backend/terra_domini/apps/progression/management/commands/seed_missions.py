"""
seed_missions — Create mission templates for daily challenges.

Usage: python manage.py seed_missions
"""
from django.core.management.base import BaseCommand


MISSIONS = [
    # EASY
    ('claim', 'easy', 'Claim {target} territories', 'Expand your empire by claiming new hexes', '🏴', 1, 3, 15, 30, 50),
    ('claim', 'easy', 'Claim {target} adjacent territories', 'Grow a kingdom by claiming next to your borders', '📍', 1, 2, 20, 35, 75),
    ('visit_poi', 'easy', 'Visit {target} POI zones', 'Explore points of interest on the map', '🗺', 2, 5, 10, 25, 40),
    ('online', 'easy', 'Play for {target} minutes', 'Spend time building your empire', '⏱', 5, 15, 10, 20, 30),
    ('spend_tdc', 'easy', 'Spend {target} HEX Coins', 'Invest in your empire growth', '💰', 50, 150, 15, 30, 50),
    # MEDIUM
    ('claim', 'medium', 'Claim {target} territories', 'Massive expansion — dominate the map', '⬡', 3, 8, 30, 60, 120),
    ('win_battles', 'medium', 'Win {target} battles', 'Prove your military might', '⚔️', 1, 3, 40, 80, 150),
    ('trade', 'medium', 'Complete {target} trades', 'Be a merchant — trade resources or territories', '🤝', 1, 3, 25, 50, 100),
    ('produce', 'medium', 'Produce {target} resources', 'Your kingdoms must generate wealth', '⛏', 100, 500, 20, 40, 80),
    ('visit_poi', 'medium', 'Discover {target} new POI categories', 'Explore diverse terrain types', '🧭', 3, 6, 30, 60, 100),
    ('alliance', 'medium', 'Contribute {target} times to alliance', 'Help your alliance grow stronger', '🏰', 1, 3, 35, 70, 120),
    ('spend_tdc', 'medium', 'Invest {target} HEX in upgrades', 'Upgrade buildings or buy boosters', '💎', 200, 500, 25, 50, 100),
    # HARD
    ('win_battles', 'hard', 'Win {target} consecutive battles', 'Undefeated streak — show dominance', '🔥', 3, 5, 80, 150, 250),
    ('claim', 'hard', 'Capture {target} enemy territories', 'Take land from other players', '🏴‍☠️', 2, 5, 60, 120, 200),
    ('tower', 'hard', 'Capture {target} control tower', 'Seize a strategic control point', '🗼', 1, 1, 100, 200, 300),
    ('produce', 'hard', 'Produce {target} rare resources', 'Extract valuable materials', '🪙', 50, 200, 50, 100, 200),
    ('trade', 'hard', 'Complete {target} marketplace trades', 'Become a trade baron', '📊', 3, 8, 60, 120, 200),
    ('alliance', 'hard', 'Lead {target} coordinated attacks', 'Command alliance military operations', '⚡', 1, 2, 100, 200, 350),
    ('spend_tdc', 'hard', 'Invest {target} HEX total', 'Big spender challenge', '👑', 500, 2000, 50, 100, 200),
    ('online', 'hard', 'Play for {target} minutes today', 'Dedicated commander session', '🎖', 30, 60, 40, 80, 150),
]


class Command(BaseCommand):
    help = 'Seed mission templates for daily challenges'

    def handle(self, *args, **options):
        from terra_domini.apps.progression.models import MissionTemplate

        created = 0
        for (mtype, diff, title, desc, icon, tmin, tmax, rmin, rmax, xp) in MISSIONS:
            _, was_created = MissionTemplate.objects.get_or_create(
                title_template=title,
                defaults={
                    'mission_type': mtype,
                    'difficulty': diff,
                    'description': desc,
                    'icon_emoji': icon,
                    'target_min': tmin,
                    'target_max': tmax,
                    'reward_tdc_min': rmin,
                    'reward_tdc_max': rmax,
                    'reward_xp': xp,
                }
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Done! Created {created} mission templates ({MissionTemplate.objects.count()} total).'))
