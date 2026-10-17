/**
 * TradePanel — RISK-style resource trading.
 * Trade HEX Coin, resources, territories with other players or the market.
 * Accessible from the bottom nav as 5th tab.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRightLeft, TrendingUp, Package, ArrowDownUp, Search, Info } from 'lucide-react'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { useKingdomStore } from '../../store/kingdomStore'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'
import { IconSVG } from '../shared/iconBank'
import { emojiToIcon } from '../shared/emojiIcons'

const ACC = '#22c55e'
/** English labels for kingdom production keys (backend uses French ids) */
const RES_LABEL: Record<string, string> = {
  fer: 'Iron', petrole: 'Oil', nourriture: 'Food', eau: 'Water', donnees: 'Data', influence: 'Influence',
  main_oeuvre: 'Workforce', stabilite: 'Stability', acier: 'Steel', aluminium: 'Aluminium', charbon: 'Coal',
  cobalt: 'Cobalt', composants: 'Components', cristaux: 'Crystals', gaz: 'Gas', lithium: 'Lithium', or: 'Gold',
  silicium: 'Silicon', terres_rares: 'Rare earths', titanium: 'Titanium', uranium: 'Uranium',
}
const avatarIcon = (a?: string) => !a ? null : /^[a-z_0-9]+$/i.test(a) ? a : emojiToIcon(a)


const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

const RESOURCES = [
  { id: 'tdc',       label: 'HEX Coins',    emoji: 'hex_coin', color: '#cc8800' },
  { id: 'food',      label: 'Food',         emoji: 'wheat', color: '#10B981' },
  { id: 'materials', label: 'Materials',    emoji: 'gear',  color: '#94a3b8' },
  { id: 'energy',    label: 'Energy',       emoji: 'lightning', color: '#F59E0B' },
  { id: 'intel',     label: 'Intel',        emoji: 'spy', color: '#8B5CF6' },
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
    <div className="hx-tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" className="hx-tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  )
}

function ResChip({ r, on, onClick }: { r: typeof RESOURCES[number]; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{
      padding: '8px 10px', borderRadius: 12, cursor: 'pointer', minHeight: 44,
      border: `3px solid ${on ? r.color : 'rgba(255,255,255,0.1)'}`,
      background: on ? `linear-gradient(180deg, ${r.color}30, ${r.color}0c)` : 'rgba(255,255,255,0.03)',
      boxShadow: on ? '0 4px 0 rgba(0,0,0,0.35)' : 'none',
      display: 'flex', alignItems: 'center', gap: 8, color: on ? '#fff' : 'rgba(226,232,240,0.7)',
      fontSize: 11, fontWeight: 700, letterSpacing:0.5, transition: 'all .15s',
    }}>
      <IconSVG id={r.emoji} size={24} />{r.label}
    </button>
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
    mutationFn: () => api.post('/shop/purchase/', {
      sell_resource: selling,
      buy_resource: buying,
      amount,
    }),
    onSuccess: () => toast.success(`Traded ${amount} ${sellRes.label} → ${youGet.toFixed(1)} ${buyRes.label}`),
    onError: () => toast.error('Trade failed — check your balance'),
  })

  const sideCard: React.CSSProperties = { padding: 14 }
  const sideLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing:0.5, color: 'rgba(226,232,240,0.55)', marginBottom: 10 }
  return (
    <div>
      <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginBottom: 12, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
        Swap resources at indicative market rates.
      </div>

      {/* YOU GIVE */}
      <div className="hx-card" style={sideCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sideLabel}>YOU GIVE</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <IconSVG id={sellRes.emoji} size={40} />
          <input type="number" value={amount} onChange={e => setAmount(Math.max(1, +e.target.value))} min={1} className="hx-input" aria-label="Amount to give"
            style={{ flex: 1, fontSize: 22, fontWeight: 700 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 6 }}>
          {RESOURCES.filter(r => r.id !== buying).map(r => (
            <ResChip key={r.id} r={r} on={selling === r.id} onClick={() => setSelling(r.id)} />
          ))}
        </div>
      </div>

      {/* Swap direction */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0', position: 'relative', zIndex: 1 }}>
        <button className="hx-icon-btn" aria-label="Swap give and get" onClick={() => { setSelling(buying); setBuying(selling) }}
          style={{ borderRadius: '50%', background: '#0d1b2a', border: `3px solid ${ACC}88`, color: ACC, boxShadow: `0 4px 0 rgba(0,0,0,0.35)` }}>
          <ArrowDownUp size={18} />
        </button>
      </div>

      {/* YOU GET */}
      <div className="hx-card hx-card--accent" style={sideCard}>
        <div style={sideLabel}>YOU GET</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <IconSVG id={buyRes.emoji} size={40} />
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: "'Share Tech Mono', monospace", textShadow:'0 2px 0 rgba(0,0,0,0.45)' }}>
            {youGet.toFixed(1)} <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>{buyRes.label}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 6 }}>
          {RESOURCES.filter(r => r.id !== selling).map(r => (
            <ResChip key={r.id} r={r} on={buying === r.id} onClick={() => setBuying(r.id)} />
          ))}
        </div>
      </div>

      {/* Rate */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '12px 2px', fontSize: 11, color: 'rgba(226,232,240,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>
        <span>INDICATIVE RATE</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          1 <IconSVG id={sellRes.emoji} size={16} /> = {rate.toFixed(2)} <IconSVG id={buyRes.emoji} size={16} />
        </span>
      </div>

      {/* Market swaps have no backend endpoint yet — honest disabled state (RULE 1) */}
      <button onClick={() => tradeMut.mutate()} disabled aria-disabled="true" className="btn-game btn-game-green"
        style={{ width: '100%', minHeight: 46, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <ArrowRightLeft size={16} /> EXECUTE TRADE <span className="hx-chip" style={{ color: '#fff' }}>SOON</span>
      </button>
      <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)', textAlign: 'center', marginTop: 8, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
        Market swaps are not live yet — propose a direct trade in the Players tab.
      </div>
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
    mutationFn: (targetId: string) => api.post('/trade/propose-trade/', {
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
    <div>
      <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginBottom: 14, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
        Propose a direct trade with another player. They can accept or counter.
      </div>

      {/* Trade builder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <div className="hx-card" style={{ padding: 12, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(226,232,240,0.55)', marginBottom: 8, letterSpacing:0.5 }}>YOU OFFER</div>
          <select value={offer.resource} onChange={e => setOffer(p => ({...p, resource: e.target.value}))}
            className="hx-input" style={{ fontSize: 12, marginBottom: 8, colorScheme: 'dark', padding: '8px 10px' }}>
            {RESOURCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input type="number" value={offer.amount} onChange={e => setOffer(p => ({...p, amount: +e.target.value}))} min={1}
            className="hx-input" style={{ fontSize: 16, textAlign: 'center' }} />
        </div>
        <ArrowRightLeft size={20} color={ACC} />
        <div className="hx-card" style={{ padding: 12, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(226,232,240,0.55)', marginBottom: 8, letterSpacing:0.5 }}>YOU WANT</div>
          <select value={request.resource} onChange={e => setRequest(p => ({...p, resource: e.target.value}))}
            className="hx-input" style={{ fontSize: 12, marginBottom: 8, colorScheme: 'dark', padding: '8px 10px' }}>
            {RESOURCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <input type="number" value={request.amount} onChange={e => setRequest(p => ({...p, amount: +e.target.value}))} min={1}
            className="hx-input" style={{ fontSize: 16, textAlign: 'center' }} />
        </div>
      </div>

      {/* Player search */}
      <div className="hx-section-title">SEND TO PLAYER</div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(226,232,240,0.5)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username…" className="hx-input" aria-label="Search player" style={{ paddingLeft: 36 }} />
      </div>

      {Array.isArray(players) && players.slice(0, 5).map((p: any) => (
        <div key={p.id} className="hx-card hx-rise" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 900, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {avatarIcon(p.avatar_emoji) ? <IconSVG id={avatarIcon(p.avatar_emoji)!} size={30} /> : ((p.username || "").slice(0, 2)).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{p.display_name || p.username}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>RANK {p.commander_rank}</div>
          </div>
          <button onClick={() => proposeMut.mutate(p.id)}
            className="btn-game btn-game-green" style={{ fontSize: 11, padding: '8px 14px' }}>
            PROPOSE
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Price Board Tab ────────────────────────────────────────────────────────
function PriceBoard() {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', marginBottom: 14, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
        Reference value of each resource in HEX Coin.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {RESOURCES.filter(r => r.id !== 'tdc').map((r, i) => {
        const rate = MARKET_RATES[r.id]!
        return (
          <div key={r.id} className="hx-card hx-rise" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', animationDelay: `${i * 40}ms` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${r.color}1c`, border: `2px solid ${r.color}44`, flexShrink: 0 }}>
              <IconSVG id={r.emoji} size={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700, letterSpacing:0.5 }}>{r.label.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>PER UNIT</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 18, fontWeight: 700, color: '#fde68a', fontFamily: "'Share Tech Mono', monospace" }}>
              <IconSVG id="hex_coin" size={18} />{rate.toFixed(1)}
            </div>
          </div>
        )
      })}
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(226,232,240,0.6)', display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
        <Info size={14} style={{ flexShrink: 0 }} /> Rates are indicative and will shift with active world events.
      </div>
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────────────────
export function TradePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('market')
  const setActivePanel = useStore(s => s.setActivePanel)
  const activeKingdom = useKingdomStore(s => s.getActiveKingdom())

  return (
    <GlassPanel title="TRADE" onClose={onClose} accent={ACC} icon={<IconSVG id="ui_trade" size={24} />} subtitle="Swap resources with the market or players">
      {/* Kingdom resources summary */}
      {activeKingdom && Object.keys(activeKingdom.dailyProduction || {}).length > 0 && (
        <div className="hx-card" style={{ marginBottom:12, padding:'10px 12px' }}>
          <div className="hx-section-title" style={{ marginTop:0 }}>YOUR KINGDOM PRODUCES (DAILY)</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {Object.entries(activeKingdom.dailyProduction)
              .filter(([,v]) => (v as number) > 0)
              .slice(0, 8)
              .map(([res, amount]) => (
              <span key={res} className="hx-chip" style={{ fontSize: 11, padding:'3px 10px 3px 4px', color:'#e2e8f0' }}>
                <IconSVG id={`res_${res}`} size={20} />
                {RES_LABEL[res] || res.replace(/_/g, ' ')}
                <span style={{ fontFamily:"'Share Tech Mono', monospace", color:'#86efac' }}>+{(amount as number).toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

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
        {tab === 'market'&& <MarketTab />}
        {tab === 'players' && <PlayerTradeTab />}
        {tab === 'prices'&& <PriceBoard />}
      </div>

      {/* Cross-panel CTAs */}
      <div style={{ marginTop: 16, display:'flex', gap:8 }}>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }} className="btn-game btn-game-glass"
          style={{ flex:1, minHeight:42, fontSize: 11, color:'#fcd34d', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <IconSVG id="auction_gavel" size={18} /> NFT MARKET
        </button>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }} className="btn-game btn-game-glass"
          style={{ flex:1, minHeight:42, fontSize: 11, color:'#d8b4fe', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <IconSVG id="ui_wallet" size={18} /> WALLET
        </button>
      </div>
    </GlassPanel>
  )
}
