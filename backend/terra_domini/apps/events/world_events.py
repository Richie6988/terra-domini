"""
World events on the map (owner 2026-10-18): the real world's calendar becomes Risk objectives.

Every event is REAL (RULE 1 — nothing invented) and pinned to the hex of a POI of the master DB:
- sport       : upcoming fixtures from TheSportsDB (football leagues, Champions League, F1, NBA, NFL), pinned
                to the stadium POI (or the host city) — window: 24h before kick-off → end of the match.
- geopolitics : the strategic points of the globe (sources/strategic_points.csv: straits, canals, dams,
                bases, spaceports…) that are in the news right now, from the GDELT news index — 24h window,
                headline and link of a real article.
While an event is live its hex produces ×EVENT_MULT and is the place to fight for; whoever holds the hex
when the event ends gets the bounty (resolve()).

Run by cron: `manage.py world_events` (fetch + resolve), hourly.
"""
import json
import logging
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone as dt_tz

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger('terra_domini.world_events')

EVENT_MULT = 3                      # production multiplier of a live event hex
REWARD = {'common': 300, 'uncommon': 500, 'rare': 900, 'epic': 1500, 'legendary': 3000, 'mythic': 6000}
UA = 'HEXOD/1.0 (+https://hexod.paintit.click)'
SPORT_LEAGUES = {   # TheSportsDB league ids
    4328: 'Premier League', 4335: 'La Liga', 4332: 'Serie A', 4331: 'Bundesliga', 4334: 'Ligue 1',
    4480: 'UEFA Champions League', 4370: 'Formula 1', 4387: 'NBA', 4391: 'NFL',
}
STOP = {'stadium', 'stadio', 'estadio', 'stade', 'arena', 'park', 'field', 'ground', 'the', 'de', 'del', 'di', 'la',
        'le', 'circuit', 'international', 'national', 'centre', 'center', 'olympic', 'olimpico', 'grand', 'prix'}


def _norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s)


def _words(s: str) -> set:
    return {w for w in _norm(s).split() if len(w) >= 4 and w not in STOP}


def _get_json(url: str, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', 'replace') or '{}')


# ── POI matching ──────────────────────────────────────────────────────────────
def _poi_index():
    from terra_domini.apps.events.unified_poi import UnifiedPOI
    return list(UnifiedPOI.objects.filter(is_active=True).exclude(h3_index='')
                .values('name', 'category', 'rarity', 'h3_index', 'latitude', 'longitude', 'country_code'))


def match_venue(venue: str, city: str, pois: list):
    """Stadium POI whose significant words overlap the venue name; else the host city POI."""
    vw = _words(venue)
    best, best_n = None, 0
    if vw:
        for p in pois:
            n = len(vw & _words(p['name']))
            if n > best_n or (n == best_n and n and p['category'] == 'sports_arena'):
                best, best_n = p, n
    if best:
        return best
    cn = _norm(city).strip()
    if cn:
        for p in pois:
            if p['category'] in ('trade_node', 'capital_city') and _norm(p['name']).strip() == cn:
                return p
    return None


def _create(kind, url, headline, summary, poi, starts, ends, source, image='', category=None):
    from terra_domini.apps.events.news_models import NewsEvent
    if NewsEvent.objects.filter(source_url=url[:512]).exists():
        return None
    rarity = poi.get('rarity') or 'rare'
    return NewsEvent.objects.create(
        source_url=url[:512], source_name=source[:100], headline=headline[:300], summary=summary,
        image_url=(image or '')[:512], published_at=timezone.now(),
        location_name=poi['name'][:200], latitude=poi['latitude'], longitude=poi['longitude'],
        country_code=(poi.get('country_code') or '')[:3], hexod_category=category or kind, rarity=rarity,
        status=NewsEvent.Status.LIVE if starts <= timezone.now() else NewsEvent.Status.UPCOMING,
        hex_reward=REWARD.get(rarity, 500), registration_cost=0, starts_at=starts, ends_at=ends,
        event_kind=kind, h3_index=poi['h3_index'], poi_name=poi['name'][:300],
    )


# ── Sources ───────────────────────────────────────────────────────────────────
def fetch_sports(pois=None, days=7) -> int:
    key = getattr(settings, 'THESPORTSDB_KEY', '') or '3'   # '3' = TheSportsDB public test key
    pois = pois if pois is not None else _poi_index()
    now, created = timezone.now(), 0
    for lid, league in SPORT_LEAGUES.items():
        try:
            data = _get_json(f'https://www.thesportsdb.com/api/v1/json/{key}/eventsnextleague.php?id={lid}')
        except Exception as e:
            logger.info(f'TheSportsDB {league}: {e}')
            continue
        for ev in (data.get('events') or [])[:10]:
            ts = ev.get('strTimestamp') or (f"{ev.get('dateEvent')}T{ev.get('strTime') or '12:00:00'}")
            try:
                kick = datetime.fromisoformat(ts.replace('Z', '').split('+')[0]).replace(tzinfo=dt_tz.utc)
            except Exception:
                continue
            if not (now < kick < now + timedelta(days=days)):
                continue
            poi = match_venue(ev.get('strVenue') or '', ev.get('strCity') or '', pois)
            if not poi:
                continue
            title = ev.get('strEvent') or 'Match'
            e = _create('sport', f"https://www.thesportsdb.com/event/{ev.get('idEvent')}",
                        f'{league}: {title}', f"{title} at {ev.get('strVenue') or poi['name']}. Hold this hex at the final whistle to win the bounty.",
                        poi, kick - timedelta(hours=24), kick + timedelta(hours=2), 'TheSportsDB', ev.get('strThumb') or '', 'sport')
            created += bool(e)
    return created


def strategic_points():
    """Strategic POIs of the master DB (flag set by scripts/build_hexod_db.py)."""
    from terra_domini.apps.events import hexod_db
    return [p for p in hexod_db.load().get('pois', []) if p.get('strategic') and p.get('h3_r8')]


def fetch_geopolitics(min_articles=3, top=3) -> int:
    """Strategic points in the news (GDELT DOC API, last 24h) → 24h event on their hex, with a real headline."""
    hits = []
    for p in strategic_points():
        q = urllib.parse.quote(f'"{p["name"]}"')
        try:
            data = _get_json(f'https://api.gdeltproject.org/api/v2/doc/doc?query={q}&mode=artlist&format=json'
                             f'&maxrecords=25&timespan=24h&sort=hybridrel', timeout=25)
        except Exception as e:
            logger.info(f'GDELT {p["name"]}: {e}')
            continue
        arts = [a for a in (data.get('articles') or []) if a.get('url') and a.get('title')]
        if len(arts) >= min_articles:
            hits.append((len(arts), p, arts[0]))
    created, now = 0, timezone.now()
    for n, p, a in sorted(hits, key=lambda x: -x[0])[:top]:
        poi = {'name': p['name'], 'rarity': p['rarity'], 'h3_index': p['h3_r8'], 'latitude': p['lat'],
               'longitude': p['lon'], 'country_code': p.get('country_code', '')}
        e = _create('geopolitics', a['url'], f"{p['name']} in the news: {a['title']}",
                    f"{n} articles in 24h ({a.get('domain', '')}). Hold this strategic point until the event ends to win the bounty.",
                    poi, now, now + timedelta(hours=24), a.get('domain', 'GDELT'), a.get('socialimage', ''), 'diplomacy')
        created += bool(e)
    return created


# ── Game effects ──────────────────────────────────────────────────────────────
def live_event_hexes() -> set:
    from terra_domini.apps.events.news_models import NewsEvent
    now = timezone.now()
    return set(NewsEvent.objects.filter(starts_at__lte=now, ends_at__gt=now).exclude(h3_index='')
               .values_list('h3_index', flat=True))


EDITIONS = 10            # only 10 numbered tokens per event (owner 2026-10-18)


def ticket_weight(luck: int) -> float:
    """Chances of one ticket in the draw: luck potion (+15 luck) = 2.5x."""
    return 1 + max(0, luck) / 10


def _card(ev, player_id, serial):
    from terra_domini.apps.events.news_models import EventCard
    return EventCard.objects.get_or_create(player_id=player_id, event=ev, defaults=dict(
        headline=ev.headline[:300], kind=ev.event_kind or '', location_name=(ev.poi_name or ev.location_name or '')[:200],
        h3_index=ev.h3_index, latitude=ev.latitude, longitude=ev.longitude, rarity=ev.rarity or 'rare',
        image_url=(ev.image_url or '')[:512], source_url=(ev.source_url or '')[:512], event_date=ev.ends_at.date(),
        serial=serial, max_supply=EDITIONS))


def draw(ev, holder_id=None) -> list:
    """The 10 editions: #1 to the hex holder, the rest drawn among the ticket holders, weighted by luck."""
    import random
    regs = list(ev.registrations.filter(result='pending'))
    pool = [r for r in regs if r.player_id != holder_id]
    winners = []
    serial = 1
    if holder_id:
        _card(ev, holder_id, 1)
        serial = 2
    while pool and serial <= EDITIONS:
        r = random.choices(pool, weights=[ticket_weight(x.luck_bonus) for x in pool])[0]
        pool.remove(r)
        r.result, r.token_serial = 'won', serial
        r.save(update_fields=['result', 'token_serial'])
        _card(ev, r.player_id, serial)
        winners.append((r.player_id, serial))
        serial += 1
    for r in pool:
        r.result = 'lost'
        r.save(update_fields=['result'])
    for r in regs:
        if r.player_id == holder_id:
            r.result, r.token_serial = 'won', 1
            r.save(update_fields=['result', 'token_serial'])
    return winners


def resolve() -> int:
    """Ended events: the hex holder wins the bounty and edition #1; editions #2-10 are drawn among the tickets.
    Upcoming → live when they start."""
    from terra_domini.apps.accounts.models import Player
    from terra_domini.apps.events.news_models import NewsEvent
    from terra_domini.apps.territories.models import Territory
    now = timezone.now()
    NewsEvent.objects.filter(status=NewsEvent.Status.UPCOMING, starts_at__lte=now).update(status=NewsEvent.Status.LIVE)
    done = 0
    for ev in NewsEvent.objects.filter(status__in=[NewsEvent.Status.LIVE, NewsEvent.Status.UPCOMING], ends_at__lte=now).exclude(h3_index=''):
        with transaction.atomic():
            owner_id = Territory.objects.filter(h3_index=ev.h3_index).values_list('owner_id', flat=True).first()
            if owner_id:
                Player.objects.filter(id=owner_id).update(tdc_in_game=F('tdc_in_game') + ev.hex_reward)
                ev.winner_id = owner_id
            draw(ev, owner_id)
            ev.status = NewsEvent.Status.ENDED if owner_id or ev.registrations.exists() else NewsEvent.Status.EXPIRED
            ev.save(update_fields=['winner', 'status'])
        done += 1
    return done
