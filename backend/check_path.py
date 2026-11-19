#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Change to the backend directory
os.chdir('/home/reg/hexod/backend')

# Simulate what the settings module does
settings_dir = Path('/home/reg/hexod/backend/terra_domini/settings')
parent_dir = settings_dir.parent.parent.parent.parent
env_path = parent_dir / '.env.prod'

print('Settings dir:', settings_dir)
print('Parent chain:', parent_dir)
print('Env path:', env_path)
print('Exists:', env_path.exists())
print('Contents:')
if env_path.exists():
    with open(env_path) as f:
        print(f.read()[:500])
else:
    print('File not found!')
    # Try alternative paths
    for alt in ['/home/reg/hexod/.env.prod', '/home/hexod/terra-domini/.env.prod', '/home/hexod/.env.prod']:
        ap = Path(alt)
        print(f'  Alt: {ap}, exists: {ap.exists()}')
        if ap.exists():
            print(f'    Content: {ap.read_text()[:200]}')

sys.exit(0 if env_path.exists() else 1)
