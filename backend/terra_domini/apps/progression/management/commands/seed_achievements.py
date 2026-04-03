"""
seed_achievements — Create 100+ achievements for HEXOD.

Usage: python manage.py seed_achievements
"""
from django.core.management.base import BaseCommand

ACHIEVEMENTS = [
    # ═══ TERRITORY (20) ═══
    ('terr_1',      'territory', 1, 'First Hex',          'Claim your first territory',                 '🏴', 10, 50),
    ('terr_5',      'territory', 1, 'Settler',            'Own 5 territories',                          '🏠', 25, 100),
    ('terr_10',     'territory', 1, 'Colonist',           'Own 10 territories',                         '🏘', 50, 200),
    ('terr_25',     'territory', 2, 'Landowner',          'Own 25 territories',                         '🏗', 100, 400),
    ('terr_50',     'territory', 2, 'Governor',           'Own 50 territories',                         '🏛', 200, 800),
    ('terr_100',    'territory', 3, 'Emperor',            'Own 100 territories',                        '👑', 500, 2000),
    ('terr_250',    'territory', 3, 'World Power',        'Own 250 territories',                        '🌍', 1000, 5000),
    ('terr_500',    'territory', 3, 'Hegemon',            'Own 500 territories',                        '⬡', 2500, 10000),
    ('king_1',      'territory', 1, 'Kingdom Founder',    'Create your first kingdom (2+ adjacent)',    '🏰', 50, 200),
    ('king_3',      'territory', 2, 'Kingdom Builder',    'Own 3 kingdoms',                             '🏯', 150, 600),
    ('king_5',      'territory', 3, 'Empire Architect',   'Own 5 kingdoms',                             '⚜', 400, 1500),
    ('landmark_1',  'territory', 1, 'Landmark Hunter',    'Capture a landmark territory',               '🗽', 100, 500),
    ('landmark_5',  'territory', 2, 'Monument Collector', 'Capture 5 landmarks',                        '🏛', 250, 1000),
    ('landmark_10', 'territory', 3, 'Wonder Seeker',      'Capture 10 landmarks',                       '✨', 500, 2500),
    ('poi_10',      'territory', 1, 'POI Explorer',       'Visit 10 points of interest',                '📍', 30, 100),
    ('poi_50',      'territory', 2, 'POI Mapper',         'Visit 50 points of interest',                '🗺', 150, 600),
    ('poi_100',     'territory', 3, 'POI Master',         'Visit 100 points of interest',               '🧭', 400, 1500),
    ('shiny_1',     'territory', 1, 'Lucky Find',         'Find a shiny territory',                     '✨', 100, 500),
    ('shiny_5',     'territory', 2, 'Shiny Hunter',       'Find 5 shiny territories',                   '💎', 300, 1500),
    ('shiny_10',    'territory', 3, 'Holographic Master',  'Find 10 shiny territories',                  '🌈', 1000, 5000),

    # ═══ COMBAT (15) ═══
    ('battle_1',    'combat', 1, 'First Blood',           'Win your first battle',                      '⚔️', 25, 100),
    ('battle_5',    'combat', 1, 'Warrior',               'Win 5 battles',                              '🗡', 50, 200),
    ('battle_10',   'combat', 2, 'Warlord',               'Win 10 battles',                             '🛡', 100, 500),
    ('battle_50',   'combat', 2, 'Conqueror',             'Win 50 battles',                             '🏴', 300, 1500),
    ('battle_100',  'combat', 3, 'Supreme Commander',     'Win 100 battles',                            '⚡', 1000, 5000),
    ('defense_5',   'combat', 1, 'Iron Wall',             'Successfully defend 5 times',                '🧱', 50, 200),
    ('defense_25',  'combat', 2, 'Fortress',              'Successfully defend 25 times',               '🏰', 200, 800),
    ('defense_50',  'combat', 3, 'Unbreakable',           'Successfully defend 50 times',               '💪', 500, 2000),
    ('spy_1',       'combat', 1, 'First Spy Mission',     'Send your first spy',                        '🕵️', 25, 100),
    ('spy_10',      'combat', 2, 'Spymaster',             'Complete 10 spy missions',                   '🔍', 150, 600),
    ('nuke_1',      'combat', 2, 'Nuclear Option',        'Use a nuclear strike',                       '☢', 200, 1000),
    ('capture_tower','combat', 2, 'Tower Taker',          'Capture a control tower',                    '🗼', 200, 1000),
    ('revenge_1',   'combat', 1, 'Vengeance',             'Recapture a territory taken from you',       '🔥', 50, 200),
    ('streak_win_5','combat', 2, 'Unstoppable',           'Win 5 battles in a row',                     '💥', 200, 800),
    ('streak_win_10','combat', 3, 'God of War',           'Win 10 battles in a row',                    '⚡', 500, 2500),

    # ═══ ECONOMY (15) ═══
    ('earn_1k',     'economy', 1, 'First Thousand',       'Earn 1,000 HEX Coins total',                '💰', 25, 100),
    ('earn_10k',    'economy', 2, 'Wealthy',              'Earn 10,000 HEX Coins total',               '💎', 100, 500),
    ('earn_100k',   'economy', 3, 'Tycoon',              'Earn 100,000 HEX Coins total',              '🏦', 500, 2500),
    ('earn_1m',     'economy', 3, 'HEX Mogul',           'Earn 1,000,000 HEX Coins total',            '👑', 2500, 10000),
    ('trade_1',     'economy', 1, 'First Trade',          'Complete your first marketplace trade',      '🤝', 25, 100),
    ('trade_10',    'economy', 2, 'Merchant',             'Complete 10 marketplace trades',             '📊', 100, 500),
    ('trade_50',    'economy', 3, 'Trade Baron',          'Complete 50 marketplace trades',             '🏪', 400, 2000),
    ('auction_1',   'economy', 1, 'First Bid',            'Win your first auction',                     '🔨', 50, 200),
    ('auction_10',  'economy', 2, 'Auction King',         'Win 10 auctions',                            '🏆', 200, 1000),
    ('shop_buy_10', 'economy', 1, 'Shopaholic',          'Buy 10 items from the shop',                '🛍', 30, 100),
    ('shop_buy_50', 'economy', 2, 'Big Spender',         'Buy 50 items from the shop',                '💳', 150, 600),
    ('booster_10',  'economy', 1, 'Pack Opener',         'Open 10 booster packs',                     '📦', 50, 200),
    ('booster_50',  'economy', 2, 'Pack Rat',            'Open 50 booster packs',                     '🎁', 200, 1000),
    ('staking_1',   'economy', 1, 'First Stake',          'Stake HEX for the first time',              '🔒', 50, 200),
    ('income_1k',   'economy', 2, 'Passive Income',      'Earn 1,000 HEX/day from territories',       '📈', 200, 1000),

    # ═══ SOCIAL (10) ═══
    ('alliance_1',  'social', 1, 'Team Player',           'Join an alliance',                           '🤝', 25, 100),
    ('alliance_create','social', 2, 'Alliance Leader',    'Create an alliance',                         '🏴‍☠️', 100, 500),
    ('alliance_war','social', 2, 'Alliance Warrior',      'Win an alliance war',                        '⚔️', 200, 1000),
    ('referral_1',  'social', 1, 'Recruiter',            'Refer 1 friend who reaches level 5',         '📨', 100, 500),
    ('referral_5',  'social', 2, 'Ambassador',           'Refer 5 friends',                            '🎖', 300, 1500),
    ('referral_10', 'social', 3, 'Evangelist',           'Refer 10 friends',                           '🌟', 1000, 5000),
    ('chat_100',    'social', 1, 'Chatty',               'Send 100 alliance chat messages',            '💬', 25, 100),
    ('donate_1',    'social', 1, 'Generous',             'Donate resources to alliance',               '🎁', 50, 200),
    ('help_5',      'social', 2, 'Helpful',              'Respond to 5 alliance help requests',        '🆘', 150, 600),
    ('diplomacy_1', 'social', 1, 'Diplomat',             'Propose a diplomatic treaty',                '🕊', 50, 200),

    # ═══ EXPLORATION (10) ═══
    ('continent_1', 'exploration', 1, 'Continental',      'Own territories on 2 continents',            '🗺', 100, 500),
    ('continent_3', 'exploration', 2, 'World Traveler',   'Own territories on 4 continents',            '✈️', 300, 1500),
    ('continent_6', 'exploration', 3, 'Globe Trotter',    'Own territories on all 6 continents',        '🌏', 1000, 5000),
    ('country_5',   'exploration', 1, 'Multi-National',   'Own territories in 5 countries',             '🏳', 100, 500),
    ('country_20',  'exploration', 2, 'International',    'Own territories in 20 countries',            '🌐', 500, 2500),
    ('safari_5',    'exploration', 1, 'Tracker',          'Capture 5 safari creatures',                 '🎯', 30, 100),
    ('safari_10',   'exploration', 2, 'Beast Hunter',     'Capture 10 safari creatures',                '🐉', 80, 400),
    ('safari_25',   'exploration', 3, 'Safari Master',    'Capture 25 safari creatures',                '🦖', 250, 1200),
    ('event_5',     'exploration', 1, 'Event Enthusiast', 'Participate in 5 events',                   '📡', 50, 200),
    ('event_25',    'exploration', 2, 'Event Veteran',    'Participate in 25 events',                   '🏅', 200, 1000),

    # ═══ COLLECTION (15) ═══
    ('collect_10',  'exploration', 1, 'Collector',        'Own 10 unique token types in Codex',         '📚', 50, 200),
    ('collect_50',  'exploration', 2, 'Curator',          'Own 50 unique token types',                  '🏛', 200, 1000),
    ('collect_100', 'exploration', 3, 'Museum Director',  'Own 100 unique token types',                 '🎨', 500, 2500),
    ('rare_5',      'exploration', 1, 'Rare Hunter',      'Own 5 rare+ territories',                    '💎', 50, 200),
    ('rare_10',     'exploration', 2, 'Gem Collector',    'Own 10 rare+ territories',                   '💠', 150, 600),
    ('epic_5',      'exploration', 2, 'Epic Finder',      'Own 5 epic+ territories',                    '🔮', 200, 800),
    ('legend_1',    'exploration', 2, 'Legend Seeker',     'Own a legendary territory',                  '🌟', 200, 1000),
    ('legend_5',    'exploration', 3, 'Legend Hoarder',    'Own 5 legendary territories',                '⭐', 500, 2500),
    ('mythic_1',    'exploration', 3, 'Mythic Finder',    'Own a mythic territory',                     '🔥', 500, 3000),
    ('disaster_5',  'exploration', 1, 'Storm Chaser',     'Own 5 disaster-category tokens',             '🌋', 50, 200),
    ('places_5',    'exploration', 1, 'Sightseer',        'Own 5 places-category tokens',               '🏛', 50, 200),
    ('nature_5',    'exploration', 1, 'Nature Lover',     'Own 5 nature-category tokens',               '🌲', 50, 200),
    ('culture_5',   'exploration', 1, 'Culture Buff',     'Own 5 culture-category tokens',              '🎭', 50, 200),
    ('science_5',   'exploration', 1, 'Scientist',        'Own 5 science-category tokens',              '🔬', 50, 200),
    ('fantastic_5', 'exploration', 1, 'Mythologist',      'Own 5 fantastic-category tokens',            '🐉', 50, 200),

    # ═══ STREAK (10) ═══
    ('streak_3',    'streak', 1, 'Getting Started',       'Login 3 days in a row',                      '🔥', 15, 50),
    ('streak_7',    'streak', 1, 'One Week',              'Login 7 days in a row',                      '📅', 50, 200),
    ('streak_14',   'streak', 2, 'Dedicated',             'Login 14 days in a row',                     '🗓', 100, 500),
    ('streak_30',   'streak', 2, 'Monthly Regular',       'Login 30 days in a row',                     '📆', 250, 1200),
    ('streak_60',   'streak', 3, 'Hardcore',              'Login 60 days in a row',                     '💪', 500, 2500),
    ('streak_100',  'streak', 3, 'Centurion',            'Login 100 days in a row',                    '🏆', 1000, 5000),
    ('streak_365',  'streak', 3, 'Year One',              'Login 365 days in a row',                    '👑', 5000, 25000),
    ('mission_10',  'streak', 1, 'Mission Runner',        'Complete 10 daily missions',                 '✅', 50, 200),
    ('mission_50',  'streak', 2, 'Mission Expert',        'Complete 50 daily missions',                 '🎯', 200, 1000),
    ('mission_100', 'streak', 3, 'Mission Master',        'Complete 100 daily missions',                '🏅', 500, 2500),

    # ═══ SECRET (5) ═══
    ('first_hour',  'secret', 1, 'Early Bird',           'Play within 1 hour of server launch',        '🐦', 500, 2000),
    ('night_owl',   'secret', 1, 'Night Owl',            'Claim a territory between 2-5 AM',           '🦉', 50, 200),
    ('palindrome',  'secret', 1, 'Palindrome',           'Own a territory with palindrome H3 index',   '🔄', 100, 500),
    ('island',      'secret', 2, 'Island Kingdom',       'Own a kingdom entirely surrounded by water',  '🏝', 300, 1500),
    ('monopoly',    'secret', 3, 'Monopolist',           'Own all territories in a city center',        '🎩', 2000, 10000),
]


class Command(BaseCommand):
    help = 'Seed 100+ achievements for HEXOD'

    def handle(self, *args, **options):
        from terra_domini.apps.progression.models import Achievement

        created = 0
        for code, cat, tier, name, desc, icon, reward_tdc, reward_xp in ACHIEVEMENTS:
            _, was_created = Achievement.objects.get_or_create(
                code=code,
                defaults={
                    'category': cat,
                    'tier': tier,
                    'name': name,
                    'description': desc,
                    'icon_emoji': icon,
                    'threshold': int(code.split('_')[-1]) if code.split('_')[-1].isdigit() else 1,
                    'reward_tdc': reward_tdc,
                    'reward_xp': reward_xp,
                    'reward_badge_emoji': icon,
                    'is_hidden': cat == 'secret',
                }
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Seeded {created} achievements (total: {Achievement.objects.count()})'))
