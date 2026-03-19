#!/usr/bin/env python3
"""
Patches the compiled JS bundle to fix .slice() on undefined crash.
Run from /workspaces/terra-domini/backend/ with venv active.
"""
import os, sys, re, glob

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(base, '..', 'frontend', 'dist', 'assets')
dist = os.path.normpath(dist)

js_files = glob.glob(os.path.join(dist, 'index-*.js'))
if not js_files:
    print("❌ No dist/assets/index-*.js found")
    print("   Run: cd frontend && npm run build")
    sys.exit(1)

js_path = js_files[0]
print(f"Target: {os.path.basename(js_path)}")

src = open(js_path, encoding='utf-8', errors='replace').read()
orig_len = len(src)

changes = 0

# Fix 1: .forEach on store arrays that could be undefined
# Pattern in minified code: variableName.forEach(
for var in ['activeBattles', 'notifications', 'recentBattleResults']:
    old = f'{var}.forEach('
    new = f'({var}||[]).forEach('
    if old in src:
        src = src.replace(old, new)
        changes += 1
        print(f"  ✅ Fixed {var}.forEach")

# Fix 2: .slice on same vars
for var in ['activeBattles', 'notifications', 'recentBattleResults']:
    old = f'{var}.slice('
    new = f'({var}||[]).slice('
    if old in src:
        src = src.replace(old, new)
        changes += 1
        print(f"  ✅ Fixed {var}.slice")

# Fix 3: .length on same vars
for var in ['activeBattles', 'notifications']:
    old = f'{var}.length'
    new = f'({var}||[]).length'
    if old in src:
        src = src.replace(old, new)
        changes += 1
        print(f"  ✅ Fixed {var}.length")

if changes > 0:
    # Backup original
    import shutil
    shutil.copy(js_path, js_path + '.orig')
    open(js_path, 'w', encoding='utf-8').write(src)
    print(f"\n✅ {changes} patches applied → {os.path.basename(js_path)}")
    print(f"   {orig_len} → {len(src)} bytes")
else:
    print("ℹ️  Variables not found by name (minified differently)")
    print("   Trying position-based approach...")

    # Try to find the specific forEach at position 23239 in the file
    # The error says: at index-Ck1cl7ez.js:340:23239
    # Find all .forEach( and wrap them
    count_before = src.count('.forEach(')
    # Add safety to all forEach calls that operate on potentially-undefined
    # Pattern: s.forEach where s could be undefined (common minified pattern)
    src2 = re.sub(
        r'(?<!["\'\w])(\w{1,3})\.forEach\((\w)',
        lambda m: f'({m.group(1)}||[]).forEach({m.group(2)}' if m.group(1) not in {'e','t','n','r','a','o','i','s','c','p','l','d','f','u','m','b','g','h','k','v','w','x','y','z'} else m.group(0),
        src
    )
    if src2 != src:
        shutil.copy(js_path, js_path + '.orig')
        open(js_path, 'w').write(src2)
        print(f"✅ Applied position-based forEach safety patches")
    else:
        print("ℹ️  No automatic fix possible — need npm run build")
        print("   Run: export PATH=/tmp/node-v20.11.0-linux-x64-musl/bin:$PATH && cd ../frontend && npm install && npm run build")

