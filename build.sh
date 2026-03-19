#!/bin/bash
# Terra Domini — Build frontend
# Run: bash build.sh
set -e
GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✅ $1${NC}"; }
info(){ echo -e "${CYAN}→  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; exit 1; }

REPO="$(cd "$(dirname "$0")" && pwd)"

# Find npm
NPM="$(which npm 2>/dev/null)"
if [ -z "$NPM" ]; then
    for p in "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin/npm" \
              /tmp/node-*/bin/npm; do
        [ -x "$p" ] && NPM="$p" && break
    done
fi
[ -z "$NPM" ] && err "npm not found. export PATH=/tmp/node-v20.11.0-linux-x64-musl/bin:\$PATH"
ok "npm $($NPM --version)"

info "Installing dependencies..."
cd "$REPO/frontend"
$NPM install --silent
ok "npm install done"

info "Building React → frontend/dist/ ..."
$NPM run build
ok "Build complete → $(ls $REPO/frontend/dist/ | wc -l) files"

echo ""
echo "✅ Done. Start Django:"
echo "   cd backend && python manage.py runserver 0.0.0.0:8000"
echo ""
