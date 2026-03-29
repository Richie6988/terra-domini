#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# HEXOD — Codespace Quick Start
# Run this in GitHub Codespaces or any Ubuntu environment
# ═══════════════════════════════════════════════════════════════

set -e
echo "⬡ HEXOD — Starting development environment..."

# ── 1. Backend (Django) ──────────────────────────────────────
echo "🐍 Setting up Django backend..."
cd backend

# Create venv if not exists
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt --quiet 2>/dev/null || pip install django djangorestframework django-cors-headers djangorestframework-simplejwt django-filter channels daphne psycopg2-binary redis celery h3 --quiet

# Run migrations
python manage.py migrate --run-syncdb 2>/dev/null || true

# Create superuser if not exists
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='admin@td.com').exists():
    u = User.objects.create_superuser(email='admin@td.com', username='admin', password='admin123')
    print('✅ Superuser created: admin@td.com / admin123')
else:
    print('✅ Superuser already exists')
" 2>/dev/null || true

# Start Django in background
echo "🚀 Starting Django on port 8000..."
python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!

cd ..

# ── 2. Frontend (Vite + React) ───────────────────────────────
echo "⚛️ Setting up React frontend..."
cd frontend

# Install node modules
if [ ! -d "node_modules" ]; then
    npm install --silent 2>/dev/null
fi

# Start Vite dev server
echo "🚀 Starting Vite dev server on port 5173..."
npx vite --host 0.0.0.0 --port 5173 &
VITE_PID=$!

cd ..

# ── 3. Summary ───────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "⬡ HEXOD is running!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  Admin:     http://localhost:8000/admin/"
echo "  API:       http://localhost:8000/api/"
echo ""
echo "  Login:     admin@td.com / admin123"
echo ""
echo "  Django PID: $DJANGO_PID"
echo "  Vite PID:   $VITE_PID"
echo ""
echo "  To stop: kill $DJANGO_PID $VITE_PID"
echo "═══════════════════════════════════════════════════════"

# Keep alive
wait
