/**
 * HEX Coin Wallet + Shop panel.
 * Shows balance, buy HEX Coin (Stripe), shop catalog, transaction history.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wallet, ShoppingCart, History, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { tdcApi } from '../../services/api'
import { useStore, useTDCBalance } from '../../store'
import { Modal } from '../shared/Modal'
import { CrystalIcon } from '../shared/CrystalIcon'
import type { ShopItem } from '../../types'

const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0
const EUR_PACKAGES = [
  { eur: 1.99, tdc: 200,  bonus: 0,    label: 'Starter' },
  { eur: 4.99, tdc: 550,  bonus: 50,   label: 'Scout' },
  { eur: 9.99, tdc: 1200, bonus: 200,  label: 'Commander' },
  { eur: 19.99,tdc: 2600, bonus: 600,  label: 'General', popular: true },
  { eur: 49.99,tdc: 7000, bonus: 2000, label: 'Marshal' },
  { eur: 99.99,tdc: 15000,bonus: 5000, label: 'Emperor' },
]

const CATEGORY_LABELS: Record<string, string> = {
  shield: '🛡️ Boucliers',
  military: '⚔️ Militaire',
  construction: '🔨 Construction',
  resource_pack: '⚡ Ressources',
  cosmetic: '🎨 Cosmétiques',
  battle_pass: '🎖️ Battle Pass',
  alliance: '🏰 Alliance',
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '12px', background: '#059669',
  border: 'none', borderRadius: 8, color: '#1a2a3a',
  fontSize: 14, fontWeight: 500, cursor: 'pointer',
}
const catBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,60,100,0.1)',
  color: '#1a2a3a', fontSize: 12, cursor: 'pointer',
}

export function TDCShopPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'balance' | 'buy' | 'shop' | 'history'>('balance')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [purchaseQty, setPurchaseQty] = useState<Record<string, number>>({})
  const balance = useTDCBalance()
  const setBalance = useStore((s) => s.setBalance)
  const qc = useQueryClient()

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['tdc-balance'],
    queryFn: tdcApi.balance,
    refetchInterval: 60000,
  })

  const { data: catalogData } = useQuery({
    queryKey: ['shop-catalog'],
    queryFn: tdcApi.catalog,
    staleTime: 300000,
  })

  const { data: historyData } = useQuery({
    queryKey: ['tdc-history'],
    queryFn: tdcApi.history,
    enabled: tab === 'history',
  })

  useEffect(() => {
    if (balanceData) setBalance(balanceData)
  }, [balanceData])

  const purchaseMutation = useMutation({
    mutationFn: ({ code, qty }: { code: string; qty: number }) =>
      tdcApi.purchase(code, qty),
    onSuccess: (data, { code }) => {
      toast.success(`✅ Purchased! ${toNum(data.tdc_spent).toFixed(0)} HEX Coin spent`)
      qc.invalidateQueries({ queryKey: ['tdc-balance'] })
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error ?? 'Purchase failed')
    },
  })

  const items: ShopItem[] = Array.isArray(catalogData) ? catalogData : []
  const categories = [...new Set(items.map(i => i.category))]
  const filteredItems = selectedCategory ? items.filter(i => i.category === selectedCategory) : items

  const inGame = toNum(balance?.in_game) ?? balanceData?.in_game ?? 0
  const tdcRate = balance?.tdc_eur_rate ?? balanceData?.tdc_eur_rate ?? 100

  return (
    <Modal open={true} onClose={onClose} title="HEX COIN WALLET" accent="#7950f2" width={600}>
      {/* Balance cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <BalanceCard
          label="In-Game Balance"
          value={`${toNum(inGame).toFixed(2)} HEX Coin`}
          sub={`≈ €${(toNum(inGame) / toNum(tdcRate)).toFixed(2)}`}
          color="#00884a"
        />
        <BalanceCard
          label="Wallet Balance"
          value={balance?.wallet ? `${toNum(balance.wallet).toFixed(2)} HEX Coin` : 'Connect wallet'}
          sub={balance?.wallet ? `Polygon mainnet` : 'Link in profile'}
          color="#8B5CF6"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([
          { id: 'balance', label: 'WALLET', icon: <Wallet size={11} /> },
          { id: 'buy', label: 'BUY HEX', icon: <TrendingUp size={11} /> },
          { id: 'shop', label: 'SHOP', icon: <ShoppingCart size={11} /> },
          { id: 'history', label: 'HISTORY', icon: <History size={11} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 0', fontSize: 7, letterSpacing: 1,
            color: tab === t.id ? '#7950f2' : 'rgba(26,42,58,0.45)',
            background: tab === t.id ? 'rgba(121,80,242,0.1)' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${tab === t.id ? 'rgba(121,80,242,0.3)' : 'rgba(0,60,100,0.1)'}`,
            borderRadius: 20,
            cursor: 'pointer', fontWeight: tab === t.id ? 700 : 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div>

          {/* ── WALLET TAB ──────────────────────────────────────────────── */}
          {tab === 'balance' && (
            <div>
              <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
                <strong style={{ color: '#1a2a3a' }}>HEX Coin (Hexod Coin)</strong> is an ERC-20 token on Polygon.
                Your in-game balance is held by the contract and can be withdrawn to your wallet at any time.
                Withdrawal fee: 3%. Minimum withdrawal: 50 HEX Coin.
              </div>
              <div style={{ padding: 16, background: 'rgba(139,92,246,0.1)', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)', fontSize: 12, color: '#C4B5FD' }}>
                📈 HEX Coin is tradeable on QuickSwap and SushiSwap (Polygon).
                The more players and ad revenue, the more valuable your HEX Coin.
              </div>
              {!balance?.wallet && (
                <button
                  onClick={() => {/* open wallet link flow */}}
                  style={{ ...primaryBtn, marginTop: 16, background: '#7C3AED' }}
                >
                  🔗 Link Polygon Wallet
                </button>
              )}
              {balance?.wallet && balance.wallet > 0 && (
                <button
                  onClick={() => {/* open withdrawal flow */}}
                  style={{ ...primaryBtn, marginTop: 16, background: '#7C3AED' }}
                >
                  ⬆️ Withdraw to Wallet (3% fee)
                </button>
              )}
            </div>
          )}

          {/* ── BUY HEX Coin ─────────────────────────────────────────────────── */}
          {tab === 'buy' && (
            <div>
              <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)', marginBottom: 16 }}>
                1 EUR = {tdcRate} HEX Coin. Larger packs include a bonus. Payment secured by Stripe.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {EUR_PACKAGES.map(pkg => (
                  <button
                    key={pkg.eur}
                    onClick={() => {
                      // In production: create Stripe Payment Intent then open Stripe Elements
                      tdcApi.purchaseOrder(pkg.eur).then(data => {
                        toast.success('Payment initiated — complete in the checkout')
                        // TODO: open Stripe Elements with data.client_secret
                      }).catch(() => toast.error('Payment setup failed'))
                    }}
                    style={{
                      padding: '14px', background: pkg.popular
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${pkg.popular ? '#10B981' : 'rgba(0,60,100,0.1)'}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      position: 'relative',
                    }}
                  >
                    {pkg.popular && (
                      <span style={{
                        position: 'absolute', top: -10, right: 10,
                        background: '#10B981', color: '#1a2a3a',
                        fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      }}>BEST VALUE</span>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2a3a', marginBottom: 2 }}>
                      {pkg.tdc.toLocaleString()} HEX Coin
                    </div>
                    {pkg.bonus > 0 && (
                      <div style={{ fontSize: 11, color: '#10B981', marginBottom: 6 }}>
                        +{pkg.bonus} bonus HEX Coin
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>{pkg.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2a3a', marginTop: 8 }}>
                      €{pkg.eur}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(26,42,58,0.35)', textAlign: 'center', lineHeight: 1.6 }}>
                Payments processed by Stripe. HEX Coin minted on Polygon within ~2 min of payment confirmation.
                No refunds on digital goods. By purchasing you accept the Terms of Service.
              </div>
            </div>
          )}

          {/* ── SHOP ────────────────────────────────────────────────────── */}
          {tab === 'shop' && (
            <div>
              {/* Category filter */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{ ...catBtn, background: !selectedCategory ? '#374151' : 'rgba(255,255,255,0.05)' }}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    style={{ ...catBtn, background: selectedCategory === cat ? '#374151' : 'rgba(255,255,255,0.05)' }}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </button>
                ))}
              </div>

              {filteredItems.map(item => (
                <ShopItemRow
                  key={item.id}
                  item={item}
                  balance={inGame}
                  onBuy={(qty) => {
                    if (inGame < item.price_tdc * qty) {
                      toast.error('Insufficient HEX Coin balance')
                      return
                    }
                    purchaseMutation.mutate({ code: item.code, qty })
                  }}
                />
              ))}
            </div>
          )}

          {/* ── HISTORY ─────────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div>
              {(historyData?.transactions ?? []).map((tx: any) => (
                <div key={tx.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: 12,
                }}>
                  <div>
                    <div style={{ color: '#1a2a3a', marginBottom: 2 }}>
                      {formatTxType(tx.type)} {tx.item_code && `— ${tx.item_code}`}
                    </div>
                    <div style={{ color: 'rgba(26,42,58,0.35)' }}>
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 500,
                    color: tx.amount > 0 ? '#10B981' : '#EF4444',
                  }}>
                    {tx.amount > 0 ? '+' : ''}{toNum(tx.amount).toFixed(2)} HEX Coin
                  </div>
                </div>
              ))}
              {!historyData?.transactions?.length && (
                <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.35)', padding: '40px 0', fontSize: 13 }}>
                  No transactions yet
                </div>
              )}
            </div>
          )}
        </div>
    </Modal>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BalanceCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px',
      background: `${color}12`, borderRadius: 10,
      border: `1px solid ${color}30`,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.35)' }}>{sub}</div>
    </div>
  )
}

function ShopItemRow({ item, balance, onBuy }: { item: ShopItem; balance: number; onBuy: (qty: number) => void }) {
  const canAfford = balance >= item.price_tdc
  const rarityColors: Record<string, string> = {
    common: '#6B7280', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 8,
        background: 'rgba(255,255,255,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
        border: `1px solid ${rarityColors[item.rarity] ?? '#6B7280'}44`,
      }}>
        {item.icon_url ? <img src={item.icon_url} style={{ width: 28, height: 28 }} alt="" /> : getCategoryIcon(item.category)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2a3a' }}>{item.name}</div>
        <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginTop: 1 }}>{item.description}</div>
        {item.max_per_day > 0 && (
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginTop: 2 }}>Max {item.max_per_day}/day</div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: canAfford ? '#F59E0B' : '#6B7280', marginBottom: 4 }}>
          {item.price_tdc} HEX Coin
        </div>
        {item.price_eur_display && (
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginBottom: 6 }}>{item.price_eur_display}</div>
        )}
        <button
          onClick={() => onBuy(1)}
          disabled={!canAfford || !item.is_available}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none',
            background: canAfford && item.is_available ? '#7C3AED' : '#1F2937',
            color: canAfford && item.is_available ? '#fff' : '#4B5563',
            fontSize: 12, cursor: canAfford && item.is_available ? 'pointer' : 'not-allowed',
          }}
        >
          {!item.is_available ? 'Sold out' : canAfford ? 'Buy' : 'Need HEX Coin'}
        </button>
      </div>
    </div>
  )
}

function getCategoryIcon(cat: string): string {
  const icons: Record<string, string> = {
    shield: '🛡️', military: '⚔️', construction: '🔨',
    cosmetic: '🎨', battle_pass: '🎖️', alliance: '🏰', resource_pack: '📦',
  }
  return icons[cat] || '🎁'
}

function formatTxType(type: string): string {
  const labels: Record<string, string> = {
    purchase: '💳 Purchase',
    ad_revenue: '📢 Ad Revenue',
    reward: '🎁 Reward',
    item_purchase: '🛒 Item Bought',
    withdrawal: '⬆️ Withdrawal',
    season_reward: '🏆 Season Reward',
    alliance_transfer: '🤝 Alliance Transfer',
  }
  return labels[type] || type
}


