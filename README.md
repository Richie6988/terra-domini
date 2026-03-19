# Terra Domini 🌍

**Real-world territory strategy .io game.** Every H3 hexagon on Earth is capturable. Native TDC token on Polygon. Real advertising marketplace. Live geopolitical events (Hormuz, Taiwan Strait).

🔗 **Live dev:** https://github.com/Richie6988/terra-domini

---

## Quick Start (Codespace)

```bash
# 1. Clone & enter
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini

# 2. Python env
python3 -m venv venv && source venv/bin/activate

# 3. Fix pkg_resources FIRST, then install
pip install --upgrade setuptools pip
pip install shapely==2.1.2
pip install -r backend/requirements.txt

# 4. Build frontend (Node.js required)
# If Node not found: export PATH=/tmp/node-v20.11.0-linux-x64-musl/bin:$PATH
bash build.sh

# 5. Configure environment
export DJANGO_SETTINGS_MODULE=terra_domini.settings.dev
export DJANGO_SECRET_KEY=dev-secret-key-change-in-prod

# 6. Database
cd backend
python manage.py migrate
python manage.py shell -c "
from terra_domini.apps.accounts.models import Player
Player.objects.filter(email='admin@td.local').exists() or \
Player.objects.create_superuser('admin@td.local', 'admin', 'adminpassword123')
"

# 7. Start (ASGI — supports WebSocket)
daphne -b 0.0.0.0 -p 8000 terra_domini.asgi:application
```

Open: http://localhost:8000 (or Codespace port 8000 URL)

---

## Architecture

```
terra-domini/
├── backend/                     Django 5 + DRF + Channels (ASGI)
│   ├── manage.py
│   ├── requirements.txt
│   └── terra_domini/
│       ├── asgi.py              ASGI entry (HTTP + WebSocket)
│       ├── settings/
│       │   ├── dev.py           SQLite + memory cache (Codespace)
│       │   └── base.py          PostgreSQL + Redis (production)
│       ├── apps/
│       │   ├── accounts/        Player model, JWT auth, password reset
│       │   ├── territories/     H3 hex system, building, resource ticks
│       │   ├── combat/          Battle engine, military units
│       │   ├── economy/         TDC shop, Stripe, ad marketplace
│       │   ├── alliances/       Guild system, diplomacy, war declarations
│       │   ├── blockchain/      Polygon TDC token, Web3 integration
│       │   ├── events/          Control Tower Wars, World POI (Hormuz etc.)
│       │   ├── progression/     Streaks, daily missions, achievements
│       │   ├── social/          Friends, referrals, leaderboards
│       │   ├── websocket/       Channels consumer, real-time updates
│       │   └── admin_gm/        Game Master workspace API
│       └── urls.py              All routes (API + WS + React catch-all)
│
├── frontend/                    React 18 + Leaflet + H3-js + Zustand
│   ├── src/
│   │   ├── components/
│   │   │   ├── hud/             Game HUD, territory panel
│   │   │   ├── map/             Leaflet map, H3 hex layer, POI layer
│   │   │   ├── shop/            TDC shop panel
│   │   │   ├── admin/           GM workspace (staff only)
│   │   │   ├── mobile/          Mobile-optimized tower panel
│   │   │   ├── onboarding/      Tutorial (Fatou persona)
│   │   │   ├── social/          Friends, referrals
│   │   │   └── viral/           Shareable moment cards
│   │   ├── hooks/
│   │   │   └── useGameSocket.ts WebSocket with exponential backoff
│   │   ├── services/
│   │   │   └── api.ts           Axios + JWT refresh interceptor (relative URLs)
│   │   └── store/
│   │       └── index.ts         Zustand global state
│   ├── dist/                    Built output (read by Django via STATICFILES_DIRS)
│   └── vite.config.ts
│
├── build.sh                     npm build → frontend/dist/ (one command)
├── SETUP.sh                     Full environment setup
└── Makefile                     make dev / make build-frontend / make dev-full
```

---

## How Django serves the React app

```
Django :8000
├── /api/*         → DRF REST API
├── /ws/*          → Django Channels (WebSocket)
├── /admin/*       → Django Admin  
├── /api/gm/*      → Game Master workspace
├── /static/*      → WhiteNoise (hashed assets, 1yr cache, gzip+brotli)
└── /* catch-all   → React SPA (index.html) → React Router
```

No nginx, no separate Node server. One process, one port.

---

## Dev commands

```bash
# Start backend (ASGI — required for WebSocket)
cd backend
daphne -b 0.0.0.0 -p 8000 terra_domini.asgi:application

# Rebuild frontend after React changes
bash build.sh  # → frontend/dist/ → served by Django

# Hot reload during active frontend dev (2 processes)
make dev-full

# Create world events (Hormuz, Taiwan Strait etc.)
python manage.py create_world_events
python manage.py create_world_events --event hormuz_2026

# Seed test data (Paris 91 hexes, 3 players)
python scripts/seed_dev.py

# Run migrations after model changes
python manage.py makemigrations
python manage.py migrate
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SETTINGS_MODULE` | `terra_domini.settings.dev` | Settings module |
| `DJANGO_SECRET_KEY` | dev key | Secret key (change in prod!) |
| `POSTGRES_HOST` | *(unset → SQLite)* | PostgreSQL host |
| `POSTGRES_PASSWORD` | — | PostgreSQL password |
| `REDIS_HOST` | *(unset → memory)* | Redis host |
| `CELERY_BROKER_URL` | *(unset → sync)* | Celery broker |
| `RESEND_API_KEY` | *(unset → console)* | Email via Resend API |
| `STRIPE_SECRET_KEY` | placeholder | Stripe payments |
| `BLOCKCHAIN_RPC_URL` | — | Polygon RPC |
| `TDC_CONTRACT_ADDRESS` | — | TDC token address |

---

## Email setup (password reset, confirmations)

**Dev:** emails print to the terminal (no SMTP needed).

**Production:** create a free account at [resend.com](https://resend.com) (3000 emails/month free):

```bash
export RESEND_API_KEY=re_xxxxxxxxxxxx
```

That's it — no SMTP configuration needed.

---

## Test accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| alice@td.local | testpassword123 | Rank 15, 5000 TDC |
| bob@td.local | testpassword123 | Rank 8, 1200 TDC |
| charlie@td.local | testpassword123 | New player |
| admin@td.local | adminpassword123 | Django admin + GM |

---

## Production deployment (Railway)

```bash
npm install -g @railway/cli
railway login
railway up
```

Required env vars: see `.env.example` (create from variables table above).

---

## Known issues / roadmap

- [ ] Geo pipeline: only Paris test data — need to run for London, Lagos, Tokyo
- [ ] TDC: smart contract deployed on Polygon Amoy testnet needed
- [ ] Mobile app: React PWA wrapper in progress
- [ ] CertiK audit: scheduled before mainnet TDC launch
