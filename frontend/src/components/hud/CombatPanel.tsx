/**
 * CombatPanel — Military Command Center.
 * Wired to real API: /api/combat/my-army/, recruit, collect, assign.
 * Admin gets fast training (minutes instead of hours).
 */
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import toast from 'react-hot-toast'
import { openBattle } from '../combat/BattleFaceOff'
import { Swords, Shield, Users, Hourglass, History, Clock } from 'lucide-react'

interface UnitDef {
  name: string; icon: string; atk: number; def: number; cost: number
  train_seconds: number; admin_train_seconds: number; desc: string
  owned: number; effective_train_seconds: number
}
interface TrainingItem {
  id: string; unit_type: string; quantity: number
  started_at: string; completes_at: string; remaining_seconds: number; done: boolean
}
interface Station {
  h3: string; name: string; size: number; kind: 'kingdom' | 'territory'; rarity: string
  units: Record<string, number>; defense: number; hexes: string[]
}
interface ArmyData {
  units: Record<string, UnitDef & { available?: number }>
  training: TrainingItem[]
  force: { attack: number; defense: number }
  stations?: Station[]
}

const TABS = [
  { id: 'recruit', label: 'RECRUIT',  iconId: 'swords' },
  { id: 'train',   label: 'TRAINING', iconId: 'gear' },
  { id: 'forces',  label: 'FORCES',   iconId: 'shield' },
  { id: 'history', label: 'HISTORY',  iconId: 'chart_bar' },
]

interface Props { onClose: () => void }

function formatTime(s: number): string {
  if (s <= 0) return 'READY'
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s/60)}min`
  return `${(s/3600).toFixed(1)}h`
}

export function CombatPanel({ onClose }: Props) {
  const [tab, setTab] = useState('recruit')
  const [recruitQty, setRecruitQty] = useState<Record<string,number>>({})
  const [tick, setTick] = useState(0)
  const player = usePlayer()
  const qc = useQueryClient()
  const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const

  // Tick for countdown
  useEffect(() => { const iv = setInterval(() => setTick(t=>t+1), 1000); return () => clearInterval(iv) }, [])

  // Real API data
  const { data: army, isLoading } = useQuery<ArmyData>({
    queryKey: ['my-army'],
    queryFn: () => api.get('/combat/my-army/').then(r => r.data),
    staleTime: 10000,
    refetchInterval: 15000,
  })

  const units = army?.units || {}
  const training = army?.training || []
  const force = army?.force || { attack: 0, defense: 0 }

  const handleRecruit = async (unitType: string) => {
    const qty = recruitQty[unitType] || 1
    try {
      const res = await api.post('/combat/recruit/', { unit_type: unitType, quantity: qty })
      toast.success(`Training ${qty} ${units[unitType]?.name || unitType}! Ready in ${formatDuration(res.data.train_seconds)}`)
      qc.invalidateQueries({ queryKey: ['my-army'] })
      qc.invalidateQueries({ queryKey: ['player'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Recruitment failed')
    }
  }

  const handleCollect = async () => {
    try {
      const res = await api.post('/combat/collect/')
      if (res.data.total_collected > 0) {
        toast.success(`Collected ${res.data.total_collected} units!`)
        qc.invalidateQueries({ queryKey: ['my-army'] })
      } else {
        toast.error('No training complete yet')
      }
    } catch { toast.error('Collection failed') }
  }

  const UNIT_COLORS: Record<string,string> = {
    infantry: '#64748b', cavalry: '#f59e0b', artillery: '#dc2626',
    aerial: '#8b5cf6', naval: '#3b82f6', spy: '#ec4899',
  }

  const unitList = Object.values(units)
  const maxAtk = Math.max(1, ...unitList.map(u => u.atk))
  const maxDef = Math.max(1, ...unitList.map(u => u.def))
  const totalOwned = unitList.reduce((a, u) => a + (u.owned || 0), 0)
  const remainingOf = (t: TrainingItem) => (void tick, Math.max(0, Math.round((Date.parse(t.completes_at) - Date.now()) / 1000)))
  const activeTraining = training.filter(t => !t.done && remainingOf(t) > 0)
  const readyTraining = training.filter(t => t.done || remainingOf(t) <= 0)
  const mono = "'Share Tech Mono', monospace"
  const label = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700, ...s } as const

  const StatBar = ({ name, value, max, color }: { name: string; value: number; max: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...label, width: 28, color }}>{name}</span>
      <div className="hx-progress" style={{ flex: 1, ['--accent' as any]: color }}>
        <div className="hx-progress__fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span style={{ fontFamily: mono, fontSize: 13, color: '#e2e8f0', width: 26, textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <GlassPanel title="MILITARY" onClose={onClose} accent="#dc2626"
      icon={<IconSVG id="swords" size={24} />} subtitle="Recruit, train and command your army">
      {/* Force summary */}
      <div className="hx-stat-grid" style={{ marginBottom: 14 }}>
        {[
          { l: 'ATTACK FORCE', v: force.attack, c: '#f87171', icon: <Swords size={18} /> },
          { l: 'DEFENSE FORCE', v: force.defense, c: '#60a5fa', icon: <Shield size={18} /> },
          { l: 'UNITS OWNED', v: totalOwned, c: '#e2e8f0', icon: <Users size={18} /> },
        ].map(st => (
          <div key={st.l} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: st.c, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hx-line)' }}>{st.icon}</span>
            <div className="hx-stat">
              <span className="hx-stat__label">{st.l}</span>
              <span className="hx-stat__value" style={{ color: st.c }}>{st.v.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <BattlesNow />

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.id === 'recruit' ? <Swords size={14} /> : t.id === 'train' ? <Hourglass size={14} /> : t.id === 'forces' ? <Shield size={14} /> : <History size={14} />}
            {t.label}
            {t.id === 'train' && training.length > 0 && <span className="hx-chip hx-chip--accent" style={{ padding: '1px 6px', ...(readyTraining.length ? { background: '#22c55e', borderColor: '#14532d' } : {}) }}>{readyTraining.length || activeTraining.length}</span>}
          </button>
        ))}
      </div>

      {/* Active training banner */}
      {training.length > 0 && tab !== 'train' && (
        <div className="hx-card" style={{
          marginBottom: 12, ['--accent' as any]: '#f59e0b',
          borderColor: 'rgba(245,158,11,0.35)', background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ ...label, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hourglass size={13} /> {readyTraining.length > 0
                ? `${readyTraining.reduce((a, t) => a + t.quantity, 0)} UNITS READY`
                : `${activeTraining.length} IN TRAINING`}
            </div>
            {readyTraining.length > 0 && (
              <button onClick={handleCollect} className="btn-game btn-game-green" style={{ padding: '8px 14px', fontSize: 10 }}>COLLECT</button>
            )}
          </div>
          {training.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4 }}>
              <span style={{ flex: 1 }}>{t.quantity}x {units[t.unit_type]?.name || t.unit_type}</span>
              <span style={{ fontFamily: mono, fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {formatTime(remainingOf(t))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ RECRUIT TAB ═══ */}
      {tab === 'recruit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
          {isLoading && [0, 1, 2, 3].map(i => <div key={i} className="hx-skeleton" style={{ height: 180, borderRadius: 12 }} />)}
          {Object.entries(units).map(([key, u], idx) => {
            const color = UNIT_COLORS[key] || '#64748b'
            const qty = recruitQty[key] || 1
            const totalCost = u.cost * qty
            return (
              <div key={key} className="hx-card hx-rise" style={{ animationDelay: `${idx * 40}ms`, display: 'flex', flexDirection: 'column', gap: 12, ['--accent' as any]: color }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                    background: `radial-gradient(circle at 50% 35%, ${color}40, ${color}12)`, border: `1px solid ${color}66`,
                    boxShadow: `0 0 16px ${color}22, inset 0 1px 0 rgba(255,255,255,0.12)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconSVG id={u.icon} size={38} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1.5, ...s }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.4, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>{u.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 24, color, fontFamily: mono, lineHeight: 1 }}>{u.owned}</div>
                    <div style={{ ...label, marginTop: 4 }}>OWNED</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <StatBar name="ATK" value={u.atk} max={maxAtk} color="#ef4444" />
                  <StatBar name="DEF" value={u.def} max={maxDef} color="#3b82f6" />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="hx-chip"><IconSVG id="hex_coin" size={12} /> {u.cost} HEX / UNIT</span>
                  <span className="hx-chip"><Clock size={11} /> {formatDuration(u.effective_train_seconds)} · {(u as any).train_parallel || 1} AT ONCE</span>
                </div>

                {/* Quantity + recruit button */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--hx-line)' }}>
                    {[1, 5, 10, 25].map(n => (
                      <button key={n} aria-label={`Quantity ${n}`} onClick={() => setRecruitQty(prev => ({...prev, [key]: n}))} style={{
                        minWidth: 36, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: mono,
                        background: qty === n ? `${color}33` : 'transparent',
                        border: `1px solid ${qty === n ? color + '99' : 'transparent'}`,
                        color: qty === n ? '#fff' : 'var(--hx-text-3)', transition: 'background .15s, color .15s',
                      }}>{n}</button>
                    ))}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => handleRecruit(key)} className="btn-game btn-game-red" style={{
                    fontSize: 10, letterSpacing: 1, padding: '11px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    RECRUIT {qty} · <IconSVG id="hex_coin" size={13} />{totalCost.toLocaleString()}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TRAINING TAB ═══ */}
      {tab === 'train' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {training.length === 0 && (
            <div className="hx-empty">
              <Hourglass size={36} color="#f87171" />
              <div className="hx-empty__title">NO ACTIVE TRAINING</div>
              <div>Recruit units to start training them.</div>
              <button className="btn-game btn-game-red" onClick={() => setTab('recruit')} style={{ marginTop: 6 }}>RECRUIT UNITS</button>
            </div>
          )}
          {readyTraining.length > 0 && (
            <button onClick={handleCollect} className="btn-game btn-game-green" style={{ alignSelf: 'flex-end', fontSize: 10 }}>COLLECT ALL READY</button>
          )}
          {training.map((t, idx) => {
            const u = units[t.unit_type]
            const color = UNIT_COLORS[t.unit_type] || '#64748b'
            const remaining = remainingOf(t)
            const total = (Date.parse(t.completes_at) - Date.parse(t.started_at)) / 1000
            const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100
            const ready = t.done || remaining <= 0

            return (
              <div key={t.id} className="hx-card hx-rise" style={{
                animationDelay: `${idx * 40}ms`, ['--accent' as any]: ready ? '#22c55e' : color,
                borderColor: ready ? 'rgba(34,197,94,0.4)' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconSVG id={u?.icon || 'swords'} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1, ...s }}>
                      {t.quantity}x {u?.name || t.unit_type}
                    </div>
                    <div style={{ fontSize: 10, color: ready ? '#4ade80' : 'var(--hx-text-3)', marginTop: 4, letterSpacing: 1 }}>
                      {ready ? 'TRAINING COMPLETE' : 'IN TRAINING'}
                    </div>
                  </div>
                  {ready ? (
                    <button onClick={handleCollect} className="btn-game btn-game-green" style={{ fontSize: 10, letterSpacing: 1 }}>COLLECT</button>
                  ) : (
                    <span className="hx-chip" style={{ fontFamily: mono, fontSize: 12 }}><Clock size={12} /> {formatTime(remaining)}</span>
                  )}
                </div>
                {!ready && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="hx-progress" style={{ flex: 1 }}>
                      <div className="hx-progress__fill" style={{ width: `${pct}%`, transition: 'width 1s linear' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--hx-text-2)', fontFamily: mono, width: 36, textAlign: 'right' }}>{Math.round(pct)}%</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'forces' && <ForcesTab army={army} />}
      {tab === 'history' && <BattleHistory />}
    </GlassPanel>
  )
}

interface HistoryRow {
  id: string; target: string; target_h3: string; attacker: string | null; defender: string
  attack_type: string; status: string; role: 'attacker' | 'defender'; won: boolean
  territory_captured: boolean; units: Record<string, number>; units_lost: Record<string, number>
  completed_at: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const sumUnits = (u: Record<string, number> | undefined) => Object.values(u || {}).reduce((a, n) => a + (Number(n) || 0), 0)

/** Resolved battles from /api/combat/history/ — attacks you launched and raids you suffered. */
function BattleHistory() {
  const { data, isLoading, isError } = useQuery<{ history: HistoryRow[] }>({
    queryKey: ['combat-history'],
    queryFn: () => api.get('/combat/history/').then(r => r.data),
    staleTime: 10000,
  })
  const rows = data?.history || []
  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 72, borderRadius: 12 }} />)}</div>
  if (isError) return <div className="hx-empty"><div className="hx-empty__title">COULD NOT LOAD HISTORY</div><div>Check your connection and reopen the panel.</div></div>
  if (!rows.length) return (
    <div className="hx-empty">
      <History size={36} color="#f87171" />
      <div className="hx-empty__title">NO BATTLES YET</div>
      <div>Tap an enemy (red) hex on the map and choose ATTACK. Results land here.</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(b => {
        const col = b.won ? '#22c55e' : '#ef4444'
        const headline = b.role === 'attacker'
          ? (b.won ? (b.territory_captured ? 'CONQUERED' : 'VICTORY') : 'ATTACK FAILED')
          : (b.won ? 'DEFENDED' : (b.territory_captured ? 'TERRITORY LOST' : 'RAID LOST'))
        const who = b.role === 'attacker' ? `You attacked ${b.defender}` : `${b.attacker || 'An enemy'} attacked you`
        const lost = sumUnits(b.units_lost), sent = sumUnits(b.units)
        return (
          <div key={b.id} className="hx-card" style={{ ['--accent' as any]: col, borderColor: `${col}88`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: col, border: '2px solid rgba(0,0,0,0.45)', boxShadow: '0 3px 0 rgba(0,0,0,0.35)' }}>
              {b.role === 'attacker' ? <Swords size={20} color="#fff" /> : <Shield size={20} color="#fff" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: col, textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>{headline}</span>
                <span style={{ fontSize: 10, color: 'var(--hx-text-3)', marginLeft: 'auto', flexShrink: 0 }}>{timeAgo(b.completed_at)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {who} · {b.target && b.target !== b.target_h3 ? b.target : `Zone ${b.target_h3.slice(0, 8)}`}
              </div>
              {b.role === 'attacker' && sent > 0 && (
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 2 }}>{sent} units sent · {lost} lost · {sent - lost} back in your army</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function leftLabel(iso: string): string {
  const s = Math.max(0, (Date.parse(iso) - Date.now()) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return s <= 0 ? 'resolving…' : h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`
}

/** Live battles: attacks you launched (outgoing) and attacks on your hexes (incoming, with REINFORCE). */
function BattlesNow() {
  const [, force] = useState(0)
  useEffect(() => { const iv = setInterval(() => force(n => n + 1), 1000); return () => clearInterval(iv) }, [])
  const { data: out } = useQuery<any>({ queryKey: ['battles-active'], queryFn: () => api.get('/combat/active/').then(r => r.data), refetchInterval: 20000 })
  const { data: inc } = useQuery<any>({ queryKey: ['battles-incoming'], queryFn: () => api.get('/combat/incoming/').then(r => r.data), refetchInterval: 20000 })
  const outgoing: any[] = out?.battles || []
  const incoming: any[] = inc?.incoming || []
  if (!outgoing.length && !incoming.length) return null
  const name = (b: any) => b.target && b.target !== b.target_h3 ? b.target : `Zone ${String(b.target_h3).slice(0, 8)}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      {incoming.map(b => {
        const hold = Math.round((b.hold_chance ?? 0) * 100)
        const col = hold >= 80 ? '#22c55e' : hold >= 40 ? '#f59e0b' : '#ef4444'
        return (
          <div key={b.id} className="hx-card" style={{ borderColor: '#ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.28), rgba(239,68,68,0.10))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={22} color="#fca5a5" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff' }}>UNDER ATTACK · {name(b)}</div>
                <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 2 }}>
                  {b.attacker || 'Enemy'} · falls in {leftLabel(b.ends_at)} · <span style={{ color: col }}>{hold}% chance to hold</span>
                </div>
              </div>
              <button onClick={() => openBattle(b.id)} className="btn-game btn-game-red" style={{ padding: '8px 10px', fontSize: 10, flexShrink: 0 }}>
                DEFEND
              </button>
            </div>
          </div>
        )
      })}
      {outgoing.map(b => (
        <div key={b.id} className="hx-card" style={{ borderColor: '#f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Swords size={20} color="#fbbf24" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff' }}>ATTACKING · {name(b)}</div>
              <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 2 }}>
                vs {b.defender} · {sumUnits(b.units)} units · result in {leftLabel(b.ends_at)}
              </div>
            </div>
            <button onClick={() => openBattle(b.id)} className="btn-game btn-game-glass" style={{ padding: '8px 10px', fontSize: 10, flexShrink: 0 }}>WAR ROOM</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Station free troops on a kingdom (defends every hex of it) or a lone territory; recall them anytime.
 *  Stationed troops defend automatically but cannot attack. */
function ForcesTab({ army }: { army?: ArmyData }) {
  const qc = useQueryClient()
  const [pick, setPick] = useState<Record<string, { type: string; n: number }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const units = army?.units || {}
  const free = Object.entries(units).filter(([, u]) => (u.available || 0) > 0)
  const stations = army?.stations || []
  const refresh = () => ['my-army', 'battles-incoming'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  const call = async (key: string, url: string, body: any, ok: string) => {
    setBusy(key)
    try { await api.post(url, body); toast.success(ok); refresh() }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Failed') }
    finally { setBusy(null) }
  }
  const mono = "'Share Tech Mono', monospace"
  if (!stations.length) return <div className="hx-card" style={{ fontSize: 12, color: 'var(--hx-text-2)' }}>Claim a territory to station troops.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="hx-card" style={{ fontSize: 11, color: 'var(--hx-text-2)', lineHeight: 1.5 }}>
        <b style={{ color: '#fff' }}>FREE ARMY</b> — {free.length ? free.map(([k, u]) => `${u.available} ${u.name}`).join(' · ') : 'none (recruit or recall troops)'}
        <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 4 }}>Troops stationed in a kingdom defend all of its hexes. Free troops attack, or join a defense from the war room.</div>
      </div>
      {stations.map(st => {
        const p = pick[st.h3] || { type: free[0]?.[0] || '', n: 1 }
        const max = units[p.type]?.available || 0
        return (
          <div key={st.h3} className="hx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="#60a5fa" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {st.kind === 'kingdom' ? `Kingdom · ${st.size} hexes` : 'Territory'} · {st.rarity}
                </div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 14, color: '#60a5fa' }}>DEF {st.defense}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(st.units).filter(([, n]) => n > 0).map(([k, n]) => (
                <span key={k} className="hx-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <IconSVG id={units[k]?.icon || 'swords'} size={16} /> {n}
                  <button title="Recall 1" disabled={busy === st.h3 + k}
                    onClick={() => call(st.h3 + k, '/combat/unassign/', { h3: st.h3, unit_type: k, count: 1 }, `1 ${k} back to the free army`)}
                    style={{ marginLeft: 2, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>-1</button>
                  <button title="Recall all" disabled={busy === st.h3 + k}
                    onClick={() => call(st.h3 + k, '/combat/unassign/', { h3: st.h3, unit_type: k, count: n }, `${n} ${k} back to the free army`)}
                    style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 10 }}>ALL</button>
                </span>
              ))}
              {!Object.values(st.units).some(n => n > 0) && <span style={{ fontSize: 11, color: '#f59e0b' }}>Undefended — walls only</span>}
            </div>
            {free.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={p.type} onChange={e => setPick(x => ({ ...x, [st.h3]: { type: e.target.value, n: 1 } }))}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--hx-line)', borderRadius: 8, padding: '6px 8px', fontSize: 11 }}>
                  {free.map(([k, u]) => <option key={k} value={k}>{u.name} ({u.available})</option>)}
                </select>
                <input type="number" min={1} max={max} value={p.n}
                  onChange={e => setPick(x => ({ ...x, [st.h3]: { ...p, n: Math.max(1, Math.min(max, Number(e.target.value) || 1)) } }))}
                  style={{ width: 56, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--hx-line)', borderRadius: 8, padding: '6px', fontSize: 11, fontFamily: mono }} />
                <button className="btn-game btn-game-green" disabled={!p.type || busy === st.h3}
                  style={{ padding: '7px 10px', fontSize: 10 }}
                  onClick={() => call(st.h3, '/combat/assign/', { kingdom_h3: st.h3, unit_type: p.type, count: Math.min(p.n, max) }, `${Math.min(p.n, max)} ${p.type} stationed in ${st.name}`)}>
                  STATION
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
