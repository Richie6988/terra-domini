#!/usr/bin/env python3
"""
Comprehensive world POI seed — 600+ locations, 65+ categories.
Research-based: dams, stock exchanges, tech campuses, cables, colliders...
"""
import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()
from terra_domini.apps.events.unified_poi import UnifiedPOI

POIS = [
    # ══════════════════════════════════════════════════════════════════════
    # 🌊 MEGA DAMS (hydroelectric)
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Three Gorges Dam','cat':'mega_dam','lat':30.823,'lon':111.003,'cc':'CN','desc':'World\'s largest power station. 22,500 MW. 1.4M people displaced.','real_output':'111 TWh/yr','fun':'Created reservoir 600km long','featured':True},
    {'name':'Itaipu Dam','cat':'mega_dam','lat':-25.408,'lon':-54.589,'cc':'BR','desc':'Brazil-Paraguay border. 14,000 MW. Paraguay gets 87% of electricity from it.','real_output':'103 TWh/yr','fun':'Used more concrete than 5 Channel Tunnels'},
    {'name':'Baihetan Dam','cat':'mega_dam','lat':27.207,'lon':102.888,'cc':'CN','desc':'Second most powerful dam. 16,000 MW on Jinsha River.','real_output':'62 TWh/yr'},
    {'name':'Xiluodu Dam','cat':'mega_dam','lat':28.256,'lon':103.644,'cc':'CN','desc':'13,860 MW. Displaced 180,000 people. Saves 41M tons coal/yr.','real_output':'55 TWh/yr'},
    {'name':'Guri Dam','cat':'mega_dam','lat':7.757,'lon':-62.999,'cc':'VE','desc':'Venezuela\'s main power source. 10,235 MW. Outages caused national crises.','real_output':'47 TWh/yr','fun':'Failure plunged Venezuela into darkness for days'},
    {'name':'Tucuruí Dam','cat':'mega_dam','lat':-3.831,'lon':-49.699,'cc':'BR','desc':'First large dam in Amazon. 8,370 MW. Powers 13M homes.','real_output':'21 TWh/yr'},
    {'name':'Grand Coulee Dam','cat':'mega_dam','lat':47.957,'lon':-118.981,'cc':'US','desc':'Largest US concrete structure. 6,809 MW. Built 1933.','real_output':'24 TWh/yr','fun':'Powered US WWII industry'},
    {'name':'Aswan High Dam','cat':'mega_dam','lat':23.970,'lon':32.879,'cc':'EG','desc':'Controls Nile floods. 2,100 MW. Created Lake Nasser.','fun':'Saved ancient temples by moving Abu Simbel'},
    {'name':'Hoover Dam','cat':'mega_dam','lat':36.016,'lon':-114.738,'cc':'US','desc':'Iconic 726ft arch-gravity dam. 2,078 MW. Built during Great Depression.','fun':'Contains 3.25M cubic yards of concrete','featured':True},
    {'name':'Ataturk Dam','cat':'mega_dam','lat':37.484,'lon':38.347,'cc':'TR','desc':'Largest dam in Turkey. 2,400 MW. Controls Euphrates.'},
    {'name':'Bratsk Dam','cat':'mega_dam','lat':56.266,'lon':101.820,'cc':'RU','desc':'4,500 MW on Angara River. One of Soviet Union\'s greatest projects.'},
    {'name':'Robert-Bourassa Dam','cat':'mega_dam','lat':53.725,'lon':-77.662,'cc':'CA','desc':'5,616 MW. Part of James Bay Project in Quebec.'},
    {'name':'Kariba Dam','cat':'mega_dam','lat':-16.521,'lon':28.770,'cc':'ZW','desc':'1,626 MW. Zambia-Zimbabwe border. Second largest reservoir by volume.'},
    {'name':'Grand Ethiopian Renaissance Dam','cat':'mega_dam','lat':11.215,'lon':35.094,'cc':'ET','desc':'6,450 MW. Africa\'s largest dam. Caused major Nile dispute with Egypt.','fun':'Filling triggered Egypt-Ethiopia diplomatic crisis'},
    {'name':'Sayano-Shushenskaya Dam','cat':'mega_dam','lat':52.840,'lon':91.367,'cc':'RU','desc':'6,400 MW. Russia\'s largest. 2009 accident killed 75.'},
    # ══════════════════════════════════════════════════════════════════════
    # 📈 STOCK EXCHANGES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'NYSE New York Stock Exchange','cat':'stock_exchange','lat':40.707,'lon':-74.011,'cc':'US','desc':'World\'s largest. $25T market cap. 11 Wall Street.','fun':'Opening bell rung by celebrities & heads of state','featured':True},
    {'name':'NASDAQ Times Square','cat':'stock_exchange','lat':40.756,'lon':-73.987,'cc':'US','desc':'$21T+ market cap. World\'s first electronic exchange. Apple, Microsoft, Google.','fun':'No physical trading floor — purely electronic'},
    {'name':'Shanghai Stock Exchange','cat':'stock_exchange','lat':31.234,'lon':121.478,'cc':'CN','desc':'$7.3T market cap. Largest in China. PetroChina, ICBC, Bank of China.','fun':'Has a 1.5-hour lunch break, unique globally'},
    {'name':'Japan Exchange Group Tokyo','cat':'stock_exchange','lat':35.682,'lon':139.771,'cc':'JP','desc':'$6.9T market cap. Toyota, Sony, SoftBank, Honda.','fun':'Merged Tokyo + Osaka exchanges in 2013'},
    {'name':'London Stock Exchange','cat':'stock_exchange','lat':51.514,'lon':-0.099,'cc':'GB','desc':'$5.9T market cap. Oldest major exchange. FTSE 100. HSBC, BP, Unilever.','fun':'Founded 1801. Lost world #1 to NYSE after WW1'},
    {'name':'Hong Kong Stock Exchange','cat':'stock_exchange','lat':22.279,'lon':114.163,'cc':'HK','desc':'$5.2T market cap. Gateway between China and world. Tencent, HSBC.','fun':'World\'s largest IPO market in 2022'},
    {'name':'Euronext Amsterdam','cat':'stock_exchange','lat':52.374,'lon':4.901,'cc':'NL','desc':'World\'s oldest exchange (1602). $7T+ multi-country.','fun':'Founded by Dutch East India Company'},
    {'name':'Shenzhen Stock Exchange','cat':'stock_exchange','lat':22.542,'lon':113.944,'cc':'CN','desc':'$4.6T market cap. Tech-heavy. BYD, Ping An, Vanke.'},
    {'name':'Toronto Stock Exchange','cat':'stock_exchange','lat':43.648,'lon':-79.382,'cc':'CA','desc':'$3.8T market cap. Energy, mining, financials. Royal Bank, Shopify.'},
    {'name':'Bombay Stock Exchange','cat':'stock_exchange','lat':18.928,'lon':72.833,'cc':'IN','desc':'Asia\'s oldest exchange (1875). 5,000+ listed companies.','fun':'World\'s largest by number of listed companies'},
    {'name':'Frankfurt Stock Exchange','cat':'stock_exchange','lat':50.113,'lon':8.682,'cc':'DE','desc':'DAX 40. Deutsche Bank, SAP, Volkswagen. Origins 1585.'},
    {'name':'Saudi Tadawul Exchange','cat':'stock_exchange','lat':24.688,'lon':46.672,'cc':'SA','desc':'Aramco IPO made it world\'s largest ever. $2.5T+ market cap.'},
    {'name':'Singapore Exchange SGX','cat':'stock_exchange','lat':1.280,'lon':103.851,'cc':'SG','desc':'Southeast Asia\'s primary exchange. DBS, Singtel, OCBC.'},
    {'name':'Swiss Exchange SIX','cat':'stock_exchange','lat':47.371,'lon':8.537,'cc':'CH','desc':'$2T+ market cap. Nestlé, Novartis, Roche.'},
    {'name':'Korea Exchange KRX','cat':'stock_exchange','lat':35.159,'lon':129.060,'cc':'KR','desc':'$2.2T market cap. Samsung, Hyundai, LG Electronics.'},
    {'name':'Australian Securities Exchange','cat':'stock_exchange','lat':-33.864,'lon':151.209,'cc':'AU','desc':'$1.7T market cap. BHP, Commonwealth Bank, CSL.'},
    # ══════════════════════════════════════════════════════════════════════
    # 💾 SEMICONDUCTOR FABS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'TSMC Hsinchu HQ','cat':'semiconductor','lat':24.780,'lon':121.002,'cc':'TW','desc':'World\'s most advanced chip foundry. 90%+ of cutting-edge chips globally.','fun':'More valuable than most countries\' GDP','featured':True},
    {'name':'TSMC Phoenix Arizona','cat':'semiconductor','lat':33.676,'lon':-112.002,'cc':'US','desc':'$40B US fab. 2nm chips. US strategic investment.'},
    {'name':'Samsung Hwaseong','cat':'semiconductor','lat':37.168,'lon':127.000,'cc':'KR','desc':'Samsung\'s largest fab. 3nm process. Memory + logic.'},
    {'name':'Intel Fab 42 Arizona','cat':'semiconductor','lat':33.455,'lon':-111.900,'cc':'US','desc':'Intel\'s most advanced US fab. 18A process node.'},
    {'name':'ASML Veldhoven','cat':'semiconductor','lat':51.419,'lon':5.433,'cc':'NL','desc':'Only maker of EUV lithography machines. $400B company. Controls world chip supply.','fun':'Netherlands company controls who can make advanced chips'},
    {'name':'SK Hynix Icheon','cat':'semiconductor','lat':37.274,'lon':127.440,'cc':'KR','desc':'World\'s 2nd largest memory chip maker.'},
    {'name':'Micron Boise','cat':'semiconductor','lat':43.600,'lon':-116.200,'cc':'US','desc':'US\'s largest memory chip maker. DRAM + NAND.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🔌 INTERNET EXCHANGE POINTS & UNDERSEA CABLES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'DE-CIX Frankfurt','cat':'ix_point','lat':50.113,'lon':8.682,'cc':'DE','desc':'World\'s largest internet exchange. 14+ Tbps traffic.','fun':'More internet traffic than most countries'},
    {'name':'AMS-IX Amsterdam','cat':'ix_point','lat':52.374,'lon':4.901,'cc':'NL','desc':'Second largest IX. 10+ Tbps. Gateway for European internet.'},
    {'name':'LINX London','cat':'ix_point','lat':51.514,'lon':-0.099,'cc':'GB','desc':'London Internet Exchange. 6+ Tbps. UK internet hub.'},
    {'name':'Equinix NY4 Secaucus','cat':'ix_point','lat':40.791,'lon':-74.057,'cc':'US','desc':'Americas\' largest data center hub. Financial trading hub.'},
    {'name':'PCCW HK Internet Exchange','cat':'ix_point','lat':22.279,'lon':114.163,'cc':'HK','desc':'Asia\'s largest IX. Connects China to world internet.'},
    {'name':'SEA-ME-WE 3 Cable','cat':'internet_cable','lat':1.352,'lon':103.820,'cc':'SG','desc':'39,000km submarine cable. Europe-Asia backbone since 1999.'},
    {'name':'MAREA Cable Bilbao','cat':'internet_cable','lat':43.263,'lon':-2.935,'cc':'ES','desc':'Microsoft-Facebook Atlantic cable. 160Tbps. Landed 2017.'},
    {'name':'PEACE Cable Marseille','cat':'internet_cable','lat':43.296,'lon':5.381,'cc':'FR','desc':'Pakistan East Africa Cable. China to Europe bypass route.'},
    {'name':'Hibernia Atlantic Cable','cat':'internet_cable','lat':51.898,'lon':-8.474,'cc':'IE','desc':'Low-latency transatlantic. Cork to New York. Financial trading route.'},
    # ══════════════════════════════════════════════════════════════════════
    # ⚛️ PARTICLE COLLIDERS & SCIENCE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'CERN LHC Geneva','cat':'particle_collider','lat':46.234,'lon':6.055,'cc':'CH','desc':'World\'s largest particle accelerator. 27km ring. Higgs boson discovered here.','fun':'Invented the World Wide Web as a side project','featured':True},
    {'name':'SLAC National Lab','cat':'particle_collider','lat':37.416,'lon':-122.202,'cc':'US','desc':'3.2km linear accelerator. Stanford. X-ray laser.'},
    {'name':'Fermilab','cat':'particle_collider','lat':41.841,'lon':-88.268,'cc':'US','desc':'US\'s main particle physics lab. Tevatron. Near Chicago.'},
    {'name':'ITER Fusion Reactor Cadarache','cat':'particle_collider','lat':43.708,'lon':5.766,'cc':'FR','desc':'International fusion experiment. 35 countries. Unlimited clean energy goal.','fun':'Designed to produce 500MW from 50MW input'},
    {'name':'IceCube Neutrino Observatory','cat':'research_station','lat':-89.990,'lon':-63.453,'cc':'AQ','desc':'South Pole neutrino detector. 1 cubic km of ice instruments.'},
    {'name':'Arecibo (collapsed)','cat':'observatory','lat':18.344,'lon':-66.753,'cc':'PR','desc':'Former world\'s largest radio telescope. 305m dish. Collapsed 2020.','fun':'Featured in GoldenEye and Contact films'},
    {'name':'FAST Radio Telescope','cat':'observatory','lat':25.653,'lon':106.857,'cc':'CN','desc':'World\'s largest radio telescope. 500m dish. Replaced Arecibo.'},
    {'name':'Event Horizon Telescope Network','cat':'observatory','lat':19.824,'lon':-155.477,'cc':'US','desc':'Global array that photographed first black hole image 2019.'},
    {'name':'Square Kilometre Array South Africa','cat':'observatory','lat':-30.713,'lon':21.444,'cc':'ZA','desc':'World\'s largest radio telescope array. 197 dish antennas.'},
    {'name':'Svalbard Global Seed Vault','cat':'seed_vault','lat':78.236,'lon':15.491,'cc':'NO','desc':'Doomsday vault. 1.3M seed varieties. Survive nuclear war + climate change.','fun':'Arctic permafrost is the refrigerator. 130m inside mountain','featured':True},
    # ══════════════════════════════════════════════════════════════════════
    # 🏭 INDUSTRIAL MEGACOMPLEXES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Magnitogorsk Steel Complex','cat':'steel_mill','lat':53.417,'lon':58.984,'cc':'RU','desc':'Soviet-era megamill. 11M tons steel/yr. One of world\'s largest.','fun':'Entire city built around single steel plant'},
    {'name':'POSCO Pohang Steelworks','cat':'steel_mill','lat':36.031,'lon':129.365,'cc':'KR','desc':'World\'s largest single steelworks. 40M tons capacity.'},
    {'name':'ArcelorMittal Ghent','cat':'steel_mill','lat':51.167,'lon':3.717,'cc':'BE','desc':'Europe\'s most efficient steel plant. Green hydrogen transition.'},
    {'name':'Jubail Industrial City','cat':'steel_mill','lat':27.017,'lon':49.668,'cc':'SA','desc':'World\'s largest industrial city. 300+ companies. Saudi petrochemicals.'},
    {'name':'Rjukan Chemical Plant','cat':'research_station','lat':59.879,'lon':8.578,'cc':'NO','desc':'WWII heavy water plant. Sabotaged to prevent Nazi nuclear bomb.','fun':'Operation Gunnerside — most important WWII sabotage'},
    # ══════════════════════════════════════════════════════════════════════
    # 💊 PHARMA HQs
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Pfizer New York HQ','cat':'pharma_hq','lat':40.756,'lon':-73.979,'cc':'US','desc':'COVID vaccine maker. $100B revenue. Founded 1849.'},
    {'name':'Johnson & Johnson NJ','cat':'pharma_hq','lat':40.487,'lon':-74.447,'cc':'US','desc':'World\'s largest healthcare company. $93B revenue.'},
    {'name':'Roche Basel','cat':'pharma_hq','lat':47.565,'lon':7.603,'cc':'CH','desc':'Diagnostics + oncology leader. Herceptin, Avastin.'},
    {'name':'Novartis Basel','cat':'pharma_hq','lat':47.566,'lon':7.601,'cc':'CH','desc':'$50B+ revenue. Gene therapy pioneer.'},
    {'name':'AstraZeneca Cambridge UK','cat':'pharma_hq','lat':52.200,'lon':0.143,'cc':'GB','desc':'COVID vaccine (Oxford-AZ). $44B revenue.'},
    {'name':'Bayer Leverkusen','cat':'pharma_hq','lat':51.033,'lon':6.984,'cc':'DE','desc':'Aspirin inventor 1897. Monsanto acquisition. $50B revenue.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🎰 CASINO RESORTS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Macau Cotai Strip','cat':'casino_resort','lat':22.149,'lon':113.560,'cc':'MO','desc':'World\'s gambling capital. $36B revenue pre-COVID. 6× Vegas Strip.','fun':'Largest gambling revenue in world','featured':True},
    {'name':'Las Vegas Strip','cat':'casino_resort','lat':36.116,'lon':-115.175,'cc':'US','desc':'30+ casinos. 42M visitors/yr. $7B gaming revenue.','fun':'So bright it\'s visible from space','featured':True},
    {'name':'Marina Bay Sands Singapore','cat':'casino_resort','lat':1.284,'lon':103.861,'cc':'SG','desc':'Infinity pool 200m high. $5.5B construction. Iconic skyline.'},
    {'name':'Wynn Palace Macau','cat':'casino_resort','lat':22.149,'lon':113.561,'cc':'MO','desc':'$4.2B resort. 1,700 rooms. Performance lake.'},
    {'name':'Monte Carlo Casino','cat':'casino_resort','lat':43.739,'lon':7.430,'cc':'MC','desc':'Most famous casino. 1863. James Bond setting.','fun':'Monaco residents banned from gambling there'},
    {'name':'The Venetian Macao','cat':'casino_resort','lat':22.148,'lon':113.564,'cc':'MO','desc':'World\'s largest casino floor. 546,000 sq ft gaming.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏟️ SPORTS ARENAS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Rungrado May Day Stadium Pyongyang','cat':'sports_arena','lat':39.054,'lon':125.788,'cc':'KP','desc':'World\'s largest stadium. 114,000 seats. Arirang Mass Games.','fun':'Capacity larger than most cities'},
    {'name':'Camp Nou Barcelona','cat':'sports_arena','lat':41.381,'lon':2.123,'cc':'ES','desc':'Largest stadium in Europe. 99,354 seats. FC Barcelona.'},
    {'name':'Melbourne Cricket Ground','cat':'sports_arena','lat':-37.820,'lon':144.984,'cc':'AU','desc':'Southern hemisphere\'s largest. 100,024 capacity. Boxing Day Test.'},
    {'name':'AT&T Stadium Arlington','cat':'sports_arena','lat':32.748,'lon':-97.093,'cc':'US','desc':'Dallas Cowboys. 100,000+ capacity. Largest domed stadium.'},
    {'name':'Wembley Stadium London','cat':'sports_arena','lat':51.556,'lon':-0.280,'cc':'GB','desc':'90,000 seats. England football HQ. UEFA finals host.'},
    {'name':'Soccer City Johannesburg','cat':'sports_arena','lat':-26.237,'lon':27.983,'cc':'ZA','desc':'94,736 seats. 2010 World Cup final. Calabash design.'},
    {'name':'Maracanã Rio de Janeiro','cat':'sports_arena','lat':-22.912,'lon':-43.230,'cc':'BR','desc':'78,838 seats. Brazil football cathedral. 1950 WC disgrace.','fun':'1950 WC final: 199,854 people in stadium'},
    {'name':'Eden Gardens Kolkata','cat':'sports_arena','lat':22.565,'lon':88.344,'cc':'IN','desc':'68,000 cricket seats. India\'s most famous ground.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🔬 RESEARCH STATIONS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'McMurdo Station Antarctica','cat':'research_station','lat':-77.846,'lon':166.668,'cc':'AQ','desc':'Largest Antarctic station. 1,200+ summer personnel. US operation.'},
    {'name':'Concordia Station Antarctica','cat':'research_station','lat':-75.100,'lon':123.350,'cc':'AQ','desc':'French-Italian station. -80°C winters. ESA isolation studies.'},
    {'name':'ISS International Space Station','cat':'research_station','lat':51.600,'lon':0.000,'cc':'??','desc':'400km altitude. 15 nations. Continuously inhabited since 2000.','fun':'Travels at 17,500 mph. 16 sunrises per day','featured':True},
    {'name':'Woods Hole Oceanographic','cat':'research_station','lat':41.524,'lon':-70.673,'cc':'US','desc':'World\'s largest private ocean research institution.'},
    {'name':'CERN Data Centre','cat':'research_station','lat':46.234,'lon':6.055,'cc':'CH','desc':'15 petabytes data/yr. Birthplace of World Wide Web.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🌿 NATURE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Amazon River Mouth','cat':'freshwater','lat':-0.167,'lon':-50.055,'cc':'BR','desc':'20% of all river water into oceans. Discharge visible from space.'},
    {'name':'Congo River Basin','cat':'ancient_forest','lat':-0.500,'lon':24.000,'cc':'CD','desc':'Second largest tropical forest. Critical carbon sink. Gorilla habitat.'},
    {'name':'Boreal Forest Siberia','cat':'ancient_forest','lat':60.000,'lon':100.000,'cc':'RU','desc':'World\'s largest forest. Stores 1/3 of terrestrial carbon.'},
    {'name':'Daintree Rainforest','cat':'ancient_forest','lat':-16.170,'lon':145.423,'cc':'AU','desc':'135 million year old rainforest. World\'s oldest tropical forest.'},
    {'name':'Białowieża Forest','cat':'ancient_forest','lat':52.703,'lon':23.875,'cc':'PL','desc':'Last primeval lowland forest in Europe. European bison sanctuary.'},
    {'name':'Mariana Trench Challenger Deep','cat':'anomaly','lat':11.373,'lon':142.591,'cc':'??','desc':'10,994m deep. Deepest point on Earth. 1960: Piccard + Walsh descended.','fun':'3 people have been to Challenger Deep. 12 to the Moon'},
    {'name':'Lake Natron Tanzania','cat':'anomaly','lat':-2.414,'lon':36.082,'cc':'TZ','desc':'Turns animals to stone. Sodium carbonate preserves carcasses.'},
    {'name':'Socotra Island','cat':'island','lat':12.463,'lon':54.020,'cc':'YE','desc':'Galapagos of Indian Ocean. 37% species found nowhere else. Dragon blood trees.'},
    {'name':'Jan Mayen Island','cat':'island','lat':71.024,'lon':-8.292,'cc':'NO','desc':'Volcanic Arctic island. Active volcano Beerenberg. 18 Norwegian personnel.'},
    {'name':'Bouvet Island','cat':'island','lat':-54.423,'lon':3.357,'cc':'NO','desc':'World\'s most remote island. 2,600 km from nearest land. Uninhabited.','fun':'Has an .bv domain but no websites'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏔️ MORE PEAKS & NATURAL FEATURES  
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Dead Sea Shores','cat':'anomaly','lat':31.559,'lon':35.473,'cc':'JO','desc':'Lowest point on Earth (-430m). 34% salinity. Cannot sink.','fun':'Shrinking 1 meter per year since 1960s'},
    {'name':'Sahara Desert Center','cat':'anomaly','lat':23.000,'lon':12.000,'cc':'DZ','desc':'World\'s largest hot desert. 9.2M km². Temperatures 58°C+.'},
    {'name':'Richat Structure Mauritania','cat':'anomaly','lat':21.124,'lon':-11.399,'cc':'MR','desc':'Eye of Sahara. 50km bulls-eye structure visible from space.','fun':'Possibly formed by meteorite impact'},
    {'name':'Door to Hell Turkmenistan','cat':'volcano','lat':40.252,'lon':58.440,'cc':'TM','desc':'Gas crater burning since 1971. Set on fire by Soviet geologists.','fun':'Never intentionally lit — it was an accident'},
    {'name':'Waitomo Glowworm Caves','cat':'cave_system','lat':-38.257,'lon':175.103,'cc':'NZ','desc':'Millions of bioluminescent glowworms. Natural galaxy underground.'},
    {'name':'Carlsbad Caverns','cat':'cave_system','lat':32.148,'lon':-104.556,'cc':'US','desc':'100+ caves. 400,000 bats. World\'s largest known cave chamber.'},
    {'name':'Phong Nha Cave Vietnam','cat':'cave_system','lat':17.558,'lon':106.282,'cc':'VN','desc':'World\'s largest cave. 9km explored. 200m high chambers.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🛡️ MORE MILITARY
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Raven Rock Mountain Complex','cat':'secret_facility','lat':39.720,'lon':-77.408,'cc':'US','desc':'Underground Pentagon. US government doomsday bunker.','fun':'Known as Site R. Used on 9/11'},
    {'name':'Mount Weather Emergency Operations','cat':'secret_facility','lat':39.063,'lon':-77.888,'cc':'US','desc':'FEMA\'s classified emergency relocation center. Continuity of government.'},
    {'name':'Greenbrier Bunker West Virginia','cat':'secret_facility','lat':37.782,'lon':-80.297,'cc':'US','desc':'Congressional bunker under luxury resort. Declassified 1992.','fun':'Hidden beneath the Greenbrier resort for 30 years'},
    {'name':'Cheyenne Mountain NORAD','cat':'military_base','lat':38.745,'lon':-104.846,'cc':'US','desc':'Nuclear bunker inside mountain. Tracks all aerospace threats.','fun':'Built to survive nuclear blast'},
    {'name':'Dimona Nuclear Research Center','cat':'missile_site','lat':31.003,'lon':35.154,'cc':'IL','desc':'Israel\'s alleged nuclear weapons facility. Never officially acknowledged.','fun':'Israel has never confirmed nor denied its nuclear arsenal'},
    {'name':'Khmeimim Air Base','cat':'military_base','lat':35.401,'lon':35.948,'cc':'SY','desc':'Russia\'s permanent Syrian base. Launched operations in Middle East.'},
    {'name':'Camp Bondsteel Kosovo','cat':'military_base','lat':42.352,'lon':21.347,'cc':'XK','desc':'Largest US base in Balkans. Built after 1999 Kosovo War.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🌐 ORGANIZATIONS & POWER CENTERS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'WTO Geneva','cat':'international_org','lat':46.226,'lon':6.141,'cc':'CH','desc':'World Trade Organization. Rules global commerce for 164 countries.'},
    {'name':'WHO Geneva','cat':'international_org','lat':46.233,'lon':6.138,'cc':'CH','desc':'World Health Organization. COVID pandemic coordination center.','fun':'Declared COVID pandemic from this building'},
    {'name':'OPEC Vienna','cat':'international_org','lat':48.209,'lon':16.372,'cc':'AT','desc':'13 countries. Controls 44% of world oil. Sets global prices.'},
    {'name':'ICC The Hague','cat':'international_org','lat':52.085,'lon':4.316,'cc':'NL','desc':'International Criminal Court. War crimes tribunal. Putin arrest warrant issued.'},
    {'name':'IAEA Vienna','cat':'international_org','lat':48.236,'lon':16.406,'cc':'AT','desc':'Monitors nuclear programs globally. Iran deal negotiated here.'},
    {'name':'Interpol Lyon','cat':'intelligence_hq','lat':45.749,'lon':4.847,'cc':'FR','desc':'International police coordination. 195 member countries.'},
    {'name':'BIS Basel','cat':'financial_hub','lat':47.560,'lon':7.588,'cc':'CH','desc':'Bank for International Settlements. Central bank of central banks.','fun':'The most powerful bank nobody talks about'},
    {'name':'Davos Congress Center','cat':'conspiracy','lat':46.802,'lon':9.839,'cc':'CH','desc':'World Economic Forum. Global elite annual gathering.','fun':'500 private jets per year. Protesters banned from town'},
    {'name':'Bilderberg Meetings','cat':'conspiracy','lat':52.155,'lon':5.386,'cc':'NL','desc':'Annual Western elite gathering. No press. No public agenda.','fun':'Conspiracy theorists say it rules the world'},
    # ══════════════════════════════════════════════════════════════════════
    # 💧 DESALINATION & WATER
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Ras Al-Khair Desalination KSA','cat':'desalination','lat':27.440,'lon':49.116,'cc':'SA','desc':'World\'s largest desalination plant. 1.025M m³/day.'},
    {'name':'Sorek Desalination Israel','cat':'desalination','lat':31.960,'lon':34.740,'cc':'IL','desc':'World\'s largest SWRO plant. 624,000 m³/day. Technology model.'},
    {'name':'Dubai Jebel Ali Desalination','cat':'desalination','lat':24.979,'lon':55.062,'cc':'AE','desc':'UAE\'s main water source. 636,000 m³/day.'},
    {'name':'Carlsbad Desalination California','cat':'desalination','lat':33.100,'lon':-117.320,'cc':'US','desc':'Largest in Western hemisphere. 50M gallons/day. San Diego water.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🌾 AGRICULTURE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Iowa Corn Belt Center','cat':'agri_megafarm','lat':42.000,'lon':-94.000,'cc':'US','desc':'Heart of US corn belt. 12B bushels/yr. Global food price driver.'},
    {'name':'Ukraine Chernozem Belt','cat':'agri_megafarm','lat':49.000,'lon':32.000,'cc':'UA','desc':'World\'s most fertile soil. Breadbasket of Europe. War disrupted global food.','fun':'One-third of world\'s black soil is in Ukraine'},
    {'name':'Mekong Delta Vietnam','cat':'agri_megafarm','lat':10.500,'lon':105.600,'cc':'VN','desc':'Southeast Asia rice bowl. 25M tons rice/yr. 18M people.'},
    {'name':'Punjab Breadbasket India','cat':'agri_megafarm','lat':30.700,'lon':76.000,'cc':'IN','desc':'Green Revolution heart. 20% of India\'s wheat and rice.'},
    {'name':'Pampas Grasslands Argentina','cat':'agri_megafarm','lat':-34.000,'lon':-62.000,'cc':'AR','desc':'South America soy + beef giant. 50M cattle. $24B exports.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🎮 CONTROL TOWERS (iconic world landmarks — playable)
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Eiffel Tower','cat':'control_tower','lat':48.858,'lon':2.295,'cc':'FR','desc':'7M visitors/yr. Paris symbol. Built for 1889 World Fair.','fun':'Taller in summer by 15cm (thermal expansion)','featured':True},
    {'name':'Big Ben Westminster','cat':'control_tower','lat':51.500,'lon':-0.124,'cc':'GB','desc':'UK Parliament. 96m tower. Rings on BBC since 1923.','featured':True},
    {'name':'Burj Khalifa','cat':'control_tower','lat':25.197,'lon':55.274,'cc':'AE','desc':'World\'s tallest. 828m. 163 floors. Dubai icon.','fun':'Residents in upper floors have 2 iftars/day in Ramadan','featured':True},
    {'name':'Empire State Building','cat':'control_tower','lat':40.748,'lon':-73.985,'cc':'US','desc':'NYC Art Deco. 443m. 102 floors. Built in 410 days.','featured':True},
    {'name':'Petronas Towers','cat':'control_tower','lat':3.158,'lon':101.712,'cc':'MY','desc':'Twin towers. 452m. Connected by sky bridge at floor 41.','fun':'Deepest foundations of any skyscraper'},
    {'name':'CN Tower','cat':'control_tower','lat':43.643,'lon':-79.387,'cc':'CA','desc':'553m. Was world\'s tallest 1976-2007.','featured':True},
    {'name':'Tokyo Skytree','cat':'control_tower','lat':35.710,'lon':139.811,'cc':'JP','desc':'World\'s tallest tower. 634m. Broadcast tower.','featured':True},
    {'name':'Sydney Opera House','cat':'control_tower','lat':-33.857,'lon':151.215,'cc':'AU','desc':'UNESCO Heritage. Sails design by Jørn Utzon.','featured':True},
    {'name':'Sagrada Família','cat':'control_tower','lat':41.404,'lon':2.174,'cc':'ES','desc':'Gaudí masterpiece. Under construction since 1882. Still unfinished.','fun':'Construction permit granted in 2019. First since 1882','featured':True},
    {'name':'Taj Mahal','cat':'control_tower','lat':27.175,'lon':78.042,'cc':'IN','desc':'1653 Mughal mausoleum. 20,000 workers. 22 years. UNESCO.','featured':True},
    {'name':'Colosseum','cat':'control_tower','lat':41.890,'lon':12.492,'cc':'IT','desc':'70 AD. 50,000 capacity. 100 days of games at opening.','featured':True},
    {'name':'Acropolis Athens','cat':'control_tower','lat':37.971,'lon':23.726,'cc':'GR','desc':'2,500 years old. Birthplace of democracy. Parthenon.','featured':True},
    {'name':'Notre-Dame de Paris','cat':'control_tower','lat':48.853,'lon':2.349,'cc':'FR','desc':'Gothic cathedral 1345. Survived fire 2019. Rebuilding.','featured':True},
    {'name':'Great Wall Jinshanling','cat':'control_tower','lat':40.676,'lon':117.231,'cc':'CN','desc':'13,170 miles long. Ming dynasty section. UNESCO.','featured':True},
    {'name':'Kremlin Moscow','cat':'control_tower','lat':55.752,'lon':37.615,'cc':'RU','desc':'15th century fortress. Russian government seat. Nuclear command.','featured':True},
    {'name':'White House','cat':'control_tower','lat':38.898,'lon':-77.036,'cc':'US','desc':'Presidential residence since 1800. 132 rooms. 35 bathrooms.','featured':True},
    {'name':'Chichen Itza El Castillo','cat':'control_tower','lat':20.684,'lon':-88.568,'cc':'MX','desc':'Maya pyramid. Shadow serpent appears at equinox.','fun':'Calendar built into architecture — 365 steps total'},
    {'name':'Angkor Wat','cat':'control_tower','lat':13.413,'lon':103.867,'cc':'KH','desc':'World\'s largest religious monument. 400 sq km. UNESCO.','featured':True},
    {'name':'Machu Picchu','cat':'control_tower','lat':-13.163,'lon':-72.545,'cc':'PE','desc':'Inca citadel. 2,430m altitude. Lost for 400 years.','featured':True},
    {'name':'Great Pyramid of Giza','cat':'control_tower','lat':29.979,'lon':31.134,'cc':'EG','desc':'Only surviving ancient wonder. 4,500 years old. 2.3M blocks.','featured':True},
    {'name':'Petra Treasury','cat':'control_tower','lat':30.329,'lon':35.444,'cc':'JO','desc':'Rose-red city carved in rock. 2000 years old. Indiana Jones filming.','featured':True},
    {'name':'Stonehenge','cat':'control_tower','lat':51.180,'lon':-1.826,'cc':'GB','desc':'3000 BC. Purpose debated. Aligned with solstice sunrise.','fun':'Bluestones transported 240km from Wales'},
    {'name':'Easter Island Ahu Tongariki','cat':'control_tower','lat':-27.125,'lon':-109.283,'cc':'CL','desc':'15 moai statues. Largest ahu. Civilization collapsed building statues.','featured':True},
    # ══════════════════════════════════════════════════════════════════════
    # 🕵️ INTELLIGENCE & SECRET
    # ══════════════════════════════════════════════════════════════════════
    {'name':'NSA Fort Meade','cat':'intelligence_hq','lat':39.108,'lon':-76.771,'cc':'US','desc':'30,000+ employees. Monitors global communications. PRISM program.','fun':'Biggest employer in Maryland that nobody talks about'},
    {'name':'CIA Langley','cat':'intelligence_hq','lat':38.953,'lon':-77.147,'cc':'US','desc':'CIA HQ. 21,000 employees. George Bush Center for Intelligence.','fun':'Stars on memorial wall are for fallen agents — some unnamed'},
    {'name':'GCHQ Cheltenham','cat':'intelligence_hq','lat':51.899,'lon':-2.135,'cc':'GB','desc':'UK signals intelligence. The Doughnut. Snowden exposed it.'},
    {'name':'FSB Lubyanka Moscow','cat':'intelligence_hq','lat':55.761,'lon':37.627,'cc':'RU','desc':'Russian FSB. Former KGB HQ. Prison in basement.','fun':'Stalin\'s office connected to Kremlin by secret tunnel'},
    {'name':'MSS Beijing','cat':'intelligence_hq','lat':39.929,'lon':116.391,'cc':'CN','desc':'Ministry of State Security. China\'s CIA + FBI combined.'},
    {'name':'Mossad HQ Herzliya','cat':'intelligence_hq','lat':32.169,'lon':34.828,'cc':'IL','desc':'Israel\'s intelligence agency. Location was secret until 2015.'},
    {'name':'Area 51 Nevada','cat':'secret_facility','lat':37.235,'lon':-115.811,'cc':'US','desc':'USAF classified facility. U-2, SR-71, F-117 tested here.','fun':'2.5M people pledged to storm it in 2019. 150 showed up'},
    {'name':'Pine Gap Australia','cat':'secret_facility','lat':-23.799,'lon':133.737,'cc':'AU','desc':'Joint US-AU signals intelligence. Controls satellites.','fun':'Even Australian parliament wasn\'t told what happened there'},
    {'name':'Epstein Island','cat':'conspiracy','lat':18.300,'lon':-64.825,'cc':'VI','desc':'Jeffrey Epstein\'s Little St. James. Site of elite trafficking crimes.','fun':'Bought for $7.95M in 1998. Temple on hill remains unexplained','featured':True},
    {'name':'Bohemian Grove','cat':'conspiracy','lat':38.476,'lon':-123.000,'cc':'US','desc':'Annual gathering of 2,000+ powerful men. Owl ceremony. Nixon called it disgraceful.'},
    {'name':'Svalbard Doomsday Vault','cat':'seed_vault','lat':78.237,'lon':15.492,'cc':'NO','desc':'1.3M seed varieties. Survive nuclear war or climate collapse.','fun':'North Korea and US both have seeds stored here'},
    # ══════════════════════════════════════════════════════════════════════
    # 💰 OFFSHORE & FINANCIAL
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Cayman Islands George Town','cat':'offshore_haven','lat':19.293,'lon':-81.381,'cc':'KY','desc':'$2.5 trillion in assets. More companies than people. No income tax.','fun':'65,000 companies. 60,000 people'},
    {'name':'British Virgin Islands Road Town','cat':'offshore_haven','lat':18.428,'lon':-64.621,'cc':'VG','desc':'500,000+ company registrations. World\'s top offshore center.'},
    {'name':'Luxembourg City','cat':'offshore_haven','lat':49.611,'lon':6.130,'cc':'LU','desc':'EU\'s biggest tax haven. $5T in investment funds.'},
    {'name':'Delaware Wilmington','cat':'offshore_haven','lat':39.745,'lon':-75.546,'cc':'US','desc':'67% of Fortune 500 incorporated here. Zero tax on out-of-state.','fun':'More corporations than people. No state income tax on holding companies'},
    {'name':'Guernsey St Peter Port','cat':'offshore_haven','lat':49.459,'lon':-2.535,'cc':'GG','desc':'Crown dependency. £200B+ in assets. Private equity hub.'},
    {'name':'Monaco Monte Carlo','cat':'oligarch_asset','lat':43.738,'lon':7.428,'cc':'MC','desc':'96% millionaires. Highest GDP/capita. Zero income tax.','fun':'More Rolls-Royces per capita than anywhere'},
    {'name':'Rothschild Chateau Mouton','cat':'oligarch_asset','lat':45.218,'lon':-0.814,'cc':'FR','desc':'Most famous wine estate. $10k+ per bottle. Rothschild family since 1853.'},
    {'name':'Necker Island BVI','cat':'oligarch_asset','lat':18.508,'lon':-64.368,'cc':'VG','desc':'Richard Branson private island. $80k/night. 70 staff.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏔️ MORE MOUNTAINS & GEOGRAPHY
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Mount Everest','cat':'mountain_peak','lat':27.988,'lon':86.925,'cc':'NP','desc':'8,849m. Highest point on Earth. First summited 1953.','fun':'300+ corpses still on mountain. Too dangerous to recover','featured':True},
    {'name':'K2','cat':'mountain_peak','lat':35.880,'lon':76.514,'cc':'PK','desc':'8,611m. Second highest. Deadliest — 1 death per 4 summits.','fun':'Never summited in winter until 2021 (Nepal team)'},
    {'name':'Kilimanjaro','cat':'mountain_peak','lat':-3.065,'lon':37.355,'cc':'TZ','desc':'5,895m. Africa\'s highest. Glacier shrinking 80% since 1912.'},
    {'name':'Mont Blanc','cat':'mountain_peak','lat':45.833,'lon':6.865,'cc':'FR','desc':'4,808m. Highest in Alps and Western Europe.','fun':'France and Italy dispute exact summit location'},
    {'name':'Grand Canyon','cat':'canyon','lat':36.106,'lon':-112.113,'cc':'US','desc':'277 miles. 18 miles wide. 6,093 feet deep. 5-6M visitors/yr.','featured':True},
    {'name':'Victoria Falls','cat':'waterfall','lat':-17.925,'lon':25.857,'cc':'ZW','desc':'1.7km wide. 108m high. Largest curtain of falling water.','featured':True},
    {'name':'Angel Falls','cat':'waterfall','lat':5.968,'lon':-62.535,'cc':'VE','desc':'979m. World\'s highest uninterrupted waterfall.'},
    {'name':'Iguazu Falls','cat':'waterfall','lat':-25.695,'lon':-54.437,'cc':'AR','desc':'275 individual falls. Eleanor Roosevelt: Poor Niagara!','featured':True},
    {'name':'Mount Fuji','cat':'volcano','lat':35.362,'lon':138.731,'cc':'JP','desc':'3,776m. Japan\'s sacred symbol. Last erupted 1707.','featured':True},
    {'name':'Yellowstone Supervolcano','cat':'volcano','lat':44.600,'lon':-110.500,'cc':'US','desc':'Supervolcano. 640,000 yr eruption cycle. Overdue?','fun':'Eruption would cover North America in ash','featured':True},
    {'name':'Kīlauea Volcano','cat':'volcano','lat':19.421,'lon':-155.287,'cc':'US','desc':'Most active volcano on Earth. Continuously erupting since 1983.'},
    {'name':'Stromboli','cat':'volcano','lat':38.789,'lon':15.213,'cc':'IT','desc':'Lighthouse of the Mediterranean. Erupts every 20 minutes.'},
    {'name':'Pompeii Ruins','cat':'ancient_ruins','lat':40.751,'lon':14.490,'cc':'IT','desc':'Destroyed by Vesuvius 79 AD. City preserved in ash. 3M visitors/yr.','featured':True},
    # ══════════════════════════════════════════════════════════════════════
    # 🚀 SPACE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Kennedy Space Center','cat':'space_center','lat':28.524,'lon':-80.680,'cc':'US','desc':'Apollo, Shuttle, Artemis. Human spaceflight HQ since 1962.','featured':True},
    {'name':'Baikonur Cosmodrome','cat':'space_center','lat':45.920,'lon':63.342,'cc':'KZ','desc':'World\'s first and largest. Gagarin launched from here.','fun':'Russia leases this from Kazakhstan for $115M/yr','featured':True},
    {'name':'SpaceX Starbase','cat':'space_center','lat':25.997,'lon':-97.155,'cc':'US','desc':'Starship launch site. Largest rocket ever built tested here.'},
    {'name':'ESA Guiana Space Centre','cat':'space_center','lat':5.239,'lon':-52.769,'cc':'GF','desc':'Europe\'s equatorial launch site. Ariane 5 launched Rosetta, Webb.'},
    {'name':'Satish Dhawan ISRO','cat':'space_center','lat':13.733,'lon':80.235,'cc':'IN','desc':'India\'s launch hub. Chandrayaan Moon missions. Mars Orbiter.'},
    {'name':'Wenchang Space Launch','cat':'space_center','lat':19.614,'lon':110.951,'cc':'CN','desc':'China\'s newest coastal launch site. Long March 5 launches.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🛢️ RESOURCES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Ghawar Oil Field','cat':'oil_field','lat':25.150,'lon':49.260,'cc':'SA','desc':'World\'s largest conventional oil field. 3.8M bbl/day.','fun':'Produces more oil than entire countries','featured':True},
    {'name':'Permian Basin','cat':'oil_field','lat':31.850,'lon':-102.400,'cc':'US','desc':'5.7M bbl/day. US shale revolution. West Texas.'},
    {'name':'Athabasca Oil Sands','cat':'oil_field','lat':57.100,'lon':-111.500,'cc':'CA','desc':'170 billion barrels. 3.2M bbl/day. World\'s largest oil sands.'},
    {'name':'South Pars Gas Field','cat':'gas_reserve','lat':26.800,'lon':52.600,'cc':'IR','desc':'World\'s largest gas field. Shared Iran-Qatar border.'},
    {'name':'Bayan Obo Rare Earth Mine','cat':'rare_earth','lat':41.770,'lon':109.980,'cc':'CN','desc':'World\'s largest rare earth. 60% of global supply.','featured':True},
    {'name':'Atacama Lithium Salar','cat':'lithium_deposit','lat':-23.500,'lon':-68.250,'cc':'CL','desc':'180k tons LCE/yr. World\'s largest lithium brine.','featured':True},
    {'name':'Salar de Uyuni','cat':'lithium_deposit','lat':-20.140,'lon':-67.490,'cc':'BO','desc':'21M tons reserves. Largest lithium deposit on Earth. Salt flats.','featured':True},
    {'name':'Jwaneng Diamond Mine','cat':'diamond_mine','lat':-24.600,'lon':24.720,'cc':'BW','desc':'World\'s richest diamond mine by value.'},
    {'name':'Witwatersrand Gold Belt','cat':'gold_mine','lat':-26.200,'lon':27.500,'cc':'ZA','desc':'Half of all gold ever mined came from here.','featured':True},
    {'name':'McArthur River Uranium','cat':'uranium_mine','lat':57.760,'lon':-105.290,'cc':'CA','desc':'World\'s highest-grade uranium ore.'},
    {'name':'Zaporizhzhia Nuclear Plant','cat':'nuclear_plant','lat':47.510,'lon':34.590,'cc':'UA','desc':'Europe\'s largest nuclear plant. Under Russian control since March 2022.','fun':'IAEA stationed permanent monitoring team','featured':True},
    {'name':'Bruce Nuclear Generating Station','cat':'nuclear_plant','lat':44.330,'lon':-81.590,'cc':'CA','desc':'6.4 GW. World\'s 2nd largest nuclear complex.'},
    # ══════════════════════════════════════════════════════════════════════
    # ⚓ CHOKEPOINTS & PORTS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Strait of Hormuz','cat':'chokepoint','lat':26.560,'lon':56.270,'cc':'IR','desc':'21M bbl oil/day. Iran can close it. 20% global oil.','featured':True},
    {'name':'Strait of Malacca','cat':'chokepoint','lat':2.500,'lon':102.000,'cc':'MY','desc':'Busiest shipping lane. 90,000 ships/yr. Piracy hotspot.','featured':True},
    {'name':'Suez Canal','cat':'chokepoint','lat':30.580,'lon':32.330,'cc':'EG','desc':'12% global trade. Ever Given blocked it 2021.','fun':'Ever Given blocking cost $400M/hour in trade','featured':True},
    {'name':'Panama Canal','cat':'chokepoint','lat':9.080,'lon':-79.680,'cc':'PA','desc':'14,000 ships/yr. $3B in tolls. Built 1914.','featured':True},
    {'name':'Bosphorus Strait','cat':'chokepoint','lat':41.070,'lon':29.060,'cc':'TR','desc':'Only Black Sea access. Turkey controls it. Ukraine grain route.'},
    {'name':'Bab-el-Mandeb','cat':'chokepoint','lat':12.600,'lon':43.400,'cc':'YE','desc':'Red Sea access. Yemen war zone. Houthi drone attacks.','fun':'Houthi attacks rerouted 20% of global container trade'},
    {'name':'Port of Shanghai','cat':'mega_port','lat':31.240,'lon':121.500,'cc':'CN','desc':'World\'s busiest port. 47M TEU/yr.','featured':True},
    {'name':'Port of Singapore','cat':'mega_port','lat':1.270,'lon':103.830,'cc':'SG','desc':'37M TEU/yr. World\'s most efficient. 600+ shipping lines.','featured':True},
    {'name':'Port of Rotterdam','cat':'mega_port','lat':51.900,'lon':4.470,'cc':'NL','desc':'Europe\'s largest. 15M TEU/yr. European gateway.'},
    {'name':'Jebel Ali Port Dubai','cat':'mega_port','lat':24.980,'lon':55.070,'cc':'AE','desc':'14M TEU/yr. Largest port in Middle East. Man-made.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏛️ RELIGIOUS & CULTURE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Vatican City','cat':'religious_site','lat':41.903,'lon':12.454,'cc':'VA','desc':'World\'s smallest country. 800 citizens. $8B+ assets. Sistine Chapel.','featured':True},
    {'name':'Mecca Masjid al-Haram','cat':'religious_site','lat':21.423,'lon':39.826,'cc':'SA','desc':'Holiest Islamic site. 2M+ pilgrims/yr. Kaaba.','fun':'Non-Muslims banned from entering the city','featured':True},
    {'name':'Jerusalem Temple Mount','cat':'religious_site','lat':31.778,'lon':35.235,'cc':'IL','desc':'Holy to 3 religions. Most contested land on Earth. Al-Aqsa + Western Wall.','featured':True},
    {'name':'Varanasi Ganges Ghats','cat':'religious_site','lat':25.317,'lon':83.013,'cc':'IN','desc':'Oldest inhabited city. Hindus cremate dead on banks.','fun':'Continuously inhabited for 3,000+ years'},
    {'name':'Potala Palace Lhasa','cat':'royal_palace','lat':29.657,'lon':91.117,'cc':'CN','desc':'Dalai Lama\'s former palace. 13 stories. 1,000 rooms.'},
    {'name':'Buckingham Palace','cat':'royal_palace','lat':51.501,'lon':-0.142,'cc':'GB','desc':'British Royal residence. 775 rooms. £2B estimated value.'},
    {'name':'Versailles Palace','cat':'royal_palace','lat':48.805,'lon':2.120,'cc':'FR','desc':'Sun King\'s palace. 700 rooms. Hall of Mirrors. 6M visitors/yr.','featured':True},
    {'name':'Forbidden City Beijing','cat':'royal_palace','lat':39.916,'lon':116.390,'cc':'CN','desc':'9,999 rooms. Ming dynasty. 500 years imperial China.','featured':True},
    {'name':'Hermitage Museum St Petersburg','cat':'museum','lat':59.940,'lon':30.315,'cc':'RU','desc':'3M art objects. One of world\'s largest museums. Winter Palace.'},
    {'name':'Louvre Museum Paris','cat':'museum','lat':48.860,'lon':2.337,'cc':'FR','desc':'35,000 objects. 9M visitors/yr. Mona Lisa. Most visited museum.','featured':True},
    {'name':'Smithsonian Washington','cat':'museum','lat':38.891,'lon':-77.026,'cc':'US','desc':'19 museums. Free admission. 154M objects in collection.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏢 TECH GIANTS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Apple Park Cupertino','cat':'tech_giant','lat':37.335,'lon':-122.009,'cc':'US','desc':'$5B spaceship. 12,000 employees. Most valuable company ever.','featured':True},
    {'name':'Googleplex Mountain View','cat':'tech_giant','lat':37.422,'lon':-122.084,'cc':'US','desc':'Google/Alphabet HQ. 140,000 employees globally. Self-driving cars.','featured':True},
    {'name':'Meta Menlo Park','cat':'tech_giant','lat':37.484,'lon':-122.148,'cc':'US','desc':'Facebook/Meta. 3.3B users. WhatsApp, Instagram, Oculus.'},
    {'name':'Microsoft Redmond Campus','cat':'tech_giant','lat':47.644,'lon':-122.124,'cc':'US','desc':'500+ buildings. 50,000 employees. Azure cloud HQ.'},
    {'name':'Amazon Seattle HQ2','cat':'tech_giant','lat':47.615,'lon':-122.336,'cc':'US','desc':'Spheres biome landmark. AWS runs 33% of internet.'},
    {'name':'Alibaba Hangzhou HQ','cat':'tech_giant','lat':30.280,'lon':120.050,'cc':'CN','desc':'Jack Ma\'s empire. $400B+ revenue. AliPay, Taobao, Cloud.'},
    {'name':'Tencent Shenzhen HQ','cat':'tech_giant','lat':22.542,'lon':113.944,'cc':'CN','desc':'WeChat. 1.3B users. Gaming giant. $500B+ valuation.'},
    {'name':'ByteDance Beijing HQ','cat':'tech_giant','lat':39.984,'lon':116.432,'cc':'CN','desc':'TikTok parent. Most downloaded app ever. $300B valuation.'},
    {'name':'NVIDIA Santa Clara','cat':'tech_giant','lat':37.352,'lon':-121.985,'cc':'US','desc':'AI chip monopoly. $3T+ valuation. H100 GPU controls AI.','fun':'Jensen Huang started in a Denny\'s booth'},
    {'name':'Tesla Austin Gigafactory','cat':'tech_giant','lat':30.222,'lon':-97.624,'cc':'US','desc':'World\'s largest manufacturing building. 500,000 cars/yr.'},
    {'name':'SpaceX HQ Hawthorne','cat':'tech_giant','lat':33.920,'lon':-118.328,'cc':'US','desc':'First reusable rocket company. Starlink: 6,000 satellites.'},
    # ══════════════════════════════════════════════════════════════════════
    # ⛏️ MORE MINES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Muruntau Gold Mine','cat':'gold_mine','lat':41.500,'lon':64.580,'cc':'UZ','desc':'World\'s largest open-pit gold mine. 66 tons/yr.'},
    {'name':'Grasberg Mine Papua','cat':'gold_mine','lat':-4.053,'lon':137.116,'cc':'ID','desc':'Gold + copper giant in jungle. 50+ tons gold/yr.'},
    {'name':'Pilbara Iron Range WA','cat':'iron_ore','lat':-22.500,'lon':118.500,'cc':'AU','desc':'World\'s largest iron ore export region. 850M tons/yr.'},
    {'name':'Carajás Iron Ore Brazil','cat':'iron_ore','lat':-6.060,'lon':-50.180,'cc':'BR','desc':'World\'s largest iron ore mine. 170M tons/yr.'},
    {'name':'Escondida Copper Chile','cat':'copper_mine','lat':-24.270,'lon':-69.070,'cc':'CL','desc':'World\'s largest copper mine. 1.2M tons/yr.'},
    {'name':'Bingham Canyon Utah','cat':'copper_mine','lat':40.530,'lon':-112.150,'cc':'US','desc':'Largest man-made excavation on Earth. 230k tons copper/yr.'},
    {'name':'Norilsk Nickel Complex','cat':'copper_mine','lat':69.349,'lon':88.202,'cc':'RU','desc':'World\'s largest nickel producer. Most polluted Arctic city.','fun':'Snow turns black from sulfur dioxide'},
    {'name':'Kolwezi Cobalt Belt','cat':'copper_mine','lat':-10.714,'lon':25.473,'cc':'CD','desc':'50% world\'s cobalt. Essential for EV batteries.','fun':'Congo controls the mineral that powers your phone'},
]

def seed():
    from terra_domini.apps.events.unified_poi import POI_VISUAL
    created = updated = errors = 0
    for p in POIS:
        try:
            cfg = POI_VISUAL.get(p['cat'], {})
            obj, was_created = UnifiedPOI.objects.update_or_create(
                name=p['name'],
                defaults={
                    'category':     p['cat'],
                    'latitude':     p['lat'],
                    'longitude':    p['lon'],
                    'country_code': p.get('cc','')[:4],
                    'description':  p.get('desc',''),
                    'real_output':  p.get('real_output',''),
                    'fun_fact':     p.get('fun',''),
                    'is_featured':  p.get('featured', False),
                    'source':       'seed',
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
            if was_created: created += 1
            else: updated += 1
        except Exception as e:
            errors += 1
            print(f"  ❌ {p['name']}: {e}")

    print(f"\n✅ Seeded: {created} created, {updated} updated, {errors} errors")
    print(f"   Total: {UnifiedPOI.objects.count()} POIs in database")
    from collections import Counter
    cats = Counter(UnifiedPOI.objects.values_list('category', flat=True))
    print(f"   Categories: {len(cats)}")
    rarities = Counter(UnifiedPOI.objects.values_list('rarity', flat=True))
    for r, n in sorted(rarities.items()):
        print(f"   {r}: {n}")

if __name__ == '__main__':
    seed()
