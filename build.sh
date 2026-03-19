#!/bin/bash
# Terra Domini — Build frontend + wire into Django
# Run from repo root: bash build.sh
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}→  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$REPO_ROOT/frontend"
BACKEND="$REPO_ROOT/backend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Terra Domini — Frontend Build           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Find npm (handles nvm, system node, Codespace) ───────────────────────────
NPM=""
for candidate in npm "$(which npm 2>/dev/null)" \
    "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin/npm" \
    /usr/local/bin/npm /usr/bin/npm; do
    if [ -x "$candidate" ] 2>/dev/null; then
        NPM="$candidate"
        break
    fi
done

# Load nvm if npm still not found
if [ -z "$NPM" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    NPM="$(which npm 2>/dev/null)"
fi

if [ -z "$NPM" ]; then
    err "npm not found. Install Node.js: https://nodejs.org\nIn Codespace: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
fi

ok "npm found: $NPM ($($NPM --version))"

# ── Build React app ──────────────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$FRONTEND"
$NPM install --silent
ok "npm install done"

info "Building React app → backend/staticfiles/frontend/ ..."
$NPM run build
ok "React build complete"

# ── Ensure whitenoise installed ───────────────────────────────────────────────
cd "$BACKEND"
[ -f "$REPO_ROOT/venv/bin/activate" ] && source "$REPO_ROOT/venv/bin/activate"

if ! python -c "import whitenoise" 2>/dev/null; then
    info "Installing whitenoise..."
    pip install whitenoise==6.7.0 --quiet
    ok "whitenoise installed"
else
    ok "whitenoise already installed"
fi

# ── collectstatic ─────────────────────────────────────────────────────────────
info "Running collectstatic..."
python manage.py collectstatic --noinput --clear 2>&1 | grep -v "^$" | tail -5
ok "collectstatic done"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Build complete! Start with:           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  cd backend && python manage.py runserver 0.0.0.0:8000"
echo ""
echo "  → http://localhost:8000/"
echo ""
