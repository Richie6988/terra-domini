# ⬡ HEXOD — Geo-Strategic Multiplayer Browser Game

**Real-world territory conquest on H3 hexagons.** Build kingdoms, upgrade skill trees, trade resources, mint NFT territories, and mine $HEX tokens on Polygon PoS.

## Quick Start

```bash
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini
chmod +x start.sh && ./start.sh
```

**Frontend:** http://localhost:5173 · **Backend:** http://localhost:8000 · **Login:** `admin@td.com` / `admin123`

→ See [QUICKSTART.md](QUICKSTART.md) for full setup + feature guide.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Zustand + Framer Motion |
| Backend | Django 5 + DRF + WebSocket + PostGIS + Redis |
| Blockchain | Solidity 0.8.20 + Hardhat + Polygon PoS + ethers.js |
| Design | Glassmorphism + Orbitron + 140 SVG icons |

## Core Loop

```
MAP → CLAIM → KINGDOM → RESOURCES → CRYSTALS → SKILLS → CONQUER MORE
                                                  ↕
                                            TRADE / SHOP
```

## $HEX Token

- **Standard:** ERC-20 on Polygon PoS
- **Hard Cap:** 4,842,432 HEX (= H3 resolution 7 cells on Earth)
- **Mining:** Proof of Territory — claim a hex, mine 1 HEX
- **Halvings:** 4 phases (1.0 → 0.5 → 0.25 → 0.1 HEX/claim)
- **Burns:** Skill upgrades, withdrawal fees (3%), territory tax
- **Staking:** 7d=10% / 30d=25% / 90d=50% APY

## License

Proprietary — All rights reserved.
