/**
 * StakingPanel — Staking HEX Coin (SOLANA spec)
 *
 * 4 tiers APR :
 *   Tier 1 :   100–999 HEX   → 8%  APR
 *   Tier 2 : 1 000–9 999 HEX → 12% APR
 *   Tier 3 : 10 000–99 999   → 18% APR
 *   Tier 4 : 100 000+         → 25% APR
 *
 * Stub devnet — les transactions réelles seront via programme Anchor.
 * Thomas spec : crée de la retention de valeur + preuve de revenu.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'

const TIERS = [
  { min: 100,     max: 999,      apr: 8,  label: 'Tier 1',  color: '#10B981', badge: 'sprout' },
  { min: 1_000,   max: 9_999,    apr: 12, label: 'Tier 2',  color: '#3B82F6', badge: 'water_drop' },
  { min: 10_000,  max: 99_999,   apr: 18, label: 'Tier 3',  color: '#8B5CF6', badge: 'flame' },
  { min: 100_000, max: Infinity, apr: 25, label: 'Tier 4',  color: '#F59E0B', badge: 'lightning' },
]

function getTier(amount: number) {
  return TIERS.find(t => amount >= t.min && amount <= t.max) || null
}

function calcDailyReward(staked: number, apr: number) {
  return (staked * apr / 100) / 365
}

interface Props { onClose: () => void; embedded?: boolean }

export function StakingPanel({ onClose, embedded = false }: Props) {
  const player = usePlayer()
  const qc = useQueryClient()
  const [stakeAmount, setStakeAmount] = useState('')
  const [tab, setTab] = useState<'stake' | 'positions'>('stake')

  const { data: stakingData, isLoading } = useQuery({
    queryKey: ['staking-info', player?.id],
    queryFn: () => api.get('/api/solana/staking/').then(r => r.data).catch(() => ({
      total_staked: 0, positions: [], rewards_pending: 0,
    })),
    staleTime: 30000,
  })

  const balance = parseFloat(String(player?.tdc_in_game || 0))
  const amount  = parseFloat(stakeAmount) || 0
  const tier    = getTier(amount)
  const preview = tier ? calcDailyReward(amount, tier.apr) : 0

  const stakeMut = useMutation({
    mutationFn: (amt: number) => api.post('/api/solana/stake/', { amount: amt }),
    onSuccess: (res) => {
      toast.success(`${amount.toLocaleString()} HEX mis en staking ! APR ${tier?.apr}%`)
      qc.invalidateQueries({ queryKey: ['staking-info'] })
      qc.invalidateQueries({ queryKey: ['player'] })
      setStakeAmount('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur de staking'),
  })

  const claimMut = useMutation({
    mutationFn: () => api.post('/api/solana/claim-rewards/'),
    onSuccess: (res) => {
      toast.success(`+${res.data.claimed?.toFixed(2)} HEX réclamés !`)
      qc.invalidateQueries({ queryKey: ['staking-info', 'player'] })
    },
  })

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={embedded ? {
        display: 'flex', flexDirection: 'column', width: '100%',
      } : {
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: Math.min(400, window.innerWidth - 8),
        background: 'linear-gradient(180deg, rgba(13,27,42,0.95) 0%, rgba(10,22,40,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1300, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.7)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}><EmojiIcon emoji="" /> Staking HEX</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              Soleil sur ton épargne — jusqu'à 25% APR
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['stake', 'positions'].map(t => (
            <button key={t} onClick={() => setTab(t as any)} style={{
              flex: 1, padding: '7px', fontSize: 11, fontWeight: tab === t ? 700 : 400,
              background: tab === t ? 'rgba(245,158,11,0.1)' : 'transparent',
              border: `1px solid ${tab === t ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 8, cursor: 'pointer',
              color: tab === t ? '#F59E0B' : '#6B7280',
            }}>
              {t === 'stake' ? ' Staker' : ' Positions'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {tab === 'stake' ? (
          <>
            {/* Tiers */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Tiers de récompense
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TIERS.map(t => {
                  const isActive = amount >= t.min && amount <= t.max
                  return (
                    <div key={t.label} style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: isActive ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? t.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{t.badge}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: t.color }}>
                        {t.apr}% APR
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {t.min.toLocaleString()}+ HEX
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.25)', fontStyle: 'italic' }}>
                        {t.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Solde */}
            <div style={{ padding: '10px 14px', marginBottom: 14,
              background: 'rgba(0,136,74,0.06)', border: '1px solid rgba(0,136,74,0.15)', borderRadius: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Solde disponible</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#00884a', fontFamily: 'monospace' }}>
                {balance.toFixed(2)} <EmojiIcon emoji="" />
              </span>
            </div>

            {/* Input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                Montant à staker (min 100 HEX)
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number" min={100} max={balance} value={stakeAmount}
                  onChange={e => setStakeAmount(e.target.value)}
                  placeholder="100"
                  style={{
                    flex: 1, padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tier ? tier.color + '55' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, color: '#e2e8f0', fontSize: 14, fontFamily: 'monospace',
                  }}
                />
                <button onClick={() => setStakeAmount(balance.toFixed(0))} style={{
                  padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 11,
                }}>MAX</button>
              </div>
            </div>

            {/* Aperçu récompenses */}
            {tier && amount >= 100 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 14,
                  background: `${tier.color}10`, border: `1px solid ${tier.color}30` }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: tier.color, marginBottom: 8 }}>
                  {tier.badge} {tier.label} — {tier.apr}% APR
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: '/jour',  val: preview.toFixed(2) },
                    { label: '/mois',  val: (preview * 30).toFixed(1) },
                    { label: '/an',    val: (preview * 365).toFixed(0) },
                  ].map(r => (
                    <div key={r.label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: tier.color, fontFamily: 'monospace' }}>{r.val}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>HEX{r.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Bouton staker */}
            <button
              onClick={() => amount >= 100 && amount <= balance && stakeMut.mutate(amount)}
              disabled={!tier || amount < 100 || amount > balance || stakeMut.isPending}
              style={{
                width: '100%', padding: 14,
                background: tier ? `${tier.color}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${tier ? tier.color + '44' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, color: tier ? tier.color : '#374151',
                fontSize: 14, fontWeight: 800, cursor: tier ? 'pointer' : 'not-allowed',
                opacity: (!tier || amount < 100 || amount > balance) ? 0.5 : 1,
              }}
            >
              {stakeMut.isPending ? 'En cours…' : `Staker ${amount ? amount.toLocaleString() : '?'} HEX`}
            </button>

            <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.25)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Staking via programme Solana (devnet). Unlock à tout moment.{'\n'}
              Les récompenses sont distribuées toutes les 24h.
            </div>
          </>
        ) : (
          /* Positions tab */
          <>
            {/* Rewards pending */}
            {(stakingData?.rewards_pending || 0) > 0 && (
              <div style={{ padding: '12px 14px', marginBottom: 14,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>Récompenses à réclamer</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Distribuées chaque 24h</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B', fontFamily: 'monospace' }}>
                    +{stakingData.rewards_pending.toFixed(4)} <EmojiIcon emoji="" />
                  </span>
                  <button
                    onClick={() => claimMut.mutate()}
                    disabled={claimMut.isPending}
                    style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
                      color: '#F59E0B', fontSize: 11, fontWeight: 700 }}
                  >
                    {claimMut.isPending ? '…' : 'Réclamer'}
                  </button>
                </div>
              </div>
            )}

            {/* Total staké */}
            <div style={{ padding: '12px 14px', marginBottom: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Total en staking</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0', fontFamily: 'monospace' }}>
                {(stakingData?.total_staked || 0).toLocaleString()} <EmojiIcon emoji="" />
              </div>
              {getTier(stakingData?.total_staked || 0) && (
                <div style={{ fontSize: 11, color: getTier(stakingData.total_staked)!.color, marginTop: 4 }}>
                  {getTier(stakingData.total_staked)!.badge} {getTier(stakingData.total_staked)!.label} — {getTier(stakingData.total_staked)!.apr}% APR
                </div>
              )}
            </div>

            {/* Positions */}
            {(stakingData?.positions || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(26,42,58,0.25)', fontSize: 12 }}>
                No active positions. Stake HEX to start earning.
              </div>
            ) : (
              (stakingData.positions || []).map((pos: any, i: number) => {
                const t = getTier(pos.amount)
                return (
                  <div key={i} style={{ padding: '12px 14px', marginBottom: 8,
                    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                    border: `1px solid ${t ? t.color + '30' : 'rgba(255,255,255,0.05)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {pos.amount.toLocaleString()} HEX
                      </span>
                      <span style={{ fontSize: 11, color: t?.color || '#6B7280', fontWeight: 700 }}>
                        {t?.apr || 0}% APR
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                      Depuis le {new Date(pos.staked_at).toLocaleDateString('fr-FR')} · +{(pos.daily_reward || 0).toFixed(4)} HEX/j
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
