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
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'

const toF = (v: unknown, d = 2) => parseFloat(String(v ?? 0)).toFixed(d)

function PriceTicker({ prices }: { prices: Record<string, any> }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
      {Object.entries(prices).map(([sym, p]) => {
        const up = (p.change_24h ?? 0) > 0
        return (
          <div key={sym} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: '8px 14px', border: `1px solid ${sym === 'HEX' ? 'rgba(0,136,74,0.25)' : 'rgba(0,60,100,0.1)'}`, minWidth: 90 }}>
            <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.1em' }}>{sym}</div>
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
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HEX Balance</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#00884a', fontFamily: 'monospace', marginTop: 2 }}>
            {toF(wallet?.tdi_balance, 4)}
            <span style={{ fontSize: 13, color: 'rgba(26,42,58,0.45)', marginLeft: 6 }}>HEX</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)', marginTop: 3 }}>≈ ${toF(wallet?.tdi_usd_value, 2)} USD</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)' }}>In-Game HEX Coin</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#cc8800', fontFamily: 'monospace', marginTop: 2 }}>🪙 {toF(wallet?.tdc_in_game, 0)}</div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginTop: 3 }}>Staked: {toF(wallet?.tdi_staked, 4)}</div>
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
      <div style={{ marginTop: 14, fontSize: 10, color: 'rgba(26,42,58,0.25)', lineHeight: 1.6, textAlign: 'center' }}>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,42,58,0.4)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, rgba(240,245,252,0.98), rgba(225,235,248,0.98))', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 420, border: '1px solid rgba(0,60,100,0.1)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2a3a', marginBottom: 6 }}>Convert HEX → HEX Coin</div>
        <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginBottom: 14 }}>Rate: 1 HEX ≈ {rate.toFixed(1)} HEX Coin · Available: {toF(wallet?.tdi_balance, 4)} HEX</div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 16px', color: '#1a2a3a', fontSize: 18, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
        <div style={{ textAlign: 'center', color: '#00884a', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>→ 🪙 {preview.toFixed(1)} HEX Coin</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onClose} style={{ padding: 12, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 10, color: 'rgba(26,42,58,0.45)', cursor: 'pointer' }}>Cancel</button>
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
  if (!news.length) return <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.35)', padding: '30px 0', fontSize: 13 }}>Loading crypto news…</div>
  return (
    <div>
      {(news as any[]).map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid rgba(0,60,100,0.08)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {a.thumb && <img src={a.thumb} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: 13, color: '#1a2a3a', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)' }}>{a.source}</div>
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

import { StakingPanel } from './StakingPanel'

const TABS = [
  { id: 'wallet',  label: '💎 Wallet'  },
  { id: 'staking', label: '🔒 Staking' },
  { id: 'markets', label: '📈 Markets' },
  { id: 'news',    label: '📰 News'    },
  { id: 'history', label: '📋 History' },
]

const TX_COLORS: Record<string, string> = {
  purchase_bonus: '#00884a', territory_yield: '#10B981', stake_reward: '#F59E0B',
  withdraw: '#EF4444', convert_to_tdc: '#8B5CF6', referral_bonus: '#06B6D4',
}

export function CryptoPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('wallet')
  const [showConvert, setShowConvert] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wAddr, setWAddr] = useState('')
  const [wAmt, setWAmt] = useState('10')
  const qc = useQueryClient()
  const setActivePanel = useStore(s => s.setActivePanel)

  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => api.get('/wallet/me/').then(r => r.data), refetchInterval: 30000 })
  const { data: prices = {} } = useQuery({ queryKey: ['prices'], queryFn: () => api.get('/wallet/prices/').then(r => r.data), refetchInterval: 60000 })
  const { data: txHistory = [] } = useQuery({ queryKey: ['wallet-tx'], queryFn: () => api.get('/wallet/transactions/').then(r => r.data ?? []), enabled: tab === 'history' })

  const withdrawMut = useMutation({
    mutationFn: () => api.post('/wallet/withdraw/', { amount_tdi: parseFloat(wAmt), wallet_address: wAddr }),
    onSuccess: () => { toast.success('Withdrawal submitted (24-48h)'); setShowWithdraw(false); qc.invalidateQueries({ queryKey: ['wallet'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })

  return (
    <>
      <GlassPanel title="WALLET" onClose={onClose} accent="#a855f7" width={400}>
        <div style={{ padding: '0 0 8px', borderBottom: '1px solid rgba(0,60,100,0.1)', marginBottom: 12 }}>
          <PriceTicker prices={prices} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '7px 4px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
              background: tab === t.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.5)',
              color: tab === t.id ? '#a855f7' : 'rgba(26,42,58,0.45)',
              fontFamily: "'Orbitron', system-ui, sans-serif",
              border: `1px solid ${tab === t.id ? 'rgba(168,85,247,0.3)' : 'rgba(0,60,100,0.1)'}`,
            }}>{t.label}</button>
          ))}
        </div>

        <div>
          {tab === 'wallet' && <WalletCard wallet={wallet} onConvert={() => setShowConvert(true)} onWithdraw={() => setShowWithdraw(true)} />}
          {tab === 'staking' && <StakingPanel onClose={() => setTab('wallet')} embedded />}

          {tab === 'markets' && Object.entries(prices).map(([sym, p]: any) => (
            <div key={sym} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(0,60,100,0.08)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: sym === 'HEX' ? 'rgba(0,136,74,0.12)' : 'rgba(0,60,100,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginRight: 14, flexShrink: 0 }}>
                {sym === 'BTC' ? '₿' : sym === 'ETH' ? 'Ξ' : sym === 'MATIC' ? '⬡' : '💎'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>{sym}</div>
                {p.market_cap && <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)' }}>MCap ${(p.market_cap / 1e9).toFixed(1)}B</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: sym === 'HEX' ? '#00884a' : '#fff' }}>
                  ${p.price_usd < 0.01 ? p.price_usd.toFixed(6) : p.price_usd.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: (p.change_24h ?? 0) > 0 ? '#10B981' : '#EF4444' }}>
                  {(p.change_24h ?? 0) > 0 ? '▲' : '▼'} {Math.abs(p.change_24h ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}

          {tab === 'news' && <CryptoNewsfeed />}

          {tab === 'history' && (
            <div>
              {!(txHistory as any[]).length && <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.35)', padding: '30px 0' }}>No transactions yet</div>}
              {(txHistory as any[]).map((tx, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,60,100,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)', fontWeight: 500 }}>{tx.type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginTop: 2 }}>{tx.note}</div>
                    <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.25)', marginTop: 1 }}>{new Date(tx.date).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: TX_COLORS[tx.type] ?? '#fff' }}>
                    {tx.amount > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(6)} HEX
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* ── Cross-panel CTAs ── */}
        <div style={{ marginTop: 16, display:'flex', gap:8 }}>
          <button
            onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }}
            style={{
              flex:1, padding:'10px', borderRadius:20,
              background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)',
              color:'#cc8800', fontSize:7, fontWeight:700, letterSpacing:2,
              cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
            }}
          >
            🛒 SPEND → SHOP
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
            🏪 NFT MARKET →
          </button>
        </div>
        </div>
      </GlassPanel>

      {showConvert && <ConvertModal wallet={wallet} onClose={() => setShowConvert(false)} />}

      {showWithdraw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,42,58,0.4)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} style={{ background: 'linear-gradient(180deg, rgba(240,245,252,0.98), rgba(225,235,248,0.98))', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2a3a', marginBottom: 4 }}>Withdraw HEX</div>
            <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 16 }}>⚠️ KYC required · Min 10 HEX · 24-48h</div>
            <input type="number" value={wAmt} onChange={e => setWAmt(e.target.value)} placeholder="Amount HEX"
              style={{ width: '100%', background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#1a2a3a', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <input value={wAddr} onChange={e => setWAddr(e.target.value)} placeholder="0x... Polygon wallet"
              style={{ width: '100%', background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#1a2a3a', fontSize: 12, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowWithdraw(false)} style={{ padding: 12, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)', borderRadius: 10, color: 'rgba(26,42,58,0.45)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => withdrawMut.mutate()} disabled={withdrawMut.isPending} style={{ padding: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, color: '#A78BFA', cursor: 'pointer', fontWeight: 700 }}>
                {withdrawMut.isPending ? '…' : 'Withdraw'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
