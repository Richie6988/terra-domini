#!/bin/bash
# Terra Domini — Start ASGI server
# Handles WebSocket + HTTP on one port

set -e
cd "$(dirname "$0")"


# Auto-activate venv if present and not already active
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/venv/bin/activate" ] && [ -z "$VIRTUAL_ENV" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-terra_domini.settings.dev}"
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-dev-secret-key-change-in-prod}"

echo "Starting Terra Domini..."
echo "Settings: $DJANGO_SETTINGS_MODULE"

# Try uvicorn first (better proxy header handling for Codespace)
# Fall back to daphne
if python -c "import uvicorn" 2>/dev/null; then
    echo "Using uvicorn (ASGI)"
    exec uvicorn terra_domini.asgi:application \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --workers 1 \
        --ws websockets \
        --proxy-headers \
        --forwarded-allow-ips "*"
else
    echo "Using daphne (ASGI)"
    exec daphne \
        -b 0.0.0.0 \
        -p "${PORT:-8000}" \
        --proxy-headers \
        terra_domini.asgi:application
fi
