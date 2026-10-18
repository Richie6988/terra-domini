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
import { TokenEditor } from './admin/TokenEditor'

type Tab = 'command' | 'tokens' | 'players' | 'bots' | 'ticker' | 'feedback' | 'economy'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'command',  label: 'COMMAND',  icon: 'target' },
  { id: 'tokens',   label: 'TOKENS',   icon: 'gem' },
  { id: 'players',  label: 'PLAYERS',  icon: 'people' },
  { id: 'bots',     label: 'BOTS',     icon: 'robot' },
  { id: 'ticker',   label: 'TICKER',   icon: 'megaphone' },
  { id: 'feedback', label: 'FEEDBACK', icon: 'clipboard' },
  { id: 'economy',  label: 'ECONOMY',  icon: 'hex_coin' },
]

const s = { fontFamily: 'var(--font-heading)' } as const
const mono = { fontFamily: "'Share Tech Mono', monospace" } as const
const card: React.CSSProperties = {
  background: 'linear-gradient(180deg, #2a55c4 0%, #1f3f98 100%)',
  border: '3px solid #0f2266',
  borderRadius: 18, padding: '16px 18px', boxShadow: '0 5px 0 #0f2266, inset 0 2px 0 rgba(255,255,255,0.15)',
}
const lbl: React.CSSProperties = {
  fontSize: 15, fontWeight: 400, letterSpacing: 0.5, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.4)',
  ...s, marginBottom: 10,
}
const input: React.CSSProperties = {
  width: '100%', minHeight: 42, padding: '10px 14px', borderRadius: 12, border: '3px solid #0f2266',
  background: '#fff', color: '#12245e', fontSize: 14, fontWeight: 600, outline: 'none',
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', textTransform: 'none',
}
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }
const smallBtn: React.CSSProperties = { fontSize: 10, padding: '8px 12px', minHeight: 34 }
const dangerBtn: React.CSSProperties = {
  minHeight: 34, padding: '6px 12px', borderRadius: 12, border: '2px solid #7f1d1d',
  background: 'linear-gradient(180deg, #f87171, #dc2626)', boxShadow: '0 3px 0 #7f1d1d', color: '#fff', fontSize: 13, cursor: 'pointer', ...s, letterSpacing: 0.5,
}

function StatBox({ label, value, color, sub, icon }: { label: string; value: string | number; color: string; sub?: string; icon?: string }) {
  return (
    <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ ...lbl, marginBottom: 0 }}>{label}</div>
        {icon && <IconSVG id={icon} size={26} />}
      </div>
      <div style={{ fontSize: 32, color, ...s, marginTop: 6, lineHeight: 1.1, WebkitTextStroke: '1px rgba(0,0,0,0.35)', textShadow: '0 3px 0 rgba(0,0,0,0.45)' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, fontWeight: 600, color: '#dbe8ff', marginTop: 4, letterSpacing: 0.3, textTransform: 'none', fontFamily: 'system-ui, sans-serif' }}>{sub}</div>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="hx-empty"><IconSVG id="clipboard" size={32} /><div className="hx-empty__title">{text}</div></div>
}

// ═══ COMMAND TAB ═══
function CommandTab() {
  const { data } = useQuery({
    queryKey: ['gm-dashboard'],
    queryFn: () => api.get('/gm/dashboard/').then(r => r.data).catch(() => ({})),
    refetchInterval: 15000,
  })
  const raw = data || {}
  // /gm/dashboard/ returns nested groups (players/territories/battles/economy/events); flat keys kept as fallback
  const st = {
    total_players: raw.players?.total ?? raw.total_players ?? 0,
    online_now: raw.players?.online_now ?? raw.online_now ?? 0,
    active_1h: raw.players?.active_1h ?? raw.active_1h ?? 0,
    new_today: raw.players?.new_today ?? raw.new_today ?? 0,
    claimed_territories: raw.territories?.claimed ?? raw.claimed_territories ?? 0,
    total_territories: raw.territories?.total ?? raw.total_territories ?? 0,
    claim_rate: raw.territories?.claim_rate_pct,
    tdc_in_game: Math.round(raw.economy?.tdc_in_game_total ?? raw.tdc_in_game ?? 0),
    resolved_today: raw.battles?.resolved_today ?? raw.resolved_today ?? 0,
    active_battles: raw.battles?.active ?? raw.active_battles ?? 0,
    active_towers: raw.events?.towers_active ?? raw.active_towers ?? 0,
    upcoming_towers: raw.events?.towers_upcoming ?? raw.upcoming_towers ?? 0,
  }
  // Honest status: derived from the dashboard query itself (it runs DB counts server-side)
  const apiState = data === undefined ? 'pending' : raw.timestamp ? 'ok' : 'error'
  const dot = (c: string) => <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}`, display: 'inline-block' }} />
  const stateColor = apiState === 'ok' ? '#22c55e' : apiState === 'error' ? '#dc2626' : '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="hx-section-title">LIVE SNAPSHOT</div>
      <div style={grid}>
        <StatBox icon="people" label="PLAYERS" value={st.total_players} color="#0CC5FF" sub={`${st.online_now} online now`} />
        <StatBox icon="flag_red" label="TERRITORIES" value={st.claimed_territories} color="#22c55e" sub={`of ${st.total_territories.toLocaleString()}${st.claim_rate != null ? ` · ${st.claim_rate}%` : ''}`} />
        <StatBox icon="hex_coin" label="HEX IN GAME" value={st.tdc_in_game.toLocaleString()} color="#F59E0B" />
        <StatBox icon="swords" label="BATTLES 24H" value={st.resolved_today} color="#ef4444" sub={`${st.active_battles} active`} />
        <StatBox icon="sparkles" label="NEW TODAY" value={st.new_today} color="#8b5cf6" />
        <StatBox icon="lightning" label="ACTIVE 1H" value={st.active_1h} color="#0ea5e9" />
        <StatBox icon="tower" label="TOWER EVENTS" value={st.active_towers + st.upcoming_towers} color="#f97316" sub={`${st.active_towers} active`} />
      </div>
      <div style={card}>
        <div style={lbl}>SERVER STATUS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', fontSize: 12, color: '#e2e8f0', ...s, letterSpacing: 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{dot(stateColor)} API {apiState === 'ok' ? 'OK' : apiState === 'error' ? 'ERROR' : '…'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{dot(stateColor)} DATABASE {apiState === 'ok' ? 'OK' : apiState === 'error' ? 'ERROR' : '…'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(226,232,240,0.5)' }}>{dot('#64748b')} WEBSOCKET · NOT REPORTED</span>
          {raw.timestamp && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(226,232,240,0.45)', ...mono }}>updated {new Date(raw.timestamp).toLocaleTimeString()}</span>}
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
        placeholder="Search username or email..." aria-label="Search players" style={{ ...input, marginBottom: 12, fontSize: 14 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.slice(0, 50).map((p: any) => {
          // /gm/players/ only returns active players and uses rank/tdc/territories keys
          const isActive = p.is_active ?? true
          const rank = p.commander_rank ?? p.rank ?? 1
          const hexCount = p.territories_owned ?? p.territories ?? 0
          const balance = p.tdc_in_game ?? p.tdc ?? 0
          return (
          <div key={p.id} className="hx-rise" style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 52,
            borderRadius: 12, cursor: 'pointer',
            background: selectedId === p.id ? 'linear-gradient(180deg, #3a6ae0, #2a55c4)' : 'linear-gradient(180deg, #2a55c4, #1f3f98)',
            border: `3px solid ${selectedId === p.id ? '#ffd23f' : '#0f2266'}`, boxShadow: '0 4px 0 #0f2266',
          }} onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}>
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: p.avatar_color || '#0099cc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconSVG id={p.avatar_emoji || 'person'} size={16} />
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 17, color: '#fff', ...s, textShadow: '0 2px 0 rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {p.display_name || p.username}
                {p.is_staff && <span className="hx-chip" style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)' }}>· ADMIN</span>}
                {!isActive && <span className="hx-chip" style={{ color: '#f87171', borderColor: 'rgba(220,38,38,0.4)' }}>BANNED</span>}
                {p.email?.endsWith('@bot.hexod.io') && <span className="hx-chip" style={{ color: '#a78bfa', borderColor: 'rgba(139,92,246,0.4)' }}>BOT</span>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dbe8ff', marginTop: 3, fontFamily: 'system-ui, sans-serif', letterSpacing: 0, textTransform: 'none' }}>
                {p.email} · Rank {rank} · {hexCount} hex
              </div>
            </div>
            {/* Balance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 19, color: '#ffd23f', ...s, textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>
              <IconSVG id="hex_coin" size={18} />
              {Math.round(parseFloat(balance || 0)).toLocaleString()}
            </div>

            {/* Actions (expanded) */}
            {selectedId === p.id && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <input type="number" value={hexAmount} onChange={e => setHexAmount(e.target.value)}
                  placeholder="HEX" aria-label="HEX amount" style={{ ...input, width: 96 }} />
                <button className="btn-game btn-game-gold" style={smallBtn}
                  onClick={() => { if (hexAmount) actionMut.mutate({ id: p.id, action: 'grant_tdc', amount: parseInt(hexAmount) }) }}>
                  SEND
                </button>
                <button className={`btn-game ${isActive ? 'btn-game-red' : 'btn-game-green'}`}
                  style={smallBtn}
                  onClick={() => actionMut.mutate({ id: p.id, action: isActive ? 'ban' : 'unban' })}>
                  {isActive ? 'BAN' : 'UNBAN'}
                </button>
              </div>
            )}
          </div>
          )
        })}
      </div>
      {players.length === 0 && <Empty text="NO PLAYERS FOUND" />}
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
      <div style={grid}>
        <StatBox icon="people" label="TOTAL PLAYERS" value={info.total_players || 0} color="#0CC5FF" />
        <StatBox icon="person" label="REAL PLAYERS" value={info.real_players || 0} color="#22c55e" sub={`${realPct}% of total`} />
        <StatBox icon="robot" label="BOT PLAYERS" value={info.bot_players || 0} color="#8b5cf6" />
        <StatBox icon="flag_black" label="BOT TERRITORIES" value={info.bot_territories || 0} color="#F59E0B" />
      </div>

      {/* Recommendation */}
      {(info.recommended_bots || 0) > 0 && (
        <div style={{ ...card, borderColor: '#7a3e00', background: 'linear-gradient(180deg, #ffe066, #fbbf24)', boxShadow: '0 5px 0 #7a3e00' }}>
          <div style={{ fontSize: 15, color: '#5a2d00', ...s, letterSpacing: 0.5, lineHeight: 1.4 }}>
            RECOMMENDATION: Spawn {info.recommended_bots} more bots to simulate active game
          </div>
        </div>
      )}

      {/* Spawn controls */}
      <div style={card}>
        <div style={lbl}>SPAWN BOTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 6, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>COUNT</div>
            <input type="number" value={spawnCount} onChange={e => setSpawnCount(e.target.value)} style={input} />
          </label>
          <label style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 6, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>TERRITORIES EACH</div>
            <input type="number" value={claimCount} onChange={e => setClaimCount(e.target.value)} style={input} />
          </label>
          <button className="btn-game btn-game-green" style={{ fontSize: 11, minHeight: 40 }}
            onClick={() => botMut.mutate({ action: 'spawn', count: parseInt(spawnCount), claim: parseInt(claimCount) })}>
            {botMut.isPending ? '...' : 'SPAWN'}
          </button>
        </div>
      </div>

      {/* Remove all */}
      <button className="btn-game btn-game-red" style={{ width: '100%', fontSize: 14, letterSpacing: 0.5, minHeight: 46 }}
        onClick={() => { if (confirm('Remove ALL bots and free their territories?')) botMut.mutate({ action: 'remove_all' }) }}>
        REMOVE ALL BOTS
      </button>

      {/* Bot list */}
      {info.bots?.length > 0 && (
        <div style={card}>
          <div style={lbl}>BOT ROSTER ({info.bots.length})</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(info.bots || []).map((b: any) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', minHeight: 44,
                borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(15,34,102,0.6)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: b.avatar_color || '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <IconSVG id={b.avatar_emoji || 'robot'} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: '#fff', ...s, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.display_name || b.username}</div>
                <div style={{ fontSize: 13, color: '#dbe8ff', ...s }}>R{b.commander_rank ?? '—'}</div>
                <div style={{ fontSize: 14, color: '#ffd23f', ...s, minWidth: 70, textAlign: 'right' }}>{Math.round(b.tdc_in_game || 0).toLocaleString()}</div>
                <div style={{ fontSize: 14, color: '#86efac', ...s, minWidth: 50, textAlign: 'right' }}>{b.territory_count || 0} hex</div>
                <button aria-label={`Remove bot ${b.username}`} style={{ ...dangerBtn, width: 34, padding: 0, fontSize: 18 }} onClick={() => botMut.mutate({ action: 'remove_one', player_id: b.id })}>×</button>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '6px 12px', minHeight: 32, borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: type === t ? `${TYPE_COLORS[t]}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${type === t ? `${TYPE_COLORS[t]}66` : 'rgba(255,255,255,0.08)'}`,
              color: type === t ? TYPE_COLORS[t] : 'rgba(226,232,240,0.55)',
              ...s, letterSpacing: 1,
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Title (e.g. MAINTENANCE)" style={{ ...input, marginBottom: 8 }} />
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Description (e.g. Server restart at 02:00 UTC)" style={{ ...input, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-game btn-game-blue" style={{ flex: 1, fontSize: 11, minHeight: 42 }}
            onClick={() => tickerMut.mutate({ action: 'create', type, title, text })}>
            BROADCAST
          </button>
          <button className="btn-game btn-game-red" style={{ fontSize: 11, minHeight: 42 }}
            onClick={() => tickerMut.mutate({ action: 'clear_all' })}>
            CLEAR ALL
          </button>
        </div>
      </div>

      {/* Active messages */}
      <div className="hx-section-title">ACTIVE MESSAGES ({(data?.messages || []).length})</div>
      {(data?.messages || []).length === 0 && <Empty text="NO ACTIVE TICKER MESSAGES" />}
      {(data?.messages || []).map((m: any) => (
        <div key={m.id} style={{
          ...card, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            background: `${TYPE_COLORS[m.type] || '#666'}15`,
            color: TYPE_COLORS[m.type] || '#666', ...s, letterSpacing: 1,
          }}>{(m.type || '').toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginTop: 3, textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>{m.text}</div>
          </div>
          <button style={dangerBtn} onClick={() => tickerMut.mutate({ action: 'delete', id: m.id })}>DELETE</button>
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
        <Empty text="NO FEEDBACK YET" />
      )}
      {(data?.feedback || []).map((fb: any) => (
        <div key={fb.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{fb.player__username || 'Anonymous'}</span>
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: `${STATUS_COLOR[fb.status] || '#666'}15`,
              color: STATUS_COLOR[fb.status] || '#666', ...s,
            }}>{(fb.status || '').toUpperCase()}</span>
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(226,232,240,0.6)',
            }}>{fb.category}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.45)', ...mono }}>
              {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ''}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5, textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>{fb.message}</div>
          {fb.admin_reply && (
            <div style={{ fontSize: 12, color: '#0CC5FF', padding: '8px 12px', borderRadius: 6, background: 'rgba(12,197,255,0.04)', border: '1px solid rgba(12,197,255,0.1)', marginBottom: 6 }}>
              ADMIN: {fb.admin_reply}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {replyId === fb.id ? (
              <>
                <input value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Write reply..." style={{ ...input, flex: 1, minWidth: 180 }} />
                <button className="btn-game btn-game-blue" style={smallBtn}
                  onClick={() => fbMut.mutate({ action: 'reply', id: fb.id, reply: replyText })}>SEND</button>
              </>
            ) : (
              <>
                <button className="btn-game btn-game-glass" style={smallBtn}
                  onClick={() => setReplyId(fb.id)}>REPLY</button>
                <button className="btn-game btn-game-green" style={smallBtn}
                  onClick={() => fbMut.mutate({ action: 'resolve', id: fb.id })}>RESOLVE</button>
                <button style={dangerBtn} onClick={() => fbMut.mutate({ action: 'delete', id: fb.id })}>DELETE</button>
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
  const supply = Math.round(eco.tdc_in_game ?? eco.total_tdc_supply ?? 0)
  const onOff = (v: any) => v === undefined ? '—' : v ? 'ON' : 'OFF'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="hx-section-title">ECONOMY CONTROLS</div>
      <div style={grid}>
        <StatBox icon="hex_coin" label="HEX IN CIRCULATION" value={supply.toLocaleString()} color="#F59E0B" />
        <StatBox icon="chart_up" label="HEX / EUR RATE" value={eco.tdc_eur_rate != null ? `€${eco.tdc_eur_rate}` : '—'} color="#0ea5e9" />
        <StatBox icon="money_bag" label="MAX WITHDRAWAL / DAY" value={eco.max_withdrawal_daily != null ? Number(eco.max_withdrawal_daily).toLocaleString() : '—'} color="#8b5cf6" sub="HEX" />
        <StatBox icon="unlock" label="WITHDRAWALS" value={onOff(eco.withdrawals_enabled)} color={eco.withdrawals_enabled === false ? '#ef4444' : '#22c55e'} />
        <StatBox icon="cart" label="PURCHASES" value={onOff(eco.purchases_enabled)} color={eco.purchases_enabled === false ? '#ef4444' : '#22c55e'} />
      </div>
      {/* Transaction log */}
      <div style={card}>
        <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8 }}>
          RECENT TRANSACTIONS
          {!eco.recent_transactions && <span className="hx-chip">NOT PROVIDED BY /gm/economy/</span>}
        </div>
        {(eco.recent_transactions || []).length === 0 && (
          <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.45)', textAlign: 'center', padding: 16 }}>No transactions to show</div>
        )}
        {(eco.recent_transactions || []).slice(0, 20).map((tx: any, i: number) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12,
          }}>
            <span style={{ color: 'rgba(226,232,240,0.7)' }}>{tx.player || '—'}</span>
            <span style={{ color: tx.amount > 0 ? '#22c55e' : '#dc2626', ...mono, fontWeight: 700 }}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>
            <span style={{ color: 'rgba(226,232,240,0.45)', ...mono }}>{tx.type || '—'}</span>
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
      height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
      background: 'linear-gradient(180deg, #4fa6f5 0%, #2f6fe0 35%, #1f4fbf 100%)',
      color: '#fff', padding: '20px 16px 40px', ['--accent' as any]: '#ffd23f', letterSpacing: 0.3,
    }}>
      <div style={{ maxWidth: tab === 'tokens' ? 1400 : 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16,
        padding: '16px 20px', borderRadius: 16,
        background: 'linear-gradient(180deg, #2a55c4, #1f3f98)', border: '3px solid #0f2266',
        boxShadow: '0 6px 0 #0f2266',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffe066, #f59e0b)', border: '3px solid #7a3e00',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 0 #7a3e00',
        }}>
          <IconSVG id="crown" size={24} />
        </div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 400, letterSpacing: 1, ...s, color: '#ffd23f',
            WebkitTextStroke: '1.5px #12245e', textShadow: '0 3px 0 #12245e' }}>
            GOD MODE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 15, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 0 rgba(0,0,0,0.4)', ...s }}>
            HEXOD COMMAND CENTER <span className="hx-chip hx-chip--accent">STAFF · ADMIN</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/" style={{
          padding: '10px 16px', minHeight: 40, display: 'inline-flex', alignItems: 'center',
          textDecoration: 'none', fontSize: 11, ...s, letterSpacing: 1.5, color: '#fff',
        }} className="btn-game btn-game-glass">
          BACK TO GAME
        </a>
      </div>

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="hx-tab" onClick={() => setTab(t.id)}
            style={{ fontSize: 15, minHeight: 44, fontFamily: 'var(--font-heading)', fontWeight: 400, letterSpacing: 0.5 }}>
            <IconSVG id={t.icon} size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'command'  && <CommandTab />}
        {tab === 'tokens'   && <TokenEditor />}
        {tab === 'players'  && <PlayersTab />}
        {tab === 'bots'     && <BotsTab />}
        {tab === 'ticker'   && <TickerTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'economy'  && <EconomyTab />}
      </div>
      </div>
    </div>
  )
}
