/**
 * KingdomPanel — HEXOD Kingdom Management Center.
 * Tabs: Overview, Resources, Skill Tree, Conquest
 * Opened from HexodDock "kingdom" button or territory context.
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { ResourceIconSVG } from '../shared/iconBank'
import { SkillTreeView } from './SkillTreeView'
import { useKingdomStore } from '../../store/kingdomStore'
import { useStore } from '../../store'
import {
  RESOURCES, BIOME_PRODUCTION, SKILL_BRANCHES,
  calculateKingdomProduction, calculateDailyCrystals, getBranchProgress,
  type BranchId, type ResourceId, type Kingdom,
} from '../../types/kingdom.types'

const TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'resources', label: 'RESOURCES' },
  { id: 'skills', label: 'SKILL TREE' },
  { id: 'conquest', label: 'CONQUEST' },
]

interface Props { onClose: () => void }

// ── Overview Tab ──
function OverviewTab({ kingdom, onProcessDay }: { kingdom: Kingdom; onProcessDay: () => void }) {
  const totalSkills = SKILL_BRANCHES.reduce((sum, b) => {
    const prog = getBranchProgress(kingdom.skillStates, b.id)
    return sum + prog.completed
  }, 0)
  const maxSkills = SKILL_BRANCHES.reduce((sum, b) => sum + b.skills.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Kingdom hero */}
      <div style={{
        padding: 16, borderRadius: 10,
        background: `linear-gradient(135deg, ${kingdom.color}15, ${kingdom.color}05)`,
        border: `1.5px solid ${kingdom.color}30`,
        textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: `linear-gradient(135deg, ${kingdom.color}, ${kingdom.color}aa)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 8px', fontSize: 22, boxShadow: `0 0 20px ${kingdom.color}30`,
        }}>
          🏰
        </div>
        <div style={{
          fontSize: 12, fontWeight: 900, color: '#1a2a3a', letterSpacing: 3,
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4,
        }}>
          {kingdom.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.45)', letterSpacing: 1 }}>
          {kingdom.territories.length} TERRITORIES · CAPITAL: {kingdom.capitalHex.slice(0, 8)}…
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'TERRITORIES', value: kingdom.territories.length, color: '#0099cc' },
          { label: 'SKILLS', value: `${totalSkills}/${maxSkills}`, color: '#7950f2' },
          { label: 'HEX/DAY', value: kingdom.dailyCrystals.toLocaleString(), color: '#7950f2', icon: true },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '10px 8px', borderRadius: 8, textAlign: 'center',
            background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.08)',
          }}>
            <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', letterSpacing: 2, marginBottom: 4, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 900, color: stat.color,
              fontFamily: "'Share Tech Mono', monospace",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              {stat.icon && <CrystalIcon size="sm" />}
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Branch progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.4)', fontFamily: "'Orbitron', system-ui, sans-serif" }}>
          BRANCH PROGRESS
        </div>
        {SKILL_BRANCHES.map(branch => {
          const prog = getBranchProgress(kingdom.skillStates, branch.id)
          const pct = prog.total > 0 ? (prog.completed / prog.total) * 100 : 0
          return (
            <div key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, width: 20 }}>{branch.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  height: 6, borderRadius: 3, overflow: 'hidden',
                  background: 'rgba(0,60,100,0.06)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${pct}%`,
                    background: `linear-gradient(90deg, ${branch.color}, ${branch.color}aa)`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
              <span style={{
                fontSize: 7, fontWeight: 700, color: branch.color, minWidth: 30, textAlign: 'right',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {prog.completed}/{prog.total}
              </span>
            </div>
          )
        })}
      </div>

      {/* Shield status */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: kingdom.shieldActive ? 'rgba(0,136,74,0.08)' : 'rgba(220,38,38,0.05)',
        border: `1px solid ${kingdom.shieldActive ? 'rgba(0,136,74,0.2)' : 'rgba(220,38,38,0.1)'}`,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 8, color: kingdom.shieldActive ? '#00884a' : 'rgba(26,42,58,0.4)',
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        {kingdom.shieldActive ? '🛡 SHIELD ACTIVE' : '⚠ SHIELD INACTIVE'}
        {kingdom.warZone && <span style={{ color: '#dc2626', marginLeft: 'auto' }}>🔥 WAR ZONE</span>}
      </div>

      {/* Process Day — generate resources + crystals */}
      <button
        onClick={onProcessDay}
        style={{
          width: '100%', padding: '12px', borderRadius: 20, cursor: 'pointer',
          background: 'linear-gradient(90deg, #0099cc, #0891b2)',
          color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 3,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          boxShadow: '0 4px 15px rgba(0,153,204,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        ⏭ PROCESS DAY — GENERATE RESOURCES
      </button>

      {/* Daily production summary */}
      {Object.keys(kingdom.dailyProduction).length > 0 && (
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(0,153,204,0.04)',
          border: '1px solid rgba(0,153,204,0.1)',
        }}>
          <div style={{
            fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)',
            fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6,
          }}>
            LAST DAY PRODUCTION
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(kingdom.dailyProduction).filter(([, v]) => (v as number) > 0).map(([res, amount]) => (
              <div key={res} style={{
                padding: '3px 8px', borderRadius: 12,
                background: 'rgba(255,255,255,0.5)',
                fontSize: 7, fontWeight: 700, color: '#1a2a3a',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {res}: +{(amount as number).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Resources Tab ──
function ResourcesTab({ kingdom, onAllocChange }: {
  kingdom: Kingdom
  onAllocChange: (resId: ResourceId, pct: number) => void
}) {
  const production = kingdom.dailyProduction
  const categories = ['extraction', 'processed', 'info', 'social'] as const

  // Group resources by category
  const grouped = categories.map(cat => ({
    category: cat,
    label: cat === 'extraction' ? 'RAW MATERIALS' : cat === 'processed' ? 'PROCESSED' : cat === 'info' ? 'INTELLIGENCE' : 'SOCIAL',
    resources: Object.values(RESOURCES).filter(r => r.category === cat && (production[r.id] ?? 0) > 0),
  })).filter(g => g.resources.length > 0)

  const totalCrystals = calculateDailyCrystals(production, kingdom.resourceAllocation)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Crystal preview */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 20,
        background: 'linear-gradient(90deg, rgba(121,80,242,0.08), rgba(121,80,242,0.03))',
        border: '1px solid rgba(121,80,242,0.2)',
      }}>
        <CrystalIcon size="md" />
        <span style={{
          fontSize: 14, fontWeight: 900, color: '#7950f2',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {totalCrystals.toLocaleString()}
        </span>
        <span style={{
          fontSize: 7, color: 'rgba(26,42,58,0.4)', letterSpacing: 2,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          HEX/DAY
        </span>
      </div>

      {/* Resource groups */}
      {grouped.map(group => (
        <div key={group.category}>
          <div style={{
            fontSize: 7, fontWeight: 700, letterSpacing: 2,
            color: 'rgba(26,42,58,0.35)', marginBottom: 6,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.resources.map(res => {
              const amount = production[res.id] ?? 0
              const alloc = kingdom.resourceAllocation[res.id] ?? 0
              const crystalsFromThis = Math.floor(amount * (alloc / 100) * res.crystalRate)

              return (
                <div key={res.id} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(0,60,100,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ResourceIconSVG resourceId={res.id} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 8, fontWeight: 800, color: '#1a2a3a', letterSpacing: 1,
                        fontFamily: "'Orbitron', system-ui, sans-serif",
                      }}>
                        {res.name.toUpperCase()}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 900, color: res.color,
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      {amount.toLocaleString()}/d
                    </div>
                  </div>

                  {/* Allocation slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={0} max={100} value={alloc}
                      onChange={e => onAllocChange(res.id, parseInt(e.target.value))}
                      style={{
                        flex: 1, height: 4, appearance: 'none', borderRadius: 2,
                        background: 'rgba(0,60,100,0.08)', outline: 'none', cursor: 'pointer',
                        accentColor: res.color,
                      }}
                    />
                    <span style={{
                      fontSize: 8, fontWeight: 900, color: res.color, minWidth: 28, textAlign: 'right',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      {alloc}%
                    </span>
                    <span style={{
                      fontSize: 7, color: '#7950f2', minWidth: 40, textAlign: 'right',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      → {crystalsFromThis}◆
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* No production state */}
      {grouped.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 40, color: 'rgba(26,42,58,0.35)',
          fontSize: 8, letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          NO TERRITORIES PRODUCING YET
          <br /><br />
          CONQUER TERRITORIES TO START PRODUCTION
        </div>
      )}
    </div>
  )
}

// ── Conquest Tab ──
function ConquestTab({ kingdom }: { kingdom: Kingdom }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 7, fontWeight: 700, letterSpacing: 2,
        color: 'rgba(26,42,58,0.35)', marginBottom: 4,
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        EXPANSION METHODS
      </div>

      {[
        {
          icon: '⚔️', name: 'ASSAULT', color: '#dc2626',
          desc: 'Military attack. Costs resources + troops. Lower cost if adjacent. Success not guaranteed.',
          stats: ['Cost: Oil + Steel', 'Duration: 5-15min', 'Success: 45-70%'],
        },
        {
          icon: '💰', name: 'PURCHASE', color: '#d97706',
          desc: 'Buy territory with crystals. Instant for adjacent. Requires influence for rare POIs.',
          stats: ['Cost: 500-10000 ◆', 'Duration: Instant-5min', 'Success: 100%'],
        },
        {
          icon: '🕵️', name: 'INFILTRATION', color: '#059669',
          desc: 'Covert takeover via spies & data. Requires Data + Components. Medium cost, medium time.',
          stats: ['Cost: Data + Components', 'Duration: 10-30min', 'Success: 60%'],
        },
      ].map(method => (
        <div key={method.name} style={{
          padding: 12, borderRadius: 10,
          background: `linear-gradient(135deg, ${method.color}06, transparent)`,
          border: `1.5px solid ${method.color}20`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{method.icon}</span>
            <div style={{
              fontSize: 9, fontWeight: 900, color: method.color, letterSpacing: 2,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              {method.name}
            </div>
          </div>
          <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.55)', lineHeight: 1.5, marginBottom: 8 }}>
            {method.desc}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {method.stats.map(stat => (
              <div key={stat} style={{
                flex: 1, padding: '4px 6px', borderRadius: 6,
                background: 'rgba(255,255,255,0.4)',
                fontSize: 6, color: 'rgba(26,42,58,0.5)', textAlign: 'center',
                fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.5,
              }}>
                {stat}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Adjacency bonus */}
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(0,153,204,0.06)',
        border: '1px solid rgba(0,153,204,0.15)',
        fontSize: 8, color: '#0099cc', lineHeight: 1.6,
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        💡 ADJACENT TERRITORIES COST 3.5× LESS AND SUCCEED MORE OFTEN
      </div>

      {/* Influence requirement */}
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(204,136,0,0.06)',
        border: '1px solid rgba(204,136,0,0.15)',
        fontSize: 8, color: '#cc8800', lineHeight: 1.6,
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        🏛 RARE LANDMARKS REQUIRE HIGH INFLUENCE LEVEL TO PURCHASE OR INFILTRATE
      </div>
    </div>
  )
}

// ── Main KingdomPanel ──
export function KingdomPanel({ onClose }: Props) {
  const [tab, setTab] = useState('overview')
  const setActivePanel = useStore(s => s.setActivePanel)
  const {
    kingdoms, activeKingdomId, setActiveKingdom,
    setResourceAllocation, setBranchAllocation,
    pourCrystals, chooseFork, processDay,
  } = useKingdomStore()

  const kingdom = kingdoms.find(k => k.id === activeKingdomId) ?? kingdoms[0]

  // Demo kingdom if none exist
  const demoKingdom: Kingdom | null = kingdom ?? null

  if (!demoKingdom) {
    return (
      <GlassPanel title="KINGDOMS" onClose={onClose} accent="#cc8800" width={420}>
        <div style={{
          textAlign: 'center', padding: 40, color: 'rgba(26,42,58,0.35)',
          fontSize: 8, letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          NO KINGDOMS YET
          <br /><br />
          CLAIM YOUR FIRST TERRITORY TO CREATE A KINGDOM
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel
      title={demoKingdom.name.toUpperCase()}
      onClose={onClose}
      accent={demoKingdom.color || '#cc8800'}
      width={tab === 'skills' ? 960 : 420}
    >
      {/* Kingdom selector (if multiple) */}
      {kingdoms.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto' }}>
          {kingdoms.map(k => (
            <button
              key={k.id}
              onClick={() => setActiveKingdom(k.id)}
              style={{
                padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                fontSize: 7, fontWeight: k.id === activeKingdomId ? 800 : 500,
                letterSpacing: 1,
                background: k.id === activeKingdomId ? `${k.color}15` : 'rgba(255,255,255,0.4)',
                color: k.id === activeKingdomId ? k.color : 'rgba(26,42,58,0.45)',
                border: `1px solid ${k.id === activeKingdomId ? `${k.color}30` : 'rgba(0,60,100,0.08)'}`,
                fontFamily: "'Orbitron', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              🏰 {k.name.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 20, cursor: 'pointer',
              fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
              background: tab === t.id ? `rgba(204,136,0,0.1)` : 'rgba(255,255,255,0.5)',
              color: tab === t.id ? '#cc8800' : 'rgba(26,42,58,0.45)',
              fontFamily: "'Orbitron', system-ui, sans-serif",
              border: `1px solid ${tab === t.id ? 'rgba(204,136,0,0.3)' : 'rgba(0,60,100,0.1)'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {tab === 'overview' && <OverviewTab kingdom={demoKingdom} onProcessDay={() => {
            const biomes = ['urban','rural','forest','mountain','coastal','desert','industrial','tundra','landmark'] as const
            const mockTerritories = demoKingdom.territories.map((_, i) => ({
              biome: biomes[i % biomes.length],
              rarity: i === 0 ? 'rare' : i < 3 ? 'uncommon' : 'common',
            }))
            const result = processDay(demoKingdom.id, mockTerritories)
            toast.success(`⏭ Day processed: +${result.crystalsGenerated.toLocaleString()} crystals generated`)
          }} />}
          {tab === 'resources' && (
            <ResourcesTab
              kingdom={demoKingdom}
              onAllocChange={(resId, pct) => setResourceAllocation(demoKingdom.id, resId, pct)}
            />
          )}
          {tab === 'skills' && (
            <SkillTreeView
              kingdom={demoKingdom}
              onPour={(skillId, amount) => pourCrystals(demoKingdom.id, skillId, amount)}
              onForkChoice={(skillId) => chooseFork(demoKingdom.id, skillId)}
              onBranchAllocChange={(branchId, pct) => setBranchAllocation(demoKingdom.id, branchId, pct)}
            />
          )}
          {tab === 'conquest' && <ConquestTab kingdom={demoKingdom} />}
        </motion.div>
      </AnimatePresence>

      {/* Cross-panel CTAs */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }}
          style={{
            flex: 1, padding: '10px', borderRadius: 20,
            background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
            color: '#cc8800', fontSize: 7, fontWeight: 700, letterSpacing: 2,
            cursor: 'pointer', fontFamily: "'Orbitron', system-ui, sans-serif",
          }}
        >
          🛒 KINGDOM BOOSTS → SHOP
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('trade'), 100) }}
          style={{
            flex: 1, padding: '10px', borderRadius: 20,
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e', fontSize: 7, fontWeight: 700, letterSpacing: 2,
            cursor: 'pointer', fontFamily: "'Orbitron', system-ui, sans-serif",
          }}
        >
          📊 TRADE RESOURCES →
        </button>
      </div>
    </GlassPanel>
  )
}
