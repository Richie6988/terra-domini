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
import { KingdomArmyTab } from './KingdomArmyTab'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import { ClaimProgressBar, type ClaimProgress } from '../shared/ClaimProgressBar'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'
import { Lock, Shield, Crown, Swords } from 'lucide-react'

/** /combat/my-army/ returns units as {key: {owned,...}} — accept legacy number form too */

const SoonChip = () => (
  <span className="hx-chip" style={{ fontSize: 9, padding: '2px 6px', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)' }}>SOON</span>
)


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
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
}
const statCard = (color: string): React.CSSProperties => ({
  padding: '10px 8px', borderRadius: 10, textAlign: 'center',
  background: `${color}08`, border: `1px solid ${color}20`,
})
const label: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)',
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
            <IconSVG id="hex_coin" size={12} /> {totalIncome}
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
            background: shields > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: shields > 0 ? '#3b82f6' : 'rgba(255,255,255,0.4)',
            border: `2px solid ${shields > 0 ? '#3b82f640' : 'rgba(255,255,255,0.12)'}`,
          }}><Shield size={22} /></div>
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
          borderRadius: 10, background: t.is_capital ? 'rgba(204,136,0,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${t.is_capital ? 'rgba(204,136,0,0.2)' : 'rgba(255,255,255,0.05)'}`,
        }}>
          {/* Capital badge */}
          {t.is_capital && <span style={{ color: '#cc8800', display: 'flex' }} aria-label="Capital"><Crown size={16} /></span>}

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
                padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                background: `${RC[t.rarity] || '#999'}15`, color: RC[t.rarity] || '#999',
              }}>{t.rarity?.toUpperCase()}</span>
              <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)',
              }}>{t.biome?.toUpperCase()}</span>
              {t.poi_category && <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: 'rgba(121,80,242,0.08)', color: '#7950f2',
              }}>POI</span>}
            </div>
          </div>

          {/* Income */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>
              +{t.income_per_day}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>HEX/DAY</div>
          </div>

          {/* Defense */}
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 36 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>{t.defense_points}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>DEF</div>
          </div>

          {/* Shield */}
          {t.has_shield && <span style={{ color: '#3b82f6', display: 'flex', opacity: 0.8 }} aria-label="Shielded"><Shield size={14} /></span>}
        </div>
      ))}
    </div>
  )
}

function OwnArmy({ k }: { k: KingdomData }) {
  // The military is 3 counters per kingdom (combat/forces.py): same tab as the kingdom hub
  return <KingdomArmyTab h3={k.h3_indexes?.[0] || ''} />
}

// ════════════════════════════════════════════════════════════════
// ENEMY KINGDOM VIEW
// ════════════════════════════════════════════════════════════════

function EnemyView({ k, onClose }: { k: KingdomData; onClose: () => void }) {
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
            padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900,
            background: 'rgba(220,38,38,0.12)', color: '#dc2626', letterSpacing: 2,
          }}>ENEMY</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            {k.owner_username}
          </span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
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
        <div style={{ ...label, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>INTELLIGENCE <SoonChip /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: 'rgba(255,255,255,0.5)', padding: '10px 4px', lineHeight: 1.5 }}>
          <Lock size={18} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)' }} />
          Spy missions are not available yet. They will reveal enemy resources, army composition and weaknesses.
        </div>
      </div>

      {/* Actions */}
      <div style={{ ...label, marginTop: 4 }}>ACTIONS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('combat'), 100) }}
          className="btn-game btn-game-red" style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Swords size={16} /> ATTACK
        </button>
        {[
          { id: 'spy', label: 'SPY', icon: 'spy' },
          { id: 'diplomacy', label: 'DIPLOMACY', icon: 'handshake' },
          { id: 'buy', label: 'BUY OFFER', icon: 'money_bag' },
        ].map(a => (
          <button key={a.id} disabled aria-disabled="true" title="Coming soon" style={{
            minHeight: 48, padding: '10px 12px', borderRadius: 12, cursor: 'not-allowed',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 900, letterSpacing: 1,
            fontFamily: "'Orbitron', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ opacity: 0.5, display: 'flex' }}><IconSVG id={a.icon} size={18} /></span>
            {a.label} <SoonChip />
          </button>
        ))}
      </div>

      {/* Territory list (limited view) */}
      <div style={sectionBox}>
        <div style={{ ...label, marginBottom: 6 }}>VISIBLE TERRITORIES ({k.size})</div>
        {k.territories.slice(0, 5).map(t => (
          <div key={t.h3_index} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}>
            <span style={{
              padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
              background: `${RC[t.rarity] || '#999'}15`, color: RC[t.rarity] || '#999',
            }}>{t.rarity?.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: '#e2e8f0', flex: 1 }}>{t.name || t.h3_index.slice(0, 12)}</span>
            <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700 }}>DEF {t.defense_points}</span>
          </div>
        ))}
        {k.size > 5 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 6 }}>
            +{k.size - 5} more
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
                color: '#fff', boxShadow: `0 0 16px ${isOwn ? k.color : '#dc2626'}30`,
              }}>
                {isOwn ? <Crown size={20} /> : <Swords size={20} />}
              </div>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 900, letterSpacing: 2, color: '#e2e8f0',
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  {k.name?.toUpperCase() || (isOwn ? 'MY KINGDOM' : `${k.owner_username}'S KINGDOM`)}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
                  TIER {k.tier} · {k.size} TERRITORIES
                  {!isOwn && ` · OWNER: ${k.owner_username}`}
                </div>
              </div>
            </div>
            {/* Close */}
            <button onClick={onClose} className="hx-close" aria-label="Close">×</button>
          </div>

          {/* Tabs (own only) */}
          {isOwn && (
            <div className="hx-tabs" style={{ margin: '12px 20px 0', flexShrink: 0, ['--accent' as any]: k.color || '#cc8800' }}>
              {OWN_TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className="hx-tab" aria-selected={tab === t.id}>
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
