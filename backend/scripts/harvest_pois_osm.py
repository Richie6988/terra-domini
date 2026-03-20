#!/usr/bin/env python3
"""
OSM + Wikidata bulk harvester → adds 4,000+ POIs directly to database.
Scrapes: capitals, UNESCO sites, volcanoes, peaks, waterfalls, beaches,
         national parks, ancient ruins, religious sites, military, ports.
Run: cd backend && python scripts/harvest_pois_osm.py
"""
import os, sys, time, json, math, requests, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()

from terra_domini.apps.events.unified_poi import UnifiedPOI, POI_VISUAL

OVERPASS = 'https://overpass-api.de/api/interpreter'
WIKIDATA = 'https://query.wikidata.org/sparql'

total_created = 0
total_skipped = 0

def upsert(name, cat, lat, lon, cc='', desc='', fun='', img='', featured=False, real_output=''):
    global total_created, total_skipped
    if not name or not lat or not lon or abs(lat) > 90 or abs(lon) > 180:
        return
    cfg = POI_VISUAL.get(cat, {})
    try:
        _, created = UnifiedPOI.objects.get_or_create(
            name=name[:200],
            defaults={
                'category':     cat,
                'latitude':     float(lat),
                'longitude':    float(lon),
                'country_code': str(cc)[:4],
                'description':  str(desc)[:500],
                'fun_fact':     str(fun)[:500],
                'real_output':  str(real_output)[:200],
                'is_featured':  featured,
                'wiki_url':     img[:500] if img else '',
                'source':       'osm',
                'verified':     True,
                'is_active':    True,
                'emoji':        cfg.get('emoji','📍'),
                'color':        cfg.get('color','#6B7280'),
                'size':         cfg.get('size','md'),
                'rarity':       cfg.get('rarity','common'),
                'game_resource':cfg.get('game_resource','credits'),
                'bonus_pct':    cfg.get('bonus', 25),
            }
        )
        if created: total_created += 1
        else: total_skipped += 1
    except Exception as e:
        pass

def osm_query(ql, limit=500, timeout=30):
    """Run Overpass QL, return list of {name, lat, lon, tags, cc}"""
    q = f'[out:json][timeout:{timeout}];({ql});out center {limit};'
    try:
        r = requests.post(OVERPASS, data={'data': q}, timeout=timeout+5)
        r.raise_for_status()
        results = []
        for el in r.json().get('elements', []):
            t = el.get('tags', {})
            name = t.get('name:en') or t.get('name') or ''
            if not name or len(name) < 2: continue
            lat = el.get('lat') or el.get('center', {}).get('lat')
            lon = el.get('lon') or el.get('center', {}).get('lon')
            if lat and lon:
                results.append({
                    'name': name, 'lat': float(lat), 'lon': float(lon),
                    'tags': t, 'cc': t.get('country_code', t.get('ISO3166-1:alpha2',''))[:2]
                })
        return results
    except Exception as e:
        print(f'  OSM error: {e}')
        return []

def wikidata_query(sparql, limit=500):
    """Run Wikidata SPARQL, return list of dicts"""
    try:
        r = requests.get(WIKIDATA, params={'query': sparql, 'format': 'json'},
                        headers={'User-Agent': 'TerraDomini/1.0'}, timeout=30)
        r.raise_for_status()
        bindings = r.json().get('results', {}).get('bindings', [])
        results = []
        for b in bindings:
            row = {}
            for k, v in b.items():
                row[k] = v.get('value', '')
            results.append(row)
        return results[:limit]
    except Exception as e:
        print(f'  Wikidata error: {e}')
        return []

print("🌍 Terra Domini POI Harvester")
print("=" * 50)

# ── 1. World Capitals (195 countries) ─────────────────────────────────────
print("\n📍 Harvesting world capitals...")
sparql_capitals = """
SELECT DISTINCT ?name ?lat ?lon ?countryCode WHERE {
  ?country wdt:P31 wd:Q3624078;
           wdt:P36 ?capital;
           wdt:P297 ?countryCode.
  ?capital wdt:P625 ?coord;
           rdfs:label ?name.
  FILTER(lang(?name) = "en")
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
  FILTER(?lat > -90 && ?lat < 90)
} LIMIT 250
"""
capitals = wikidata_query(sparql_capitals)
for c in capitals:
    try:
        lat = float(c.get('lat', 0))
        lon = float(c.get('lon', 0))
        if abs(lat) > 90 or abs(lon) > 180: continue
        upsert(c.get('name',''), 'capital_city', lat, lon, c.get('countryCode',''),
               f"Capital city of {c.get('countryCode','')}. Political heart of the nation.",
               featured=(c.get('name','') in ['Washington D.C.','London','Paris','Beijing','Moscow','New Delhi','Tokyo','Berlin','Brasília','Cairo']))
    except: pass
print(f"  Capitals: {total_created} created so far")
time.sleep(2)

# ── 2. UNESCO World Heritage Sites via OSM ─────────────────────────────────
print("\n🏛️ Harvesting UNESCO sites...")
osm_batch1 = osm_query(
    'node["heritage"="1"]["name"];way["heritage"="1"]["name"];',
    limit=800
)
for el in osm_batch1:
    t = el['tags']
    desc = t.get('description', '') or t.get('wikipedia', '')
    upsert(el['name'], 'world_heritage', el['lat'], el['lon'], el['cc'],
           f"UNESCO World Heritage Site. {desc[:200]}")
print(f"  UNESCO: running total {total_created}")
time.sleep(3)

# ── 3. Mountain Peaks ──────────────────────────────────────────────────────
print("\n🏔️ Harvesting mountain peaks...")
peaks = osm_query(
    'node["natural"="peak"]["name"]["ele"]["ele">"2000"];',
    limit=600
)
for el in peaks:
    t = el['tags']
    ele = t.get('ele','')
    name = el['name']
    upsert(name, 'mountain_peak', el['lat'], el['lon'], el['cc'],
           f"Mountain peak at {ele}m altitude.",
           real_output=f"{ele}m",
           featured=int(ele or 0) > 6000)
print(f"  Peaks: running total {total_created}")
time.sleep(3)

# ── 4. Volcanoes ───────────────────────────────────────────────────────────
print("\n🌋 Harvesting volcanoes...")
volcanoes = osm_query('node["natural"="volcano"]["name"];way["natural"="volcano"]["name"];', 400)
for el in volcanoes:
    t = el['tags']
    upsert(el['name'], 'volcano', el['lat'], el['lon'], el['cc'],
           t.get('description', f"Volcano. {t.get('ele','')}m."))
print(f"  Volcanoes: running total {total_created}")
time.sleep(3)

# ── 5. Waterfalls ──────────────────────────────────────────────────────────
print("\n💦 Harvesting waterfalls...")
falls = osm_query('node["waterway"="waterfall"]["name"];way["waterway"="waterfall"]["name"];', 400)
for el in falls:
    upsert(el['name'], 'waterfall', el['lat'], el['lon'], el['cc'],
           f"Waterfall. Natural water feature.")
print(f"  Waterfalls: running total {total_created}")
time.sleep(3)

# ── 6. National Parks & Nature Reserves ────────────────────────────────────
print("\n🌿 Harvesting national parks...")
parks = osm_query(
    'way["boundary"="national_park"]["name"];relation["boundary"="national_park"]["name"];',
    limit=500
)
for el in parks:
    t = el['tags']
    upsert(el['name'], 'nature_sanctuary', el['lat'], el['lon'], el['cc'],
           t.get('description', 'Protected natural area. National park.'))
time.sleep(3)

# Additional: nature reserves
reserves = osm_query(
    'way["leisure"="nature_reserve"]["name"];relation["leisure"="nature_reserve"]["name"];',
    limit=300
)
for el in reserves:
    upsert(el['name'], 'nature_sanctuary', el['lat'], el['lon'], el['cc'],
           'Nature reserve. Protected ecosystem.')
print(f"  Parks+reserves: running total {total_created}")
time.sleep(3)

# ── 7. Archaeological Sites ────────────────────────────────────────────────
print("\n🗿 Harvesting archaeological sites...")
sites = osm_query(
    'node["historic"~"archaeological_site|ruins"]["name"];way["historic"~"archaeological_site|ruins"]["name"];',
    limit=600
)
for el in sites:
    t = el['tags']
    upsert(el['name'], 'ancient_ruins', el['lat'], el['lon'], el['cc'],
           t.get('description', 'Ancient ruins. Archaeological site.'),
           featured=(t.get('heritage') == '1'))
print(f"  Archaeology: running total {total_created}")
time.sleep(3)

# ── 8. Major Ports ─────────────────────────────────────────────────────────
print("\n🚢 Harvesting major ports...")
ports = osm_query(
    'node["harbour"="yes"]["name"];way["harbour"="yes"]["name"];node["seamark:type"="harbour"]["name"];',
    limit=300
)
for el in ports:
    upsert(el['name'], 'mega_port', el['lat'], el['lon'], el['cc'],
           'Major maritime port. International shipping hub.')
time.sleep(3)

# ── 9. Castles & Palaces ──────────────────────────────────────────────────
print("\n🏰 Harvesting castles...")
castles = osm_query(
    'node["historic"~"castle|palace"]["name"]["tourism"="attraction"];way["historic"~"castle|palace"]["name"];',
    limit=500
)
for el in castles:
    t = el['tags']
    cat = 'royal_palace' if 'palace' in t.get('historic','') else 'ancient_ruins'
    upsert(el['name'], cat, el['lat'], el['lon'], el['cc'],
           t.get('description', f"Historic {t.get('historic','castle')}."))
time.sleep(3)

# ── 10. Religious Sites (Mosques, Temples, Cathedrals) ────────────────────
print("\n🕌 Harvesting major religious sites...")
religious = osm_query(
    'node["tourism"="attraction"]["amenity"~"place_of_worship"]["name"];way["amenity"="place_of_worship"]["heritage"="1"]["name"];',
    limit=400
)
for el in religious:
    t = el['tags']
    upsert(el['name'], 'religious_site', el['lat'], el['lon'], el['cc'],
           t.get('description', f"Sacred {t.get('religion','religious')} site."))
time.sleep(3)

# ── 11. Military Bases ─────────────────────────────────────────────────────
print("\n🪖 Harvesting military bases...")
bases = osm_query(
    'way["military"~"base|airfield"]["name"];node["military"~"base|airfield"]["name"];',
    limit=300
)
for el in bases:
    t = el['tags']
    mil_type = t.get('military', 'base')
    cat = 'naval_base' if mil_type == 'naval_base' else 'military_base'
    upsert(el['name'], cat, el['lat'], el['lon'], el['cc'],
           f"Military {mil_type}. Defense installation.")
time.sleep(3)

# ── 12. Islands ───────────────────────────────────────────────────────────
print("\n🏝️ Harvesting significant islands...")
islands = osm_query(
    'node["place"="island"]["name"]["tourism"];way["place"="island"]["name"]["tourism"];',
    limit=300
)
for el in islands:
    t = el['tags']
    upsert(el['name'], 'island', el['lat'], el['lon'], el['cc'],
           t.get('description', 'Island. Strategic or tourist destination.'))
time.sleep(3)

# ── 13. Wikidata - Major Museums ──────────────────────────────────────────
print("\n🏛️ Harvesting major museums via Wikidata...")
sparql_museums = """
SELECT DISTINCT ?name ?lat ?lon ?visitors WHERE {
  ?museum wdt:P31/wdt:P279* wd:Q33506;
          wdt:P625 ?coord;
          rdfs:label ?name.
  OPTIONAL { ?museum wdt:P1174 ?visitors. }
  FILTER(lang(?name) = "en")
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
  FILTER(BOUND(?visitors) && ?visitors > 500000)
} ORDER BY DESC(?visitors) LIMIT 100
"""
museums = wikidata_query(sparql_museums)
for m in museums:
    try:
        lat, lon = float(m.get('lat',0)), float(m.get('lon',0))
        if abs(lat) > 90: continue
        v = int(float(m.get('visitors',0)))
        upsert(m.get('name',''), 'museum', lat, lon, '',
               f"Major museum. {v:,} visitors/year.",
               real_output=f"{v:,} visitors/yr",
               featured=(v > 3000000))
    except: pass
print(f"  Museums: running total {total_created}")
time.sleep(2)

# ── 14. Wikidata - Major Stadiums ─────────────────────────────────────────
print("\n🏟️ Harvesting major stadiums...")
sparql_stadiums = """
SELECT DISTINCT ?name ?lat ?lon ?capacity WHERE {
  ?stadium wdt:P31/wdt:P279* wd:Q483110;
           wdt:P625 ?coord;
           wdt:P1083 ?capacity;
           rdfs:label ?name.
  FILTER(lang(?name) = "en" && ?capacity > 40000)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
} ORDER BY DESC(?capacity) LIMIT 80
"""
stadiums = wikidata_query(sparql_stadiums)
for s in stadiums:
    try:
        lat, lon = float(s.get('lat',0)), float(s.get('lon',0))
        if abs(lat) > 90: continue
        cap = int(float(s.get('capacity',0)))
        upsert(s.get('name',''), 'sports_arena', lat, lon, '',
               f"Major stadium. Capacity: {cap:,}.",
               real_output=f"{cap:,} capacity",
               featured=(cap > 80000))
    except: pass
print(f"  Stadiums: running total {total_created}")
time.sleep(2)

# ── 15. Wikidata - Glaciers ───────────────────────────────────────────────
print("\n🧊 Harvesting glaciers...")
sparql_glaciers = """
SELECT DISTINCT ?name ?lat ?lon WHERE {
  ?glacier wdt:P31 wd:Q35666;
           wdt:P625 ?coord;
           rdfs:label ?name.
  FILTER(lang(?name) = "en")
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
} LIMIT 150
"""
glaciers = wikidata_query(sparql_glaciers)
for g in glaciers:
    try:
        lat, lon = float(g.get('lat',0)), float(g.get('lon',0))
        if abs(lat) > 90: continue
        upsert(g.get('name',''), 'glacier', lat, lon, '',
               'Glacier. Frozen water mass. Climate change indicator.')
    except: pass
time.sleep(2)

# ── 16. Wikidata - Notable Bridges ────────────────────────────────────────
print("\n🌉 Harvesting iconic bridges...")
sparql_bridges = """
SELECT DISTINCT ?name ?lat ?lon ?length WHERE {
  ?bridge wdt:P31/wdt:P279* wd:Q12280;
          wdt:P625 ?coord;
          rdfs:label ?name.
  OPTIONAL { ?bridge wdt:P2043 ?length. }
  FILTER(lang(?name) = "en" && BOUND(?length) && ?length > 500)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
} ORDER BY DESC(?length) LIMIT 80
"""
bridges = wikidata_query(sparql_bridges)
for b in bridges:
    try:
        lat, lon = float(b.get('lat',0)), float(b.get('lon',0))
        if abs(lat) > 90: continue
        length = float(b.get('length',0))
        upsert(b.get('name',''), 'chokepoint', lat, lon, '',
               f"Major bridge. Span: {length:.0f}m.",
               real_output=f"{length:.0f}m span")
    except: pass
time.sleep(2)

# ── 17. Wikidata - Caves ──────────────────────────────────────────────────
print("\n🕳️ Harvesting notable caves...")
sparql_caves = """
SELECT DISTINCT ?name ?lat ?lon WHERE {
  ?cave wdt:P31/wdt:P279* wd:Q35509;
        wdt:P625 ?coord;
        rdfs:label ?name.
  FILTER(lang(?name) = "en")
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$2")) AS ?lat)
  BIND(xsd:float(replace(str(?coord), "Point\\\\(([^ ]+) ([^)]+)\\\\)", "$1")) AS ?lon)
} LIMIT 100
"""
caves = wikidata_query(sparql_caves)
for c in caves:
    try:
        lat, lon = float(c.get('lat',0)), float(c.get('lon',0))
        if abs(lat) > 90: continue
        upsert(c.get('name',''), 'cave_system', lat, lon, '', 'Cave system. Underground feature.')
    except: pass
time.sleep(2)

# ── 18. OSM - Major Dams ────────────────────────────────────────────────
print("\n🌊 Harvesting major dams...")
dams = osm_query('way["waterway"="dam"]["name"];node["waterway"="dam"]["name"];', 400)
for el in dams:
    t = el['tags']
    upsert(el['name'], 'mega_dam', el['lat'], el['lon'], el['cc'],
           t.get('description', 'Hydroelectric dam. Water infrastructure.'))
time.sleep(3)

# ── 19. OSM - Beaches ────────────────────────────────────────────────────
print("\n🏖️ Harvesting notable beaches...")
beaches = osm_query(
    'way["natural"="beach"]["name"]["tourism"];node["natural"="beach"]["name"]["tourism"];',
    limit=300
)
for el in beaches:
    t = el['tags']
    upsert(el['name'], 'island', el['lat'], el['lon'], el['cc'],
           t.get('description', 'Famous beach. Tourist destination.'))
time.sleep(2)

# ── 20. OSM - Hot Springs & Geothermal ────────────────────────────────
print("\n♨️ Harvesting hot springs...")
springs = osm_query(
    'node["natural"="hot_spring"]["name"];node["amenity"="spa"]["name"]["natural"];',
    limit=200
)
for el in springs:
    upsert(el['name'], 'anomaly', el['lat'], el['lon'], el['cc'],
           'Natural hot spring. Geothermal feature.')
time.sleep(2)

# Final report
print(f"""
{'='*50}
✅ HARVEST COMPLETE
   New POIs created: {total_created}
   Already existed:  {total_skipped}
   Total in DB:      {UnifiedPOI.objects.count()}
   Countries:        {UnifiedPOI.objects.values('country_code').distinct().count()}
   With images:      {UnifiedPOI.objects.exclude(wiki_url='').count()}
{'='*50}
""")
