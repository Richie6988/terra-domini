/**
 * CryptoPanel — Section crypto complète :
 * Wallet HEX, prix live, newsfeed, convert HEX↔HEX Coin, withdraw
 */
import { HEX_PER_COIN } from '../../services/balance'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { Token3DViewer } from '../shared/Token3DViewer'
import { BurnTracker } from './BurnTracker'
import { useTokenStats } from '../../hooks/useBlockchain'
import toast from 'react-hot-toast'
import { Hourglass, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, Gem } from 'lucide-react'

const toF = (v: unknown, d = 2) => parseFloat(String(v ?? 0)).toFixed(d)

function PriceTicker({ prices }: { prices: Record<string, any> }) {
  if (!prices || !Object.keys(prices).length) return null
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
      {Object.entries(prices).map(([sym, p]) => {
        const up = (p.change_24h ?? 0) > 0
        return (
          <div key={sym} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 14px', border: `2px solid ${sym === 'HEX' ? 'rgba(0,136,74,0.25)' : 'rgba(255,255,255,0.08)'}`, minWidth: 90 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing:0.5 }}>{sym}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sym === 'HEX' ? '#00884a' : '#fff', fontFamily: 'monospace', marginTop: 2 }}>
              ${p.price_usd < 0.01 ? parseFloat(p.price_usd).toFixed(6) : parseFloat(p.price_usd).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: up ? '#10B981' : '#EF4444', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
              {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(p.change_24h ?? 0).toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WalletCard({ wallet, onConvert, onWithdraw, onCashOut }: any) {
  const inGame = parseFloat(String(wallet?.tdc_in_game ?? 0)) || 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      {/* Primary — in-game currency */}
      <div className="hx-card hx-card--accent" style={{ ['--accent' as any]: '#fbbf24', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconSVG id="hex_coin" size={48} />
        <div className="hx-stat" style={{ flex: 1 }}>
          <span className="hx-stat__label" style={{ color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,0.45)' }}>IN-GAME BALANCE · HEX COIN</span>
          <span className="hx-stat__value" style={{ fontSize: 28, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>{wallet ? Math.floor(inGame).toLocaleString() : '—'}</span>
          <span style={{ fontSize: 11, color: '#3b2a00', textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 800, letterSpacing: 0 }}>Spend in the Shop, Marketplace and Auctions</span>
        </div>
      </div>

      {/* Secondary — on-chain token */}
      <div className="hx-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div className="hx-stat">
            <span className="hx-stat__label">CRYPTO WALLET · POLYGON HEX</span>
            <span className="hx-stat__value" style={{ fontSize: 22, color: '#d8b4fe' }}>
              {toF(wallet?.tdi_balance, 4)} <span style={{ fontSize: 12, color: 'var(--hx-text-3)' }}>HEX</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--hx-text-3)', fontFamily: "'Share Tech Mono', monospace" }}>
              ≈ ${toF(wallet?.tdi_usd_value, 2)} USD{wallet?.tdi_price_usd ? ` · 1 HEX = $${toF(wallet.tdi_price_usd, 4)}` : ''}
            </span>
          </div>
          <span className="hx-chip" style={{ color: wallet?.kyc_verified ? '#4ade80' : '#fbbf24', borderColor: wallet?.kyc_verified ? 'rgba(74,222,128,0.4)' : 'rgba(251,191,36,0.4)' }}>
            {wallet?.kyc_verified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
            {wallet?.kyc_verified ? 'KYC VERIFIED' : 'KYC REQUIRED TO WITHDRAW'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <button onClick={onConvert} className="btn-game btn-game-purple" style={{ fontSize: 11, minHeight: 42 }}>CONVERT → HEX COIN</button>
          <button onClick={onWithdraw} className="btn-game btn-game-glass" style={{ fontSize: 11, minHeight: 42 }}>WITHDRAW</button>
          <button onClick={onCashOut} className="btn-game btn-game-gold" style={{ fontSize: 11, minHeight: 42, gridColumn: '1 / -1' }}>CASH OUT EARNED HEX COIN → HEX TOKEN</button>
        </div>
        {wallet?.tdi_pending > 0 && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 11, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hourglass size={13} /> {toF(wallet.tdi_pending, 4)} HEX pending withdrawal
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, textAlign: 'center', textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
          Cash out turns HEX Coin you earned by playing into HEX tokens (5% burned, min 1,000). Purchased HEX Coin stays in-game. Withdraw tokens to a Polygon wallet after KYC.
        </div>
      </div>
    </div>
  )
}

function ConvertModal({ wallet, onClose }: { wallet: any; onClose: () => void }) {
  const [amount, setAmount] = useState('10')
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => api.post('/wallet/convert/', { amount_tdi: parseFloat(amount) }),
    onSuccess: (r) => { toast.success(`Converted → ${r.data.tdc_earned?.toFixed(1)} HEX Coin`); qc.invalidateQueries({ queryKey: ['wallet'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const rate = wallet?.tdi_price_usd ? (wallet.tdi_price_usd / 0.001) : 4.2
  const preview = (parseFloat(amount) || 0) * rate

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,15,0.75)', backdropFilter: 'blur(6px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, #0d1b2a, #060e1a)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 420, border: '3px solid rgba(168,85,247,0.45)', boxShadow: '0 -10px 40px rgba(168,85,247,0.2)', ['--accent' as any]: '#a855f7' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#d8b4fe', marginBottom: 6, letterSpacing:0.5 }}>CONVERT HEX → HEX COIN</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 14, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>Rate: 1 HEX ≈ {rate.toFixed(1)} HEX Coin · Available: {toF(wallet?.tdi_balance, 4)} HEX</div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="hx-input" aria-label="Amount of HEX to convert"
          style={{ fontSize: 18, marginBottom: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fde68a', fontSize: 18, fontWeight: 700, marginBottom: 16, fontFamily: "'Share Tech Mono', monospace" }}>→ <IconSVG id="hex_coin" size={18} /> {preview.toFixed(1)} HEX Coin</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onClose} className="btn-game btn-game-glass" style={{ minHeight: 42 }}>CANCEL</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-game btn-game-purple" style={{ minHeight: 42 }}>
            {mut.isPending ? 'CONVERTING…' : 'CONVERT'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CashOutModal({ wallet, onClose }: { wallet: any; onClose: () => void }) {
  const [amount, setAmount] = useState('1000')
  const qc = useQueryClient()
  const { data: loop } = useQuery<any>({ queryKey: ['loop-status'], queryFn: () => api.get('/loop/status/').then(r => r.data) })
  const mut = useMutation({
    mutationFn: () => api.post('/wallet/cash-out/', { amount_hex: parseFloat(amount) }),
    onSuccess: (r) => {
      toast.success(`+${r.data.tdi_received?.toFixed(2)} HEX token (${r.data.hex_burned} HEX burned)`)
      ;['wallet', 'loop-status', 'wallet-tx', 'player', 'wallet-me'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Cash-out failed'),
  })
  const amt = parseFloat(amount) || 0
  const earned = Math.floor(loop?.earned_balance ?? 0)
  const tokens = (amt * 0.95) / HEX_PER_COIN   // fixed peg: 1000 HEX = 1 HEX Coin = 1 €
  const problem = !loop ? '' : amt < 1000 ? 'Minimum is 1,000 HEX Coin.' : amt > earned ? `You only have ${earned.toLocaleString()} earned HEX Coin.` : ''
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,15,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'var(--hx-panel)', borderRadius: '22px 22px 0 0', padding: 24, width: '100%', maxWidth: 440, border: '3px solid var(--hx-line-strong)', boxShadow: '0 -6px 0 var(--hx-ink)', ['--accent' as any]: '#f5a623' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.45)', marginBottom: 6 }}>CASH OUT</div>
        <div style={{ fontSize: 12, color: 'var(--hx-text-2)', marginBottom: 14, textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 800 }}>
          Only HEX Coin earned by playing can be cashed out (purchased HEX can't). 5% is burned. Minimum 1,000.
          Earned balance: <b style={{ color: '#fde68a' }}>{Math.floor(loop?.earned_balance ?? 0).toLocaleString()}</b>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input type="number" min={1000} value={amount} onChange={e => setAmount(e.target.value)} className="hx-input" aria-label="Amount of HEX Coin to cash out" style={{ fontSize: 18, flex: 1 }} />
          <button onClick={() => setAmount(String(earned))} disabled={earned < 1000} className="btn-game btn-game-glass" style={{ minHeight: 44, fontSize: 11 }}>MAX</button>
        </div>
        <div className="hx-card" style={{ marginBottom: 12, padding: '10px 12px', fontSize: 12, color: 'var(--hx-text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Burned (5%)</span><span style={{ color: '#fca5a5' }}>-{Math.round(amt * 0.05).toLocaleString()} HEX Coin</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-heading)', fontSize: 14, color: '#fff' }}>
            <span>You receive</span><span style={{ color: '#d8b4fe' }}>{tokens.toLocaleString(undefined, { maximumFractionDigits: 3 })} HEX Coin</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--hx-text-3)' }}>Fixed rate: 1,000 HEX = 1 HEX Coin = 1 €.</div>
        </div>
        {problem && <div style={{ fontSize: 12, color: '#fde68a', marginBottom: 10 }}>{problem}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onClose} className="btn-game btn-game-glass" style={{ minHeight: 44 }}>CANCEL</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !!problem || amt < 1000} className="btn-game btn-game-gold" style={{ minHeight: 44 }}>
            {mut.isPending ? 'CASHING OUT…' : 'CASH OUT'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CryptoNewsfeed() {
  const { data: news = [] } = useQuery({
    queryKey: ['crypto-news'],
    queryFn: () => api.get('/wallet/newsfeed/').then(r => r.data ?? []),
    refetchInterval: 120000,
  })
  if (!news.length) return <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '30px 0', fontSize: 13 }}>Loading crypto news…</div>
  return (
    <div>
      {(news as any[]).map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none', padding: '12px 0', borderBottom: '2px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {a.thumb && <img src={a.thumb} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{a.source}</div>
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

import { IconSVG } from '../shared/iconBank'

const TABS = [
  { id: 'wallet',  label: 'BALANCE'},
  { id: 'details', label: 'DETAILS'},
]

const TX_COLORS: Record<string, string> = {
  purchase_bonus: '#00884a', territory_yield: '#10B981', stake_reward: '#F59E0B',
  withdraw: '#EF4444', convert_to_tdc: '#8B5CF6', referral_bonus: '#06B6D4',
}

// ── Tokenomics Dashboard ──
function TokenomicsTab() {
  const stats = useTokenStats()
  const hardCap = 4842432

  const statBlocks = [
    { label: 'PRICE', value: `$${stats.price.toFixed(4)}`, color: '#00884a' },
    { label: 'MARKET CAP', value: `$${(stats.marketCap).toLocaleString()}`, color: '#0099cc' },
    { label: 'MINED', value: `${stats.percentMined}%`, color: '#cc8800' },
    { label: 'BURNED', value: stats.totalBurned.toLocaleString(), color: '#dc2626' },
    { label: 'HOLDERS', value: stats.holders.toLocaleString(), color: '#7950f2' },
    { label: 'MINING RATE', value: `${stats.miningRate} HEX/claim`, color: '#059669' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Supply progress */}
      <div style={{
        padding: 12, borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(121,80,242,0.06), transparent)',
        border: '2px solid rgba(121,80,242,0.15)',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing:0.5, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-heading)', marginBottom: 6 }}>
          TOTAL SUPPLY MINED <span className="hx-chip" style={{ color: '#fbbf24' }}>PRE-LAUNCH ESTIMATES</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace" }}>
          {stats.circulatingSupply.toLocaleString()} / {hardCap.toLocaleString()}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${stats.percentMined}%`, borderRadius: 3,
            background: 'linear-gradient(90deg, #7950f2, #a855f7)',
            boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          <span>0</span>
          <span>HARD CAP: {hardCap.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
        {statBlocks.map(s => (
          <div key={s.label} style={{
            padding: '8px 6px', borderRadius: 8, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing:0.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-heading)', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Burn mechanics info */}
      <div style={{
        padding: '8px 10px', borderRadius: 8,
        background: 'rgba(220,38,38,0.04)', border: '2px solid rgba(220,38,38,0.1)',
        fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0,
      }}>
        <div style={{ fontWeight: 700, color: '#f87171', letterSpacing:0.5, fontFamily: 'var(--font-heading)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}><IconSVG id="flame" size={14} /> DAILY BURN: {stats.dailyBurned.toLocaleString()} HEX</div>
        Skill upgrades, withdrawal fees (3%), territory tax, and marketplace royalties permanently reduce supply. More players = more burn = higher scarcity.
      </div>

      {/* Chain info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.06)',
        fontSize: 11, color: 'rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-heading)', letterSpacing:0.5,
      }}>
        <IconSVG id="grid_globe" size={16} />
        POLYGON POS · ERC-20 · QUICKSWAP
      </div>
    </div>
  )
}

export function CryptoPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('wallet')
  const [showConvert, setShowConvert] = useState(false)
  const [showCashOut, setShowCashOut] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [wAddr, setWAddr] = useState('')
  const [wAmt, setWAmt] = useState('10')
  const qc = useQueryClient()
  const setActivePanel = useStore(s => s.setActivePanel)

  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => api.get('/wallet/me/').then(r => r.data), refetchInterval: 30000 })
  const { data: prices = {} } = useQuery({ queryKey: ['prices'], queryFn: () => api.get('/wallet/prices/').then(r => r.data), refetchInterval: 60000 })
  const { data: txHistory = [] } = useQuery({ queryKey: ['wallet-tx'], queryFn: () => api.get('/wallet/transactions/').then(r => r.data ?? []), enabled: tab === 'details' })

  const withdrawMut = useMutation({
    mutationFn: () => api.post('/wallet/withdraw/', { amount_tdi: parseFloat(wAmt), wallet_address: wAddr }),
    onSuccess: () => { toast.success('Withdrawal submitted (24-48h)'); setShowWithdraw(false); qc.invalidateQueries({ queryKey: ['wallet'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })

  return (
    <>
      <GlassPanel title="WALLET" onClose={onClose} accent="#a855f7" icon={<IconSVG id="ui_wallet" size={24} />} subtitle="HEX Coin & Polygon HEX token">
        {Object.keys(prices || {}).length > 0 && (
          <div style={{ padding: '0 0 8px', borderBottom: '2px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
            <PriceTicker prices={prices} />
          </div>
        )}

        {/* Tabs */}
        <div className="hx-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div>
          {tab === 'wallet' && <>
            <WalletCard wallet={wallet} onConvert={() => setShowConvert(true)} onWithdraw={() => setShowWithdraw(true)} onCashOut={() => setShowCashOut(true)} />

            {/* How it works — explanation for non-crypto users */}
            <div className="hx-card" style={{ marginTop: 4 }}>
              <div className="hx-section-title" style={{ marginTop: 0 }}>HOW IT WORKS</div>
              <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.65)', lineHeight: 1.7, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
                <strong style={{ color: '#fbbf24' }}>HEX Coins</strong> are your in-game currency. Earn them by owning territories, completing challenges, and winning events.
                They can be converted to <strong style={{ color: '#d8b4fe' }}>HEX Crypto</strong> tokens on the Polygon blockchain — real cryptocurrency you own.
              </div>
            </div>
          </>}

          {tab === 'details' && <>
            <TokenomicsTab />
            <div style={{ marginTop: 14 }}><BurnTracker /></div>
            <div style={{ marginTop: 14 }}>
              <div className="hx-section-title">TRANSACTION HISTORY</div>
              {!(txHistory as any[]).length && <div className="hx-empty"><IconSVG id="notepad" size={40} /><div className="hx-empty__title">NO TRANSACTIONS YET</div></div>}
              {(txHistory as any[]).map((tx: any, i: number) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '2px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing:0.5 }}>{(tx.type || "").replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{new Date(tx.date).toLocaleDateString()}{tx.note ? ` · ${tx.note}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace", color: TX_COLORS[tx.type] ?? '#e2e8f0' }}>
                    {tx.amount > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(4)} HEX
                  </div>
                </div>
              ))}
            </div>
          </>}

        {/* ── Cross-panel CTAs ── */}
        <div style={{ marginTop: 16, display:'flex', gap:8, flexDirection:'column' }}>
          <button onClick={() => setShow3D(true)} className="btn-game btn-game-gold"
            style={{ width:'100%', minHeight:44, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <Gem size={15} /> VIEW NFT — VAULT PRESTIGE 3D
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }} className="btn-game btn-game-glass"
              style={{ flex:1, minHeight:42, fontSize: 11, display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'#fde68a' }}>
              <IconSVG id="cart" size={18} /> SHOP
            </button>
            <button onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }} className="btn-game btn-game-glass"
              style={{ flex:1, minHeight:42, fontSize: 11, display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'#fcd34d' }}>
              <IconSVG id="auction_gavel" size={18} /> NFT MARKET
            </button>
          </div>
        </div>
        </div>
      </GlassPanel>

      {showConvert && <ConvertModal wallet={wallet} onClose={() => setShowConvert(false)} />}
      {showCashOut && <CashOutModal wallet={wallet} onClose={() => setShowCashOut(false)} />}

      {showWithdraw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,5,15,0.75)', backdropFilter: 'blur(6px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, #0d1b2a, #060e1a)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 420, border: '3px solid rgba(168,85,247,0.45)', boxShadow: '0 -10px 40px rgba(168,85,247,0.2)', ['--accent' as any]: '#a855f7' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#d8b4fe', marginBottom: 4, letterSpacing:0.5 }}>WITHDRAW HEX</div>
            <div style={{ fontSize: 11, color: '#f87171', marginBottom: 16 }}>KYC required · Min 10 HEX · 24-48h</div>
            <input type="number" value={wAmt} onChange={e => setWAmt(e.target.value)} placeholder="Amount HEX" className="hx-input" aria-label="Amount of HEX to withdraw"
              style={{ fontSize: 16, marginBottom: 10 }} />
            <input value={wAddr} onChange={e => setWAddr(e.target.value)} placeholder="0x... Polygon wallet" className="hx-input" aria-label="Polygon wallet address"
              style={{ marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowWithdraw(false)} className="btn-game btn-game-glass" style={{ minHeight: 42 }}>CANCEL</button>
              <button onClick={() => withdrawMut.mutate()} disabled={withdrawMut.isPending} className="btn-game btn-game-purple" style={{ minHeight: 42 }}>
                {withdrawMut.isPending ? 'SENDING…' : 'WITHDRAW'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Token3DViewer
        visible={show3D}
        onClose={() => setShow3D(false)}
        tokenName="GENESIS TERRITORY"
        category="HEXOD VAULT"
        catColor="#D4AF37"
        tier="GOLD"
        serial={1}
        maxSupply={4842432}
        edition="GENESIS"
        biome="POLYGON"
      />
    </>
  )
}
