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
import { IconSVG } from '../shared/iconBank'

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
    queryFn: () => api.get('/solana/staking/').then(r => r.data).catch(() => ({
      total_staked: 0, positions: [], rewards_pending: 0,
    })),
    staleTime: 30000,
  })

  const balance = parseFloat(String(player?.tdc_in_game || 0))
  const amount  = parseFloat(stakeAmount) || 0
  const tier    = getTier(amount)
  const preview = tier ? calcDailyReward(amount, tier.apr) : 0

  const stakeMut = useMutation({
    mutationFn: (amt: number) => api.post('/solana/stake/', { amount: amt }),
    onSuccess: (res) => {
      toast.success(`${amount.toLocaleString()} HEX mis en staking ! APR ${tier?.apr}%`)
      qc.invalidateQueries({ queryKey: ['staking-info'] })
      qc.invalidateQueries({ queryKey: ['player'] })
      setStakeAmount('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur de staking'),
  })

  const claimMut = useMutation({
    mutationFn: () => api.post('/solana/claim-rewards/'),
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}><IconSVG id="hex_coin" size={14} /> AUTO-STAKING</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              All your HEX are automatically staked — earn rewards passively
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', width: 32, height: 32, color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {/* Current balance = auto-staked amount */}
        <div style={{ textAlign: 'center', padding: '20px', marginBottom: 16, borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 4 }}>AUTO-STAKED BALANCE</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F59E0B', fontFamily: "'Share Tech Mono', monospace" }}>
            {balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span style={{ fontSize: 12 }}>HEX</span>
          </div>
          {tier && (
            <div style={{ fontSize: 10, color: tier.color, fontWeight: 700, marginTop: 4 }}>
              {tier.label} — {tier.apr}% APR
            </div>
          )}
        </div>

        {/* Daily reward preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>DAILY REWARD</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e', fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>
              +{calcDailyReward(balance, tier?.apr || 8).toFixed(1)} HEX
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>PENDING REWARDS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>
              {parseFloat(String(stakingData?.rewards_pending || 0)).toFixed(1)} HEX
            </div>
          </div>
        </div>

        {/* Claim button */}
        {parseFloat(String(stakingData?.rewards_pending || 0)) > 0 && (
          <button onClick={() => claimMut.mutate()} className="btn-game btn-game-green" style={{ width: '100%', fontSize: 11, letterSpacing: 2, marginBottom: 16 }}>
            CLAIM {parseFloat(String(stakingData?.rewards_pending || 0)).toFixed(1)} HEX
          </button>
        )}

        {/* Tiers info */}
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 8 }}>REWARD TIERS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {TIERS.map(t => {
            const isActive = balance >= t.min && balance <= t.max
            return (
              <div key={t.label} style={{
                padding: '10px 12px', borderRadius: 10,
                background: isActive ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? t.color + '55' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? t.color : 'rgba(255,255,255,0.3)' }}>
                  {t.apr}% APR
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {t.min.toLocaleString()}+ HEX
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </motion.div>
  )
}

