/**
 * TradePanel — RISK-style resource trading.
 * Trade HEX Coin, resources, territories with other players or the market.
 * Accessible from the bottom nav as 5th tab.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRightLeft, TrendingUp, Package } from 'lucide-react'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

const RESOURCES = [
  { id: 'tdc',       label: 'HEX Coin Coins',    emoji: '🪙', color: '#cc8800' },
  { id: 'food',      label: 'Food',         emoji: '🌾', color: '#10B981' },
  { id: 'materials', label: 'Materials',    emoji: '⚙️',  color: 'rgba(26,42,58,0.45)' },
  { id: 'energy',    label: 'Energy',       emoji: '⚡', color: '#F59E0B' },
  { id: 'intel',     label: 'Intel',        emoji: '🕵️', color: '#8B5CF6' },
]

// Market rates (simplified — in prod these fluctuate based on supply/demand)
const MARKET_RATES: Record<string, number> = {
  food:      2.5,    // 2.5 HEX Coin per unit
  materials: 5.0,
  energy:    8.0,
  intel:     12.0,
}

function Tabs({ tabs, active, onChange }: { tabs: {id: string; label: string; icon: React.ReactNode}[]; active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,60,100,0.1)', flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer', fontSize: 11,
          background: 'transparent',
          borderBottom: active === t.id ? '2px solid #00FF87' : '2px solid transparent',
          color: active === t.id ? '#00884a' : '#6B7280',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Market Tab ────────────────────────────────────────────────────────────
function MarketTab() {
  const player = usePlayer()
  const [selling, setSelling] = useState('food')
  const [buying, setBuying] = useState('tdc')
  const [amount, setAmount] = useState(10)

  const sellRes = RESOURCES.find(r => r.id === selling)!
  const buyRes  = RESOURCES.find(r => r.id === buying)!

  const rate = selling === 'tdc'
    ? 1 / (MARKET_RATES[buying] ?? 1)
    : MARKET_RATES[selling] ?? 1
  const youGet = buying === 'tdc'
    ? amount * rate
    : amount / (MARKET_RATES[buying] ?? 1)

  const tradeMut = useMutation({
    mutationFn: () => api.post('/tdc/purchase/', {
      sell_resource: selling,
      buy_resource: buying,
      amount,
    }),
    onSuccess: () => toast.success(`Traded ${amount} ${sellRes.emoji} → ${youGet.toFixed(1)} ${buyRes.emoji}`),
    onError: () => toast.error('Trade failed — check your balance'),
  })

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.45)', marginBottom: 14 }}>
        Swap resources at market rates. Prices shift with global events.
      </div>

      <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {/* Selling */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>You give</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {RESOURCES.filter(r => r.id !== buying).map(r => (
              <button key={r.id} onClick={() => setSelling(r.id)} style={{
                padding: '8px 4px', borderRadius: 8, border: `1px solid ${selling === r.id ? r.color : 'rgba(0,60,100,0.1)'}`,
                background: selling === r.id ? `${r.color}15` : 'transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                color: selling === r.id ? r.color : '#9CA3AF', fontSize: 11,
              }}>
                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <ArrowRightLeft size={18} color="#4B5563" />
        </div>

        {/* Buying */}
        <div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>You get</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {RESOURCES.filter(r => r.id !== selling).map(r => (
              <button key={r.id} onClick={() => setBuying(r.id)} style={{
                padding: '8px 4px', borderRadius: 8, border: `1px solid ${buying === r.id ? r.color : 'rgba(0,60,100,0.1)'}`,
                background: buying === r.id ? `${r.color}15` : 'transparent',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                color: buying === r.id ? r.color : '#9CA3AF', fontSize: 11,
              }}>
                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Amount + rate preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)' }}>Amount</span>
          <span style={{ fontSize: 11, color: 'rgba(26,42,58,0.6)', fontFamily: 'monospace' }}>
            Rate: 1 {sellRes.emoji} = {rate.toFixed(2)} {buyRes.emoji}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" value={amount} onChange={e => setAmount(Math.max(1, +e.target.value))} min={1}
            style={{ flex: 1, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#1a2a3a', fontSize: 16, fontFamily: 'monospace', outline: 'none', textAlign: 'center' }} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 14, color: '#00884a', fontWeight: 600 }}>
          {amount} {sellRes.emoji} → {youGet.toFixed(1)} {buyRes.emoji}
        </div>
      </div>

      <button onClick={() => tradeMut.mutate()} disabled={tradeMut.isPending}
        style={{ width: '100%', padding: '13px', background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.4)', borderRadius: 12, color: '#00884a', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        {tradeMut.isPending ? 'Trading…' : '⇄ Execute Trade'}
      </button>
    </div>
  )
}

// ─── Player Trade Tab ──────────────────────────────────────────────────────
function PlayerTradeTab() {
  const [search, setSearch] = useState('')
  const [offer, setOffer] = useState({ resource: 'tdc', amount: 100 })
  const [request, setRequest] = useState({ resource: 'food', amount: 50 })

  const { data: players } = useQuery({
    queryKey: ['player-search', search],
    queryFn: () => search.length > 1
      ? api.get(`/players/search/?q=${encodeURIComponent(search)}`).then(r => r.data?.results ?? r.data ?? [])
      : Promise.resolve([]),
    staleTime: 10000,
  })

  const proposeMut = useMutation({
    mutationFn: (targetId: string) => api.post('/social/propose-trade/', {
      target_player_id: targetId,
      offer_resource: offer.resource,
      offer_amount: offer.amount,
      request_resource: request.resource,
      request_amount: request.amount,
    }),
    onSuccess: () => toast.success('Trade proposal sent!'),
    onError: () => toast.error('Could not send proposal'),
  })

  const offerRes   = RESOURCES.find(r => r.id === offer.resource)!
  const requestRes = RESOURCES.find(r => r.id === request.resource)!

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.45)', marginBottom: 14 }}>
        Propose a direct trade with another player. They can accept or counter.
      </div>

      {/* Trade builder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You offer</div>
          <select value={offer.resource} onChange={e => setOffer(p => ({...p, resource: e.target.value}))}
            style={{ width: '100%', background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 6, padding: '6px', color: '#1a2a3a', fontSize: 12, marginBottom: 8 }}>
            {RESOURCES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
          </select>
          <input type="number" value={offer.amount} onChange={e => setOffer(p => ({...p, amount: +e.target.value}))} min={1}
            style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 6, padding: '6px 8px', color: '#1a2a3a', fontSize: 14, textAlign: 'center', boxSizing: 'border-box' }} />
        </div>
        <ArrowRightLeft size={20} color="#4B5563" />
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You want</div>
          <select value={request.resource} onChange={e => setRequest(p => ({...p, resource: e.target.value}))}
            style={{ width: '100%', background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 6, padding: '6px', color: '#1a2a3a', fontSize: 12, marginBottom: 8 }}>
            {RESOURCES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
          </select>
          <input type="number" value={request.amount} onChange={e => setRequest(p => ({...p, amount: +e.target.value}))} min={1}
            style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 6, padding: '6px 8px', color: '#1a2a3a', fontSize: 14, textAlign: 'center', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Player search */}
      <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Send to player</div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username…"
        style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 8, padding: '9px 12px', color: '#1a2a3a', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />

      {Array.isArray(players) && players.slice(0, 5).map((p: any) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.5)', borderRadius: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,60,100,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(p.avatar_emoji || p.username.slice(0,2).toUpperCase())}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#1a2a3a', fontWeight: 500 }}>{p.display_name || p.username}</div>
            <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)' }}>Rank {p.commander_rank}</div>
          </div>
          <button onClick={() => proposeMut.mutate(p.id)}
            style={{ padding: '6px 12px', background: 'rgba(0,255,135,0.1)', border: '1px solid rgba(0,255,135,0.3)', borderRadius: 8, color: '#00884a', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Propose
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Price Board Tab ────────────────────────────────────────────────────────
function PriceBoard() {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.45)', marginBottom: 14 }}>
        Live market prices. Affected by world events (Hormuz, wars, monsoons).
      </div>
      {RESOURCES.filter(r => r.id !== 'tdc').map(r => {
        const rate = MARKET_RATES[r.id]!
        const change = (Math.random() * 10 - 5)
        const up = change > 0
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.5)', borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{r.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#1a2a3a', fontWeight: 500 }}>{r.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)' }}>per unit</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#cc8800', fontFamily: 'monospace' }}>{rate.toFixed(1)} 🪙</div>
              <div style={{ fontSize: 10, color: up ? '#10B981' : '#EF4444' }}>
                {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
              </div>
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, fontSize: 11, color: '#FCA5A5' }}>
        🔥 Hormuz Crisis: Energy +40% · Intel +25% · Affected region: Gulf
      </div>
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────────────────
export function TradePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('market')
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <GlassPanel title="TRADE" onClose={onClose} accent="#22c55e">
      <Tabs
        tabs={[
          { id: 'market',  label: 'Market',  icon: <TrendingUp size={14} /> },
          { id: 'players', label: 'Players', icon: <ArrowRightLeft size={14} /> },
          { id: 'prices',  label: 'Prices',  icon: <Package size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div>
        {tab === 'market'  && <MarketTab />}
        {tab === 'players' && <PlayerTradeTab />}
        {tab === 'prices'  && <PriceBoard />}
      </div>

      {/* Cross-panel CTAs */}
      <div style={{ marginTop: 16, display:'flex', gap:8 }}>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }}
          style={{
            flex:1, padding:'10px', borderRadius:20,
            background:'rgba(204,136,0,0.06)', border:'1px solid rgba(204,136,0,0.2)',
            color:'#cc8800', fontSize:7, fontWeight:700, letterSpacing:2,
            cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
          }}
        >
          🏪 NFT MARKETPLACE →
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }}
          style={{
            flex:1, padding:'10px', borderRadius:20,
            background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.2)',
            color:'#a855f7', fontSize:7, fontWeight:700, letterSpacing:2,
            cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
          }}
        >
          💎 WALLET →
        </button>
      </div>
    </GlassPanel>
  )
}
