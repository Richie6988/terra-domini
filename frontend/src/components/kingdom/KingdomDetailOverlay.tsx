/**
 * KingdomDetailOverlay — Fullscreen kingdom detail view.
 * 
 * Opened when clicking a kingdom badge or territory inside a kingdom.
 * 
 * YOUR KINGDOM:
 *   Overview → Territories list → Resources → Skill Tree → Army
 * 
 * ENEMY KINGDOM:
 *   Intelligence view → Attack options → Spy → Diplomacy
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import { ClaimProgressBar, type ClaimProgress } from '../shared/ClaimProgressBar'
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'

interface KingdomData {
  cluster_id: string
  name: string
  size: number
  tier: number
  is_main: boolean
  color: string
  owner_id: number
  owner_username: string
  tdc_per_24h: number
  h3_indexes: string[]
  centroid_lat: number
  centroid_lon: number
  territories: TerritoryInKingdom[]
  total_defense: number
  total_attack: number
  resources?: Record<string, number>
  pending_claims?: ClaimProgress[]
}

interface TerritoryInKingdom {
  h3_index: string
  name: string
  rarity: string
  biome: string
  income_per_day: number
  defense_points: number
  is_capital: boolean
  has_shield: boolean
  poi_category?: string
}

interface Props {
  kingdom: KingdomData
  isOwn: boolean
  onClose: () => void
}

// ═══ Rarity colors ═══
const RC: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
}

// ═══ STYLES ═══
const sectionBox: React.CSSProperties = {
  padding: 14, borderRadius: 12,
  background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)',
}
const statCard = (color: string): React.CSSProperties => ({
  padding: '10px 8px', borderRadius: 10, textAlign: 'center',
  background: `${color}08`, border: `1px solid ${color}20`,
})
const label: React.CSSProperties = {
  fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)',
  fontFamily: "'Orbitron', sans-serif", marginBottom: 2,
}
const val = (c: string): React.CSSProperties => ({
  fontSize: 16, fontWeight: 900, color: c,
  fontFamily: "'Share Tech Mono', monospace",
})

// ════════════════════════════════════════════════════════════════
// OWN KINGDOM TABS
// ════════════════════════════════════════════════════════════════

function OwnOverview({ k }: { k: KingdomData }) {
  const totalIncome = k.territories.reduce((s, t) => s + t.income_per_day, 0)
  const rarityCount = k.territories.reduce((m, t) => {
    m[t.rarity] = (m[t.rarity] || 0) + 1; return m
  }, {} as Record<string, number>)
  const shields = k.territories.filter(t => t.has_shield).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <div style={statCard('#0099cc')}>
          <div style={label}>TERRITORIES</div>
          <div style={val('#0099cc')}>{k.size}</div>
        </div>
        <div style={statCard('#cc8800')}>
          <div style={label}>INCOME/DAY</div>
          <div style={{ ...val('#cc8800'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <CrystalIcon size="sm" /> {totalIncome}
          </div>
        </div>
        <div style={statCard('#dc2626')}>
          <div style={label}>ATTACK PWR</div>
          <div style={val('#dc2626')}>{k.total_attack}</div>
        </div>
        <div style={statCard('#3b82f6')}>
          <div style={label}>DEFENSE</div>
          <div style={val('#3b82f6')}>{k.total_defense}</div>
        </div>
      </div>

      {/* Rarity breakdown */}
      <div style={sectionBox}>
        <div style={{ ...label, marginBottom: 8 }}>RARITY DISTRIBUTION</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(rarityCount).sort((a, b) => b[1] - a[1]).map(([r, c]) => (
            <div key={r} style={{
              padding: '4px 10px', borderRadius: 8,
              background: `${RC[r] || '#999'}15`, border: `1px solid ${RC[r] || '#999'}30`,
              fontSize: 9, fontWeight: 700, color: RC[r] || '#999',
            }}>
              {c}× {r.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Pending claims */}
      {k.pending_claims && k.pending_claims.length > 0 && (
        <div style={sectionBox}>
          <div style={{ ...label, marginBottom: 8 }}>ONGOING CLAIMS ({k.pending_claims.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {k.pending_claims.map(c => (
              <ClaimProgressBar key={c.id} claim={c} />
            ))}
          </div>
        </div>
      )}

      {/* Shields */}
      <div style={sectionBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={label}>ACTIVE SHIELDS</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
              {shields}/{k.size} territories protected
            </div>
          </div>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: shields > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: `2px solid ${shields > 0 ? '#3b82f6' : '#ccc'}30`,
          }}></div>
        </div>
      </div>
    </div>
  )
}

function OwnTerritories({ k }: { k: KingdomData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {k.territories.map(t => (
        <div key={t.h3_index} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, background: t.is_capital ? 'rgba(204,136,0,0.06)' : 'rgba(255,255,255,0.4)',
          border: `1px solid ${t.is_capital ? 'rgba(204,136,0,0.2)' : 'rgba(255,255,255,0.05)'}`,
        }}>
          {/* Capital badge */}
          {t.is_capital && <span style={{ fontSize: 14 }}></span>}

          {/* Name + rarity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#e2e8f0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.name || t.h3_index.slice(0, 12)}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 700,
                background: `${RC[t.rarity] || '#999'}15`, color: RC[t.rarity] || '#999',
              }}>{t.rarity?.toUpperCase()}</span>
              <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 600,
                background: 'rgba(0,60,100,0.04)', color: 'rgba(255,255,255,0.4)',
              }}>{t.biome?.toUpperCase()}</span>
              {t.poi_category && <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 600,
                background: 'rgba(121,80,242,0.08)', color: '#7950f2',
              }}>POI</span>}
            </div>
          </div>

          {/* Income */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>
              +{t.income_per_day}
            </div>
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)' }}>HEX/DAY</div>
          </div>

          {/* Defense */}
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 36 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>{t.defense_points}</div>
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)' }}>DEF</div>
          </div>

          {/* Shield */}
          {t.has_shield && <span style={{ fontSize: 12, opacity: 0.6 }}></span>}
        </div>
      ))}
    </div>
  )
}

function OwnArmy({ k }: { k: KingdomData }) {
  const units = [
    { name: 'Infantry', icon: 'dagger', count: 24, atk: 10, def: 8, color: '#dc2626' },
    { name: 'Naval', icon: 'anchor', count: 3, atk: 35, def: 30, color: '#0099cc' },
    { name: 'Aerial', icon: 'plane', count: 1, atk: 45, def: 15, color: '#8b5cf6' },
    { name: 'Engineer', icon: 'wrench', count: 5, atk: 8, def: 20, color: '#cc8800' },
    { name: 'Medic', icon: 'medicine', count: 2, atk: 2, def: 5, color: '#22c55e' },
    { name: 'Spy', icon: 'spy', count: 1, atk: 15, def: 3, color: '#475569' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={statCard('#dc2626')}>
          <div style={label}>TOTAL ATK</div>
          <div style={val('#dc2626')}>{k.total_attack}</div>
        </div>
        <div style={statCard('#3b82f6')}>
          <div style={label}>TOTAL DEF</div>
          <div style={val('#3b82f6')}>{k.total_defense}</div>
        </div>
      </div>

      {units.map(u => (
        <div key={u.name} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, background: 'rgba(255,255,255,0.4)',
          border: `1px solid ${u.color}15`,
        }}>
          <span style={{ fontSize: 18 }}><EmojiIcon emoji={u.icon} size={16} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{u.name}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>ATK {u.atk} · DEF {u.def}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: u.color, fontFamily: "'Share Tech Mono', monospace" }}>
            ×{u.count}
          </div>
          <button style={{
            padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
            background: `${u.color}10`, border: `1px solid ${u.color}25`,
            color: u.color, fontSize: 7, fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif",
          }} onClick={() => toast.success(`Recruiting ${u.name}...`)}>
            + RECRUIT
          </button>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ENEMY KINGDOM VIEW
// ════════════════════════════════════════════════════════════════

function EnemyView({ k, onClose }: { k: KingdomData; onClose: () => void }) {
  const [spyLevel, setSpyLevel] = useState(0) // 0=nothing, 1=basic, 2=resources, 3=army
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Enemy header */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))',
        border: '1px solid rgba(220,38,38,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 7, fontWeight: 900,
            background: 'rgba(220,38,38,0.12)', color: '#dc2626', letterSpacing: 2,
          }}>ENEMY</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            {k.owner_username}
          </span>
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
          Tier {k.tier} · {k.size} territories
        </div>
      </div>

      {/* Visible stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={statCard('#dc2626')}>
          <div style={label}>TERRITORIES</div>
          <div style={val('#dc2626')}>{k.size}</div>
        </div>
        <div style={statCard('#475569')}>
          <div style={label}>EST. POWER</div>
          <div style={val('#475569')}>{k.total_attack + k.total_defense}</div>
        </div>
        <div style={statCard('#8b5cf6')}>
          <div style={label}>TIER</div>
          <div style={val('#8b5cf6')}>{k.tier}</div>
        </div>
      </div>

      {/* Intelligence */}
      <div style={sectionBox}>
        <div style={{ ...label, marginBottom: 8 }}>INTELLIGENCE (LEVEL {spyLevel})</div>
        {spyLevel === 0 && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
            Send a spy mission to reveal enemy resources, army composition, and weaknesses.
          </div>
        )}
        {spyLevel >= 1 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.04)' }}>
            Defense: ~{k.total_defense} points · Shield active on {Math.floor(k.size * 0.3)} territories
          </div>
        )}
        {spyLevel >= 2 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.04)', marginTop: 4 }}>
            Resources: ~{Math.round(k.tdc_per_24h)} HEX/day income
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ ...label, marginTop: 4 }}>ACTIONS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('combat'), 100) }} style={{
          padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(220,38,38,0.04))',
          border: '1px solid rgba(220,38,38,0.2)',
          color: '#dc2626', fontSize: 10, fontWeight: 900, letterSpacing: 1,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          ATTACK
        </button>
        <button onClick={() => { setSpyLevel(s => Math.min(3, s + 1)); toast.success('Spy mission sent!') }} style={{
          padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(71,85,105,0.08), rgba(71,85,105,0.04))',
          border: '1px solid rgba(71,85,105,0.2)',
          color: '#475569', fontSize: 10, fontWeight: 900, letterSpacing: 1,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          SPY ({spyLevel < 3 ? `LVL ${spyLevel + 1}` : 'MAX'})
        </button>
        <button onClick={() => toast.success('Diplomacy request sent!')} style={{
          padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))',
          border: '1px solid rgba(34,197,94,0.2)',
          color: '#22c55e', fontSize: 10, fontWeight: 900, letterSpacing: 1,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          DIPLOMACY
        </button>
        <button onClick={() => toast.success('Buy offer sent!')} style={{
          padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(204,136,0,0.08), rgba(204,136,0,0.04))',
          border: '1px solid rgba(204,136,0,0.2)',
          color: '#cc8800', fontSize: 10, fontWeight: 900, letterSpacing: 1,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          BUY OFFER
        </button>
      </div>

      {/* Territory list (limited view) */}
      <div style={sectionBox}>
        <div style={{ ...label, marginBottom: 6 }}>VISIBLE TERRITORIES ({k.size})</div>
        {k.territories.slice(0, 5).map(t => (
          <div key={t.h3_index} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            borderBottom: '1px solid rgba(0,60,100,0.04)',
          }}>
            <span style={{
              padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 700,
              background: `${RC[t.rarity] || '#999'}15`, color: RC[t.rarity] || '#999',
            }}>{t.rarity?.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: '#e2e8f0', flex: 1 }}>{t.name || t.h3_index.slice(0, 12)}</span>
            <span style={{ fontSize: 8, color: '#3b82f6', fontWeight: 700 }}>DEF {t.defense_points}</span>
          </div>
        ))}
        {k.size > 5 && (
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 6 }}>
            +{k.size - 5} more {spyLevel < 1 ? '(send spy to reveal)' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN OVERLAY
// ════════════════════════════════════════════════════════════════

const OWN_TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'territories', label: 'TERRITORIES' },
  { id: 'army', label: 'ARMY', iconId: 'swords' },
]

export function KingdomDetailOverlay({ kingdom: k, isOwn, onClose }: Props) {
  const [tab, setTab] = useState('overview')

  const content = createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1800,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '94vw', maxWidth: 800, maxHeight: '92vh',
            background: 'linear-gradient(180deg, rgba(13,27,42,0.95), rgba(10,22,40,0.95))',
            backdropFilter: 'blur(30px)',
            border: `2px solid ${isOwn ? (k.color || '#0099cc') : '#dc2626'}30`,
            borderRadius: 16,
            boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${isOwn ? k.color || '#0099cc' : '#dc2626'}15`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: `2px solid ${isOwn ? k.color || '#0099cc' : '#dc2626'}`,
            background: `linear-gradient(180deg, ${isOwn ? k.color || '#0099cc' : '#dc2626'}08, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Kingdom icon */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `linear-gradient(135deg, ${isOwn ? k.color : '#dc2626'}, ${isOwn ? k.color : '#dc2626'}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: `0 0 16px ${isOwn ? k.color : '#dc2626'}30`,
              }}>
                {isOwn ? '' : '×'}
              </div>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 900, letterSpacing: 2, color: '#e2e8f0',
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  {k.name?.toUpperCase() || (isOwn ? 'MY KINGDOM' : `${k.owner_username}'S KINGDOM`)}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
                  TIER {k.tier} · {k.size} TERRITORIES
                  {!isOwn && ` · OWNER: ${k.owner_username}`}
                </div>
              </div>
            </div>
            {/* Close */}
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.45)', fontSize: 18,
            }}></button>
          </div>

          {/* Tabs (own only) */}
          {isOwn && (
            <div style={{
              display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              {OWN_TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
                  background: tab === t.id ? `${k.color || '#0099cc'}10` : 'transparent',
                  borderBottom: tab === t.id ? `2px solid ${k.color || '#0099cc'}` : '2px solid transparent',
                  color: tab === t.id ? k.color || '#0099cc' : 'rgba(255,255,255,0.4)',
                  fontSize: 8, fontWeight: 700, letterSpacing: 1,
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {isOwn ? (
              <>
                {tab === 'overview' && <OwnOverview k={k} />}
                {tab === 'territories' && <OwnTerritories k={k} />}
                {tab === 'army' && <OwnArmy k={k} />}
              </>
            ) : (
              <EnemyView k={k} onClose={onClose} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )

  return content
}
