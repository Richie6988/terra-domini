/**
 * Kingdom Store — Zustand store for kingdom, skill tree, and resource management.
 * Separate from main store to keep concerns isolated.
 * 
 * Flow: Territories → Kingdom → Resources/day → Allocation % → HEX/day → Branch split → Skill tree
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Kingdom, BranchId, ResourceId, SkillState, ConquestMethod,
} from '../types/kingdom.types'
import {
  SKILL_BRANCHES, RESOURCES, BIOME_PRODUCTION, RARITY_MULTIPLIER,
  calculateKingdomProduction, calculateDailyHex,
} from '../types/kingdom.types'

// ── Default allocation: evenly split across branches ──
const DEFAULT_BRANCH_ALLOC: Record<BranchId, number> = {
  attack: 15, defense: 15, economy: 20, influence_branch: 15, tech: 15, extraction: 20,
}

// ── Default resource allocation: 50% to HEX ──
function defaultResourceAlloc(): Record<ResourceId, number> {
  const alloc: Record<string, number> = {}
  for (const id of Object.keys(RESOURCES)) alloc[id] = 50
  return alloc as Record<ResourceId, number>
}

// ── Initialize skill states for a new kingdom ──
function initSkillStates(): Record<string, SkillState> {
  const states: Record<string, SkillState> = {}
  for (const branch of SKILL_BRANCHES) {
    for (const skill of branch.skills) {
      states[skill.id] = {
        filled: 0,
        max: skill.cost,
        completed: skill.cost === 0, // tier-0 skills are free (auto-complete)
        available: skill.prereqs.length === 0,
        forkLocked: false,
      }
    }
  }
  return states
}

// ── Store Interface ──
interface KingdomStore {
  kingdoms: Kingdom[]
  activeKingdomId: string | null

  // Kingdom CRUD
  createKingdom: (name: string, color: string, capitalHex: string, center: { lat: number; lng: number }) => Kingdom
  deleteKingdom: (id: string) => void
  renameKingdom: (id: string, name: string) => void
  setActiveKingdom: (id: string | null) => void

  // Territory management
  addTerritoryToKingdom: (kingdomId: string, h3: string) => void
  removeTerritoryFromKingdom: (kingdomId: string, h3: string) => void

  // Resource allocation (% of each resource → HEX conversion)
  setResourceAllocation: (kingdomId: string, resourceId: ResourceId, pct: number) => void

  // Branch allocation (% of daily HEX → each branch)
  setBranchAllocation: (kingdomId: string, branchId: BranchId, pct: number) => void

  // Skill tree
  pourHex: (kingdomId: string, skillId: string, amount: number) => boolean
  chooseFork: (kingdomId: string, skillId: string) => void

  // Day progression
  processDay: (kingdomId: string, territories: { biome: string; rarity: string; isShiny?: boolean }[]) => {
    resourcesProduced: Partial<Record<ResourceId, number>>
    hexGenerated: number
    branchDistribution: Record<BranchId, number>
  }

  // Helpers
  getKingdom: (id: string) => Kingdom | undefined
  getActiveKingdom: () => Kingdom | undefined
}

export const useKingdomStore = create<KingdomStore>()(
  persist(
    (set, get) => ({
      kingdoms: [],
      activeKingdomId: null,

      // ── Kingdom CRUD ──────────────────────────────────────────
      createKingdom: (name, color, capitalHex, center) => {
        const kingdom: Kingdom = {
          id: `k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          color,
          capitalHex,
          territories: [capitalHex],
          center,
          shieldActive: true, // New kingdoms get 7-day protection
          shieldExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          warZone: false,
          skillStates: initSkillStates(),
          forkChoices: {},
          // Starter HEX — enough to unlock first skill in 2 branches
          hexReservoirs: { attack: 500, defense: 500, economy: 500, influence_branch: 300, tech: 300, extraction: 400 },
          resourceAllocation: defaultResourceAlloc(),
          branchAllocation: { ...DEFAULT_BRANCH_ALLOC },
          // Starter production from capital territory
          dailyProduction: {
            fer: 10, petrole: 5, nourriture: 8, eau: 12,
            donnees: 6, influence: 3, main_oeuvre: 5, stabilite: 4,
          },
          dailyHex: 150, // Initial estimate
          createdAt: new Date().toISOString(),
        }
        set(s => ({ kingdoms: [...s.kingdoms, kingdom], activeKingdomId: kingdom.id }))
        return kingdom
      },

      deleteKingdom: (id) => set(s => ({
        kingdoms: s.kingdoms.filter(k => k.id !== id),
        activeKingdomId: s.activeKingdomId === id ? null : s.activeKingdomId,
      })),

      renameKingdom: (id, name) => set(s => ({
        kingdoms: s.kingdoms.map(k => k.id === id ? { ...k, name } : k),
      })),

      setActiveKingdom: (id) => set({ activeKingdomId: id }),

      // ── Territory management ──────────────────────────────────
      addTerritoryToKingdom: (kingdomId, h3) => set(s => ({
        kingdoms: s.kingdoms.map(k =>
          k.id === kingdomId && !k.territories.includes(h3)
            ? { ...k, territories: [...k.territories, h3] }
            : k
        ),
      })),

      removeTerritoryFromKingdom: (kingdomId, h3) => set(s => ({
        kingdoms: s.kingdoms.map(k =>
          k.id === kingdomId
            ? { ...k, territories: k.territories.filter(t => t !== h3) }
            : k
        ),
      })),

      // ── Resource allocation ───────────────────────────────────
      setResourceAllocation: (kingdomId, resourceId, pct) => set(s => ({
        kingdoms: s.kingdoms.map(k =>
          k.id === kingdomId
            ? { ...k, resourceAllocation: { ...k.resourceAllocation, [resourceId]: Math.max(0, Math.min(100, pct)) } }
            : k
        ),
      })),

      // ── Branch allocation ─────────────────────────────────────
      setBranchAllocation: (kingdomId, branchId, pct) => set(s => ({
        kingdoms: s.kingdoms.map(k =>
          k.id === kingdomId
            ? { ...k, branchAllocation: { ...k.branchAllocation, [branchId]: Math.max(0, Math.min(100, pct)) } }
            : k
        ),
      })),

      // ── Skill tree: pour HEX ─────────────────────────────
      pourHex: (kingdomId, skillId, amount) => {
        const kingdom = get().kingdoms.find(k => k.id === kingdomId)
        if (!kingdom) return false

        const state = kingdom.skillStates[skillId]
        if (!state || state.completed || !state.available || state.forkLocked) return false

        // Find which branch this skill belongs to
        const branch = SKILL_BRANCHES.find(b => b.skills.some(s => s.id === skillId))
        if (!branch) return false

        const reservoir = kingdom.hexReservoirs[branch.id]
        const pourAmount = Math.min(amount, state.max - state.filled, reservoir)
        if (pourAmount <= 0) return false

        const newStates = { ...kingdom.skillStates }
        const newReservoirs = { ...kingdom.hexReservoirs }

        newReservoirs[branch.id] -= pourAmount
        newStates[skillId] = {
          ...state,
          filled: state.filled + pourAmount,
          completed: state.filled + pourAmount >= state.max,
        }

        // If completed, update availability of dependent skills
        if (newStates[skillId].completed) {
          for (const sk of branch.skills) {
            if (sk.prereqs.includes(skillId) || (sk.prereqs.length > 0 && sk.prereqs.some(p => p === skillId))) {
              const allPrereqsMet = sk.prereqs.every(p => {
                // For fork prereqs (tier 3+ requires either fork choice)
                const prereqState = newStates[p]
                return prereqState?.completed || false
              })
              // A skill with fork prereqs is available if ANY fork prereq is completed
              const skill = branch.skills.find(s => s.id === sk.id)
              if (skill) {
                const forkPrereqs = skill.prereqs.filter(p => {
                  const ps = branch.skills.find(s => s.id === p)
                  return ps?.isFork
                })
                const nonForkPrereqs = skill.prereqs.filter(p => {
                  const ps = branch.skills.find(s => s.id === p)
                  return !ps?.isFork
                })
                const forkMet = forkPrereqs.length === 0 || forkPrereqs.some(p => newStates[p]?.completed)
                const nonForkMet = nonForkPrereqs.every(p => newStates[p]?.completed)

                if (forkMet && nonForkMet && !newStates[sk.id].forkLocked) {
                  newStates[sk.id] = { ...newStates[sk.id], available: true }
                }
              }
            }
          }
        }

        set(s => ({
          kingdoms: s.kingdoms.map(k =>
            k.id === kingdomId
              ? { ...k, skillStates: newStates, hexReservoirs: newReservoirs }
              : k
          ),
        }))

        return true
      },

      // ── Fork choice (permanent) ───────────────────────────────
      chooseFork: (kingdomId, skillId) => {
        const kingdom = get().kingdoms.find(k => k.id === kingdomId)
        if (!kingdom) return

        const branch = SKILL_BRANCHES.find(b => b.skills.some(s => s.id === skillId))
        if (!branch) return

        const skill = branch.skills.find(s => s.id === skillId)
        if (!skill?.forkGroup) return

        // Lock the other fork option
        const newStates = { ...kingdom.skillStates }
        const newForkChoices = { ...kingdom.forkChoices }

        for (const s of branch.skills) {
          if (s.forkGroup === skill.forkGroup && s.id !== skillId) {
            newStates[s.id] = { ...newStates[s.id], forkLocked: true, available: false }
          }
        }
        newForkChoices[skill.forkGroup] = skillId

        set(s => ({
          kingdoms: s.kingdoms.map(k =>
            k.id === kingdomId
              ? { ...k, skillStates: newStates, forkChoices: newForkChoices }
              : k
          ),
        }))
      },

      // ── Day progression ───────────────────────────────────────
      processDay: (kingdomId, territories) => {
        const kingdom = get().kingdoms.find(k => k.id === kingdomId)
        if (!kingdom) return { resourcesProduced: {}, hexGenerated: 0, branchDistribution: { attack: 0, defense: 0, economy: 0, influence_branch: 0, tech: 0, extraction: 0 } }

        // 1. Calculate production from territories
        const production = calculateKingdomProduction(territories as any)

        // 2. Calculate HEX income from allocation
        const hexIncome = calculateDailyHex(production, kingdom.resourceAllocation)

        // 3. Distribute HEX across branches
        const totalBranchPct = Object.values(kingdom.branchAllocation).reduce((a, b) => a + b, 0)
        const branchDistribution: Record<BranchId, number> = { attack: 0, defense: 0, economy: 0, influence_branch: 0, tech: 0, extraction: 0 }
        const newReservoirs = { ...kingdom.hexReservoirs }

        for (const [branchId, pct] of Object.entries(kingdom.branchAllocation)) {
          const share = totalBranchPct > 0 ? Math.floor(hexIncome * (pct / totalBranchPct)) : 0
          branchDistribution[branchId as BranchId] = share
          newReservoirs[branchId as BranchId] += share
        }

        set(s => ({
          kingdoms: s.kingdoms.map(k =>
            k.id === kingdomId
              ? {
                ...k,
                hexReservoirs: newReservoirs,
                dailyProduction: production,
                dailyHex: hexIncome,
              }
              : k
          ),
        }))

        return { resourcesProduced: production, hexGenerated: hexIncome, branchDistribution }
      },

      // ── Helpers ────────────────────────────────────────────────
      getKingdom: (id) => get().kingdoms.find(k => k.id === id),
      getActiveKingdom: () => {
        const { kingdoms, activeKingdomId } = get()
        return kingdoms.find(k => k.id === activeKingdomId)
      },
    }),
    {
      name: 'hexod-kingdoms',
      version: 1,
    }
  )
)
