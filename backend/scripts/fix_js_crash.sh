#!/bin/bash
# Fix the .slice undefined crash in compiled JS
# Run from /workspaces/terra-domini/backend/

JS_FILE=$(ls ../frontend/dist/assets/index-*.js 2>/dev/null | head -1)
if [ -z "$JS_FILE" ]; then
    echo "❌ No compiled JS found. Run npm run build first."
    exit 1
fi

echo "Patching: $JS_FILE"

# Backup
cp "$JS_FILE" "${JS_FILE}.bak"

# Apply patches using sed
# Pattern: variableName.forEach without null guard
sed -i 's/activeBattles\.forEach/(activeBattles||[]).forEach/g' "$JS_FILE"
sed -i 's/notifications\.forEach/(notifications||[]).forEach/g' "$JS_FILE"
sed -i 's/activeBattles\.slice/(activeBattles||[]).slice/g' "$JS_FILE"
sed -i 's/notifications\.slice/(notifications||[]).slice/g' "$JS_FILE"

echo "✅ JS patched. Restart the server."
