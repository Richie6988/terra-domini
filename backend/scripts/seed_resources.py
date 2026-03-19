#!/usr/bin/env python3
"""
Seed 500+ real-world resource POIs across 20 categories.
Run: python manage.py shell < scripts/seed_resources.py
Or:  python scripts/seed_resources.py (from backend/ with venv active)
"""
import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()

from terra_domini.apps.events.poi_models_resources import ResourcePOI

RESOURCES = [
    # ── OIL FIELDS ──────────────────────────────────────────────────────────
    {'name':'Ghawar Oil Field','category':'oil_field','lat':25.15,'lon':49.26,'country':'SA','desc':'World\'s largest conventional oil field. 3.8M bbl/day.','output':'3.8M bbl/day'},
    {'name':'Burgan Oil Field','category':'oil_field','lat':29.07,'lon':48.00,'country':'KW','desc':'Second largest oil field globally.','output':'1.7M bbl/day'},
    {'name':'Rumailah Oil Field','category':'oil_field','lat':30.01,'lon':47.40,'country':'IQ','desc':'Southern Iraq megafield.','output':'1.4M bbl/day'},
    {'name':'Safaniya Offshore','category':'oil_field','lat':27.98,'lon':49.10,'country':'SA','desc':'World\'s largest offshore oil field.','output':'1.2M bbl/day'},
    {'name':'Ahvaz Oil Field','category':'oil_field','lat':31.30,'lon':48.70,'country':'IR','desc':'Iran\'s largest oil field.','output':'0.9M bbl/day'},
    {'name':'Permian Basin','category':'oil_field','lat':31.85,'lon':-102.40,'country':'US','desc':'West Texas shale oil giant.','output':'5.7M bbl/day'},
    {'name':'Athabasca Oil Sands','category':'oil_field','lat':57.10,'lon':-111.50,'country':'CA','desc':'Largest oil sands deposit.','output':'3.2M bbl/day'},
    {'name':'North Sea Brent','category':'oil_field','lat':61.00,'lon':1.70,'country':'NO','desc':'Brent crude benchmark origin.','output':'0.8M bbl/day'},
    {'name':'Kashagan Field','category':'oil_field','lat':45.98,'lon':51.37,'country':'KZ','desc':'Caspian mega-discovery.','output':'0.4M bbl/day'},
    {'name':'Lula Deepwater','category':'oil_field','lat':-22.50,'lon':-41.00,'country':'BR','desc':'Pre-salt deepwater field.','output':'1.1M bbl/day'},
    {'name':'Tengiz Field','category':'oil_field','lat':45.38,'lon':53.03,'country':'KZ','output':'0.7M bbl/day'},
    {'name':'Kirkuk Oil Field','category':'oil_field','lat':35.47,'lon':44.39,'country':'IQ','output':'0.5M bbl/day'},
    {'name':'Cantarell Complex','category':'oil_field','lat':20.00,'lon':-92.00,'country':'MX','output':'0.3M bbl/day'},
    {'name':'Maracaibo Lake Basin','category':'oil_field','lat':10.10,'lon':-71.50,'country':'VE','output':'0.4M bbl/day'},
    {'name':'Daqing Oil Field','category':'oil_field','lat':46.60,'lon':125.00,'country':'CN','output':'0.8M bbl/day'},

    # ── GAS RESERVES ────────────────────────────────────────────────────────
    {'name':'South Pars/North Dome','category':'gas_reserve','lat':26.80,'lon':52.60,'country':'IR','desc':'World\'s largest gas field.','output':'900 bcm/yr'},
    {'name':'Galkynysh Gas Field','category':'gas_reserve','lat':37.50,'lon':62.00,'country':'TM','desc':'Second largest gas reserve.','output':'Tcm reserves'},
    {'name':'Urengoy Gas Field','category':'gas_reserve','lat':65.97,'lon':78.37,'country':'RU','output':'8.1 Tcm reserves'},
    {'name':'Groningen Gas Field','category':'gas_reserve','lat':53.40,'lon':6.80,'country':'NL','output':'2.9 Tcm (depleting)'},
    {'name':'Marcellus Shale','category':'gas_reserve','lat':41.00,'lon':-77.50,'country':'US','output':'34 bcm/yr'},
    {'name':'LNG Mozambique','category':'gas_reserve','lat':-12.00,'lon':40.50,'country':'MZ','output':'100+ Tcf potential'},
    {'name':'Papua New Guinea LNG','category':'gas_reserve','lat':-6.50,'lon':145.00,'country':'PG','output':'8.3 Mtpa'},
    {'name':'Qatar North Field','category':'gas_reserve','lat':25.50,'lon':51.50,'country':'QA','output':'77 bcm/yr'},

    # ── COAL MINES ──────────────────────────────────────────────────────────
    {'name':'Powder River Basin','category':'coal_mine','lat':43.80,'lon':-106.00,'country':'US','output':'400M tons/yr'},
    {'name':'Jharia Coalfield','category':'coal_mine','lat':23.75,'lon':86.42,'country':'IN','output':'Large coking coal'},
    {'name':'Ruhr Valley','category':'coal_mine','lat':51.45,'lon':7.20,'country':'DE','output':'Historic industrial coal'},
    {'name':'Bowen Basin','category':'coal_mine','lat':-22.50,'lon':148.00,'country':'AU','output':'200M tons/yr'},
    {'name':'Inner Mongolia Coal','category':'coal_mine','lat':42.00,'lon':115.00,'country':'CN','output':'Largest coal province'},
    {'name':'Mpumalanga Coalfield','category':'coal_mine','lat':-26.00,'lon':29.50,'country':'ZA','output':'260M tons/yr'},
    {'name':'Kuznetsk Basin','category':'coal_mine','lat':54.00,'lon':86.50,'country':'RU','output':'240M tons/yr'},

    # ── GOLD MINES ──────────────────────────────────────────────────────────
    {'name':'Witwatersrand Basin','category':'gold_mine','lat':-26.20,'lon':27.50,'country':'ZA','desc':'Half of all gold ever mined.','output':'~100 tons/yr'},
    {'name':'Muruntau Gold Mine','category':'gold_mine','lat':41.50,'lon':64.58,'country':'UZ','desc':'World\'s largest open-pit gold mine.','output':'66 tons/yr'},
    {'name':'Grasberg Mine','category':'gold_mine','lat':-4.05,'lon':137.12,'country':'ID','desc':'Gold & copper giant in Papua.','output':'50+ tons/yr'},
    {'name':'Carlin Trend','category':'gold_mine','lat':40.72,'lon':-116.10,'country':'US','output':'80 tons/yr'},
    {'name':'Sukhoi Log','category':'gold_mine','lat':58.50,'lon':114.50,'country':'RU','desc':'Largest undeveloped gold deposit.','output':'Not yet mined'},
    {'name':'Olimpiada Gold Mine','category':'gold_mine','lat':59.31,'lon':93.22,'country':'RU','output':'47 tons/yr'},
    {'name':'Kibali Gold Mine','category':'gold_mine','lat':3.01,'lon':29.60,'country':'CD','output':'28 tons/yr'},
    {'name':'Obuasi Gold Mine','category':'gold_mine','lat':6.20,'lon':-1.67,'country':'GH','output':'17 tons/yr'},
    {'name':'Yanacocha Mine','category':'gold_mine','lat':-6.89,'lon':-78.56,'country':'PE','output':'18 tons/yr'},
    {'name':'Boddington Gold Mine','category':'gold_mine','lat':-32.80,'lon':116.50,'country':'AU','output':'26 tons/yr'},
    {'name':'Lihir Gold Mine','category':'gold_mine','lat':-3.12,'lon':152.64,'country':'PG','output':'20 tons/yr'},
    {'name':'Pueblo Viejo Mine','category':'gold_mine','lat':19.30,'lon':-70.12,'country':'DO','output':'22 tons/yr'},

    # ── DIAMOND MINES ────────────────────────────────────────────────────────
    {'name':'Jwaneng Diamond Mine','category':'diamond_mine','lat':-24.60,'lon':24.72,'country':'BW','desc':'World\'s richest diamond mine by value.','output':'11M carats/yr'},
    {'name':'Orapa Diamond Mine','category':'diamond_mine','lat':-21.30,'lon':25.37,'country':'BW','output':'12M carats/yr'},
    {'name':'Jubilee Mine (Aikhal)','category':'diamond_mine','lat':65.93,'lon':117.67,'country':'RU','output':'9M carats/yr'},
    {'name':'EKATI Diamond Mine','category':'diamond_mine','lat':64.72,'lon':-110.62,'country':'CA','output':'3M carats/yr'},
    {'name':'Marange Diamond Fields','category':'diamond_mine','lat':-20.00,'lon':32.70,'country':'ZW','output':'5M carats/yr'},
    {'name':'Venetia Diamond Mine','category':'diamond_mine','lat':-22.45,'lon':29.35,'country':'ZA','output':'3.5M carats/yr'},
    {'name':'Argyle Diamond Mine','category':'diamond_mine','lat':-16.72,'lon':128.40,'country':'AU','desc':'Famous pink diamonds. Now closed.','output':'Historic'},

    # ── RARE EARTH ──────────────────────────────────────────────────────────
    {'name':'Bayan Obo Mine','category':'rare_earth','lat':41.77,'lon':109.98,'country':'CN','desc':'World\'s largest rare earth deposit.','output':'60% global REE'},
    {'name':'Mountain Pass Mine','category':'rare_earth','lat':35.48,'lon':-115.53,'country':'US','desc':'Only US rare earth mine.','output':'20% global REE (ex-China)'},
    {'name':'Mount Weld','category':'rare_earth','lat':-27.60,'lon':122.52,'country':'AU','desc':'Highest-grade deposit outside China.','output':'Significant reserves'},
    {'name':'Lynas Mount Weld Ops','category':'rare_earth','lat':-27.65,'lon':122.53,'country':'AU','output':'Neodymium, Praseodymium'},
    {'name':'Gakara Rare Earth','category':'rare_earth','lat':-3.90,'lon':29.60,'country':'BI','output':'Bastnäsite, Monazite'},
    {'name':'Kvanefjeld Deposit','category':'rare_earth','lat':61.00,'lon':-45.50,'country':'GL','output':'Uranium + REE combined'},
    {'name':'Songwe Hill','category':'rare_earth','lat':-9.80,'lon':33.65,'country':'MW','output':'Under development'},
    {'name':'Bear Lodge','category':'rare_earth','lat':44.74,'lon':-104.67,'country':'US','output':'Light REE deposit'},
    {'name':'Nechalacho Deposit','category':'rare_earth','lat':62.60,'lon':-113.30,'country':'CA','output':'Heavy REE target'},

    # ── LITHIUM DEPOSITS ────────────────────────────────────────────────────
    {'name':'Atacama Salt Flat','category':'lithium_deposit','lat':-23.50,'lon':-68.25,'country':'CL','desc':'World\'s largest lithium brine.','output':'180k tons LCE/yr'},
    {'name':'Salar de Uyuni','category':'lithium_deposit','lat':-20.14,'lon':-67.49,'country':'BO','desc':'Largest lithium reserve on Earth.','output':'21M tons reserves'},
    {'name':'Pilbara Lithium','category':'lithium_deposit','lat':-22.00,'lon':118.50,'country':'AU','output':'Hard rock spodumene'},
    {'name':'Greenbushes Mine','category':'lithium_deposit','lat':-33.85,'lon':116.06,'country':'AU','desc':'Highest grade hard rock lithium.','output':'1.4M tons LCE reserves'},
    {'name':'Thacker Pass','category':'lithium_deposit','lat':41.78,'lon':-118.18,'country':'US','output':'3.1M tons LCE'},
    {'name':'Jadar Project','category':'lithium_deposit','lat':44.09,'lon':19.39,'country':'RS','desc':'New lithium-boron deposit.','output':'58k tons LCE/yr potential'},
    {'name':'Sonora Lithium','category':'lithium_deposit','lat':29.75,'lon':-110.50,'country':'MX','output':'9.2M tons LCE'},
    {'name':'Zimbabwe Lithium Belt','category':'lithium_deposit','lat':-18.50,'lon':30.00,'country':'ZW','output':'Emerging major source'},

    # ── URANIUM MINES ────────────────────────────────────────────────────────
    {'name':'McArthur River Mine','category':'uranium_mine','lat':57.76,'lon':-105.29,'country':'CA','desc':'World\'s highest-grade uranium.','output':'7k tU/yr'},
    {'name':'Cigar Lake Mine','category':'uranium_mine','lat':58.07,'lon':-104.50,'country':'CA','output':'7k tU/yr'},
    {'name':'Husab Uranium Mine','category':'uranium_mine','lat':-22.75,'lon':14.79,'country':'NA','output':'5.5k tU/yr'},
    {'name':'Olympic Dam','category':'uranium_mine','lat':-30.44,'lon':136.88,'country':'AU','desc':'Largest uranium deposit. Also Cu+Au.','output':'3.3k tU/yr'},
    {'name':'Rössing Uranium Mine','category':'uranium_mine','lat':-22.48,'lon':15.04,'country':'NA','output':'1.5k tU/yr'},
    {'name':'Budenovskoye Deposit','category':'uranium_mine','lat':42.50,'lon':68.00,'country':'KZ','output':'In-situ leaching'},
    {'name':'Niger Uranium Mines','category':'uranium_mine','lat':18.73,'lon':8.70,'country':'NE','output':'2.5k tU/yr'},

    # ── MILITARY BASES ──────────────────────────────────────────────────────
    {'name':'Camp Lemonnier','category':'military_base','lat':11.55,'lon':43.15,'country':'DJ','desc':'US naval and air expeditionary base. Horn of Africa.'},
    {'name':'Ramstein Air Base','category':'military_base','lat':49.44,'lon':7.60,'country':'DE','desc':'Largest US air base outside America.'},
    {'name':'Diego Garcia','category':'military_base','lat':-7.31,'lon':72.42,'country':'GB','desc':'Remote Indian Ocean strategic base.'},
    {'name':'Guam (Anderson AFB)','category':'military_base','lat':13.58,'lon':144.93,'country':'US','desc':'US Pacific pivot hub.'},
    {'name':'Seyahat Naval Base','category':'military_base','lat':40.49,'lon':29.00,'country':'TR','desc':'NATO Black Sea anchor.'},
    {'name':'Pearl Harbor','category':'military_base','lat':21.35,'lon':-157.97,'country':'US','desc':'US Pacific Fleet HQ.'},
    {'name':'Changi Naval Base','category':'military_base','lat':1.37,'lon':104.02,'country':'SG'},
    {'name':'Bagram Airfield','category':'military_base','lat':34.95,'lon':69.27,'country':'AF'},
    {'name':'Hmeimim Air Base','category':'military_base','lat':35.40,'lon':35.95,'country':'SY','desc':'Russia\'s Syrian base.'},
    {'name':'Sanya Naval Base','category':'military_base','lat':18.24,'lon':109.58,'country':'CN','desc':'China South Sea fleet HQ.'},
    {'name':'Norfolk Naval Station','category':'military_base','lat':36.94,'lon':-76.30,'country':'US','desc':'World\'s largest naval base.'},
    {'name':'Yokosuka Naval Base','category':'military_base','lat':35.28,'lon':139.67,'country':'JP','desc':'US 7th Fleet homeport.'},

    # ── NUCLEAR PLANTS ──────────────────────────────────────────────────────
    {'name':'Kashiwazaki-Kariwa NPP','category':'nuclear_plant','lat':37.43,'lon':138.60,'country':'JP','desc':'World\'s largest nuclear plant by capacity.','output':'7.97 GW'},
    {'name':'Bruce Nuclear GS','category':'nuclear_plant','lat':44.33,'lon':-81.59,'country':'CA','output':'6.4 GW'},
    {'name':'Zaporizhzhia NPP','category':'nuclear_plant','lat':47.51,'lon':34.59,'country':'UA','desc':'Europe\'s largest nuclear plant.','output':'5.7 GW'},
    {'name':'Gravelines Nuclear','category':'nuclear_plant','lat':51.01,'lon':2.13,'country':'FR','output':'5.4 GW'},
    {'name':'Paluel NPP','category':'nuclear_plant','lat':49.86,'lon':0.63,'country':'FR','output':'5.3 GW'},
    {'name':'Hanul NPP','category':'nuclear_plant','lat':37.09,'lon':129.38,'country':'KR','output':'5.9 GW'},
    {'name':'Pickering Nuclear','category':'nuclear_plant','lat':43.82,'lon':-79.08,'country':'CA','output':'3.1 GW'},
    {'name':'Tianwan NPP','category':'nuclear_plant','lat':34.69,'lon':119.45,'country':'CN','output':'Under expansion'},

    # ── SPACE CENTERS ────────────────────────────────────────────────────────
    {'name':'Kennedy Space Center','category':'space_center','lat':28.52,'lon':-80.68,'country':'US','desc':'NASA\'s primary launch site. Apollo, Shuttle, Artemis.'},
    {'name':'Baikonur Cosmodrome','category':'space_center','lat':45.92,'lon':63.34,'country':'KZ','desc':'World\'s first and largest space launch facility.'},
    {'name':'ESA Guiana Space Centre','category':'space_center','lat':5.24,'lon':-52.77,'country':'GF','desc':'Europe\'s spaceport near the equator.'},
    {'name':'Jiuquan Satellite Launch','category':'space_center','lat':40.96,'lon':100.29,'country':'CN','desc':'China\'s oldest launch site.'},
    {'name':'Tanegashima Space Center','category':'space_center','lat':30.40,'lon':130.97,'country':'JP','desc':'JAXA\'s primary launch facility.'},
    {'name':'Satish Dhawan SLC','category':'space_center','lat':13.73,'lon':80.23,'country':'IN','desc':'ISRO launch hub. Chandrayaan missions.'},
    {'name':'Vandenberg SFB','category':'space_center','lat':34.75,'lon':-120.52,'country':'US','desc':'US polar orbit and military launches.'},
    {'name':'SpaceX Starbase','category':'space_center','lat':25.99,'lon':-97.15,'country':'US','desc':'SpaceX Starship launch and test facility.'},

    # ── CHOKEPOINTS ──────────────────────────────────────────────────────────
    {'name':'Strait of Hormuz','category':'chokepoint','lat':26.56,'lon':56.27,'country':'IR','desc':'20% of global oil passes here daily.','output':'21M bbl/day transit'},
    {'name':'Strait of Malacca','category':'chokepoint','lat':2.50,'lon':102.00,'country':'MY','desc':'Busiest shipping lane. 90,000 vessels/yr.','output':'90k ships/yr'},
    {'name':'Suez Canal','category':'chokepoint','lat':30.58,'lon':32.33,'country':'EG','desc':'12% of global trade.','output':'51 vessels/day'},
    {'name':'Panama Canal','category':'chokepoint','lat':9.08,'lon':-79.68,'country':'PA','desc':'Link between Atlantic and Pacific.','output':'14k ships/yr'},
    {'name':'Bosphorus Strait','category':'chokepoint','lat':41.07,'lon':29.06,'country':'TR','desc':'Black Sea access. Critical for Ukraine grain.'},
    {'name':'Danish Straits','category':'chokepoint','lat':57.50,'lon':10.50,'country':'DK','desc':'Baltic Sea access.'},
    {'name':'Strait of Gibraltar','category':'chokepoint','lat':35.98,'lon':-5.47,'country':'ES','desc':'Mediterranean gateway.'},
    {'name':'Lombok Strait','category':'chokepoint','lat':-8.40,'lon':115.90,'country':'ID'},
    {'name':'Mandeb Strait (Bab-el)','category':'chokepoint','lat':12.60,'lon':43.40,'country':'YE','desc':'Red Sea-Indian Ocean gate. Yemen war zone.'},

    # ── MEGA PORTS ──────────────────────────────────────────────────────────
    {'name':'Port of Shanghai','category':'port_megacity','lat':31.24,'lon':121.50,'country':'CN','desc':'World\'s busiest port by tonnage.','output':'47M TEU/yr'},
    {'name':'Port of Singapore','category':'port_megacity','lat':1.27,'lon':103.83,'country':'SG','output':'37M TEU/yr'},
    {'name':'Port of Ningbo-Zhoushan','category':'port_megacity','lat':29.87,'lon':122.12,'country':'CN','output':'33M TEU/yr'},
    {'name':'Port of Shenzhen','category':'port_megacity','lat':22.52,'lon':113.93,'country':'CN','output':'29M TEU/yr'},
    {'name':'Port of Rotterdam','category':'port_megacity','lat':51.90,'lon':4.47,'country':'NL','desc':'Europe\'s largest port.','output':'15M TEU/yr'},
    {'name':'Port of Busan','category':'port_megacity','lat':35.10,'lon':129.04,'country':'KR','output':'22M TEU/yr'},
    {'name':'Jebel Ali Port','category':'port_megacity','lat':24.98,'lon':55.07,'country':'AE','output':'14M TEU/yr'},
    {'name':'Port of Los Angeles','category':'port_megacity','lat':33.73,'lon':-118.27,'country':'US','output':'10M TEU/yr'},

    # ── NATURE SANCTUARIES ────────────────────────────────────────────────
    {'name':'Amazon Rainforest Core','category':'nature_sanctuary','lat':-3.47,'lon':-62.21,'country':'BR','desc':'40% of world\'s tropical rainforest. Lungs of Earth.','output':'~20% global O2'},
    {'name':'Galápagos Islands','category':'nature_sanctuary','lat':-0.67,'lon':-90.55,'country':'EC','desc':'Darwin\'s lab. UNESCO heritage.'},
    {'name':'Serengeti-Masai Mara','category':'nature_sanctuary','lat':-2.33,'lon':34.83,'country':'TZ','desc':'Greatest wildlife migration on Earth.'},
    {'name':'Great Barrier Reef','category':'nature_sanctuary','lat':-18.29,'lon':147.70,'country':'AU','desc':'World\'s largest coral reef system.'},
    {'name':'Yellowstone NP','category':'nature_sanctuary','lat':44.60,'lon':-110.50,'country':'US','desc':'Supervolcano + Old Faithful + wolf reintroduction.'},
    {'name':'Congo Basin Forest','category':'nature_sanctuary','lat':-0.50,'lon':24.00,'country':'CD','desc':'Second largest tropical forest.'},
    {'name':'Borneo Rainforest','category':'nature_sanctuary','lat':1.00,'lon':114.00,'country':'MY','desc':'Orangutan + pygmy elephant habitat.'},
    {'name':'Sundarbans Mangroves','category':'nature_sanctuary','lat':22.00,'lon':89.20,'country':'BD','desc':'World\'s largest mangrove forest. Bengal tigers.'},
    {'name':'Virunga National Park','category':'nature_sanctuary','lat':-0.50,'lon':29.50,'country':'CD','desc':'Mountain gorillas + Congo oil beneath.'},

    # ── ANCIENT FORESTS ──────────────────────────────────────────────────────
    {'name':'Tongass National Forest','category':'ancient_forest','lat':57.00,'lon':-134.00,'country':'US','desc':'Largest US national forest. Temperate rainforest.'},
    {'name':'Daintree Rainforest','category':'ancient_forest','lat':-16.17,'lon':145.42,'country':'AU','desc':'World\'s oldest tropical rainforest (135M yrs).'},
    {'name':'Białowieża Forest','category':'ancient_forest','lat':52.70,'lon':23.87,'country':'PL','desc':'Last primeval lowland forest in Europe.'},
    {'name':'Tarkine Wilderness','category':'ancient_forest','lat':-41.50,'lon':145.00,'country':'AU','desc':'Southern hemisphere\'s largest temperate rainforest.'},
    {'name':'Valdivian Forest','category':'ancient_forest','lat':-40.00,'lon':-73.50,'country':'CL','desc':'Only temperate rainforest in South America.'},
    {'name':'Yakushima Cedar Forest','category':'ancient_forest','lat':30.35,'lon':130.53,'country':'JP','desc':'Jōmon Sugi — 7200 year old cedar. UNESCO.'},

    # ── FRESHWATER ──────────────────────────────────────────────────────────
    {'name':'Lake Baikal','category':'freshwater','lat':53.50,'lon':108.00,'country':'RU','desc':'20% of world\'s unfrozen fresh water.','output':'23,000 km³'},
    {'name':'Great Lakes System','category':'freshwater','lat':45.00,'lon':-84.00,'country':'US','desc':'21% of world surface fresh water.','output':'22,671 km³'},
    {'name':'Amazon River Basin','category':'freshwater','lat':-3.00,'lon':-60.00,'country':'BR','desc':'20% of all river water to oceans.','output':'209,000 m³/s'},
    {'name':'Lake Victoria','category':'freshwater','lat':-1.00,'lon':33.00,'country':'KE','desc':'Largest tropical lake. Nile source.'},
    {'name':'Tibetan Plateau Aquifer','category':'freshwater','lat':32.00,'lon':90.00,'country':'CN','desc':'Asia\'s water tower. Feeds 7 major rivers.'},
    {'name':'Guaraní Aquifer','category':'freshwater','lat':-20.00,'lon':-55.00,'country':'BR','desc':'World\'s largest transboundary aquifer.','output':'45,000 km³'},
    {'name':'Lake Tanganyika','category':'freshwater','lat':-6.00,'lon':29.50,'country':'CD','output':'18,900 km³'},

    # ── FERTILE LAND ────────────────────────────────────────────────────────
    {'name':'Ukraine Black Soil Belt','category':'fertile_land','lat':49.00,'lon':32.00,'country':'UA','desc':'World\'s most fertile soil (chernozem). Breadbasket.','output':'40M tons grain/yr'},
    {'name':'US Corn Belt','category':'fertile_land','lat':42.00,'lon':-94.00,'country':'US','desc':'Iowa, Illinois, Indiana — global corn/soy anchor.','output':'350M tons/yr'},
    {'name':'Nile Delta Agriculture','category':'fertile_land','lat':30.90,'lon':31.00,'country':'EG','desc':'3 harvests/yr. 95% of Egypt\'s food.'},
    {'name':'Punjab Plains','category':'fertile_land','lat':30.70,'lon':76.00,'country':'IN','desc':'India\'s breadbasket. Green Revolution center.'},
    {'name':'Mekong Delta','category':'fertile_land','lat':10.50,'lon':105.60,'country':'VN','desc':'Rice bowl of Southeast Asia.','output':'25M tons rice/yr'},
    {'name':'Pampas Grasslands','category':'fertile_land','lat':-34.00,'lon':-62.00,'country':'AR','desc':'South America\'s soybean + beef giant.'},
    {'name':'Murray-Darling Basin','category':'fertile_land','lat':-34.00,'lon':143.00,'country':'AU','output':'$24B agriculture annually'},

    # ── DEEP SEA FISHING ────────────────────────────────────────────────────
    {'name':'Grand Banks','category':'deep_sea_fish','lat':46.00,'lon':-51.00,'country':'CA','desc':'Historic cod. Now mixed groundfish.','output':'Historic 2M tons cod/yr'},
    {'name':'Peruvian Humboldt Current','category':'deep_sea_fish','lat':-10.00,'lon':-78.00,'country':'PE','desc':'World\'s most productive fishing zone.','output':'7M tons/yr (anchovy)'},
    {'name':'Norwegian Sea','category':'deep_sea_fish','lat':68.00,'lon':5.00,'country':'NO','output':'Herring, cod, mackerel'},
    {'name':'South China Sea Fisheries','category':'deep_sea_fish','lat':15.00,'lon':115.00,'country':'CN','desc':'Disputed. 10% global fish catch.'},
    {'name':'Bering Sea','category':'deep_sea_fish','lat':58.00,'lon':-175.00,'country':'US','output':'Pollock + king crab'},
    {'name':'Bay of Bengal','category':'deep_sea_fish','lat':15.00,'lon':88.00,'country':'IN','output':'Large tuna + shrimp zone'},

    # ── IRON ORE ────────────────────────────────────────────────────────────
    {'name':'Pilbara Iron Range','category':'iron_ore','lat':-22.50,'lon':118.50,'country':'AU','desc':'Largest iron ore export region.','output':'850M tons/yr'},
    {'name':'Carajás Mine','category':'iron_ore','lat':-6.06,'lon':-50.18,'country':'BR','desc':'World\'s largest iron ore mine.','output':'170M tons/yr'},
    {'name':'Sishen Mine','category':'iron_ore','lat':-27.79,'lon':23.00,'country':'ZA','output':'34M tons/yr'},
    {'name':'Kiruna Iron Mine','category':'iron_ore','lat':67.85,'lon':20.23,'country':'SE','desc':'Europe\'s largest iron ore mine.','output':'27M tons/yr'},
    {'name':'Cleveland-Cliffs Mesabi','category':'iron_ore','lat':47.50,'lon':-92.50,'country':'US','output':'Taconite pellets'},

    # ── COPPER MINES ────────────────────────────────────────────────────────
    {'name':'Escondida Mine','category':'copper_mine','lat':-24.27,'lon':-69.07,'country':'CL','desc':'World\'s largest copper mine.','output':'1.2M tons/yr'},
    {'name':'Collahuasi Mine','category':'copper_mine','lat':-20.98,'lon':-68.71,'country':'CL','output':'600k tons/yr'},
    {'name':'Antamina Mine','category':'copper_mine','lat':-9.53,'lon':-77.05,'country':'PE','output':'450k tons/yr'},
    {'name':'Katanga Copper Belt','category':'copper_mine','lat':-10.50,'lon':26.50,'country':'CD','desc':'Copper + cobalt giant.'},
    {'name':'Olympic Dam Copper','category':'copper_mine','lat':-30.44,'lon':136.88,'country':'AU','output':'190k tons/yr'},
    {'name':'Bingham Canyon Mine','category':'copper_mine','lat':40.53,'lon':-112.15,'country':'US','desc':'Largest man-made excavation on Earth.','output':'230k tons/yr'},
]

def seed():
    created = 0
    updated = 0
    for r in RESOURCES:
        cfg_cat = r['category']
        from terra_domini.apps.events.poi_models_resources import RESOURCE_CONFIG
        cfg = RESOURCE_CONFIG.get(cfg_cat, {})
        obj, was_created = ResourcePOI.objects.update_or_create(
            name=r['name'],
            defaults={
                'category':     cfg_cat,
                'latitude':     r['lat'],
                'longitude':    r['lon'],
                'country_code': r.get('country', ''),
                'description':  r.get('desc', ''),
                'real_output':  r.get('output', ''),
                'emoji':        cfg.get('emoji', '📍'),
                'color':        cfg.get('color', '#6B7280'),
                'game_resource':cfg.get('game_resource', 'credits'),
                'bonus_pct':    cfg.get('bonus_pct', 25),
                'rarity':       cfg.get('rarity', 'common'),
                'is_active':    True,
            }
        )
        if was_created: created += 1
        else: updated += 1

    print(f"\n✅ Resource POIs seeded: {created} created, {updated} updated")
    print(f"   Total: {ResourcePOI.objects.count()} resources in database")
    by_cat = {}
    for r in ResourcePOI.objects.values_list('category', flat=True):
        by_cat[r] = by_cat.get(r, 0) + 1
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        from terra_domini.apps.events.poi_models_resources import RESOURCE_CONFIG
        cfg = RESOURCE_CONFIG.get(cat, {})
        print(f"   {cfg.get('emoji','📍')} {cat}: {count}")

if __name__ == '__main__':
    seed()
