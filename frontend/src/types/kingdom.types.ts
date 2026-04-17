/**
 * kingdom.types.ts — HEXOD Kingdom, Skill Tree & Resource Production types.
 * 
 * GAME LOOP:
 *   Territories → grouped into Kingdoms → Kingdoms produce Resources/day (based on biome+rarity)
 *   → Player allocates % of each resource to HEX conversion
 *   → HEX/day distributed across 5 skill tree branches
 *   → Deeper branch = better bonuses → stronger kingdom → conquer more
 * 
 * TERRITORY CONQUEST:
 *   - Adjacent to your kingdom: easy (lower cost, no influence req)
 *   - Far away: expensive (supply lines, logistics)
 *   - Rare POIs (Notre Dame, Pentagon...): require high influence level
 *   - Methods: ASSAULT (military), PURCHASE (HEX), INFILTRATION (spy+data)
 */

// ═══════════════════════════════════════════════════════════════
// RESOURCES (20 types from gameplay spec)
// ═══════════════════════════════════════════════════════════════

export type ExtractionResource = 
  | 'fer' | 'petrole' | 'gaz' | 'uranium' | 'charbon'
  | 'silicium' | 'terres_rares' | 'lithium' | 'cobalt' | 'or' | 'aluminium'

export type ProcessedResource = 'acier' | 'composants' | 'titanium'
export type InfoResource = 'donnees' | 'influence'
export type SocialResource = 'main_oeuvre' | 'nourriture' | 'eau' | 'stabilite'
export type CurrencyResource = 'cristaux'

export type ResourceId = ExtractionResource | ProcessedResource | InfoResource | SocialResource | CurrencyResource

export interface ResourceDef {
  id: ResourceId
  name: string
  icon: string
  color: string
  category: 'extraction' | 'processed' | 'info' | 'social' | 'currency'
  /** HEX conversion rate (units → HEX) */
  hexRate: number
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  // Extraction
  fer:          { id: 'fer',          name: 'Iron',         icon: 'pickaxe', color: '#94a3b8', category: 'extraction', hexRate: 0.8 },
  petrole:      { id: 'petrole',      name: 'Oil',          icon: 'oil_barrel', color: '#ef4444', category: 'extraction', hexRate: 2.5 },
  gaz:          { id: 'gaz',          name: 'Gas',          icon: 'wind', color: '#a78bfa', category: 'extraction', hexRate: 2.0 },
  uranium:      { id: 'uranium',      name: 'Uranium',      icon: 'nuclear', color: '#fbbf24', category: 'extraction', hexRate: 8.0 },
  charbon:      { id: 'charbon',      name: 'Coal',         icon: '⬛', color: '#475569', category: 'extraction', hexRate: 0.5 },
  silicium:     { id: 'silicium',     name: 'Silicon',      icon: 'diamond_blue', color: '#06b6d4', category: 'extraction', hexRate: 3.0 },
  terres_rares: { id: 'terres_rares', name: 'Rare Earth',   icon: 'gem', color: '#8b5cf6', category: 'extraction', hexRate: 6.0 },
  lithium:      { id: 'lithium',      name: 'Lithium',      icon: 'battery', color: '#22d3ee', category: 'extraction', hexRate: 4.0 },
  cobalt:       { id: 'cobalt',       name: 'Cobalt',       icon: 'dot_blue', color: '#3b82f6', category: 'extraction', hexRate: 5.0 },
  or:           { id: 'or',           name: 'Gold',         icon: 'hex_coin', color: '#fbbf24', category: 'extraction', hexRate: 10.0 },
  aluminium:    { id: 'aluminium',    name: 'Aluminium',    icon: 'bolt', color: '#d1d5db', category: 'extraction', hexRate: 1.0 },
  // Processed
  acier:        { id: 'acier',        name: 'Steel',        icon: 'dagger', color: '#6b7280', category: 'processed', hexRate: 2.0 },
  composants:   { id: 'composants',   name: 'Components',   icon: 'wrench', color: '#10b981', category: 'processed', hexRate: 4.0 },
  titanium:     { id: 'titanium',     name: 'Titanium',     icon: 'gear', color: '#c4b5fd', category: 'processed', hexRate: 6.0 },
  // Info
  donnees:      { id: 'donnees',      name: 'Data',         icon: 'chart_bar', color: '#0ea5e9', category: 'info', hexRate: 1.5 },
  influence:    { id: 'influence',     name: 'Influence',    icon: 'grid_globe', color: '#059669', category: 'info', hexRate: 3.0 },
  // Social
  main_oeuvre:  { id: 'main_oeuvre',  name: 'Labor',        icon: 'worker', color: '#f59e0b', category: 'social', hexRate: 0.5 },
  nourriture:   { id: 'nourriture',   name: 'Food',         icon: 'wheat', color: '#84cc16', category: 'social', hexRate: 0.3 },
  eau:          { id: 'eau',          name: 'Water',        icon: 'water_drop', color: '#38bdf8', category: 'social', hexRate: 0.2 },
  stabilite:    { id: 'stabilite',    name: 'Stability',    icon: '', color: '#a3a3a3', category: 'social', hexRate: 1.0 },
  // Currency
  cristaux:     { id: 'cristaux',     name: 'HEX Coin',     icon: '◆',  color: '#7950f2', category: 'currency', hexRate: 1.0 },
}

// ═══════════════════════════════════════════════════════════════
// BIOME → RESOURCE PRODUCTION
// ═══════════════════════════════════════════════════════════════

export type BiomeId = 'urban' | 'rural' | 'forest' | 'mountain' | 'coastal' | 'desert' | 'tundra' | 'industrial' | 'landmark'

export interface BiomeProduction {
  primary: ResourceId
  secondary: ResourceId
  /** Base units/day for primary */
  primaryRate: number
  /** Base units/day for secondary */
  secondaryRate: number
  /** Bonus resources at lower rate */
  bonus?: Partial<Record<ResourceId, number>>
}

export const BIOME_PRODUCTION: Record<BiomeId, BiomeProduction> = {
  urban:      { primary: 'donnees',    secondary: 'main_oeuvre', primaryRate: 15, secondaryRate: 10, bonus: { influence: 5, nourriture: 3 } },
  rural:      { primary: 'nourriture', secondary: 'eau',        primaryRate: 20, secondaryRate: 15, bonus: { main_oeuvre: 8, stabilite: 5 } },
  forest:     { primary: 'nourriture', secondary: 'charbon',    primaryRate: 12, secondaryRate: 8,  bonus: { eau: 10, stabilite: 3 } },
  mountain:   { primary: 'fer',        secondary: 'charbon',    primaryRate: 18, secondaryRate: 12, bonus: { or: 2, uranium: 1, terres_rares: 1 } },
  coastal:    { primary: 'petrole',    secondary: 'nourriture', primaryRate: 10, secondaryRate: 8,  bonus: { gaz: 5, eau: 12, donnees: 3 } },
  desert:     { primary: 'petrole',    secondary: 'gaz',        primaryRate: 25, secondaryRate: 15, bonus: { uranium: 3, silicium: 8 } },
  tundra:     { primary: 'gaz',        secondary: 'eau',        primaryRate: 15, secondaryRate: 20, bonus: { lithium: 4, cobalt: 2 } },
  industrial: { primary: 'acier',      secondary: 'composants', primaryRate: 20, secondaryRate: 12, bonus: { donnees: 8, main_oeuvre: 15, aluminium: 10 } },
  landmark:   { primary: 'influence',  secondary: 'donnees',    primaryRate: 30, secondaryRate: 15, bonus: { stabilite: 10, or: 5 } },
}

/** Rarity multiplier on production */
export const RARITY_MULTIPLIER: Record<string, number> = {
  common: 1, uncommon: 1.5, rare: 2.5, epic: 4, legendary: 8, mythic: 20,
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTION CHAINS
// ═══════════════════════════════════════════════════════════════

export interface ProductionChain {
  id: string
  name: string
  icon: string
  inputs: { resource: ResourceId; amount: number }[]
  output: { resource: ResourceId; amount: number }
  unlockSkill?: string
}

export const PRODUCTION_CHAINS: ProductionChain[] = [
  { id: 'steel_armor',    name: 'Steel Forging',    icon: 'dagger', inputs: [{ resource: 'fer', amount: 50 }, { resource: 'charbon', amount: 30 }], output: { resource: 'acier', amount: 40 } },
  { id: 'electronics',    name: 'Electronics',      icon: 'computer', inputs: [{ resource: 'silicium', amount: 30 }, { resource: 'aluminium', amount: 20 }], output: { resource: 'composants', amount: 25 } },
  { id: 'battery_tech',   name: 'Battery Tech',     icon: 'battery', inputs: [{ resource: 'lithium', amount: 20 }, { resource: 'cobalt', amount: 15 }], output: { resource: 'composants', amount: 35 } },
  { id: 'nuclear_power',  name: 'Nuclear Power',    icon: 'nuclear', inputs: [{ resource: 'uranium', amount: 10 }, { resource: 'eau', amount: 50 }], output: { resource: 'cristaux', amount: 200 }, unlockSkill: 'tech3' },
  { id: 'crypto_economy', name: 'Crypto Mining',    icon: '₿',  inputs: [{ resource: 'donnees', amount: 40 }, { resource: 'influence', amount: 20 }], output: { resource: 'cristaux', amount: 150 } },
  { id: 'geopolitical',   name: 'Soft Power',       icon: 'grid_globe', inputs: [{ resource: 'influence', amount: 30 }, { resource: 'stabilite', amount: 20 }], output: { resource: 'influence', amount: 60 }, unlockSkill: 'dip3' },
]

// ═══════════════════════════════════════════════════════════════
// SKILL TREE (5 branches × 6 nodes + fork at position 2)
// ═══════════════════════════════════════════════════════════════

export type BranchId = 'attack' | 'defense' | 'economy' | 'influence_branch' | 'tech' | 'extraction'

export interface SkillNode {
  id: string
  name: string
  icon: string
  /** HEX cost to complete */
  cost: number
  /** What it does */
  effect: string
  description: string
  /** Prerequisite skill IDs */
  prereqs: string[]
  /** Position in branch (0-5) */
  tier: number
  /** Is this a fork choice? */
  isFork?: boolean
  /** Fork group — choosing one locks the other */
  forkGroup?: string
  /** Is this the ultimate ability? */
  isUltimate?: boolean
}

export interface SkillBranch {
  id: BranchId
  name: string
  icon: string
  color: string
  gemType: string
  description: string
  skills: SkillNode[]
}

export const SKILL_BRANCHES: SkillBranch[] = [
  {
    id: 'attack', name: 'Assault Tactics', icon: 'swords', color: '#dc2626',
    gemType: 'Ruby', description: 'Military dominance & offensive superiority',
    skills: [
      { id: 'atk0', name: 'Basic Training',       icon: 'medal', cost: 0,     effect: '+5% army speed',                 description: 'Foundation military doctrine', prereqs: [], tier: 0 },
      { id: 'atk1', name: 'Lightning Formation',   icon: 'lightning', cost: 800,   effect: '+15% army speed',                description: 'Rapid deployment protocols', prereqs: ['atk0'], tier: 1 },
      // Fork at tier 2
      { id: 'atk2a', name: 'Mechanical Assault',   icon: 'mech_arm', cost: 2000,  effect: 'Brute ATK +40%, ignore terrain', description: 'Heavy armor overwhelming force', prereqs: ['atk1'], tier: 2, isFork: true, forkGroup: 'atk_fork' },
      { id: 'atk2b', name: 'Cyber Warfare',        icon: 'computer', cost: 2000,  effect: 'Disable DEF 6h before attack',   description: 'Electronic warfare pre-strike', prereqs: ['atk1'], tier: 2, isFork: true, forkGroup: 'atk_fork' },
      { id: 'atk3', name: 'Double Assault',         icon: 'swords', cost: 4000,  effect: 'Attack 2 hexes simultaneously',  description: 'Coordinated multi-front offense', prereqs: ['atk2a', 'atk2b'], tier: 3 },
      { id: 'atk4', name: 'Artillery Position',     icon: 'rocket', cost: 7000,  effect: 'Range +2, area damage',          description: 'Long-range fire support', prereqs: ['atk3'], tier: 4 },
      { id: 'atk5', name: 'Total Domination',       icon: 'crown', cost: 15000, effect: 'Ultimate: Nuke Strike',           description: 'Annihilate all defenses in target zone', prereqs: ['atk4'], tier: 5, isUltimate: true },
    ],
  },
  {
    id: 'defense', name: 'Defensive Engineering', icon: 'ui_shield', color: '#2563eb',
    gemType: 'Sapphire', description: 'Fortification & territory protection',
    skills: [
      { id: 'def0', name: 'Reinforced Walls',       icon: 'bricks', cost: 0,     effect: '+10% wall HP',                  description: 'Basic construction upgrade', prereqs: [], tier: 0 },
      { id: 'def1', name: 'Energy Shield',           icon: 'battery', cost: 800,   effect: 'Absorb 15% incoming damage',    description: 'Passive energy barrier', prereqs: ['def0'], tier: 1 },
      { id: 'def2a', name: 'Extended Resistance',    icon: 'snow_peak', cost: 2000,  effect: 'DEF bonus persists 48h',        description: 'Sustained defense posture', prereqs: ['def1'], tier: 2, isFork: true, forkGroup: 'def_fork' },
      { id: 'def2b', name: 'Auto Riposte',           icon: 'lightning', cost: 2000,  effect: 'Counter-attack 30% on defense', description: 'Automated retaliation systems', prereqs: ['def1'], tier: 2, isFork: true, forkGroup: 'def_fork' },
      { id: 'def3', name: 'Underground Bunker',      icon: 'hole', cost: 4000,  effect: 'Protect 80% resources on loss', description: 'Hidden secure storage', prereqs: ['def2a', 'def2b'], tier: 3 },
      { id: 'def4', name: 'Detection Network',       icon: 'eye', cost: 7000,  effect: 'Vision +3 hex, detect stealth', description: 'Total territorial surveillance', prereqs: ['def3'], tier: 4 },
      { id: 'def5', name: 'Impregnable Citadel',     icon: 'castle', cost: 15000, effect: 'Ultimate: Shield 12h/week',      description: 'Inviolable fortress mode', prereqs: ['def4'], tier: 5, isUltimate: true },
    ],
  },
  {
    id: 'economy', name: 'Imperial Economy', icon: 'money_bag', color: '#d97706',
    gemType: 'Topaz', description: 'Resource optimization & production chains',
    skills: [
      { id: 'eco0', name: 'Optimized Collection',    icon: 'chart_up', cost: 0,     effect: '+10% all resource production',  description: 'Process rationalization', prereqs: [], tier: 0 },
      { id: 'eco1', name: 'Refinery Complex',         icon: '', cost: 800,   effect: 'Processing chain output x1.5', description: 'Advanced refining capacity', prereqs: ['eco0'], tier: 1 },
      { id: 'eco2a', name: 'Biome Specialization',    icon: 'globe', cost: 2000,  effect: 'Primary resource x3 in 1 biome', description: 'Deep exploitation of home biome', prereqs: ['eco1'], tier: 2, isFork: true, forkGroup: 'eco_fork' },
      { id: 'eco2b', name: 'Diversified Empire',      icon: 'map_folded', cost: 2000,  effect: '+25% all biomes, no penalty',    description: 'Balanced multi-biome strategy', prereqs: ['eco1'], tier: 2, isFork: true, forkGroup: 'eco_fork' },
      { id: 'eco3', name: 'Central Bank',             icon: 'bank', cost: 4000,  effect: '5% daily interest on HEX', description: 'Sophisticated financial system', prereqs: ['eco2a', 'eco2b'], tier: 3 },
      { id: 'eco4', name: 'Automation',                icon: 'robot', cost: 7000,  effect: 'Offline production 24h',        description: 'Autonomous factories', prereqs: ['eco3'], tier: 4 },
      { id: 'eco5', name: 'Advanced Capitalism',       icon: 'gem', cost: 15000, effect: 'Ultimate: Resource conversion x3', description: 'Maximum efficiency', prereqs: ['eco4'], tier: 5, isUltimate: true },
    ],
  },
  {
    id: 'influence_branch', name: 'Diplomacy & Influence', icon: 'dove', color: '#059669',
    gemType: 'Emerald', description: 'Soft power, expansion & intelligence',
    skills: [
      { id: 'dip0', name: 'Local Embassy',            icon: 'museum', cost: 0,     effect: 'Influence radius +1 hex',       description: 'Diplomatic presence established', prereqs: [], tier: 0 },
      { id: 'dip1', name: 'Propaganda Network',       icon: 'megaphone', cost: 800,   effect: '-20% territory purchase cost',  description: 'Information manipulation', prereqs: ['dip0'], tier: 1 },
      { id: 'dip2a', name: 'Soft Power',              icon: 'handshake', cost: 2000,  effect: 'Auto-rally neutral hex/week',   description: 'Peaceful expansion through charm', prereqs: ['dip1'], tier: 2, isFork: true, forkGroup: 'dip_fork' },
      { id: 'dip2b', name: 'Black Propaganda',        icon: 'spy', cost: 2000,  effect: 'See enemy armies + sabotage',   description: 'Spy network and disinformation', prereqs: ['dip1'], tier: 2, isFork: true, forkGroup: 'dip_fork' },
      { id: 'dip3', name: 'Economic Annexation',      icon: 'briefcase', cost: 4000,  effect: 'Force-buy any territory',       description: 'Hostile takeover mechanism', prereqs: ['dip2a', 'dip2b'], tier: 3 },
      { id: 'dip4', name: 'Cult of Personality',      icon: '⭐', cost: 7000,  effect: 'Auto peaceful rally 3 hex/week', description: 'Legendary charisma', prereqs: ['dip3'], tier: 4 },
      { id: 'dip5', name: 'World Order',              icon: 'globe', cost: 15000, effect: 'Ultimate: Regional control',     description: 'Diplomatic hegemony', prereqs: ['dip4'], tier: 5, isUltimate: true },
    ],
  },
  {
    id: 'tech', name: 'Research Institute', icon: 'microscope', color: '#7c3aed',
    gemType: 'Amethyst', description: 'Innovation & technological advantage',
    skills: [
      { id: 'tech0', name: 'Mobile Lab',              icon: 'observatory', cost: 0,     effect: '+10% research speed',           description: 'Field science capabilities', prereqs: [], tier: 0 },
      { id: 'tech1', name: 'Cryptography',            icon: 'lock_key', cost: 800,   effect: 'Immune to espionage',           description: 'Secure communications', prereqs: ['tech0'], tier: 1 },
      { id: 'tech2a', name: 'Militech',               icon: 'mech_arm', cost: 2000,  effect: 'All units +20% stats',          description: 'Military technology integration', prereqs: ['tech1'], tier: 2, isFork: true, forkGroup: 'tech_fork' },
      { id: 'tech2b', name: 'Biotech',                icon: 'dna', cost: 2000,  effect: 'Heal units, reduce casualties', description: 'Biological enhancement research', prereqs: ['tech1'], tier: 2, isFork: true, forkGroup: 'tech_fork' },
      { id: 'tech3', name: 'Nanorobots',              icon: 'robot', cost: 4000,  effect: '-30% construction time & cost', description: 'Molecular assembly technology', prereqs: ['tech2a', 'tech2b'], tier: 3 },
      { id: 'tech4', name: 'AI Intelligence',         icon: 'brain', cost: 7000,  effect: 'Auto-defense + smart targeting', description: 'Autonomous combat systems', prereqs: ['tech3'], tier: 4 },
      { id: 'tech5', name: 'Singularity',             icon: 'atom', cost: 15000, effect: 'Ultimate: All abilities x2',     description: 'Technological transcendence', prereqs: ['tech4'], tier: 5, isUltimate: true },
    ],
  },
  {
    id: 'extraction', name: 'Resource Extraction', icon: 'pickaxe', color: '#b45309',
    gemType: 'Amber', description: 'Deep mining, refining & resource maximization',
    skills: [
      { id: 'ext0', name: 'Surveyor Drones',           icon: 'ufo', cost: 0,     effect: 'Reveal hidden resource deposits',  description: 'Automated geological survey', prereqs: [], tier: 0 },
      { id: 'ext1', name: 'Deep Bore Mining',           icon: 'hole', cost: 800,   effect: '+25% extraction from mountains',   description: 'Reach deeper mineral veins', prereqs: ['ext0'], tier: 1 },
      { id: 'ext2a', name: 'Strip Mining',              icon: 'construction', cost: 2000,  effect: 'x2 output, -10% stability',        description: 'Massive open-pit operations — fast but destabilizing', prereqs: ['ext1'], tier: 2, isFork: true, forkGroup: 'ext_fork' },
      { id: 'ext2b', name: 'Sustainable Harvest',       icon: 'recycle', cost: 2000,  effect: '+50% output, +15% stability',       description: 'Green extraction with renewable cycles', prereqs: ['ext1'], tier: 2, isFork: true, forkGroup: 'ext_fork' },
      { id: 'ext3', name: 'Rare Earth Refinery',        icon: 'gem', cost: 4000,  effect: 'Unlock terres_rares + lithium x2',  description: 'Process rare minerals from any biome', prereqs: ['ext2a', 'ext2b'], tier: 3 },
      { id: 'ext4', name: 'Orbital Prospecting',        icon: 'satellite', cost: 7000,  effect: 'See all resource deposits on map',  description: 'Satellite-based resource detection', prereqs: ['ext3'], tier: 4 },
      { id: 'ext5', name: 'Transmutation Engine',       icon: 'alchemy', cost: 15000, effect: 'Ultimate: Convert any resource to any other', description: 'Alchemical mastery of matter', prereqs: ['ext4'], tier: 5, isUltimate: true },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
// KINGDOM
// ═══════════════════════════════════════════════════════════════

export interface Kingdom {
  id: string
  name: string
  /** Player-chosen color for map display */
  color: string
  /** H3 index of capital hex */
  capitalHex: string
  /** All territory H3 indexes in this kingdom */
  territories: string[]
  /** Map center for teleport */
  center: { lat: number; lng: number }
  /** Shield status */
  shieldActive: boolean
  shieldExpiresAt: string | null
  /** Under attack? */
  warZone: boolean
  /** Skill tree state */
  skillStates: Record<string, SkillState>
  /** Fork choices (permanent) */
  forkChoices: Record<string, string>
  /** HEX reservoir per branch */
  hexReservoirs: Record<BranchId, number>
  /** Resource allocation percentages (how much of each resource → HEX) */
  resourceAllocation: Record<ResourceId, number>
  /** Branch allocation percentages (how HEX is split across branches) */
  branchAllocation: Record<BranchId, number>
  /** Daily production snapshot */
  dailyProduction: Partial<Record<ResourceId, number>>
  /** Daily HEX income */
  dailyHex: number
  /** Created at */
  createdAt: string
}

export interface SkillState {
  /** HEX poured so far */
  filled: number
  /** Max HEX needed */
  max: number
  /** Is completed? */
  completed: boolean
  /** Is available (prereqs met)? */
  available: boolean
  /** Is locked due to fork choice? */
  forkLocked: boolean
}

// ═══════════════════════════════════════════════════════════════
// TERRITORY CONQUEST
// ═══════════════════════════════════════════════════════════════

export type ConquestMethod = 'assault' | 'purchase' | 'infiltration'

export interface ConquestCost {
  method: ConquestMethod
  /** Is territory adjacent to player's kingdom? */
  adjacent: boolean
  /** Base HEX cost */
  baseCost: number
  /** Influence requirement for rare POIs */
  influenceRequired: number
  /** Resource costs for assault */
  resourceCosts?: Partial<Record<ResourceId, number>>
  /** Success probability for assault */
  successChance?: number
  /** Time to complete (seconds) */
  duration: number
}

/** Calculate conquest cost based on distance + rarity */
export function calculateConquestCost(
  method: ConquestMethod,
  adjacent: boolean,
  rarity: string,
  isLandmark: boolean,
): ConquestCost {
  const rarityMult = RARITY_MULTIPLIER[rarity] ?? 1
  const distanceMult = adjacent ? 1 : 3.5
  const landmarkMult = isLandmark ? 2 : 1

  if (method === 'purchase') {
    return {
      method, adjacent,
      baseCost: Math.floor(500 * rarityMult * distanceMult * landmarkMult),
      influenceRequired: isLandmark ? Math.floor(50 * rarityMult) : 0,
      duration: adjacent ? 60 : 300,
    }
  }

  if (method === 'assault') {
    return {
      method, adjacent,
      baseCost: Math.floor(200 * rarityMult * distanceMult),
      influenceRequired: 0,
      resourceCosts: {
        petrole: Math.floor(20 * distanceMult),
        acier: Math.floor(15 * rarityMult),
      },
      successChance: adjacent ? 0.7 : 0.45,
      duration: adjacent ? 300 : 900,
    }
  }

  // infiltration
  return {
    method, adjacent,
    baseCost: Math.floor(350 * rarityMult * distanceMult),
    influenceRequired: Math.floor(20 * rarityMult),
    resourceCosts: {
      donnees: Math.floor(25 * distanceMult),
      composants: Math.floor(10 * rarityMult),
    },
    successChance: 0.6,
    duration: adjacent ? 600 : 1800,
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Calculate daily production for a kingdom */
export function calculateKingdomProduction(
  territories: { biome: BiomeId; rarity: string; isShiny?: boolean }[]
): Partial<Record<ResourceId, number>> {
  const production: Partial<Record<ResourceId, number>> = {}

  for (const t of territories) {
    const biome = BIOME_PRODUCTION[t.biome]
    if (!biome) continue

    const mult = (RARITY_MULTIPLIER[t.rarity] ?? 1) * (t.isShiny ? 1.5 : 1)

    // Primary + secondary
    production[biome.primary] = (production[biome.primary] ?? 0) + Math.floor(biome.primaryRate * mult)
    production[biome.secondary] = (production[biome.secondary] ?? 0) + Math.floor(biome.secondaryRate * mult)

    // Bonus resources
    if (biome.bonus) {
      for (const [res, rate] of Object.entries(biome.bonus)) {
        production[res as ResourceId] = (production[res as ResourceId] ?? 0) + Math.floor((rate as number) * mult)
      }
    }
  }

  return production
}

/** Calculate daily HEX income from resources + allocation */
export function calculateDailyHex(
  production: Partial<Record<ResourceId, number>>,
  allocation: Record<ResourceId, number>,
): number {
  let total = 0
  for (const [resId, amount] of Object.entries(production)) {
    const pct = (allocation[resId as ResourceId] ?? 0) / 100
    const rate = RESOURCES[resId as ResourceId]?.hexRate ?? 0
    total += Math.floor(amount * pct * rate)
  }
  return total
}

/** Get total skill cost for a branch */
export function getBranchTotalCost(branchId: BranchId): number {
  const branch = SKILL_BRANCHES.find(b => b.id === branchId)
  if (!branch) return 0
  return branch.skills.reduce((sum, s) => sum + s.cost, 0)
}

/** Count completed skills in a branch */
export function getBranchProgress(states: Record<string, SkillState>, branchId: BranchId): { completed: number; total: number } {
  const branch = SKILL_BRANCHES.find(b => b.id === branchId)
  if (!branch) return { completed: 0, total: 0 }
  const completed = branch.skills.filter(s => states[s.id]?.completed).length
  return { completed, total: branch.skills.length }
}
