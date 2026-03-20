"""
Terra Domini — POI Intelligence Agent
Phase 1: Harvest open databases (OSM, Wikidata, GeoNames, Wikipedia)
Phase 2: AI completion via Anthropic API (exclusive/secret POIs)
Phase 3: Live geopolitical/weather news feed → POI events
"""
import os, sys, json, time, math, logging, requests
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger('terra_domini.poi_agent')

# ─── Phase 1: Open Database Harvester ─────────────────────────────────────────

class OSMHarvester:
    """Harvest POIs from OpenStreetMap Overpass API"""
    ENDPOINT = 'https://overpass-api.de/api/interpreter'

    # OSM tags → our categories
    TAG_MAP = [
        # Military
        (['military=base', 'military=airfield'],            'military_base'),
        (['military=naval_base'],                            'naval_base'),
        (['military=missile_site', 'military=nuclear_explosion_site'], 'missile_site'),
        # Energy
        (['power=plant', 'generator:source=nuclear'],        'nuclear_plant'),
        (['man_made=petroleum_well', 'industrial=oil'],      'oil_field'),
        # Natural
        (['natural=peak', 'ele>4000'],                       'mountain_peak'),
        (['natural=volcano'],                                 'volcano'),
        (['waterway=waterfall'],                              'waterfall'),
        (['natural=reef'],                                    'coral_reef'),
        # Infrastructure
        (['aeroway=spaceport'],                              'space_center'),
        (['amenity=stock_exchange'],                         'stock_exchange'),
        # Heritage
        (['historic=ruins', 'heritage=yes'],                 'ancient_ruins'),
        (['historic=castle', 'historic=palace'],             'royal_palace'),
        (['amenity=place_of_worship', 'religion=*'],         'religious_site'),
    ]

    def query(self, osm_filter: str, limit: int = 200) -> list:
        """Run Overpass QL query, return list of {name, lat, lon, tags}"""
        query = f"""
        [out:json][timeout:30];
        (
          node{osm_filter}["name"]["name"~".+"];
          way{osm_filter}["name"]["name"~".+"];
        );
        out center {limit};
        """
        try:
            r = requests.post(self.ENDPOINT, data={'data': query}, timeout=35)
            r.raise_for_status()
            elements = r.json().get('elements', [])
            results = []
            for el in elements:
                tags = el.get('tags', {})
                name = tags.get('name') or tags.get('name:en', '')
                if not name: continue
                lat = el.get('lat') or el.get('center', {}).get('lat')
                lon = el.get('lon') or el.get('center', {}).get('lon')
                if lat and lon:
                    results.append({'name': name, 'lat': lat, 'lon': lon,
                                   'tags': tags, 'cc': tags.get('addr:country', '')})
            return results
        except Exception as e:
            logger.warning(f'OSM query failed: {e}')
            return []

    def harvest_category(self, category: str, limit=100) -> list:
        """Harvest a specific category from OSM"""
        queries = {
            'military_base':  '[military~"base|airfield|barracks"]',
            'naval_base':     '[military=naval_base]',
            'nuclear_plant':  '[power=plant]["generator:source"=nuclear]',
            'volcano':        '[natural=volcano]',
            'mountain_peak':  '[natural=peak]["ele"~"^[4-9][0-9]{3}"]',
            'waterfall':      '[waterway=waterfall]',
            'ancient_ruins':  '[historic~"ruins|archaeological_site"]',
            'space_center':   '[aeroway=spaceport]',
            'coral_reef':     '[natural=reef]',
            'religious_site': '[amenity=place_of_worship][tourism=attraction]',
        }
        q = queries.get(category)
        if not q: return []
        return self.query(q, limit)


class WikidataHarvester:
    """Harvest structured data from Wikidata SPARQL"""
    ENDPOINT = 'https://query.wikidata.org/sparql'

    QUERIES = {
        'capital_city': """
            SELECT ?name ?lat ?lon ?country WHERE {
              ?city wdt:P31 wd:Q5119; wdt:P625 ?coord; rdfs:label ?name.
              ?country wdt:P36 ?city; rdfs:label ?countryName.
              BIND(str(?coord) as ?coordStr)
              FILTER(lang(?name)="en") FILTER(lang(?countryName)="en")
              BIND(xsd:float(replace(str(?coord),".*?([0-9.-]+) ([0-9.-]+).*","$1")) as ?lat)
              BIND(xsd:float(replace(str(?coord),".*?([0-9.-]+) ([0-9.-]+).*","$2")) as ?lon)
            } LIMIT 200
        """,
        'intelligence_hq': """
            SELECT ?name ?lat ?lon WHERE {
              ?org wdt:P31/wdt:P279* wd:Q28799; wdt:P625 ?coord; rdfs:label ?name.
              FILTER(lang(?name)="en")
              BIND(xsd:float(replace(str(?coord),".*?([0-9.-]+) ([0-9.-]+).*","$1")) as ?lat)
              BIND(xsd:float(replace(str(?coord),".*?([0-9.-]+) ([0-9.-]+).*","$2")) as ?lon)
            } LIMIT 50
        """,
    }

    def query(self, sparql: str) -> list:
        try:
            r = requests.get(self.ENDPOINT, params={
                'query': sparql, 'format': 'json'
            }, headers={'User-Agent': 'TerraDomini/1.0'}, timeout=30)
            r.raise_for_status()
            bindings = r.json().get('results', {}).get('bindings', [])
            results = []
            for b in bindings:
                name = b.get('name', {}).get('value', '')
                lat  = float(b.get('lat', {}).get('value', 0) or 0)
                lon  = float(b.get('lon', {}).get('value', 0) or 0)
                if name and lat and lon and abs(lat) <= 90 and abs(lon) <= 180:
                    results.append({'name': name, 'lat': lat, 'lon': lon, 'cc': ''})
            return results
        except Exception as e:
            logger.warning(f'Wikidata query failed: {e}')
            return []


# ─── Phase 2: AI Agent (Anthropic) ────────────────────────────────────────────

class POIAIAgent:
    """
    Uses Claude to generate exclusive/secret POIs that don't exist in open DBs.
    Also enriches existing POIs with fun facts and game lore.
    """

    SYSTEM_PROMPT = """You are the World Intelligence Agent for Terra Domini, a geopolitical strategy game.
Your mission: identify remarkable, strategic, and controversial real-world locations.
Focus on: secret facilities, oligarch assets, conspiracy sites, offshore havens,
         strategic chokepoints, emerging resources, geopolitical hotspots.
Always respond with valid JSON only. No markdown, no preamble."""

    CATEGORY_PROMPTS = {
        'secret_facility': "List 20 real secret or classified military/government facilities worldwide with coordinates. Include: name, lat, lon, country_code (2-letter), description (1 sentence), fun_fact.",
        'conspiracy': "List 20 real locations associated with conspiracy theories, elite gatherings, or mysterious events. Include: name, lat, lon, country_code, description, fun_fact.",
        'oligarch_asset': "List 20 real assets owned by billionaires/oligarchs: private islands, mega-yachts harbors, palaces, bunkers. Include: name, lat, lon, country_code, description.",
        'offshore_haven': "List 20 real offshore financial centers and tax havens with coordinates. Include: name, lat, lon, country_code, description, fun_fact.",
        'anomaly': "List 20 real geographical or physical anomalies on Earth: magnetic anomalies, strange phenomena, unexplained sites. Include: name, lat, lon, country_code, description, fun_fact.",
        'ancient_wonder': "List 30 most impressive ancient monuments and wonders worldwide with precise coordinates. Include: name, lat, lon, country_code, description, fun_fact.",
        'intelligence_hq': "List 25 real intelligence agency headquarters worldwide with coordinates. Include: name, lat, lon, country_code, description.",
        'tech_giant': "List 30 major tech company campuses and headquarters worldwide. Include: name, lat, lon, country_code, description.",
    }

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY', '')

    def generate_pois(self, category: str, count: int = 20) -> list:
        if not self.api_key:
            logger.warning('No ANTHROPIC_API_KEY — AI generation skipped')
            return []

        prompt = self.CATEGORY_PROMPTS.get(category,
            f"List {count} remarkable real-world locations for category '{category}' with name, lat, lon, country_code, description, fun_fact.")

        prompt += f"\n\nRespond ONLY with a JSON array of {count} objects with keys: name, lat, lon, country_code, description, fun_fact."

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model='claude-sonnet-4-20250514',
                max_tokens=4096,
                system=self.SYSTEM_PROMPT,
                messages=[{'role': 'user', 'content': prompt}]
            )
            raw = msg.content[0].text.strip()
            # Clean JSON
            raw = raw.replace('```json','').replace('```','').strip()
            data = json.loads(raw)
            if isinstance(data, list):
                return data
            return data.get('pois', data.get('locations', []))
        except Exception as e:
            logger.error(f'AI generation failed for {category}: {e}')
            return []

    def enrich_poi(self, poi_name: str, category: str) -> dict:
        """Add fun_fact, description, lore to an existing POI"""
        if not self.api_key: return {}
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model='claude-sonnet-4-20250514',
                max_tokens=300,
                system=self.SYSTEM_PROMPT,
                messages=[{'role': 'user', 'content': f'For "{poi_name}" ({category}), provide a JSON object with: description (2 sentences, factual), fun_fact (1 surprising fact), threat_level (none/low/medium/high/critical). JSON only.'}]
            )
            raw = msg.content[0].text.strip().replace('```json','').replace('```','').strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f'Enrichment failed for {poi_name}: {e}')
            return {}


# ─── Phase 3: Live News Feed ───────────────────────────────────────────────────

class GeoNewsAgent:
    """
    Connects live geopolitical/weather/crisis news to POIs.
    Sources: GDELT, ReliefWeb, USGS earthquakes, NOAA weather
    Creates POI news events that update threat levels and descriptions.
    """

    SOURCES = {
        'gdelt_conflicts': 'https://api.gdeltproject.org/api/v2/doc/doc?query=conflict+military&mode=artlist&format=json&maxrecords=50&sort=DateDesc',
        'usgs_earthquakes': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
        'reliefweb_crises': 'https://api.reliefweb.int/v1/disasters?appname=terra-domini&fields[include][]=name&fields[include][]=glide&fields[include][]=country&fields[include][]=date&filter[field]=status&filter[value]=ongoing&limit=20',
        'noaa_storms': 'https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&limit=10',
    }

    def fetch_earthquakes(self) -> list:
        """USGS significant earthquakes → create/update volcano/anomaly POIs"""
        try:
            r = requests.get(self.SOURCES['usgs_earthquakes'], timeout=15)
            r.raise_for_status()
            events = []
            for feat in r.json().get('features', []):
                props = feat['properties']
                coords = feat['geometry']['coordinates']
                mag = props.get('mag', 0)
                if mag >= 5.0:
                    events.append({
                        'title': f"M{mag} Earthquake: {props.get('place', 'Unknown')}",
                        'lat': coords[1], 'lon': coords[0],
                        'magnitude': mag,
                        'time': datetime.fromtimestamp(props['time']/1000).isoformat(),
                        'type': 'earthquake',
                        'threat': 'high' if mag >= 7.0 else 'medium' if mag >= 6.0 else 'low',
                    })
            return events
        except Exception as e:
            logger.warning(f'USGS fetch failed: {e}')
            return []

    def fetch_gdelt_events(self, topic: str = 'conflict military attack') -> list:
        """GDELT geopolitical events → update POI threat levels"""
        try:
            url = f'https://api.gdeltproject.org/api/v2/doc/doc?query={topic.replace(" ","+")}&mode=artlist&format=json&maxrecords=20&sort=DateDesc'
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            articles = r.json().get('articles', [])
            return [{'title': a.get('title',''), 'url': a.get('url',''),
                     'source': a.get('domain',''), 'date': a.get('seendate','')} for a in articles[:20]]
        except Exception as e:
            logger.warning(f'GDELT fetch failed: {e}')
            return []

    def fetch_active_conflicts(self) -> list:
        """ReliefWeb active disasters"""
        try:
            r = requests.get(self.SOURCES['reliefweb_crises'], timeout=15)
            r.raise_for_status()
            return r.json().get('data', [])[:20]
        except Exception as e:
            logger.warning(f'ReliefWeb fetch failed: {e}')
            return []


# ─── Main Orchestrator ─────────────────────────────────────────────────────────

class POIOrchestrator:
    """
    Coordinates all agents. Run as Django management command or Celery task.
    Phase 1: OSM + Wikidata harvest
    Phase 2: AI generation for secret/exclusive categories
    Phase 3: Live news events
    """

    def __init__(self):
        self.osm   = OSMHarvester()
        self.wiki  = WikidataHarvester()
        self.ai    = POIAIAgent()
        self.news  = GeoNewsAgent()

    def run_phase1(self, categories=None, limit_per_cat=50):
        """Harvest open databases"""
        from terra_domini.apps.events.unified_poi import UnifiedPOI

        cats = categories or ['military_base','nuclear_plant','volcano','mountain_peak',
                              'waterfall','ancient_ruins','space_center','coral_reef']
        created = 0
        for cat in cats:
            logger.info(f'Phase1: Harvesting {cat} from OSM...')
            items = self.osm.harvest_category(cat, limit_per_cat)
            for item in items:
                try:
                    _, was_new = UnifiedPOI.objects.get_or_create(
                        name=item['name'],
                        defaults={
                            'category':     cat,
                            'latitude':     item['lat'],
                            'longitude':    item['lon'],
                            'country_code': item.get('cc','')[:4],
                            'source':       'osm',
                            'verified':     True,
                            'is_active':    True,
                        }
                    )
                    if was_new: created += 1
                except Exception as e:
                    logger.warning(f'OSM insert failed: {e}')
            time.sleep(2)  # Be nice to OSM
        logger.info(f'Phase1 complete: {created} new POIs from OSM')
        return created

    def run_phase2(self, categories=None, pois_per_cat=20):
        """AI generation for exclusive/secret categories"""
        from terra_domini.apps.events.unified_poi import UnifiedPOI

        cats = categories or ['secret_facility','conspiracy','oligarch_asset',
                              'offshore_haven','anomaly','ancient_wonder','intelligence_hq']
        created = 0
        for cat in cats:
            logger.info(f'Phase2: AI generating {cat}...')
            items = self.ai.generate_pois(cat, pois_per_cat)
            for item in items:
                if not isinstance(item, dict): continue
                name = item.get('name','')
                lat  = float(item.get('lat', 0) or 0)
                lon  = float(item.get('lon', 0) or 0)
                if not name or not lat or not lon: continue
                if abs(lat) > 90 or abs(lon) > 180: continue
                try:
                    _, was_new = UnifiedPOI.objects.get_or_create(
                        name=name,
                        defaults={
                            'category':     cat,
                            'latitude':     lat,
                            'longitude':    lon,
                            'country_code': str(item.get('country_code',''))[:4],
                            'description':  str(item.get('description',''))[:500],
                            'fun_fact':     str(item.get('fun_fact',''))[:500],
                            'source':       'ai',
                            'verified':     False,
                            'is_active':    True,
                        }
                    )
                    if was_new: created += 1
                except Exception as e:
                    logger.warning(f'AI insert failed for {name}: {e}')
            time.sleep(1)
        logger.info(f'Phase2 complete: {created} new POIs from AI')
        return created

    def run_phase3_news(self):
        """Fetch live events and create/update POI news"""
        from terra_domini.apps.events.models import WorldPOI

        events = []
        # Earthquakes
        quakes = self.news.fetch_earthquakes()
        for q in quakes:
            events.append({
                'type': 'earthquake', 'title': q['title'],
                'lat': q['lat'], 'lon': q['lon'],
                'threat': q['threat'], 'time': q['time'],
            })

        # GDELT conflicts
        conflicts = self.news.fetch_gdelt_events('conflict military')
        events.extend([{'type': 'conflict', 'title': c['title'], 'url': c.get('url','')} for c in conflicts[:10]])

        logger.info(f'Phase3: {len(events)} live events fetched')
        return events

    def get_status(self) -> dict:
        from terra_domini.apps.events.unified_poi import UnifiedPOI
        from django.db.models import Count
        total = UnifiedPOI.objects.count()
        by_source = dict(UnifiedPOI.objects.values_list('source').annotate(n=Count('id')).values_list('source','n'))
        by_rarity = dict(UnifiedPOI.objects.values_list('rarity').annotate(n=Count('id')).values_list('rarity','n'))
        return {
            'total': total,
            'by_source': by_source,
            'by_rarity': by_rarity,
            'target': 10000,
            'progress_pct': round(total/100, 1),
        }
