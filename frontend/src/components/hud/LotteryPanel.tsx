/**
 * LotteryPanel — Lucky wheel (GET /api/lottery/, POST /api/lottery/play/).
 * Cartoon wheel (owner 2026-10-19): HEX multipliers, a random TERRITORY somewhere in the world, 1/10 000 a POI, the
 * jackpot. The server draws the result; the wheel only stages it. Earned HEX only (no gambling with purchased HEX).
 */
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'
import { celebrate } from '../shared/Celebrate'

const TIER_STYLE: Record<string, { color: string; label: string }> = {
  bronze: { color: '#cd7f32', label: 'BRONZE' }, silver: { color: '#cbd5e1', label: 'SILVER' }, gold: { color: '#fbbf24', label: 'GOLD' },
}
// Wheel slices (cartoon: flat bright colours, thick ink outline). Several '0' so the wheel reads honestly.
const SLICES: { key: string; label: string; fill: string; ink?: string }[] = [
  { key: '0', label: '0', fill: '#475569' }, { key: 'x1', label: 'x1', fill: '#22c55e' },
  { key: 'x0.5', label: 'x0.5', fill: '#38bdf8' }, { key: 'x2', label: 'x2', fill: '#f97316' },
  { key: '0', label: '0', fill: '#475569' }, { key: 'territory', label: 'LAND', fill: '#a3e635', ink: '#1a2e05' },
  { key: 'x5', label: 'x5', fill: '#ec4899' }, { key: '0', label: '0', fill: '#475569' },
  { key: 'x10', label: 'x10', fill: '#8b5cf6' }, { key: 'poi', label: 'POI', fill: '#f43f5e' },
  { key: 'x25', label: 'x25', fill: '#06b6d4' }, { key: 'JACKPOT', label: 'JACKPOT', fill: '#facc15', ink: '#422006' },
]
const keyOf = (m: number | string) => (m === 'JACKPOT' || m === 'territory' || m === 'poi' ? String(m) : m === 0 ? '0' : `x${m}`)
const SEG = 360 / SLICES.length
const R = 100

function Wheel({ angle, spinning }: { angle: number; spinning: boolean }) {
  const arc = (i: number) => {
    const a0 = (i * SEG - 90 - SEG / 2) * Math.PI / 180, a1 = ((i + 1) * SEG - 90 - SEG / 2) * Math.PI / 180
    return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`
  }
  return (
    <div style={{ position: 'relative', width: 'min(300px, 78vw)', aspectRatio: '1', margin: '0 auto 12px' }}>
      {/* pointer */}
      <svg viewBox="0 0 40 44" style={{ position: 'absolute', top: -10, left: '50%', width: 40, transform: 'translateX(-50%)', zIndex: 2, filter: 'drop-shadow(0 3px 0 #1e1b4b)' }}>
        <path d="M20 42 L4 8 Q20 -6 36 8 Z" fill="#fde047" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="20" cy="13" r="5" fill="#fff" stroke="#1e1b4b" strokeWidth="2.5" />
      </svg>
      <svg viewBox="-118 -118 236 236" style={{ width: '100%', height: '100%', display: 'block' }}>
        <circle r="114" fill="#f59e0b" stroke="#1e1b4b" strokeWidth="6" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15) * Math.PI / 180
          return <circle key={i} cx={107 * Math.cos(a)} cy={107 * Math.sin(a)} r="3.6" fill={i % 2 ? '#fff7ed' : '#fde047'} stroke="#1e1b4b" strokeWidth="1.5"
            className={spinning ? 'hx-wheel-bulb' : undefined} style={{ animationDelay: `${(i % 2) * 0.2}s` }} />
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(.15,.85,.2,1)' : 'none' }}>
          {SLICES.map((sl, i) => (
            <g key={i}>
              <path d={arc(i)} fill={sl.fill} stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
              <path d={arc(i)} fill="url(#hxWheelShine)" />
              <text transform={`rotate(${i * SEG}) translate(0 ${-R * 0.66}) rotate(0)`} textAnchor="middle" dominantBaseline="middle"
                fontFamily="'Luckiest Guy', 'Lilita One', var(--font-heading), sans-serif" fontWeight="900"
                fontSize={sl.label.length > 4 ? 12 : sl.label.length > 2 ? 15 : 19} fill={sl.ink ? sl.ink : '#fff'}
                stroke={sl.ink ? 'none' : '#1e1b4b'} strokeWidth="3" paintOrder="stroke">{sl.label}</text>
            </g>
          ))}
        </g>
        <defs>
          <radialGradient id="hxWheelShine" cx="0" cy="-30" r="120" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="0.6" stopColor="#fff" stopOpacity="0.05" /><stop offset="1" stopColor="#000" stopOpacity="0.15" />
          </radialGradient>
        </defs>
        <circle r="22" fill="#fde047" stroke="#1e1b4b" strokeWidth="5" />
        <circle r="10" fill="#f97316" stroke="#1e1b4b" strokeWidth="3" />
        <ellipse cx="-6" cy="-9" rx="7" ry="4" fill="#fff" opacity="0.7" />
      </svg>
    </div>
  )
}

export function LotteryPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<any>({ queryKey: ['lottery'], queryFn: () => api.get('/lottery/').then(r => r.data), refetchInterval: 20000 })
  const [spinning, setSpinning] = useState(false)
  const [angle, setAngle] = useState(0)
  const [result, setResult] = useState<any>(null)
  const turns = useRef(0)

  const play = async (tier: string, free = false) => {
    if (spinning) return
    setSpinning(true); setResult(null)
    playSound('booster')
    try {
      const { data: r } = await api.post('/lottery/play/', { tier, free })
      // Stage the wheel: land on a slice showing the server's result (pick one when several match)
      const k = keyOf(r.multiplier)
      const idx = SLICES.map((sl, i) => sl.key === k ? i : -1).filter(i => i >= 0)
      const i = idx[Math.floor(Math.random() * idx.length)] ?? 0
      turns.current += 6
      const jitter = (Math.random() - 0.5) * SEG * 0.6
      setAngle(turns.current * 360 - i * SEG + jitter)
      setTimeout(() => {
        setResult(r); setSpinning(false)
        const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
        if (r.won) { playSound('card_legendary'); celebrate('big', r.won.kind === 'poi' ? `POI WON · ${r.won.name}` : `NEW TERRITORY${r.won.name ? ` · ${r.won.name}` : ''}`)
          ;['kingdoms', 'territories', 'my-territories', 'my-territories-detail'].forEach(q => qc.invalidateQueries({ queryKey: [q] })) }
        else if (r.jackpot) { playSound('card_legendary'); celebrate('jackpot', `JACKPOT +${r.prize.toLocaleString()} HEX`) }
        else if (r.multiplier >= 5) { playSound('win'); celebrate('big', `x${r.multiplier} · +${r.prize.toLocaleString()} HEX`) }
        else if (r.prize > 0) { playSound('reward'); celebrate('small', `+${r.prize.toLocaleString()} HEX`) }
        else playSound('lose')
        ;['lottery', 'player', 'wallet', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      }, 4300)
    } catch (e: any) {
      setSpinning(false); playSound('error')
      toast.error(e?.response?.data?.error || 'Ticket refused')
    }
  }

  return (
    <GlassPanel title="LUCKY" onClose={onClose} accent="#ec4899" icon={<IconSVG id="clover" size={24} />}
      subtitle="Spin for HEX, a territory, a POI or the jackpot">
      {/* Jackpot */}
      <div className="hx-card" style={{ textAlign: 'center', marginBottom: 12, background: 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(251,191,36,0.18))', borderColor: '#f59e0b' }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: '#fde68a' }}>JACKPOT</div>
        <motion.div key={data?.pool} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
          style={{ fontFamily: 'var(--font-heading)', fontSize: 40, color: '#fde047', textShadow: '0 3px 0 #7c2d12, 0 0 24px #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconSVG id="hex_coin" size={34} />{(data?.pool ?? 0).toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 11, color: 'var(--hx-text-2)', textTransform: 'none', letterSpacing: 0 }}>10 % of every ticket feeds it. Gold wins it all.</div>
      </div>

      <Wheel angle={angle} spinning={spinning} />
      {result && !spinning && (
        <div style={{ textAlign: 'center', marginBottom: 10, fontFamily: 'var(--font-heading)', fontSize: 16, color: result.prize || result.won ? '#4ade80' : '#94a3b8' }}>
          {result.won ? (result.won.kind === 'poi' ? `POINT OF INTEREST WON: ${result.won.name}` : `TERRITORY WON${result.won.name ? `: ${result.won.name}` : ''} — a new base`)
            : result.jackpot ? `JACKPOT! +${result.prize.toLocaleString()} HEX` : result.prize ? `+${result.prize.toLocaleString()} HEX` : 'No luck — try again'}
          {result.won && (
            <button className="btn-game btn-game-green" style={{ display: 'block', margin: '8px auto 0', fontSize: 12 }}
              onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat: result.won.lat, lon: result.won.lon, zoom: 15 } })) }}>
              GO SEE IT</button>
          )}
        </div>
      )}

      {/* Tickets */}
      {data?.free_ticket && (
        <motion.button animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} disabled={spinning}
          onClick={() => play('bronze', true)} className="btn-game btn-game-green" style={{ width: '100%', marginBottom: 10, minHeight: 48, fontSize: 14 }}>
          FREE DAILY TICKET
        </motion.button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {(data?.tiers || []).map((t: any) => (
          <button key={t.id} disabled={spinning} onClick={() => play(t.id)} className="hx-card" style={{ cursor: 'pointer', textAlign: 'center',
            borderColor: TIER_STYLE[t.id].color, background: `linear-gradient(180deg, ${TIER_STYLE[t.id].color}33, transparent)`, padding: 12 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: TIER_STYLE[t.id].color }}>{TIER_STYLE[t.id].label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: '4px 0' }}>
              <IconSVG id="hex_coin" size={16} />{t.cost.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>up to x25 · land · {Math.round(t.jackpot_share * 100)}% jackpot</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--hx-text-3)', marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
        Paid with HEX earned in game ({Math.floor(data?.earned_balance ?? 0).toLocaleString()} available) — purchased HEX can't be used here.
      </div>

      {/* Odds + winners: transparent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div className="hx-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>ODDS</div>
          {(data?.odds || []).map((o: any) => (
            <div key={String(o.multiplier)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hx-text-2)' }}>
              <span>{o.multiplier === 'JACKPOT' ? 'JACKPOT' : o.multiplier === 'territory' ? 'a territory' : o.multiplier === 'poi' ? 'a POI' : o.multiplier === 0 ? 'nothing' : `x${o.multiplier}`}</span>
              <span>{o.chance < 0.001 ? `1 / ${Math.round(1 / o.chance).toLocaleString()}` : `${(o.chance * 100).toFixed(o.chance < 0.01 ? 1 : 0)} %`}</span>
            </div>
          ))}
        </div>
        <div className="hx-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>BIG WINS</div>
          {(data?.recent_wins || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--hx-text-3)' }}>Be the first.</div>}
          {(data?.recent_wins || []).map((w: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: w.jackpot ? '#fde047' : 'var(--hx-text-2)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{w.player}</span>
              <span>{w.land ? (w.land === 'poi' ? 'POI' : 'LAND') : `+${w.prize.toLocaleString()}`}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
