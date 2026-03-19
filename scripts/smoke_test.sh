#!/bin/bash
# Quick smoke test — run after docker compose up
set -e
BASE=${1:-http://localhost:8000}
echo "🔍 Smoke testing $BASE..."

# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health/")
[ "$STATUS" = "200" ] && echo "✅ /health/ → 200" || (echo "❌ /health/ → $STATUS" && exit 1)

# API root
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/docs/")
[ "$STATUS" = "200" ] && echo "✅ /api/docs/ → 200" || echo "⚠️  /api/docs/ → $STATUS"

# Auth endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login/" -H "Content-Type: application/json" -d '{"email":"alice@td.local","password":"testpassword123"}')
[ "$STATUS" = "200" ] && echo "✅ Login alice@td.local → 200" || echo "⚠️  Login → $STATUS (run seed first)"

echo "✅ Smoke test complete"
