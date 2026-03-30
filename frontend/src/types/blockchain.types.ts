/**
 * blockchain.types.ts — HEXOD On-Chain Types & Interfaces.
 * 
 * Architecture: Hybrid on-chain/off-chain
 *   ON-CHAIN:  HEX balances, NFT ownership, staking, marketplace, burns
 *   OFF-CHAIN: Game state, combat, skills, resources (snapshot on-chain daily)
 * 
 * Chain: Polygon PoS (low gas, fast finality)
 * Contracts: UUPS upgradeable proxy pattern
 */

// ═══════════════════════════════════════════════════════════════
// TOKEN SPEC
// ═══════════════════════════════════════════════════════════════

export const HEX_TOKEN = {
  name: 'HEX Coin',
  symbol: 'HEX',
  decimals: 18,
  chain: 'polygon',
  chainId: 137, // mainnet
  testChainId: 80001, // mumbai
  maxSupply: 4_842_432n, // = total H3 res7 land cells
  /** All contracts — addresses set at deploy time */
  contracts: {
    token: '' as `0x${string}`,
    territoryNFT: '' as `0x${string}`,
    miner: '' as `0x${string}`,
    gameEngine: '' as `0x${string}`,
    staking: '' as `0x${string}`,
    marketplace: '' as `0x${string}`,
    treasury: '' as `0x${string}`,
    governance: '' as `0x${string}`,
  },
} as const

// ═══════════════════════════════════════════════════════════════
// EMISSION SCHEDULE
// ═══════════════════════════════════════════════════════════════

export interface EmissionPhase {
  phase: number
  year: number
  hexPerClaim: number
  label: string
}

export const EMISSION_SCHEDULE: EmissionPhase[] = [
  { phase: 1, year: 1, hexPerClaim: 1.0,   label: 'Genesis' },
  { phase: 2, year: 2, hexPerClaim: 0.5,   label: 'First Halving' },
  { phase: 3, year: 3, hexPerClaim: 0.25,  label: 'Second Halving' },
  { phase: 4, year: 4, hexPerClaim: 0.125, label: 'Maturity' },
]

/** Current emission rate based on game age */
export function getCurrentEmissionRate(gameAgeYears: number): number {
  for (let i = EMISSION_SCHEDULE.length - 1; i >= 0; i--) {
    if (gameAgeYears >= EMISSION_SCHEDULE[i].year) return EMISSION_SCHEDULE[i].hexPerClaim
  }
  return EMISSION_SCHEDULE[0].hexPerClaim
}

// ═══════════════════════════════════════════════════════════════
// STAKING TIERS
// ═══════════════════════════════════════════════════════════════

export type StakeTier = 'scout' | 'captain' | 'general' | 'emperor'

export interface StakeTierDef {
  id: StakeTier
  name: string
  icon: string
  lockDays: number
  multiplier: number
  bonus: string
  color: string
  minHex: number
}

export const STAKE_TIERS: StakeTierDef[] = [
  { id: 'scout',    name: 'Scout',    icon: '🔭', lockDays: 7,   multiplier: 1.2, bonus: '+20% HEX conversion',                     color: '#94a3b8', minHex: 10 },
  { id: 'captain',  name: 'Captain',  icon: '⚔️', lockDays: 30,  multiplier: 1.5, bonus: '+50% conversion + reduced maintenance',        color: '#3b82f6', minHex: 100 },
  { id: 'general',  name: 'General',  icon: '🎖️', lockDays: 90,  multiplier: 2.0, bonus: '+100% conversion + no maintenance',            color: '#f59e0b', minHex: 500 },
  { id: 'emperor',  name: 'Emperor',  icon: '👑', lockDays: 365, multiplier: 3.0, bonus: '+200% conversion + governance x3 + no maint',  color: '#dc2626', minHex: 2500 },
]

export function getStakeTier(lockDays: number): StakeTierDef | null {
  for (let i = STAKE_TIERS.length - 1; i >= 0; i--) {
    if (lockDays >= STAKE_TIERS[i].lockDays) return STAKE_TIERS[i]
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// BURN MECHANISMS
// ═══════════════════════════════════════════════════════════════

export interface BurnEvent {
  type: 'hex_conversion' | 'conquest' | 'maintenance' | 'marketplace_royalty' | 'skill_ultimate' | 'governance' | 'sell_tax'
  amount: number // HEX burned
  timestamp: string
  txHash: string
  details?: string
}

export const BURN_RATES = {
  /** HEX burned per coin converted */
  hexConversion: 0.001,
  /** % of conquest cost that is burned */
  conquestBurnPct: 0.50,
  /** % of marketplace sale burned (of the 5% royalty) */
  marketplaceBurnPct: 0.40, // 2% of 5% = 40% of royalty
  /** HEX cost per ultimate skill */
  ultimateSkillCost: 500,
  /** Large sell tax rate (>1000 HEX) */
  largeSellTaxPct: 0.03,
  /** Daily maintenance per territory */
  maintenancePerTerritory: 0.1,
  /** Daily maintenance per active skill */
  maintenancePerSkill: 0.05,
} as const

// ═══════════════════════════════════════════════════════════════
// TERRITORY PRICING (for conquest)
// ═══════════════════════════════════════════════════════════════

export const TERRITORY_HEX_PRICE: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 100,
  epic: 500,
  legendary: 2500,
  mythic: 25000,
}

// ═══════════════════════════════════════════════════════════════
// WALLET STATE
// ═══════════════════════════════════════════════════════════════

export interface WalletState {
  connected: boolean
  address: `0x${string}` | null
  chainId: number | null
  /** HEX ERC-20 balance */
  hexBalance: string // BigInt as string
  /** Staked HEX balance */
  sHexBalance: string
  /** Current staking position */
  staking: {
    amount: string
    lockDays: number
    tier: StakeTier | null
    multiplier: number
    unlockDate: string | null
    rewards: string
  } | null
  /** Territory NFTs owned */
  ownedTerritories: string[] // H3 indexes
  /** On-chain burn stats */
  burnStats: {
    totalBurned: string
    myBurned: string
    lastBurnTx: string | null
  }
}

// ═══════════════════════════════════════════════════════════════
// MARKETPLACE
// ═══════════════════════════════════════════════════════════════

export interface MarketplaceListing {
  listingId: string
  tokenId: string
  h3Index: string
  seller: `0x${string}`
  priceHex: string
  rarity: string
  biome: string
  kingdomName?: string
  listedAt: string
  /** Calculated fees */
  royaltyTotal: string
  royaltyBurn: string
  royaltyTreasury: string
  sellerReceives: string
}

// ═══════════════════════════════════════════════════════════════
// GOVERNANCE
// ═══════════════════════════════════════════════════════════════

export interface GovernanceProposal {
  id: string
  title: string
  description: string
  options: string[]
  votes: Record<string, string> // option → total HEX voted
  status: 'active' | 'passed' | 'rejected' | 'executed'
  createdAt: string
  endsAt: string
  executedAt?: string
}

// ═══════════════════════════════════════════════════════════════
// TREASURY
// ═══════════════════════════════════════════════════════════════

export interface TreasuryStats {
  balance: string
  totalAdRevenue: string
  totalBuybacks: string
  totalBurned: string
  totalDistributed: string
  nextBuybackDate: string
  buybackHistory: {
    date: string
    amount: string
    hexBought: string
    price: string
  }[]
}

// ═══════════════════════════════════════════════════════════════
// ECONOMIC HEALTH METRICS
// ═══════════════════════════════════════════════════════════════

export interface EconomicMetrics {
  /** Total HEX ever minted */
  totalMinted: string
  /** Total HEX burned forever */
  totalBurned: string
  /** Circulating supply (minted - burned - staked) */
  circulatingSupply: string
  /** % of supply staked */
  stakingRatio: number
  /** Net daily burn rate (burn - mint) */
  netDailyBurn: number
  /** Is the token currently deflationary? */
  isDeflationary: boolean
  /** Estimated price floor from ad revenue */
  priceFloor: number
  /** Daily active users */
  dau: number
  /** Total territories claimed */
  totalClaimed: number
  /** % of map claimed */
  mapCoverage: number
}

/** Calculate if HEX is currently deflationary */
export function calculateDeflationaryStatus(metrics: EconomicMetrics): {
  netDaily: number
  isDeflationary: boolean
  daysUntilDeflationary: number | null
} {
  const netDaily = metrics.netDailyBurn
  return {
    netDaily,
    isDeflationary: netDaily > 0,
    daysUntilDeflationary: netDaily <= 0 ? Math.ceil(Math.abs(netDaily) / 100) : null,
  }
}
