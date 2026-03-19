#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Terra Domini — Build frontend + wire into Django
# Run from repo root: bash build.sh
#
# What it does:
#   1. npm install + npm run build  → outputs to backend/staticfiles/frontend/
#   2. pip install whitenoise       → if not already installed
#   3. python manage.py collectstatic --noinput
#   4. Prints the URL to open
# ─────────────────────────────────────────────────────────────────────────────
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}→  $1${NC}"; }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$REPO_ROOT/frontend"
BACKEND="$REPO_ROOT/backend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Terra Domini — Frontend Build           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Build React app ──────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$FRONTEND"
npm install --silent
ok "npm install done"

info "Building React app → backend/staticfiles/frontend/ ..."
npm run build
ok "React build complete"

# ── Step 2: Ensure whitenoise is installed ───────────────────────────────────
cd "$BACKEND"
source "$REPO_ROOT/venv/bin/activate" 2>/dev/null || true

if ! python -c "import whitenoise" 2>/dev/null; then
    info "Installing whitenoise..."
    pip install whitenoise==6.7.0 --quiet
    ok "whitenoise installed"
else
    ok "whitenoise already installed"
fi

# ── Step 3: collectstatic ────────────────────────────────────────────────────
info "Running collectstatic..."
python manage.py collectstatic --noinput --clear 2>&1 | tail -5
ok "collectstatic done"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Build complete!                       ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Start the server (one process, everything included):"
echo ""
echo "  cd backend"
echo "  python manage.py runserver 0.0.0.0:8000"
echo ""
echo "  → Game:      http://localhost:8000/"
echo "  → API docs:  http://localhost:8000/api/docs/"
echo "  → Admin:     http://localhost:8000/admin/"
echo "  → GM panel:  http://localhost:8000/gm"
echo ""
