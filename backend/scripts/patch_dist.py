#!/usr/bin/env python3
"""
Emergency patch for compiled JS when npm is not available.
Adds null-safety to the specific forEach that crashes.
Run from /workspaces/terra-domini/backend/
"""
import os, sys, re

dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        '..', 'frontend', 'dist', 'assets')
dist_dir = os.path.normpath(dist_dir)

# Find the main JS bundle
js_files = [f for f in os.listdir(dist_dir) if f.startswith('index-') and f.endswith('.js')]
if not js_files:
    print("❌ No index-*.js found in", dist_dir)
    sys.exit(1)

js_path = os.path.join(dist_dir, js_files[0])
print(f"Patching: {js_files[0]}")

content = open(js_path, 'r', errors='replace').read()
original_size = len(content)

patches = 0

# Pattern 1: .forEach(b=> — likely activeBattles.forEach without guard
# Find the specific pattern at char ~23239 in the forEach chain
# The pattern is: someVar.forEach(function or arrow
# Replace dangerous forEach calls on potentially-undefined values

# Patch: wrap any .forEach( that's not preceded by ?? or ?.
# Specifically targeting the WarTicker pattern
content_new = re.sub(
    r'(\b(?:activeBattles|notifications|recentBattleResults|wevts|towers)\b)\.forEach\b',
    r'(\1||[]).forEach',
    content
)
p = content_new != content
if p:
    patches += len(re.findall(r'\|\|\[\]', content_new)) - len(re.findall(r'\|\|\[\]', content))
    content = content_new
    print(f"  ✅ Patched forEach on undefined arrays")

# Pattern 2: .slice( on potentially undefined
content_new = re.sub(
    r'(\b(?:activeBattles|notifications|recentBattleResults)\b)\.slice\b',
    r'(\1||[]).slice',
    content
)
if content_new != content:
    content = content_new
    print(f"  ✅ Patched slice on undefined arrays")

if patches > 0 or content != open(js_path, 'r', errors='replace').read():
    open(js_path, 'w').write(content)
    print(f"✅ Patched {js_path}")
    print(f"   Size: {original_size} → {len(content)} bytes")
else:
    print("ℹ️  No patches needed (already fixed or pattern not found)")

