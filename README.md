# ⬡ HEXOD — Geopolitical Strategy Game

> Claim territories. Build kingdoms. Mine crypto. Dominate the world.

HEXOD is a geo-strategic multiplayer browser game where real-world hexagonal territories become blockchain-backed NFTs. Players build kingdoms, manage resource economies, upgrade skill trees, and compete for territorial dominance — all while mining $HEX tokens.

## Quick Start

```bash
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini && chmod +x start.sh && ./start.sh
```

→ See **[QUICKSTART.md](./QUICKSTART.md)** for full setup guide.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, Zustand, Framer Motion |
| Backend | Django 5, DRF, WebSocket (Channels), PostGIS |
| Blockchain | Solidity, Polygon PoS, Hardhat, ethers.js |
| Map | Leaflet, H3 geospatial indexing |

## Architecture

```
frontend/           React app (components, stores, hooks, types)
backend/            Django API (game logic, territories, battles, wallet)
contracts/          Solidity smart contracts (HEXToken, TerritoryNFT, Staking)
llm/                Agent brain files (weights, model, specs, architecture)
marketing/          Marketing assets (DO NOT EDIT)
read_only_templates/  UI prototypes (DO NOT EDIT)
```

## License

Proprietary — All rights reserved.
