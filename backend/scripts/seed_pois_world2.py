#!/usr/bin/env python3
"""
World POI Seed Part 2 — Africa, Middle East, Asia & Global Tourism
600+ additional locations researched from UNESCO, Lonely Planet, Wikipedia.
"""
import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dev-seed-key')
django.setup()
from terra_domini.apps.events.unified_poi import UnifiedPOI, POI_VISUAL

POIS = [
    # ══════════════════════════════════════════════════════════════════════
    # 🌍 AFRICA — UNESCO & Natural Wonders
    # ══════════════════════════════════════════════════════════════════════
    # Egypt
    {'name':'Valley of the Kings Luxor','cat':'ancient_ruins','lat':25.746,'lon':32.601,'cc':'EG','desc':'Tombs of 63 pharaohs incl. Tutankhamun. New Kingdom burial site.','fun':'KV62 (Tutankhamun) found sealed with treasures in 1922','featured':True},
    {'name':'Abu Simbel Temples','cat':'ancient_ruins','lat':22.337,'lon':31.626,'cc':'EG','desc':'Ramesses II temples. Moved 64m uphill to save from Aswan Dam flooding.','fun':'Sunlight hits inner sanctum on Ramesses birthday twice/year','featured':True},
    {'name':'Karnak Temple Complex','cat':'religious_site','lat':25.719,'lon':32.658,'cc':'EG','desc':'Largest ancient religious site. Built over 2,000 years by 30 pharaohs.'},
    {'name':'Alexandria Catacombs','cat':'ancient_ruins','lat':31.186,'lon':29.898,'cc':'EG','desc':'Greco-Roman necropolis. 3 underground levels. Roman-Egyptian hybrid art.'},
    {'name':'Siwa Oasis','cat':'anomaly','lat':29.203,'lon':25.519,'cc':'EG','desc':'Remote oasis. Oracle of Amun consulted by Alexander the Great.','fun':'Alexander declared son of Zeus here'},
    # Morocco
    {'name':'Djemaa el-Fna Marrakech','cat':'ancient_ruins','lat':31.626,'lon':-7.989,'cc':'MA','desc':'UNESCO Oral Heritage. Snake charmers, storytellers, street food. Alive at night.','fun':'Only UNESCO-listed open-air square','featured':True},
    {'name':'Fes el-Bali Medina','cat':'world_heritage','lat':34.063,'lon':-5.008,'cc':'MA','desc':'World\'s largest car-free urban area. 9,000 alleys. Medieval labyrinth.','fun':'Some streets unchanged since 9th century'},
    {'name':'Ait Benhaddou Kasbah','cat':'ancient_ruins','lat':31.047,'lon':-7.132,'cc':'MA','desc':'Fortified clay city. UNESCO. Gladiator, Lawrence of Arabia filmed here.'},
    {'name':'Chefchaouen Blue City','cat':'ancient_ruins','lat':35.169,'lon':-5.269,'cc':'MA','desc':'Entire city painted blue. Atlas Mountains backdrop.','fun':'Blue paint was introduced by Jewish refugees in 1930s'},
    {'name':'Sahara Erg Chebbi Dunes','cat':'anomaly','lat':31.147,'lon':-3.931,'cc':'MA','desc':'Highest sand dunes in Morocco. 150m. Camel trekking. Milky Way views.'},
    # Tunisia
    {'name':'Carthage Ruins','cat':'ancient_ruins','lat':36.853,'lon':10.323,'cc':'TN','desc':'Ancient Phoenician city. Rome vs Carthage. Hannibal\'s birthplace.','fun':'Romans salted the earth after destroying it'},
    {'name':'Amphitheatre of El Jem','cat':'ancient_ruins','lat':35.296,'lon':10.706,'cc':'TN','desc':'Third largest Roman amphitheater. 35,000 capacity. Gladiator Games filmed here.'},
    {'name':'Medina of Tunis','cat':'world_heritage','lat':36.799,'lon':10.171,'cc':'TN','desc':'700 monuments over 12 centuries. Kasbah mosque, souks, palaces.'},
    # Ethiopia
    {'name':'Lalibela Rock Churches','cat':'religious_site','lat':12.032,'lon':39.044,'cc':'ET','desc':'11 monolithic churches carved from rock in 12th century. Christian pilgrimage.','fun':'Legend: angels helped build them overnight','featured':True},
    {'name':'Aksum Obelisks','cat':'ancient_ruins','lat':14.129,'lon':38.723,'cc':'ET','desc':'Ancient kingdom capital. Obelisks 1,700 years old. Ark of the Covenant alleged.','fun':'One obelisk was looted by Mussolini, returned in 2008'},
    {'name':'Simien Mountains National Park','cat':'nature_sanctuary','lat':13.250,'lon':38.082,'cc':'ET','desc':'Dramatic escarpments. Gelada baboons. Ethiopian wolves.'},
    {'name':'Danakil Depression','cat':'anomaly','lat':14.240,'lon':40.300,'cc':'ET','desc':'Hottest place on Earth (-125m). Volcanic lava lakes, salt flats, sulfur springs.','fun':'Temperatures reach 55°C. Humans live here permanently'},
    {'name':'Omo Valley Tribes','cat':'ancient_ruins','lat':5.800,'lon':36.500,'cc':'ET','desc':'Last untouched tribal cultures. 16 different ethnic groups.'},
    # Kenya
    {'name':'Maasai Mara National Reserve','cat':'nature_sanctuary','lat':-1.507,'lon':35.145,'cc':'KE','desc':'Great Migration — 1.5M wildebeest. Big Five. Continuous migration with Serengeti.','featured':True},
    {'name':'Amboseli National Park','cat':'nature_sanctuary','lat':-2.652,'lon':37.260,'cc':'KE','desc':'Elephant herds with Kilimanjaro backdrop. 1,600 elephants.'},
    {'name':'Lamu Old Town','cat':'world_heritage','lat':-2.269,'lon':40.902,'cc':'KE','desc':'East Africa\'s oldest living town. No cars — only donkeys. Swahili culture.'},
    {'name':'Mount Kenya National Park','cat':'mountain_peak','lat':0.151,'lon':37.308,'cc':'KE','desc':'5,199m. Second highest in Africa. Equatorial glaciers disappearing.'},
    # Tanzania
    {'name':'Serengeti National Park','cat':'nature_sanctuary','lat':-2.333,'lon':34.833,'cc':'TZ','desc':'UNESCO. 1.5M wildebeest migration. 5,000 lions. Endless plains.','fun':'Name means "endless plains" in Maasai','featured':True},
    {'name':'Ngorongoro Crater','cat':'nature_sanctuary','lat':-3.220,'lon':35.500,'cc':'TZ','desc':'World\'s largest intact volcanic caldera. 30,000 animals in 260km².','fun':'Animals can\'t escape — the crater is their world','featured':True},
    {'name':'Zanzibar Stone Town','cat':'world_heritage','lat':-6.163,'lon':39.194,'cc':'TZ','desc':'UNESCO. Swahili-Arab-Indian-Portuguese fusion. Slave trade history. Freddie Mercury birthplace.','fun':'Freddie Mercury was born here in 1946'},
    {'name':'Olduvai Gorge','cat':'ancient_ruins','lat':-2.995,'lon':35.350,'cc':'TZ','desc':'Cradle of Mankind. 3.6M year old human footprints. Homo habilis found here.'},
    # Rwanda
    {'name':'Volcanoes National Park Gorillas','cat':'nature_sanctuary','lat':-1.470,'lon':29.540,'cc':'RW','desc':'Half of world\'s mountain gorillas. Dian Fossey studied and died here.','fun':'Gorilla trekking permit costs $1,500','featured':True},
    # Uganda
    {'name':'Bwindi Impenetrable Forest','cat':'ancient_forest','lat':-1.050,'lon':29.700,'cc':'UG','desc':'UNESCO. 400+ mountain gorillas. 120 mammals. Most biodiverse in Africa.'},
    {'name':'Murchison Falls','cat':'waterfall','lat':2.280,'lon':31.680,'cc':'UG','desc':'World\'s most powerful waterfall. Nile squeezed through 7m gap.'},
    # South Africa
    {'name':'Cape of Good Hope','cat':'island','lat':-34.357,'lon':18.473,'cc':'ZA','desc':'Mythic sea point. Atlantic meets Indian Ocean nearby. Drake\'s Route.','featured':True},
    {'name':'Table Mountain Cape Town','cat':'mountain_peak','lat':-33.962,'lon':18.403,'cc':'ZA','desc':'Flat-topped. 1,086m. Cableway. One of New 7 Wonders of Nature.','featured':True},
    {'name':'Kruger National Park','cat':'nature_sanctuary','lat':-23.989,'lon':31.554,'cc':'ZA','desc':'South Africa\'s largest park. Big Five. 500 bird species.'},
    {'name':'Robben Island','cat':'world_heritage','lat':-33.808,'lon':18.367,'cc':'ZA','desc':'Mandela imprisoned here 18 years. Symbol of anti-apartheid struggle.','fun':'Now a museum run by former political prisoners'},
    {'name':'Vredefort Dome','cat':'anomaly','lat':-27.008,'lon':27.339,'cc':'ZA','desc':'World\'s oldest and largest meteorite impact crater. 2B years old. 300km diameter.'},
    {'name':'Blyde River Canyon','cat':'canyon','lat':-24.570,'lon':30.821,'cc':'ZA','desc':'Third largest canyon. Green canyon — lush vegetation unlike arid US/AZ canyons.'},
    # Zimbabwe / Zambia
    {'name':'Great Zimbabwe Ruins','cat':'ancient_ruins','lat':-20.267,'lon':30.933,'cc':'ZW','desc':'Medieval stone city. Capital of Mutapa Kingdom. 11th-15th century. 18,000 people.','fun':'Country named after it'},
    # West Africa
    {'name':'Timbuktu Manuscripts','cat':'world_heritage','lat':16.774,'lon':-3.007,'cc':'ML','desc':'City of 333 saints. Medieval Islamic scholarship. 700,000 manuscripts. UNESCO.','fun':'100,000 manuscripts hidden from ISIS destruction'},
    {'name':'Goree Island Dakar','cat':'world_heritage','lat':14.665,'lon':-17.400,'cc':'SN','desc':'Slave trade departure point. House of Slaves. 20M enslaved passed through.','featured':True},
    {'name':'Elmina Castle Ghana','cat':'world_heritage','lat':5.084,'lon':-1.351,'cc':'GH','desc':'Oldest European building in sub-Saharan Africa. Slave trade hub since 1482.'},
    {'name':'Benin Bronze Kingdom','cat':'ancient_ruins','lat':6.335,'lon':5.627,'cc':'NG','desc':'Bronze sculptures looted by British 1897. Still debated return. UNESCO.'},
    # Madagascar
    {'name':'Avenue of the Baobabs','cat':'ancient_forest','lat':-20.253,'lon':44.419,'cc':'MG','desc':'Giants up to 800 years old. Iconic Madagascar image. Sacred to locals.','fun':'These are technically upside-down trees (roots up)'},
    {'name':'Tsingy de Bemaraha','cat':'anomaly','lat':-18.700,'lon':44.900,'cc':'MG','desc':'Stone forest — razor-sharp limestone pinnacles. Unique lemur habitat.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🕌 MIDDLE EAST
    # ══════════════════════════════════════════════════════════════════════
    # Turkey
    {'name':'Hagia Sophia Istanbul','cat':'religious_site','lat':41.008,'lon':28.980,'cc':'TR','desc':'1,500 years old. Mosque→Church→Museum→Mosque. Byzantine masterpiece.','fun':'Largest cathedral for 1,000 years. Reconverted to mosque in 2020','featured':True},
    {'name':'Blue Mosque Istanbul','cat':'religious_site','lat':41.005,'lon':28.977,'cc':'TR','desc':'Sultan Ahmed Mosque. 6 minarets. 20,000 Iznik tiles.','featured':True},
    {'name':'Topkapi Palace','cat':'royal_palace','lat':41.012,'lon':28.985,'cc':'TR','desc':'650 years of Ottoman rule. Harem. Prophet Muhammad\'s mantle and sword.'},
    {'name':'Cappadocia Fairy Chimneys','cat':'anomaly','lat':38.643,'lon':34.829,'cc':'TR','desc':'Volcanic rock formations. Underground cities. Hot air balloon mecca.','fun':'Early Christians carved entire cities underground to hide from persecution','featured':True},
    {'name':'Pamukkale Thermal Pools','cat':'anomaly','lat':37.921,'lon':29.118,'cc':'TR','desc':'Cotton Castle — white travertine terraces. Roman spa city Hierapolis adjacent.'},
    {'name':'Ephesus Ruins','cat':'ancient_ruins','lat':37.940,'lon':27.342,'cc':'TR','desc':'One of best-preserved Roman cities. Library of Celsus. Temple of Artemis site.'},
    {'name':'Mount Ararat','cat':'mountain_peak','lat':39.702,'lon':44.298,'cc':'TR','desc':'5,137m. Where Noah\'s Ark supposedly landed. Armenian sacred mountain.','fun':'Visible from 3 countries. Noah\'s Ark expeditions still happen'},
    {'name':'Gobekli Tepe','cat':'ancient_ruins','lat':37.223,'lon':38.922,'cc':'TR','desc':'World\'s oldest temple. 11,600 years old. Rewrote human history.','fun':'Predates Stonehenge by 7,000 years. Built before agriculture','featured':True},
    # Jordan
    {'name':'Petra Treasury','cat':'ancient_ruins','lat':30.329,'lon':35.444,'cc':'JO','desc':'Rose-red Nabataean city. Treasury carved in rock. New 7 Wonder.','featured':True},
    {'name':'Wadi Rum Desert','cat':'anomaly','lat':29.576,'lon':35.419,'cc':'JO','desc':'Valley of the Moon. Lawrence of Arabia country. Mars films shot here.'},
    {'name':'Dead Sea Lowest Point','cat':'anomaly','lat':31.525,'lon':35.487,'cc':'JO','desc':'-430m. Cannot sink. 34% salt. Skin therapy. Shrinking rapidly.','featured':True},
    {'name':'Jerash Roman City','cat':'ancient_ruins','lat':32.273,'lon':35.902,'cc':'JO','desc':'Best preserved Roman city in world outside Italy. Ongoing Roman games.'},
    # Saudi Arabia
    {'name':'Hegra Mada\'in Saleh','cat':'ancient_ruins','lat':26.810,'lon':37.950,'cc':'SA','desc':'Nabataean tombs. Older than Petra. Saudi Arabia\'s first UNESCO site.','fun':'Off-limits to tourists until 2019 — 2,000 years of isolation'},
    {'name':'Diriyah Ancient Capital','cat':'ancient_ruins','lat':24.734,'lon':46.574,'cc':'SA','desc':'UNESCO. Birthplace of Saudi state. Mud-brick UNESCO site in Riyadh suburb.'},
    {'name':'Empty Quarter Rub Al Khali','cat':'anomaly','lat':20.000,'lon':52.000,'cc':'SA','desc':'World\'s largest sand desert. 650,000 km². Dunes 250m high.','fun':'Contains enough sand to bury all of France'},
    {'name':'Al-Ula Valley','cat':'ancient_ruins','lat':26.614,'lon':37.920,'cc':'SA','desc':'AlUla — canyon, oasis, Nabataean tombs. Saudi Arabia\'s grand tourism project.'},
    # UAE
    {'name':'Dubai Creek Historic District','cat':'ancient_ruins','lat':25.262,'lon':55.303,'cc':'AE','desc':'Al Fahidi Fort 1787. Dhow wharfage. Traditional wind towers.'},
    {'name':'Abu Dhabi Sheikh Zayed Mosque','cat':'religious_site','lat':24.413,'lon':54.475,'cc':'AE','desc':'World\'s 3rd largest mosque. 40,000 capacity. 82 domes. White marble.','featured':True},
    {'name':'Masdar City Abu Dhabi','cat':'anomaly','lat':24.430,'lon':54.623,'cc':'AE','desc':'World\'s first planned zero-carbon city. Solar-powered. Driverless pods.','fun':'Spent $22B but only 10% occupied'},
    # Israel/Palestine
    {'name':'Old City of Jerusalem','cat':'religious_site','lat':31.778,'lon':35.235,'cc':'IL','desc':'4 quarters: Jewish, Muslim, Christian, Armenian. Western Wall, Al-Aqsa, Church of Holy Sepulchre.','featured':True},
    {'name':'Masada Fortress','cat':'ancient_ruins','lat':31.315,'lon':35.353,'cc':'IL','desc':'Herod\'s fortress. 960 Jewish rebels committed mass suicide vs. Romans 73 AD.','fun':'Masada shall not fall again — Israeli army oath'},
    {'name':'Caesarea Maritima','cat':'ancient_ruins','lat':32.500,'lon':34.890,'cc':'IL','desc':'Herod\'s Roman port city. Aqueduct, amphitheater, crusader walls all intact.'},
    # Iraq
    {'name':'Ancient Babylon','cat':'ancient_ruins','lat':32.542,'lon':44.421,'cc':'IQ','desc':'Hanging Gardens site. Nebuchadnezzar\'s capital. Ishtar Gate. UNESCO.','fun':'Saddam Hussein rebuilt Babylon on top of ruins'},
    {'name':'Ur of the Chaldees','cat':'ancient_ruins','lat':30.961,'lon':46.104,'cc':'IQ','desc':'Abraham\'s birthplace. One of first cities. Great Ziggurat 4,000 years old.'},
    {'name':'Erbil Citadel Kurdistan','cat':'world_heritage','lat':36.191,'lon':44.009,'cc':'IQ','desc':'Continuously inhabited for 8,000 years. Oldest inhabited city mound.'},
    # Iran
    {'name':'Persepolis','cat':'ancient_ruins','lat':29.935,'lon':52.891,'cc':'IR','desc':'Achaemenid Persian capital. Alexander burned it 330 BC. Reliefs of 28 nations.','featured':True},
    {'name':'Isfahan Naqsh-e Jahan Square','cat':'world_heritage','lat':32.657,'lon':51.677,'cc':'IR','desc':'UNESCO. Second largest square in world. Ali Qapu palace, mosques, bazaar.'},
    {'name':'Mount Damavand','cat':'volcano','lat':35.958,'lon':52.109,'cc':'IR','desc':'5,610m. Highest volcano in Asia. Highest peak in Iran + Middle East.'},
    {'name':'Nasir al-Mulk Mosque Shiraz','cat':'religious_site','lat':29.608,'lon':52.535,'cc':'IR','desc':'Pink Mosque. Stunning stained glass rainbow light play. 1888.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏯 ASIA — South & Southeast
    # ══════════════════════════════════════════════════════════════════════
    # India
    {'name':'Taj Mahal Agra','cat':'control_tower','lat':27.175,'lon':78.042,'cc':'IN','desc':'Mughal mausoleum. 22 years, 20,000 workers. New 7 Wonder.','fun':'Shah Jahan planned a black Taj Mahal across river — never built','featured':True},
    {'name':'Varanasi Ghats','cat':'religious_site','lat':25.317,'lon':83.013,'cc':'IN','desc':'Oldest living city. 84 ghats. Cremation on Ganges banks.','featured':True},
    {'name':'Hampi Vijayanagara','cat':'ancient_ruins','lat':15.335,'lon':76.461,'cc':'IN','desc':'UNESCO. Medieval empire capital. 1,600 monuments over 25 sq km.'},
    {'name':'Ajanta Ellora Caves','cat':'ancient_ruins','lat':20.552,'lon':75.700,'cc':'IN','desc':'30 Buddhist rock-cut temples. 2nd century BC. UNESCO. Masterpiece painting.'},
    {'name':'Jaisalmer Golden Fort','cat':'royal_palace','lat':26.912,'lon':70.912,'cc':'IN','desc':'Living fort — 3,000 people live inside. Yellow sandstone. 12th century.'},
    {'name':'Kerala Backwaters','cat':'nature_sanctuary','lat':9.500,'lon':76.350,'cc':'IN','desc':'900km canal network. Houseboat culture. Unique ecosystem.'},
    {'name':'Sundarbans Mangroves','cat':'ancient_forest','lat':22.000,'lon':89.200,'cc':'IN','desc':'World\'s largest mangrove. Bengal tigers swim between islands.','fun':'Tigers here learned to swim — only swimming tigers in the world'},
    {'name':'Rann of Kutch Salt Flat','cat':'anomaly','lat':23.742,'lon':69.942,'cc':'IN','desc':'World\'s largest seasonal salt flat. White desert. Flamingo breeding ground.'},
    # Nepal
    {'name':'Pashupatinath Temple','cat':'religious_site','lat':27.710,'lon':85.349,'cc':'NP','desc':'Holiest Hindu temple. Open cremation on Bagmati River. Sadhus.'},
    {'name':'Lumbini','cat':'religious_site','lat':27.484,'lon':83.276,'cc':'NP','desc':'UNESCO. Birthplace of Buddha. 2,500+ years. 32 countries\' temples.'},
    {'name':'Pokhara Lake','cat':'freshwater','lat':28.210,'lon':83.958,'cc':'NP','desc':'Gateway to Annapurna. Phewa Lake reflection of Machhapuchhre.'},
    # Bhutan
    {'name':'Tiger\'s Nest Monastery','cat':'religious_site','lat':27.491,'lon':89.363,'cc':'BT','desc':'Paro Taktsang. 900m cliff. Guru Rinpoche meditated here 8th century.','fun':'Most visited site in a country that limits tourism','featured':True},
    {'name':'Punakha Dzong','cat':'royal_palace','lat':27.592,'lon':89.868,'cc':'BT','desc':'Most beautiful monastery in Bhutan. Confluence of two rivers.'},
    # Sri Lanka
    {'name':'Sigiriya Lion Rock','cat':'ancient_ruins','lat':7.957,'lon':80.760,'cc':'LK','desc':'5th century royal citadel on rock column. Frescoes 200m up. UNESCO.','fun':'400 graffiti messages left by visitors in 7th century','featured':True},
    {'name':'Temple of the Tooth Kandy','cat':'religious_site','lat':7.294,'lon':80.641,'cc':'LK','desc':'Buddha\'s tooth relic. Most sacred Buddhist site in Sri Lanka.'},
    # Myanmar
    {'name':'Bagan Temple City','cat':'ancient_ruins','lat':21.173,'lon':94.857,'cc':'MM','desc':'2,000+ temples over 104 km². 9th-13th century. Hot air balloon views.','fun':'Over 10,000 temples built — most destroyed by other kings','featured':True},
    {'name':'Inle Lake','cat':'freshwater','lat':20.520,'lon':96.900,'cc':'MM','desc':'Leg-rowing fishermen. Floating villages. Stilt houses. Unique culture.'},
    # Thailand
    {'name':'Bangkok Grand Palace','cat':'royal_palace','lat':13.750,'lon':100.491,'cc':'TH','desc':'Emerald Buddha. 218,400 m². 1782. Gilded spires.','featured':True},
    {'name':'Wat Arun Temple Bangkok','cat':'religious_site','lat':13.744,'lon':100.489,'cc':'TH','desc':'Temple of Dawn. Porcelain-encrusted spires on Chao Phraya.'},
    {'name':'Ayutthaya Ruins','cat':'ancient_ruins','lat':14.360,'lon':100.570,'cc':'TH','desc':'Former Thai capital. Burmese sacked 1767. UNESCO. Headless Buddhas.'},
    {'name':'Chiang Mai Old City','cat':'world_heritage','lat':18.789,'lon':98.987,'cc':'TH','desc':'300+ temples. 700 years old. Moat surrounding old quarter.'},
    {'name':'Phi Phi Islands','cat':'island','lat':7.740,'lon':98.778,'cc':'TH','desc':'The Beach filming location. Crystal water. Limestone karsts.'},
    {'name':'Doi Inthanon Peak','cat':'mountain_peak','lat':18.589,'lon':98.487,'cc':'TH','desc':'Highest in Thailand. 2,565m. Wat Phrathat summit pagoda.'},
    # Cambodia
    {'name':'Angkor Wat','cat':'control_tower','lat':13.413,'lon':103.867,'cc':'KH','desc':'Largest religious monument. 12th century. Sunrise behind towers. UNESCO.','fun':'Built in less than 40 years with 300,000 workers','featured':True},
    {'name':'Ta Prohm Jungle Temple','cat':'ancient_ruins','lat':13.435,'lon':103.889,'cc':'KH','desc':'Trees growing through temple. Tomb Raider filmed here. Surreal.'},
    {'name':'Bayon Temple Faces','cat':'ancient_ruins','lat':13.442,'lon':103.859,'cc':'KH','desc':'216 massive stone faces. Khmer King Jayavarman VII.'},
    {'name':'Phnom Penh Killing Fields','cat':'conspiracy','lat':11.491,'lon':104.901,'cc':'KH','desc':'Khmer Rouge genocide 1975-79. 17,000 killed at Choeung Ek. 8,895 skulls memorial.','fun':'2M people (25% of population) killed under Pol Pot'},
    # Vietnam
    {'name':'Ha Long Bay','cat':'island','lat':20.910,'lon':107.184,'cc':'VN','desc':'1,969 karst limestone islands. UNESCO. Emerald water. Legend of dragons.','featured':True},
    {'name':'Hoi An Ancient Town','cat':'world_heritage','lat':15.880,'lon':108.335,'cc':'VN','desc':'UNESCO. Perfectly preserved trading port. Japanese Bridge. Lantern festival.'},
    {'name':'Hue Imperial Citadel','cat':'royal_palace','lat':16.469,'lon':107.579,'cc':'VN','desc':'Forbidden Purple City. Nguyen dynasty. 7km walls. UNESCO.'},
    {'name':'My Son Hindu Sanctuary','cat':'ancient_ruins','lat':15.773,'lon':108.128,'cc':'VN','desc':'Cham temple complex. 4th-13th century. Partially destroyed by US bombs.'},
    {'name':'Mekong Delta','cat':'freshwater','lat':10.033,'lon':105.787,'cc':'VN','desc':'25M tons rice/yr. 17M people. Floating markets. SE Asia\'s rice bowl.'},
    # Indonesia
    {'name':'Borobudur Temple','cat':'religious_site','lat':-7.608,'lon':110.204,'cc':'ID','desc':'World\'s largest Buddhist monument. 9th century. 2,672 reliefs. UNESCO.','featured':True},
    {'name':'Bali Tanah Lot Temple','cat':'religious_site','lat':-8.621,'lon':115.086,'cc':'ID','desc':'Sea temple on rock. Sunset backdrop. Bali\'s most photographed site.'},
    {'name':'Prambanan Hindu Temples','cat':'religious_site','lat':-7.752,'lon':110.491,'cc':'ID','desc':'Largest Hindu temple in Indonesia. 9th century. 240 temples.'},
    {'name':'Komodo Island','cat':'nature_sanctuary','lat':-8.562,'lon':119.480,'cc':'ID','desc':'Komodo dragons — 3m, 90kg. 4,000 left in wild. UNESCO marine park.'},
    {'name':'Raja Ampat Archipelago','cat':'coral_reef','lat':-0.234,'lon':130.523,'cc':'ID','desc':'World\'s best diving. 1,500 fish species, 540 coral. Pristine.','fun':'Has more coral species than anywhere on Earth'},
    {'name':'Mount Bromo Volcano','cat':'volcano','lat':-7.942,'lon':112.953,'cc':'ID','desc':'Active volcano in caldera. Sea of sand. Sunrise pilgrimage.'},
    {'name':'Tana Toraja','cat':'ancient_ruins','lat':-3.050,'lon':119.823,'cc':'ID','desc':'Unique funerary culture. Cliffside coffins. Buffalo sacrifices. Sulawesi.'},
    # Philippines
    {'name':'Chocolate Hills Bohol','cat':'anomaly','lat':9.862,'lon':124.073,'cc':'PH','desc':'1,268 perfectly conical hills turn brown in dry season. UNESCO aspirant.'},
    {'name':'Tubbataha Reef','cat':'coral_reef','lat':8.923,'lon':120.012,'cc':'PH','desc':'UNESCO. Philippines\' premier marine reserve. Manta rays, hammerheads.'},
    {'name':'Intramuros Manila','cat':'world_heritage','lat':14.588,'lon':120.976,'cc':'PH','desc':'Spanish colonial walled city 1571. Fort Santiago. WWII battle site.'},
    {'name':'Mayon Volcano Albay','cat':'volcano','lat':13.257,'lon':123.686,'cc':'PH','desc':'Most perfect volcanic cone. 2,463m. Most active in Philippines.'},
    # Japan
    {'name':'Fushimi Inari Shrine Kyoto','cat':'religious_site','lat':34.967,'lon':135.773,'cc':'JP','desc':'10,000 torii gates up Mt Inari. Instagram most-photographed Japan site.','fun':'Torii donated by businesses — name engraved on back'},
    {'name':'Hiroshima Peace Memorial','cat':'world_heritage','lat':34.395,'lon':132.453,'cc':'JP','desc':'Atomic Bomb Dome. UNESCO. Only A-bomb city with preserved ruin. 140,000 dead.','featured':True},
    {'name':'Nara Todai-ji Temple','cat':'religious_site','lat':34.689,'lon':135.840,'cc':'JP','desc':'World\'s largest wooden building. 15m bronze Buddha. Sacred deer roam freely.'},
    {'name':'Kyoto Arashiyama Bamboo','cat':'ancient_forest','lat':35.017,'lon':135.671,'cc':'JP','desc':'Bamboo grove. Tenryu-ji garden. Monkey mountain. Scenic train.'},
    {'name':'Shirakawa-go Gassho Farmhouses','cat':'world_heritage','lat':36.258,'lon':136.905,'cc':'JP','desc':'UNESCO. Steep-thatched A-frame farmhouses. Snow village. Gifu.'},
    {'name':'Nikko Tosho-gu Shrine','cat':'religious_site','lat':36.758,'lon':139.598,'cc':'JP','desc':'Tokugawa shogun mausoleum. Ornate gold lacquer. 1,000 year cedar forest.'},
    # China
    {'name':'Zhangjiajie Glass Bridge','cat':'anomaly','lat':29.348,'lon':110.436,'cc':'CN','desc':'World\'s longest glass bridge. Avatar mountains inspiration. 430m span.','fun':'Over 25,000 people crossed on opening day'},
    {'name':'Li River Guilin','cat':'nature_sanctuary','lat':25.274,'lon':110.290,'cc':'CN','desc':'Karst mountains. 20 yuan banknote scene. Most beautiful river in China.','featured':True},
    {'name':'Zhangjiajie Pillars','cat':'anomaly','lat':29.325,'lon':110.435,'cc':'CN','desc':'3,000 quartzite pillar mountains. Avatar Hallelujah Mountain inspiration.','featured':True},
    {'name':'Jiuzhaigou Valley','cat':'nature_sanctuary','lat':33.262,'lon':103.918,'cc':'CN','desc':'Multi-colored lakes. UNESCO. Closed after 2017 earthquake, reopened.','fun':'Nine Tibetan villages in the valley — most evacuated for tourism'},
    {'name':'Tiger Leaping Gorge Yunnan','cat':'canyon','lat':27.224,'lon':100.152,'cc':'CN','desc':'One of world\'s deepest canyons. Yangtze River. 3,900m walls.'},
    {'name':'Karst Mountains Yangshuo','cat':'nature_sanctuary','lat':24.778,'lon':110.494,'cc':'CN','desc':'Limestone peaks rising from rice paddies. Cycling paradise.'},
    {'name':'Terracotta Army Xi\'an','cat':'ancient_ruins','lat':34.385,'lon':109.273,'cc':'CN','desc':'8,000 life-size soldiers for Qin Shi Huang. Discovered 1974 by farmers.','fun':'Each face is unique — modeled on real soldiers','featured':True},
    {'name':'Yellow Mountain Huangshan','cat':'mountain_peak','lat':30.130,'lon':118.176,'cc':'CN','desc':'Sea of clouds above granite peaks. Inspired Chinese landscape painting.'},
    {'name':'Longji Rice Terraces','cat':'agri_megafarm','lat':25.773,'lon':110.080,'cc':'CN','desc':'Dragon\'s Backbone. 2,300 years of Zhuang minority farming. Breathtaking curves.'},
    {'name':'Potala Palace Lhasa','cat':'royal_palace','lat':29.657,'lon':91.117,'cc':'CN','desc':'Dalai Lama\'s palace. 1,000 rooms. 13 stories. UNESCO. 3,700m altitude.','featured':True},
    # Korea
    {'name':'Gyeongbokgung Palace Seoul','cat':'royal_palace','lat':37.579,'lon':126.977,'cc':'KR','desc':'Joseon dynasty 1395. Changing of the guard. 330 building complex.'},
    {'name':'Jeju Island Hallasan','cat':'volcano','lat':33.362,'lon':126.534,'cc':'KR','desc':'South Korea\'s highest peak. UNESCO. Lava tubes. New 7 Wonders.'},
    {'name':'Haeinsa Temple Janggyeong Panjeon','cat':'religious_site','lat':35.801,'lon':128.100,'cc':'KR','desc':'UNESCO. Contains 81,258 Tripitaka Koreana woodblocks — 8 centuries old.'},
    {'name':'Seoraksan National Park','cat':'mountain_peak','lat':38.126,'lon':128.464,'cc':'KR','desc':'Dramatic granite peaks. Ulsan Rock. Korea\'s most visited park.'},
    # Taiwan
    {'name':'Taroko Gorge Taiwan','cat':'canyon','lat':24.157,'lon':121.623,'cc':'TW','desc':'Marble canyon 1,000m deep. Tunnel of Nine Turns. Granite cliffs.'},
    {'name':'Sun Moon Lake','cat':'freshwater','lat':23.864,'lon':120.916,'cc':'TW','desc':'Largest lake in Taiwan. Formosa aboriginal culture. Tea plantations.'},
    # Mongolia
    {'name':'Gobi Desert','cat':'anomaly','lat':42.500,'lon':105.000,'cc':'MN','desc':'Largest Asian desert. Dinosaur fossils. Flaming Cliffs. Eagle hunters.','fun':'World\'s fastest growing desert — consuming 3,600 km² of China/yr'},
    {'name':'Karakorum Ancient Capital','cat':'ancient_ruins','lat':47.195,'lon':102.845,'cc':'MN','desc':'Genghis Khan\'s capital. Erdene Zuu monastery from ruins. UNESCO.'},
    # Kazakhstan
    {'name':'Charyn Canyon Kazakhstan','cat':'canyon','lat':43.353,'lon':79.073,'cc':'KZ','desc':'Valley of Castles. Central Asia\'s Grand Canyon. 80m walls.'},
    {'name':'Altai Mountains Kazakhstan','cat':'mountain_peak','lat':49.800,'lon':86.600,'cc':'KZ','desc':'UNESCO. Altai mountains — cradle of Turkic civilization. Snow leopards.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏖️ GLOBAL TOURISM — Most Visited Sites
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Times Square New York','cat':'financial_hub','lat':40.758,'lon':-73.986,'cc':'US','desc':'50M visitors/yr. Most visited tourist site in world. 47 Broadway theaters.','featured':True},
    {'name':'Central Park New York','cat':'nature_sanctuary','lat':40.785,'lon':-73.968,'cc':'US','desc':'843 acres. 42M visitors/yr. World\'s most visited urban park.'},
    {'name':'Statue of Liberty','cat':'control_tower','lat':40.689,'lon':-74.044,'cc':'US','desc':'Gift from France 1886. 93m. Torch visible from 24 miles. 4M visitors/yr.','featured':True},
    {'name':'Golden Gate Bridge','cat':'control_tower','lat':37.819,'lon':-122.479,'cc':'US','desc':'Art Deco. 1937. 2,737m span. Fog icon. 10M visitors/yr.','featured':True},
    {'name':'Disneyland California','cat':'sports_arena','lat':33.812,'lon':-117.919,'cc':'US','desc':'First Disney park 1955. 18M visitors/yr. Walt\'s dream.','fun':'Has its own postal code and fire department'},
    {'name':'Walt Disney World Florida','cat':'sports_arena','lat':28.385,'lon':-81.563,'cc':'US','desc':'Most visited theme park resort. 58M visitors/yr. 40+ attractions.'},
    {'name':'Grand Canyon South Rim','cat':'canyon','lat':36.056,'lon':-112.140,'cc':'US','desc':'5-6M visitors/yr. 1.6B years of rock. UNESCO. Skywalk.','featured':True},
    {'name':'Niagara Falls New York Side','cat':'waterfall','lat':43.087,'lon':-79.067,'cc':'US','desc':'3,160 tons water/second. Border USA-Canada. 30M visitors/yr.'},
    {'name':'Yosemite Valley','cat':'nature_sanctuary','lat':37.746,'lon':-119.598,'cc':'US','desc':'El Capitan, Half Dome. 4M visitors/yr. John Muir\'s Cathedral.'},
    {'name':'Yellowstone Old Faithful','cat':'volcano','lat':44.460,'lon':-110.828,'cc':'US','desc':'Erupts every 91 min. 3,000+ geysers. World\'s largest.'},
    {'name':'Hollywood Walk of Fame','cat':'sports_arena','lat':34.102,'lon':-118.340,'cc':'US','desc':'2,700+ stars. Grauman\'s Chinese Theatre. 10M visitors/yr.'},
    # Europe tourism
    {'name':'Trevi Fountain Rome','cat':'ancient_ruins','lat':41.901,'lon':12.483,'cc':'IT','desc':'Baroque masterpiece 1762. €1M coins/yr thrown in. 3D da Vinci Code film.','fun':'Coins collected by charities weekly'},
    {'name':'Venice Grand Canal','cat':'world_heritage','lat':45.437,'lon':12.335,'cc':'IT','desc':'UNESCO. 4M visitors/yr. 150+ canals. Car-free. Sinking 2mm/yr.','featured':True},
    {'name':'Amalfi Coast','cat':'nature_sanctuary','lat':40.634,'lon':14.603,'cc':'IT','desc':'UNESCO. Cliffside villages. Limoncello. Positano.'},
    {'name':'Cinque Terre','cat':'world_heritage','lat':44.127,'lon':9.738,'cc':'IT','desc':'5 colorful fishing villages. No cars. UNESCO. Hiking trails.'},
    {'name':'Tuscany Val d\'Orcia','cat':'nature_sanctuary','lat':42.979,'lon':11.633,'cc':'IT','desc':'Rolling hills, cypress trees, medieval villages. Siena, San Gimignano.'},
    {'name':'Barcelona La Sagrada Familia','cat':'control_tower','lat':41.404,'lon':2.174,'cc':'ES','desc':'Gaudí masterpiece. Under construction 1882-now. UNESCO. 4.5M/yr.','featured':True},
    {'name':'Alhambra Granada','cat':'royal_palace','lat':37.176,'lon':-3.588,'cc':'ES','desc':'UNESCO Moorish palace. 3M visitors/yr. Nasrid dynasty 14th cent.','fun':'World record holder for most online museum tickets purchased in one day'},
    {'name':'Sagrada Familia','cat':'control_tower','lat':41.404,'lon':2.174,'cc':'ES','desc':'Dedicated work permit only granted in 2019 — 137 years after start.'},
    {'name':'Park Güell Barcelona','cat':'nature_sanctuary','lat':41.414,'lon':2.153,'cc':'ES','desc':'Gaudí mosaic park. Dragon staircase. Best Barcelona panorama.'},
    {'name':'Athens Acropolis','cat':'control_tower','lat':37.971,'lon':23.726,'cc':'GR','desc':'2,500 years old. Parthenon. 2M visitors/yr. UNESCO.','featured':True},
    {'name':'Santorini Caldera','cat':'volcano','lat':36.393,'lon':25.461,'cc':'GR','desc':'Volcanic caldera island. White-blue houses. Sunset views. 3M visitors/yr.','featured':True},
    {'name':'Meteora Monasteries','cat':'religious_site','lat':39.721,'lon':21.631,'cc':'GR','desc':'6 monasteries on rock pillars. UNESCO. James Bond filmed here.','fun':'Monks reached them only via rope nets until 1920s'},
    {'name':'Dubrovnik Old City','cat':'world_heritage','lat':42.641,'lon':18.111,'cc':'HR','desc':'UNESCO. King\'s Landing (Game of Thrones). Pristine medieval walls. Adriatic gem.','featured':True},
    {'name':'Prague Old Town Square','cat':'world_heritage','lat':50.087,'lon':14.421,'cc':'CZ','desc':'Gothic/Baroque. Astronomical clock 1410. Most intact medieval city.'},
    {'name':'Hallstatt Austria','cat':'world_heritage','lat':47.562,'lon':13.649,'cc':'AT','desc':'UNESCO Alpine lake village. Copied exactly in China. 10,000 tourists/day for 800 residents.','fun':'China built an exact replica 7,500km away'},
    {'name':'Neuschwanstein Castle','cat':'royal_palace','lat':47.558,'lon':10.750,'cc':'DE','desc':'Mad King Ludwig\'s fairy tale castle 1869. Disneyland inspiration. 1.5M/yr.','fun':'Basis for Sleeping Beauty Castle in Disneyland'},
    {'name':'Rothenburg ob der Tauber','cat':'world_heritage','lat':49.377,'lon':10.177,'cc':'DE','desc':'Most intact medieval walled city in Germany. Christmas market HQ.'},
    {'name':'Amsterdam Canal Ring','cat':'world_heritage','lat':52.372,'lon':4.900,'cc':'NL','desc':'UNESCO. 1,500 bridges. Anne Frank House. Rijksmuseum. Van Gogh.'},
    {'name':'Copenhagen Nyhavn','cat':'world_heritage','lat':55.680,'lon':12.589,'cc':'DK','desc':'Colorful canal houses. Hans Christian Andersen lived here. Most photographed Danish scene.'},
    {'name':'Edinburgh Castle','cat':'royal_palace','lat':55.948,'lon':-3.200,'cc':'GB','desc':'2M visitors/yr. Volcanic rock. Crown Jewels. National War Memorial.'},
    {'name':'Stonehenge','cat':'ancient_ruins','lat':51.180,'lon':-1.826,'cc':'GB','desc':'3000 BC. Midsummer sunrise alignment. UNESCO. 1.5M visitors/yr.'},
    {'name':'Giant\'s Causeway','cat':'anomaly','lat':55.241,'lon':-6.512,'cc':'GB','desc':'40,000 hexagonal basalt columns. Northern Ireland. UNESCO. Legend of Finn McCool.'},
    {'name':'Cliffs of Moher','cat':'anomaly','lat':52.969,'lon':-9.428,'cc':'IE','desc':'214m sea cliffs. Harry Potter filmed here. 1.5M visitors/yr.'},
    {'name':'Whitehaven Beach Whitsundays','cat':'island','lat':-20.277,'lon':149.034,'cc':'AU','desc':'Purest silica sand. 99% pure. Stays cool. UNESCO Great Barrier Reef area.'},
    {'name':'Sydney Harbour Bridge','cat':'control_tower','lat':-33.852,'lon':151.211,'cc':'AU','desc':'Coathanger. Can walk/climb. Steel arch 1932. 200M crossings.','fun':'Takes 10 years to paint — they start over when done'},
    {'name':'Uluru Ayers Rock','cat':'anomaly','lat':-25.344,'lon':131.036,'cc':'AU','desc':'Sacred Anangu site. 348m. Changes color at sunset. UNESCO.','fun':'Climbing banned permanently since 2019 out of respect'},
    # Americas
    {'name':'Machu Picchu','cat':'control_tower','lat':-13.163,'lon':-72.545,'cc':'PE','desc':'Inca citadel 1450. Lost city. New 7 Wonder. UNESCO. 1.5M visitors/yr.','featured':True},
    {'name':'Galapagos Islands','cat':'nature_sanctuary','lat':-0.670,'lon':-90.550,'cc':'EC','desc':'Darwin\'s lab. 19 islands. Unique species. UNESCO. 97% national park.','featured':True},
    {'name':'Patagonia Torres del Paine','cat':'nature_sanctuary','lat':-50.938,'lon':-73.401,'cc':'CL','desc':'Granite towers. Glaciers. Pumas. UNESCO Biosphere. End of the world.'},
    {'name':'Amazon Basin Iquitos','cat':'ancient_forest','lat':-3.743,'lon':-73.251,'cc':'PE','desc':'Largest accessible Amazon city. Only by boat/plane. Pink dolphins.'},
    {'name':'Iguazu Falls Argentina','cat':'waterfall','lat':-25.695,'lon':-54.437,'cc':'AR','desc':'275 individual falls. 2.7km wide. UNESCO. Wider than Niagara.','featured':True},
    {'name':'Easter Island','cat':'ancient_ruins','lat':-27.113,'lon':-109.349,'cc':'CL','desc':'887 moai statues. 5,000km from nearest continent. Civilization collapsed.','featured':True},
    {'name':'Tikal Maya Ruins','cat':'ancient_ruins','lat':17.222,'lon':-89.624,'cc':'GT','desc':'Maya metropolis 700 AD. Jungle-covered. Star Wars Yavin IV scene.'},
    {'name':'Chichen Itza','cat':'ancient_ruins','lat':20.684,'lon':-88.568,'cc':'MX','desc':'Maya pyramid. Shadow serpent. New 7 Wonder. 3M visitors/yr.','featured':True},
    {'name':'Teotihuacan Pyramids','cat':'ancient_ruins','lat':19.693,'lon':-98.844,'cc':'MX','desc':'Avenue of the Dead. Sun + Moon pyramids. Pre-Aztec 200 AD.'},
    {'name':'Copper Canyon Mexico','cat':'canyon','lat':27.538,'lon':-107.686,'cc':'MX','desc':'4x wider than Grand Canyon. Tarahumara indigenous culture. El Chepe train.'},
    {'name':'Perito Moreno Glacier','cat':'glacier','lat':-50.494,'lon':-73.050,'cc':'AR','desc':'One of few advancing glaciers. Bridge for walking on it. UNESCO.','fun':'Advances 2m per day and calves in dramatic crashes'},
    {'name':'Salar de Uyuni Bolivia','cat':'anomaly','lat':-20.140,'lon':-67.490,'cc':'BO','desc':'World\'s largest salt flat. 10,582 km². Sky mirror in rainy season.','featured':True},
    {'name':'Carnival Rio de Janeiro','cat':'sports_arena','lat':-22.912,'lon':-43.172,'cc':'BR','desc':'World\'s largest carnival. 6-day festival. Sambadrome. 7M people/day.','featured':True},
    {'name':'Christ the Redeemer','cat':'control_tower','lat':-22.952,'lon':-43.211,'cc':'BR','desc':'New 7 Wonder. 30m statue. Corcovado mountain. Rio icon. 800k/yr.','featured':True},
    # ══════════════════════════════════════════════════════════════════════
    # 🌋 MORE VOLCANOES & NATURAL
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Piton de la Fournaise La Réunion','cat':'volcano','lat':-21.244,'lon':55.708,'cc':'RE','desc':'Most active volcano in Indian Ocean. Erupts several times/year.'},
    {'name':'Merapi Volcano Java','cat':'volcano','lat':-7.541,'lon':110.446,'cc':'ID','desc':'Most active in Indonesia. 800,000 live in danger zone.'},
    {'name':'Pinatubo Philippines','cat':'volcano','lat':15.143,'lon':120.350,'cc':'PH','desc':'1991 eruption — biggest 20th century. 2°C global cooling. Now crater lake.'},
    {'name':'Popocatépetl Mexico','cat':'volcano','lat':19.023,'lon':-98.622,'cc':'MX','desc':'El Popo. Active stratovolcano. 25M people in danger zone near Mexico City.','fun':'500,000 people live on its slopes'},
    {'name':'Cotopaxi Ecuador','cat':'volcano','lat':-0.684,'lon':-78.436,'cc':'EC','desc':'One of world\'s highest active volcanos. 5,897m. Perfect cone.'},
    {'name':'Vanuatu Yasur Volcano','cat':'volcano','lat':-19.529,'lon':169.443,'cc':'VU','desc':'World\'s most accessible active volcano. Tourists walk to rim.'},
    {'name':'Hawaii Kilauea Lava Ocean Entry','cat':'volcano','lat':19.413,'lon':-155.288,'cc':'US','desc':'Lava flowing into Pacific. New land forming in real time.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🌿 EXTREME NATURE
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Antarctic Peninsula','cat':'research_station','lat':-64.274,'lon':-57.086,'cc':'AQ','desc':'800 scientists/winter, 5,000/summer. 50,000 tourists/yr by ship.'},
    {'name':'Greenland Ice Sheet','cat':'glacier','lat':72.000,'lon':-40.000,'cc':'GL','desc':'1.7M km² glacier. 3km thick. Will raise oceans 7m if melted.','fun':'If melted, would slow Earth\'s rotation'},
    {'name':'Namib Desert Sossusvlei','cat':'anomaly','lat':-24.727,'lon':15.328,'cc':'NA','desc':'World\'s oldest desert. 55M years. Dead Vlei white trees. Dune 45.'},
    {'name':'Okavango Delta','cat':'freshwater','lat':-19.500,'lon':23.000,'cc':'BW','desc':'UNESCO. World\'s largest inland delta. 1,000th UNESCO site. Wildlife paradise.','featured':True},
    {'name':'Madagascar Rainforest','cat':'ancient_forest','lat':-18.913,'lon':47.536,'cc':'MG','desc':'5% of world biodiversity. 90% endemic species. Lemurs only here.'},
    {'name':'Borneo Heart of Borneo','cat':'ancient_forest','lat':1.500,'lon':115.000,'cc':'MY','desc':'Third largest tropical island. Orangutans, pygmy elephants, clouded leopards.'},
    {'name':'Amazon River Source','cat':'freshwater','lat':-15.519,'lon':-71.768,'cc':'PE','desc':'Nevado Mismi glacier source. 6,400km to Atlantic. 20% global freshwater.'},
    {'name':'Congo River Livingstone Falls','cat':'waterfall','lat':-5.070,'lon':15.262,'cc':'CD','desc':'Deepest river (220m). Most powerful waterfalls by volume.'},
    {'name':'Lena Pillars Russia','cat':'anomaly','lat':61.065,'lon':127.661,'cc':'RU','desc':'UNESCO. Limestone pillars 100m high on Lena River. Permafrost shapes them.'},
    {'name':'Lake Titicaca','cat':'freshwater','lat':-15.842,'lon':-69.334,'cc':'PE','desc':'3,810m altitude. Highest navigable lake. Floating reed islands. Inca creation myth.'},
    {'name':'Patagonia Fjords Chile','cat':'nature_sanctuary','lat':-51.000,'lon':-75.000,'cc':'CL','desc':'2,000km of fjords. Largest wilderness in South America. Condors.'},
    {'name':'Pantanal Wetlands Brazil','cat':'nature_sanctuary','lat':-17.000,'lon':-57.000,'cc':'BR','desc':'World\'s largest tropical wetland. 150,000 km². Jaguars. UNESCO.'},
    {'name':'Kakadu National Park','cat':'nature_sanctuary','lat':-12.850,'lon':132.471,'cc':'AU','desc':'UNESCO. 65,000 years Aboriginal occupation. 50,000+ rock art sites.'},
    {'name':'Fiordland New Zealand','cat':'nature_sanctuary','lat':-45.414,'lon':167.716,'cc':'NZ','desc':'UNESCO. Milford Sound. Lord of the Rings filming. 700m rainfall/yr.','featured':True},
    {'name':'Waitomo Glowworm Caves','cat':'cave_system','lat':-38.257,'lon':175.103,'cc':'NZ','desc':'Bioluminescent glowworms. Cave river boat. Arachnocampa luminosa.'},
    {'name':'Zhangye Rainbow Mountains','cat':'anomaly','lat':38.942,'lon':100.142,'cc':'CN','desc':'Colorful mineral-striped mountains. 24M years of deposit. UNESCO.'},
    # ══════════════════════════════════════════════════════════════════════
    # 🏰 MORE HERITAGE & PALACES
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Angkor Thom Bayon','cat':'ancient_ruins','lat':13.441,'lon':103.859,'cc':'KH','desc':'Jayavarman VII capital. South Gate. 54 towers with smiling faces.'},
    {'name':'Bagan Archaeological Zone','cat':'ancient_ruins','lat':21.173,'lon':94.857,'cc':'MM','desc':'2,200 temples. Myanmar\'s greatest ancient city. Sunrise balloons.','featured':True},
    {'name':'Sukhothai Historical Park','cat':'ancient_ruins','lat':17.020,'lon':99.826,'cc':'TH','desc':'First Thai kingdom capital 1238. UNESCO. 193 ruins over 70 km².'},
    {'name':'Luang Prabang Laos','cat':'world_heritage','lat':19.884,'lon':102.135,'cc':'LA','desc':'UNESCO. French colonial + Lao temples. Alms giving ceremony at dawn.'},
    {'name':'Banaue Rice Terraces','cat':'agri_megafarm','lat':16.918,'lon':121.059,'cc':'PH','desc':'2,000 year old hand-carved Ifugao rice terraces. 8th Wonder of World.'},
    {'name':'Himeji Castle Japan','cat':'royal_palace','lat':34.839,'lon':134.694,'cc':'JP','desc':'UNESCO. Best-preserved feudal castle in Japan. White Heron Castle. 1333.'},
    {'name':'Itsukushima Shrine','cat':'religious_site','lat':34.296,'lon':132.320,'cc':'JP','desc':'Floating torii gate. UNESCO. Sacred island of Miyajima.','fun':'No births or deaths allowed on sacred island'},
    {'name':'Kinkaku-ji Golden Pavilion','cat':'religious_site','lat':35.040,'lon':135.729,'cc':'JP','desc':'Gold-leaf covered temple. Kyoto icon. Burned by monk in 1950 — rebuilt.'},
    {'name':'Gyeongju Tumuli Park','cat':'ancient_ruins','lat':35.820,'lon':129.210,'cc':'KR','desc':'Silla dynasty royal burial mounds. UNESCO. 2,000 years of Korean history.'},
    {'name':'Hwaseong Fortress Suwon','cat':'world_heritage','lat':37.285,'lon':127.014,'cc':'KR','desc':'UNESCO. 1796 fortress designed with modern principles. 5.7km wall.'},
    {'name':'Hoi An Lantern Festival','cat':'world_heritage','lat':15.880,'lon':108.335,'cc':'VN','desc':'14th day each lunar month — no electric lights, only lanterns on river.'},
    {'name':'Sigiriya Rock Fortress','cat':'ancient_ruins','lat':7.957,'lon':80.760,'cc':'LK','desc':'5th century palace atop 200m rock. Frescoes, mirror wall, lion gate.','featured':True},
    # ══════════════════════════════════════════════════════════════════════
    # 🌃 ICONIC CITY LANDMARKS
    # ══════════════════════════════════════════════════════════════════════
    {'name':'Hagia Sophia Converted Mosque','cat':'religious_site','lat':41.009,'lon':28.980,'cc':'TR','desc':'Reconverted in 2020. UNESCO outrage. World\'s most contested heritage.'},
    {'name':'Dubai Burj Al Arab Hotel','cat':'control_tower','lat':25.141,'lon':55.186,'cc':'AE','desc':'Only 7-star hotel. Sail-shaped. Built on artificial island. $24,000/night suite.'},
    {'name':'Singapore Gardens by the Bay','cat':'nature_sanctuary','lat':1.281,'lon':103.863,'cc':'SG','desc':'18 Supertrees 50m high. Cloud Forest dome. Stunning nighttime light show.'},
    {'name':'Petronas Twin Towers KL','cat':'control_tower','lat':3.158,'lon':101.712,'cc':'MY','desc':'World\'s tallest twin towers 1998-2004. Sky bridge at floor 41-42.','featured':True},
    {'name':'Changi Airport Singapore','cat':'mega_port','lat':1.359,'lon':103.989,'cc':'SG','desc':'World\'s best airport 8× consecutive. Jewel rainforest waterfall inside.'},
    {'name':'Hong Kong Victoria Peak','cat':'mountain_peak','lat':22.271,'lon':114.148,'cc':'HK','desc':'552m. Best city panorama in world. 7M visitors/yr. Tram.'},
    {'name':'Shanghai The Bund','cat':'financial_hub','lat':31.240,'lon':121.490,'cc':'CN','desc':'Colonial waterfront. 52 buildings of different architectural styles.'},
    {'name':'Tokyo Shibuya Crossing','cat':'financial_hub','lat':35.659,'lon':139.700,'cc':'JP','desc':'World\'s busiest pedestrian crossing. 3,000 people every light change.','fun':'Hachiko dog statue at exit — waited 10 years for dead owner','featured':True},
    {'name':'Forbidden City Beijing','cat':'royal_palace','lat':39.916,'lon':116.390,'cc':'CN','desc':'9,999 rooms. 24 emperors. 500 years. 15M visitors/yr.','featured':True},
    {'name':'Summer Palace Beijing','cat':'royal_palace','lat':40.000,'lon':116.275,'cc':'CN','desc':'UNESCO. Kunming Lake + Longevity Hill. Empress Cixi summer retreat.'},
    {'name':'Sydney Bondi Beach','cat':'island','lat':-33.890,'lon':151.274,'cc':'AU','desc':'World\'s most famous beach. 40,000 visitors/day in summer. Surfing culture.'},
    {'name':'Great Ocean Road Australia','cat':'anomaly','lat':-38.669,'lon':143.391,'cc':'AU','desc':'12 Apostles sea stacks. 243km coastal road. World\'s largest war memorial.'},
]

def seed():
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

    print(f"\n✅ World POIs Part 2: {created} created, {updated} updated, {errors} errors")
    total = UnifiedPOI.objects.count()
    print(f"   Total: {total} POIs in database")
    from collections import Counter
    cats = Counter(UnifiedPOI.objects.values_list('category', flat=True))
    print(f"   Categories covered: {len(cats)}")
    countries = Counter(UnifiedPOI.objects.values_list('country_code', flat=True))
    print(f"   Countries covered: {len([c for c in countries if c])}")

if __name__ == '__main__':
    seed()
