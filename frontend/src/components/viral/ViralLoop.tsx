/**
 * Viral Loop Engine
 * Generates shareable moments at key dopamine peaks.
 * Triggered automatically on: capture, rank up, daily HEX Coin, streak milestone, alliance win.
 *
 * Strategy: every "wow moment" → instant share card → TikTok/Instagram → new players
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { ShareCard } from '../social/SocialFeatures'

// ─── Viral moment triggers ────────────────────────────────────────────────────

type ViralMoment = {
  type: 'capture' | 'rank_up' | 'alliance_victory' | 'ad_revenue' | 'streak' | 'tdc_milestone'
  data: Record<string, unknown>
  priority: number  // higher = show immediately
}

// ─── Viral Loop Manager ───────────────────────────────────────────────────────

export function ViralLoopManager() {
  const [pendingMoment, setPendingMoment] = useState<ViralMoment | null>(null)
  const [showShare, setShowShare] = useState(false)
  const lastEvent = useStore(s => s.lastGameEvent)

  useEffect(() => {
    if (!lastEvent) return

    const moments: Record<string, ViralMoment | null> = {
      'territory_captured': {
        type: 'capture',
        data: {
          territory_name: lastEvent.territory_name,
          from_player: lastEvent.attacker,
        },
        priority: 90,
      },
      'rank_up': {
        type: 'rank_up',
        data: { new_rank: lastEvent.new_rank },
        priority: 80,
      },
      'alliance_tower_won': {
        type: 'alliance_victory',
        data: { alliance_tag: lastEvent.alliance_tag },
        priority: 95,
      },
      'daily_ad_summary': (() => {
        const tdc = Number(lastEvent.tdc_earned ?? 0)
        return tdc >= 100 ? {
          type: 'ad_revenue' as const,
          data: { tdc_earned: tdc, territory_count: lastEvent.territory_count },
          priority: 70,
        } : null
      })(),
      'streak_milestone': {
        type: 'streak',
        data: { streak_days: lastEvent.streak_days, reward_tdc: lastEvent.reward_tdc },
        priority: 60,
      },
    }

    const moment = moments[lastEvent.type]
    if (moment) {
      setPendingMoment(moment)
    }
  }, [lastEvent])

  // Auto-show share card on high-priority moments
  useEffect(() => {
    if (!pendingMoment) return

    // High priority = show immediately
    if (pendingMoment.priority >= 85) {
      const timer = setTimeout(() => setShowShare(true), 1500)
      return () => clearTimeout(timer)
    }

    // Lower priority = show after 5s delay
    if (pendingMoment.priority >= 60) {
      const timer = setTimeout(() => setShowShare(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [pendingMoment])

  const handleDismiss = () => {
    setShowShare(false)
    setPendingMoment(null)
  }

  if (!showShare || !pendingMoment) return null

  // Map viral moment types to ShareCard types
  const shareType = (() => {
    switch (pendingMoment.type) {
      case 'capture': return 'capture' as const
      case 'rank_up': return 'rank_up' as const
      case 'alliance_victory': return 'alliance_victory' as const
      case 'ad_revenue': return 'ad_revenue' as const
      case 'streak': return 'ad_revenue' as const  // reuse ad_revenue card style
      default: return 'capture' as const
    }
  })()

  return (
    <AnimatePresence>
      <ShareCard
        type={shareType}
        data={pendingMoment.data}
        onClose={handleDismiss}
      />
    </AnimatePresence>
  )
}

// ─── Streak Celebration Overlay ───────────────────────────────────────────────

export function StreakCelebration({
  streakDays,
  rewardTDC,
  isMilestone,
  onClaim,
}: {
  streakDays: number
  rewardTDC: number
  isMilestone: boolean
  onClaim: () => void
}) {
  const milestones: Record<number, { emoji: string; title: string; subtitle: string }> = {
    7:   { emoji: '🔥', title: 'Une semaine !',      subtitle: 'Connexion 7 jours de suite' },
    30:  { emoji: '💎', title: 'Un mois entier !',   subtitle: 'Fidélité légendaire' },
    100: { emoji: '👑', title: '100 jours !',         subtitle: 'Tu es une légende Hexod' },
    365: { emoji: '🌍', title: 'UN AN !',              subtitle: 'La Terre t\'appartient vraiment' },
  }

  const milestone = milestones[streakDays]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          width: '100%', maxWidth: 380, textAlign: 'center',
          background: 'rgba(10,10,20,0.99)',
          border: `1px solid ${isMilestone ? 'rgba(255,184,0,0.3)' : 'rgba(0,255,135,0.2)'}`,
          borderRadius: 16, overflow: 'hidden',
        }}
      >
        {/* Confetti bar */}
        {isMilestone && (
          <div style={{
            height: 4,
            background: 'linear-gradient(90deg, #FF3B30, #FFB800, #00FF87, #7B2FFF, #FF3B30)',
          }} />
        )}

        <div style={{ padding: '32px 28px 28px' }}>
          {/* Emoji */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ fontSize: 56, marginBottom: 16 }}
          >
            {isMilestone ? milestone?.emoji : '🔥'}
          </motion.div>

          {/* Title */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: isMilestone ? 36 : 28,
            letterSpacing: '1px', color: '#1a2a3a',
            marginBottom: 8,
          }}>
            {isMilestone ? milestone?.title : `Jour ${streakDays} !`}
          </div>

          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.5)',
            marginBottom: 24,
          }}>
            {isMilestone ? milestone?.subtitle : `${streakDays} jours de connexion consécutifs`}
          </div>

          {/* Reward */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              padding: '16px',
              background: 'rgba(255,184,0,0.08)',
              border: '1px solid rgba(255,184,0,0.2)',
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,184,0,0.5)', letterSpacing: '0.1em', marginBottom: 4 }}>
              RÉCOMPENSE DE CONNEXION
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 40, letterSpacing: '2px',
              color: '#cc8800',
            }}>
              +{rewardTDC} HEX Coin
            </div>
          </motion.div>

          {/* Claim button */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onClaim}
            style={{
              width: '100%', padding: '15px',
              background: isMilestone ? '#cc8800' : '#00884a',
              border: 'none', borderRadius: 10,
              color: '#000', fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
            }}
          >
            RÉCUPÉRER {rewardTDC} HEX Coin →
          </motion.button>

          {/* Next milestone teaser */}
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {streakDays < 7 && `Encore ${7 - streakDays} jours → Bonus semaine : 100 HEX Coin`}
            {streakDays >= 7 && streakDays < 30 && `Encore ${30 - streakDays} jours → Bonus mois : 500 HEX Coin`}
            {streakDays >= 30 && streakDays < 100 && `Encore ${100 - streakDays} jours → Bonus 100 jours : 3000 HEX Coin`}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Daily Spin Wheel ─────────────────────────────────────────────────────────

const WHEEL_SEGMENTS = [
  { label: '+25 HEX Coin',      color: 'rgba(26,42,58,0.25)', tier: 'common'    },
  { label: '+50 HEX Coin',      color: 'rgba(26,42,58,0.25)', tier: 'common'    },
  { label: '4h Shield',    color: 'rgba(26,42,58,0.25)', tier: 'common'    },
  { label: '+80 HEX Coin',      color: '#1F2937', tier: 'rare'      },
  { label: '+150 HEX Coin',     color: '#1F2937', tier: 'rare'      },
  { label: '8h Shield',    color: '#1F2937', tier: 'rare'      },
  { label: '+500 HEX Coin',     color: '#1D3A5F', tier: 'epic'      },
  { label: 'Mil Boost ×2', color: '#1D3A5F', tier: 'epic'      },
  { label: '+2000 HEX Coin 🎉', color: '#2D1B00', tier: 'legendary' },
]

export function DailySpin({
  reward,
  onClaim,
}: {
  reward: { tier: string; description: string; value: number }
  onClaim: () => void
}) {
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)
  const [rotation, setRotation] = useState(0)

  const tierColors = {
    common: '#6B7280',
    rare: '#3B82F6',
    epic: '#8B5CF6',
    legendary: '#cc8800',
  }
  const tierColor = tierColors[reward.tier as keyof typeof tierColors] ?? '#6B7280'

  const spin = () => {
    if (spinning || done) return
    setSpinning(true)
    const spins = 5 + Math.random() * 3
    const finalAngle = spins * 360 + Math.random() * 360
    setRotation(finalAngle)
    setTimeout(() => {
      setSpinning(false)
      setDone(true)
    }, 3000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(8px)', padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 360, textAlign: 'center',
        background: 'rgba(10,10,20,0.99)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '28px 24px',
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '2px', color: '#1a2a3a', marginBottom: 4 }}>
          RÉCOMPENSE DU JOUR
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
          Connexion quotidienne — tourne la roue !
        </div>

        {/* Wheel */}
        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 24px' }}>
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 3, ease: [0.17, 0.67, 0.15, 0.99] }}
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.1)',
              background: `conic-gradient(${WHEEL_SEGMENTS.map((s, i) =>
                `${s.color} ${(i / WHEEL_SEGMENTS.length) * 100}% ${((i + 1) / WHEEL_SEGMENTS.length) * 100}%`
              ).join(', ')})`,
              cursor: done ? 'default' : 'pointer',
            }}
            onClick={!done ? spin : undefined}
          />
          {/* Center */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 50, height: 50, borderRadius: '50%',
            background: '#050508', border: '2px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            {spinning ? '⚡' : done ? '✓' : '▶'}
          </div>
          {/* Pointer */}
          <div style={{
            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderTop: '20px solid #FFB800',
          }} />
        </div>

        {!done ? (
          <button onClick={spin} disabled={spinning} style={{
            width: '100%', padding: '14px',
            background: spinning ? 'rgba(255,255,255,0.1)' : '#00884a',
            border: 'none', borderRadius: 10,
            color: spinning ? 'rgba(255,255,255,0.4)' : '#000',
            fontSize: 15, fontWeight: 700, cursor: spinning ? 'wait' : 'pointer',
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
          }}>
            {spinning ? 'SPINNING...' : 'TOURNER LA ROUE !'}
          </button>
        ) : (
          <div>
            <div style={{
              padding: '16px', marginBottom: 12,
              background: `${tierColor}18`,
              border: `1px solid ${tierColor}40`,
              borderRadius: 10,
            }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: `${tierColor}80`, letterSpacing: '0.1em', marginBottom: 4 }}>
                {reward.tier.toUpperCase()} REWARD
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 26, letterSpacing: '2px',
                color: tierColor,
              }}>
                {reward.description}
              </div>
            </div>
            <button onClick={onClaim} style={{
              width: '100%', padding: '14px',
              background: '#0099cc', border: 'none', borderRadius: 10,
              color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
            }}>
              RÉCUPÉRER →
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
