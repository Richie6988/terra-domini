/**
 * BattleFaceOff — war room (GET /api/combat/<id>/faceoff/): the attack points committed vs the target kingdom's
 * defense points, 1 for 1 (combat/forces.py). Until the timer ends the defender buys defense points
 * (POST /combat/reinforce/ {battle_id, points}). Opened anywhere with openBattle(id).
 */
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Swords, Shield, Clock } from 'lucide-react'
import { api } from '../../services/api'
import { IconSVG } from '../shared/iconBank'
import { playSound } from '../../hooks/useSound'
import { celebrate } from '../shared/Celebrate'

const EVT = 'hx:battle'
export const openBattle = (id: string) => window.dispatchEvent(new CustomEvent(EVT, { detail: { id } }))

const RED = '#ef4444', BLUE = '#38bdf8'
const mono = "'Share Tech Mono', monospace"
interface FaceOff {
  id: string; status: string; role: 'attacker' | 'defender'; seconds_left: number; winner: string | null
  territory_captured: boolean; attack_type: string
  territory: { h3: string; name: string; rarity: string; terrain: string }
  attack: { players: string[]; points: number; surprise: boolean }
  defense: { player: string | null; points: number; kingdom_size: number }
  hold_chance: number; missing: number
  actions?: { point_cost: number }
}

function clock(s: number) {
  if (s <= 0) return '00:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}

export function BattleFaceOffHost() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    const on = (e: Event) => { setId((e as CustomEvent).detail?.id || null); playSound('battle') }
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])
  return <AnimatePresence>{id && <BattleFaceOff key={id} id={id} onClose={() => setId(null)} />}</AnimatePresence>
}

function BattleFaceOff({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState<string | null>(null)
  const { data, error, refetch, dataUpdatedAt } = useQuery<FaceOff>({
    queryKey: ['faceoff', id],
    queryFn: () => api.get(`/combat/${id}/faceoff/`).then(r => r.data),
    refetchInterval: q => (q.state.data?.status === 'completed' ? false : 5000),
  })
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  const left = data ? Math.max(0, data.seconds_left - Math.floor((now - dataUpdatedAt) / 1000)) : 0
  useEffect(() => { if (data && data.status !== 'completed' && left === 0) { const t = setTimeout(() => refetch(), 1500); return () => clearTimeout(t) } }, [left, data?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = data?.status === 'completed'
  const iWon = done && data && data.winner === data.role
  useEffect(() => { if (done) { playSound(iWon ? 'win' : 'lose'); if (iWon) celebrate('big', 'VICTORY') } }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const after = (msg?: string) => {
    if (msg) toast.success(msg)
    ;['battles-incoming', 'battles-active', 'my-army', 'loop-status', 'player', 'wallet'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    refetch()
  }
  const act = async (key: string, fn: () => Promise<any>, sound: 'reinforce' | 'purchase' = 'reinforce') => {
    setBusy(key)
    try { const r = await fn(); playSound(sound); after(r?.data?.message) }
    catch (e: any) { playSound('error'); toast.error(e?.response?.data?.error || 'Action failed') }
    finally { setBusy(null) }
  }

  const atk = data?.attack.points || 0, dfn = data?.defense.points || 0
  const atkShare = atk + dfn > 0 ? atk / (atk + dfn) : 0.5
  const holds = (data?.hold_chance ?? 0) >= 1
  const buyDef = (n: number) => act(`def${n}`, () => api.post('/combat/reinforce/', { battle_id: id, points: n }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(6px)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} className="hx-card"
        style={{ width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', padding: 16,
                 background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))', border: '1px solid rgba(148,163,184,0.25)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Swords size={20} color="#fbbf24" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: '#fff', letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              WAR ROOM · {data?.territory.name || '...'}
            </div>
            {data && <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
              {data.territory.rarity} · {data.attack_type}{data.attack.surprise ? ' (half timer)' : ''}
            </div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: 2 }}>{done ? 'RESOLVED' : 'RESOLVES IN'}</div>
            <div style={{ fontFamily: mono, fontSize: 22, color: done ? '#94a3b8' : left < 60 ? RED : '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={16} /> {done ? '--:--' : clock(left)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>

        {error && <div style={{ color: RED, fontSize: 12 }}>{(error as any)?.response?.data?.error || 'Battle not found'}</div>}

        {data && <>
          {/* Result banner */}
          {done && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ textAlign: 'center', padding: '10px 0 14px', fontFamily: 'var(--font-heading)', fontSize: 30, letterSpacing: 4,
                       color: iWon ? '#22c55e' : RED, textShadow: `0 0 24px ${iWon ? '#22c55e' : RED}` }}>
              {iWon ? 'VICTORY' : 'DEFEAT'}
              <div style={{ fontSize: 11, letterSpacing: 1, color: '#cbd5e1', marginTop: 4 }}>
                {data.territory_captured ? 'Territory captured by the attacker' : data.winner === 'defender' ? 'The defense held' : 'Raid succeeded'}
              </div>
            </motion.div>
          )}

          {/* Face to face: points, 1 for 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
            <div style={{ borderRadius: 10, padding: 12, border: `1px solid ${RED}55`, background: `linear-gradient(180deg, ${RED}22, transparent)`, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fca5a5', fontSize: 10, letterSpacing: 2 }}><Swords size={13} /> ATTACK</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff', margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.attack.players.join(', ') || 'Enemy'}</div>
              <div style={{ fontFamily: mono, fontSize: 34, color: RED }}>{atk.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>ATTACK POINTS</div>
            </div>
            <motion.div animate={done ? {} : { scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
              style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: '#fbbf24', textShadow: '0 0 16px #f59e0b' }}>VS</motion.div>
            <div style={{ borderRadius: 10, padding: 12, border: `1px solid ${BLUE}55`, background: `linear-gradient(180deg, ${BLUE}22, transparent)`, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#7dd3fc', fontSize: 10, letterSpacing: 2 }}><Shield size={13} /> DEFENSE</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff', margin: '4px 0 2px' }}>{data.defense.player || '—'}</div>
              <div style={{ fontFamily: mono, fontSize: 34, color: BLUE }}>{dfn.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>DEFENSE POINTS · KINGDOM OF {data.defense.kingdom_size}</div>
            </div>
          </div>

          {/* Balance of power */}
          <div style={{ marginTop: 14 }}>
            <div style={{ position: 'relative', height: 14, borderRadius: 7, overflow: 'hidden', background: BLUE, border: '1px solid rgba(255,255,255,0.15)' }}>
              <motion.div animate={{ width: `${atkShare * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 16 }}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: `linear-gradient(90deg, #7f1d1d, ${RED})` }} />
            </div>
            {!done && <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, marginTop: 8, color: holds ? '#22c55e' : RED }}>
              {holds ? 'The defense holds — unless more attack arrives' : `The hex falls unless ${data.missing} more defense points are added`}
            </div>}
          </div>

          {/* Defender window */}
          {data.role === 'defender' && data.actions && !done && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#fbbf24', marginBottom: 8 }}>BUY DEFENSE BEFORE THE TIMER ENDS · {data.actions.point_cost} HEX A POINT</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.missing > 0 && (
                  <button className="btn-game btn-game-green" disabled={!!busy} style={{ flex: '1 1 160px', fontSize: 11 }} onClick={() => buyDef(data.missing)}>
                    HOLD IT · +{data.missing} · {(data.missing * data.actions.point_cost).toLocaleString()} HEX</button>
                )}
                {[50, 100].map(n => (
                  <button key={n} className="btn-game btn-game-gold" disabled={!!busy} style={{ flex: '1 1 120px', fontSize: 11 }} onClick={() => buyDef(n)}>
                    +{n} · {(n * data.actions!.point_cost).toLocaleString()} HEX</button>
                ))}
              </div>
            </div>
          )}
          {data.role === 'attacker' && !done && (
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>The defender can still buy defense points until the timer ends.</div>
          )}
        </>}
      </motion.div>
    </motion.div>
  )
}
