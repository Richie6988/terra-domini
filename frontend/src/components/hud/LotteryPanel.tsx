/**
 * LotteryPanel — Lucky draw (GET /api/lottery/, POST /api/lottery/play/).
 * The server draws the result; the reel only stages it. Earned HEX only (no gambling with purchased HEX).
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
const REEL = ['0', 'x0.5', 'x1', 'x2', 'x5', 'x10', 'x25', 'JACKPOT']
const cellOf = (m: number | string) => (m === 'JACKPOT' ? 'JACKPOT' : m === 0 ? '0' : `x${m}`)
const CELL_H = 64

export function LotteryPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<any>({ queryKey: ['lottery'], queryFn: () => api.get('/lottery/').then(r => r.data), refetchInterval: 20000 })
  const [spinning, setSpinning] = useState(false)
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<any>(null)
  const strip = useRef<string[]>(Array.from({ length: 60 }, (_, i) => REEL[i % REEL.length]))

  const play = async (tier: string, free = false) => {
    if (spinning) return
    setSpinning(true); setResult(null)
    playSound('booster')
    try {
      const { data: r } = await api.post('/lottery/play/', { tier, free })
      // Stage the reel: land on a cell showing the server's result
      const target = cellOf(r.multiplier)
      const land = 44 + REEL.indexOf(target)
      strip.current = Array.from({ length: 60 }, (_, i) => (i === land ? target : REEL[(i * 5 + 3) % REEL.length]))
      setOffset(0)
      requestAnimationFrame(() => setOffset(land * CELL_H))
      setTimeout(() => {
        setResult(r); setSpinning(false)
        const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
        if (r.jackpot) { playSound('card_legendary'); celebrate('jackpot', `JACKPOT +${r.prize.toLocaleString()} HEX`) }
        else if (r.multiplier >= 5) { playSound('win'); celebrate('big', `x${r.multiplier} · +${r.prize.toLocaleString()} HEX`) }
        else if (r.prize > 0) { playSound('reward'); celebrate('small', `+${r.prize.toLocaleString()} HEX`) }
        else playSound('lose')
        ;['lottery', 'player', 'wallet', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      }, 2600)
    } catch (e: any) {
      setSpinning(false); playSound('error')
      toast.error(e?.response?.data?.error || 'Ticket refused')
    }
  }

  return (
    <GlassPanel title="LUCKY" onClose={onClose} accent="#ec4899" icon={<IconSVG id="clover" size={24} />}
      subtitle="Spend earned HEX on a chance — progressive jackpot">
      {/* Jackpot */}
      <div className="hx-card" style={{ textAlign: 'center', marginBottom: 12, background: 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(251,191,36,0.18))', borderColor: '#f59e0b' }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: '#fde68a' }}>JACKPOT</div>
        <motion.div key={data?.pool} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
          style={{ fontFamily: 'var(--font-heading)', fontSize: 40, color: '#fde047', textShadow: '0 3px 0 #7c2d12, 0 0 24px #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconSVG id="hex_coin" size={34} />{(data?.pool ?? 0).toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 11, color: 'var(--hx-text-2)', textTransform: 'none', letterSpacing: 0 }}>10 % of every ticket feeds it. Gold wins it all.</div>
      </div>

      {/* Reel */}
      <div style={{ position: 'relative', height: CELL_H, overflow: 'hidden', borderRadius: 14, border: '3px solid #f59e0b', marginBottom: 12,
        background: 'linear-gradient(180deg, #0b1020, #1e1b4b 50%, #0b1020)', boxShadow: 'inset 0 0 24px rgba(0,0,0,0.8), 0 0 24px rgba(236,72,153,0.25)' }}>
        <div style={{ transform: `translateY(-${offset}px)`, transition: offset ? 'transform 2.5s cubic-bezier(.12,.75,.15,1)' : 'none' }}>
          {strip.current.map((c, i) => (
            <div key={i} style={{ height: CELL_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)',
              fontSize: c === 'JACKPOT' ? 28 : 34, color: c === 'JACKPOT' ? '#fde047' : c === '0' ? '#64748b' : '#fff',
              textShadow: c === '0' ? 'none' : '0 0 14px rgba(251,191,36,0.8)' }}>{c}</div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent 30%, transparent 70%, rgba(0,0,0,0.6))' }} />
      </div>
      {result && !spinning && (
        <div style={{ textAlign: 'center', marginBottom: 10, fontFamily: 'var(--font-heading)', fontSize: 16, color: result.prize ? '#4ade80' : '#94a3b8' }}>
          {result.jackpot ? `JACKPOT! +${result.prize.toLocaleString()} HEX` : result.prize ? `+${result.prize.toLocaleString()} HEX` : 'No luck — try again'}
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
            <div style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>up to x25 · {Math.round(t.jackpot_share * 100)}% jackpot</div>
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
              <span>{o.multiplier === 'JACKPOT' ? 'JACKPOT' : o.multiplier === 0 ? 'nothing' : `x${o.multiplier}`}</span>
              <span>{(o.chance * 100).toFixed(o.chance < 0.01 ? 1 : 0)} %</span>
            </div>
          ))}
        </div>
        <div className="hx-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>BIG WINS</div>
          {(data?.recent_wins || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--hx-text-3)' }}>Be the first.</div>}
          {(data?.recent_wins || []).map((w: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: w.jackpot ? '#fde047' : 'var(--hx-text-2)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{w.player}</span>
              <span>+{w.prize.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}
