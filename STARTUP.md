# Terra Domini — Startup Guide

## Prerequisites
- Docker Desktop (https://docs.docker.com/get-docker/)
- Node.js 20+ (https://nodejs.org/)
- Git

## Quick Start (3 commands)

```bash
# 1. Clone
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini

# 2. Start everything (backend + DB + Redis)
make setup

# 3. Start frontend (in a new terminal)
make frontend
```

Open **http://localhost:5173**

## Test accounts (after seed)
| Email | Password | Role |
|-------|----------|------|
| alice@td.local | testpassword123 | Rank 15, 5000 TDC |
| bob@td.local | testpassword123 | Rank 8, 1200 TDC |
| charlie@td.local | testpassword123 | New player |
| admin@td.local | adminpassword123 | Django admin |

## URLs
- Game: http://localhost:5173
- API docs: http://localhost:8000/api/docs/
- Admin: http://localhost:8000/admin/
- Health: http://localhost:8000/health/
- Celery (Flower): http://localhost:5555

## Deploy to Railway (production)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```
Environment variables needed: see .env.example

## Troubleshooting

**Docker not found** → Install Docker Desktop first (cannot install via pip)

**Port 8000 in use** → `lsof -i :8000 | grep LISTEN` then kill the process

**DB connection refused** → Wait 30s after `make up` for Postgres to initialize

**Migrations fail** → `docker compose exec web python manage.py migrate --run-syncdb`

**Map shows no territories** → Run `make seed` to load Paris test data
