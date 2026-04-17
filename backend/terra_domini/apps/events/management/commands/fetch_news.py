"""
fetch_news — Pulls live news from NewsAPI.org and creates geolocalized game events.

Usage:
  python manage.py fetch_news                    # Fetch top headlines
  python manage.py fetch_news --api-key YOUR_KEY # With explicit key
  python manage.py fetch_news --count 20         # Fetch 20 articles
  python manage.py fetch_news --demo             # Create demo events (no API key needed)

Requires: NEWSAPI_KEY in settings or --api-key flag.
Free tier: 100 requests/day at https://newsapi.org/register

The command:
  1. Fetches top headlines from NewsAPI.org
  2. Extracts location from article content/title
  3. Maps topic → HEXOD category (volcano, war, sport, etc.)
  4. Assigns rarity based on keyword significance
  5. Creates NewsEvent records (deduped by source URL)
"""
import json
import re
import random
import hashlib
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings

# ── Known locations for geocoding (no external API needed) ──
CITY_COORDS = {
    'paris': (48.8566, 2.3522), 'london': (51.5074, -0.1278), 'new york': (40.7128, -74.0060),
    'tokyo': (35.6762, 139.6503), 'beijing': (39.9042, 116.4074), 'moscow': (55.7558, 37.6173),
    'sydney': (-33.8688, 151.2093), 'berlin': (52.5200, 13.4050), 'rome': (41.9028, 12.4964),
    'madrid': (40.4168, -3.7038), 'washington': (38.9072, -77.0369), 'los angeles': (34.0522, -118.2437),
    'chicago': (41.8781, -87.6298), 'toronto': (43.6532, -79.3832), 'mexico city': (19.4326, -99.1332),
    'rio de janeiro': (-22.9068, -43.1729), 'buenos aires': (-34.6037, -58.3816),
    'cairo': (30.0444, 31.2357), 'istanbul': (41.0082, 28.9784), 'mumbai': (19.0760, 72.8777),
    'delhi': (28.7041, 77.1025), 'shanghai': (31.2304, 121.4737), 'seoul': (37.5665, 126.9780),
    'singapore': (1.3521, 103.8198), 'dubai': (25.2048, 55.2708), 'bangkok': (13.7563, 100.5018),
    'nairobi': (-1.2921, 36.8219), 'cape town': (-33.9249, 18.4241), 'lagos': (6.5244, 3.3792),
    'tehran': (35.6892, 51.3890), 'baghdad': (33.3152, 44.3661), 'kabul': (34.5553, 69.2075),
    'kyiv': (50.4501, 30.5234), 'taipei': (25.0330, 121.5654), 'hanoi': (21.0278, 105.8342),
    'jakarta': (-6.2088, 106.8456), 'lima': (-12.0464, -77.0428), 'bogota': (4.7110, -74.0721),
    'san francisco': (37.7749, -122.4194), 'miami': (25.7617, -80.1918),
    'iceland': (64.9631, -19.0208), 'hawaii': (19.8968, -155.5828),
    'antarctica': (-82.8628, 135.0000), 'north korea': (39.0392, 125.7625),
    'ukraine': (48.3794, 31.1656), 'gaza': (31.3547, 34.3088), 'israel': (31.0461, 34.8516),
    'taiwan': (23.6978, 120.9605), 'crimea': (44.9521, 34.1024),
    'amazon': (-3.4653, -62.2159), 'sahara': (23.4162, 25.6628),
    'olympics': (48.8566, 2.3522), 'super bowl': (29.9511, -90.0715),
    'champions league': (51.5074, -0.1278), 'world cup': (25.2854, 51.5310),
    'nasa': (28.5721, -80.6480), 'spacex': (25.9975, -97.1560), 'cern': (46.2044, 6.1432),
}

COUNTRY_COORDS = {
    'france': (46.2276, 2.2137), 'uk': (55.3781, -3.4360), 'usa': (37.0902, -95.7129),
    'japan': (36.2048, 138.2529), 'china': (35.8617, 104.1954), 'russia': (61.5240, 105.3188),
    'australia': (-25.2744, 133.7751), 'germany': (51.1657, 10.4515), 'italy': (41.8719, 12.5674),
    'spain': (40.4637, -3.7492), 'brazil': (-14.2350, -51.9253), 'india': (20.5937, 78.9629),
    'south korea': (35.9078, 127.7669), 'mexico': (23.6345, -102.5528),
    'egypt': (26.8206, 30.8025), 'turkey': (38.9637, 35.2433), 'iran': (32.4279, 53.6880),
    'canada': (56.1304, -106.3468), 'argentina': (-38.4161, -63.6167),
    'indonesia': (-0.7893, 113.9213), 'pakistan': (30.3753, 69.3451),
    'nigeria': (9.0820, 8.6753), 'south africa': (-30.5595, 22.9375),
    'saudi arabia': (23.8859, 45.0792), 'thailand': (15.8700, 100.9925),
    'vietnam': (14.0583, 108.2772), 'colombia': (4.5709, -74.2973),
    'peru': (-9.1900, -75.0152), 'chile': (-35.6751, -71.5430),
    'poland': (51.9194, 19.1451), 'netherlands': (52.1326, 5.2913),
    'sweden': (60.1282, 18.6435), 'norway': (60.4720, 8.4689),
    'greece': (39.0742, 21.8243), 'portugal': (39.3999, -8.2245),
    'switzerland': (46.8182, 8.2275), 'austria': (47.5162, 14.5501),
    'belgium': (50.5039, 4.4699), 'denmark': (56.2639, 9.5018),
    'finland': (61.9241, 25.7482), 'ireland': (53.1424, -7.6921),
    'new zealand': (-40.9006, 174.8860), 'singapore': (1.3521, 103.8198),
    'malaysia': (4.2105, 101.9758), 'philippines': (12.8797, 121.7740),
    'bangladesh': (23.6850, 90.3563), 'sri lanka': (7.8731, 80.7718),
    'nepal': (28.3949, 84.1240), 'afghanistan': (33.9391, 67.7100),
    'iraq': (33.2232, 43.6793), 'syria': (34.8021, 38.9968),
    'libya': (26.3351, 17.2283), 'ethiopia': (9.1450, 40.4897),
    'kenya': (-0.0236, 37.9062), 'morocco': (31.7917, -7.0926),
    'algeria': (28.0339, 1.6596), 'tunisia': (33.8869, 9.5375),
    'cuba': (21.5218, -77.7812), 'venezuela': (6.4238, -66.5897),
    'north korea': (40.3399, 127.5101), 'myanmar': (21.9162, 95.9560),
}

# ── Topic → HEXOD category mapping ──
TOPIC_MAP = {
    # Disasters
    'earthquake': 'earthquake', 'quake': 'earthquake', 'seismic': 'earthquake',
    'tsunami': 'tsunami', 'tidal wave': 'tsunami',
    'volcano': 'volcano', 'eruption': 'volcano', 'lava': 'volcano',
    'nuclear': 'nuclear', 'radiation': 'nuclear', 'reactor': 'nuclear',
    'hurricane': 'tsunami', 'cyclone': 'tsunami', 'typhoon': 'tsunami',
    'tornado': 'tsunami', 'flood': 'tsunami', 'wildfire': 'volcano',
    # Conflict
    'war': 'war', 'invasion': 'war', 'military': 'war', 'troops': 'war',
    'missile': 'weapon', 'drone strike': 'weapon', 'bombing': 'weapon',
    'espionage': 'conspiracy', 'spy': 'conspiracy', 'hack': 'conspiracy',
    'pirate': 'piracy', 'hijack': 'piracy',
    'peace': 'diplomacy', 'treaty': 'diplomacy', 'summit': 'diplomacy', 'sanctions': 'diplomacy',
    # Culture
    'olympics': 'sport', 'world cup': 'sport', 'champion': 'sport', 'football': 'sport',
    'tennis': 'sport', 'basketball': 'sport', 'f1': 'sport', 'race': 'sport',
    'concert': 'music', 'album': 'music', 'grammy': 'music', 'festival': 'music',
    'movie': 'entertainment', 'oscar': 'entertainment', 'netflix': 'entertainment',
    'celebrity': 'celebs', 'scandal': 'celebs', 'royal': 'celebs',
    'museum': 'museum', 'exhibition': 'art', 'painting': 'art', 'auction': 'art',
    'cuisine': 'food', 'restaurant': 'food', 'michelin': 'food',
    'archaeology': 'history', 'ancient': 'history', 'discovery': 'history',
    # Science
    'nasa': 'space', 'spacex': 'space', 'mars': 'space', 'asteroid': 'space', 'satellite': 'space',
    'ai': 'tech', 'artificial intelligence': 'tech', 'quantum': 'tech', 'robot': 'tech',
    'vaccine': 'medicine', 'pandemic': 'medicine', 'cancer': 'medicine', 'surgery': 'medicine',
    'research': 'science', 'study': 'science', 'breakthrough': 'science',
    # Nature
    'endangered': 'animal', 'wildlife': 'animal', 'species': 'animal',
    'coral': 'ocean', 'marine': 'ocean', 'deep sea': 'ocean',
    'deforestation': 'forest', 'amazon': 'forest', 'rainforest': 'forest',
    'volcano': 'volcano', 'glacier': 'mountain', 'avalanche': 'mountain',
    # Economy
    'trade': 'treasure', 'stock': 'treasure', 'bitcoin': 'treasure', 'economy': 'industry',
}

# ── Rarity keywords ──
RARITY_KEYWORDS = {
    'mythic': ['once in a century', 'unprecedented', 'historic first', 'world record', 'extinction'],
    'legendary': ['breaking', 'catastrophic', 'massive', 'historic', 'record-breaking', 'world first'],
    'epic': ['major', 'significant', 'critical', 'emergency', 'surge', 'crisis'],
    'rare': ['surprising', 'unexpected', 'unusual', 'breakthrough', 'discovery'],
    'uncommon': ['notable', 'important', 'key', 'growing', 'rising'],
}


def geocode_text(text: str) -> tuple[float, float, str]:
    """Extract location from text using known city/country database."""
    text_lower = text.lower()
    # Try cities first (more precise)
    for city, (lat, lon) in CITY_COORDS.items():
        if city in text_lower:
            return lat, lon, city.title()
    # Then countries
    for country, (lat, lon) in COUNTRY_COORDS.items():
        if country in text_lower:
            return lat, lon, country.title()
    # Random global location if nothing found
    return random.uniform(-60, 60), random.uniform(-150, 150), 'GLOBAL'


def categorize_article(title: str, description: str) -> str:
    """Map article text to HEXOD category."""
    text = f"{title} {description}".lower()
    for keyword, category in TOPIC_MAP.items():
        if keyword in text:
            return category
    return 'news'


def assign_rarity(title: str, description: str) -> str:
    """Determine token rarity from article significance."""
    text = f"{title} {description}".lower()
    for rarity, keywords in RARITY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return rarity
    return 'common'


def compute_reward(rarity: str) -> int:
    """HEX coin reward based on rarity."""
    return {'common': 10, 'uncommon': 25, 'rare': 50, 'epic': 150, 'legendary': 500, 'mythic': 2000}.get(rarity, 10)


def compute_max_participants(rarity: str) -> int:
    return {'common': 1000, 'uncommon': 500, 'rare': 200, 'epic': 100, 'legendary': 50, 'mythic': 10}.get(rarity, 500)


def compute_cost(rarity: str) -> int:
    return {'common': 0, 'uncommon': 10, 'rare': 25, 'epic': 50, 'legendary': 100, 'mythic': 500}.get(rarity, 10)


class Command(BaseCommand):
    help = 'Fetch live news → geolocalized game tokens. Run daily via cron.'

    def add_arguments(self, parser):
        parser.add_argument('--api-key', type=str, help='NewsAPI.org API key (or set NEWSAPI_KEY in settings)')
        parser.add_argument('--count', type=int, default=15, help='Number of articles to fetch per country')
        parser.add_argument('--demo', action='store_true', help='Create demo events without API key')
        parser.add_argument('--country', type=str, default='', help='Country code (us, fr, gb...)')
        parser.add_argument('--global', action='store_true', dest='global_mode', help='Fetch from multiple countries for global coverage')
        parser.add_argument('--auto-resolve', action='store_true', help='Auto-resolve ended events and distribute rewards')
        parser.add_argument('--daily', action='store_true', help='Full daily run: fetch global news + auto-resolve ended events')

    def handle(self, *args, **options):
        from terra_domini.apps.events.news_models import NewsEvent, NewsEventRegistration
        import random as rng

        # Daily mode = global fetch + auto-resolve
        if options['daily']:
            options['global_mode'] = True
            options['auto_resolve'] = True

        # Auto-resolve expired events
        if options.get('auto_resolve'):
            self._auto_resolve()

        if options['demo']:
            self._create_demo_events()
            return

        api_key = options['api_key'] or getattr(settings, 'NEWSAPI_KEY', '')
        if not api_key:
            self.stderr.write(self.style.ERROR(
                'No API key. Use --api-key YOUR_KEY or set NEWSAPI_KEY in settings.\n'
                'Get a free key at https://newsapi.org/register\n'
                'Or use --demo for demo events.'
            ))
            return

        # Global mode: fetch from 5 diverse countries
        countries = ['us', 'gb', 'fr', 'de', 'au'] if options.get('global_mode') else [options['country'] or 'us']
        total_created = 0

        for country_code in countries:
            created = self._fetch_country(api_key, country_code, options['count'])
            total_created += created

        self.stdout.write(self.style.SUCCESS(f'Total: {total_created} new events created'))

    def _auto_resolve(self):
        """Resolve ended events: distribute rewards to registered players."""
        from terra_domini.apps.events.news_models import NewsEvent, NewsEventRegistration
        import random as rng
        now = timezone.now()

        ended = NewsEvent.objects.filter(status='live', ends_at__lt=now)
        resolved = 0
        for event in ended:
            regs = list(event.registrations.filter(result='pending'))
            if not regs:
                event.status = 'expired'
                event.save(update_fields=['status'])
                continue

            win_chance = {
                'common': 0.90, 'uncommon': 0.80, 'rare': 0.60,
                'epic': 0.40, 'legendary': 0.25, 'mythic': 0.10,
            }.get(event.rarity, 0.50)

            serial = 1
            for reg in regs:
                luck = rng.randint(0, 15)
                if rng.random() < min(0.95, win_chance + luck * 0.01):
                    reg.result = 'won'
                    reg.hex_earned = event.hex_reward
                    reg.token_serial = serial
                    reg.luck_bonus = luck
                    serial += 1
                    player = reg.player
                    player.tdc_in_game = float(player.tdc_in_game or 0) + event.hex_reward
                    player.save(update_fields=['tdc_in_game'])
                else:
                    reg.result = 'lost'
                    reg.luck_bonus = luck
                reg.save()

            event.status = 'ended'
            event.save(update_fields=['status'])
            resolved += 1

        self.stdout.write(self.style.SUCCESS(f'Auto-resolved {resolved} events'))

    def _fetch_country(self, api_key, country_code, count):
        from terra_domini.apps.events.news_models import NewsEvent
        import urllib.request

        url = f'https://newsapi.org/v2/top-headlines?country={country_code}&pageSize={count}&apiKey={api_key}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'HEXOD/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to fetch news for {country_code}: {e}'))
            return 0

        if data.get('status') != 'ok':
            self.stderr.write(self.style.ERROR(f"API error: {data.get('message', 'Unknown')}"))
            return 0

        articles = data.get('articles', [])
        created = 0
        skipped = 0
        now = timezone.now()

        for article in articles:
            source_url = article.get('url', '')
            if not source_url:
                continue

            # Dedup
            if NewsEvent.objects.filter(source_url=source_url).exists():
                skipped += 1
                continue

            title = article.get('title', '') or ''
            desc = article.get('description', '') or ''
            content = article.get('content', '') or ''
            full_text = f"{title} {desc} {content}"

            lat, lon, loc_name = geocode_text(full_text)
            category = categorize_article(title, desc)
            rarity = assign_rarity(title, desc)

            pub_str = article.get('publishedAt', '')
            try:
                from django.utils.dateparse import parse_datetime
                published = parse_datetime(pub_str) or now
            except Exception:
                published = now

            # Event window: starts now, ends in 4-24h based on rarity
            hours = {'common': 4, 'uncommon': 6, 'rare': 12, 'epic': 18, 'legendary': 24, 'mythic': 48}.get(rarity, 8)

            NewsEvent.objects.create(
                source_url=source_url,
                source_name=article.get('source', {}).get('name', ''),
                headline=title[:300],
                summary=desc[:500] if desc else title[:500],
                image_url=article.get('urlToImage', '') or '',
                published_at=published,
                location_name=loc_name.upper(),
                latitude=lat,
                longitude=lon,
                country_code=country_code.upper(),
                hexod_category=category,
                rarity=rarity,
                status='live',
                hex_reward=compute_reward(rarity),
                max_participants=compute_max_participants(rarity),
                registration_cost=compute_cost(rarity),
                starts_at=now,
                ends_at=now + timedelta(hours=hours),
            )
            created += 1

        self.stdout.write(f'  [{country_code.upper()}] Created {created}, skipped {skipped}')
        return created

    def _create_demo_events(self):
        """Create 15 demo events without an API key."""
        from terra_domini.apps.events.news_models import NewsEvent
        now = timezone.now()

        demos = [
            ('Massive 7.8 Earthquake Hits Turkey', 'earthquake', 'epic', 'ISTANBUL', 41.0, 28.9, 'https://images.unsplash.com/photo-1573511860032-ff3a49e8e5f8?w=600'),
            ('Champions League Final — Real Madrid vs Liverpool', 'sport', 'rare', 'LONDON WEMBLEY', 51.56, -0.28, 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=600'),
            ('SpaceX Starship Successfully Lands on Mars', 'space', 'legendary', 'CAPE CANAVERAL', 28.57, -80.65, 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600'),
            ('Amazon Rainforest Fire Reaches Record Scale', 'forest', 'epic', 'AMAZON BASIN', -3.47, -62.22, 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600'),
            ('NATO Summit — Historic Defense Pact Signed', 'diplomacy', 'rare', 'BRUSSELS', 50.85, 4.35, 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600'),
            ('Great Barrier Reef Coral Bleaching Emergency', 'ocean', 'legendary', 'AUSTRALIA', -18.29, 147.70, 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600'),
            ('Volcanic Eruption in Iceland — Grindavik Evacuated', 'volcano', 'epic', 'ICELAND', 63.87, -22.43, 'https://images.unsplash.com/photo-1462275646964-a0e3c11f18a6?w=600'),
            ('AI Breakthrough — GPT-5 Passes Turing Test', 'tech', 'legendary', 'SAN FRANCISCO', 37.77, -122.42, 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600'),
            ('Olympic Games Opening Ceremony — Paris 2028', 'sport', 'uncommon', 'PARIS', 48.86, 2.35, 'https://images.unsplash.com/photo-1461896836934-bd45ba0ac462?w=600'),
            ('Hurricane Category 5 Approaching Florida', 'tsunami', 'epic', 'MIAMI', 25.76, -80.19, 'https://images.unsplash.com/photo-1527482937786-6c8b02a9bfca?w=600'),
            ('Lost Mayan City Discovered in Guatemala Jungle', 'history', 'mythic', 'GUATEMALA', 15.78, -90.23, 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=600'),
            ('Nuclear Fusion Reactor Achieves Net Energy', 'science', 'legendary', 'CERN', 46.20, 6.14, 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600'),
            ('Rare White Whale Spotted Off Norway Coast', 'animal', 'rare', 'NORWAY', 60.47, 8.47, 'https://images.unsplash.com/photo-1568430462989-44163eb1752f?w=600'),
            ('Bitcoin Surpasses $200,000 — Global Markets React', 'treasure', 'rare', 'NEW YORK', 40.71, -74.01, 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600'),
            ('Massive Cyberattack Targets European Banks', 'conspiracy', 'epic', 'LONDON', 51.51, -0.13, 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600'),
        ]

        created = 0
        for title, cat, rarity, loc, lat, lon, img in demos:
            url = f'https://demo.hexod.dev/news/{hashlib.md5(title.encode()).hexdigest()[:8]}'
            if NewsEvent.objects.filter(source_url=url).exists():
                continue
            hours = {'common': 4, 'uncommon': 6, 'rare': 12, 'epic': 18, 'legendary': 24, 'mythic': 48}[rarity]
            NewsEvent.objects.create(
                source_url=url,
                source_name='HEXOD Demo',
                headline=title,
                summary=f'Breaking: {title}. This event generates a geolocalized {rarity} token near {loc}.',
                image_url=img,
                published_at=now - timedelta(hours=random.randint(0, 6)),
                location_name=loc,
                latitude=lat, longitude=lon,
                hexod_category=cat,
                rarity=rarity,
                status='live',
                hex_reward=compute_reward(rarity),
                max_participants=compute_max_participants(rarity),
                registration_cost=compute_cost(rarity),
                starts_at=now,
                ends_at=now + timedelta(hours=hours),
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} demo events'))
