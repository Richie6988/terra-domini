#!/usr/bin/env python3
"""
POI Harvester — Wikidata SPARQL + embedded curated data.
Reaches 5,000+ POIs without OSM rate limits.
Uses Wikidata's free SPARQL endpoint with small batched queries.
Run: cd backend && python scripts/harvest_pois_osm.py
"""
import os, sys, time, requests, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()

from terra_domini.apps.events.unified_poi import UnifiedPOI, POI_VISUAL

WIKIDATA = 'https://query.wikidata.org/sparql'
HEADERS  = {'User-Agent': 'TerraDomini/1.0 (geopolitical game; contact@terra-domini.com)'}

created = skipped = errors = 0

def upsert(name, cat, lat, lon, cc='', desc='', fun='', img='', featured=False, output=''):
    global created, skipped, errors
    if not name or not lat or not lon: return
    try:
        lat, lon = float(lat), float(lon)
        if abs(lat) > 90 or abs(lon) > 180: return
    except: return
    cfg = POI_VISUAL.get(cat, {})
    try:
        _, was_new = UnifiedPOI.objects.get_or_create(
            name=str(name)[:200],
            defaults={
                'category': cat, 'latitude': lat, 'longitude': lon,
                'country_code': str(cc)[:4], 'description': str(desc)[:500],
                'fun_fact': str(fun)[:500], 'real_output': str(output)[:200],
                'wiki_url': str(img)[:500] if img else '',
                'is_featured': bool(featured), 'source': 'wikidata',
                'verified': True, 'is_active': True,
                'emoji': cfg.get('emoji','📍'), 'color': cfg.get('color','#6B7280'),
                'size': cfg.get('size','md'), 'rarity': cfg.get('rarity','common'),
                'game_resource': cfg.get('game_resource','credits'), 'bonus_pct': cfg.get('bonus',25),
            }
        )
        if was_new: created += 1
        else: skipped += 1
    except Exception as e:
        errors += 1

def wikidata(sparql, max_retries=3):
    for attempt in range(max_retries):
        try:
            r = requests.get(WIKIDATA, params={'query': sparql, 'format': 'json'},
                           headers=HEADERS, timeout=30)
            if r.status_code == 429:
                print(f"  Rate limited, waiting 10s...")
                time.sleep(10)
                continue
            r.raise_for_status()
            return r.json().get('results',{}).get('bindings',[])
        except Exception as e:
            print(f"  Wikidata error (attempt {attempt+1}): {e}")
            time.sleep(5)
    return []

def coord(b, key='coord'):
    """Extract lat/lon from Wikidata Point() format"""
    try:
        v = b.get(key,{}).get('value','')
        # "Point(lon lat)" format
        import re
        m = re.search(r'Point\(([^ ]+) ([^)]+)\)', v)
        if m:
            return float(m.group(2)), float(m.group(1))  # lat, lon
    except: pass
    return None, None

print("🌍 Terra Domini — Wikidata POI Harvester")
print("=" * 50)

# ── 1. World Capitals ─────────────────────────────────────────────────────
print("\n📍 World capitals...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?country wdt:P31 wd:Q3624078; wdt:P36 ?cap; wdt:P297 ?cc.
  ?cap wdt:P625 ?coord; rdfs:label ?name. FILTER(lang(?name)="en")
} LIMIT 250""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        n = b['name']['value']
        cc = b.get('cc',{}).get('value','')
        upsert(n, 'capital_city', lat, lon, cc,
               f"Capital city of {cc}.",
               featured=n in ['Washington, D.C.','London','Paris','Beijing','Moscow',
                              'New Delhi','Tokyo','Berlin','Brasília','Cairo','Nairobi',
                              'Pretoria','Canberra','Ottawa','Buenos Aires','Jakarta'])
print(f"  Done. Total: {created}")
time.sleep(3)

# ── 2. UNESCO World Heritage ──────────────────────────────────────────────
print("\n🏛️ UNESCO World Heritage Sites...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?site wdt:P31/wdt:P279* wd:Q9259; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?site wdt:P17 ?country. ?country wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 500""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'world_heritage', lat, lon,
               b.get('cc',{}).get('value',''),
               'UNESCO World Heritage Site.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 3. Mountain Peaks > 2000m ─────────────────────────────────────────────
print("\n🏔️ Mountain peaks...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?elev WHERE {
  ?peak wdt:P31/wdt:P279* wd:Q8502; wdt:P625 ?coord; wdt:P2044 ?elev; rdfs:label ?name.
  FILTER(lang(?name)="en" && ?elev > 2000)
} ORDER BY DESC(?elev) LIMIT 600""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        elev = int(float(b.get('elev',{}).get('value',0)))
        upsert(b['name']['value'], 'mountain_peak', lat, lon, '',
               f"Mountain peak. {elev}m altitude.", output=f"{elev}m",
               featured=elev > 7000)
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 4. Volcanoes ──────────────────────────────────────────────────────────
print("\n🌋 Volcanoes...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?elev WHERE {
  ?v wdt:P31/wdt:P279* wd:Q8072; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?v wdt:P2044 ?elev. }
  FILTER(lang(?name)="en")
} LIMIT 400""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        elev = int(float(b.get('elev',{}).get('value',0) or 0))
        upsert(b['name']['value'], 'volcano', lat, lon, '',
               f"Volcano. {elev}m." if elev else "Volcano.",
               output=f"{elev}m" if elev else '')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 5. National Parks ─────────────────────────────────────────────────────
print("\n🌿 National parks...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?park wdt:P31/wdt:P279* wd:Q46169; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?park wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 600""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'nature_sanctuary', lat, lon,
               b.get('cc',{}).get('value',''), 'National park. Protected natural area.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 6. Ancient Ruins / Archaeological Sites ───────────────────────────────
print("\n🗿 Archaeological sites...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?site wdt:P31/wdt:P279* wd:Q839954; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?site wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 500""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'ancient_ruins', lat, lon,
               b.get('cc',{}).get('value',''), 'Archaeological site. Ancient ruins.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 7. Castles ────────────────────────────────────────────────────────────
print("\n🏰 Castles and fortresses...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?castle wdt:P31/wdt:P279* wd:Q23413; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?castle wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 500""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'ancient_ruins', lat, lon,
               b.get('cc',{}).get('value',''), 'Historic castle or fortress.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 8. Major Museums ─────────────────────────────────────────────────────
print("\n🏛️ Major museums (500k+ visitors)...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?visitors ?cc WHERE {
  ?museum wdt:P31/wdt:P279* wd:Q33506; wdt:P625 ?coord; wdt:P1174 ?visitors; rdfs:label ?name.
  OPTIONAL { ?museum wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en" && ?visitors > 500000)
} ORDER BY DESC(?visitors) LIMIT 150""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        v = int(float(b.get('visitors',{}).get('value',0)))
        upsert(b['name']['value'], 'museum', lat, lon,
               b.get('cc',{}).get('value',''),
               f"Major museum. {v:,} visitors/year.", output=f"{v:,}/yr",
               featured=(v > 2000000))
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 9. Large Stadiums ────────────────────────────────────────────────────
print("\n🏟️ Major stadiums (40k+ capacity)...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cap ?cc WHERE {
  ?s wdt:P31/wdt:P279* wd:Q483110; wdt:P625 ?coord; wdt:P1083 ?cap; rdfs:label ?name.
  OPTIONAL { ?s wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en" && ?cap > 40000)
} ORDER BY DESC(?cap) LIMIT 100""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        cap = int(float(b.get('cap',{}).get('value',0)))
        upsert(b['name']['value'], 'sports_arena', lat, lon,
               b.get('cc',{}).get('value',''),
               f"Stadium. {cap:,} capacity.", output=f"{cap:,} seats",
               featured=(cap > 80000))
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 10. Waterfalls ───────────────────────────────────────────────────────
print("\n💦 Waterfalls...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?w wdt:P31/wdt:P279* wd:Q瀑布; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?w wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 300""".replace('Q瀑布','Q34038'))
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'waterfall', lat, lon,
               b.get('cc',{}).get('value',''), 'Natural waterfall.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 11. Glaciers ─────────────────────────────────────────────────────────
print("\n🧊 Glaciers...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?g wdt:P31/wdt:P279* wd:Q35666; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?g wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 200""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'glacier', lat, lon,
               b.get('cc',{}).get('value',''), 'Glacier. Climate change indicator.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 12. Islands ──────────────────────────────────────────────────────────
print("\n🏝️ Notable islands...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?pop ?cc WHERE {
  ?island wdt:P31 wd:Q23442; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?island wdt:P1082 ?pop. }
  OPTIONAL { ?island wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en" && (!BOUND(?pop) || ?pop > 1000))
} LIMIT 300""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'island', lat, lon,
               b.get('cc',{}).get('value',''), 'Island. Geographic feature.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 13. Temples / Places of Worship ──────────────────────────────────────
print("\n🕌 Major temples and places of worship...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?temple wdt:P31/wdt:P279* wd:Q44539; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?temple wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 400""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'religious_site', lat, lon,
               b.get('cc',{}).get('value',''), 'Temple. Sacred religious site.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 14. Caves ────────────────────────────────────────────────────────────
print("\n🕳️ Caves...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?cave wdt:P31/wdt:P279* wd:Q35509; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?cave wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 150""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'cave_system', lat, lon,
               b.get('cc',{}).get('value',''), 'Cave system. Underground feature.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 15. Hydroelectric Dams ───────────────────────────────────────────────
print("\n🌊 Major dams...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?mw ?cc WHERE {
  ?dam wdt:P31/wdt:P279* wd:Q12323; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?dam wdt:P3279 ?mw. }
  OPTIONAL { ?dam wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 300""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        mw = int(float(b.get('mw',{}).get('value',0) or 0))
        upsert(b['name']['value'], 'mega_dam', lat, lon,
               b.get('cc',{}).get('value',''),
               f"Dam. {mw} MW capacity." if mw else "Hydroelectric dam.",
               output=f"{mw} MW" if mw else '',
               featured=(mw > 5000))
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 16. Ports and Harbors ────────────────────────────────────────────────
print("\n🚢 Major ports...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?port wdt:P31/wdt:P279* wd:Q44782; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?port wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 250""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'mega_port', lat, lon,
               b.get('cc',{}).get('value',''), 'Major port. Maritime hub.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 17. Beaches ──────────────────────────────────────────────────────────
print("\n🏖️ Famous beaches...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?beach wdt:P31/wdt:P279* wd:Q40080; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?beach wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 200""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'island', lat, lon,
               b.get('cc',{}).get('value',''), 'Beach. Coastal feature.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 18. Nature Reserves / Wildlife Sanctuaries ───────────────────────────
print("\n🦁 Wildlife sanctuaries...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?r wdt:P31/wdt:P279* wd:Q1380282; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?r wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 300""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'nature_sanctuary', lat, lon,
               b.get('cc',{}).get('value',''), 'Wildlife sanctuary. Protected habitat.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 19. Palaces ──────────────────────────────────────────────────────────
print("\n👑 Royal palaces...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?palace wdt:P31/wdt:P279* wd:Q16560; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?palace wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 300""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'royal_palace', lat, lon,
               b.get('cc',{}).get('value',''), 'Royal palace. Historic royal residence.')
print(f"  Done. Total: {created}")
time.sleep(5)

# ── 20. Lighthouses ──────────────────────────────────────────────────────
print("\n🗼 Lighthouses...")
rows = wikidata("""
SELECT DISTINCT ?name ?coord ?cc WHERE {
  ?lh wdt:P31/wdt:P279* wd:Q39715; wdt:P625 ?coord; rdfs:label ?name.
  OPTIONAL { ?lh wdt:P17 ?c. ?c wdt:P297 ?cc. }
  FILTER(lang(?name)="en")
} LIMIT 200""")
for b in rows:
    lat, lon = coord(b)
    if lat:
        upsert(b['name']['value'], 'chokepoint', lat, lon,
               b.get('cc',{}).get('value',''), 'Lighthouse. Maritime navigation aid.')
time.sleep(3)

total = UnifiedPOI.objects.count()
with_img = UnifiedPOI.objects.exclude(wiki_url='').count()
countries = UnifiedPOI.objects.values('country_code').distinct().count()

print(f"""
{'='*50}
✅ HARVEST COMPLETE
   New POIs: {created}
   Already existed: {skipped}
   Errors: {errors}
   ─────────────────
   TOTAL IN DB: {total:,}
   Countries: {countries}
   With images: {with_img} ({with_img*100//max(total,1)}%)
{'='*50}
""")
