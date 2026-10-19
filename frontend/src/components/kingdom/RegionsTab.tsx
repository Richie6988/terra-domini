/**
 * RegionsTab — the Risk "continents" (GET /api/regions/): in each region the player holding the most territories
 * controls it and earns troops in the daily draft + HEX bonus there. Shows where I lead and what it takes to win more.
 */
import { useQuery } from '@tanstack/react-query'
import { Flag, Crown, Swords } from 'lucide-react'
import { api } from '../../services/api'

const MONO = "'Share Tech Mono', monospace"
const label: React.CSSProperties = { fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)', fontWeight: 700 }

export function RegionsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['regions'], queryFn: () => api.get('/regions/').then(r => r.data), staleTime: 60000 })
  if (isLoading || !data) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 58, borderRadius: 12 }} />)}</div>
  const rules = data.rules
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(251,191,36,0.4)',
                                        background: 'linear-gradient(160deg, rgba(251,191,36,0.14), rgba(251,191,36,0.03))' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}><Flag size={24} /></span>
        <div style={{ flex: 1 }}>
          <div style={label}>REGIONS CONTROLLED</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 900, color: '#fde68a', lineHeight: 1.1 }}>{data.controlled}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--hx-text-2)', lineHeight: 1.6 }}>
          <div><b style={{ color: '#4ade80', fontFamily: MONO }}>+{data.bonus.draft}</b> troops / daily draft</div>
          <div><b style={{ color: '#fde68a', fontFamily: MONO }}>+{rules.hex_pct}%</b> HEX in each one</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--hx-text-3)', textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
        Hold the most territories in a region (at least {rules.min}) to control it: +{rules.draft_per_region} troops every day and +{rules.hex_pct}% HEX there.
        Rivals can take it back by out-holding you.
      </div>
      {data.regions.length === 0 && <div className="hx-empty"><div className="hx-empty__title">NO LAND YET</div></div>}
      {data.regions.map((r: any) => {
        const total = Math.max(r.mine, r.rival_best, rules.min)
        const c = r.controlled ? '#fbbf24' : r.leader ? '#f87171' : '#94a3b8'
        return (
          <div key={r.id} className="hx-card" style={{ padding: 10, borderColor: r.controlled ? 'rgba(251,191,36,0.45)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.controlled ? <Crown size={15} color="#fbbf24" /> : <Swords size={14} color={c} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span className="hx-chip" style={{ color: c }}>
                {r.controlled ? 'CONTROLLED' : r.leader ? `HELD BY ${r.leader.toUpperCase()}` : 'UNCLAIMED'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${(r.mine / total) * 100}%`, background: r.controlled ? '#fbbf24' : '#60a5fa', borderRadius: 4 }} />
                {r.rival_best > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${(r.rival_best / total) * 100}% - 2px)`, width: 3, background: '#f87171' }} />}
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{r.mine} vs {r.rival_best}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 5, textTransform: 'none', letterSpacing: 0 }}>
              {r.controlled
                ? (r.rival_best >= r.mine - 1 ? `Under threat: a rival holds ${r.rival_best}` : `${r.players} player${r.players > 1 ? 's' : ''} here · lead of ${r.mine - r.rival_best}`)
                : `${r.to_take} more territor${r.to_take > 1 ? 'ies' : 'y'} here to take control`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
