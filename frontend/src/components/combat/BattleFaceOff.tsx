/**
 * BattleFaceOff — war room: attackers and defenders face to face, from GET /api/combat/<id>/faceoff/
 * (the same numbers combat.engine.resolve_battle uses). Until the timer ends the defender can
 * send free troops (POST /combat/defend/), reinforce the walls (POST /combat/reinforce/) or
 * activate 2X Defense (POST /shop/purchase/). Opened anywhere with openBattle(id).
 */
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Swords, Shield, Clock, Castle, Zap, Users } from 'lucide-react'
import { api } from '../../services/api'
import { IconSVG } from '../shared/iconBank'
import { playSound } from '../../hooks/useSound'

const EVT = 'hx:battle'
export const openBattle = (id: string) => window.dispatchEvent(new CustomEvent(EVT, { detail: { id } }))

const RED = '#ef4444', BLUE = '#38bdf8'
const UNIT_ICON: Record<string, string> = { infantry: 'swords', cavalry: 'horse', artillery: 'bomb', aerial: 'plane', naval: 'ship', spy: 'spy' }
const mono = "'Share Tech Mono', monospace"
const STEP = { width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', lineHeight: '18px', padding: 0 } as const

interface Row { type: string; count: number; power: number }
interface FaceOff {
  id: string; status: string; role: 'attacker' | 'defender'; seconds_left: number; winner: string | null
  territory_captured: boolean; attack_type: string
  territory: { h3: string; name: string; rarity: string; terrain: string }
  attack: { players: string[]; units: Row[]; power: number; boost_pct: number; surprise: boolean }
  defense: { player: string | null; garrison: Row[]; sent: Row[]; walls: number; walls_max: number; power: number; boost_pct: number }
  hold_chance: number
  actions?: { reserve: Record<string, number>; reinforce_cost: number; reinforce_defense: number
              boost_item: { code: string; name: string; price: number } | null }
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

function UnitColumn({ rows, color, max, label }: { rows: Row[]; color: string; max: number; label?: string }) {
  if (!rows.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--hx-text-3, #94a3b8)' }}>{label}</div>}
      {rows.map(r => (
        <div key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSVG id={UNIT_ICON[r.type] || 'swords'} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#e2e8f0' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{r.type}</span>
              <span style={{ fontFamily: mono }}>x{r.count}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 3 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (r.power / Math.max(max, 1)) * 100)}%` }}
                transition={{ duration: 0.6 }} style={{ height: '100%', background: color }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BattleFaceOff({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [send, setSend] = useState<Record<string, number>>({})
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
  useEffect(() => { if (done) playSound(iWon ? 'win' : 'lose') }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const atk = data?.attack.power || 0, dfn = data?.defense.power || 0
  const atkShare = atk + dfn > 0 ? atk / (atk + dfn) : 0.5
  const hold = Math.round((data?.hold_chance ?? 0) * 100)
  const holdCol = hold >= 70 ? '#22c55e' : hold >= 35 ? '#f59e0b' : RED
  const maxPower = Math.max(1, ...(data ? [...data.attack.units, ...data.defense.garrison, ...data.defense.sent].map(r => r.power) : [1]))
  const reserve = data?.actions?.reserve || {}
  const sendTotal = Object.values(send).reduce((a, n) => a + n, 0)

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
              {data.territory.rarity} · {data.territory.terrain} · {data.attack_type}{data.attack.surprise ? ' (attack x0.8)' : ''}
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

          {/* Face to face */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'start' }}>
            <div style={{ borderRadius: 10, padding: 10, border: `1px solid ${RED}55`, background: `linear-gradient(180deg, ${RED}22, transparent)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontSize: 10, letterSpacing: 2 }}><Swords size={13} /> ATTACK</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff', margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.attack.players.join(', ') || 'Enemy'}</div>
              <div style={{ fontFamily: mono, fontSize: 26, color: RED }}>{Math.round(atk)}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 8 }}>POWER{data.attack.boost_pct ? ` · +${data.attack.boost_pct}% boost` : ''}</div>
              <UnitColumn rows={data.attack.units} color={RED} max={maxPower} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 30 }}>
              <motion.div animate={done ? {} : { scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: '#fbbf24', textShadow: '0 0 16px #f59e0b' }}>VS</motion.div>
            </div>

            <div style={{ borderRadius: 10, padding: 10, border: `1px solid ${BLUE}55`, background: `linear-gradient(180deg, ${BLUE}22, transparent)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7dd3fc', fontSize: 10, letterSpacing: 2 }}><Shield size={13} /> DEFENSE</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#fff', margin: '4px 0 2px' }}>{data.defense.player || '—'}</div>
              <div style={{ fontFamily: mono, fontSize: 26, color: BLUE }}>{Math.round(dfn)}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 8 }}>POWER{data.defense.boost_pct ? ` · +${data.defense.boost_pct}% boost` : ''}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#e2e8f0', marginBottom: 8 }}>
                <Castle size={14} color={BLUE} /> WALLS <span style={{ fontFamily: mono, marginLeft: 'auto' }}>{data.defense.walls}/{data.defense.walls_max}</span>
              </div>
              <UnitColumn rows={data.defense.garrison} color={BLUE} max={maxPower} label="STATIONED" />
              {data.defense.sent.length > 0 && <div style={{ height: 8 }} />}
              <UnitColumn rows={data.defense.sent} color="#a78bfa" max={maxPower} label="SENT AS REINFORCEMENT" />
              {!data.defense.garrison.length && !data.defense.sent.length && <div style={{ fontSize: 11, color: '#94a3b8' }}>No troops — walls only</div>}
            </div>
          </div>

          {/* Balance of power */}
          <div style={{ marginTop: 14 }}>
            <div style={{ position: 'relative', height: 14, borderRadius: 7, overflow: 'hidden', background: BLUE, border: '1px solid rgba(255,255,255,0.15)' }}>
              <motion.div animate={{ width: `${atkShare * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 16 }}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: `linear-gradient(90deg, #7f1d1d, ${RED})` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
              <span>{Math.round(atkShare * 100)}% of the force</span>
              <span style={{ color: holdCol, fontWeight: 700 }}>{done ? '' : `${hold}% chance to hold`}</span>
            </div>
          </div>

          {/* Defender window */}
          {data.role === 'defender' && data.actions && !done && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#fbbf24', marginBottom: 8 }}>YOUR MOVE BEFORE THE TIMER ENDS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                <div className="hx-card" style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', marginBottom: 6 }}><Users size={14} /> SEND TROOPS</div>
                  {Object.keys(reserve).length === 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>No free troops — recruit in Military</div>}
                  {Object.entries(reserve).map(([k, n]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#e2e8f0', marginBottom: 4 }}>
                      <IconSVG id={UNIT_ICON[k] || 'swords'} size={20} />
                      <span style={{ flex: 1, textTransform: 'capitalize' }}>{k} <span style={{ color: '#94a3b8' }}>/{n}</span></span>
                      <button style={STEP} onClick={() => setSend(s => ({ ...s, [k]: Math.max(0, (s[k] || 0) - 1) }))}>-</button>
                      <span style={{ fontFamily: mono, width: 24, textAlign: 'center' }}>{send[k] || 0}</span>
                      <button style={STEP} onClick={() => setSend(s => ({ ...s, [k]: Math.min(n, (s[k] || 0) + 1) }))}>+</button>
                      <button onClick={() => setSend(s => ({ ...s, [k]: n }))} style={{ fontSize: 9, background: 'none', border: 'none', color: '#7dd3fc', cursor: 'pointer' }}>ALL</button>
                    </div>
                  ))}
                  {Object.keys(reserve).length > 0 && (
                    <button className="btn-game btn-game-green" disabled={!sendTotal || busy === 'send'} style={{ width: '100%', padding: '7px 0', fontSize: 10, marginTop: 4 }}
                      onClick={() => act('send', () => api.post('/combat/defend/', { battle_id: id, units: send }).then(r => { setSend({}); return r }))}>
                      {busy === 'send' ? '...' : `DEPLOY ${sendTotal || ''}`}
                    </button>
                  )}
                </div>
                <div className="hx-card" style={{ padding: 10, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', marginBottom: 6 }}><Castle size={14} /> REINFORCE WALLS</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>+{data.actions.reinforce_defense} wall points, up to {data.defense.walls_max}.</div>
                  <button className="btn-game btn-game-gold" disabled={busy === 'walls' || data.defense.walls >= data.defense.walls_max}
                    style={{ width: '100%', padding: '7px 0', fontSize: 10, marginTop: 6 }}
                    onClick={() => act('walls', () => api.post('/combat/reinforce/', { battle_id: id }))}>
                    {data.defense.walls >= data.defense.walls_max ? 'MAXED' : busy === 'walls' ? '...' : `${data.actions.reinforce_cost} HEX`}
                  </button>
                </div>
                <div className="hx-card" style={{ padding: 10, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fff', marginBottom: 6 }}><Zap size={14} /> DEFENSE BONUS</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>
                    {data.actions.boost_item ? `${data.actions.boost_item.name}: defense boost in every battle (capped).` : `Active: +${data.defense.boost_pct}% defense.`}
                  </div>
                  {data.actions.boost_item && (
                    <button className="btn-game btn-game-gold" disabled={busy === 'boost'} style={{ width: '100%', padding: '7px 0', fontSize: 10, marginTop: 6 }}
                      onClick={() => act('boost', () => api.post('/shop/purchase/', { item_code: data.actions!.boost_item!.code, quantity: 1 }), 'purchase')}>
                      {busy === 'boost' ? '...' : `ACTIVATE · ${data.actions.boost_item.price} HEX`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {data.role === 'attacker' && !done && (
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>The defender can still send troops, raise walls or activate a bonus until the timer ends.</div>
          )}
        </>}
      </motion.div>
    </motion.div>
  )
}
