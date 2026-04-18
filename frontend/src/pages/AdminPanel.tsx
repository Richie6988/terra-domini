/**
 * AdminPanel — GOD MODE Command Center.
 * Full game control: players, bots, economy, ticker, feedback.
 * Only accessible to is_staff users.
 */
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IconSVG } from '../components/shared/iconBank'
import { api } from '../services/api'
import toast from 'react-hot-toast'

type Tab = 'command' | 'players' | 'bots' | 'ticker' | 'feedback' | 'economy'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'command',  label: 'COMMAND',  icon: 'target' },
  { id: 'players',  label: 'PLAYERS',  icon: 'people' },
  { id: 'bots',     label: 'BOTS',     icon: 'robot' },
  { id: 'ticker',   label: 'TICKER',   icon: 'megaphone' },
  { id: 'feedback', label: 'FEEDBACK', icon: 'clipboard' },
  { id: 'economy',  label: 'ECONOMY',  icon: 'hex_coin' },
]

const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const
const mono = { fontFamily: "'Share Tech Mono', monospace" } as const
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14, padding: '14px 16px',
}
const lbl: React.CSSProperties = {
  fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.35)',
  ...s, marginBottom: 6,
}
const input: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(12,197,255,0.15)',
  background: 'rgba(12,197,255,0.04)', color: '#e2e8f0', fontSize: 12, outline: 'none',
  ...mono, boxSizing: 'border-box',
}

function StatBox({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={card}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ═══ COMMAND TAB ═══
function CommandTab() {
  const { data } = useQuery({
    queryKey: ['gm-dashboard'],
    queryFn: () => api.get('/gm/dashboard/').then(r => r.data).catch(() => ({})),
    refetchInterval: 15000,
  })
  const st = data || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatBox label="PLAYERS" value={st.total_players || 0} color="#0CC5FF" sub={`${st.online_now || 0} online`} />
        <StatBox label="TERRITORIES" value={st.claimed_territories || 0} color="#22c55e" sub={`${st.total_territories || 0} total`} />
        <StatBox label="HEX IN GAME" value={(st.tdc_in_game || 0).toLocaleString()} color="#F59E0B" />
        <StatBox label="BATTLES 24H" value={st.resolved_today || 0} color="#dc2626" sub={`${st.active_battles || 0} active`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatBox label="NEW TODAY" value={st.new_today || 0} color="#8b5cf6" />
        <StatBox label="ACTIVE 1H" value={st.active_1h || 0} color="#0ea5e9" />
        <StatBox label="EVENTS" value={(st.active_towers || 0) + (st.upcoming_towers || 0)} color="#f97316" sub={`${st.active_towers || 0} active`} />
      </div>
      <div style={card}>
        <div style={lbl}>SERVER STATUS</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#e2e8f0' }}>
          <span><span style={{ color: '#22c55e' }}>●</span> API OK</span>
          <span><span style={{ color: '#22c55e' }}>●</span> DB OK</span>
          <span><span style={{ color: st.ws_connected ? '#22c55e' : '#dc2626' }}>●</span> WebSocket</span>
        </div>
      </div>
    </div>
  )
}

// ═══ PLAYERS TAB ═══
function PlayersTab() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hexAmount, setHexAmount] = useState('')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-players', search],
    queryFn: () => api.get(`/gm/players/?search=${search}`).then(r => r.data).catch(() => ({ players: [] })),
  })
  const players = data?.players || []

  const actionMut = useMutation({
    mutationFn: ({ id, action, amount }: { id: string; action: string; amount?: number }) =>
      api.post(`/gm/players/${id}/action/`, { action, amount }),
    onSuccess: (_, v) => {
      toast.success(`${v.action} done`)
      qc.invalidateQueries({ queryKey: ['gm-players'] })
      setSelectedId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
  })

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search username or email..." style={{ ...input, marginBottom: 12 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.slice(0, 50).map((p: any) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
            borderRadius: 10, cursor: 'pointer',
            background: selectedId === p.id ? 'rgba(12,197,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${selectedId === p.id ? 'rgba(12,197,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }} onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: p.avatar_color || '#0099cc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconSVG id={p.avatar_emoji || 'person'} size={16} />
            </div>
            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>
                {p.display_name || p.username}
                {p.is_staff && <span style={{ color: '#F59E0B', marginLeft: 4 }}>★ ADMIN</span>}
                {!p.is_active && <span style={{ color: '#dc2626', marginLeft: 4 }}>BANNED</span>}
                {p.email?.endsWith('@bot.hexod.io') && <span style={{ color: '#8b5cf6', marginLeft: 4 }}>BOT</span>}
              </div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', ...mono }}>
                {p.email} · Rank {p.commander_rank || 1} · {p.territories_owned || 0} hex
              </div>
            </div>
            {/* Balance */}
            <div style={{ fontSize: 12, fontWeight: 900, color: '#F59E0B', ...mono }}>
              {Math.round(parseFloat(p.tdc_in_game || 0)).toLocaleString()}
            </div>

            {/* Actions (expanded) */}
            {selectedId === p.id && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <input type="number" value={hexAmount} onChange={e => setHexAmount(e.target.value)}
                  placeholder="HEX" style={{ ...input, width: 70, padding: '4px 8px', fontSize: 10 }} />
                <button className="btn-game btn-game-gold" style={{ fontSize: 7, padding: '4px 8px' }}
                  onClick={() => { if (hexAmount) actionMut.mutate({ id: p.id, action: 'grant_tdc', amount: parseInt(hexAmount) }) }}>
                  SEND
                </button>
                <button className={`btn-game ${p.is_active ? 'btn-game-red' : 'btn-game-green'}`}
                  style={{ fontSize: 7, padding: '4px 8px' }}
                  onClick={() => actionMut.mutate({ id: p.id, action: p.is_active ? 'ban' : 'unban' })}>
                  {p.is_active ? 'BAN' : 'UNBAN'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {players.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>No players found</div>}
    </div>
  )
}

// ═══ BOTS TAB ═══
function BotsTab() {
  const [spawnCount, setSpawnCount] = useState('10')
  const [claimCount, setClaimCount] = useState('5')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-bots'],
    queryFn: () => api.get('/gm/bots/').then(r => r.data).catch(() => ({})),
  })
  const info = data || {}

  const botMut = useMutation({
    mutationFn: (body: any) => api.post('/gm/bots/', body),
    onSuccess: (r) => {
      toast.success(r.data?.output || 'Done')
      qc.invalidateQueries({ queryKey: ['gm-bots'] })
      qc.invalidateQueries({ queryKey: ['gm-dashboard'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
  })

  const realPct = info.total_players ? Math.round((info.real_players / info.total_players) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Population overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatBox label="TOTAL PLAYERS" value={info.total_players || 0} color="#0CC5FF" />
        <StatBox label="REAL PLAYERS" value={info.real_players || 0} color="#22c55e" sub={`${realPct}%`} />
        <StatBox label="BOT PLAYERS" value={info.bot_players || 0} color="#8b5cf6" />
        <StatBox label="BOT TERRITORIES" value={info.bot_territories || 0} color="#F59E0B" />
      </div>

      {/* Recommendation */}
      {(info.recommended_bots || 0) > 0 && (
        <div style={{ ...card, borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <div style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700, ...s, letterSpacing: 1 }}>
            RECOMMENDATION: Spawn {info.recommended_bots} more bots to simulate active game
          </div>
        </div>
      )}

      {/* Spawn controls */}
      <div style={card}>
        <div style={lbl}>SPAWN BOTS</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Count</div>
            <input type="number" value={spawnCount} onChange={e => setSpawnCount(e.target.value)}
              style={{ ...input, padding: '8px 10px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Territories each</div>
            <input type="number" value={claimCount} onChange={e => setClaimCount(e.target.value)}
              style={{ ...input, padding: '8px 10px' }} />
          </div>
          <button className="btn-game btn-game-green" style={{ fontSize: 9, marginTop: 12 }}
            onClick={() => botMut.mutate({ action: 'spawn', count: parseInt(spawnCount), claim: parseInt(claimCount) })}>
            {botMut.isPending ? '...' : 'SPAWN'}
          </button>
        </div>
      </div>

      {/* Remove all */}
      <button className="btn-game btn-game-red" style={{ width: '100%', fontSize: 9, letterSpacing: 2 }}
        onClick={() => { if (confirm('Remove ALL bots and free their territories?')) botMut.mutate({ action: 'remove_all' }) }}>
        REMOVE ALL BOTS
      </button>

      {/* Bot list */}
      {info.bots?.length > 0 && (
        <div style={card}>
          <div style={lbl}>BOT ROSTER ({info.bots.length})</div>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(info.bots || []).map((b: any) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                borderRadius: 6, background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: b.avatar_color || '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <IconSVG id={b.avatar_emoji || 'robot'} size={12} />
                </div>
                <div style={{ flex: 1, fontSize: 9, color: '#e2e8f0', fontWeight: 600 }}>{b.display_name || b.username}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', ...mono }}>{b.territory_count || 0} hex</div>
                <button style={{
                  padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(220,38,38,0.2)',
                  background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: 7, cursor: 'pointer',
                }} onClick={() => botMut.mutate({ action: 'remove_one', player_id: b.id })}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ TICKER TAB ═══
function TickerTab() {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [type, setType] = useState('maintenance')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-ticker'],
    queryFn: () => api.get('/gm/ticker/').then(r => r.data).catch(() => ({ messages: [] })),
  })

  const tickerMut = useMutation({
    mutationFn: (body: any) => api.post('/gm/ticker/', body),
    onSuccess: () => {
      toast.success('Ticker updated')
      qc.invalidateQueries({ queryKey: ['gm-ticker'] })
      setTitle(''); setText('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
  })

  const TYPES = ['update', 'event', 'season', 'maintenance', 'community', 'alert', 'promo']
  const TYPE_COLORS: Record<string, string> = {
    update: '#0CC5FF', event: '#f97316', season: '#8b5cf6', maintenance: '#F59E0B',
    community: '#22c55e', alert: '#dc2626', promo: '#ec4899',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Create message */}
      <div style={card}>
        <div style={lbl}>NEW TICKER MESSAGE</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 7, fontWeight: 700,
              background: type === t ? `${TYPE_COLORS[t]}15` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${type === t ? `${TYPE_COLORS[t]}30` : 'rgba(255,255,255,0.05)'}`,
              color: type === t ? TYPE_COLORS[t] : 'rgba(255,255,255,0.3)',
              ...s, letterSpacing: 1,
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Title (e.g. MAINTENANCE)" style={{ ...input, marginBottom: 6 }} />
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Description (e.g. Server restart at 02:00 UTC)" style={{ ...input, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-game btn-game-blue" style={{ flex: 1, fontSize: 9 }}
            onClick={() => tickerMut.mutate({ action: 'create', type, title, text })}>
            BROADCAST
          </button>
          <button className="btn-game btn-game-red" style={{ fontSize: 9 }}
            onClick={() => tickerMut.mutate({ action: 'clear_all' })}>
            CLEAR ALL
          </button>
        </div>
      </div>

      {/* Active messages */}
      <div style={lbl}>ACTIVE MESSAGES ({(data?.messages || []).length})</div>
      {(data?.messages || []).map((m: any) => (
        <div key={m.id} style={{
          ...card, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 7, fontWeight: 700,
            background: `${TYPE_COLORS[m.type] || '#666'}15`,
            color: TYPE_COLORS[m.type] || '#666', ...s, letterSpacing: 1,
          }}>{(m.type || '').toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{m.title}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{m.text}</div>
          </div>
          <button style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(220,38,38,0.2)',
            background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: 8, cursor: 'pointer',
          }} onClick={() => tickerMut.mutate({ action: 'delete', id: m.id })}>DELETE</button>
        </div>
      ))}
    </div>
  )
}

// ═══ FEEDBACK TAB ═══
function FeedbackTab() {
  const [replyText, setReplyText] = useState('')
  const [replyId, setReplyId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['gm-feedback'],
    queryFn: () => api.get('/gm/feedback/').then(r => r.data).catch(() => ({ feedback: [] })),
  })

  const fbMut = useMutation({
    mutationFn: (body: any) => api.post('/gm/feedback/', body),
    onSuccess: () => {
      toast.success('Done')
      qc.invalidateQueries({ queryKey: ['gm-feedback'] })
      setReplyId(null); setReplyText('')
    },
  })

  const STATUS_COLOR: Record<string, string> = {
    pending: '#F59E0B', replied: '#0CC5FF', resolved: '#22c55e', rejected: '#dc2626',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(data?.feedback || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 10, ...s }}>NO FEEDBACK YET</div>
      )}
      {(data?.feedback || []).map((fb: any) => (
        <div key={fb.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{fb.player__username || 'Anonymous'}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 4, fontSize: 6, fontWeight: 700,
              background: `${STATUS_COLOR[fb.status] || '#666'}15`,
              color: STATUS_COLOR[fb.status] || '#666', ...s,
            }}>{(fb.status || '').toUpperCase()}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 4, fontSize: 6,
              background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)',
            }}>{fb.category}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', ...mono }}>
              {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ''}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 6, lineHeight: 1.5 }}>{fb.message}</div>
          {fb.admin_reply && (
            <div style={{ fontSize: 9, color: '#0CC5FF', padding: '6px 10px', borderRadius: 6, background: 'rgba(12,197,255,0.04)', border: '1px solid rgba(12,197,255,0.1)', marginBottom: 6 }}>
              ADMIN: {fb.admin_reply}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {replyId === fb.id ? (
              <>
                <input value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Write reply..." style={{ ...input, flex: 1, padding: '4px 8px', fontSize: 9 }} />
                <button className="btn-game btn-game-blue" style={{ fontSize: 7, padding: '4px 8px' }}
                  onClick={() => fbMut.mutate({ action: 'reply', id: fb.id, reply: replyText })}>SEND</button>
              </>
            ) : (
              <>
                <button className="btn-game btn-game-glass" style={{ fontSize: 7, padding: '4px 8px' }}
                  onClick={() => setReplyId(fb.id)}>REPLY</button>
                <button className="btn-game btn-game-green" style={{ fontSize: 7, padding: '4px 8px' }}
                  onClick={() => fbMut.mutate({ action: 'resolve', id: fb.id })}>RESOLVE</button>
                <button style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)',
                  background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: 7, cursor: 'pointer',
                }} onClick={() => fbMut.mutate({ action: 'delete', id: fb.id })}>DELETE</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══ ECONOMY TAB ═══
function EconomyTab() {
  const { data } = useQuery({
    queryKey: ['gm-economy'],
    queryFn: () => api.get('/gm/economy/').then(r => r.data).catch(() => ({})),
  })
  const eco = data || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatBox label="HEX IN CIRCULATION" value={(eco.tdc_in_game || 0).toLocaleString()} color="#F59E0B" />
        <StatBox label="HEX STAKED" value={(eco.tdc_staked || 0).toLocaleString()} color="#8b5cf6" />
        <StatBox label="PURCHASES TODAY" value={eco.purchases_count || 0} color="#22c55e" sub={`${(eco.purchases_total || 0).toLocaleString()} HEX`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatBox label="SHOP REVENUE" value={(eco.shop_revenue || 0).toLocaleString()} color="#0ea5e9" />
        <StatBox label="BURN RATE" value={`${eco.burn_rate || 0}/d`} color="#dc2626" />
        <StatBox label="INFLATION" value={`${eco.inflation_pct || 0}%`} color={eco.inflation_pct > 5 ? '#dc2626' : '#22c55e'} />
      </div>
      {/* Transaction log */}
      <div style={card}>
        <div style={lbl}>RECENT TRANSACTIONS</div>
        {(eco.recent_transactions || []).length === 0 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 16 }}>No transactions yet</div>
        )}
        {(eco.recent_transactions || []).slice(0, 20).map((tx: any, i: number) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 9,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{tx.player || '—'}</span>
            <span style={{ color: tx.amount > 0 ? '#22c55e' : '#dc2626', ...mono, fontWeight: 700 }}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', ...mono }}>{tx.type || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══ MAIN ADMIN PANEL ═══
export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('command')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #060e1a 0%, #0a1628 50%, #060e1a 100%)',
      color: '#e2e8f0', padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        padding: '16px 20px', borderRadius: 16,
        background: 'rgba(13,27,42,0.8)', border: '2px solid rgba(12,197,255,0.15)',
        boxShadow: '0 0 30px rgba(12,197,255,0.05)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0CC5FF, #0077aa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 15px rgba(12,197,255,0.3)',
        }}>
          <IconSVG id="crown" size={24} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 5, ...s, color: '#0CC5FF',
            textShadow: '0 0 20px rgba(12,197,255,0.4)' }}>
            GOD MODE
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, ...s }}>
            HEXOD COMMAND CENTER
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/" style={{
          padding: '8px 16px', borderRadius: 10, textDecoration: 'none',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)', fontSize: 8, ...s, letterSpacing: 1,
        }}>
          BACK TO GAME
        </a>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        padding: '4px', borderRadius: 14,
        background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
            border: 'none',
            background: tab === t.id ? 'rgba(12,197,255,0.08)' : 'transparent',
            color: tab === t.id ? '#0CC5FF' : 'rgba(255,255,255,0.35)',
            fontSize: 8, fontWeight: 700, letterSpacing: 1, ...s,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <IconSVG id={t.icon} size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {tab === 'command'  && <CommandTab />}
        {tab === 'players'  && <PlayersTab />}
        {tab === 'bots'     && <BotsTab />}
        {tab === 'ticker'   && <TickerTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'economy'  && <EconomyTab />}
      </div>
    </div>
  )
}
