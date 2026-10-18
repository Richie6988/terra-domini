/**
 * KingdomPanel — HEXOD Kingdom Management Center.
 * Tabs: Overview, Resources, Skill Tree, Conquest
 * Opened from HexodDock "kingdom" button or territory context.
 */
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassPanel } from '../shared/GlassPanel'
import { ResourceIconSVG, IconSVG } from '../shared/iconBank'
import { SkillTreeView } from './SkillTreeView'
import { useKingdomStore } from '../../store/kingdomStore'
import { useServerKingdomCustom, useSaveKingdomCustom, withLegacy } from './kingdomCustom'
import { useStore, usePlayer } from '../../store'
import { api } from '../../services/api'
import { EmojiIcon } from '../shared/emojiIcons'
import { Crown, Castle, Pickaxe, Network, Flag, Shield, ShieldOff, FastForward, Info } from 'lucide-react'
import {
  RESOURCES, BIOME_PRODUCTION, SKILL_BRANCHES,
  calculateKingdomProduction, calculateDailyHex, getBranchProgress,
  type BranchId, type ResourceId, type Kingdom,
} from '../../types/kingdom.types'

const TABS = [
  { id: 'overview', label: 'OVERVIEW', Icon: Castle },
  { id: 'resources', label: 'RESOURCES', Icon: Pickaxe },
  { id: 'skills', label: 'SKILL TREE', Icon: Network },
  { id: 'conquest', label: 'CONQUEST', Icon: Flag },
]

const HEAD = "'Orbitron', system-ui, sans-serif"
const MONO = "'Share Tech Mono', monospace"
const fieldLabel: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 6, fontFamily: HEAD }
const HEX_CLIP = 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)'

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block', cursor: 'pointer' }}>
      <div style={fieldLabel}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '4px 10px 4px 4px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.16)' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{
          width: 32, height: 32, padding: 0, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer',
        }} />
        <span style={{ fontSize: 12, color: '#e2e8f0', fontFamily: MONO, textTransform: 'uppercase' }}>{value}</span>
      </div>
    </label>
  )
}

interface Props { onClose: () => void }

// ── Kingdom Customization UI ──
function CustomizationBlock({ kingdom }: { kingdom: Kingdom }) {
  const anchor = kingdom.capitalHex || kingdom.territories[0]
  const server = useServerKingdomCustom(anchor)
  const cust = withLegacy(server)
  const save = useSaveKingdomCustom()
  const [name, setName] = useState(cust.name || kingdom.name)
  const [fillColor, setFillColor] = useState(cust.fillColor || kingdom.color)
  const [borderColor, setBorderColor] = useState(cust.borderColor || kingdom.color)
  const [imageUrl, setImageUrl] = useState(cust.imageUrl || '')
  const [showDiaporama, setShowDiaporama] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {   // server data can arrive after the first render
    if (cust.name) setName(cust.name)
    if (cust.fillColor) setFillColor(cust.fillColor)
    if (cust.borderColor) setBorderColor(cust.borderColor)
    if (cust.imageUrl) setImageUrl(cust.imageUrl)
  }, [cust.name, cust.fillColor, cust.borderColor, cust.imageUrl])

  const saveCustomization = async () => {
    if (!anchor) return
    setSaving(true)
    try {
      const r = await save(anchor, { name, fillColor, borderColor, imageUrl })
      toast.success(`${name} saved — ${r.applied} territor${r.applied > 1 ? 'ies' : 'y'} updated on the map`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <div className="hx-card">
      <div className="hx-section-title" style={{ marginTop: 0 }}>KINGDOM CUSTOMIZATION</div>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <div style={fieldLabel}>NAME</div>
        <input className="hx-input" value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="My Empire" style={{ fontFamily: MONO, boxSizing: 'border-box' }} />
      </div>

      {/* Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <ColorField label="FILL COLOR" value={fillColor} onChange={setFillColor} />
        <ColorField label="BORDER COLOR" value={borderColor} onChange={setBorderColor} />
      </div>

      {/* Image embed */}
      <div style={{ marginBottom: 14 }}>
        <div style={fieldLabel}>EMBED IMAGE URL (OPTIONAL)</div>
        <input className="hx-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={{ fontFamily: MONO, boxSizing: 'border-box' }} />
        {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} onError={e => (e.currentTarget.style.display = 'none')} />}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={saveCustomization} disabled={saving} className="btn-game btn-game-gold" style={{ flex: 1, minHeight: 42, fontSize: 10, letterSpacing: 2 }}>
          {saving ? 'SAVING…' : 'SAVE'}
        </button>
        <button onClick={() => setShowDiaporama(v => !v)} className="btn-game btn-game-glass" style={{ flex: 1, minHeight: 42, fontSize: 10, letterSpacing: 2 }}>
          {showDiaporama ? 'HIDE TOKENS' : 'VIEW TOKENS'}
        </button>
      </div>

      {/* Token diaporama */}
      {showDiaporama && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ ...fieldLabel, marginBottom: 0 }}>TERRITORIES IN KINGDOM ({kingdom.territories.length})</div>
            <button onClick={() => setShowDiaporama(false)} className="hx-close" aria-label="Close token list">×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {kingdom.territories.slice(0, 20).map((t, i) => (
              <div key={i} style={{ width: 72, height: 72, flexShrink: 0, clipPath: HEX_CLIP, background: borderColor, padding: 2, boxSizing: 'border-box' }}>
                <div style={{
                  width: '100%', height: '100%', clipPath: HEX_CLIP,
                  background: `linear-gradient(160deg, ${fillColor}66, ${fillColor}22), #0d1b2a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#e2e8f0', fontFamily: HEAD,
                }}>
                  HEX {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ──
function OverviewTab({ kingdom, onProcessDay }: { kingdom: Kingdom; onProcessDay: () => void }) {
  const totalSkills = SKILL_BRANCHES.reduce((sum, b) => {
    const prog = getBranchProgress(kingdom.skillStates, b.id)
    return sum + prog.completed
  }, 0)
  const maxSkills = SKILL_BRANCHES.reduce((sum, b) => sum + b.skills.length, 0)
  const cust = useServerKingdomCustom(kingdom.capitalHex || kingdom.territories[0])
  const displayName = cust.name || kingdom.name
  const displayColor = cust.fillColor || kingdom.color

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Kingdom hero */}
      <div className="hx-card" style={{
        padding: '18px 16px',
        background: cust.imageUrl
          ? `linear-gradient(135deg, ${displayColor}30, rgba(6,14,26,0.85)), url(${cust.imageUrl}) center/cover`
          : `radial-gradient(circle at 50% 0%, ${displayColor}30, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`,
        border: `1.5px solid ${(cust.borderColor || displayColor)}70`,
        textAlign: 'center',
      }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 10px', clipPath: HEX_CLIP, background: `linear-gradient(160deg, ${displayColor}, ${displayColor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', filter: `drop-shadow(0 0 16px ${displayColor}80)` }}>
          <Crown size={28} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#e2e8f0', letterSpacing: 3, fontFamily: HEAD, marginBottom: 8 }}>
          {(displayName || '').toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span className="hx-chip">{kingdom.territories.length} TERRITORIES</span>
          <span className="hx-chip" style={{ fontFamily: MONO }}>CAPITAL {kingdom.capitalHex.slice(0, 8)}…</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="hx-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'TERRITORIES', value: kingdom.territories.length, color: '#38bdf8' },
          { label: 'SKILLS', value: `${totalSkills}/${maxSkills}`, color: '#a78bfa' },
          { label: 'HEX/DAY', value: kingdom.dailyHex.toLocaleString(), color: '#cc8800', icon: true },
        ].map(stat => (
          <div key={stat.label} className="hx-card" style={{ padding: '10px 12px' }}>
            <div className="hx-stat">
              <span className="hx-stat__label">{stat.label}</span>
              <span className="hx-stat__value" style={{ color: stat.color, fontSize: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                {stat.icon && <IconSVG id="hex_coin" size={16} />}
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Branch progress bars */}
      <div className="hx-card">
        <div className="hx-section-title" style={{ marginTop: 0 }}>BRANCH PROGRESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SKILL_BRANCHES.map(branch => {
            const prog = getBranchProgress(kingdom.skillStates, branch.id)
            const pct = prog.total > 0 ? (prog.completed / prog.total) * 100 : 0
            return (
              <div key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${branch.color}22`, border: `1px solid ${branch.color}55` }}>
                  <EmojiIcon emoji={branch.icon} size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.7)', fontFamily: HEAD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.name.toUpperCase()}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: branch.color, fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}>{prog.completed}/{prog.total}</span>
                  </div>
                  <div className="hx-progress" style={{ ['--accent' as any]: branch.color }}>
                    <div className="hx-progress__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shield status */}
      <div className="hx-card" style={{
        padding: '10px 14px',
        background: kingdom.shieldActive ? 'rgba(34,197,94,0.08)' : 'rgba(220,38,38,0.06)',
        borderColor: kingdom.shieldActive ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.2)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 10, fontWeight: 700, color: kingdom.shieldActive ? '#22c55e' : 'rgba(255,255,255,0.55)',
        fontFamily: HEAD, letterSpacing: 1.5,
      }}>
        {kingdom.shieldActive ? <Shield size={16} /> : <ShieldOff size={16} />}
        {kingdom.shieldActive ? 'SHIELD ACTIVE' : 'SHIELD INACTIVE'}
        {kingdom.warZone && <span className="hx-chip" style={{ marginLeft: 'auto', color: '#ef4444', borderColor: '#ef444455', background: '#ef444418' }}>WAR ZONE</span>}
      </div>

      {/* Process Day — generate resources + HEX (local kingdom simulation) */}
      <div>
        <button
          onClick={onProcessDay}
          className="btn-game btn-game-blue"
          style={{ width: '100%', minHeight: 46, fontSize: 11, letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <FastForward size={16} /> PROCESS DAY — GENERATE RESOURCES
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>
          <Info size={11} /> Skill-tree simulation stored on this device
        </div>
      </div>

      {/* Daily production summary */}
      {Object.keys(kingdom.dailyProduction).length > 0 && (
        <div className="hx-card">
          <div className="hx-section-title" style={{ marginTop: 0 }}>LAST DAY PRODUCTION</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(kingdom.dailyProduction).filter(([, v]) => (v as number) > 0).map(([res, amount]) => (
              <span key={res} className="hx-chip" style={{ fontFamily: MONO, fontSize: 10, color: '#e2e8f0', padding: '3px 8px 3px 4px' }}>
                <ResourceIconSVG resourceId={res} size={16} />
                {(RESOURCES as any)[res]?.name || res} +{(amount as number).toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Customization block */}
      <CustomizationBlock kingdom={kingdom} />
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

  const totalHex = calculateDailyHex(production, kingdom.resourceAllocation)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* HEX preview */}
      <div className="hx-card hx-card--accent" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '14px 16px',
      }}>
        <IconSVG id="hex_coin" size={24} />
        <span style={{
          fontSize: 26, fontWeight: 900, color: '#cc8800',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {totalHex.toLocaleString()}
        </span>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 2,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          HEX/DAY
        </span>
      </div>

      {/* Resource groups */}
      {grouped.map(group => (
        <div key={group.category}>
          <div className="hx-section-title">{group.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.resources.map(res => {
              const amount = production[res.id] ?? 0
              const alloc = kingdom.resourceAllocation[res.id] ?? 0
              const hexFromThis = Math.floor(amount * (alloc / 100) * res.hexRate)

              return (
                <div key={res.id} className="hx-card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ResourceIconSVG resourceId={res.id} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: '#e2e8f0', letterSpacing: 1,
                        fontFamily: "'Orbitron', system-ui, sans-serif",
                      }}>
                        {res.name.toUpperCase()}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 900, color: res.color,
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
                        background: 'rgba(255,255,255,0.06)', outline: 'none', cursor: 'pointer',
                        accentColor: res.color,
                      }}
                    />
                    <span style={{
                      fontSize: 10, fontWeight: 900, color: res.color, minWidth: 32, textAlign: 'right',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      {alloc}%
                    </span>
                    <span style={{
                      fontSize: 10, color: '#cc8800', minWidth: 48, textAlign: 'right',
                      fontFamily: "'Share Tech Mono', monospace",
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                    }}>
                      +{hexFromThis} <IconSVG id="hex_coin" size={11} />
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
        <div className="hx-empty">
          <Pickaxe size={28} color="#cc8800" />
          <div className="hx-empty__title">NO TERRITORIES PRODUCING YET</div>
          <div>Process a day or conquer territories to start production</div>
        </div>
      )}
    </div>
  )
}

// ── Conquest Tab ──
function ConquestTab({ kingdom }: { kingdom: Kingdom }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hx-section-title" style={{ marginTop: 0, marginBottom: 0 }}>EXPANSION METHODS</div>

      {[
        {
          icon: 'swords', name: 'ASSAULT', color: '#dc2626',
          desc: 'Military attack. Costs resources + troops. Lower cost if adjacent. Success not guaranteed.',
          stats: ['Cost: Oil + Steel', 'Duration: 5-15min', 'Success: 45-70%'],
        },
        {
          icon: 'money_bag', name: 'PURCHASE', color: '#d97706',
          desc: 'Buy territory with HEX. Instant for adjacent. Requires influence for rare POIs.',
          stats: ['Cost: 500-10000 HEX', 'Duration: Instant-5min', 'Success: 100%'],
        },
        {
          icon: 'spy', name: 'INFILTRATION', color: '#059669',
          desc: 'Covert takeover via spies & data. Requires Data + Components. Medium cost, medium time.',
          stats: ['Cost: Data + Components', 'Duration: 10-30min', 'Success: 60%'],
        },
      ].map(method => (
        <div key={method.name} className="hx-card" style={{
          padding: 14,
          background: `linear-gradient(135deg, ${method.color}14, rgba(255,255,255,0.02))`,
          borderColor: `${method.color}40`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${method.color}22`, border: `1px solid ${method.color}55` }}><EmojiIcon emoji={method.icon} size={22} /></span>
            <div style={{
              fontSize: 12, fontWeight: 900, color: method.color, letterSpacing: 2,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              {method.name}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 10 }}>
            {method.desc}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {method.stats.map(stat => (
              <div key={stat} style={{
                flex: '1 1 90px', padding: '5px 8px', borderRadius: 8,
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 9, color: 'rgba(255,255,255,0.65)', textAlign: 'center',
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
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(56,189,248,0.08)',
        border: '1px solid rgba(0,153,204,0.15)',
        fontSize: 9, color: '#38bdf8', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        ADJACENT TERRITORIES COST 3.5× LESS AND SUCCEED MORE OFTEN
      </div>

      {/* Influence requirement */}
      <div style={{
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(204,136,0,0.08)',
        border: '1px solid rgba(204,136,0,0.15)',
        fontSize: 9, color: '#cc8800', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        <Crown size={16} style={{ flexShrink: 0 }} />
        RARE LANDMARKS REQUIRE HIGH INFLUENCE LEVEL TO PURCHASE OR INFILTRATE
      </div>
    </div>
  )
}

// ── Main KingdomPanel ──
export function KingdomPanel({ onClose }: Props) {
  const [tab, setTab] = useState('overview')
  const setActivePanel = useStore(s => s.setActivePanel)
  const player = usePlayer()
  const {
    kingdoms, activeKingdomId, setActiveKingdom, createKingdom,
    setResourceAllocation, setBranchAllocation,
    pourHex, chooseFork, processDay,
  } = useKingdomStore()

  // Auto-sync kingdoms from backend API → local store
  const { data: apiData } = useQuery({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000,
    enabled: !!player,
  })

  useEffect(() => {
    const apiKingdoms = apiData?.kingdoms ?? []
    if (!apiKingdoms.length) return
    apiKingdoms.forEach((ak: any) => {
      const existsInStore = kingdoms.some(k => k.id === ak.cluster_id || k.capitalHex === ak.h3_indexes?.[0])
      if (!existsInStore && ak.h3_indexes?.length > 0) {
        createKingdom(
          ak.is_main ? 'Main Kingdom' : `Kingdom ${ak.cluster_id.slice(0, 6)}`,
          ak.is_main ? '#cc8800' : '#3b82f6',
          ak.h3_indexes[0],
          { lat: ak.centroid_lat, lng: ak.centroid_lon }
        )
      }
    })
  }, [apiData, kingdoms, createKingdom])

  const kingdom = kingdoms.find(k => k.id === activeKingdomId) ?? kingdoms[0]

  // Demo kingdom if none exist
  const demoKingdom: Kingdom | null = kingdom ?? null

  if (!demoKingdom) {
    return (
      <GlassPanel title="KINGDOMS" onClose={onClose} accent="#cc8800" width={420} icon={<Crown size={20} />} subtitle="Kingdom management">
        <div className="hx-empty">
          <Crown size={32} color="#cc8800" />
          <div className="hx-empty__title">NO KINGDOMS YET</div>
          <div>Claim your first territory to create a kingdom</div>
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel
      title={demoKingdom.name.toUpperCase()}
      onClose={onClose}
      accent={demoKingdom.color || '#cc8800'}
      width={tab === 'skills' ? 960 : 480}
      icon={<Crown size={20} />}
      subtitle={`${demoKingdom.territories.length} territories · skills, resources & conquest`}
    >
      {/* Kingdom selector (if multiple) */}
      {kingdoms.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {kingdoms.map(k => (
            <button
              key={k.id}
              onClick={() => setActiveKingdom(k.id)}
              style={{
                minHeight: 34, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
                fontSize: 9, fontWeight: k.id === activeKingdomId ? 800 : 600,
                letterSpacing: 1,
                background: k.id === activeKingdomId ? `${k.color}15` : 'rgba(255,255,255,0.03)',
                color: k.id === activeKingdomId ? k.color : 'rgba(255,255,255,0.55)',
                border: `1px solid ${k.id === activeKingdomId ? `${k.color}30` : 'rgba(255,255,255,0.06)'}`,
                fontFamily: "'Orbitron', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {k.name.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 10px', flex: '1 0 auto', gap: 4, fontSize: 9, letterSpacing: 0.8 }}>
            <t.Icon size={12} style={{ flexShrink: 0 }} /> {t.label}
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
            toast.success(`Day processed: +${result.hexGenerated.toLocaleString()} HEX generated`)
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
              onPour={(skillId, amount) => pourHex(demoKingdom.id, skillId, amount)}
              onForkChoice={(skillId) => chooseFork(demoKingdom.id, skillId)}
              onBranchAllocChange={(branchId, pct) => setBranchAllocation(demoKingdom.id, branchId, pct)}
            />
          )}
          {tab === 'conquest' && <ConquestTab kingdom={demoKingdom} />}
        </motion.div>
      </AnimatePresence>

      {/* Cross-panel CTAs */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            if (demoKingdom.center) {
              window.dispatchEvent(new CustomEvent('terra:flyto', {
                detail: { lat: demoKingdom.center.lat, lon: demoKingdom.center.lng, zoom: 15 }
              }))
              onClose()
            }
          }}
          className="btn-game btn-game-blue"
          style={{ flex: '1 1 100px', minHeight: 42, fontSize: 10, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <IconSVG id="target" size={14} /> VIEW ON MAP
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('combat'), 100) }}
          className="btn-game btn-game-red"
          style={{ flex: '1 1 100px', minHeight: 42, fontSize: 10, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <IconSVG id="swords" size={14} /> MILITARY
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }}
          className="btn-game btn-game-gold"
          style={{ flex: '1 1 100px', minHeight: 42, fontSize: 10, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <IconSVG id="cart" size={14} /> SHOP
        </button>
      </div>
    </GlassPanel>
  )
}
