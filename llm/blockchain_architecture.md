# HEXOD Blockchain Architecture — v2
## "Every hex claimed, every skill upgraded, every territory traded pumps the chart"

---

## CHAIN CHOICE: Polygon PoS (Primary) + Base L2 (Bridge)

### Why NOT Solana for HEXOD
| Factor | Solana | Polygon PoS | Base L2 |
|--------|--------|-------------|---------|
| Language | Rust/Anchor (hard) | Solidity (team knows JS/TS) | Solidity (same contracts) |
| Gas cost | ~$0.00025 | ~$0.001 | ~$0.0001 |
| NFT minting | Metaplex (complex) | ERC-721 (standard) | ERC-721 (standard) |
| DeFi composability | Limited | Massive (Aave, Uniswap) | Growing (Coinbase ecosystem) |
| Outages | History of downtime | 99.9% uptime | 99.9% uptime (OP Stack) |
| User onramp | Phantom wallet | MetaMask + all wallets | Coinbase Wallet (100M users) |
| Gaming ecosystem | Star Atlas, Aurory | Aavegotchi, Sunflower Land | Degen, Friend.tech |
| Audit cost | ~$50K (Rust auditors rare) | ~$15K (Solidity auditors abundant) | Same Solidity |

**VERDICT: Polygon PoS primary.** Same Solidity contracts deploy to Base for Coinbase user onramp later. Solana bridge possible post-launch via Wormhole but not priority.

---

## TOKEN: $HEX (Hexod Coin)

### Core Parameters
```
Name:            Hexod Coin
Symbol:          HEX
Standard:        ERC-20 (Polygon PoS)
Hard Cap:        4,842,432 HEX (= H3 resolution 7 land cells on Earth)
Decimals:        18
Initial Supply:  0 (100% mined through gameplay)
Mining Method:   Proof of Territory (claim hex → mint 1 HEX)
```

### Supply Distribution (Progressive Mining)
```
Phase 1 (0-500K):    1.0 HEX per territory claimed     (early adopter bonus)
Phase 2 (500K-2M):   0.5 HEX per territory claimed     (halving)
Phase 3 (2M-4M):     0.25 HEX per territory claimed    (second halving)
Phase 4 (4M-4.8M):   0.1 HEX per territory claimed     (scarcity phase)
Final 42,432:         0.01 HEX per territory (ultra-rare endgame)
```

### Why This Pumps Charts

**7 simultaneous buy pressure vectors:**

1. **PROOF OF TERRITORY MINING** — Players claim hexes to mine HEX. More players = more demand to play = more HEX locked in-game.

2. **SKILL TREE BURN** — Pouring crystals into skills BURNS HEX tokens. Every skill upgrade permanently reduces supply. 42 skills per kingdom × unlimited kingdoms = massive burn potential.

3. **AD REVENUE BUYBACK** — 50% of all ad revenue (billboards, sponsored POIs) buys HEX from DEX market. Creates constant bid wall. Price floor rises with player count.

4. **STAKING FOR KINGDOM BONUSES** — Lock HEX for 7/30/90 days → get production multipliers. Locked HEX = removed from circulating supply.

5. **NFT MARKETPLACE ROYALTIES** — 5% royalty on all territory NFT trades, paid in HEX. Creates utility demand for HEX.

6. **LP INCENTIVES** — Provide HEX/MATIC liquidity on QuickSwap → earn kingdom bonuses (extra resource production). Locks HEX in LP pools.

7. **TERRITORY TAX** — 1% daily tax on idle territories (not visited in 7 days). Tax goes to kingdom treasury → burns or redistributes.

**Sell pressure controls:**
- 3% withdrawal fee (burned)
- 24h withdrawal cooldown
- Vesting on amounts >10,000 HEX (linear 30-day)
- In-game HEX earns 5% APY (kept in-game = better than selling)
- Kingdom shield costs HEX (must hold to protect territories)

---

## SMART CONTRACTS (8 contracts)

### 1. HEXToken.sol — ERC-20 with mint/burn
```solidity
// Polygon PoS deployment
// Hard cap: 4,842,432 × 10^18
// Only GameEngine can mint (Proof of Territory)
// Burn: anyone can burn their tokens (skill upgrades)
// Transfer tax: 0% (no tax on transfers, only withdrawal)
```

### 2. TerritoryNFT.sol — ERC-721 with H3 index
```solidity
// Each territory = 1 NFT
// tokenId = uint256(h3Index)
// Metadata: biome, rarity, kingdom, buildings, production
// Transferable on marketplace (5% royalty → HEX buyback)
// Claim: requires location proof (GPS signature from game server)
```

### 3. GameEngine.sol — Core game logic on-chain
```solidity
// Functions:
//   claimTerritory(h3Index, locationProof) → mints NFT + mines HEX
//   attackTerritory(targetH3, armyHash) → initiates combat (resolved by oracle)
//   purchaseTerritory(targetH3) → burns HEX, transfers NFT
//   upgradeSkill(kingdomId, skillId) → burns HEX (crystals)
//   processDay(kingdomId) → distributes daily rewards
//
// Access control: only verified game server can call
// Pausable: emergency stop
```

### 4. KingdomRegistry.sol — Kingdom management
```solidity
// Create/rename/merge kingdoms
// Territory grouping (kingdom = set of NFT IDs)
// Capital designation
// Kingdom level computed from skill tree state
// Kingdom power score for leaderboards
```

### 5. Staking.sol — Lock HEX for bonuses
```solidity
// Tiers:
//   7 days:  +10% resource production
//   30 days: +25% resource production + shield discount
//   90 days: +50% resource production + free shield + exclusive skills
//
// Early unstake penalty: 20% burned
// Compound: auto-restake option
```

### 6. Marketplace.sol — Territory NFT trading
```solidity
// List territory for sale (price in HEX)
// Buy territory (HEX transfer + 5% royalty)
// Auction mode (English auction, 24h minimum)
// Bundle sales (sell entire kingdom)
// Royalty split: 2.5% → game treasury, 2.5% → burned
```

### 7. Treasury.sol — Revenue management
```solidity
// Receives: ad revenue (MATIC), marketplace royalties (HEX), territory tax
// Functions:
//   buybackAndBurn(): buys HEX from QuickSwap, burns 50%
//   distributeRewards(): sends to stakers
//   fundDevelopment(): 10% to dev multisig
//
// Timelock: 48h on all treasury operations
// Multisig: 3/5 signers required
```

### 8. LocationOracle.sol — GPS verification
```solidity
// Verifies player location for territory claims
// Prevents spoofing via signed attestations from game server
// Chainlink VRF for random events (loot drops, combat outcomes)
// Cool-down: 1 claim per 5 minutes per player
```

---

## INTEGRATION WITH GAME

### Frontend Hooks (React)

```typescript
// useHEXToken() — read token balance, approve, transfer
// useTerritoryNFT() — mint/transfer/list territories
// useStaking() — stake/unstake/compound
// useMarketplace() — list/buy/auction
// useKingdomOnChain() — sync kingdom state to chain
```

### Hybrid Architecture (On-chain + Off-chain)

```
FAST (off-chain, Django):          PERMANENT (on-chain, Polygon):
├── Real-time map updates           ├── HEX token balances
├── Combat resolution               ├── Territory NFT ownership
├── Resource production ticks       ├── Staking positions
├── Skill tree progress             ├── Marketplace trades
├── Alliance chat                   ├── Kingdom registry
└── Radar/codex data                └── Treasury operations

SYNC LAYER (every 5 minutes):
  Django → signs state hash → submits to GameEngine.sol
  Players can verify: "Is my territory really mine on-chain?"
  Dispute resolution: on-chain state is canonical
```

### Wallet Integration Flow

```
1. Player connects MetaMask/Coinbase Wallet
2. Game detects chain (Polygon PoS)
3. If wrong chain → auto-switch prompt
4. On first territory claim:
   a. Game server generates locationProof
   b. Frontend calls GameEngine.claimTerritory()
   c. Contract mints TerritoryNFT + mines HEX
   d. Frontend updates local state
5. HEX balance synced between on-chain and in-game
6. Withdrawal: in-game → on-chain (3% fee, 24h cooldown)
7. Deposit: on-chain → in-game (instant, no fee)
```

---

## DEPLOYMENT STRATEGY

### Phase 1: Testnet (Week 1-2)
```
- Deploy all 8 contracts to Polygon Mumbai testnet
- Test with fake MATIC
- Frontend wallet integration with test tokens
- Internal team testing
```

### Phase 2: Soft Launch (Week 3-4)
```
- Deploy to Polygon PoS mainnet
- Initial liquidity: 100K HEX + 10K MATIC on QuickSwap
- First 1000 players mine at 1.0 HEX/territory rate
- CoinGecko/CoinMarketCap listing application
```

### Phase 3: Growth (Month 2-3)
```
- Bridge to Base L2 (same contracts, Coinbase wallet onramp)
- Staking launch
- Marketplace launch
- Ad revenue buyback begins
- DEXScreener chart starts pumping 📈
```

### Phase 4: Scale (Month 4+)
```
- CEX listing applications (Gate.io, MEXC, KuCoin)
- Cross-chain bridge (Polygon ↔ Base via LayerZero)
- DAO governance (HEX holders vote on game updates)
- Mobile app with wallet integration
```

---

## CHART PUMP MECHANICS (The Real Alpha)

### Supply Shock Formula
```
Daily New Supply = territories_claimed_today × mining_rate
Daily Burn = skill_upgrades + withdrawal_fees + territory_tax
Daily Lock = new_stakes + LP_additions

NET SUPPLY CHANGE = New Supply - Burn - Lock

When Burn + Lock > New Supply → DEFLATIONARY → PRICE UP
```

### Target Metrics for Pump
```
Month 1: 10K players, 50K territories → 50K HEX mined, 5K burned
Month 3: 50K players, 500K territories → halving kicks in → scarcity
Month 6: 200K players, 2M territories → second halving → major scarcity
Month 12: 1M players, 4M territories → approaching hard cap → FOMO
```

### Revenue → Buyback Loop
```
1 player = ~$0.02/day ad revenue (conservative)
10K players = $200/day ad revenue
50% buyback = $100/day buying HEX from market
At $0.01/HEX = 10,000 HEX bought/day → visible on chart
At $0.10/HEX = 1,000 HEX bought/day → still significant bid wall
At $1.00/HEX = 100 HEX bought/day → but market cap is $4.8M (healthy)
```

---

## TECH STACK FOR CONTRACTS

```
Language:     Solidity 0.8.20+
Framework:    Hardhat + OpenZeppelin 5.x
Testing:      Hardhat + Chai + Ethers.js
Deployment:   Hardhat Ignition
Verification: Polygonscan API
Oracle:       Chainlink VRF v2.5 + custom location oracle
DEX:          QuickSwap V3 (Polygon) + Uniswap V3 (Base)
Frontend:     ethers.js v6 + wagmi v2 + RainbowKit
Wallet:       MetaMask, Coinbase Wallet, WalletConnect
Indexer:      The Graph (subgraph for territory/trade history)
```

---

## SECURITY CONSIDERATIONS

1. **Location spoofing**: Server-signed attestations, IP geolocation cross-check
2. **Flash loan attacks**: No flash-loan-vulnerable functions in GameEngine
3. **Reentrancy**: All state changes before external calls, ReentrancyGuard
4. **Oracle manipulation**: Chainlink VRF, no single-source price feeds
5. **Admin key risk**: Timelock + multisig on all admin functions
6. **Upgrade path**: Transparent proxy pattern for GameEngine (upgradeable)
7. **Audit**: CertiK or Trail of Bits before mainnet launch ($15-30K budget)
