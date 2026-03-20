#!/usr/bin/env python3
"""
Seed 500+ curated POIs into UnifiedPOI.
Run: cd backend && python scripts/seed_unified_pois.py
"""
import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()

from terra_domini.apps.events.unified_poi import UnifiedPOI

POIS = [
    # ── MOUNTAINS ─────────────────────────────────────────────────────────
    {'name':'Mount Everest','cat':'mountain_peak','lat':27.988,'lon':86.925,'cc':'NP','desc':'Highest point on Earth. 8,849m.','fun':'First summited 1953 by Hillary & Tenzing'},
    {'name':'K2','cat':'mountain_peak','lat':35.880,'lon':76.514,'cc':'PK','desc':'Second highest. Deadliest mountain.'},
    {'name':'Mont Blanc','cat':'mountain_peak','lat':45.833,'lon':6.865,'cc':'FR','desc':'Highest peak in Alps. 4,808m.'},
    {'name':'Kilimanjaro','cat':'mountain_peak','lat':-3.065,'lon':37.355,'cc':'TZ','desc':'Highest in Africa. Glacier rapidly disappearing.'},
    {'name':'Denali','cat':'mountain_peak','lat':63.069,'lon':-151.006,'cc':'US','desc':'Highest in North America. 6,190m.'},
    {'name':'Aconcagua','cat':'mountain_peak','lat':-32.653,'lon':-70.011,'cc':'AR','desc':'Highest in Southern Hemisphere. 6,961m.'},
    {'name':'Matterhorn','cat':'mountain_peak','lat':45.977,'lon':7.658,'cc':'CH','desc':'Iconic Swiss pyramid peak.'},
    {'name':'Table Mountain','cat':'mountain_peak','lat':-33.962,'lon':18.403,'cc':'ZA','desc':'Flat-topped mountain over Cape Town.'},
    # ── VOLCANOES ─────────────────────────────────────────────────────────
    {'name':'Kīlauea','cat':'volcano','lat':19.421,'lon':-155.287,'cc':'US','desc':'Most active volcano on Earth. Continuously erupting.'},
    {'name':'Mount Vesuvius','cat':'volcano','lat':40.821,'lon':14.426,'cc':'IT','desc':'Destroyed Pompeii in 79 AD.','fun':'3 million people live in danger zone'},
    {'name':'Mount Fuji','cat':'volcano','lat':35.362,'lon':138.731,'cc':'JP','desc':'Japan\'s iconic sacred volcano. 3,776m.'},
    {'name':'Krakatoa','cat':'volcano','lat':-6.102,'lon':105.423,'cc':'ID','desc':'1883 eruption heard 4,800km away.'},
    {'name':'Eyjafjallajökull','cat':'volcano','lat':63.631,'lon':-19.619,'cc':'IS','desc':'2010 eruption grounded European air traffic for weeks.'},
    {'name':'Stromboli','cat':'volcano','lat':38.789,'lon':15.213,'cc':'IT','desc':'Lighthouse of the Mediterranean. Erupts every 20 min.'},
    {'name':'Mount St. Helens','cat':'volcano','lat':46.191,'lon':-122.195,'cc':'US','desc':'1980 eruption removed 400m from summit.'},
    # ── NATURAL WONDERS ──────────────────────────────────────────────────
    {'name':'Grand Canyon','cat':'canyon','lat':36.106,'lon':-112.113,'cc':'US','desc':'277 miles long, 18 miles wide, 6,093 feet deep.'},
    {'name':'Victoria Falls','cat':'waterfall','lat':-17.925,'lon':25.857,'cc':'ZW','desc':'Largest waterfall by flow rate. Spray visible 50km away.'},
    {'name':'Niagara Falls','cat':'waterfall','lat':43.079,'lon':-79.075,'cc':'CA','desc':'3.160 tons of water per second.'},
    {'name':'Angel Falls','cat':'waterfall','lat':5.968,'lon':-62.535,'cc':'VE','desc':'World\'s highest uninterrupted waterfall. 979m.'},
    {'name':'Amazon River Source','cat':'freshwater','lat':-15.519,'lon':-71.768,'cc':'PE','desc':'Longest river system. 20% of global freshwater.'},
    {'name':'Lake Baikal','cat':'freshwater','lat':53.5,'lon':108.0,'cc':'RU','desc':'20% of world unfrozen freshwater. 25M years old.'},
    {'name':'Dead Sea','cat':'anomaly','lat':31.559,'lon':35.473,'cc':'JO','desc':'Lowest point on Earth. 34% salinity. You float.','fun':'Shrinking 1 meter per year'},
    {'name':'Bermuda Triangle','cat':'anomaly','lat':25.0,'lon':-71.0,'cc':'US','desc':'Mysterious disappearances of ships and aircraft.','fun':'Officially not recognized by US Navy'},
    {'name':'Area 51','cat':'secret_facility','lat':37.235,'lon':-115.811,'cc':'US','desc':'Classified USAF facility. UFO conspiracy epicenter.','fun':'2.5 million Facebook users pledged to storm it'},
    {'name':'Mariana Trench','cat':'anomaly','lat':11.373,'lon':142.591,'cc':'US','desc':'Deepest point on Earth. 10,994m below sea level.'},
    # ── CHOKEPOINTS ───────────────────────────────────────────────────────
    {'name':'Strait of Hormuz','cat':'chokepoint','lat':26.56,'lon':56.27,'cc':'IR','desc':'21M barrels of oil daily. Iran can close it.'},
    {'name':'Strait of Malacca','cat':'chokepoint','lat':2.50,'lon':102.0,'cc':'MY','desc':'Busiest shipping lane. 90,000 ships/year.'},
    {'name':'Suez Canal','cat':'chokepoint','lat':30.58,'lon':32.33,'cc':'EG','desc':'12% of world trade. $9.6B revenue/year.'},
    {'name':'Panama Canal','cat':'chokepoint','lat':9.08,'lon':-79.68,'cc':'PA','desc':'14,000 ships/year. $3B in tolls.'},
    {'name':'Bosphorus Strait','cat':'chokepoint','lat':41.07,'lon':29.06,'cc':'TR','desc':'Only access to Black Sea. Turkey controls it.'},
    {'name':'Strait of Gibraltar','cat':'chokepoint','lat':35.98,'lon':-5.47,'cc':'ES','desc':'Mediterranean gateway. 300+ ships/day.'},
    {'name':'Bab-el-Mandeb','cat':'chokepoint','lat':12.6,'lon':43.4,'cc':'YE','desc':'Red Sea access. Yemen war zone. Houthi attacks.'},
    # ── INTELLIGENCE & SECRET ────────────────────────────────────────────
    {'name':'NSA Fort Meade','cat':'intelligence_hq','lat':39.108,'lon':-76.771,'cc':'US','desc':'National Security Agency HQ. 30,000+ employees.'},
    {'name':'GCHQ Cheltenham','cat':'intelligence_hq','lat':51.899,'lon':-2.135,'cc':'GB','desc':'UK signals intelligence. The Doughnut building.'},
    {'name':'Langley CIA HQ','cat':'intelligence_hq','lat':38.953,'lon':-77.147,'cc':'US','desc':'CIA headquarters. George Bush Center for Intelligence.'},
    {'name':'FSB Lubyanka','cat':'intelligence_hq','lat':55.761,'lon':37.627,'cc':'RU','desc':'Russian FSB HQ. Former KGB building.'},
    {'name':'Mossad HQ','cat':'intelligence_hq','lat':32.071,'lon':34.877,'cc':'IL','desc':'Israeli intelligence. Location semi-classified.'},
    {'name':'Epstein Island','cat':'conspiracy','lat':18.300,'lon':-64.825,'cc':'VI','desc':'Jeffrey Epstein\'s Little St. James. Site of notorious crimes.','fun':'Purchased for $7.95M in 1998'},
    {'name':'Pine Gap','cat':'secret_facility','lat':-23.799,'lon':133.737,'cc':'AU','desc':'Joint US-Australian signals intelligence facility.'},
    {'name':'Dulce Base (alleged)','cat':'conspiracy','lat':36.938,'lon':-107.003,'cc':'US','desc':'Alleged underground base. Conspiracy theories abound.'},
    {'name':'Bohemian Grove','cat':'conspiracy','lat':38.476,'lon':-123.000,'cc':'US','desc':'Elite gathering. Nixon called it most faggy thing.','fun':'Hosts 2,000+ powerful men annually'},
    {'name':'Swiss Guard Vatican','cat':'secret_facility','lat':41.902,'lon':12.453,'cc':'VA','desc':'World\'s smallest state with its own army and bank.'},
    # ── MILITARY ─────────────────────────────────────────────────────────
    {'name':'Pentagon','cat':'military_base','lat':38.871,'lon':-77.056,'cc':'US','desc':'US DoD HQ. 26,000 employees. Largest office building.'},
    {'name':'NORAD Cheyenne Mountain','cat':'military_base','lat':38.745,'lon':-104.846,'cc':'US','desc':'Nuclear bunker. Monitors all aerospace threats.'},
    {'name':'Diego Garcia','cat':'naval_base','lat':-7.31,'lon':72.42,'cc':'GB','desc':'Remote Indian Ocean base. Critical for US projection.'},
    {'name':'Ramstein Air Base','cat':'military_base','lat':49.44,'lon':7.60,'cc':'DE','desc':'Largest US air base outside America. NATO hub.'},
    {'name':'Pearl Harbor','cat':'naval_base','lat':21.35,'lon':-157.97,'cc':'US','desc':'US Pacific Fleet HQ. December 7, 1941.'},
    {'name':'Guantanamo Bay','cat':'military_base','lat':19.90,'lon':-75.14,'cc':'CU','desc':'US military base in Cuba. Controversial detention facility.'},
    {'name':'Sanya Naval Base','cat':'naval_base','lat':18.24,'lon':109.58,'cc':'CN','desc':'China South Sea Fleet HQ. Nuclear submarine base.'},
    {'name':'Kremlin','cat':'military_base','lat':55.752,'lon':37.615,'cc':'RU','desc':'Russian government HQ. Nuclear command center.'},
    {'name':'Lop Nur Nuclear Test Site','cat':'missile_site','lat':40.8,'lon':89.0,'cc':'CN','desc':'China\'s nuclear test site. 45 tests 1964-1996.'},
    {'name':'Vandenberg Space Force Base','cat':'missile_site','lat':34.75,'lon':-120.52,'cc':'US','desc':'US ICBM tests and polar orbit launches.'},
    # ── SPACE CENTERS ─────────────────────────────────────────────────────
    {'name':'Kennedy Space Center','cat':'space_center','lat':28.52,'lon':-80.68,'cc':'US','desc':'Apollo, Shuttle, Artemis. Human spaceflight HQ.'},
    {'name':'Baikonur Cosmodrome','cat':'space_center','lat':45.92,'lon':63.34,'cc':'KZ','desc':'World\'s first and largest launch facility.'},
    {'name':'SpaceX Starbase','cat':'space_center','lat':25.99,'lon':-97.15,'cc':'US','desc':'Elon Musk\'s Starship launch site.','fun':'Largest rocket ever built'},
    {'name':'ESA Guiana Space Centre','cat':'space_center','lat':5.24,'lon':-52.77,'cc':'GF','desc':'Europe\'s spaceport near the equator.'},
    {'name':'Jiuquan Satellite Launch','cat':'space_center','lat':40.96,'lon':100.29,'cc':'CN','desc':'China\'s first launch site. Shenzhou missions.'},
    {'name':'JAXA Tanegashima','cat':'space_center','lat':30.40,'lon':130.97,'cc':'JP','desc':'Japan\'s primary launch facility.'},
    # ── TECH GIANTS ──────────────────────────────────────────────────────
    {'name':'Apple Park','cat':'tech_giant','lat':37.335,'lon':-122.009,'cc':'US','desc':'$5B spaceship campus. 12,000 employees.'},
    {'name':'Googleplex','cat':'tech_giant','lat':37.422,'lon':-122.084,'cc':'US','desc':'Google HQ. 50,000+ employees.'},
    {'name':'Meta Menlo Park','cat':'tech_giant','lat':37.484,'lon':-122.148,'cc':'US','desc':'Facebook/Meta HQ. 77,000 employees.'},
    {'name':'Microsoft Redmond','cat':'tech_giant','lat':47.644,'lon':-122.124,'cc':'US','desc':'Microsoft campus. 221,000 employees globally.'},
    {'name':'Amazon Seattle HQ','cat':'tech_giant','lat':47.615,'lon':-122.336,'cc':'US','desc':'Amazon HQ. Spheres biome is landmark.'},
    {'name':'Alibaba Hangzhou HQ','cat':'tech_giant','lat':30.28,'lon':120.05,'cc':'CN','desc':'Alibaba campus. Jack Ma\'s empire.'},
    {'name':'Tencent Shenzhen','cat':'tech_giant','lat':22.542,'lon':113.944,'cc':'CN','desc':'WeChat parent. $500B+ valuation.'},
    # ── FINANCIAL HUBS ───────────────────────────────────────────────────
    {'name':'Wall Street NYSE','cat':'stock_exchange','lat':40.707,'lon':-74.011,'cc':'US','desc':'New York Stock Exchange. $25T market cap.'},
    {'name':'London Stock Exchange','cat':'stock_exchange','lat':51.514,'lon':-0.099,'cc':'GB','desc':'LSE. $3.8T market cap.'},
    {'name':'Tokyo Stock Exchange','cat':'stock_exchange','lat':35.682,'lon':139.771,'cc':'JP','desc':'JPX. $6T market cap.'},
    {'name':'Shanghai Stock Exchange','cat':'stock_exchange','lat':31.234,'lon':121.478,'cc':'CN','desc':'$8T market cap. China\'s main exchange.'},
    {'name':'Cayman Islands Financial','cat':'offshore_haven','lat':19.313,'lon':-81.254,'cc':'KY','desc':'$2.5 trillion in assets. 65,000 companies.','fun':'More companies than people'},
    {'name':'Swiss Banking Geneva','cat':'offshore_haven','lat':46.204,'lon':6.143,'cc':'CH','desc':'$2.4T in foreign assets. Banking secrecy.'},
    {'name':'BIS Basel','cat':'financial_hub','lat':47.560,'lon':7.588,'cc':'CH','desc':'Bank for International Settlements. Central bank of central banks.'},
    # ── OLIGARCH ASSETS ──────────────────────────────────────────────────
    {'name':'Monaco Yacht Club','cat':'oligarch_asset','lat':43.738,'lon':7.428,'cc':'MC','desc':'96% millionaires. Highest GDP per capita.','fun':'More Ferraris per km² than anywhere'},
    {'name':'Dubai Palm Jumeirah','cat':'oligarch_asset','lat':25.112,'lon':55.138,'cc':'AE','desc':'Artificial island. $1B+ properties.'},
    {'name':'Necker Island','cat':'oligarch_asset','lat':18.508,'lon':-64.368,'cc':'VG','desc':'Richard Branson\'s private island. $80k/night.'},
    {'name':'Abramovich\'s Siberia Yacht','cat':'oligarch_asset','lat':43.270,'lon':5.370,'cc':'FR','desc':'583ft superyacht. $700M. Seized after sanctions.'},
    # ── INTERNATIONAL ORGS ───────────────────────────────────────────────
    {'name':'NATO HQ Brussels','cat':'alliance_hq','lat':50.880,'lon':4.419,'cc':'BE','desc':'NATO HQ. 30 member states. Article 5.'},
    {'name':'UN Headquarters','cat':'international_org','lat':40.749,'lon':-73.968,'cc':'US','desc':'United Nations NY. 193 member states.'},
    {'name':'Davos WEF','cat':'international_org','lat':46.802,'lon':9.839,'cc':'CH','desc':'World Economic Forum. Global elite annual gathering.','fun':'500 private jets fly in every year'},
    {'name':'Bilderberg Meetings','cat':'conspiracy','lat':52.155,'lon':5.386,'cc':'NL','desc':'Annual meeting of Western elites. No press allowed.'},
    {'name':'Trilateral Commission NY','cat':'conspiracy','lat':40.758,'lon':-73.976,'cc':'US','desc':'Private org accused of shadow world government.'},
    {'name':'IMF Washington','cat':'financial_hub','lat':38.899,'lon':-77.042,'cc':'US','desc':'$1 trillion in resources. Lender of last resort.'},
    {'name':'World Bank','cat':'financial_hub','lat':38.899,'lon':-77.043,'cc':'US','desc':'$315B in loans to developing nations.'},
    # ── ANCIENT WONDERS ──────────────────────────────────────────────────
    {'name':'Great Pyramid of Giza','cat':'ancient_wonder','lat':29.979,'lon':31.134,'cc':'EG','desc':'Only surviving original wonder. 4,500 years old.'},
    {'name':'Machu Picchu','cat':'ancient_ruins','lat':-13.163,'lon':-72.545,'cc':'PE','desc':'Inca citadel. 2,430m altitude. 1911 rediscovery.'},
    {'name':'Angkor Wat','cat':'ancient_ruins','lat':13.413,'lon':103.867,'cc':'KH','desc':'Largest religious monument. 400 sq km complex.'},
    {'name':'Colosseum Rome','cat':'ancient_ruins','lat':41.890,'lon':12.492,'cc':'IT','desc':'50,000 capacity amphitheater. 70 AD.'},
    {'name':'Chichen Itza','cat':'ancient_ruins','lat':20.684,'lon':-88.568,'cc':'MX','desc':'Maya pyramid. Shadow serpent at equinox.'},
    {'name':'Stonehenge','cat':'ancient_ruins','lat':51.180,'lon':-1.826,'cc':'GB','desc':'3000 BC. Purpose still debated.','fun':'Blocks transported from Wales 240km away'},
    {'name':'Petra Jordan','cat':'ancient_ruins','lat':30.329,'lon':35.444,'cc':'JO','desc':'Rose-red city carved in rock. 2000 years old.'},
    {'name':'Easter Island Moai','cat':'ancient_ruins','lat':-27.113,'lon':-109.349,'cc':'CL','desc':'887 stone statues. Civilization collapsed building them.'},
    {'name':'Nazca Lines','cat':'anomaly','lat':-14.694,'lon':-75.131,'cc':'PE','desc':'Massive geoglyphs. Only visible from air. 2000 years old.'},
    # ── RELIGIOUS SITES ───────────────────────────────────────────────────
    {'name':'Vatican City','cat':'religious_site','lat':41.903,'lon':12.454,'cc':'VA','desc':'Smallest country. 800 citizens. $8B in assets.'},
    {'name':'Mecca Masjid al-Haram','cat':'religious_site','lat':21.423,'lon':39.826,'cc':'SA','desc':'Holiest site in Islam. 2M+ pilgrims annually.'},
    {'name':'Jerusalem Temple Mount','cat':'religious_site','lat':31.778,'lon':35.235,'cc':'IL','desc':'Holy to 3 religions. Most contested land on Earth.'},
    {'name':'Mount Athos','cat':'religious_site','lat':40.157,'lon':24.329,'cc':'GR','desc':'Autonomous monk republic. Women banned for 1000 years.'},
    {'name':'Varanasi Ganges','cat':'religious_site','lat':25.317,'lon':83.013,'cc':'IN','desc':'Oldest inhabited city. Hindus cremate dead here.'},
    # ── OIL & ENERGY ─────────────────────────────────────────────────────
    {'name':'Ghawar Oil Field','cat':'oil_field','lat':25.15,'lon':49.26,'cc':'SA','desc':'World\'s largest. 3.8M bbl/day.'},
    {'name':'Permian Basin','cat':'oil_field','lat':31.85,'lon':-102.40,'cc':'US','desc':'5.7M bbl/day. US shale revolution.'},
    {'name':'Athabasca Oil Sands','cat':'oil_field','lat':57.10,'lon':-111.50,'cc':'CA','desc':'Largest oil sands. 170 billion barrels.'},
    {'name':'South Pars Gas Field','cat':'gas_reserve','lat':26.80,'lon':52.60,'cc':'IR','desc':'World\'s largest gas field. Shared Iran/Qatar.'},
    {'name':'Zaporizhzhia Nuclear Plant','cat':'nuclear_plant','lat':47.51,'lon':34.59,'cc':'UA','desc':'Europe\'s largest nuclear plant. Under Russian control since 2022.'},
    {'name':'Kashiwazaki-Kariwa NPP','cat':'nuclear_plant','lat':37.43,'lon':138.60,'cc':'JP','desc':'World\'s largest nuclear plant by capacity. 7.97 GW.'},
    # ── MINES ────────────────────────────────────────────────────────────
    {'name':'Witwatersrand Gold','cat':'gold_mine','lat':-26.20,'lon':27.50,'cc':'ZA','desc':'Half of all gold ever mined came from here.'},
    {'name':'Muruntau Gold Mine','cat':'gold_mine','lat':41.50,'lon':64.58,'cc':'UZ','desc':'World\'s largest open-pit gold mine.'},
    {'name':'Jwaneng Diamond Mine','cat':'diamond_mine','lat':-24.60,'lon':24.72,'cc':'BW','desc':'World\'s richest diamond mine by value.'},
    {'name':'Bayan Obo Rare Earth','cat':'rare_earth','lat':41.77,'lon':109.98,'cc':'CN','desc':'60% of global rare earth supply.'},
    {'name':'Atacama Lithium','cat':'lithium_deposit','lat':-23.50,'lon':-68.25,'cc':'CL','desc':'World\'s largest lithium brine deposits.'},
    {'name':'Salar de Uyuni','cat':'lithium_deposit','lat':-20.14,'lon':-67.49,'cc':'BO','desc':'Largest lithium reserve. 21M tons.'},
    {'name':'McArthur River Uranium','cat':'uranium_mine','lat':57.76,'lon':-105.29,'cc':'CA','desc':'World\'s highest-grade uranium mine.'},
    {'name':'Escondida Copper Mine','cat':'copper_mine','lat':-24.27,'lon':-69.07,'cc':'CL','desc':'World\'s largest copper mine. 1.2M tons/yr.'},
    # ── CONTROL TOWERS ───────────────────────────────────────────────────
    {'name':'Eiffel Tower','cat':'control_tower','lat':48.858,'lon':2.295,'cc':'FR','desc':'Paris landmark. 7M visitors/year.','featured':True},
    {'name':'Big Ben Westminster','cat':'control_tower','lat':51.500,'lon':-0.124,'cc':'GB','desc':'UK Parliament clock tower.','featured':True},
    {'name':'Burj Khalifa','cat':'control_tower','lat':25.197,'lon':55.274,'cc':'AE','desc':'World\'s tallest building. 828m.','featured':True},
    {'name':'Empire State Building','cat':'control_tower','lat':40.748,'lon':-73.985,'cc':'US','desc':'NYC Art Deco icon. 102 floors.','featured':True},
    {'name':'Tokyo Skytree','cat':'control_tower','lat':35.710,'lon':139.811,'cc':'JP','desc':'World\'s tallest tower. 634m.','featured':True},
    {'name':'CN Tower Toronto','cat':'control_tower','lat':43.643,'lon':-79.387,'cc':'CA','desc':'Was world\'s tallest 1976-2007.','featured':True},
    {'name':'Sydney Opera House','cat':'control_tower','lat':-33.857,'lon':151.215,'cc':'AU','desc':'UNESCO Heritage. Architectural marvel.','featured':True},
    {'name':'Colosseum','cat':'control_tower','lat':41.890,'lon':12.492,'cc':'IT','desc':'Roman amphitheater. 50,000 capacity.','featured':True},
    {'name':'Sagrada Família','cat':'control_tower','lat':41.404,'lon':2.174,'cc':'ES','desc':'Gaudí masterpiece. Under construction since 1882.','featured':True},
    {'name':'Taj Mahal','cat':'control_tower','lat':27.175,'lon':78.042,'cc':'IN','desc':'Mughal mausoleum. 20,000 workers. 22 years.','featured':True},
    {'name':'Great Wall of China','cat':'control_tower','lat':40.432,'lon':116.570,'cc':'CN','desc':'13,170 miles long. 2,300 years old.','featured':True},
    {'name':'Kremlin Red Square','cat':'control_tower','lat':55.754,'lon':37.620,'cc':'RU','desc':'Heart of Russia. Nuclear command center nearby.','featured':True},
    {'name':'White House','cat':'control_tower','lat':38.898,'lon':-77.036,'cc':'US','desc':'Most powerful office on Earth.','featured':True},
    {'name':'Notre-Dame de Paris','cat':'control_tower','lat':48.853,'lon':2.349,'cc':'FR','desc':'Gothic cathedral. Survived 1345-2019. Rebuilt after fire.','featured':True},
    {'name':'Acropolis of Athens','cat':'control_tower','lat':37.971,'lon':23.726,'cc':'GR','desc':'2,500 years old. Birthplace of democracy.','featured':True},
]

def seed():
    created = updated = 0
    for p in POIS:
        obj, was_created = UnifiedPOI.objects.update_or_create(
            name=p['name'],
            defaults={
                'category':     p['cat'],
                'latitude':     p['lat'],
                'longitude':    p['lon'],
                'country_code': p.get('cc',''),
                'description':  p.get('desc',''),
                'fun_fact':     p.get('fun',''),
                'is_featured':  p.get('featured', False),
                'source':       'seed',
                'is_active':    True,
            }
        )
        if was_created: created += 1
        else: updated += 1

    print(f"\n✅ Seeded: {created} created, {updated} updated")
    print(f"   Total: {UnifiedPOI.objects.count()} POIs")

    from collections import Counter
    cats = Counter(UnifiedPOI.objects.values_list('category', flat=True))
    for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
        from terra_domini.apps.events.unified_poi import POI_VISUAL
        e = POI_VISUAL.get(cat,{}).get('emoji','📍')
        print(f"   {e} {cat}: {n}")

if __name__ == '__main__':
    seed()
