/**
 * KingdomArmyTab — the "ARMY" tab of a kingdom / territory (GET /api/kingdom/<h3>/overview/):
 * every unit type stationed there, the defense points, and the upgrades to buy with HEX
 * (walls, barracks, science, education — POST /api/kingdom/<h3>/upgrade/).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Castle, Tent, FlaskConical, GraduationCap, Shield, ShieldAlert, ArrowRight, Radar } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'
import { celebrate } from '../shared/Celebrate'

const UP_ICON: Record<string, typeof Castle> = { walls: Castle, influence: Radar, barracks: Tent, science: FlaskConical, education: GraduationCap }
const UP_COLOR: Record<string, string> = { walls: '#60a5fa', influence: '#fbbf24', barracks: '#f87171', science: '#a78bfa', education: '#34d399' }
const HEAD = "'Orbitron', sans-serif"
const MONO = "'Share Tech Mono', monospace"
const label: React.CSSProperties = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700, fontFamily: HEAD }

export function KingdomArmyTab({ h3, onOpenMilitary }: { h3: string; onOpenMilitary?: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['kingdom-overview', h3],
    queryFn: () => api.get(`/kingdom/${h3}/overview/`).then(r => r.data),
    enabled: !!h3, staleTime: 10000,
  })

  const buy = async (key: string) => {
    try {
      const { data: r } = await api.post(`/kingdom/${h3}/upgrade/`, { upgrade: key })
      qc.setQueryData(['kingdom-overview', h3], r)
      playSound('bonus')
      celebrate('small', `${r.upgrades.find((u: any) => u.key === key)?.name} level ${r.bought.level}`)
      const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
      ;['player', 'wallet', 'my-army', 'kingdom-overview'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upgrade failed')
    }
  }

  if (isLoading || !data) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--hx-text-3)', fontSize: 12 }}>Loading forces…</div>

  const d = data.defense
  const stationed = data.units.reduce((a: number, u: any) => a + u.stationed, 0)
  const bal = data.balance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Defense points */}
      <div className="hx-card" style={{ background: 'linear-gradient(160deg, rgba(96,165,250,0.14), rgba(96,165,250,0.03))', borderColor: 'rgba(96,165,250,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'rgba(96,165,250,0.15)', color: d.under_attack ? '#f87171' : '#60a5fa' }}>
            {d.under_attack ? <ShieldAlert size={26} /> : <Shield size={26} />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={label}>DEFENSE POINTS {data.kind === 'kingdom' ? `· KINGDOM OF ${data.size} HEXES` : ''}</div>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 900, color: '#e2e8f0', lineHeight: 1.1 }}>{d.total.toLocaleString()}</div>
          </div>
          {d.under_attack && <span className="hx-chip" style={{ color: '#f87171', borderColor: '#7f1d1d' }}>UNDER ATTACK</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--hx-text-2)' }}>
          <span>Fortifications <b style={{ color: '#e2e8f0', fontFamily: MONO }}>{d.fortifications}</b></span>
          <span>Troops <b style={{ color: '#e2e8f0', fontFamily: MONO }}>{d.troops}</b></span>
          {d.walls_pct > 0 && <span>Walls <b style={{ color: '#60a5fa', fontFamily: MONO }}>+{d.walls_pct}%</b></span>}
          {d.shield_until && <span style={{ color: '#38bdf8' }}>Shielded</span>}
        </div>
      </div>

      {/* Units by type */}
      <div>
        <div style={{ ...label, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>GARRISON · {stationed} UNITS</span>
          {onOpenMilitary && <button onClick={onOpenMilitary} className="hx-chip" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            STATION TROOPS <ArrowRight size={11} /></button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {data.units.map((u: any) => (
            <div key={u.type} className="hx-card" style={{ padding: 8, textAlign: 'center', opacity: u.stationed ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><IconSVG id={u.icon} size={34} /></div>
              <div style={{ fontSize: 9, fontFamily: HEAD, fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>{u.name.toUpperCase()}</div>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 900, color: '#e2e8f0' }}>{u.stationed}</div>
              <div style={{ fontSize: 9, color: 'var(--hx-text-3)' }}>ATK {u.atk} · DEF {u.def}{u.reserve ? ` · ${u.reserve} in reserve` : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrades */}
      <div>
        <div style={{ ...label, marginBottom: 6 }}>UPGRADES · APPLY TO THE WHOLE KINGDOM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.upgrades.map((u: any) => {
            const Icon = UP_ICON[u.key] || Castle
            const c = UP_COLOR[u.key] || '#94a3b8'
            const maxed = u.cost == null
            return (
              <div key={u.key} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               background: `${c}22`, color: c, border: `1px solid ${c}55`, flexShrink: 0 }}><Icon size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: HEAD, fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{u.name.toUpperCase()}</span>
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
                  : <button onClick={() => buy(u.key)} disabled={bal < u.cost} className="btn-game btn-game-gold"
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
