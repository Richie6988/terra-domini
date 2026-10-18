/**
 * Interactive Onboarding Tutorial — 5 forced steps, &lt;90 seconds
 * Mandated by: UX Agent (Fatou persona = total novice, Yasmine = busy)
 *
 * Step 1: Welcome + GPS center map
 * Step 2: Explain zones (not "hexagons")
 * Step 3: Claim first zone (forced click)
 * Step 4: Watch resources tick (dopamine moment)
 * Step 5: Reveal coins (HEX Coin) earned, CTA to explore
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { territoryApi } from '../../services/api'
import { useStore } from '../../store'
import { latLngToCell } from 'h3-js'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'
import { ChevronRight } from 'lucide-react'
import { useLoopStatus, useLoopActions } from '../shared/SessionLoop'
import { useQueryClient } from '@tanstack/react-query'

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
    id: 'hex-mine', title: 'Your Zone',
    body: 'You own this! It earns Coins and resources every 5 minutes — even while you\'re offline.',
  },
  'hex-enemy': {
    id: 'hex-enemy', title: 'Enemy Territory',
    body: 'This belongs to another player. You can attack it to capture it — but wait until you have enough army units.',
  },
  'hex-tower': {
    id: 'hex-tower', title: 'Control Tower',
    body: 'This is a strategic landmark. 3× resource bonus for whoever controls it. Alliances fight for these daily.',
  },
  // HUD
  'tdc-balance': {
    id: 'tdc-balance', title: 'Your Coins (HEX Coin)',
    body: 'HEX Coin are your in-game currency — but they\'re also real crypto! Earn them by owning territories, win battles, and from brand ads shown on your land.',
  },
  'territory-count': {
    id: 'territory-count', title: 'Your Zones',
    body: 'The more zones you own, the more you earn. Start small — claim zones near you first, then expand.',
  },
  // Territory panel
  'defense-bar': {
    id: 'defense-bar', title: 'Defense Level',
    body: 'Higher defense means attackers need more army to beat you. Build a Fort to increase it.',
  },
  'production-rates': {
    id: 'production-rates', title: 'What You Earn Here',
    body: 'These are the resources this zone generates every 5 minutes. Urban zones earn Credits. Rural zones grow Food. Build matching buildings to increase output.',
  },
  'ad-revenue': {
    id: 'ad-revenue', title: 'Ad Revenue',
    body: 'Brands pay to show ads on popular zones. The more players see your territory, the more HEX Coin you earn. Famous landmarks earn the most!',
  },
  // Combat
  'attack-button': {
    id: 'attack-button', title: 'Attack',
    body: 'Send army units to capture this zone. The battle takes 4-72 hours. If you win, the zone is yours! You can join an Alliance for coordinated attacks.',
  },
  'battle-timer': {
    id: 'battle-timer', title: 'Battle Timer',
    body: 'Battles aren\'t instant — they take real time. Come back when the timer ends to see the result. You\'ll get a notification!',
  },
  // Alliance
  'alliance-squad': {
    id: 'alliance-squad', title: 'Squad (5 players)',
    body: 'A Squad is the smallest alliance — 5 players. Form one with friends to coordinate attacks and share a treasury.',
  },
  // Economy
  'shield-item': {
    id: 'shield-item', title: 'Territory Shield',
    body: 'A Shield protects your zone from attacks for 6-12 hours. Max 12h of protection per day — so plan wisely!',
  },
  // POI
  'poi-crisis': {
    id: 'poi-crisis', title: 'World Event',
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
              background: 'linear-gradient(180deg, #2f5fd0, #1e3c8f)',
              border: '3px solid #0f2266',
              borderRadius: 16, padding: '12px 14px',
              boxShadow: '0 5px 0 #0f2266',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #0f2266',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 16, color: '#ffd23f', fontFamily: 'var(--font-heading)', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>{hint.title}</div>
              <button onClick={dismiss} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 8px',
              }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#e3eeff', fontWeight: 600, lineHeight: 1.5, textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>{hint.body}</div>
            <button onClick={dismiss} style={{
              marginTop: 8, fontSize: 14, color: '#ffd23f', minHeight: 28,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', letterSpacing: 0.5,
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
    emoji: 'grid_globe',
    title: 'Welcome to HEXOD',
    body: 'The real-world map is your game board. Claim zones, build your empire and earn HEX Coin.',
    action: "Let's go",
    requiresGPS: true,
  },
  {
    id: 1,
    emoji: 'sparkles',
    title: 'Glowing zones are special',
    body: 'Every spot on the map is a zone. Empty ground is free to take, red zones belong to other players, and glowing zones are rare places that yield more.',
    action: 'Got it',
    hint: 'hex-unclaimed',
  },
  {
    id: 2,
    emoji: 'flag_red',
    title: 'Claim your first zone!',
    body: 'Tap any empty spot on the map, then press FREE CLAIM. Your first zone costs nothing and is yours immediately.',
    action: 'Claim my first zone',
    requiresClaim: true,
  },
  {
    id: 3,
    emoji: 'lightning',
    title: "Your zone is producing HEX!",
    body: 'It fills your HARVEST stock, even while you are away. Come back and tap HARVEST to collect. The stock holds 8 hours of production, so check in a few times a day.',
    action: "What's next?",
    hint: 'production-rates',
  },
  {
    id: 4,
    emoji: 'daily_task',
    title: 'Your daily missions await',
    body: 'Every day, 3 missions tell you what to do next and pay HEX. Tap the MISSIONS button to see them and claim your rewards.',
    action: 'Show my missions',
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
  const qc = useQueryClient()

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
      // Last step CTA = "Show my missions": land the player on their daily roadmap
      import('./OnboardingHotspots').then(m => m.hideHotspots())
      // +100 HEX tutorial reward is granted server-side: refresh the HUD balance shortly after
      setTimeout(() => qc.invalidateQueries({ queryKey: ['loop-status'] }), 1500)
      useStore.getState().setActivePanel('tasks' as any)

      // Grant tutorial completion reward
      if (player) {
        // Trigger 100 HEX Coin reward via backend
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
    setGpsError('')

    // Step 4 → show the interface hotspots
    if (nextStep === 4) {
      setTimeout(() => {
        import('./OnboardingHotspots').then(m => m.showTutorialHotspots())
      }, 600)
    }
  }, [state, player, onComplete, qc])

  const handleGPS = useCallback(() => {
    setGpsLoading(true)
    setGpsError('')
    let settled = false
    const fallback = (msg: string) => {
      if (settled) return
      settled = true
      setGpsLoading(false)
      setGpsError(msg)
      setTimeout(advanceStep, 1200)
    }
    // The browser never answers while its permission prompt is ignored — don't leave the player stuck
    const guard = setTimeout(() => fallback('No location yet — starting near you based on your connection.'), 6000)
    if (!navigator.geolocation) { clearTimeout(guard); fallback('Location unavailable — starting near you based on your connection.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return
        settled = true
        clearTimeout(guard)
        setGpsLoading(false)
        onMapCenter?.(pos.coords.latitude, pos.coords.longitude)
        advanceStep()
      },
      () => { clearTimeout(guard); fallback('Location off — starting near you based on your connection.') },
      { timeout: 8000, maximumAge: 60000 }
    )
  }, [advanceStep, onMapCenter])

  // Claim step: wait for a real claim (never auto-advance on a timer — that would lie "you're earning")
  const claimTimers = useRef<number[]>([])
  useEffect(() => () => { claimTimers.current.forEach(id => { clearInterval(id); clearTimeout(id) }) }, [])
  useEffect(() => {
    if (!claimWaiting) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setClaimWaiting(false)
      window.dispatchEvent(new CustomEvent('hexod:tutorial:hide-arrow'))
      advanceStep()
    }
    // Let the claim celebration play before the next card covers it
    const onCelebrated = () => finish()
    window.addEventListener('hexod:claim-celebrated', onCelebrated)
    const poll = window.setInterval(() => {
      const mine = useStore.getState().myTerritories
      if (mine && mine.size > 0 && !done) {
        clearInterval(poll)
        claimTimers.current.push(window.setTimeout(finish, 7000))   // fallback if no celebration event
      }
    }, 1000)
    claimTimers.current.push(poll)
    return () => { clearInterval(poll); window.removeEventListener('hexod:claim-celebrated', onCelebrated) }
  }, [claimWaiting, advanceStep])

  const handleAction = useCallback(() => {
    if (currentStep.requiresGPS) {
      handleGPS()
      return
    }
    if (currentStep.requiresClaim) {
      setClaimWaiting(true)
      // Fetch nearest unclaimed POI and dispatch event so map can show arrow
      fetch('/api/geoip/').then(r => r.json()).then(loc => {
        window.dispatchEvent(new CustomEvent('hexod:tutorial:show-arrow', {
          detail: { lat: loc.lat, lon: loc.lon }
        }))
      }).catch(() => {})
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
          background: claimWaiting ? 'transparent' : 'rgba(10,24,70,0.72)',
          backdropFilter: claimWaiting ? 'none' : 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textTransform: 'none',
        }}
      >
        {/* Claim waiting: NO overlay at all — just a small floating pill at bottom */}
        {claimWaiting && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
              // below the top HUD; on phones also below the MISSIONS button (top-left column)
              position: 'fixed', top: typeof window !== 'undefined' && window.innerWidth < 600 ? 172 : 96, left: 0, right: 0, margin: '0 auto',
              width: 'fit-content', maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
              zIndex: 10001, pointerEvents: 'auto',
              padding: '10px 12px 10px 18px', borderRadius: 40,
              background: 'linear-gradient(180deg, #3b6fe0, #2148b0)',
              border: '3px solid #0f2266',
              boxShadow: '0 5px 0 #0f2266',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ display: 'flex' }}><IconSVG id="target" size={22} /></motion.span>
            <span style={{ fontSize: 15, lineHeight: 1.2, color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: 0.5, textTransform: 'uppercase', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>
              Tap an empty spot, then FREE CLAIM
            </span>
            <button onClick={onComplete} style={{
              background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)',
              borderRadius: 12, padding: '8px 14px', minHeight: 36, color: '#fff',
              fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-heading)', letterSpacing: 0.5,
            }}>SKIP</button>
          </motion.div>
        )}

        <motion.div
          key={state.currentStep}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          style={{
            display: claimWaiting ? 'none' : undefined,
            width: '100%',
            maxWidth: 440,
            background: 'linear-gradient(180deg, #2f5fd0 0%, #1e3c8f 100%)',
            pointerEvents: 'auto',
            border: '3px solid #0f2266',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 8px 0 #0f2266, 0 20px 40px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.2)',
          }}
        >
          {/* Illustration */}
          <div style={{
            position: 'relative', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 60%, #8fd3ff 0%, #4fa6f5 45%, #3a7fe0 100%)',
            borderBottom: '3px solid #0f2266',
          }}>
            <svg width="132" height="132" viewBox="0 0 100 100" style={{ position: 'absolute', opacity: 0.55 }} aria-hidden>
              <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeLinejoin="round" />
            </svg>
            <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              style={{ filter: 'drop-shadow(0 5px 0 rgba(15,34,102,0.55))' }}>
              <IconSVG id={currentStep.emoji} size={84} />
            </motion.div>
            <span style={{
              position: 'absolute', top: 12, left: 12, padding: '4px 12px', borderRadius: 12,
              background: '#ffd23f', border: '2px solid #7a3e00', boxShadow: '0 3px 0 #7a3e00',
              color: '#5a2d00', fontFamily: 'var(--font-heading)', fontSize: 14, letterSpacing: 0.5,
            }}>
              STEP {state.currentStep + 1} / {TUTORIAL_STEPS.length}
            </span>
          </div>

          <div style={{ padding: '18px 24px 20px' }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 400,
              fontSize: 28, letterSpacing: 0.5, color: '#fff', textTransform: 'uppercase',
              textShadow: '0 3px 0 rgba(0,0,0,0.45)',
              textAlign: 'center', marginBottom: 8, lineHeight: 1.15,
            }}>{currentStep.title}</div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: '#e3eeff', fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: 0, lineHeight: 1.55, textAlign: 'center', marginBottom: 18,
            }}>{currentStep.body}</div>

            {/* GPS error */}
            {gpsError && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: '#ffd23f',
                border: '2px solid #7a3e00',
                borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#5a2d00', textAlign: 'center',
                fontFamily: 'system-ui, sans-serif', letterSpacing: 0,
              }}>
                {gpsError}
              </div>
            )}

            {/* Action button */}
            <button
              className="btn-game btn-game-green"
              onClick={handleAction}
              disabled={gpsLoading}
              style={{
                width: '100%', minHeight: 56, fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 400, letterSpacing: 0.5,
                borderRadius: 16, border: '3px solid #064e3b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {gpsLoading ? 'Finding your location…' : currentStep.action}
              {!gpsLoading && <ChevronRight size={18} strokeWidth={3} />}
            </button>

            {/* Step dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }} aria-hidden>
              {TUTORIAL_STEPS.map((s, i) => (
                <div key={i} style={{
                  width: i === state.currentStep ? 26 : 12,
                  height: 12, borderRadius: 6,
                  background: i <= state.currentStep ? '#ffd23f' : 'rgba(255,255,255,0.25)',
                  border: `2px solid ${i <= state.currentStep ? '#7a3e00' : 'rgba(15,34,102,0.6)'}`,
                  opacity: i < state.currentStep ? 0.7 : 1,
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>

            {/* Skip option (only for non-critical steps) */}
            {state.currentStep > 1 && (
              <button
                onClick={onComplete}
                style={{
                  display: 'block', margin: '10px auto 0', padding: '8px 14px', minHeight: 36,
                  background: 'none', border: 'none',
                  color: '#dbe8ff', fontSize: 14, fontWeight: 700, textDecoration: 'underline',
                  cursor: 'pointer', fontFamily: 'system-ui, sans-serif', letterSpacing: 0,
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
  // Live harvest stock (source of truth) — nothing is credited while away, it waits in the stock
  const { data: loop } = useLoopStatus()
  const { collect } = useLoopActions()
  const pending = loop?.harvest?.pending ?? Math.round(newTDC || 0)
  const lost = loop?.harvest?.lost ?? 0
  const totalResources = Object.values(resources).reduce((a, b) => a + b, 0)
  const showResources = totalResources > 0 && Math.round(totalResources) !== Math.round(newTDC || 0)

  const h = Math.round(offlineHours)
  const items: DigestItem[] = [
    { icon: 'alarm', text: `You were away for ${h < 1 ? 'less than an hour' : h === 1 ? '1 hour' : `${h} hours`}`, color: '#dbe8ff' },
    ...(showResources ? [{ icon: 'box', text: 'Resources gathered while you were away', value: `+${totalResources.toLocaleString()}`, color: '#4ade80' }] : []),
    ...(pending > 0 ? [{ icon: 'wheat', text: loop?.harvest?.is_full ? 'Harvest stock is FULL' : 'HEX waiting in your harvest', value: `+${pending.toLocaleString()} HEX`, color: '#F59E0B' }] : []),
    ...(lost > 0 ? [{ icon: 'alarm', text: 'Lost — the stock was full', value: `-${lost.toLocaleString()} HEX`, color: '#fca5a5' }] : []),
    ...battles.map(b => ({
      icon: b.won ? 'trophy' : 'skull',
      text: b.won ? `Victory: ${b.territory} captured!` : `Defense failed: ${b.territory} lost`,
      value: b.won && b.resources ? `+${b.resources}` : undefined,
      color: b.won ? '#4ade80' : '#fca5a5',
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
        background: 'rgba(10,24,70,0.72)',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'linear-gradient(180deg, #2f5fd0 0%, #1e3c8f 100%)',
        border: '3px solid #0f2266',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 8px 0 #0f2266, 0 20px 40px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          padding: '24px 24px 16px',
          background: 'radial-gradient(circle at 50% 40%, #8fd3ff 0%, #3a7fe0 100%)',
          borderBottom: '3px solid #0f2266',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconSVG id="castle" size={48} /></div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 400,
            fontSize: 28, letterSpacing: 0.5, color: '#fff', textShadow: '0 3px 0 rgba(0,0,0,0.45)',
          }}>
            WHILE YOU WERE AWAY
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 6, textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>
            Your empire never stopped working
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
                borderBottom: i < items.length - 1 ? '2px solid rgba(255,255,255,0.1)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}><EmojiIcon emoji={item.icon} size={16} /></span>
                <span style={{ fontSize: 13, fontWeight: 600, color: item.color || '#dbe8ff', textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>{item.text}</span>
              </div>
              {item.value && (
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: 17,
                  color: item.color || '#fff', flexShrink: 0, marginLeft: 8,
                }}>
                  {item.value}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          <button className="btn-game btn-game-green" disabled={collect.isPending}
            onClick={() => { if (pending > 0) collect.mutate(undefined, { onSettled: onDismiss }); else onDismiss() }}
            style={{ width: '100%', minHeight: 54, fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 400, letterSpacing: 0.5, borderRadius: 16, border: '3px solid #064e3b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {pending > 0 ? `Collect +${pending.toLocaleString()} HEX` : 'Back to the map'} <ChevronRight size={18} strokeWidth={3} />
          </button>
          {lost > 0 && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#ffe3a3', fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
              Tip: turn on alerts so you know when your stock is full.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default OnboardingTutorial
