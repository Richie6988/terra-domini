/**
 * EmpirePanel — Empire management hub.
 * 3 tabs: Kingdoms list (click→fly to kingdom), Military, Empire Stats.
 * Opened from dock "Empire" button.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Crown, Swords, BarChart3, MapPin, Timer, Flag } from 'lucide-react'
import { RegionsTab } from './RegionsTab'
import { GlassPanel } from '../shared/GlassPanel'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'


interface Props { onClose: () => void }
type Tab = 'kingdoms' | 'regions' | 'military' | 'stats'

const ACCENT = '#cc8800'
const TABS: { id: Tab; label: string; Icon: typeof Crown }[] = [
  { id: 'kingdoms', label: 'KINGDOMS', Icon: Crown },
  { id: 'regions', label: 'REGIONS', Icon: Flag },
  { id: 'military', label: 'MILITARY', Icon: Swords },
  { id: 'stats', label: 'STATS', Icon: BarChart3 },
]

const MONO = "'Share Tech Mono', monospace"
const HEAD = "'Orbitron', sans-serif"

interface Kingdom {
  cluster_id: string; name?: string; size: number; is_main: boolean; tier: number;
  tdc_per_24h: number; h3_indexes: string[]; centroid_lat: number; centroid_lon: number; color?: string;
  poi_count?: number; resources?: Record<string, number>;
}

const TIER_COLORS = ['#64748b', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#FF0080']

/** Backend rule (kingdom_engine.recompute_kingdoms): tier = min(6, size // 3) */
function tierProgress(k: Kingdom) {
  if (k.tier >= 6) return { pct: 100, next: null as number | null, need: 0 }
  const next = (k.tier + 1) * 3
  const base = k.tier * 3
  return { pct: Math.max(0, Math.min(100, ((k.size - base) / (next - base)) * 100)), next, need: next - k.size }
}

/** Custom name saved from the territory hub's CUSTOMIZE tab (localStorage) */
function kingdomName(k: Kingdom): string {
  try {
    const c = JSON.parse(localStorage.getItem(`hx_kingdom_${k.cluster_id}`) || '{}')
    if (c?.name) return c.name
  } catch {}
  return k.name || (k.is_main ? 'Main Kingdom' : `Kingdom ${(k.cluster_id || '').slice(0, 6)}`)
}

/** /combat/my-army/ returns units as {key: {owned, ...}}; accept legacy number form too */
const ownedCount = (v: any): number => typeof v === 'number' ? v : Number(v?.owned) || 0

const fmt = (n: number) => Math.round(n || 0).toLocaleString()

function HexEmblem({ color, size = 52, children }: { color: string; size?: number; children: React.ReactNode }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: 'relative', filter: `drop-shadow(0 4px 12px ${color}55)` }}>
      <div style={{
        position: 'absolute', inset: 0,
        clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)',
        background: `linear-gradient(160deg, ${color}, ${color}66)`,
      }} />
      <div style={{
        position: 'absolute', inset: 3,
        clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)',
        background: `linear-gradient(160deg, #13253a, #0a1628)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>{children}</div>
    </div>
  )
}

// ═══ KINGDOMS TAB ═══
function KingdomsTab({ kingdoms, loading, onTeleport }: { kingdoms: Kingdom[]; loading: boolean; onTeleport: (lat: number, lon: number) => void }) {
  if (loading) return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[0, 1].map(i => <div key={i} className="hx-skeleton" style={{ height: 112, borderRadius: 12 }} />)}
    </div>
  )
  if (!kingdoms.length) return (
    <div className="hx-empty">
      <Crown size={32} color={ACCENT} />
      <div className="hx-empty__title">NO KINGDOMS YET</div>
      <div>Claim 2+ adjacent territories to form a kingdom</div>
    </div>
  )
  const sorted = [...kingdoms].sort((a, b) => b.size - a.size)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10 }}>
      {sorted.map((k, i) => {
        const col = TIER_COLORS[Math.min(Math.max(k.tier, 0), 6)]
        const prog = tierProgress(k)
        const go = () => onTeleport(k.centroid_lat, k.centroid_lon)
        return (
          <div key={k.cluster_id}
            className={`hx-card hx-card--interactive hx-rise${k.is_main ? ' hx-card--accent' : ''}`}
            role="button" tabIndex={0} aria-label={`Fly to ${kingdomName(k)}`}
            onClick={go} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
            style={{ animationDelay: `${i * 50}ms`, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <HexEmblem color={k.is_main ? ACCENT : col}>
                {k.is_main ? <Crown size={22} /> : <IconSVG id="castle" size={24} />}
              </HexEmblem>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', fontFamily: HEAD, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {kingdomName(k).toUpperCase()}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {k.is_main && <span className="hx-chip hx-chip--accent"><Crown size={10} /> MAIN</span>}
                  <span className="hx-chip" style={{ color: col, borderColor: `${col}55`, background: `${col}18` }}>TIER {k.tier}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <IconSVG id="hex_coin" size={16} />
                  <span style={{ fontSize: 18, fontWeight: 900, color: ACCENT, fontFamily: MONO }}>+{fmt(k.tdc_per_24h)}</span>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, fontFamily: HEAD, marginTop: 2 }}>HEX / DAY</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { l: 'TERRITORIES', v: k.size },
                { l: 'POIS', v: k.poi_count ?? 0 },
                { l: 'HEXES TO NEXT', v: prog.next ? prog.need : 'MAX' },
              ].map(st => (
                <div key={st.l} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, fontFamily: HEAD }}>{st.l}</div>
                  <div style={{ fontSize: 16, color: '#e2e8f0', fontFamily: MONO, marginTop: 3 }}>{st.v}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: 1, fontFamily: HEAD, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                <span>{prog.next ? `TIER ${k.tier} → ${k.tier + 1}` : 'MAX TIER'}</span>
                <span style={{ fontFamily: MONO, color: col }}>{prog.next ? `${k.size}/${prog.next} HEXES` : `${k.size} HEXES`}</span>
              </div>
              <div className="hx-progress" style={{ ['--accent' as any]: col }}>
                <div className="hx-progress__fill" style={{ width: `${prog.pct}%` }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, fontFamily: HEAD }}>
              <MapPin size={12} /> TAP TO FLY TO KINGDOM
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══ MILITARY TAB ═══
const UNITS = [
  { name: 'Infantry', icon: 'swords', cost: 50, atk: 10, def: 12, color: '#dc2626' },
  { name: 'Cavalry', icon: 'horse', cost: 120, atk: 18, def: 8, color: '#f97316' },
  { name: 'Artillery', icon: 'bomb', cost: 300, atk: 35, def: 4, color: '#8b5cf6' },
  { name: 'Aerial', icon: 'plane', cost: 250, atk: 25, def: 6, color: '#0ea5e9' },
  { name: 'Naval', icon: 'ship', cost: 200, atk: 20, def: 15, color: '#0099cc' },
  { name: 'Spy', icon: 'spy', cost: 150, atk: 5, def: 3, color: '#475569' },
]

function fmtSecs(sec: number) {
  const s = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${r}s` : `${r}s`
}

function MilitaryTab() {
  const { data: armyData, isLoading } = useQuery({
    queryKey: ['my-army'],
    queryFn: () => api.get('/combat/my-army/').then(r => r.data),
    staleTime: 15000,
  })

  const units = armyData?.units || {}
  const training = armyData?.training || []
  const totalAtk = armyData?.force?.attack ?? UNITS.reduce((s, u) => s + u.atk * ownedCount(units[u.name.toLowerCase()]), 0)
  const totalDef = armyData?.force?.defense ?? UNITS.reduce((s, u) => s + u.def * ownedCount(units[u.name.toLowerCase()]), 0)
  const setActivePanel = useStore(s => s.setActivePanel)
  const qc = useQueryClient()
  const [collecting, setCollecting] = useState(false)
  const readyCount = training.filter((t: any) => t.done).reduce((a: number, t: any) => a + (t.quantity || 0), 0)
  const collect = async () => {
    setCollecting(true)
    try {
      const r = await api.post('/combat/collect/')
      if (r.data?.total_collected > 0) toast.success(`${r.data.total_collected} units joined your army`)
      else toast.error('No training complete yet')
      qc.invalidateQueries({ queryKey: ['my-army'] })
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Collection failed') }
    finally { setCollecting(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Power summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[{ l: 'TOTAL ATTACK', v: totalAtk, c: '#ef4444', I: Swords }, { l: 'TOTAL DEFENSE', v: totalDef, c: '#3b82f6', I: Crown }].map(st => (
          <div key={st.l} className="hx-card hx-card--accent" style={{ ['--accent' as any]: st.c, display: 'flex', alignItems: 'center', gap: 12 }}>
            {st.l === 'TOTAL ATTACK' ? <Swords size={24} color="#fff" style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.35))' }} /> : <IconSVG id="ui_shield" size={26} />}
            <div className="hx-stat">
              <span className="hx-stat__label" style={{ color: 'rgba(255,255,255,0.9)' }}>{st.l}</span>
              <span className="hx-stat__value" style={{ color: '#fff' }}>{isLoading ? '—' : fmt(st.v)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Active training */}
      {training.length > 0 && (
        <div className="hx-card" style={{ ['--accent' as any]: '#F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="hx-section-title" style={{ marginTop: 0, flex: 1 }}>{readyCount > 0 ? 'TRAINING DONE' : `TRAINING IN PROGRESS (${training.length})`}</div>
            {readyCount > 0 && (
              <button onClick={collect} disabled={collecting} className="btn-game btn-game-green" style={{ padding: '8px 14px', fontSize: 11, marginBottom: 10 }}>
                {collecting ? '...' : `COLLECT ${readyCount}`}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {training.map((t: any, i: number) => {
              const start = Date.parse(t.started_at), end = Date.parse(t.completes_at)
              const pct = t.done ? 100 : (end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0)
              const def = UNITS.find(u => u.name.toLowerCase() === t.unit_type)
              return (
                <div key={t.id || i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <EmojiIcon emoji={def?.icon || 'swords'} size={18} />
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{t.quantity}× {def?.name || t.unit_type}</span>
                    {t.done
                      ? <span className="hx-chip" style={{ color: '#22c55e', borderColor: '#22c55e55', background: '#22c55e18' }}>READY</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#F59E0B', fontFamily: MONO }}><Timer size={12} />{fmtSecs(t.remaining_seconds)}</span>}
                  </div>
                  <div className="hx-progress"><div className="hx-progress__fill" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Unit roster */}
      <div className="hx-section-title" style={{ ['--accent' as any]: '#ef4444' }}>UNIT ROSTER</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        {UNITS.map((u, i) => {
          const count = ownedCount(units[u.name.toLowerCase()])
          return (
            <div key={u.name} className="hx-card hx-rise" style={{ animationDelay: `${i * 40}ms`, display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderColor: count > 0 ? `${u.color}45` : undefined }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${u.color}1f`, border: `1px solid ${u.color}50` }}>
                <EmojiIcon emoji={u.icon} size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', fontFamily: HEAD, letterSpacing: 1 }}>{u.name.toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, fontFamily: MONO, color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ color: '#f87171' }}>ATK {u.atk}</span><span style={{ color: '#60a5fa' }}>DEF {u.def}</span><span>{u.cost} HEX</span>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: count > 0 ? u.color : 'rgba(255,255,255,0.3)', fontFamily: MONO, textAlign: 'right' }}>
                ×{isLoading ? '–' : count}
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA to full combat panel */}
      <button onClick={() => setActivePanel('combat')} className="btn-game btn-game-red" style={{ width: '100%', minHeight: 46, fontSize: 11, letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Swords size={16} /> OPEN MILITARY PANEL
      </button>
    </div>
  )
}

// ═══ STATS TAB ═══
function StatsTab({ kingdoms }: { kingdoms: Kingdom[] }) {
  const player = usePlayer()
  const s = (player as any)?.stats || {}
  const mainKingdom = kingdoms.find(k => k.is_main)
  const largest = kingdoms.reduce((m, k) => Math.max(m, k.size), 0)
  const won = Number(s.battles_won) || 0, lost = Number(s.battles_lost) || 0
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null

  // Real per-day production: territory resource_* fields are per 5-min tick (× 288 ticks/day),
  // summed per kingdom by the backend (kingdom_engine._aggregate_resources).
  const sum = (f: string) => kingdoms.reduce((acc, k) => acc + (Number(k.resources?.[f]) || 0), 0) * 288
  const hasRes = kingdoms.some(k => k.resources)
  const production = [
    { name: 'HEX', icon: 'hex_coin', val: kingdoms.reduce((acc, k) => acc + (k.tdc_per_24h || 0), 0), c: ACCENT },
    { name: 'Food', icon: 'wheat', val: sum('resource_food'), c: '#84cc16' },
    { name: 'Energy', icon: 'lightning', val: sum('resource_energy'), c: '#facc15' },
    { name: 'Materials', icon: 'bricks', val: sum('resource_materials'), c: '#f97316' },
    { name: 'Intel', icon: 'satellite', val: sum('resource_intel'), c: '#38bdf8' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Combat record */}
      <div className="hx-card">
        <div className="hx-section-title" style={{ marginTop: 0 }}>COMBAT RECORD</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[{ l: 'BATTLES WON', v: won, c: '#22c55e' }, { l: 'BATTLES LOST', v: lost, c: '#ef4444' }, { l: 'WIN RATE', v: winRate === null ? '—' : `${winRate}%`, c: ACCENT }].map(st => (
            <div key={st.l} className="hx-stat">
              <span className="hx-stat__label">{st.l}</span>
              <span className="hx-stat__value" style={{ color: st.c, fontSize: 20 }}>{st.v}</span>
            </div>
          ))}
        </div>
        {winRate !== null && (
          <div className="hx-progress" style={{ marginTop: 12, ['--accent' as any]: '#22c55e', background: 'rgba(239,68,68,0.35)' }}>
            <div className="hx-progress__fill" style={{ width: `${winRate}%` }} />
          </div>
        )}
      </div>

      {/* Empire details */}
      <div className="hx-card">
        <div className="hx-section-title" style={{ marginTop: 0 }}>EMPIRE OVERVIEW</div>
        {[
          { k: 'Main Kingdom', v: mainKingdom ? kingdomName(mainKingdom) : 'None', c: ACCENT },
          { k: 'Largest Kingdom', v: `${largest} territories`, c: '#38bdf8' },
          { k: 'Landmarks (POIs)', v: String(kingdoms.reduce((acc, k) => acc + (k.poi_count || 0), 0)), c: '#a78bfa' },
          { k: 'Territories Captured', v: String(s.territories_captured || 0), c: '#22c55e' },
          { k: 'Territories Lost', v: String(s.territories_lost || 0), c: '#94a3b8' },
          { k: 'Account Age', v: player?.date_joined ? `${Math.floor((Date.now() - new Date(player.date_joined).getTime()) / 86400000)} days` : '—', c: '#8b5cf6' },
        ].map((row, i, arr) => (
          <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{row.k}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: row.c, fontFamily: MONO, textAlign: 'right' }}>{row.v}</span>
          </div>
        ))}
      </div>

      {/* Resource production — real backend aggregates */}
      {hasRes && (
        <div className="hx-card">
          <div className="hx-section-title" style={{ marginTop: 0 }}>DAILY PRODUCTION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
            {production.map(r => (
              <div key={r.name} style={{ padding: '10px 8px', borderRadius: 10, textAlign: 'center', background: `${r.c}10`, border: `1px solid ${r.c}30` }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><EmojiIcon emoji={r.icon} size={24} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', fontFamily: MONO, marginTop: 6 }}>{fmt(r.val)}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, fontFamily: HEAD, marginTop: 2 }}>{r.name.toUpperCase()}/DAY</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ MAIN ═══
export function EmpirePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>(() => {   // a notification can open a given tab (SessionLoop cta.tab)
    try { const t = sessionStorage.getItem('hx_tab_empire'); sessionStorage.removeItem('hx_tab_empire'); if (t) return t as Tab } catch {}
    return 'kingdoms'
  })
  const player = usePlayer()

  const { data, isLoading } = useQuery<{ kingdoms: Kingdom[] }>({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000,
    enabled: !!player,
  })
  const kingdoms = data?.kingdoms ?? []

  // Same query key as MilitaryTab → shared cache, no extra request
  const { data: armyData } = useQuery({
    queryKey: ['my-army'],
    queryFn: () => api.get('/combat/my-army/').then(r => r.data),
    staleTime: 15000,
  })

  const handleTeleport = (lat: number, lon: number) => {
    onClose()
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat, lon, zoom: 14 } }))
    }, 200)
  }

  const totalTerr = kingdoms.reduce((sum, k) => sum + k.size, 0)
  const totalIncome = kingdoms.reduce((sum, k) => sum + (k.tdc_per_24h || 0), 0)
  const armyPower = armyData?.force ? (Number(armyData.force.attack) || 0) + (Number(armyData.force.defense) || 0) : null
  const headStats = [
    { l: 'TERRITORIES', v: isLoading ? '—' : fmt(totalTerr), icon: <MapPin size={16} color="#38bdf8" /> },
    { l: 'KINGDOMS', v: isLoading ? '—' : String(kingdoms.length), icon: <Crown size={16} color={ACCENT} /> },
    { l: 'HEX / DAY', v: isLoading ? '—' : `+${fmt(totalIncome)}`, icon: <IconSVG id="hex_coin" size={16} />, accent: true },
    { l: 'ARMY POWER', v: armyPower === null ? '—' : fmt(armyPower), icon: <Swords size={16} color="#ef4444" /> },
  ]

  return (
    <GlassPanel
      title="EMPIRE" onClose={onClose} accent={ACCENT} width={760}
      icon={<Crown size={20} />}
      subtitle="Kingdoms, army and empire statistics"
    >
      {/* Key stats */}
      <div className="hx-stat-grid" style={{ marginBottom: 16 }}>
        {headStats.map((st, i) => (
          <div key={st.l} className="hx-card hx-rise" style={{ animationDelay: `${i * 40}ms`, padding: '12px 14px' }}>
            <div className="hx-stat">
              <span className="hx-stat__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{st.icon}{st.l}</span>
              <span className={`hx-stat__value${st.accent ? ' hx-stat__value--accent' : ''}`}>{st.v}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'kingdoms' && <KingdomsTab kingdoms={kingdoms} loading={isLoading && !!player} onTeleport={handleTeleport} />}
      {tab === 'regions' && <RegionsTab />}
      {tab === 'military' && <MilitaryTab />}
      {tab === 'stats' && <StatsTab kingdoms={kingdoms} />}
    </GlassPanel>
  )
}
