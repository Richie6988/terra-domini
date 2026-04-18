/**
 * CryptoPanel — Section crypto complète :
 * Wallet HEX, prix live, newsfeed, convert HEX↔HEX Coin, withdraw
 */
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

const toF = (v: unknown, d = 2) => parseFloat(String(v ?? 0)).toFixed(d)

function PriceTicker({ prices }: { prices: Record<string, any> }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
      {Object.entries(prices).map(([sym, p]) => {
        const up = (p.change_24h ?? 0) > 0
        return (
          <div key={sym} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 14px', border: `1px solid ${sym === 'HEX' ? 'rgba(0,136,74,0.25)' : 'rgba(255,255,255,0.08)'}`, minWidth: 90 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>{sym}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sym === 'HEX' ? '#00884a' : '#fff', fontFamily: 'monospace', marginTop: 2 }}>
              ${p.price_usd < 0.01 ? parseFloat(p.price_usd).toFixed(6) : parseFloat(p.price_usd).toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: up ? '#10B981' : '#EF4444', marginTop: 2 }}>
              {up ? '▲' : '▼'} {Math.abs(p.change_24h ?? 0).toFixed(2)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WalletCard({ wallet, onConvert, onWithdraw }: any) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(0,136,74,0.07) 0%, rgba(139,92,246,0.07) 100%)', border: '1px solid rgba(0,136,74,0.18)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HEX Balance</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#00884a', fontFamily: 'monospace', marginTop: 2 }}>
            {toF(wallet?.tdi_balance, 4)}
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>HEX</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>≈ ${toF(wallet?.tdi_usd_value, 2)} USD</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>In-Game HEX Coin</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#cc8800', fontFamily: 'monospace', marginTop: 2 }}>{toF(wallet?.tdc_in_game, 0)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Staked: {toF(wallet?.tdi_staked, 4)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={onConvert} style={{ padding: 10, background: 'rgba(0,136,74,0.12)', border: '1px solid rgba(0,136,74,0.3)', borderRadius: 10, color: '#00884a', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>⇄ HEX → HEX Coin</button>
        <button onClick={onWithdraw} style={{ padding: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, color: '#A78BFA', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>↗ Withdraw</button>
      </div>
      {wallet?.tdi_pending > 0 && (
        <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 11, color: '#F59E0B' }}>
          ⏳ {toF(wallet.tdi_pending, 4)} HEX pending withdrawal
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, textAlign: 'center' }}>
        HEX earned = crypto equivalent of your HEX Coin purchases · Withdraw to Polygon wallet after KYC
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.03)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, rgba(240,245,252,0.98), rgba(225,235,248,0.98))', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 420, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>Convert HEX → HEX Coin</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>Rate: 1 HEX ≈ {rate.toFixed(1)} HEX Coin · Available: {toF(wallet?.tdi_balance, 4)} HEX</div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 16px', color: '#e2e8f0', fontSize: 18, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
        <div style={{ textAlign: 'center', color: '#00884a', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>→ <IconSVG id="hex_coin" size={10} /> {preview.toFixed(1)} HEX Coin</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onClose} style={{ padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ padding: 12, background: 'rgba(0,136,74,0.15)', border: '1px solid rgba(0,136,74,0.4)', borderRadius: 10, color: '#00884a', cursor: 'pointer', fontWeight: 700 }}>
            {mut.isPending ? '…' : 'Convert'}
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
        <a key={i} href={a.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {a.thumb && <img src={a.thumb} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{a.source}</div>
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
        border: '1px solid rgba(121,80,242,0.15)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6 }}>
          TOTAL SUPPLY MINED
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace" }}>
          {stats.circulatingSupply.toLocaleString()} / {hardCap.toLocaleString()}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${stats.percentMined}%`, borderRadius: 3,
            background: 'linear-gradient(90deg, #7950f2, #a855f7)',
            boxShadow: '0 0 8px rgba(121,80,242,0.4)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
          <span>0</span>
          <span>HARD CAP: {hardCap.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {statBlocks.map(s => (
          <div key={s.label} style={{
            padding: '8px 6px', borderRadius: 8, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 5, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Staking APY tiers */}
      <div>
        <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6 }}>STAKING APY</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(stats.stakingAPY).map(([days, apy]) => (
            <div key={days} style={{
              flex: 1, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(0,136,74,0.06), transparent)',
              border: '1px solid rgba(0,136,74,0.15)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#00884a', fontFamily: "'Share Tech Mono', monospace" }}>{apy}%</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1, marginTop: 2 }}>{days} DAYS</div>
            </div>
          ))}
        </div>
      </div>

      {/* Burn mechanics info */}
      <div style={{
        padding: '8px 10px', borderRadius: 8,
        background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)',
        fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: '#dc2626', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4 }}><IconSVG id="hex_coin" size={10} /> DAILY BURN: {stats.dailyBurned.toLocaleString()} HEX</div>
        Skill upgrades, withdrawal fees (3%), territory tax, and marketplace royalties permanently reduce supply. More players = more burn = higher scarcity.
      </div>

      {/* Chain info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 7, color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        <span style={{ fontSize: 12 }}>⬡</span>
        POLYGON POS · ERC-20 · QUICKSWAP
      </div>
    </div>
  )
}

export function CryptoPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('wallet')
  const [showConvert, setShowConvert] = useState(false)
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
      <GlassPanel title="WALLET" onClose={onClose} accent="#a855f7">
        <div style={{ padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
          <PriceTicker prices={prices} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '7px 4px', borderRadius: 20, cursor: 'pointer',
              fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
              background: tab === t.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? '#a855f7' : 'rgba(255,255,255,0.35)',
              fontFamily: "'Orbitron', system-ui, sans-serif",
              border: `1px solid ${tab === t.id ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>{t.label}</button>
          ))}
        </div>

        <div>
          {tab === 'wallet' && <>
            <WalletCard wallet={wallet} onConvert={() => setShowConvert(true)} onWithdraw={() => setShowWithdraw(true)} />

            {/* How it works — explanation for non-crypto users */}
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'rgba(0,153,204,0.04)', border: '1px solid rgba(0,153,204,0.1)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>HOW IT WORKS</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
                <strong style={{ color: '#7950f2' }}>HEX Coins (◆)</strong> are your in-game currency. Earn them by owning territories, completing challenges, and winning events.
                They can be converted to <strong style={{ color: '#cc8800' }}>HEX Crypto</strong> tokens on the Polygon blockchain — real cryptocurrency you own.
                Staking your HEX gives you bonus resource production in your kingdoms.
              </div>
            </div>

            {/* Staking summary */}
            <div style={{ marginTop: 14 }}>
              
            </div>
          </>}

          {tab === 'details' && <>
            <TokenomicsTab />
            <div style={{ marginTop: 14 }}><BurnTracker /></div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>TRANSACTION HISTORY</div>
              {!(txHistory as any[]).length && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '20px 0', fontSize: 8, fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 2 }}>NO TRANSACTIONS YET</div>}
              {(txHistory as any[]).map((tx: any, i: number) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>{(tx.type || "").replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{new Date(tx.date).toLocaleDateString()}</div>
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
          <button
            onClick={() => setShow3D(true)}
            style={{
              width:'100%', padding:'12px', borderRadius:20, border:'none', cursor:'pointer',
              background:'linear-gradient(90deg, #D4AF37, #CD7F32)',
              color:'#fff', fontSize:8, fontWeight:900, letterSpacing:3,
              fontFamily:"'Orbitron', system-ui, sans-serif",
              boxShadow:'0 4px 20px rgba(212,175,55,0.3)',
            }}
          >
            ◆ VIEW NFT — VAULT PRESTIGE 3D
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }}
              style={{
                flex:1, padding:'10px', borderRadius:20,
                background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)',
                color:'#cc8800', fontSize:7, fontWeight:700, letterSpacing:2,
                cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
              }}
            >
              <IconSVG id="cart" size={10} /> SPEND → SHOP
            </button>
            <button
              onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }}
              style={{
                flex:1, padding:'10px', borderRadius:20,
                background:'rgba(204,136,0,0.08)', border:'1px solid rgba(204,136,0,0.2)',
                color:'#cc8800', fontSize:7, fontWeight:700, letterSpacing:2,
                cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
              }}
            >
              <IconSVG id="auction_gavel" size={10} /> NFT MARKET →
            </button>
          </div>
        </div>
        </div>
      </GlassPanel>

      {showConvert && <ConvertModal wallet={wallet} onClose={() => setShowConvert(false)} />}

      {showWithdraw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.03)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, rgba(240,245,252,0.98), rgba(225,235,248,0.98))', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Withdraw HEX</div>
            <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 16 }}>KYC required · Min 10 HEX · 24-48h</div>
            <input type="number" value={wAmt} onChange={e => setWAmt(e.target.value)} placeholder="Amount HEX"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#e2e8f0', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <input value={wAddr} onChange={e => setWAddr(e.target.value)} placeholder="0x... Polygon wallet"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowWithdraw(false)} style={{ padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => withdrawMut.mutate()} disabled={withdrawMut.isPending} style={{ padding: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, color: '#A78BFA', cursor: 'pointer', fontWeight: 700 }}>
                {withdrawMut.isPending ? '…' : 'Withdraw'}
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
