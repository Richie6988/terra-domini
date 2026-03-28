/**
 * Game Master Workspace — Admin Control Panel
 * Route: /gm (requires staff=true)
 *
 * Sections:
 * - Live dashboard (players, battles, economy)
 * - Player management (search, ban, grant HEX Coin)
 * - Control Tower management (create, force-start, cancel)
 * - World POI manager (activate Hormuz, edit effects)
 * - Broadcast to all players
 * - Economy controls (HEX Coin rate, circuit breakers)
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0


// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  players: { total: number; online_now: number; active_1h: number; new_today: number }
  territories: { total: number; claimed: number; unclaimed: number; claim_rate_pct: number }
  battles: { active: number; resolved_today: number }
  economy: { tdc_in_game_total: number; purchases_today_count: number; purchases_today_tdc: number }
  events: { towers_upcoming: number; towers_active: number }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: '#050508', color: '#E8E8F0', fontFamily: "'Space Grotesk', sans-serif" } as const,
  sidebar: { width: 200, background: '#0A0A12', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' as const, padding: '20px 0' },
  nav: { padding: '8px 16px', cursor: 'pointer', fontSize: 13, borderRadius: 6, margin: '2px 8px', display: 'flex', alignItems: 'center', gap: 8 } as const,
  content: { flex: 1, padding: 24, overflowY: 'auto' as const },
  section: { marginBottom: 32 },
  h2: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: '#fff', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  kpi: { background: 'rgba(235,242,250,0.95)', borderRadius: 8, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' },
  kpiN: { fontSize: 26, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 },
  kpiL: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.08em', marginTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)', textTransform: 'uppercase' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#E5E7EB' },
  btn: (color = '#00FF87') => ({ padding: '7px 14px', background: 'transparent', border: `1px solid ${color}40`, borderRadius: 6, color, cursor: 'pointer', fontSize: 12, fontWeight: 500 }),
  btnDanger: { padding: '7px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  card: { background: '#0A0A12', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 20, marginBottom: 16 },
  row: { display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' as const },
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: `${color}20`, color, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em', fontWeight: 500 }),
}

const NAV_ITEMS = [
  { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
  { id: 'players',    icon: '👥', label: 'Players' },
  { id: 'towers',     icon: '🗼', label: 'Towers' },
  { id: 'pois',       icon: '🔥', label: 'World Events' },
  { id: 'broadcast',  icon: '📢', label: 'Broadcast' },
  { id: 'economy',    icon: '🪙', label: 'Economy' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GMWorkspace() {
  const [section, setSection] = useState('dashboard')
  const player = useStore(s => s.player)

  if (!player?.is_staff) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div>Staff access required</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...S.wrap, display: 'flex' }}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: 2, color: '#00FF87' }}>GM PANEL</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 2 }}>{player.username}</div>
        </div>
        {NAV_ITEMS.map(item => (
          <div key={item.id}
            onClick={() => setSection(item.id)}
            style={{
              ...S.nav,
              background: section === item.id ? 'rgba(0,255,135,0.1)' : 'transparent',
              color: section === item.id ? '#00FF87' : 'rgba(255,255,255,0.5)',
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        <AnimatePresence mode="wait">
          <motion.div key={section}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {section === 'dashboard' && <DashboardSection />}
            {section === 'players'   && <PlayersSection />}
            {section === 'towers'    && <TowersSection />}
            {section === 'pois'      && <POIsSection />}
            {section === 'broadcast' && <BroadcastSection />}
            {section === 'economy'   && <EconomySection />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['gm-dashboard'],
    queryFn: () => api.get('/gm/dashboard/').then(r => r.data),
    refetchInterval: 10000,
  })

  if (isLoading || !data) return <Spinner />

  return (
    <div>
      <div style={{ ...S.row, alignItems: 'center', marginBottom: 24 }}>
        <div style={S.h2}>LIVE DASHBOARD</div>
        <div style={{ ...S.badge('#10B981'), marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>
          🟢 LIVE — refreshes every 10s
        </div>
      </div>

      {/* Players KPIs */}
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(0,255,135,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>PLAYERS</div>
      <div style={S.grid}>
        <KPI n={data.players.online_now}   l="Online Now"     color="#00FF87" />
        <KPI n={data.players.active_1h}    l="Active 1h"      color="#10B981" />
        <KPI n={data.players.new_today}    l="New Today"      color="#60A5FA" />
        <KPI n={data.players.total}        l="Total Accounts" color="rgba(255,255,255,0.4)" />
      </div>

      {/* Territories */}
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,184,0,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>TERRITORIES</div>
      <div style={S.grid}>
        <KPI n={data.territories.claimed}        l="Claimed"    color="#FFB800" />
        <KPI n={data.territories.unclaimed}      l="Unclaimed"  color="rgba(255,255,255,0.3)" />
        <KPI n={`${data.territories.claim_rate_pct}%`} l="Claim Rate" color="#FFB800" />
        <KPI n={data.battles.active}             l="Battles Active" color="#FF3B30" />
      </div>

      {/* Economy */}
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(123,47,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>ECONOMY</div>
      <div style={S.grid}>
        <KPI n={`${(toNum(data.economy.tdc_in_game_total) / 1000).toFixed(1)}K`} l="HEX Coin in Circulation" color="#7B2FFF" />
        <KPI n={data.economy.purchases_today_count} l="Purchases Today"  color="#C084FC" />
        <KPI n={`${toNum(data.economy.purchases_today_tdc).toFixed(0)} HEX Coin`} l="Revenue Today" color="#FFB800" />
        <KPI n={data.events.towers_upcoming} l="Towers Scheduled" color="#06B6D4" />
      </div>
    </div>
  )
}

// ─── Players Section ──────────────────────────────────────────────────────────

function PlayersSection() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('-commander_rank')
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [grantAmount, setGrantAmount] = useState(100)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-players', search, sort],
    queryFn: () => api.get(`/gm/players/?search=${search}&sort=${sort}&limit=50`).then(r => r.data),
    staleTime: 5000,
  })

  const actionMut = useMutation({
    mutationFn: ({ pid, action, extra }: { pid: string; action: string; extra?: Record<string, unknown> }) =>
      api.post(`/gm/players/${pid}/action/`, { action, ...extra }),
    onSuccess: (_, vars) => {
      toast.success(`${vars.action} done`)
      qc.invalidateQueries({ queryKey: ['gm-players'] })
      qc.invalidateQueries({ queryKey: ['gm-dashboard'] })
    },
    onError: () => toast.error('Action failed'),
  })

  const players = data?.players ?? []

  return (
    <div>
      <div style={S.h2}>PLAYER MANAGEMENT</div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search username or email..." style={{ ...S.input, maxWidth: 300 }} />
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ ...S.input, width: 'auto', maxWidth: 200 }}>
          <option value="-commander_rank">Rank ↓</option>
          <option value="commander_rank">Rank ↑</option>
          <option value="-tdc_in_game">HEX Coin ↓</option>
          <option value="-last_active">Last Active</option>
          <option value="-date_joined">Newest</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          {data?.count ?? 0} players
        </div>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Player</th>
              <th style={S.th}>Rank</th>
              <th style={S.th}>HEX Coin</th>
              <th style={S.th}>Zones</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p: any) => (
              <tr key={p.id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 500 }}>{p.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{p.email}</div>
                </td>
                <td style={S.td}>
                  <span style={S.badge('#00FF87')}>R{p.rank}</span>
                </td>
                <td style={{ ...S.td, fontFamily: 'monospace' }}>{toNum(p.tdc).toFixed(0)}</td>
                <td style={S.td}>{p.territories}</td>
                <td style={S.td}>
                  <span style={S.badge(p.is_online ? '#10B981' : '#6B7280')}>
                    {p.is_online ? '🟢 Online' : '⚫ Offline'}
                  </span>
                  {p.anticheat_score > 0.5 && (
                    <span style={{ ...S.badge('#FF3B30'), marginLeft: 4 }}>⚠️ AC</span>
                  )}
                </td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setSelectedPlayer(selectedPlayer === p.id ? null : p.id)}
                      style={S.btn('#FFB800')}
                    >
                      + HEX Coin
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`Ban ${p.username}?`)) return
                        actionMut.mutate({ pid: p.id, action: 'ban', extra: { reason: 'GM ban' } })
                      }}
                      style={S.btnDanger}
                    >
                      Ban
                    </button>
                  </div>
                  {selectedPlayer === p.id && (
                    <div style={{ ...S.row, marginTop: 8 }}>
                      <input type="number" value={grantAmount} onChange={e => setGrantAmount(+e.target.value)}
                        style={{ ...S.input, width: 80, padding: '5px 8px' }} min={1} max={100000} />
                      <button
                        onClick={() => {
                          actionMut.mutate({ pid: p.id, action: 'grant_tdc', extra: { amount: grantAmount } })
                          setSelectedPlayer(null)
                        }}
                        style={{ ...S.btn('#FFB800'), background: 'rgba(255,184,0,0.12)' }}
                      >
                        Grant HEX Coin
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Control Tower Section ────────────────────────────────────────────────────

function TowersSection() {
  const [showCreate, setShowCreate] = useState(false)
  const [startIn, setStartIn] = useState(60)
  const [duration, setDuration] = useState(120)
  const [territoryId, setTerritoryId] = useState('')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-towers'],
    queryFn: () => api.get('/gm/towers/').then(r => r.data),
    refetchInterval: 15000,
  })

  const actionMut = useMutation({
    mutationFn: ({ eventId, action }: { eventId?: string; action: string; [k: string]: unknown }) =>
      eventId
        ? api.post(`/gm/towers/${eventId}/`, { action })
        : api.post('/gm/towers/', { territory_id: territoryId, starts_in_minutes: startIn, duration_minutes: duration }),
    onSuccess: () => { toast.success('Done'); qc.invalidateQueries({ queryKey: ['gm-towers'] }) },
    onError: () => toast.error('Failed'),
  })

  const towers = data?.towers ?? []
  const statusColor = { scheduled: '#60A5FA', active: '#00FF87', completed: '#6B7280', cancelled: '#FF3B30' }

  return (
    <div>
      <div style={{ ...S.row, alignItems: 'center', marginBottom: 20 }}>
        <div style={S.h2}>CONTROL TOWERS</div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ ...S.btn('#00FF87'), marginLeft: 'auto', background: 'rgba(0,255,135,0.1)' }}>
          + Create Event
        </button>
      </div>

      {showCreate && (
        <div style={{ ...S.card, borderColor: 'rgba(0,255,135,0.2)', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 14 }}>Create Tower Event</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Territory ID (must be tower)</div>
              <input value={territoryId} onChange={e => setTerritoryId(e.target.value)} style={S.input} placeholder="UUID..." />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Start in (minutes)</div>
              <input type="number" value={startIn} onChange={e => setStartIn(+e.target.value)} style={S.input} min={1} max={1440} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Duration (minutes)</div>
              <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} style={S.input} min={30} max={480} />
            </div>
          </div>
          <button
            onClick={() => actionMut.mutate({ action: 'create' })}
            style={{ ...S.btn('#00FF87'), background: 'rgba(0,255,135,0.12)' }}
          >
            Schedule Event
          </button>
        </div>
      )}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Territory</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Starts At</th>
              <th style={S.th}>Duration</th>
              <th style={S.th}>Participants</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(towers ?? []).slice(0, 20).map((t: any) => {
              const color = (statusColor as any)[t.status] ?? '#6B7280'
              const starts = new Date(t.starts_at)
              const ends = new Date(t.ends_at)
              const durMin = Math.round((ends.getTime() - starts.getTime()) / 60000)
              return (
                <tr key={t.id}>
                  <td style={S.td}><div style={{ fontWeight: 500 }}>{t.territory}</div></td>
                  <td style={S.td}><span style={S.badge(color)}>{t.status.toUpperCase()}</span></td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{starts.toLocaleString()}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{durMin}min</td>
                  <td style={S.td}>{t.participants}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {t.status === 'scheduled' && (
                        <button onClick={() => actionMut.mutate({ eventId: t.id, action: 'force_start' })} style={S.btn('#00FF87')}>Start Now</button>
                      )}
                      {t.status === 'active' && (
                        <button onClick={() => actionMut.mutate({ eventId: t.id, action: 'force_end' })} style={S.btn('#FFB800')}>End Now</button>
                      )}
                      {['scheduled', 'active'].includes(t.status) && (
                        <button onClick={() => actionMut.mutate({ eventId: t.id, action: 'cancel' })} style={S.btnDanger}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── POI Section ──────────────────────────────────────────────────────────────

function POIsSection() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['gm-pois'],
    queryFn: () => api.get('/gm/pois/').then(r => r.data),
  })

  const actionMut = useMutation({
    mutationFn: ({ poi_id, action }: { poi_id: string; action: string }) =>
      api.post('/gm/pois/', { poi_id, action }),
    onSuccess: () => { toast.success('POI updated'); qc.invalidateQueries({ queryKey: ['gm-pois'] }) },
    onError: () => toast.error('Failed'),
  })

  const threatColor = { critical: '#FF3B30', high: '#FF6B35', medium: '#FFB800', low: '#60A5FA', none: '#6B7280' }
  const pois = data?.pois ?? []

  return (
    <div>
      <div style={S.h2}>WORLD EVENTS (POI)</div>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>POI</th>
              <th style={S.th}>Category</th>
              <th style={S.th}>Threat</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Radius</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pois.map((p: any) => {
              const tc = (threatColor as any)[p.threat] ?? '#6B7280'
              return (
                <tr key={p.id}>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16 }}>{p.icon ?? '📍'}</span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td style={S.td}><span style={S.badge('#8B5CF6')}>{p.category}</span></td>
                  <td style={S.td}><span style={S.badge(tc)}>{p.threat?.toUpperCase()}</span></td>
                  <td style={S.td}>
                    <span style={S.badge(p.status === 'active' ? '#00FF87' : '#6B7280')}>
                      {p.status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{p.radius_km}km</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status !== 'active' && (
                        <button onClick={() => actionMut.mutate({ poi_id: p.id, action: 'activate' })}
                          style={{ ...S.btn('#00FF87'), background: 'rgba(0,255,135,0.08)' }}>Activate</button>
                      )}
                      {p.status === 'active' && (
                        <button onClick={() => actionMut.mutate({ poi_id: p.id, action: 'deactivate' })}
                          style={S.btnDanger}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

function BroadcastSection() {
  const [msg, setMsg] = useState('')
  const [type, setType] = useState('announcement')
  const mut = useMutation({
    mutationFn: () => api.post('/gm/broadcast/', { message: msg, type }),
    onSuccess: () => { toast.success('Broadcast sent to all online players!'); setMsg('') },
    onError: () => toast.error('Broadcast failed'),
  })

  return (
    <div>
      <div style={S.h2}>BROADCAST TO ALL PLAYERS</div>
      <div style={S.card}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Message Type</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['announcement', 'alert', 'event'].map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                ...S.btn(type === t ? '#00FF87' : 'rgba(255,255,255,0.3)'),
                background: type === t ? 'rgba(0,255,135,0.1)' : 'transparent',
                textTransform: 'capitalize',
              }}>{t}</button>
            ))}
          </div>
        </div>
        <textarea
          value={msg} onChange={e => setMsg(e.target.value)}
          placeholder="Message to all online players... (max 280 chars)"
          maxLength={280}
          rows={3}
          style={{ ...S.input, resize: 'vertical' as const }}
        />
        <div style={{ ...S.row, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
            {msg.length}/280 characters
          </div>
          <button
            onClick={() => mut.mutate()}
            disabled={!msg.trim() || mut.isPending}
            style={{
              ...S.btn('#00FF87'), marginLeft: 'auto',
              background: 'rgba(0,255,135,0.12)', padding: '9px 20px',
              opacity: (!msg.trim() || mut.isPending) ? 0.5 : 1,
            }}
          >
            {mut.isPending ? 'Sending...' : '📢 Send to All Players'}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>QUICK TEMPLATES</div>
        {[
          { label: 'Maintenance in 30min', text: '⚠️ Server maintenance in 30 minutes. Save your progress!' },
          { label: 'Tower War starting', text: '🗼 CONTROL TOWER WAR starts in 5 minutes at Notre Dame de Paris! All alliances — prepare your troops!' },
          { label: 'Hormuz event active', text: '🔥 LIVE: The Strait of Hormuz blockade is now active. All Gulf territories are affected. Naval units unlocked.' },
          { label: 'Double XP weekend', text: '⚡ DOUBLE XP WEEKEND — All battles give 2× XP until Sunday midnight UTC. Go conquer!' },
        ].map(t => (
          <div key={t.label} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={() => setMsg(t.text)}>
            <div style={{ fontSize: 12, color: '#00FF87', fontFamily: 'monospace', flexShrink: 0 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Economy Section ──────────────────────────────────────────────────────────

function EconomySection() {
  const [rate, setRate] = useState(0.01)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-economy'],
    queryFn: () => api.get('/gm/economy/').then(r => r.data),
  })

  const actionMut = useMutation({
    mutationFn: (payload: { action: string; rate?: number }) => api.post('/gm/economy/', payload),
    onSuccess: () => { toast.success('Economy updated'); qc.invalidateQueries({ queryKey: ['gm-economy', 'gm-dashboard'] }) },
    onError: () => toast.error('Failed'),
  })

  return (
    <div>
      <div style={S.h2}>ECONOMY CONTROLS</div>

      <div style={{ ...S.grid, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KPI n={`€${data?.tdc_eur_rate ?? 0.01}`}          l="HEX Coin → EUR Rate" color="#FFB800" />
        <KPI n={`${(toNum(data?.total_tdc_supply) / 1000).toFixed(1)}K`} l="Total HEX Coin Supply" color="#7B2FFF" />
        <KPI n={data?.max_withdrawal_daily ?? 500}           l="Max Withdrawal/Day" color="#60A5FA" />
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 14 }}>Circuit Breakers</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => actionMut.mutate({ action: 'disable_withdrawals' })}
            style={S.btnDanger}>🔴 Disable Withdrawals</button>
          <button onClick={() => actionMut.mutate({ action: 'enable_withdrawals' })}
            style={{ ...S.btn('#00FF87'), background: 'rgba(0,255,135,0.08)' }}>🟢 Enable Withdrawals</button>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Status: Withdrawals <span style={{ color: data?.withdrawals_enabled ? '#00FF87' : '#FF3B30', fontWeight: 500 }}>
            {data?.withdrawals_enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 14 }}>Adjust HEX Coin Rate</div>
        <div style={{ ...S.row, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>1 HEX Coin =</span>
          <input type="number" value={rate} onChange={e => setRate(+e.target.value)}
            step={0.001} min={0.001} max={1.0}
            style={{ ...S.input, width: 100 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>EUR</span>
          <button onClick={() => actionMut.mutate({ action: 'set_tdc_rate', rate })}
            style={{ ...S.btn('#FFB800'), background: 'rgba(255,184,0,0.1)' }}>Set Rate</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          Current: 1 HEX Coin = €{data?.tdc_eur_rate ?? 0.01} · Broadcast rate change to players before modifying.
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KPI({ n, l, color }: { n: string | number; l: string; color: string }) {
  return (
    <div style={S.kpi}>
      <div style={{ ...S.kpiN, color }}>{n}</div>
      <div style={S.kpiL}>{l}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'monospace' }}>Loading...</div>
    </div>
  )
}
