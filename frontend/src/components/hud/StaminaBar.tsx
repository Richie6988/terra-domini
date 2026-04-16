/**
 * StaminaBar — Action slots system.
 * Shows attack slots: filled = available, draining = in-use, empty = exhausted.
 * Each slot takes 24h / max_slots to regenerate (faster with bonuses).
 * Displayed permanently in the top HUD.
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { EmojiIcon } from '../shared/emojiIcons'

type StaminaData = {
  slots_max: number
  slots_used: number
  slots_available: number
  next_slot_in_seconds: number
  regen_progress_pct: number
  regen_seconds_per_slot: number
  regen_bonus_pct: number
  attack_power_bonus: number
}

function fmt(seconds: number): string {
  if (seconds <= 0) return 'Ready'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// Single slot icon
function Slot({ state, progress, delay }: { state: 'full' | 'regen' | 'empty'; progress: number; delay: number }) {
  const colors = {
    full:  { bg: 'rgba(239,68,68,0.9)',  border: '#EF4444', glow: '0 0 10px #EF444480' },
    regen: { bg: 'rgba(245,158,11,0.3)', border: '#F59E0B', glow: '0 0 6px #F59E0B40' },
    empty: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)', glow: 'none' },
  }
  const c = colors[state]

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: delay * 0.05, type: 'spring', stiffness: 400 }}
      style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}
    >
      {/* Slot background */}
      <div style={{
        width: '100%', height: '100%', borderRadius: 4,
        background: c.bg, border: `1px solid ${c.border}`,
        boxShadow: c.glow,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Regen fill animation */}
        {state === 'regen' && (
          <motion.div
            initial={{ height: '0%' }}
            animate={{ height: `${progress}%` }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(245,158,11,0.5)',
            }}
          />
        )}
        {/* Sword icon for full slots */}
        {state === 'full' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}><EmojiIcon emoji="⚔" /></div>
        )}
      </div>
    </motion.div>
  )
}

export function StaminaBar() {
  const player = usePlayer()
  const [showTooltip, setShowTooltip] = useState(false)
  const [localSeconds, setLocalSeconds] = useState(0)
  const [localProgress, setLocalProgress] = useState(0)

  const { data: stamina, refetch } = useQuery<StaminaData>({
    queryKey: ['stamina'],
    queryFn: () => api.get('/players/stamina/').then(r => r.data),
    refetchInterval: 60000,
    staleTime: 55000,
    enabled: !!player,
  })

  // Live countdown timer
  useEffect(() => {
    if (!stamina) return
    setLocalSeconds(stamina.next_slot_in_seconds)
    setLocalProgress(stamina.regen_progress_pct)

    const id = setInterval(() => {
      setLocalSeconds(s => {
        const next = Math.max(0, s - 1)
        if (next === 0) refetch()
        return next
      })
      setLocalProgress(p => {
        const totalSecs = stamina.regen_seconds_per_slot
        const increment = totalSecs > 0 ? (100 / totalSecs) : 0
        return Math.min(100, p + increment)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [stamina?.next_slot_in_seconds, stamina?.regen_progress_pct])

  if (!stamina || !player) return null

  const { slots_max, slots_used, slots_available } = stamina

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}>

      {/* Compact slot row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'default' }}>
        {Array.from({ length: slots_max }).map((_, i) => {
          const isUsed   = i >= slots_available
          const isRegen  = isUsed && i === slots_available  // first draining slot
          return (
            <Slot
              key={i}
              state={isUsed ? (isRegen ? 'regen' : 'empty') : 'full'}
              progress={isRegen ? localProgress : 0}
              delay={i}
            />
          )
        })}
        {/* Next ready label */}
        {slots_used > 0 && (
          <span style={{ fontSize: 9, color: '#F59E0B', fontFamily: 'monospace', marginLeft: 4, whiteSpace: 'nowrap' }}>
            {localSeconds > 0 ? `+1 in ${fmt(localSeconds)}` : 'READY'}
          </span>
        )}
      </div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              marginTop: 8, zIndex: 9999, pointerEvents: 'none',
              background: 'rgba(13,27,42,0.97)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '12px 14px', minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 8 }}><EmojiIcon emoji="⚔" /> Action Slots</div>

            {/* Slots breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.04)' }}>Available</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: slots_available > 0 ? '#00884a' : '#EF4444' }}>
                {slots_available} / {slots_max}
              </span>
            </div>

            {/* Regen progress bar */}
            {slots_used > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Next slot in</span>
                  <span style={{ fontSize: 10, color: '#F59E0B', fontFamily: 'monospace', fontWeight: 700 }}>
                    {fmt(localSeconds)}
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${localProgress}%` }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #F59E0B, #EF4444)', borderRadius: 2 }}
                  />
                </div>
              </div>
            )}

            {/* Regen time */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                ⏱ Regen: {fmt(stamina.regen_seconds_per_slot)} per slot
                {stamina.regen_bonus_pct > 0 && (
                  <span style={{ color: '#00884a' }}> (+{stamina.regen_bonus_pct}% bonus)</span>
                )}
              </div>
              {stamina.attack_power_bonus > 0 && (
                <div style={{ fontSize: 10, color: '#FFB800' }}>
                  <EmojiIcon emoji="⚔" /> Attack power +{stamina.attack_power_bonus}%
                </div>
              )}
            </div>

            {/* How to get more */}
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                <EmojiIcon emoji="🎯" /> Win clicker daily → faster regen<br />
                <EmojiIcon emoji="🏆" /> Control Towers → extra slots<br />
                <EmojiIcon emoji="💎" /> HEX staking → attack power bonus
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
