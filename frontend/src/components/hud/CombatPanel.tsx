/**
 * CombatPanel — Military, in 3 counters (combat/forces.py, owner 2026-10-19: "only attack, defense and spy; HEX raise
 * them; a simpler game = better immersion"). Every kingdom / lone territory shows its attack, defense and spy points;
 * buy more with HEX; daily supplies; live battles; history. GET /api/combat/my-army/.
 */
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import toast from 'react-hot-toast'
import { openBattle } from '../combat/BattleFaceOff'
import { Swords, Shield, History, Flag, Crown, MapPin } from 'lucide-react'
import { celebrate } from '../shared/Celebrate'
import { playSound } from '../../hooks/useSound'
import { ForcesCounters, FORCE_META, type Forces } from '../combat/ForcesCounters'

interface Props { onClose: () => void }
interface Station { h3: string; name: string; size: number; kind: 'kingdom' | 'territory'; rarity: string; forces: Forces; hexes: string[] }
interface ArmyData {
  forces: Forces; stations: Station[]; point_cost: Record<string, number>
  draft?: { base: number; kingdoms: number; regions?: number; total: number; points: number; territories: number; available: boolean }
}
interface HistoryRow {
  id: string; target_h3: string; target: string; attacker: string | null; defender: string; role: 'attacker' | 'defender'
  won: boolean; territory_captured: boolean; units: Record<string, number>; units_lost: Record<string, number>
  units_survived: Record<string, number>; completed_at: string | null
}
const sumUnits = (u?: Record<string, number>) => Object.values(u || {}).reduce((a, b) => a + (Number(b) || 0), 0)
const TABS = [{ id: 'forces', label: 'FORCES' }, { id: 'history', label: 'HISTORY' }]

export function CombatPanel({ onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('forces')
  const { data: army, isLoading } = useQuery<ArmyData>({ queryKey: ['my-army'], queryFn: () => api.get('/combat/my-army/').then(r => r.data), staleTime: 10000 })
  const total = army?.forces || { attack: 0, defense: 0, spy: 0 }
  const label = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700 } as const

  return (
    <GlassPanel title="MILITARY" onClose={onClose} accent="#dc2626"
      icon={<IconSVG id="swords" size={24} />} subtitle="Attack, defense and spy points of your kingdoms">
      {/* Totals */}
      <div className="hx-stat-grid" style={{ marginBottom: 12 }}>
        {(Object.keys(FORCE_META) as (keyof Forces)[]).map(k => {
          const m = FORCE_META[k]
          return (
            <div key={k} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }} title={m.help}>
              <span style={{ color: m.color, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hx-line)' }}><m.Icon size={18} /></span>
              <div className="hx-stat">
                <span className="hx-stat__label">{m.label}</span>
                <span className="hx-stat__value" style={{ color: m.color }}>{(total[k] || 0).toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* How it works, in one line */}
      <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginBottom: 12, textTransform: 'none', letterSpacing: 0, lineHeight: 1.45 }}>
        Attack points meet the target kingdom's defense <b>1 for 1</b>: send more than its defense and the hex is yours.
        Spies cut the price and time of discovering new land.
      </div>

      {/* Daily supplies */}
      {army?.draft && (
        <div className="hx-card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
          ...(army.draft.available ? { borderColor: 'rgba(52,211,153,0.45)', background: 'linear-gradient(160deg, rgba(52,211,153,0.14), rgba(52,211,153,0.03))' } : {}) }}>
          <span style={{ color: '#34d399', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.12)' }}><Flag size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ ...label, color: '#34d399' }}>DAILY SUPPLIES · +{army.draft.points} ATTACK AND +{army.draft.points} DEFENSE</div>
            <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 2 }}>
              From {army.draft.territories} territories{army.draft.kingdoms ? ` · kingdom size` : ''}{army.draft.regions ? ` · ${army.draft.regions / 3} regions held` : ''} · on your biggest kingdom
            </div>
          </div>
          {army.draft.available
            ? <button className="btn-game btn-game-green" style={{ padding: '8px 14px', fontSize: 10 }} onClick={async () => {
                try {
                  const { data: r } = await api.post('/combat/draft/')
                  playSound('bonus'); celebrate('small', `+${r.points} attack · +${r.points} defense`)
                  qc.invalidateQueries({ queryKey: ['my-army'] })
                } catch (e: any) { toast.error(e?.response?.data?.error || 'Supplies failed') }
              }}>COLLECT</button>
            : <span className="hx-chip">TOMORROW</span>}
        </div>
      )}

      <BattlesNow />

      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.id === 'forces' ? <Shield size={14} /> : <History size={14} />}{t.label}
          </button>
        ))}
      </div>

      {tab === 'forces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading && [0, 1].map(i => <div key={i} className="hx-skeleton" style={{ height: 140, borderRadius: 12 }} />)}
          {!isLoading && !(army?.stations || []).length && (
            <div className="hx-empty"><div className="hx-empty__title">NO LAND YET</div><div>Claim a territory on the map first.</div></div>
          )}
          {(army?.stations || []).map(st => (
            <div key={st.h3} className="hx-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {st.kind === 'kingdom' ? <Crown size={15} color="#fbbf24" /> : <MapPin size={14} color="#94a3b8" />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                <span className="hx-chip">{st.kind === 'kingdom' ? `KINGDOM · ${st.size} HEXES` : 'TERRITORY'}</span>
                <button className="hx-chip" style={{ cursor: 'pointer' }} onClick={() => {
                  const [h] = st.hexes
                  import('h3-js').then(({ cellToLatLng }) => { const [lat, lon] = cellToLatLng(h); window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat, lon, zoom: 14 } })); onClose() })
                }}>GO</button>
              </div>
              <ForcesCounters h3={st.h3} forces={st.forces} pointCost={army?.point_cost || {}} compact />
            </div>
          ))}
        </div>
      )}
      {tab === 'history' && <BattleHistory />}
    </GlassPanel>
  )
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}


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
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 2 }}>{sent} attack points sent · {lost} spent{b.territory_captured && sent - lost > 0 ? ` · ${sent - lost} now hold the hex` : ''}</div>
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
                  {b.attacker || 'Enemy'} · {leftLabel(b.ends_at)} left · <span style={{ color: col }}>{hold >= 100 ? 'your defense holds' : 'buy defense to hold'}</span>
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
                vs {b.defender} · {sumUnits(b.units)} attack points · result in {leftLabel(b.ends_at)}
              </div>
            </div>
            <button onClick={() => openBattle(b.id)} className="btn-game btn-game-glass" style={{ padding: '8px 10px', fontSize: 10, flexShrink: 0 }}>WAR ROOM</button>
          </div>
        </div>
      ))}
    </div>
  )
}
