# 🌍 TERRA DOMINI

**Real-world territory strategy .io game. Every square meter of Earth, contested.**

Built on OpenStreetMap + H3 hex grid. Native cryptocurrency (TDC on Polygon). Real advertising marketplace.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + Leaflet + H3-js)                             │
│  Map rendering · WebSocket HUD · TDC Shop · Alliance panels     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────▼─────────────────────────────────────┐
│  Nginx (reverse proxy + SSL termination)                        │
└──────────┬──────────────────────────────┬───────────────────────┘
           │ HTTP                         │ WebSocket upgrade
┌──────────▼──────────────┐   ┌───────────▼──────────────────────┐
│  Django REST API        │   │  Django Channels (ASGI)          │
│  JWT auth · Shop · TDC  │   │  TerritoryMapConsumer            │
│  Combat · Alliance      │   │  Real-time territory broadcasts  │
└──────────┬──────────────┘   └───────────┬──────────────────────┘
           │                              │
┌──────────▼──────────────────────────────▼──────────────────────┐
│  Celery Workers                                                 │
│  combat (battle resolution) · territory (resource ticks)       │
│  blockchain (TDC minting) · default (anti-cheat, leaderboards) │
└─────────┬──────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────┐
│  Data Layer                                                     │
│  PostgreSQL+PostGIS · Redis Cluster · MongoDB · Kafka · Influx │
└────────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────┐
│  Polygon (Matic) Blockchain                                     │
│  TerraDominiCoin.sol (ERC-20) · Treasury wallet · Fee collect  │
└────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Leaflet + H3-js + Zustand |
| Backend | Django 5 + DRF + Django Channels (ASGI) |
| Game Server | Celery (combat/territory ticks) |
| WebSocket | Django Channels + Redis Channel Layer |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache / Pub-Sub | Redis 7 Cluster |
| Document Store | MongoDB 7 (territory metadata) |
| Event Stream | Apache Kafka 7.6 (anti-cheat audit log) |
| Blockchain | Polygon (Matic) — ERC-20 TDC token |
| Geo Engine | H3 (Uber) res-10 + OpenStreetMap Overpass API |
| Infrastructure | Docker Compose → Kubernetes (production) |
| Proxy | Nginx 1.25 with rate limiting |

---

## Quick Start (Development)

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (frontend)
- Python 3.12+ (for local scripts)

### 1. Clone and configure

```bash
git clone https://github.com/yourorg/terra-domini
cd terra-domini
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, REDIS_PASSWORD, DJANGO_SECRET_KEY
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis mongodb kafka zookeeper
sleep 15  # wait for services
```

### 3. Run Django migrations

```bash
docker compose run --rm web python manage.py migrate
docker compose run --rm web python manage.py createsuperuser
```

### 4. Create geo indexes

```bash
docker compose run --rm web python manage.py shell -c \
  "from django.db import connection; connection.cursor().execute('SELECT td_create_geo_indexes()')"
```

### 5. Seed map data (Paris test region ~30 min)

```bash
docker compose run --rm web python scripts/geo_pipeline.py --region test
# Full Paris (2-3h):
# docker compose run --rm web python scripts/geo_pipeline.py --region paris
```

### 6. Start all services

```bash
docker compose up -d
```

### 7. Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 8. API docs

```
http://localhost:8000/api/docs/
```

---

## Blockchain Setup

### Deploy TDC on testnet

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network mumbai
# Copy TDC_CONTRACT_ADDRESS from output → update .env
```

### Deploy on Polygon mainnet

```bash
# Ensure TDC_TREASURY_PRIVATE_KEY is set and funded with MATIC
npx hardhat run scripts/deploy.ts --network polygon
```

---

## Key Configurations

### Game balance (settings/base.py → GAME dict)

```python
GAME = {
    'H3_DEFAULT_RESOLUTION': 10,         # ~150m hex edge
    'TERRITORY_TICK_SECONDS': 300,        # Resource gen: every 5 min
    'OFFLINE_INCOME_RATE': 0.40,          # 40% of online rate offline
    'BEGINNER_PROTECTION_DAYS': 7,        # No PvP for new players
    'BATTLE_TIMER': {
        'HEX': 4 * 3600,                  # Standard hex: 4h
        'DISTRICT': 12 * 3600,
        'CITY': 24 * 3600,
        'CAPITAL': 72 * 3600,
    },
    'SHIELD_MAX_HOURS_PER_DAY': 12,       # P2W cap
    'MAX_MILITARY_BOOST_PCT': 25,         # P2W cap
    'MAX_BUILD_SPEED_BOOST_PCT': 50,      # P2W cap
}
```

### TDC economics (.env)

```
TDC_EUR_RATE=100          # 1 EUR = 100 TDC
TDC_MIN_WITHDRAWAL=50     # Min 50 TDC to withdraw
```

---

## Project Structure

```
terra-domini/
├── backend/
│   └── terra_domini/
│       ├── settings/base.py          # Production Django settings
│       ├── asgi.py                   # HTTP + WebSocket routing
│       ├── celery.py                 # Task scheduler
│       ├── middleware.py             # JWT Channels, timing, game session
│       ├── urls.py                   # URL routing
│       └── apps/
│           ├── accounts/             # Player model, auth views, anti-cheat
│           ├── territories/          # Territory model, H3 engine, resource ticks
│           ├── combat/               # Battle model, combat engine, Celery tasks
│           ├── economy/              # Shop, TDC views, ad campaigns
│           ├── blockchain/           # Web3 service, TDC transactions
│           ├── alliances/            # Alliance, diplomacy models+views
│           ├── events/               # Control Tower Wars, world events
│           └── websocket/            # Channels consumer, routing
├── contracts/
│   ├── TerraDominiCoin.sol           # ERC-20 TDC token (Polygon)
│   ├── hardhat.config.ts
│   └── scripts/deploy.ts
├── frontend/
│   └── src/
│       ├── types/index.ts            # All TypeScript types
│       ├── store/index.ts            # Zustand global store
│       ├── services/api.ts           # Axios API layer + JWT refresh
│       ├── hooks/useGameSocket.ts    # WebSocket lifecycle manager
│       ├── components/
│       │   ├── map/GameMap.tsx       # Leaflet + H3 hex overlay
│       │   ├── hud/GameHUD.tsx       # Top bar + bottom nav + notifications
│       │   ├── hud/TerritoryPanel.tsx # Click panel: claim/attack/build
│       │   ├── shop/TDCShopPanel.tsx # Wallet + Buy TDC + Shop catalog
│       │   └── alliance/AlliancePanel.tsx # Alliance + Combat panels
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   └── RegisterPage.tsx
│       └── App.tsx                   # Router + QueryClient + GameScreen
├── scripts/
│   ├── init_db.sql                   # PostGIS init, partitions, indexes
│   └── geo_pipeline.py               # OSM → H3 hex territory classifier
├── nginx/nginx.conf                  # Reverse proxy + rate limiting
├── docker-compose.yml                # Full stack
└── .env.example                      # All required environment variables
```

---

## Production Deployment (Kubernetes)

1. Push images to ECR/GCR
2. Apply Kubernetes manifests (Helm charts recommended)
3. Configure HPA: min 3 web pods, scale on CPU+connections
4. Redis: use Redis Cluster (6 nodes) or ElastiCache
5. Postgres: RDS Multi-AZ with read replica for leaderboards
6. Kafka: MSK (AWS) or Confluent Cloud
7. CDN: CloudFront in front of Nginx for static/map tiles
8. Monitoring: Prometheus + Grafana + Datadog APM

### Horizontal scaling approach

- **web** pods: stateless, scale freely (JWT auth, Redis session)
- **celery combat** pods: 1 per 10k active battles
- **celery territory** pods: 1 per 500k owned territories
- **WebSocket**: sticky sessions via Nginx `ip_hash` or Kubernetes session affinity

---

## Anti-Cheat Architecture

```
Player action → Django middleware → Kafka producer (emit_game_event)
                                           ↓
                              Kafka topic: terra_domini.game_events
                                           ↓
                              AnticheatConsumer (standalone process)
                                    ↓
                    ┌──────────────────────────────┐
                    │ Rule Engine                  │
                    │ • Click rate > 120/min       │
                    │ • Multi-account device FP    │
                    │ • Resource rate anomaly      │
                    │ • Rapid buy/withdraw (TDC)   │
                    └──────────────┬───────────────┘
                                   ↓
                    Kafka: anticheat_alerts
                           ↓              ↓
                    Auto-ban (critical)  Flag for review (medium)
```

---

## Revenue Model

| Stream | Mechanism | Platform Cut |
|--------|-----------|-------------|
| TDC purchases | Stripe → TDC mint | 100% (cost of goods: blockchain gas) |
| In-game shop | TDC deduction | 100% |
| Battle Pass | €4.99/season | 100% |
| Ad impressions | CPM auction (brands) | 30% |
| Ad revenue to players | Territory viewer count → TDC credit | 0% (player earns 70%) |
| Wallet withdrawals | 3% fee on TDC → ETH | 100% |
| Alliance Premium | €9.99/month | 100% |

---

## License

Proprietary — Terra Domini © 2024. All rights reserved.

TDC is a utility token for in-game use. Nothing in this repository constitutes financial advice or investment solicitation. Token value is not guaranteed. DYOR.
