/**
 * SkillTreeView — HEXOD Kingdom Skill Tree.
 * 5 branches × 6 tiers, fork system at tier 2, crystal pour mechanic.
 * Premium glassmorphism + Orbitron typography + animated reservoirs.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SKILL_BRANCHES, type BranchId, type SkillNode, type SkillBranch } from '../../types/kingdom.types'
import type { Kingdom, SkillState } from '../../types/kingdom.types'
import { CrystalIcon } from '../shared/CrystalIcon'

interface Props {
  kingdom: Kingdom
  onPour: (skillId: string, amount: number) => void
  onForkChoice: (skillId: string) => void
  onBranchAllocChange: (branchId: BranchId, pct: number) => void
}

// ── Branch colors ──
const BRANCH_COLORS: Record<BranchId, string> = {
  attack: '#dc2626',
  defense: '#2563eb',
  economy: '#d97706',
  influence_branch: '#059669',
  tech: '#7c3aed',
}

// ── Skill Node Component ──
function SkillNodeCard({
  skill, branch, state, kingdom, onPour, onForkChoice,
}: {
  skill: SkillNode
  branch: SkillBranch
  state: SkillState
  kingdom: Kingdom
  onPour: (skillId: string, amount: number) => void
  onForkChoice: (skillId: string) => void
}) {
  const [hovering, setHovering] = useState(false)
  const pct = state.max > 0 ? (state.filled / state.max) * 100 : 100
  const color = BRANCH_COLORS[branch.id]
  const reservoir = kingdom.crystalReservoirs[branch.id]

  const statusClass = state.completed ? 'completed' : state.forkLocked ? 'locked' : state.available ? 'available' : 'locked'

  const handlePour = useCallback(() => {
    if (!state.available || state.completed || state.forkLocked) return
    // If this is a fork skill and no fork choice made yet, auto-choose
    if (skill.isFork && !kingdom.forkChoices[skill.forkGroup!]) {
      onForkChoice(skill.id)
    }
    const amount = Math.min(500, state.max - state.filled, reservoir)
    if (amount > 0) onPour(skill.id, amount)
  }, [state, skill, reservoir, kingdom.forkChoices, onPour, onForkChoice])

  return (
    <motion.div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handlePour}
      whileHover={statusClass !== 'locked' ? { y: -3, scale: 1.02 } : {}}
      style={{
        width: '100%',
        padding: 10,
        borderRadius: 10,
        cursor: statusClass === 'locked' ? 'not-allowed' : 'pointer',
        opacity: statusClass === 'locked' ? 0.4 : 1,
        filter: statusClass === 'locked' ? 'grayscale(0.8)' : 'none',
        background: state.completed
          ? `linear-gradient(135deg, ${color}15, ${color}08)`
          : 'rgba(255,255,255,0.4)',
        border: `1.5px solid ${
          state.completed ? color
          : state.available ? 'rgba(204,136,0,0.4)'
          : 'rgba(0,60,100,0.1)'
        }`,
        boxShadow: state.completed
          ? `0 0 12px ${color}30, inset 0 1px 0 rgba(255,255,255,0.5)`
          : state.available
            ? '0 2px 8px rgba(204,136,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)'
            : 'inset 0 1px 0 rgba(255,255,255,0.3)',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
      }}
    >
      {/* Fork indicator */}
      {skill.isFork && (
        <div style={{
          position: 'absolute', top: -8, right: 8,
          fontSize: 6, fontWeight: 900, letterSpacing: 2,
          color: state.forkLocked ? 'rgba(26,42,58,0.2)' : color,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          background: 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: 8,
          border: `1px solid ${state.forkLocked ? 'rgba(0,60,100,0.1)' : `${color}40`}`,
        }}>
          {state.forkLocked ? 'LOCKED' : 'FORK'}
        </div>
      )}

      {/* Ultimate indicator */}
      {skill.isUltimate && (
        <div style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          fontSize: 6, fontWeight: 900, letterSpacing: 2,
          color: '#fbbf24',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          background: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: 8,
          border: '1px solid rgba(251,191,36,0.3)',
        }}>
          ★ ULTIMATE
        </div>
      )}

      {/* Header: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20, filter: state.completed ? `drop-shadow(0 0 4px ${color})` : 'none' }}>
          {skill.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 8, fontWeight: 800, color: '#1a2a3a', letterSpacing: 1,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {skill.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.5)', letterSpacing: 0.5 }}>
            {skill.effect}
          </div>
        </div>
        <div style={{
          fontSize: 12,
          color: state.completed ? '#00884a' : state.available ? '#cc8800' : 'rgba(26,42,58,0.2)',
        }}>
          {state.completed ? '✓' : state.available ? '◆' : '🔒'}
        </div>
      </div>

      {/* Progress bar */}
      {state.max > 0 && (
        <div style={{
          height: 4, borderRadius: 2, overflow: 'hidden',
          background: 'rgba(0,60,100,0.08)', marginBottom: 4,
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 2,
              background: state.completed
                ? `linear-gradient(90deg, ${color}, ${color}cc)`
                : `linear-gradient(90deg, ${color}80, ${color}40)`,
              boxShadow: pct > 0 ? `0 0 6px ${color}40` : 'none',
            }}
          />
        </div>
      )}

      {/* Cost + pour hint */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 7, color: 'rgba(26,42,58,0.4)',
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        <span>{state.filled}/{state.max} ◆</span>
        {state.available && !state.completed && hovering && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color, fontWeight: 700, fontSize: 7, fontFamily: "'Orbitron', system-ui, sans-serif" }}
          >
            CLICK TO POUR
          </motion.span>
        )}
        {state.completed && <span style={{ color: '#00884a' }}>COMPLETE</span>}
      </div>
    </motion.div>
  )
}

// ── Branch Column ──
function BranchColumn({
  branch, kingdom, onPour, onForkChoice, onAllocChange,
}: {
  branch: SkillBranch
  kingdom: Kingdom
  onPour: (skillId: string, amount: number) => void
  onForkChoice: (skillId: string) => void
  onAllocChange: (branchId: BranchId, pct: number) => void
}) {
  const color = BRANCH_COLORS[branch.id]
  const reservoir = kingdom.crystalReservoirs[branch.id]
  const alloc = kingdom.branchAllocation[branch.id] ?? 20
  const completed = branch.skills.filter(s => kingdom.skillStates[s.id]?.completed).length
  const total = branch.skills.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
      {/* Branch header */}
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: `linear-gradient(135deg, ${color}08, ${color}04)`,
        border: `1.5px solid ${color}30`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Pulse background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 50%, ${color}15, transparent 70%)`,
          animation: 'pulse 4s ease-in-out infinite',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22, filter: `drop-shadow(0 0 4px ${color}60)` }}>{branch.icon}</span>
            <div>
              <div style={{
                fontSize: 8, fontWeight: 900, color, letterSpacing: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {branch.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', letterSpacing: 1 }}>
                {completed}/{total} SKILLS
              </div>
            </div>
          </div>

          {/* Reservoir bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{
              height: 6, borderRadius: 3, overflow: 'hidden',
              background: 'rgba(0,60,100,0.06)',
            }}>
              <motion.div
                animate={{ width: `${Math.min((reservoir / 5000) * 100, 100)}%` }}
                style={{
                  height: '100%', borderRadius: 3,
                  background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                  boxShadow: `0 0 8px ${color}50`,
                }}
              />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 7, color: 'rgba(26,42,58,0.4)', marginTop: 2,
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              <span>{Math.floor(reservoir).toLocaleString()} ◆</span>
              <span>RESERVOIR</span>
            </div>
          </div>

          {/* Branch allocation slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CrystalIcon size="sm" />
            <input
              type="range"
              min={0} max={100} value={alloc}
              onChange={e => onAllocChange(branch.id, parseInt(e.target.value))}
              style={{
                flex: 1, height: 4, appearance: 'none', background: 'rgba(0,60,100,0.08)',
                borderRadius: 2, outline: 'none', cursor: 'pointer',
                accentColor: color,
              }}
            />
            <span style={{
              fontSize: 8, fontWeight: 900, color, minWidth: 28, textAlign: 'right',
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {alloc}%
            </span>
          </div>
        </div>
      </div>

      {/* Skill nodes */}
      {branch.skills.map((skill, i) => {
        const state = kingdom.skillStates[skill.id]
        if (!state) return null

        // Fork rendering: show both options side by side at same tier
        const nextSkill = branch.skills[i + 1]
        const isForkPair = skill.isFork && nextSkill?.isFork && skill.forkGroup === nextSkill?.forkGroup

        if (isForkPair) {
          // Render fork pair
          return (
            <div key={skill.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Fork label */}
              <div style={{
                textAlign: 'center', fontSize: 6, fontWeight: 700,
                color: 'rgba(26,42,58,0.3)', letterSpacing: 3, marginTop: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                ── CHOOSE ONE ──
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ flex: 1 }}>
                  <SkillNodeCard
                    skill={skill} branch={branch} state={state}
                    kingdom={kingdom} onPour={onPour} onForkChoice={onForkChoice}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <SkillNodeCard
                    skill={nextSkill} branch={branch} state={kingdom.skillStates[nextSkill.id]}
                    kingdom={kingdom} onPour={onPour} onForkChoice={onForkChoice}
                  />
                </div>
              </div>
            </div>
          )
        }

        // Skip the second fork skill (already rendered in pair)
        const prevSkill = i > 0 ? branch.skills[i - 1] : null
        if (skill.isFork && prevSkill?.isFork && skill.forkGroup === prevSkill?.forkGroup) {
          return null
        }

        // Connector line between nodes
        const showConnector = i > 0 && !(skill.isFork && prevSkill?.isFork)
        const prevCompleted = prevSkill ? kingdom.skillStates[prevSkill.id]?.completed : true

        return (
          <div key={skill.id}>
            {showConnector && (
              <div style={{
                width: 2, height: 12, margin: '0 auto',
                background: prevCompleted
                  ? `linear-gradient(to bottom, ${color}, ${color}60)`
                  : 'rgba(0,60,100,0.08)',
                borderRadius: 1,
              }} />
            )}
            <SkillNodeCard
              skill={skill} branch={branch} state={state}
              kingdom={kingdom} onPour={onPour} onForkChoice={onForkChoice}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Main SkillTreeView ──
export function SkillTreeView({ kingdom, onPour, onForkChoice, onBranchAllocChange }: Props) {
  const totalAlloc = Object.values(kingdom.branchAllocation).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Allocation summary */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, padding: '8px 12px',
        background: 'rgba(255,255,255,0.4)', borderRadius: 8,
        border: '1px solid rgba(0,60,100,0.1)',
      }}>
        <div style={{
          fontSize: 7, letterSpacing: 2, fontWeight: 700,
          color: totalAlloc === 100 ? '#00884a' : '#dc2626',
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          BRANCH ALLOCATION: {totalAlloc}%
          {totalAlloc !== 100 && ' ⚠ MUST BE 100%'}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 900, color: '#7950f2',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <CrystalIcon size="sm" />
          {kingdom.dailyCrystals.toLocaleString()}/DAY
        </div>
      </div>

      {/* Branches grid — horizontal scroll on mobile */}
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 12,
        scrollSnapType: 'x mandatory',
      }}>
        {SKILL_BRANCHES.map(branch => (
          <div key={branch.id} style={{ scrollSnapAlign: 'start', minWidth: 170, flex: '0 0 170px' }}>
            <BranchColumn
              branch={branch}
              kingdom={kingdom}
              onPour={onPour}
              onForkChoice={onForkChoice}
              onAllocChange={onBranchAllocChange}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
