/**
 * ForcesCounters — the 3 counters of a kingdom / territory (combat/forces.py): attack, defense, spy.
 * Buy points with HEX on that kingdom (POST /api/forces/buy/). Shared by Military and the kingdom ARMY tab.
 */
import { openShop } from '../shop/openShop'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Swords, Shield, Eye } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore, useGodMode } from '../../store'
import { playSound } from '../../hooks/useSound'

export type Forces = { attack: number; defense: number; spy: number }
export const FORCE_META = {
  attack:  { label: 'ATTACK',  color: '#f87171', Icon: Swords, help: 'Spent 1 for 1 against an enemy\'s defense' },
  defense: { label: 'DEFENSE', color: '#60a5fa', Icon: Shield, help: 'Absorbs attacks on this kingdom, 1 for 1' },
  spy:     { label: 'SPY',     color: '#c084fc', Icon: Eye,    help: '−5 % on a discovery\'s price and time each (max 10)' },
} as const
const MONO = "'Share Tech Mono', monospace"

export function ForcesCounters({ h3, forces, pointCost, compact = false, multipliers }: {
  h3: string; forces: Forces; pointCost: Record<string, number>; compact?: boolean
  multipliers?: Record<string, number>     // kingdom upgrades: influence → attack, fortification → defense, education → spy
}) {
  const qc = useQueryClient()
  const god = useGodMode()
  const [qty, setQty] = useState(10)
  const [busy, setBusy] = useState<string | null>(null)
  const buy = async (kind: keyof Forces) => {
    setBusy(kind)
    try {
      const { data: r } = await api.post('/forces/buy/', { h3, kind, qty })
      playSound('bonus'); toast.success(`+${r.qty} ${FORCE_META[kind].label.toLowerCase()} · −${r.cost.toLocaleString()} HEX`)
      const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
      ;['my-army', 'kingdom-overview', 'kingdoms', 'player'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Purchase failed')
      if (e?.response?.status === 402) openShop('hex')       // short of HEX → GET HEX packs
    }
    setBusy(null)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {(Object.keys(FORCE_META) as (keyof Forces)[]).map(k => {
          const m = FORCE_META[k]
          return (
            <div key={k} className="hx-card" title={m.help} style={{ padding: compact ? 8 : 10, textAlign: 'center', borderColor: `${m.color}55`,
              background: `linear-gradient(180deg, ${m.color}1f, transparent)` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: m.color }}>
                <m.Icon size={12} /> {m.label}
                {(multipliers?.[k] || 1) > 1 && <span style={{ color: '#fde68a' }}>x{multipliers![k].toFixed(1)}</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: compact ? 20 : 24, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1, margin: '2px 0 6px' }}>
                {(forces?.[k] || 0).toLocaleString()}
              </div>
              <button onClick={() => buy(k)} disabled={busy !== null} className="btn-game btn-game-gold"
                style={{ width: '100%', padding: '6px 4px', fontSize: 10, letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                +{qty} · {god ? 'FREE' : <><IconSVG id="hex_coin" size={11} />{(qty * (pointCost?.[k] || 0)).toLocaleString()}</>}
              </button>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: 10, color: 'var(--hx-text-3)' }}>
        BUY BY
        {[10, 50, 100, 500].map(n => (
          <button key={n} onClick={() => setQty(n)} className="hx-chip"
            style={{ cursor: 'pointer', ...(qty === n ? { color: '#fde68a', borderColor: '#fde68a' } : {}) }}>{n}</button>
        ))}
      </div>
    </div>
  )
}
