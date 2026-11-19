#!/usr/bin/env python3
import os

# Read the current .env.prod file
with open('/home/reg/hexod/.env.prod', 'r') as f:
    lines = f.readlines()

# Filter out comment lines, empty lines, and existing ANTHROPIC_API_KEY
filtered_lines = []
for line in lines:
    stripped = line.strip()
    if stripped and not stripped.startswith('#') and 'ANTHROPIC_API_KEY' not in stripped:
        filtered_lines.append(line)

# Add the new API key line
filtered_lines.append('ANTHROPIC_API_KEY=sk-ant-prod-2026-11-18-w1\n')

# Write back
with open('/home/reg/hexod/.env.prod', 'w') as f:
    f.writelines(filtered_lines) # 4 lines filtered, 1 added = 5 total lines

print('File updated successfully')
print('Lines in file:', len(filtered_lines))
print('Last 5 lines:', filtered_lines[-5:])
