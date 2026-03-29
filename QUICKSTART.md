# ⬡ HEXOD — Quick Start Guide

## 🚀 Option 1: One-Command Start (Codespace / Ubuntu)

```bash
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini
chmod +x start.sh
./start.sh
```

Opens:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **Admin**: http://localhost:8000/admin/
- **Login**: `admin@td.com` / `admin123`

---

## 🔧 Option 2: Manual Setup

### Backend (Django)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # admin@td.com / admin123
python manage.py runserver 0.0.0.0:8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npx vite --host 0.0.0.0 --port 5173
```

### Smart Contracts (Hardhat)
```bash
cd contracts
npm install
npx hardhat compile                              # Compile contracts
npx hardhat run scripts/deploy.js --network amoy  # Deploy to testnet
```

---

## 🎮 What You'll See

### Game Screen
- **Top**: News ticker (28px) + glassmorphism HUD (commander + crystal balance)
- **Left**: Radar trigger (48px) → opens 380px filter panel
- **Bottom**: Hex-shaped dock (12 buttons)
- **Bottom-right**: Radar widget (SVG sweep)
- **Bottom-left**: Sound toggle
- **Top-right**: Day cycle timer (60s auto-progression)

### Panels (click dock buttons)
| Button | Panel | What it shows |
|--------|-------|---------------|
| ⚔ Military | CombatPanel | Unit training, battles, attack branch progress |
| 📡 Events | EventsPanel | Control towers, POI battles, live events |
| 👑 Kingdom | KingdomPanel | Overview/Resources/SkillTree/Conquest (4 tabs) |
| 📖 Codex | CodexPanel | Token collection grid, 48 types, rarity breakdown |
| 🛒 Shop | ShopPanel | Boosters, items, kingdom boost context |
| 📊 Trade | TradePanel | Market, player trade, price board |
| 🏪 NFT | MarketplacePanel | Territory NFT marketplace |
| 🏰 Alliance | AlliancePanel | Alliance management |
| 🏆 Ladder | LadderPanel | Competitive rankings |
| 👤 Profile | ProfilePanel | Player info, stats |
| 💎 Wallet | CryptoPanel | HEX balance, tokenomics, staking, burn tracker |
| 📋 Info | MetaDashboard | Game stats, meta info |

### Kingdom Flow
1. Click unclaimed territory on map
2. Choose conquest method (Purchase / Assault / Infiltrate)
3. If first territory → Kingdom Creation Wizard (name + color)
4. Territory added to kingdom → starts producing resources
5. Open Kingdom panel → Resources tab → set allocation %
6. Day timer completes → resources converted to crystals
7. Crystals flow to skill tree branches → pour into skills
8. Skills unlock bonuses → kingdom gets stronger → conquer more

### Blockchain (Tokenomics tab in Wallet)
- Supply progress (mined vs hard cap)
- Price, market cap, holders
- Staking APY tiers (10% / 25% / 50%)
- Daily burn counter
- Chain info (Polygon PoS)

---

## 📁 Project Structure

```
terra-domini/
├── frontend/                    # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx              # Root with HEXOD shell layout
│   │   ├── components/
│   │   │   ├── shared/          # 17 reusable HEXOD components
│   │   │   │   ├── iconBank.tsx # 140 SVG icons (category+resource+skill+UI)
│   │   │   │   ├── GlassPanel.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── HexodDock.tsx
│   │   │   │   └── ...
│   │   │   ├── kingdom/         # Kingdom system components
│   │   │   │   ├── KingdomPanel.tsx
│   │   │   │   ├── SkillTreeView.tsx
│   │   │   │   └── ConquestActions.tsx
│   │   │   ├── crypto/          # Blockchain integration
│   │   │   │   ├── CryptoPanel.tsx  # Tokenomics dashboard
│   │   │   │   └── WalletProvider.tsx
│   │   │   ├── hud/             # HUD + game panels
│   │   │   ├── shop/            # Shop system
│   │   │   └── map/             # Map components
│   │   ├── store/
│   │   │   ├── index.ts         # Main Zustand store
│   │   │   └── kingdomStore.ts  # Kingdom-specific store
│   │   ├── hooks/
│   │   │   └── useBlockchain.ts # Wallet + contract hooks
│   │   └── types/
│   │       └── kingdom.types.ts # 20 resources, 9 biomes, 6 branches
│   └── dist/                    # Built output (served by Django)
│
├── backend/                     # Django 5 + DRF + WebSocket
│   ├── game/                    # Game logic
│   ├── territories/             # H3 territory management
│   ├── battles/                 # Combat system
│   └── wallet/                  # HEX token management
│
├── contracts/                   # Solidity smart contracts
│   ├── contracts/
│   │   ├── HEXToken.sol         # ERC-20 with mining + burn
│   │   ├── TerritoryNFT.sol     # ERC-721 with H3 data
│   │   └── Staking.sol          # Lock HEX for bonuses
│   ├── scripts/deploy.js        # Deployment script
│   └── hardhat.config.js        # Polygon + Base config
│
├── llm/                         # Agent brain files
│   ├── agent_weights.json       # 87 decision weights
│   ├── agent_model.json         # 8-layer processing pipeline
│   ├── blockchain_architecture.md
│   ├── production_readiness.md
│   ├── specifications.md        # 18 module specs
│   └── system_prompt.txt        # Agent identity
│
├── start.sh                     # One-command startup
└── QUICKSTART.md                # This file
```

---

## 🔗 Key URLs

| Resource | URL |
|----------|-----|
| Repo | https://github.com/Richie6988/terra-domini |
| Polygon PoS | https://polygonscan.com |
| QuickSwap DEX | https://quickswap.exchange |
| Amoy Testnet | https://amoy.polygonscan.com |
| Amoy Faucet | https://faucet.polygon.technology |
