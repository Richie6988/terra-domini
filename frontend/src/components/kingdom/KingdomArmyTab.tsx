/**
 * KingdomArmyTab — the "ARMY" tab of a kingdom / territory (GET /api/kingdom/<h3>/overview/): its 3 counters
 * (attack, defense, spy — combat/forces.py) to buy with HEX, and the kingdom upgrades (influence, science, education —
 * POST /api/kingdom/<h3>/upgrade/).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FlaskConical, GraduationCap, Radar, ShieldAlert } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'
import { celebrate } from '../shared/Celebrate'
import { ForcesCounters } from '../combat/ForcesCounters'

const UP_ICON: Record<string, typeof Radar> = { influence: Radar, science: FlaskConical, education: GraduationCap }
const UP_COLOR: Record<string, string> = { influence: '#fbbf24', science: '#a78bfa', education: '#34d399' }
const label: React.CSSProperties = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }

export function KingdomArmyTab({ h3, onOpenMilitary }: { h3: string; onOpenMilitary?: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['kingdom-overview', h3],
    queryFn: () => api.get(`/kingdom/${h3}/overview/`).then(r => r.data),
    enabled: !!h3, staleTime: 10000,
  })

  const buyUpgrade = async (key: string) => {
    try {
      const { data: r } = await api.post(`/kingdom/${h3}/upgrade/`, { upgrade: key })
      qc.setQueryData(['kingdom-overview', h3], r)
      playSound('bonus')
      celebrate('small', `${r.upgrades.find((u: any) => u.key === key)?.name} level ${r.bought.level}`)
      const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
      qc.invalidateQueries({ queryKey: ['player'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upgrade failed')
    }
  }

  if (isLoading || !data) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--hx-text-3)', fontSize: 12 }}>Loading forces…</div>
  const bal = data.balance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...label, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>FORCES {data.kind === 'kingdom' ? `· KINGDOM OF ${data.size} HEXES` : '· LONE TERRITORY'}</span>
        {data.under_attack && <span className="hx-chip" style={{ color: '#f87171', borderColor: '#7f1d1d' }}><ShieldAlert size={11} /> UNDER ATTACK</span>}
        {onOpenMilitary && <button onClick={onOpenMilitary} className="hx-chip" style={{ cursor: 'pointer' }}>ALL KINGDOMS</button>}
      </div>
      <ForcesCounters h3={h3} forces={data.forces} pointCost={data.point_cost} />
      <div style={{ fontSize: 11, color: 'var(--hx-text-2)', textTransform: 'none', letterSpacing: 0, lineHeight: 1.45 }}>
        Defense protects every hex of this kingdom: an attack takes a hex only with more points than this defense.
        Attack points leave from the kingdom nearest to the target. Spies: −{Math.round(data.spy_discount.per_point * 100)}% on a discovery's price and time each (max {data.spy_discount.max_points}).
      </div>

      <div>
        <div style={{ ...label, marginBottom: 6 }}>UPGRADES · APPLY TO THE WHOLE KINGDOM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.upgrades.map((u: any) => {
            const Icon = UP_ICON[u.key] || Radar
            const c = UP_COLOR[u.key] || '#94a3b8'
            const maxed = u.cost == null
            return (
              <div key={u.key} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               background: `${c}22`, color: c, border: `1px solid ${c}55`, flexShrink: 0 }}><Icon size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{u.name.toUpperCase()}</span>
                    <span style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: u.max_level }, (_, i) => (
                        <i key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < u.level ? c : 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--hx-text-2)', marginTop: 2 }}>
                    {u.level ? u.effect : 'Not built'}{u.next_effect && <span style={{ color: c }}> → {u.next_effect}</span>}
                  </div>
                </div>
                {maxed
                  ? <span className="hx-chip" style={{ color: c }}>MAX</span>
                  : <button onClick={() => buyUpgrade(u.key)} disabled={bal < u.cost} className="btn-game btn-game-gold"
                            style={{ padding: '8px 10px', fontSize: 10, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4,
                                     opacity: bal < u.cost ? 0.45 : 1, flexShrink: 0 }}>
                      <IconSVG id="hex_coin" size={12} />{u.cost.toLocaleString()}
                    </button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
