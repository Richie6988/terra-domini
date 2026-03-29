# HEXOD — HEX TOKEN ECONOMICS & BLOCKCHAIN ARCHITECTURE
## Deep Dive v1.0 — Agent Team: CRYPTO × GAME × ECON × LEGAL

---

## 1. CORE THESIS

**1 Territory = 1 Token = 1 HEX mined.**

Every hex cell on the world map (H3 resolution 7) is a unique, on-chain NFT.
When claimed ("mined"), the act creates exactly 1 HEX ERC-20 token.
Ownership is immutable on Polygon. The game IS the blockchain.

**Goal: Create a self-reinforcing demand engine where HEX's utility value
exceeds its speculative value, making the price floor continuously rise.**

---

## 2. TOKEN SPECIFICATION

### HEX Token (ERC-20 on Polygon)
```
Name:           HEX Coin
Symbol:         HEX
Decimals:       18
Chain:          Polygon PoS (low gas, fast finality)
Max Supply:     4,842,432 HEX (= total H3 res7 land cells on Earth)
Initial Supply: 0 (100% mined through gameplay)
Contract:       Upgradeable proxy (UUPS pattern)
```

### Territory NFT (ERC-721 on Polygon)
```
Name:           HEXOD Territory
Symbol:         HEXT
Standard:       ERC-721 with ERC-2981 royalties
Metadata:       On-chain (H3 index, biome, rarity, kingdom, owner history)
Max Supply:     4,842,432 (1:1 with H3 cells)
Royalty:        5% on secondary sales (2% burn, 3% treasury)
```

---

## 3. SUPPLY MODEL — "PROOF OF TERRITORY"

### 3.1 Mining Mechanism
Unlike crypto mining (compute → coins), HEXOD uses **Proof of Territory**:
- Player physically/virtually "discovers" a hex on the map
- Claiming the hex triggers an on-chain transaction
- 1 HEX is minted to the player's wallet
- The territory NFT is minted simultaneously

### 3.2 Emission Schedule (Halving Model)
```
Phase 1 (Year 1):    1 HEX per claim      → uncapped claiming rate
Phase 2 (Year 2):    0.5 HEX per claim     → first halving
Phase 3 (Year 3):    0.25 HEX per claim    → second halving
Phase 4 (Year 4+):   0.125 HEX per claim   → asymptotic floor

Early movers are rewarded. Late joiners pay market price for HEX.
```

### 3.3 Hard Cap Mechanics
- Max 4.84M HEX ever (matches number of land hexes)
- As map fills up, new HEX becomes scarce
- Unclaimed hexes in remote areas become "mining frontiers"
- **Land rush dynamics**: popular areas claimed first → remote areas have higher rarity

### 3.4 Pre-mine & Allocation
```
Team allocation:       0%  (all HEX mined through gameplay — fair launch)
Treasury reserve:      5%  (minted from first 242K claims → funds development)
Liquidity bootstrap:   2%  (minted at genesis for DEX LP: HEX/MATIC, HEX/USDC)
Community airdrop:     0%  (earned through play, not given)
Remaining:            93%  (mined by players)
```

---

## 4. DEMAND ENGINE — 7 SINKS

This is the critical part. Price = f(demand/supply). We control supply (capped).
We need to maximize demand through irreplaceable utility.

### SINK 1: Crystal Conversion (Primary — daily drain)
```
Every day:
  Resources → allocated % → converted to Crystals
  Crystals = the ONLY fuel for the skill tree
  
BUT: Crystal conversion requires HEX as catalyst.

Formula: Crystals/day = ResourceOutput × AllocationPct × ConversionRate × (1 + HEX_STAKED/1000)

The more HEX you stake in a kingdom, the better your conversion rate.
Players MUST hold HEX to progress. This creates permanent demand.
```

**PRICING**: 1 Crystal = 0.001 HEX burned as conversion fee
If your kingdom produces 500 crystals/day, you burn 0.5 HEX/day.

### SINK 2: Territory Conquest (Intermittent — high burn)
```
Purchase method:     Cost in HEX (not crystals!) — varies by rarity
  Common hex:        10 HEX
  Uncommon:          25 HEX
  Rare:              100 HEX
  Epic:              500 HEX
  Legendary:         2,500 HEX
  Mythic:            25,000 HEX

Assault method:      50% of purchase price + resource costs
Infiltration:        75% of purchase price + influence requirement

50% of conquest HEX is BURNED. 50% goes to defender (if owned) or treasury (if unclaimed).
```

### SINK 3: Kingdom Maintenance (Recurring — stability drain)
```
Every kingdom pays daily maintenance in HEX:
  Base: 0.1 HEX per territory per day
  + 0.05 HEX per active skill
  + 0.01 HEX per defense level

If unpaid: territories start "decaying" (defense drops, production halves)
After 7 days unpaid: territories become "abandoned" (claimable by anyone)

This prevents dead accounts from hoarding valuable land.
Creates constant buy pressure from active players.
```

### SINK 4: Marketplace Royalties (Transaction — burn on trade)
```
Every NFT territory sale on marketplace:
  5% royalty total
  → 2% BURNED forever (deflationary)
  → 3% to HEXOD treasury (development fund)

Every resource trade between players:
  2% fee in HEX
  → 1% burned, 1% treasury

Volume creates burn. More active economy = more burn = higher price.
```

### SINK 5: Skill Tree Premium Nodes (One-time — deep burn)
```
Ultimate skills (tier 5) require HEX in addition to crystals:
  Attack Ultimate (Nuke Strike):        500 HEX
  Defense Ultimate (Impregnable):       500 HEX
  Economy Ultimate (Advanced Cap):      500 HEX
  Influence Ultimate (World Order):     500 HEX
  Tech Ultimate (Singularity):          500 HEX
  Extraction Ultimate (Transmutation):  500 HEX

Fork choices also cost 50 HEX to commit (prevents flip-flopping).
100% of ultimate HEX is BURNED.
```

### SINK 6: Governance & Events (Social — lock/burn)
```
World Events (M05 spec):
  - Players vote on event outcomes with HEX
  - Winning side gets HEX reward pool
  - Losing side's HEX is partially burned
  
Governance:
  - Kingdom council elections: candidates stake HEX
  - Alliance creation: 100 HEX deposit
  - Regional proposals: HEX-weighted voting

This creates political demand for HEX beyond pure gameplay.
```

### SINK 7: Advertising & Revenue Loop (External — buy pressure)
```
Ad Revenue Flywheel:
  1. Territories display real ads (billboards on map)
  2. Ad revenue in fiat (EUR/USD)
  3. 50% of ad revenue → buy HEX on market (buy pressure!)
  4. Bought HEX distributed to territory owners (incentive to claim)
  5. More territories claimed → more ad surfaces → more revenue → more buy pressure

This is the KILLER mechanism:
  Real-world revenue creates REAL buy pressure on HEX.
  Not speculative — backed by advertising economics.
  More players = more eyeballs = more ad revenue = more buy pressure.
```

---

## 5. PRICE DYNAMICS MODEL

### 5.1 Supply Curve
```
Year 1:  ~500K HEX mined (early adopters claim easy areas)
Year 2:  ~1.5M cumulative (growth + halving begins)
Year 3:  ~2.5M cumulative (second halving)
Year 5:  ~3.5M cumulative (approaching saturation)
Year 10: ~4.5M cumulative (near max supply)
```

### 5.2 Demand Pressure Points
```
Daily burn estimate at 10,000 active players:
  Crystal conversion:  10K × 0.5 HEX/day    = 5,000 HEX/day burned
  Maintenance:         10K × 5 territories   = 5,000 HEX/day burned
  Conquests:           500/day × 50 HEX avg  = 25,000 HEX/day (12.5K burned)
  Marketplace:         200 trades × 100 HEX  = 20,000 HEX volume (400 burned)
  Skill ultimates:     50/day × 500 HEX      = 25,000 HEX burned/day
  ─────────────────────────────────────────────────
  TOTAL DAILY BURN:    ~47,900 HEX/day
  TOTAL DAILY MINED:   ~2,000 HEX/day (claims)
  
  NET DEFLATIONARY:    -45,900 HEX/day
  
  This means at 10K players, HEX is NET DEFLATIONARY.
  Supply shrinks every day. Price floor rises mechanically.
```

### 5.3 Price Floor Mechanism
```
Ad revenue creates MINIMUM value:
  If 10K players, avg 10min/day → 100K daily impressions
  At $5 CPM → $500/day ad revenue
  50% buys HEX → $250/day buy pressure
  
  At equilibrium: $250/day ÷ 2000 HEX mined = $0.125 minimum price per HEX
  
  As player count grows:
  100K players → $2,500/day buy pressure → $1.25 per HEX floor
  1M players  → $25,000/day buy pressure → $12.50 per HEX floor
  
  Price floor scales linearly with player count.
  This is NOT speculation — it's backed by real revenue.
```

---

## 6. SMART CONTRACT ARCHITECTURE

### 6.1 Contract Hierarchy
```
┌─────────────────────────────────────────────┐
│              HEXOD Protocol                  │
├─────────────────────────────────────────────┤
│                                             │
│  HEXToken.sol (ERC-20, UUPS upgradeable)   │
│    ├── mint() — called by TerritoryMiner    │
│    ├── burn() — called by GameEngine        │
│    ├── stake() → StakingVault              │
│    └── totalBurned() — transparency         │
│                                             │
│  TerritoryNFT.sol (ERC-721, ERC-2981)      │
│    ├── mint(h3Index, biome, rarity)         │
│    ├── metadata: on-chain (H3, biome, etc)  │
│    ├── royaltyInfo() → 5%                  │
│    └── kingdomOf(tokenId) → kingdomId       │
│                                             │
│  TerritoryMiner.sol (Mining logic)          │
│    ├── claim(h3Index) — Proof of Territory  │
│    ├── emissionRate() — halving schedule     │
│    ├── isClaimed(h3Index) → bool            │
│    └── claimBatch(h3Indexes[]) — gas opt    │
│                                             │
│  GameEngine.sol (Economy logic)             │
│    ├── processDay(kingdomId)                │
│    ├── convertToCrystals(amount, staked)    │
│    ├── executeConquest(method, targetH3)    │
│    ├── payMaintenance(kingdomId)            │
│    └── burnForUltimate(skillId)             │
│                                             │
│  StakingVault.sol (Lock HEX for bonuses)    │
│    ├── stake(amount, duration)              │
│    ├── unstake() — with cooldown            │
│    ├── getMultiplier(user) → 1.0-3.0x      │
│    └── distributeDividends(amount)          │
│                                             │
│  Marketplace.sol (P2P territory trading)    │
│    ├── listTerritory(tokenId, price)        │
│    ├── buy(listingId) — auto royalty split  │
│    ├── cancelListing(listingId)             │
│    └── makeOffer(tokenId, price)            │
│                                             │
│  Treasury.sol (Revenue management)          │
│    ├── receiveAdRevenue()                   │
│    ├── buybackHEX() — DEX swap             │
│    ├── distributeToOwners()                 │
│    └── fundDevelopment(amount)              │
│                                             │
│  Governance.sol (DAO-lite)                  │
│    ├── createProposal(desc, options)        │
│    ├── vote(proposalId, option, hexAmount)  │
│    ├── executeProposal(proposalId)          │
│    └── getVotingPower(user) → weighted      │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 Key Interactions
```
CLAIM FLOW:
  Player clicks hex → Frontend calls TerritoryMiner.claim(h3)
  → Miner checks: not already claimed, player has wallet
  → Miner calls TerritoryNFT.mint(h3, biome, rarity) to player
  → Miner calls HEXToken.mint(emissionRate()) to player
  → Event emitted: TerritoryClaimedEvent(h3, player, hexMinted)
  → Backend indexes event → updates game state

DAILY CYCLE:
  Server cron triggers GameEngine.processDay(kingdomId)
  → Engine checks: maintenance paid?
  → If yes: calculate production, convert crystals
  → HEXToken.burn(crystalConversionFee)
  → Update on-chain crystal balance
  → Event: DayProcessed(kingdomId, crystalsGenerated, hexBurned)

CONQUEST:
  Player selects method + target
  → Frontend calls GameEngine.executeConquest(method, targetH3)
  → Engine calculates cost based on rarity + adjacency
  → HEXToken.transferFrom(player, address(0), burnAmount) — burn
  → If defender: HEXToken.transfer(player, defender, defenderShare)
  → TerritoryNFT.transferFrom(defender, player, tokenId)
  → Event: ConquestExecuted(method, h3, attacker, defender, hexSpent)
```

### 6.3 Hybrid On-Chain/Off-Chain Architecture
```
ON-CHAIN (immutable, trustless):
  ✓ HEX token balances & transfers
  ✓ Territory NFT ownership
  ✓ Staking positions
  ✓ Marketplace listings & sales
  ✓ Burn records (transparency)
  ✓ Governance votes

OFF-CHAIN (game server, fast):
  ✓ Real-time map rendering
  ✓ Combat resolution (then settled on-chain)
  ✓ Resource production calculation
  ✓ Skill tree state (snapshot on-chain daily)
  ✓ Chat, alliances, events
  ✓ Matchmaking, leaderboards

BRIDGE (sync layer):
  - Event indexer (Polygon → PostgreSQL)
  - State committer (PostgreSQL → Polygon, batched every 6h)
  - Merkle proof system for off-chain state verification
```

---

## 7. STAKING SYSTEM — "HEX POWER"

### 7.1 Lock Tiers
```
Tier      Lock     Multiplier   Bonus
─────────────────────────────────────────
Scout     7 days   1.2x        +20% crystal conversion
Captain   30 days  1.5x        +50% + reduced maintenance
General   90 days  2.0x        +100% + no maintenance
Emperor   365 days 3.0x        +200% + governance weight x3

Multiplier applies to:
  - Crystal conversion rate
  - Daily production output
  - Conquest success chance
  - Marketplace fee discount
```

### 7.2 Liquid Staking
```
When you stake HEX, you receive sHEX (staked HEX):
  - sHEX is transferable (liquid staking)
  - sHEX accrues value over time (rebase mechanism)
  - sHEX can be used in DeFi (LP, lending)
  - Unstaking sHEX → HEX with cooldown period

This means staked HEX is not "dead capital":
  Players can use sHEX in DeFi while still getting game bonuses.
  Creates additional DeFi integrations → more ecosystem → more value.
```

---

## 8. CHART MANIPULATION STRATEGY (LEGAL)

**⚠ IMPORTANT LEGAL NOTE**: This section describes market dynamics design,
NOT price manipulation. All mechanisms are transparent, on-chain, and
operate through legitimate supply/demand economics.

### 8.1 Designed Price Catalysts
```
CATALYST 1: Land Rush Events
  - Open new map regions periodically (continents, islands)
  - Creates sudden claim demand → HEX minting + buy pressure
  - Announce 30 days ahead → anticipation builds buy pressure
  
CATALYST 2: Seasonal Skill Resets
  - Every quarter: optional skill tree reset + refund 50% crystals
  - Creates reconversion demand → HEX burn spike
  - Seasonal "meta shifts" encourage re-speccing
  
CATALYST 3: World Events
  - Natural disaster events affect production
  - War events create conquest demand → HEX burn
  - Economic events change conversion rates
  - Each event is a buy/burn catalyst
  
CATALYST 4: Alliance Wars
  - Large-scale conflicts between alliances
  - Massive HEX burn during wars (conquest fees)
  - War chest mechanics: alliances pool HEX
  - Post-war reconstruction: more HEX burned
  
CATALYST 5: Buyback & Burn Schedule
  - Treasury does monthly buybacks with ad revenue
  - Burns are public, scheduled, transparent
  - Creates predictable deflationary pressure
  - Announcement effect: price rises before each burn
```

### 8.2 Anti-Dump Protections
```
1. Staking lock periods (7-365 days)
2. Gradual unstaking (10% per day max)
3. Large sell tax: sells > 1000 HEX pay 3% tax (burned)
4. Territory maintenance: selling all HEX = lose territories
5. Social pressure: kingdom members see who dumps
```

---

## 9. REVENUE MODEL

### 9.1 Revenue Streams
```
Stream              Est. Revenue    HEX Impact
──────────────────────────────────────────────
In-game ads         $5 CPM          50% buys HEX
Shop purchases      $5 ARPU/mo      Crystals sold for HEX (burn)
NFT marketplace     5% royalty      2% burned, 3% treasury
Premium features    $9.99/mo        Paid in HEX (burned)
Battle pass         $4.99/season    Paid in HEX
Alliance services   $19.99/mo       Organization fee in HEX
API access          $99/mo          Data licensing
Partnerships        Variable        Brand territories (real companies)
```

### 9.2 The Advertising Flywheel (Detail)
```
Step 1: Territory owners enable "ad slot" on their hex
Step 2: Real advertisers bid for ad impressions (programmatic)
Step 3: When players view a territory, the ad renders
Step 4: Ad revenue in USD flows to Treasury.sol
Step 5: Treasury does weekly HEX buyback on QuickSwap/SushiSwap
Step 6: Bought HEX split: 50% to territory owner, 30% burned, 20% treasury
Step 7: Territory owner now has more HEX → reinvests in game

This creates a PERPETUAL BUY PRESSURE MACHINE:
  More players → More impressions → More ad revenue → More HEX bought → Higher price
  → More valuable territories → More players want to play → Loop reinforces
```

---

## 10. LEGAL CONSIDERATIONS

### 10.1 Token Classification
```
HEX is a UTILITY TOKEN, not a security because:
  1. It has immediate in-game utility (fuel for skill tree)
  2. Holders use it for gameplay, not passive income
  3. Value comes from game usage, not profit expectation
  4. No investment contract exists
  5. Fully decentralized (mined by players, not pre-sold)
  
TERRITORY NFTs are DIGITAL COLLECTIBLES because:
  1. Each represents a unique in-game asset
  2. Utility is gameplay (production, defense, etc.)
  3. No promise of appreciation
  4. Created through gameplay, not sold as investment
```

### 10.2 Regulatory Compliance
```
- No pre-sale, no ICO, no IDO (fair launch only)
- Team allocation: 0% (all mined through play)
- No promises of returns in marketing
- Game is primary, blockchain is infrastructure
- KYC optional for small amounts, required for >$1K withdrawals
- GDPR compliant (right to forget OFF-chain data, on-chain stays)
- MiCA compliant (EU crypto regulation)
```

---

## 11. FRONTEND INTEGRATION POINTS

### 11.1 Wallet Connection
```typescript
// Already exists: WalletProvider in frontend
// Needs: Connect to Polygon, display HEX balance, stake interface

interface BlockchainState {
  connected: boolean
  address: string | null
  chainId: number
  hexBalance: bigint
  sHexBalance: bigint
  stakedAmount: bigint
  stakeTier: 'scout' | 'captain' | 'general' | 'emperor' | null
  territories: string[] // H3 indexes owned on-chain
}
```

### 11.2 Claim Flow (On-Chain)
```typescript
// When player claims territory:
async function claimTerritory(h3Index: string) {
  const tx = await territoryMiner.claim(h3Index)
  await tx.wait()
  // Event indexed → game state updated
  // Player receives: 1 HEXT NFT + emissionRate() HEX
}
```

### 11.3 Existing CryptoPanel Enhancement
```
Current: Basic wallet display + HEX Coin balance
Needed:
  - Staking interface (lock tiers, sHEX display)
  - On-chain territory list
  - Burn statistics (total burned, your contribution)
  - Governance voting interface
  - Buyback schedule + next burn countdown
```

---

## 12. IMPLEMENTATION ROADMAP

### Phase 1: Off-Chain MVP (Current — Months 1-3)
```
✅ Game mechanics working off-chain
✅ Kingdom system, skill tree, resource production
✅ Crystal economy, conquest, trade
□  Simulated HEX balance (database, not blockchain)
□  Wallet connection (Polygon testnet)
□  Territory claim writes to testnet
```

### Phase 2: Hybrid (Months 4-6)
```
□  Deploy HEXToken + TerritoryNFT to Polygon Mumbai testnet
□  Event indexer syncs on-chain → game database
□  Claims mint real NFTs on testnet
□  Staking vault on testnet
□  Marketplace with real NFT transfers
```

### Phase 3: Mainnet Launch (Months 7-9)
```
□  Audit smart contracts (CertiK/Trail of Bits)
□  Deploy to Polygon mainnet
□  Liquidity provision on QuickSwap
□  Enable real HEX withdrawals
□  Ad revenue → buyback pipeline live
□  Token listed on CoinGecko/CMC
```

### Phase 4: DeFi Integration (Months 10-12)
```
□  sHEX liquid staking launch
□  HEX/MATIC LP farming
□  Cross-chain bridge (Polygon ↔ Ethereum)
□  Partner integrations (real brands as territories)
□  DAO governance launch
```

---

## 13. KEY METRICS TO TRACK

```
HEALTH INDICATORS:
  Daily Active Users (DAU)
  HEX Daily Volume
  Net Burn Rate (minted - burned)
  Staking Ratio (% of supply staked)
  Territory Claim Rate
  Average Kingdom Size
  Marketplace Volume

PRICE INDICATORS:
  Buy Pressure = Ad Revenue × 0.5 + Conquest Volume + Maintenance Fees
  Sell Pressure = Unstaking Volume + Profit Taking
  Net Pressure = Buy - Sell (should be positive)
  Price Floor = Annual Ad Revenue / Circulating Supply
```

---

*This document is the strategic foundation. Every game mechanic should be
evaluated against: "Does this create HEX demand?" If yes, implement. If no,
reconsider or add a HEX cost component.*

**The ultimate goal: Make HEX so useful that holding it is more valuable
than selling it. When that equilibrium is reached, the price only goes up.**
