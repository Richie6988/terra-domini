#!/usr/bin/env bash
# =============================================================================
# HEXOD — CODELAB ADMIN TEST
# Script à coller dans le terminal du Codespace GitHub
# Lance backend + frontend + seed données de test en une commande
# =============================================================================
set -e  # stop on error

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$REPO_ROOT/backend"
FRONTEND="$REPO_ROOT/frontend"
DB="$BACKEND/db.sqlite3"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${GREEN}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
section() { echo -e "\n${YELLOW}══════════════════════════════════════════════${NC}"; echo -e "${YELLOW}  $1${NC}"; echo -e "${YELLOW}══════════════════════════════════════════════${NC}"; }

# ─── 0. Git pull latest ──────────────────────────────────────────────────────
section "0. Sync repo"
cd "$REPO_ROOT"
git pull origin main
log "Repo à jour ✅"

# ─── 1. Install Python deps ──────────────────────────────────────────────────
section "1. Python dependencies"
cd "$BACKEND"
pip install -q --break-system-packages -r requirements.txt 2>/dev/null | tail -3 || \
pip install -q -r requirements.txt 2>/dev/null | tail -3
log "Python deps OK ✅"

# ─── 2. Migrations & seed ────────────────────────────────────────────────────
section "2. Base de données"
export DJANGO_SETTINGS_MODULE="terra_domini.settings.dev"
export DJANGO_SECRET_KEY="dev-secret-key-hexod-test"

cd "$BACKEND"

# Fake-initial si la migration 0001 n'est pas encore enregistrée
python3 manage.py migrate --run-syncdb --no-input 2>/dev/null | grep -E "Apply|Create|OK|Skip" | head -20
log "Migrations OK ✅"

# ─── 3. Admin + données de test ──────────────────────────────────────────────
section "3. Admin + seed données"
python3 manage.py shell -c "
from terra_domini.apps.accounts.models import Player

# Créer/mettre à jour admin
p, created = Player.objects.get_or_create(
    email='admin@hexod.io',
    defaults={'username': 'admin', 'display_name': 'Admin Hexod'}
)
p.set_password('Admin123!')
p.is_staff = True
p.is_superuser = True
p.tdc_in_game = 9_999_999
p.commander_rank = 100
p.battles_won = 500
p.territories_captured = 200
p.tutorial_completed = True
p.save()

# Joueur de test standard
p2, _ = Player.objects.get_or_create(
    email='test@hexod.io',
    defaults={'username': 'TestPlayer', 'display_name': 'Test Player'}
)
p2.set_password('Test123!')
p2.tdc_in_game = 5000
p2.commander_rank = 10
p2.tutorial_completed = True
p2.save()

print(f'✅ Admin: admin@hexod.io / Admin123!')
print(f'✅ Test:  test@hexod.io  / Test123!')
print(f'   Admin HEX Coin: {p.tdc_in_game}')
" 2>/dev/null | grep -v "DEV settings\|imported"

# Seed shop items
python3 manage.py shell -c "
from terra_domini.apps.economy.models import ShopItem
if ShopItem.objects.count() == 0:
    import sqlite3, datetime
    conn = sqlite3.connect('db.sqlite3')
    c = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()
    items = [
        ('atk_double_zone','Double assaut','military','Attaque 2 zones simultanement.','double_attack',2,14400,200,'rare',2,'⚔️'),
        ('atk_boost_60','Berserker +60%','military','ATK +60% pendant 1h.','atk_multiplier',1.60,3600,350,'epic',1,'💥'),
        ('shield_24h','Bouclier 24h','shield','Immunite 24h.','shield',1,86400,300,'uncommon',2,'🛡'),
        ('def_boost_50','Fort. urgence','shield','DEF +50% pendant 4h.','def_multiplier',1.50,14400,250,'rare',2,'🏰'),
        ('res_x2_8h','Prod. x2 (8h)','resource_pack','Ressources x2 pendant 8h.','production_multiplier',2.0,28800,500,'rare',1,'⚡'),
        ('res_x3_1h','Sprint x3','resource_pack','Production x3 pendant 1h.','production_multiplier',3.0,3600,300,'epic',2,'🔥'),
        ('hex_bonus_2000','Pack HEX 2000','resource_pack','+2000 HEX Coin.','hex_bonus',2000,0,1600,'rare',0,'💰'),
        ('build_instant','Build instant','construction','Prochain build instantane.','build_instant_once',1,0,180,'uncommon',3,'⚡'),
        ('booster_standard','Booster Standard','cosmetic','3 cartes - 1 Rare garantie.','booster_pack',3,0,150,'uncommon',0,'📦'),
        ('booster_premium','Booster Premium','cosmetic','5 cartes - 1 Legendary garantie.','booster_pack',5,0,500,'epic',0,'💎'),
        ('booster_mythic','Booster Mythique','cosmetic','3 cartes - 1 Mythic garantie.','booster_pack',3,0,1500,'legendary',1,'✨'),
    ]
    for it in items:
        c.execute('INSERT OR IGNORE INTO shop_items (code,name,category,description,effect_type,effect_value,effect_duration_seconds,price_tdc,rarity,max_per_day,icon_url,is_active,is_limited,max_stock,sold_count,hard_cap_pct,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0,0,0,0,?)',
            (it[0],it[1],it[2],it[3],it[4],it[5],it[6],it[7],it[8],it[9],it[10],now))
    conn.commit(); conn.close()
    print(f'  Shop seeded: {len(items)} items')
else:
    print(f'  Shop already has {ShopItem.objects.count()} items')
" 2>/dev/null | grep -v "DEV settings\|imported"

# Seed skill tree
python3 manage.py shell -c "
from terra_domini.apps.progression.models import SkillNode
if SkillNode.objects.count() == 0:
    nodes = [
        ('attack',0,'⚔️','Projection de force','ATK +15%',[{'res_petrole':30}],''),
        ('attack',1,'🎯','Reconnaissance','Vision +3 hexes',[{'res_donnees':40}],''),
        ('attack',2,'🪖','Assaut mecanise','ATK x1.4 si industrial',[{'res_acier':60}],'attack_style'),
        ('attack',2,'💻','Cyberguerre','Infiltration cout x0.5',[{'res_donnees':50}],'attack_style'),
        ('defense',0,'🏰','Muraille','DEF +20%',[{'res_fer':40}],''),
        ('defense',2,'💪','Resistance','DEF x2 si siege >3h',[{'res_nourriture':60}],'defense_style'),
        ('defense',2,'⚡','Riposte','Contre-attaque auto',[{'res_acier':40}],'defense_style'),
        ('economy',0,'📈','Optimisation','+10% ressources',[{'res_donnees':25}],''),
        ('economy',2,'🏭','Specialisation biome','Biome dom. x2.5',[{'res_donnees':50}],'eco_style'),
        ('economy',2,'🌐','Empire diversifie','4+ biomes x1.4',[{'res_or':15}],'eco_style'),
        ('influence',0,'📡','Diffusion medias','Portee +2 hexes',[{'res_donnees':30}],''),
        ('influence',2,'🎭','Soft power','Achete territoire ennemi',[{'res_influence':80}],'inf_style'),
        ('tech',0,'🔬','Recherche','Unlock x1.5',[{'res_donnees':30}],''),
        ('tech',2,'🔫','Militech','Attaques cout -30%',[{'res_composants':50}],'tech_style'),
        ('tech',2,'🧬','Biotech','Productions x1.3',[{'res_eau':60}],'tech_style'),
    ]
    for (br,pos,icon,name,effect,cost,fork) in nodes:
        SkillNode.objects.get_or_create(
            branch=br, position=pos, fork_group=fork,
            defaults={'name':name,'effect':effect,'icon':icon,'cost_json':cost}
        )
    print(f'  Skill tree seeded: {len(nodes)} nodes')
else:
    print(f'  Skill tree: {SkillNode.objects.count()} nodes')
" 2>/dev/null | grep -v "DEV settings\|imported"

# Seed MissionTemplates
python3 manage.py shell -c "
from terra_domini.apps.progression.models import MissionTemplate
if MissionTemplate.objects.count() == 0:
    missions = [
        ('Conquistador','Reclamez 1 territoire','claim_territory',1,'🏴',20),
        ('Collectionneur','Reclamez 3 territoires','claim_territory',3,'🗺️',50),
        ('Guerrier','Gagnez 1 bataille','battle_win',1,'⚔️',30),
        ('Producteur','Collectez des ressources','collect_resources',100,'📦',40),
        ('Explorateur','Reclamez un POI','visit_poi',1,'⭐',60),
        ('Diplomate','Connectez-vous','login',1,'🔥',10),
        ('Stratege','Debloquez un skill','upgrade_skill',1,'🔬',80),
        ('Marchand','Envoyez une offre','send_offer',1,'🤝',35),
    ]
    for (t,d,obj,target,icon,tdc) in missions:
        MissionTemplate.objects.create(title=t,description=d,objective_type=obj,target_value=target,icon_emoji=icon,reward_tdc=tdc)
    print(f'  Missions seeded: {len(missions)} templates')
else:
    print(f'  Missions: {MissionTemplate.objects.count()} templates')
" 2>/dev/null | grep -v "DEV settings\|imported"

log "Seed complet ✅"

# ─── 4. Install frontend deps ─────────────────────────────────────────────────
section "4. Frontend npm install"
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then
    log "Installation node_modules (première fois ~2min)…"
    npm install --silent 2>/dev/null | tail -3
else
    log "node_modules déjà présent ✅"
fi

# ─── 5. Launch ───────────────────────────────────────────────────────────────
section "5. Lancement des serveurs"

# Kill tout ce qui tourne sur 8000/5173
kill $(lsof -ti:8000) 2>/dev/null || true
kill $(lsof -ti:5173) 2>/dev/null || true
sleep 1

cd "$BACKEND"
log "Démarrage Django sur :8000…"
python3 manage.py runserver 0.0.0.0:8000 \
    --settings=terra_domini.settings.dev \
    --noreload \
    2>&1 | grep -v "^$" | grep -E "Watching|Starting|Error|WARNING|CRITICAL|Performing" &
DJANGO_PID=$!

sleep 2

cd "$FRONTEND"
log "Démarrage Vite sur :5173…"
npm run dev -- --host 2>/dev/null &
VITE_PID=$!

sleep 3

# ─── 6. Get URLs ─────────────────────────────────────────────────────────────
section "6. URLs de test"

# Tenter de récupérer l'URL Codespace
CODESPACE_URL=""
if [ -n "$CODESPACE_NAME" ]; then
    CODESPACE_URL="https://${CODESPACE_NAME}-5173.app.github.dev"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          HEXOD — SERVEURS EN COURS D'EXÉCUTION           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌍 Frontend  → ${YELLOW}http://localhost:5173${NC}"
echo -e "  🔧 API       → ${YELLOW}http://localhost:8000/api/${NC}"
echo -e "  🛡️  Admin     → ${YELLOW}http://localhost:8000/admin/${NC}"
echo ""
if [ -n "$CODESPACE_URL" ]; then
echo -e "  🚀 Codespace → ${YELLOW}${CODESPACE_URL}${NC}"
echo ""
fi
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo -e "  COMPTES DE TEST"
echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
echo -e "  👑 Admin     │ admin@hexod.io    │ Admin123!"
echo -e "               │ HEX Coin: 9 999 999 │ Rang: 100"
echo -e "  🎮 Test      │ test@hexod.io     │ Test123!"
echo -e "               │ HEX Coin: 5 000     │ Rang: 10"
echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
echo -e "  PANELS DISPONIBLES (nav bas)"
echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
echo -e "  ⚔️  Combat    │ 🤝 Alliance  │ 🏆 Events  │ 👤 Profil"
echo -e "  🔄 Trade     │ 🏪 Boutique  │ 🏆 Ladder  │ 📊 Méta"
echo -e "  💎 Crypto    │ 🎯 Missions  │ 🗺️ Campagnes"
echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
echo -e "  BOUTONS GAUCHE CARTE"
echo -e "${YELLOW}──────────────────────────────────────────────────────────${NC}"
echo -e "  📍 Filtres POI │ ⬡ Mes territoires │ 🎯 Missions"
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Logs Django PID: $DJANGO_PID │ Vite PID: $VITE_PID"
echo -e "  Pour arrêter : ${RED}kill $DJANGO_PID $VITE_PID${NC}"
echo ""

# ─── 7. Attente / health check ────────────────────────────────────────────────
sleep 2
log "Health check API…"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/geoip/ 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    log "API répond 200 ✅"
else
    warn "API statut: $HTTP_STATUS — attendez quelques secondes puis rechargez"
fi

wait $VITE_PID
