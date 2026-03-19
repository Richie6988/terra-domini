/**
 * Interactive Onboarding Tutorial — 5 forced steps, &lt;90 seconds
 * Mandated by: UX Agent (Fatou persona = total novice, Yasmine = busy)
 *
 * Step 1: Welcome + GPS center map
 * Step 2: Explain zones (not "hexagons")
 * Step 3: Claim first zone (forced click)
 * Step 4: Watch resources tick (dopamine moment)
 * Step 5: Reveal coins (TDC) earned, CTA to explore
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { territoryApi } from '../../services/api'
import { useStore } from '../../store'
import { latLngToCell } from 'h3-js'

// ─── Tutorial Store ───────────────────────────────────────────────────────────

interface TutorialState {
  isActive: boolean
  currentStep: number
  completedSteps: number[]
  firstH3: string | null
  hasCompleted: boolean
}

const TUTORIAL_STORAGE_KEY = 'td_tutorial_v1'

function loadTutorialState(): TutorialState {
  try {
    const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { isActive: true, currentStep: 0, completedSteps: [], firstH3: null, hasCompleted: false }
}

function saveTutorialState(state: TutorialState) {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state))
}

// ─── Hint Library ─────────────────────────────────────────────────────────────

export interface HintDef {
  id: string
  title: string
  body: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export const HINTS: Record<string, HintDef> = {
  // Map elements
  'hex-unclaimed': {
    id: 'hex-unclaimed', title: 'Empty Zone',
    body: 'This area belongs to nobody yet. Tap it to claim it as yours! You\'ll start earning Coins immediately.',
  },
  'hex-mine': {
    id: 'hex-mine', title: 'Your Zone ✓',
    body: 'You own this! It earns Coins and resources every 5 minutes — even while you\'re offline.',
  },
  'hex-enemy': {
    id: 'hex-enemy', title: 'Enemy Territory',
    body: 'This belongs to another player. You can attack it to capture it — but wait until you have enough army units.',
  },
  'hex-tower': {
    id: 'hex-tower', title: '🗼 Control Tower',
    body: 'This is a strategic landmark. 3× resource bonus for whoever controls it. Alliances fight for these daily.',
  },
  // HUD
  'tdc-balance': {
    id: 'tdc-balance', title: '🪙 Your Coins (TDC)',
    body: 'TDC are your in-game currency — but they\'re also real crypto! Earn them by owning territories, win battles, and from brand ads shown on your land.',
  },
  'territory-count': {
    id: 'territory-count', title: 'Your Zones',
    body: 'The more zones you own, the more you earn. Start small — claim zones near you first, then expand.',
  },
  // Territory panel
  'defense-bar': {
    id: 'defense-bar', title: 'Defense Level',
    body: 'Higher defense means attackers need more army to beat you. Build a Fort (🏰) to increase it.',
  },
  'production-rates': {
    id: 'production-rates', title: 'What You Earn Here',
    body: 'These are the resources this zone generates every 5 minutes. Urban zones earn Credits. Rural zones grow Food. Build matching buildings to increase output.',
  },
  'ad-revenue': {
    id: 'ad-revenue', title: '📢 Ad Revenue',
    body: 'Brands pay to show ads on popular zones. The more players see your territory, the more TDC you earn. Famous landmarks earn the most!',
  },
  // Combat
  'attack-button': {
    id: 'attack-button', title: '⚔️ Attack',
    body: 'Send army units to capture this zone. The battle takes 4-72 hours. If you win, the zone is yours! You can join an Alliance for coordinated attacks.',
  },
  'battle-timer': {
    id: 'battle-timer', title: 'Battle Timer',
    body: 'Battles aren\'t instant — they take real time. Come back when the timer ends to see the result. You\'ll get a notification!',
  },
  // Alliance
  'alliance-squad': {
    id: 'alliance-squad', title: '👥 Squad (5 players)',
    body: 'A Squad is the smallest alliance — 5 players. Form one with friends to coordinate attacks and share a treasury.',
  },
  // Economy
  'shield-item': {
    id: 'shield-item', title: '🛡️ Territory Shield',
    body: 'A Shield protects your zone from attacks for 6-12 hours. Max 12h of protection per day — so plan wisely!',
  },
  // POI
  'poi-crisis': {
    id: 'poi-crisis', title: '🔥 World Event',
    body: 'A real-world event is affecting this region! The game reflects what\'s happening globally — resource production and battle conditions change.',
  },
}

// ─── Hint Tooltip Component ───────────────────────────────────────────────────

interface HintTooltipProps {
  hintId: string
  children: React.ReactNode
  forceShow?: boolean
}

const SEEN_HINTS_KEY = 'td_seen_hints'

function getSeenHints(): Set<string> {
  try {
    const stored = localStorage.getItem(SEEN_HINTS_KEY)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch { return new Set() }
}

function markHintSeen(id: string) {
  const seen = getSeenHints()
  seen.add(id)
  localStorage.setItem(SEEN_HINTS_KEY, JSON.stringify([...seen]))
}

export function HintTooltip({ hintId, children, forceShow = false }: HintTooltipProps) {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const hint = HINTS[hintId]

  useEffect(() => {
    if (!hint || dismissed) return
    const seen = getSeenHints()
    if (!seen.has(hintId) || forceShow) {
      const timer = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(timer)
    }
  }, [hintId, forceShow, dismissed])

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShow(false)
    setDismissed(true)
    markHintSeen(hintId)
  }

  if (!hint) return <>{children}</>

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <AnimatePresence>
        {show && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            style={{
              position: 'absolute', bottom: '100%', left: '50%',
              transform: 'translateX(-50%)', marginBottom: 8,
              zIndex: 9999, width: 240,
              background: 'rgba(10,10,20,0.97)',
              border: '1px solid rgba(0,255,135,0.3)',
              borderRadius: 8, padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,135,0.1)',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(0,255,135,0.3)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#00FF87' }}>{hint.title}</div>
              <button onClick={dismiss} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 8px',
              }}>×</button>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{hint.body}</div>
            <button onClick={dismiss} style={{
              marginTop: 8, fontSize: 10, color: 'rgba(0,255,135,0.6)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'monospace', letterSpacing: '0.05em',
            }}>Got it →</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Tutorial Component ──────────────────────────────────────────────────

interface TutorialStep {
  id: number
  title: string
  emoji: string
  body: string
  action: string        // Button label
  hint?: string         // Optional hint key
  requiresGPS?: boolean
  requiresClaim?: boolean
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 0,
    emoji: '🌍',
    title: 'Welcome to Terra Domini',
    body: 'The real world is your game board. Claim zones near you. Build an empire. Earn real Coins from brand ads on your land.',
    action: 'Start Playing →',
    requiresGPS: true,
  },
  {
    id: 1,
    emoji: '🔲',
    title: 'Zones are your currency',
    body: 'The map is divided into hexagonal zones. Each zone earns resources every 5 minutes. Unclaimed zones (grey) are free — tap one to make it yours!',
    action: 'Got it →',
    hint: 'hex-unclaimed',
  },
  {
    id: 2,
    emoji: '🏴',
    title: 'Claim your first zone!',
    body: 'Tap any grey zone on the map, then press "Claim Zone". It\'s yours immediately. Go ahead!',
    action: 'I claimed my first zone! ✓',
    requiresClaim: true,
  },
  {
    id: 3,
    emoji: '⚡',
    title: 'You\'re already earning!',
    body: 'Your zone earns resources every 5 minutes — even when you\'re asleep. The more zones you own, the more you earn.',
    action: 'What are Coins? →',
    hint: 'production-rates',
  },
  {
    id: 4,
    emoji: '🪙',
    title: 'Coins = Real Crypto',
    body: 'TDC Coins are your reward. Brands pay to show ads on popular zones. You receive 70% of that revenue as Coins — which are tradeable on the Polygon blockchain.',
    action: '🚀 Start Exploring!',
    hint: 'tdc-balance',
  },
]

interface OnboardingTutorialProps {
  onComplete: () => void
  onMapCenter?: (lat: number, lon: number) => void
}

export function OnboardingTutorial({ onComplete, onMapCenter }: OnboardingTutorialProps) {
  const [state, setState] = useState<TutorialState>(loadTutorialState)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [claimWaiting, setClaimWaiting] = useState(false)
  const player = useStore(s => s.player)

  // Check if tutorial should run
  useEffect(() => {
    const stored = loadTutorialState()
    if (stored.hasCompleted) {
      onComplete()
    }
  }, [])

  const currentStep = TUTORIAL_STEPS[state.currentStep]

  const advanceStep = useCallback(() => {
    const nextStep = state.currentStep + 1
    if (nextStep >= TUTORIAL_STEPS.length) {
      // Complete tutorial
      const finalState = { ...state, hasCompleted: true, isActive: false }
      saveTutorialState(finalState)
      onComplete()

      // Grant tutorial completion reward
      if (player) {
        // Trigger 100 TDC reward via backend
        fetch('/api/progression/tutorial-complete/', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${useStore.getState().accessToken}` }
        }).catch(() => {})
      }
      return
    }

    const newState = {
      ...state,
      currentStep: nextStep,
      completedSteps: [...state.completedSteps, state.currentStep],
    }
    setState(newState)
    saveTutorialState(newState)
  }, [state, player, onComplete])

  const handleGPS = useCallback(() => {
    setGpsLoading(true)
    setGpsError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        onMapCenter?.(pos.coords.latitude, pos.coords.longitude)
        advanceStep()
      },
      (err) => {
        setGpsLoading(false)
        setGpsError('Location access denied. We\'ll use Paris as default.')
        // Default to Paris
        onMapCenter?.(48.8566, 2.3522)
        setTimeout(advanceStep, 1500)
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }, [advanceStep, onMapCenter])

  const handleAction = useCallback(() => {
    if (currentStep.requiresGPS) {
      handleGPS()
      return
    }
    if (currentStep.requiresClaim) {
      setClaimWaiting(true)
      // Check if player has claimed any territory
      const checkClaimed = setInterval(() => {
        const myTerritories = useStore.getState().myTerritories
        if (myTerritories.size > 0) {
          clearInterval(checkClaimed)
          setClaimWaiting(false)
          advanceStep()
        }
      }, 2000)
      // Timeout fallback after 60s
      setTimeout(() => {
        clearInterval(checkClaimed)
        setClaimWaiting(false)
        advanceStep()
      }, 60000)
      return
    }
    advanceStep()
  }, [currentStep, advanceStep, handleGPS])

  if (!state.isActive || state.hasCompleted) return null

  const progress = ((state.currentStep) / TUTORIAL_STEPS.length) * 100

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          pointerEvents: claimWaiting ? 'none' : 'auto',
          background: claimWaiting ? 'transparent' : 'rgba(5,5,8,0.92)',
          backdropFilter: claimWaiting ? 'none' : 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 16px 32px',
        }}
      >
        {/* Click-through overlay — allows map interaction */}
        {claimWaiting && (
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,135,0.04)', pointerEvents: 'none' }}
          />
        )}

        <motion.div
          key={state.currentStep}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          style={{
            width: '100%', maxWidth: 480,
            background: 'rgba(10,10,20,0.99)',
              pointerEvents: 'auto',
            border: '1px solid rgba(0,255,135,0.25)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 -4px 40px rgba(0,255,135,0.1), 0 0 0 1px rgba(0,255,135,0.1)',
          }}
        >
          {/* Progress bar */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              initial={{ width: `${(state.currentStep / TUTORIAL_STEPS.length) * 100}%` }}
              animate={{ width: `${progress}%` }}
              style={{ height: '100%', background: 'var(--g, #00FF87)', borderRadius: 2 }}
            />
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0 0' }}>
            {TUTORIAL_STEPS.map((s, i) => (
              <div key={i} style={{
                width: i === state.currentStep ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i < state.currentStep
                  ? '#00FF87'
                  : i === state.currentStep
                  ? '#00FF87'
                  : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: '20px 28px 28px' }}>
            <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>{currentStep.emoji}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28, letterSpacing: '1px', color: '#fff',
              textAlign: 'center', marginBottom: 12,
            }}>{currentStep.title}</div>
            <div style={{
              fontSize: 15, color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.7, textAlign: 'center', marginBottom: 24,
            }}>{currentStep.body}</div>

            {/* GPS error */}
            {gpsError && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: 'rgba(255,184,0,0.08)',
                border: '1px solid rgba(255,184,0,0.2)',
                borderRadius: 6, fontSize: 12, color: '#F59E0B', textAlign: 'center',
              }}>
                {gpsError}
              </div>
            )}

            {/* Claim waiting indicator */}
            {claimWaiting && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  marginBottom: 16, padding: '10px',
                  background: 'rgba(0,255,135,0.08)',
                  border: '1px solid rgba(0,255,135,0.2)',
                  borderRadius: 8, fontSize: 13, color: '#00FF87', textAlign: 'center',
                }}
              >
                👆 Tap any grey zone on the map → then tap "Claim Zone"
              </motion.div>
            )}

            {/* Action button */}
            {!claimWaiting && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAction}
                disabled={gpsLoading}
                style={{
                  width: '100%', padding: '16px',
                  background: '#00FF87', border: 'none', borderRadius: 10,
                  color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
                  opacity: gpsLoading ? 0.7 : 1,
                }}
              >
                {gpsLoading ? '📍 Finding your location…' : currentStep.action}
              </motion.button>
            )}

            {/* Skip option (only for non-critical steps) */}
            {state.currentStep > 1 && !claimWaiting && (
              <button
                onClick={onComplete}
                style={{
                  width: '100%', marginTop: 8, padding: '8px',
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.2)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'monospace',
                }}
              >
                Skip tutorial
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Hint Manager — persistent contextual hints for first 7 days ──────────────

interface HintManagerProps {
  children: React.ReactNode
}

export function HintManager({ children }: HintManagerProps) {
  const player = useStore(s => s.player)

  // Only show hints for players in first 7 days
  const isNewPlayer = player
    ? (Date.now() - new Date(player.date_joined).getTime()) < 7 * 24 * 3600 * 1000
    : false

  if (!isNewPlayer) return <>{children}</>

  return (
    <div className="hint-manager" data-new-player="true">
      {children}
    </div>
  )
}

// ─── "While You Were Away" Digest ─────────────────────────────────────────────

interface DigestItem {
  icon: string
  text: string
  value?: string
  color?: string
}

interface WakeUpDigestProps {
  offlineHours: number
  resources: { energy: number; food: number; credits: number; materials: number }
  battles: Array<{ territory: string; won: boolean; resources?: number }>
  newTDC: number
  onDismiss: () => void
}

export function WakeUpDigest({ offlineHours, resources, battles, newTDC, onDismiss }: WakeUpDigestProps) {
  const totalResources = Object.values(resources).reduce((a, b) => a + b, 0)

  const items: DigestItem[] = [
    { icon: '⏰', text: `You were away for ${Math.round(offlineHours)} hours`, color: 'rgba(255,255,255,0.4)' },
    { icon: '⚙️', text: 'Resources accumulated (40% offline rate)', value: `+${totalResources.toLocaleString()}`, color: '#10B981' },
    ...(newTDC > 0 ? [{ icon: '🪙', text: 'Ad revenue earned while offline', value: `+${parseFloat(String(newTDC ?? 0)).toFixed(0)} TDC`, color: '#FFB800' }] : []),
    ...battles.map(b => ({
      icon: b.won ? '🏆' : '💀',
      text: b.won ? `Battle won: captured ${b.territory}` : `Defense failed: lost ${b.territory}`,
      value: b.won && b.resources ? `+${b.resources} resources` : undefined,
      color: b.won ? '#10B981' : '#EF4444',
    })),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,5,8,0.88)', backdropFilter: 'blur(8px)',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(10,10,20,0.99)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          padding: '24px 24px 16px',
          background: 'rgba(0,255,135,0.06)',
          borderBottom: '1px solid rgba(0,255,135,0.15)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌅</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 26, letterSpacing: '1px', color: '#fff',
          }}>
            WHILE YOU WERE AWAY
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            Your empire didn't stop working
          </div>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: item.color || 'rgba(255,255,255,0.5)' }}>{item.text}</span>
              </div>
              {item.value && (
                <span style={{
                  fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
                  color: item.color || '#fff', flexShrink: 0, marginLeft: 8,
                }}>
                  {item.value}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onDismiss}
            style={{
              width: '100%', padding: '14px',
              background: '#00FF87', border: 'none', borderRadius: 10,
              color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
            }}
          >
            Resume Command →
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default OnboardingTutorial
