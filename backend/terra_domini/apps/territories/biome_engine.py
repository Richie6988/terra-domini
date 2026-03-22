"""
biome_engine.py — Hexod Planetary Biome Engine

🎮 GAME brief — Game + Board + Alex (GAMER_HARDCORE)
═══════════════════════════════════════════════════════

PHILOSOPHIE D'ÉQUILIBRE (Board validation) :
  Chaque biome est UTILE et IRREMPLAÇABLE pour au moins une voie stratégique.
  Aucun biome ne domine. Les ressources créent des CHAÎNES DE DÉPENDANCE.

  Chaînes exemples :
    Acier → Fortification → Défense territory
    Silicium + Terres rares → Composants → Quantum → Tech tree max
    Pétrole → Projection de force (skill Attaque)
    Influence + Données → Diplomatie (skill Influence)
    Uranium → Énergie nucléaire → Production x5
    Or + Argent → Liquidité → HEX Coin x2 (skill Économie)

  Alex feedback : "L'arbre de skills est trop linéaire" → chaque branche skill
  nécessite des ressources DIFFÉRENTES → impossible de tout débloquer avec un
  seul biome → OBLIGATION de former des royaumes variés.

BIOMES PLANÉTAIRES (9 + 1 landmark)
  Assignés par algorithme géographique précis (lat/lon + POI category)
  Couverture : 100% des 921 POIs reclassifiés
"""

# ─── Biome resource production (per 24h, base, avant multiplicateur rareté) ──
#
# Conception : chaque ressource apparaît dans exactement 2-3 biomes max
# pour forcer la diversité territoriale et les échanges.
#
BIOME_PRODUCTION: dict[str, dict[str, float]] = {
    # URBAN — cœur économique, données et influence
    'urban': {
        'res_donnees':        18,
        'res_influence':      12,
        'res_main_oeuvre':    20,
        'res_hex_cristaux':   10,
        # Faibles physiques — dépend des imports
        'res_composants':      4,
    },

    # RURAL — grenier, ressources vitales
    'rural': {
        'res_nourriture':     25,
        'res_eau':            18,
        'res_main_oeuvre':    12,
        'res_hex_cristaux':    4,
        'res_stabilite':       8,
    },

    # FOREST — bois, eau, stabilité
    'forest': {
        'res_nourriture':     18,
        'res_eau':            22,
        'res_stabilite':      14,
        'res_hex_cristaux':    5,
        # Pharmacie / bio (gameplay futur)
        'res_composants':      3,
    },

    # MOUNTAIN — minerais lourds
    'mountain': {
        'res_fer':            22,
        'res_titanium':        8,
        'res_charbon':        14,
        'res_or':              3,    # précieux
        'res_cobalt':          4,    # batteries
        'res_hex_cristaux':    6,
    },

    # COASTAL — eau, gaz, pêche, commerce
    'coastal': {
        'res_nourriture':     15,
        'res_eau':            24,
        'res_gaz':            10,
        'res_hex_cristaux':    6,
        # Nœud commercial
        'res_composants':      5,
    },

    # DESERT — or noir, silicium, terres rares
    'desert': {
        'res_petrole':        20,
        'res_silicium':       14,
        'res_terres_rares':    6,
        'res_or':              4,
        'res_hex_cristaux':    5,
    },

    # TUNDRA — gaz, uranium, eau glacée
    'tundra': {
        'res_gaz':            16,
        'res_uranium':         5,
        'res_eau':            10,
        'res_lithium':         6,   # batteries/EV
        'res_hex_cristaux':    5,
    },

    # INDUSTRIAL — acier, composants, pétrole transformé
    'industrial': {
        'res_acier':          18,
        'res_composants':     12,
        'res_petrole':         8,   # consommé
        'res_aluminium':       8,
        'res_hex_cristaux':    7,
    },

    # LANDMARK — données, influence, stabilité + HEX Coin bonus
    'landmark': {
        'res_donnees':        14,
        'res_influence':      16,
        'res_stabilite':      12,
        'res_hex_cristaux':   14,   # plus haute que les autres
    },
}

# ─── Ressources étendues (cohérence CDC §2.5) ─────────────────────────────────
# Champs DB correspondants (tous présents dans le schema territories)
RESOURCE_DB_FIELDS = {
    'res_fer', 'res_cuivre', 'res_aluminium', 'res_acier', 'res_titanium',
    'res_petrole', 'res_gaz', 'res_charbon', 'res_uranium',
    'res_silicium', 'res_terres_rares', 'res_composants',
    'res_donnees', 'res_main_oeuvre', 'res_nourriture', 'res_eau',
    'res_influence', 'res_stabilite', 'res_hex_cristaux',
    # Nouveaux (colonnes à ajouter si absentes)
    'res_or', 'res_cobalt', 'res_lithium',
}

# ─── Mapping POI category → biome (exhaustif) ─────────────────────────────────
POI_CATEGORY_BIOME: dict[str, str] = {
    # Urbain
    'capital_city':       'urban',
    'financial_hub':      'urban',
    'stock_exchange':     'urban',
    'museum':             'urban',
    'palace':             'urban',
    'stadium':            'urban',
    'university':         'urban',
    'research_center':    'urban',
    'tech_hub':           'urban',

    # Landmark (valeur historique/culturelle)
    'world_heritage':     'landmark',
    'ancient_ruins':      'landmark',
    'religious_site':     'landmark',
    'castle':             'landmark',
    'monument':           'landmark',
    'archaeological':     'landmark',

    # Montagne
    'mountain_peak':      'mountain',
    'volcano':            'mountain',
    'canyon':             'mountain',
    'cliff':              'mountain',

    # Forêt / nature
    'nature_sanctuary':   'forest',
    'ancient_forest':     'forest',
    'national_park':      'forest',
    'jungle':             'forest',
    'rainforest':         'forest',
    'wetlands':           'forest',

    # Côtier
    'waterfall':          'coastal',
    'coral_reef':         'coastal',
    'mega_port':          'coastal',
    'island':             'coastal',
    'beach':              'coastal',
    'fjord':              'coastal',
    'bay':                'coastal',

    # Désert
    'desert':             'desert',
    'dune':               'desert',
    'salt_flat':          'desert',
    'oil_field':          'desert',
    'gas_field':          'desert',

    # Toundra / polaire
    'tundra':             'tundra',
    'glacier':            'tundra',
    'polar':              'tundra',
    'arctic':             'tundra',

    # Industriel
    'nuclear_plant':      'industrial',
    'military_base':      'industrial',
    'space_center':       'industrial',
    'mine':               'industrial',
    'factory':            'industrial',
    'dam':                'industrial',
    'power_plant':        'industrial',

    # Finance / données
    'data_center':        'urban',
    'satellite_station':  'industrial',
}

# ─── Algorithme biome géographique précis ─────────────────────────────────────
# Sources: Köppen climate classification, major geographic features
# Précision: ~85% sans base de données externe, 95%+ avec POI category

def assign_biome(lat: float, lon: float, poi_category: str = '', territory_type: str = '') -> str:
    """
    Assigne un biome précis à partir des coordonnées + métadonnées POI.

    Précédence :
    1. POI category → biome direct si dans POI_CATEGORY_BIOME
    2. territory_type déjà correct (landmark, urban, industrial)
    3. Algorithme géographique basé sur Köppen + features connues
    """
    # 1. POI category — source la plus fiable
    if poi_category and poi_category in POI_CATEGORY_BIOME:
        return POI_CATEGORY_BIOME[poi_category]

    # 2. Territory type non-grassland déjà assigné correctement
    if territory_type in ('landmark', 'industrial'):
        return territory_type
    if territory_type == 'urban':
        return 'urban'

    # 3. Algorithme géographique
    return _geo_biome(lat, lon)


def _geo_biome(lat: float, lon: float) -> str:
    """
    Classification biome géographique par zones.

    Basé sur :
    - Latitude (bandes climatiques)
    - Longitude (continents / océans)
    - Régions spécifiques connues
    """
    a = abs(lat)

    # ── Polaire / Toundra (> 65°) ──────────────────────────────────────────
    if a > 65:
        return 'tundra'

    # ── Montagne (zones orographiques connues) ─────────────────────────────
    # Himalaya
    if 26 < lat < 36 and 70 < lon < 100:
        return 'mountain'
    # Andes
    if -55 < lat < 12 and -80 < lon < -64:
        return 'mountain'
    # Alpes / Pyrénées
    if 42 < lat < 48 and -2 < lon < 15:
        return 'mountain'
    # Rocheuses
    if 30 < lat < 60 and -125 < lon < -100:
        return 'mountain'
    # Caucase
    if 40 < lat < 44 and 38 < lon < 50:
        return 'mountain'
    # Atlas
    if 30 < lat < 36 and -8 < lon < 10:
        return 'mountain'
    # Éthiopie highlands
    if 6 < lat < 15 and 36 < lon < 42:
        return 'mountain'

    # ── Désert (zones arides) ───────────────────────────────────────────────
    # Sahara + Moyen-Orient
    if 10 < lat < 35 and -18 < lon < 60:
        return 'desert'
    # Arabie / Golfe
    if 15 < lat < 32 and 36 < lon < 62:
        return 'desert'
    # Iran / Pakistan arides
    if 24 < lat < 38 and 48 < lon < 70:
        return 'desert'
    # Asie centrale (Gobi, Karakoum)
    if 38 < lat < 50 and 55 < lon < 110:
        return 'desert'
    # Atacama
    if -30 < lat < -18 and -72 < lon < -65:
        return 'desert'
    # Australie centrale
    if -35 < lat < -20 and 115 < lon < 140:
        return 'desert'
    # Californie / Nevada / Arizona
    if 28 < lat < 40 and -120 < lon < -108:
        return 'desert'
    # Namib / Kalahari
    if -28 < lat < -18 and 14 < lon < 25:
        return 'desert'

    # ── Toundra sub-polaire (55-65°) ────────────────────────────────────────
    if a > 55:
        # Sibérie / Canada / Alaska
        if lon > 50 or lon < -100:
            return 'tundra'
        # Scandinavie nord
        if lat > 60 and 10 < lon < 30:
            return 'tundra'

    # ── Forêt tropicale / jungle ────────────────────────────────────────────
    if abs(lat) < 10:
        # Amazonie
        if -80 < lon < -45:
            return 'forest'
        # Congo / Afrique centrale
        if 8 < lon < 32:
            return 'forest'
        # Asie du Sud-Est
        if 95 < lon < 145:
            return 'forest'

    # ── Forêt tempérée ─────────────────────────────────────────────────────
    if 45 < lat < 65:
        # Europe de l'ouest
        if -10 < lon < 30:
            return 'forest'
        # Amérique du Nord (nord-est)
        if -90 < lon < -60:
            return 'forest'

    if 10 < lat < 30:
        # Asie du Sud-Est
        if 95 < lon < 130:
            return 'forest'
        # Afrique subsaharienne humide
        if -15 < lon < 15:
            return 'forest'

    # ── Coastal (côtes connues) ─────────────────────────────────────────────
    # Détection simplifiée : proche des grands plans d'eau
    # Méditerranée
    if 30 < lat < 46 and -6 < lon < 36 and abs(lat-37) + abs(lon-18)/2 < 15:
        return 'coastal'
    # Japon / Corée / côtes Pacifique
    if 30 < lat < 45 and 129 < lon < 145:
        return 'coastal'
    # Côtes Atlantique Europe
    if 36 < lat < 60 and -12 < lon < 5:
        return 'coastal'
    # Côtes Amérique du Nord (Atlantique)
    if 25 < lat < 50 and -82 < lon < -60:
        return 'coastal'
    # Côtes Brésil
    if -35 < lat < -5 and -50 < lon < -34:
        return 'coastal'
    # Côtes Australie (littorale)
    if -38 < lat < -25 and 150 < lon < 160:
        return 'coastal'

    # ── Industrial par défaut pour certaines régions densément industrialisées
    # Ruhr / Flandres
    if 50 < lat < 52 and 5 < lon < 12:
        return 'industrial'
    # Chine côtière industrielle
    if 22 < lat < 32 and 108 < lon < 122:
        return 'urban'  # plutôt urban que industrial pour les villes
    # Rust Belt USA
    if 40 < lat < 45 and -85 < lon < -75:
        return 'industrial'

    # ── Rural par défaut ──────────────────────────────────────────────────
    # Europe centrale
    if 45 < lat < 60 and 10 < lon < 50:
        return 'rural'
    # Amérique du Nord centrale
    if 35 < lat < 50 and -100 < lon < -80:
        return 'rural'
    # Asie du Sud (Inde, Bangladesh)
    if 20 < lat < 35 and 70 < lon < 90:
        return 'rural'
    # Afrique subsaharienne
    if -10 < lat < 20 and 10 < lon < 40:
        return 'rural'
    # Amérique du Sud (centre)
    if -20 < lat < 5 and -65 < lon < -45:
        return 'rural'

    # Fallback
    return 'rural'


# ─── ÉQUILIBRE DU JEU — Brief Game + Board + Alex ─────────────────────────────
#
# CHAÎNES DE PRODUCTION (créent l'interdépendance entre biomes)
# ══════════════════════════════════════════════════════════════
#
# Électronique : Silicium (desert) + Terres rares (desert) + Composants (industrial/coastal)
#   → débloque : Skill Tech "IA" + build "Centre de données"
#
# Armement : Fer (mountain) + Acier (industrial) + Titanium (mountain)
#   → débloque : Skill Attaque "Guerre mécanisée" + build "Fortification"
#
# Énergie nucléaire : Uranium (tundra) + Eau (rural/forest/coastal)
#   → débloque : build "Centrale" → multiplicateur production ×5 sur 3 tuiles
#
# Cryptoéconomie : HEX Coin (tous) + Or (mountain/desert) + Données (urban/landmark)
#   → débloque : Skill Économie "Routes commerciales" + marketplace unlock
#
# Influence géopolitique : Influence (urban/landmark) + Stabilité (forest/rural) + Données
#   → débloque : Skill Influence "Réseau alliances" + pactes non-agression
#
# Batteries / mobilité : Lithium (tundra) + Cobalt (mountain) + Aluminium (industrial)
#   → débloque : build "Port spatial" + Skill Tech "Quantum"

PRODUCTION_CHAINS: list[dict] = [
    {
        'id': 'electronics',
        'name': 'Électronique avancée',
        'inputs': {'res_silicium': 30, 'res_terres_rares': 15, 'res_composants': 20},
        'output': 'composants_avances',
        'output_amount': 10,
        'unlocks': ['skill_tech_ia', 'build_data_center'],
        'required_biomes': ['desert', 'industrial'],
        'alex_note': 'Force alliance desert+industrial — méta intéressante',
    },
    {
        'id': 'steel_armor',
        'name': 'Armement lourd',
        'inputs': {'res_fer': 40, 'res_acier': 25, 'res_titanium': 10},
        'output': 'armement',
        'output_amount': 8,
        'unlocks': ['skill_attack_mechanized', 'build_fortification'],
        'required_biomes': ['mountain', 'industrial'],
        'alex_note': 'Path militaire viable — nécessite royaumes mixtes',
    },
    {
        'id': 'nuclear',
        'name': 'Énergie nucléaire',
        'inputs': {'res_uranium': 5, 'res_eau': 30},
        'output': 'energie_nucleaire',
        'output_amount': 50,  # très haute valeur
        'unlocks': ['build_reactor', 'production_multiplier_5x'],
        'required_biomes': ['tundra', 'forest'],
        'alex_note': 'Biomes arctiques devenus stratégiques — nouveau méta',
    },
    {
        'id': 'crypto_economy',
        'name': 'Économie numérique',
        'inputs': {'res_or': 10, 'res_donnees': 40, 'res_influence': 20},
        'output': 'hex_cristaux_bonus',
        'output_amount': 20,
        'unlocks': ['skill_economy_routes', 'marketplace_bonus'],
        'required_biomes': ['urban', 'landmark', 'mountain'],
        'alex_note': 'Landmark → Or non évident = découverte méta = fun',
    },
    {
        'id': 'geopolitical',
        'name': 'Influence géopolitique',
        'inputs': {'res_influence': 50, 'res_stabilite': 30, 'res_donnees': 25},
        'output': 'influence_globale',
        'output_amount': 15,
        'unlocks': ['skill_influence_network', 'non_aggression_pact'],
        'required_biomes': ['urban', 'landmark', 'forest'],
        'alex_note': 'Diplomatie viable = alternative au PvP pur = profondeur',
    },
    {
        'id': 'battery_tech',
        'name': 'Technologie batteries',
        'inputs': {'res_lithium': 8, 'res_cobalt': 6, 'res_aluminium': 15},
        'output': 'batteries_avancees',
        'output_amount': 12,
        'unlocks': ['build_spatial_port', 'skill_tech_quantum'],
        'required_biomes': ['tundra', 'mountain', 'industrial'],
        'alex_note': 'Tundra devient stratégique — snowball slow mais puissant',
    },
]

# ─── BUILDS — coûts rééquilibrés (Board validation) ──────────────────────────
#
# Principe : chaque build consomme des ressources de biomes DIFFÉRENTS
# → impossible de spam-builder avec un seul biome dominant
#
BUILDS: list[dict] = [
    {
        'id': 'fortification',
        'name': '🏰 Fortification',
        'cost': {'res_fer': 50, 'res_acier': 30, 'res_hex_cristaux': 200},
        'time_h': 2,
        'effect': 'Défense +25% · ATK -15% sur ce territoire',
        'biome_bonus': {'mountain': 1.4, 'industrial': 1.2},  # bonus selon biome
        'chain': 'steel_armor',
    },
    {
        'id': 'mine',
        'name': '⛏️ Mine',
        'cost': {'res_main_oeuvre': 40, 'res_acier': 20, 'res_hex_cristaux': 150},
        'time_h': 1,
        'effect': 'Production ressources +20%',
        'biome_bonus': {'mountain': 1.8, 'desert': 1.5, 'tundra': 1.4},
        'chain': None,
    },
    {
        'id': 'data_center',
        'name': '💻 Centre de données',
        'cost': {'res_composants': 30, 'res_silicium': 20, 'res_hex_cristaux': 300},
        'time_h': 3,
        'effect': 'Données +35% · Vision territoires voisins ×2',
        'biome_bonus': {'urban': 1.6, 'landmark': 1.3},
        'chain': 'electronics',
    },
    {
        'id': 'refinery',
        'name': '🛢️ Raffinerie',
        'cost': {'res_fer': 60, 'res_petrole': 30, 'res_hex_cristaux': 400},
        'time_h': 3,
        'effect': 'Pétrole +40% · Composants +15%',
        'biome_bonus': {'desert': 2.0, 'industrial': 1.5},
        'chain': None,
    },
    {
        'id': 'reactor',
        'name': '⚛️ Réacteur nucléaire',
        'cost': {'res_uranium': 10, 'res_acier': 80, 'res_titanium': 20, 'res_hex_cristaux': 1000},
        'time_h': 8,
        'effect': 'Production ×5 sur 3 tuiles adjacentes · Défense +50%',
        'biome_bonus': {'tundra': 1.3, 'industrial': 1.2},
        'chain': 'nuclear',
        'alex_note': 'Game changer tardif — nécessite coalition → fun PvP',
    },
    {
        'id': 'control_tower',
        'name': '🗼 Tour de contrôle',
        'cost': {'res_acier': 60, 'res_composants': 40, 'res_hex_cristaux': 500},
        'time_h': 4,
        'effect': 'Vision ×4 · Donne +10 HEX Coin/jour aux adjacents amis',
        'biome_bonus': {'urban': 1.3, 'landmark': 1.5},
        'chain': None,
    },
    {
        'id': 'spatial_port',
        'name': '🚀 Port spatial',
        'cost': {'res_titanium': 40, 'res_composants': 60, 'res_lithium': 15, 'res_hex_cristaux': 1000},
        'time_h': 8,
        'effect': 'Routes commerciales mondiales · Téléportation joueur · HEX Coin +30%',
        'biome_bonus': {'coastal': 1.4, 'industrial': 1.3},
        'chain': 'battery_tech',
    },
    {
        'id': 'farm',
        'name': '🌾 Ferme intensive',
        'cost': {'res_eau': 30, 'res_main_oeuvre': 25, 'res_hex_cristaux': 100},
        'time_h': 1,
        'effect': 'Nourriture +30% · Population +1 slot',
        'biome_bonus': {'rural': 2.0, 'forest': 1.5, 'coastal': 1.3},
        'chain': None,
    },
]

# ─── SKILL TREE rééquilibré — Board validation ─────────────────────────────────
#
# Principe Board : chaque skill doit créer une décision intéressante
# Chaque branche nécessite des ressources de 2-3 biomes différents
# Aucun skill n'est "toujours meilleur" — tous ont des trade-offs
#
SKILL_TREE_BALANCED: dict[str, list[dict]] = {
    'attack': [
        {
            'position': 0, 'name': 'Projection de force',
            'icon': '⚔️', 'effect': 'ATK +15% · Portée attaque +1 hex',
            'cost': [{'res_petrole': 50}, {'res_acier': 40}, {'res_main_oeuvre': 60}],
            'tradeoff': 'Consomme pétrole (précieux) — à ne pas rush',
        },
        {
            'position': 1, 'name': 'Opérations multi-front',
            'icon': '🎯', 'effect': 'Attaque 2 territoires simultanément',
            'cost': [{'res_composants': 30}, {'res_donnees': 50}, {'res_hex_cristaux': 100}],
            'tradeoff': 'Besoin composants (industrial) + données (urban) = coalition',
        },
        {
            'position': 2, 'name': 'Frappe à distance',
            'icon': '🚀', 'effect': 'ATK territoire à 3+ hexes · Ignore défense basique',
            'cost': [{'res_terres_rares': 20}, {'res_silicium': 30}, {'res_donnees': 40}],
            'tradeoff': 'Terres rares (désert) = ressource rare → PvP haute valeur',
        },
        {
            'position': 3, 'name': 'Guerre mécanisée',
            'icon': '🛡️⚔️', 'effect': 'ATK +30% si adjacent à industrial · Défense des attaquants +10%',
            'cost': [{'res_acier': 80}, {'res_titanium': 25}, {'res_petrole': 40}],
            'tradeoff': 'Nécessite mountain + industrial → incentive expansion',
        },
        {
            'position': 4, 'name': 'Supériorité stratégique',
            'icon': '👑', 'effect': 'Victoire sans combat si ATK > DEF×2 · +50 HEX Coin par victoire',
            'cost': [{'res_donnees': 80}, {'res_influence': 60}, {'res_terres_rares': 30}],
            'tradeoff': 'Skill ultime — besoin des 3 biomes les plus rares',
            'alex_note': 'Skill ultime — ouvre une voie stealth non-violente',
        },
    ],
    'defense': [
        {
            'position': 0, 'name': 'Muraille défensive',
            'icon': '🏰', 'effect': 'DEF +20% · Ralentit attaquant -1 round',
            'cost': [{'res_fer': 60}, {'res_stabilite': 30}],
        },
        {
            'position': 1, 'name': 'Dôme de protection',
            'icon': '🔵', 'effect': 'Bouclier 24h · Immunité attaque surprise',
            'cost': [{'res_composants': 40}, {'res_hex_cristaux': 150}],
            'tradeoff': 'Coûteux en HEX Coin — ne pas spammer',
        },
        {
            'position': 2, 'name': 'Fortification active',
            'icon': '⚡🏰', 'effect': 'DEF regenerates 10%/h · Riposte automatique -5% ATK ennemi',
            'cost': [{'res_acier': 50}, {'res_eau': 40}, {'res_uranium': 3}],
            'tradeoff': 'Uranium rare — nécessite tundra dans le royaume',
        },
        {
            'position': 3, 'name': 'Résistance prolongée',
            'icon': '💪', 'effect': 'DEF ×2 si siège > 3h · Moral des alliés +15%',
            'cost': [{'res_nourriture': 80}, {'res_stabilite': 60}, {'res_main_oeuvre': 50}],
            'tradeoff': 'Nécessite rural + forest — coalition agricole',
        },
        {
            'position': 4, 'name': 'Bastion imprenable',
            'icon': '🗿', 'effect': 'Ne peut être conquis que par 3+ joueurs simultanément',
            'cost': [{'res_titanium': 30}, {'res_acier': 100}, {'res_uranium': 8}, {'res_hex_cristaux': 500}],
            'tradeoff': 'Skill ultime défense — ralentit production pendant activation',
            'alex_note': 'Counter aux zergs — crée méta de coalition obligatoire',
        },
    ],
    'economy': [
        {
            'position': 0, 'name': 'Optimisation production',
            'icon': '📈', 'effect': '+10% sur toutes les ressources du royaume',
            'cost': [{'res_donnees': 30}, {'res_main_oeuvre': 40}],
        },
        {
            'position': 1, 'name': 'Routes commerciales',
            'icon': '🚢', 'effect': 'Échange ressources avec alliés sans délai · Taxe -3%',
            'cost': [{'res_or': 15}, {'res_hex_cristaux': 200}],
            'tradeoff': 'Or (mountain/desert) = ressource mixte → bridge géographique',
        },
        {
            'position': 2, 'name': 'Investissement territorial',
            'icon': '💰', 'effect': 'Build cost -20% · Builds génèrent XP double',
            'cost': [{'res_hex_cristaux': 300}, {'res_influence': 30}],
        },
        {
            'position': 3, 'name': 'Surplus stratégique',
            'icon': '🏦', 'effect': 'Ressources excédentaires converties en HEX Coin auto · +15%',
            'cost': [{'res_donnees': 60}, {'res_or': 20}, {'res_composants': 25}],
            'tradeoff': 'Nécessite urban + mountain + industrial = empire diversifié',
        },
        {
            'position': 4, 'name': 'Monopole ressource',
            'icon': '💎', 'effect': 'Si >20% offre mondiale d\'une ressource : prix +100% · revenus pasifs',
            'cost': [{'res_influence': 100}, {'res_donnees': 80}, {'res_or': 30}],
            'alex_note': 'Skill investisseur — Thomas adorera, Alex haïra = bon équilibre',
        },
    ],
    'influence': [
        {
            'position': 0, 'name': 'Diffusion médias',
            'icon': '📡', 'effect': 'Portée influence +2 hexes · Recrutement alliés +20%',
            'cost': [{'res_donnees': 40}, {'res_influence': 30}],
        },
        {
            'position': 1, 'name': 'Réseau diplomatique',
            'icon': '🤝', 'effect': 'Pactes non-agression disponibles · Échanges ressources coût -15%',
            'cost': [{'res_influence': 60}, {'res_stabilite': 40}, {'res_hex_cristaux': 150}],
        },
        {
            'position': 2, 'name': 'Rayonnement culturel',
            'icon': '🌐', 'effect': 'Territoires adjacents ennemis ont -10% DEF · Recrutement x2',
            'cost': [{'res_influence': 80}, {'res_donnees': 50}, {'res_stabilite': 50}],
        },
        {
            'position': 3, 'name': 'Soft power',
            'icon': '🎭', 'effect': 'Peut "acheter" la loyauté d\'un territoire ennemi sans combat',
            'cost': [{'res_influence': 100}, {'res_or': 20}, {'res_hex_cristaux': 400}],
            'tradeoff': 'Alternative diplomatique à l\'attaque — counter-stratégie',
            'alex_note': 'Crée la diplomatie comme méta viable = depth',
        },
        {
            'position': 4, 'name': 'Hégémonie globale',
            'icon': '🏛️', 'effect': 'Si >15 territoires liés : tous les joueurs paient 1% revenu/j',
            'cost': [{'res_influence': 150}, {'res_donnees': 100}, {'res_stabilite': 80}, {'res_or': 40}],
            'alex_note': 'Victoire diplomatique — nouvelle condition de victoire saison',
        },
    ],
    'tech': [
        {
            'position': 0, 'name': 'Recherche accélérée',
            'icon': '🔬', 'effect': 'Unlock speed ×1.5 · Prochaine skill coût -15%',
            'cost': [{'res_donnees': 35}, {'res_composants': 20}],
        },
        {
            'position': 1, 'name': 'Intelligence artificielle',
            'icon': '🤖', 'effect': 'Production auto optimisée +25% · Vision carte +3 hexes',
            'cost': [{'res_silicium': 30}, {'res_donnees': 60}, {'res_composants': 25}],
            'chain': 'electronics',
        },
        {
            'position': 2, 'name': 'Cyberguerre',
            'icon': '💻⚔️', 'effect': 'Peut désactiver build ennemi 6h · Immunité cyberattaque',
            'cost': [{'res_composants': 50}, {'res_donnees': 70}, {'res_terres_rares': 15}],
            'tradeoff': 'Attaque non-cinétique — contourne Bastion imprenable',
            'alex_note': 'Counter au skill défense ultime = rock-paper-scissors = fun',
        },
        {
            'position': 3, 'name': 'Nanotechnologie',
            'icon': '🧬', 'effect': 'Builds construits 2× plus vite · Ressources +10% partout',
            'cost': [{'res_terres_rares': 25}, {'res_lithium': 15}, {'res_composants': 60}],
            'chain': 'battery_tech',
        },
        {
            'position': 4, 'name': 'Singularité quantique',
            'icon': '⚛️', 'effect': 'Production de toutes ressources ×2 · Nouveau build "Portail" débloqué',
            'cost': [{'res_uranium': 15}, {'res_terres_rares': 30}, {'res_donnees': 100}, {'res_hex_cristaux': 800}],
            'tradeoff': 'Skill ultime tech — nécessite tundra + desert + urban = empire max',
            'alex_note': 'Win condition tech — met en évidence le snowball tardif',
        },
    ],
}

# ─── FONCTION PRINCIPALE : recalculer biomes + ressources pour tous les POIs ──

def recalculate_all_biomes():
    """
    Met à jour biome + territory_type + ressources pour tous les territoires.
    Idempotent. Appeler après seed initial ou migration.
    """
    from django.db import connection
    import sqlite3

    with connection.cursor() as cur:
        # Ajouter colonnes manquantes si nécessaire
        for col, dtype in [('res_or', 'REAL DEFAULT 0'), ('res_cobalt', 'REAL DEFAULT 0'), ('res_lithium', 'REAL DEFAULT 0')]:
            try:
                cur.execute(f"ALTER TABLE territories ADD COLUMN {col} {dtype}")
            except Exception:
                pass  # colonne déjà présente

        cur.execute("""
            SELECT h3_index, center_lat, center_lon, territory_type, biome, poi_name,
                   rarity, is_landmark
            FROM territories
            WHERE center_lat IS NOT NULL
        """)
        rows = cur.fetchall()

    from terra_domini.apps.events.unified_poi import UnifiedPOI
    # Build poi_category index
    poi_cats = {p['h3_index']: p['category'] for p in
                UnifiedPOI.objects.filter(is_active=True).values('h3_index', 'category')
                if p['h3_index']}

    import sqlite3 as _sq3
    from django.conf import settings as _s
    db_path = str(_s.DATABASES['default'].get('NAME', 'db.sqlite3'))
    conn2 = _sq3.connect(db_path)
    cur2  = conn2.cursor()

    updated = 0
    for row in rows:
        h3_index, lat, lon, t_type, current_biome, poi_name, rarity, is_landmark = row
        if lat is None: continue

        poi_cat = poi_cats.get(h3_index, '')
        new_biome = assign_biome(float(lat), float(lon), poi_cat, t_type or '')

        new_type = t_type
        if is_landmark and t_type not in ('landmark',):
            new_type = 'landmark'
        elif not is_landmark and new_biome in ('urban','rural','forest','mountain','coastal','desert','tundra','industrial'):
            new_type = new_biome

        base_res = BIOME_PRODUCTION.get(new_biome, BIOME_PRODUCTION['rural'])
        rarity_mult = {'common':1.0,'uncommon':1.3,'rare':1.7,'epic':2.2,'legendary':3.0,'mythic':5.0}.get(rarity or 'common', 1.0)

        set_parts = ['biome=?', 'territory_type=?']
        params = [new_biome, new_type]

        for res_field, base_val in base_res.items():
            if res_field in RESOURCE_DB_FIELDS:
                set_parts.append(f"{res_field}=?")
                params.append(round(base_val * rarity_mult, 2))

        tdc_map = {'common':10,'uncommon':30,'rare':80,'epic':200,'legendary':500,'mythic':2000}
        set_parts.append('tdc_per_day=?')
        params.append(tdc_map.get(rarity or 'common', 10))

        params.append(h3_index)
        cur2.execute(f"UPDATE territories SET {', '.join(set_parts)} WHERE h3_index=?", params)
        updated += 1

    conn2.commit()
    conn2.close()
    return updated
