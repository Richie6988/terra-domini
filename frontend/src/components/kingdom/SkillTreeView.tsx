/**
 * SkillTreeView — HEXOD Kingdom Skill Tree.
 * 5 branches × 6 tiers, fork system at tier 2, HEX pour mechanic.
 * Premium glassmorphism + Orbitron typography + animated reservoirs.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SKILL_BRANCHES, type BranchId, type SkillNode, type SkillBranch } from '../../types/kingdom.types'
import type { Kingdom, SkillState } from '../../types/kingdom.types'
import { SkillIconSVG, IconSVG } from '../shared/iconBank'
import { EmojiIcon } from '../shared/emojiIcons'
import { Lock, Check, Crown, GitFork } from 'lucide-react'

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
  extraction: '#b45309',
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
  const reservoir = kingdom.hexReservoirs[branch.id]

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
      whileTap={statusClass !== 'locked' ? { scale: 0.98 } : {}}
      className={state.available && !state.completed && !state.forkLocked ? 'hx-skill-available' : undefined}
      role="button"
      aria-label={`${skill.name} — ${state.completed ? 'completed' : statusClass === 'locked' ? 'locked' : 'available, click to pour HEX'}`}
      style={{
        ['--node-color' as any]: color,
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 10px 10px',
        borderRadius: 12,
        cursor: statusClass === 'locked' ? 'not-allowed' : 'pointer',
        background: state.completed
          ? `linear-gradient(160deg, ${color}30, ${color}10)`
          : statusClass === 'locked'
            ? 'rgba(255,255,255,0.02)'
            : `linear-gradient(160deg, ${color}18, rgba(255,255,255,0.03))`,
        border: `1.5px ${statusClass === 'locked' ? 'dashed' : 'solid'} ${
          state.completed ? color
          : statusClass === 'locked' ? 'rgba(255,255,255,0.1)'
          : `${color}90`
        }`,
        boxShadow: state.completed
          ? `0 0 16px ${color}45, inset 0 1px 0 rgba(255,255,255,0.1)`
          : statusClass === 'locked'
            ? 'none'
            : `0 2px 10px ${color}25, inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: 'background 0.3s, border-color 0.3s',
        position: 'relative',
      }}
    >
      {/* Fork indicator */}
      {skill.isFork && state.forkLocked && (
        <div style={{
          position: 'absolute', top: -9, right: 8,
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
          color: state.forkLocked ? 'rgba(255,255,255,0.45)' : color,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          background: '#0d1b2a', padding: '1px 6px', borderRadius: 8,
          border: `1px solid ${state.forkLocked ? 'rgba(255,255,255,0.12)' : `${color}60`}`,
        }}>
          {state.forkLocked ? 'LOCKED' : 'FORK'}
        </div>
      )}

      {/* Ultimate indicator */}
      {skill.isUltimate && (
        <div style={{
          position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
          color: '#fbbf24', whiteSpace: 'nowrap',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          background: '#0d1b2a', padding: '1px 7px', borderRadius: 8,
          border: '1px solid rgba(251,191,36,0.45)',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Crown size={10} /> ULTIMATE
        </div>
      )}

      {/* Header: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: statusClass === 'locked' ? 'rgba(255,255,255,0.04)' : `${color}22`,
          border: `1px solid ${statusClass === 'locked' ? 'rgba(255,255,255,0.08)' : `${color}55`}`,
          filter: state.completed ? `drop-shadow(0 0 5px ${color})` : 'none',
        }}>
          <SkillIconSVG skillId={skill.id} size={18} color={statusClass === 'locked' ? 'rgba(255,255,255,0.35)' : state.completed ? '#fff' : color} />
        </div>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: state.completed ? color : 'transparent',
          color: state.completed ? '#fff' : statusClass === 'locked' ? 'rgba(255,255,255,0.4)' : color,
        }}>
          {state.completed ? <Check size={12} strokeWidth={3} /> : statusClass === 'locked' ? <Lock size={12} /> : <IconSVG id="hex_coin" size={14} />}
        </div>
      </div>
      <div style={{ marginBottom: 8, minWidth: 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.25,
          color: statusClass === 'locked' ? 'rgba(226,232,240,0.55)' : '#e2e8f0',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          overflowWrap: 'break-word',
        }}>
          {skill.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 9, lineHeight: 1.3, marginTop: 2, color: statusClass === 'locked' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.62)' }}>
          {skill.effect}
        </div>
      </div>

      {/* Progress bar */}
      {state.max > 0 && (
        <div style={{
          height: 4, borderRadius: 2, overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)', marginBottom: 4,
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
        fontSize: 9, color: 'rgba(255,255,255,0.5)',
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        <span>{state.filled.toLocaleString()}/{state.max.toLocaleString()} HEX</span>
        {state.available && !state.completed && !state.forkLocked && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color, fontWeight: 700, fontSize: 9, opacity: hovering ? 1 : 0.75, fontFamily: "'Orbitron', system-ui, sans-serif" }}
          >
            POUR
          </motion.span>
        )}
        {state.completed && <span style={{ color, fontWeight: 700 }}>DONE</span>}
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
  const reservoir = kingdom.hexReservoirs[branch.id]
  const alloc = kingdom.branchAllocation[branch.id] ?? 20
  const completed = branch.skills.filter(s => kingdom.skillStates[s.id]?.completed).length
  const total = branch.skills.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {/* Branch header */}
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: `linear-gradient(160deg, ${color}26, ${color}08)`,
        border: `1.5px solid ${color}55`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px ${color}18`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Pulse background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 50%, ${color}15, transparent 70%)`,
          animation: 'pulse-icon 4s ease-in-out infinite',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22, filter: `drop-shadow(0 0 4px ${color}60)` }}><EmojiIcon emoji={branch.icon} size={16} /></span>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 900, color, letterSpacing: 1, lineHeight: 1.25,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {branch.name.toUpperCase()}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>
                {completed}/{total} SKILLS
              </div>
            </div>
          </div>

          {/* Reservoir bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{
              height: 6, borderRadius: 3, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
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
              fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 3,
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              <span style={{ color: '#e2e8f0' }}>{Math.floor(reservoir).toLocaleString()} HEX</span>
              <span>RESERVOIR</span>
            </div>
          </div>

          {/* Branch allocation slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconSVG id="hex_coin" size={12} />
            <input
              type="range"
              min={0} max={100} value={alloc}
              onChange={e => onAllocChange(branch.id, parseInt(e.target.value))}
              style={{
                flex: 1, height: 4, appearance: 'none', background: 'rgba(255,255,255,0.06)',
                borderRadius: 2, outline: 'none', cursor: 'pointer',
                accentColor: color,
              }}
            />
            <span style={{
              fontSize: 10, fontWeight: 900, color, minWidth: 30, textAlign: 'right',
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
            <div key={skill.id} style={{
              display: 'flex', flexDirection: 'column', gap: 12,
              padding: '18px 6px 8px', marginTop: 6, borderRadius: 12, position: 'relative',
              border: `1px dashed ${color}50`, background: `${color}08`,
            }}>
              {/* Fork label */}
              <div style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color,
                background: '#0d1b2a', padding: '1px 8px', borderRadius: 8,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                <GitFork size={10} /> CHOOSE ONE
              </div>
              <SkillNodeCard
                skill={skill} branch={branch} state={state}
                kingdom={kingdom} onPour={onPour} onForkChoice={onForkChoice}
              />
              <SkillNodeCard
                skill={nextSkill} branch={branch} state={kingdom.skillStates[nextSkill.id]}
                kingdom={kingdom} onPour={onPour} onForkChoice={onForkChoice}
              />
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
                width: 3, height: 14, margin: '-8px auto 6px',
                background: prevCompleted
                  ? `linear-gradient(to bottom, ${color}, ${color}80)`
                  : 'rgba(255,255,255,0.12)',
                boxShadow: prevCompleted ? `0 0 6px ${color}` : 'none',
                borderRadius: 2,
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
  const totalReservoir = Object.values(kingdom.hexReservoirs).reduce((a, b) => a + b, 0)

  // Quick pour: distribute all reservoir HEX to cheapest available skill per branch
  const handleQuickPour = () => {
    let poured = 0
    for (const branch of SKILL_BRANCHES) {
      const reservoir = kingdom.hexReservoirs[branch.id]
      if (reservoir <= 0) continue

      // Find cheapest available, non-completed, non-fork-locked skill
      const available = branch.skills
        .filter(s => {
          const st = kingdom.skillStates[s.id]
          return st && st.available && !st.completed && !st.forkLocked
        })
        .sort((a, b) => {
          const sa = kingdom.skillStates[a.id]
          const sb = kingdom.skillStates[b.id]
          return (sa.max - sa.filled) - (sb.max - sb.filled)
        })

      if (available.length > 0) {
        const target = available[0]
        const st = kingdom.skillStates[target.id]
        const amount = Math.min(reservoir, st.max - st.filled)
        if (amount > 0) {
          onPour(target.id, amount)
          poured += amount
        }
      }
    }
    return poured
  }

  return (
    <div>
      <style>{`@keyframes hxSkillPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--node-color) 55%, transparent), 0 2px 10px color-mix(in srgb, var(--node-color) 20%, transparent); } 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--node-color) 0%, transparent), 0 0 18px color-mix(in srgb, var(--node-color) 45%, transparent); } }
.hx-skill-available { animation: hxSkillPulse 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .hx-skill-available { animation: none; } }`}</style>
      {/* Allocation summary + Quick Pour */}
      <div className="hx-card" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        marginBottom: 16, padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
            color: totalAlloc === 100 ? '#22c55e' : '#ef4444',
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            BRANCH ALLOCATION: {totalAlloc}%
            {totalAlloc !== 100 && ' — MUST BE 100%'}
          </div>

          {totalReservoir > 0 && (
            <button
              onClick={handleQuickPour}
              className="btn-game btn-game-purple"
              style={{ padding: '8px 14px', fontSize: 9, letterSpacing: 1.5 }}
            >
              QUICK POUR ALL ({Math.floor(totalReservoir).toLocaleString()} HEX)
            </button>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 900, color: '#a78bfa',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <IconSVG id="hex_coin" size={12} />
          {kingdom.dailyHex.toLocaleString()}/DAY
        </div>
      </div>

      {/* Branches grid — horizontal scroll on mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${SKILL_BRANCHES.length}, minmax(140px, 1fr))`,
        gap: 10,
        overflowX: 'auto',
        paddingTop: 4,
        paddingBottom: 12,
        scrollSnapType: 'x mandatory',
      }}>
        {SKILL_BRANCHES.map(branch => (
          <div key={branch.id} style={{ scrollSnapAlign: 'start', minWidth: 0 }}>
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
