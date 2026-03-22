/**
 * Viral Moments Engine
 * Creates shareable, clip-worthy moments that players want to post on TikTok.
 *
 * Viral hooks built into gameplay:
 * 1. Control Tower capture ceremony — epic animation, shareable card
 * 2. Territory revenge notification — "Player attacked you. Attack back."
 * 3. "I own [Famous Landmark]" moment — triggered on famous hex claim
 * 4. Alliance war declaration — cinematic announcement
 * 5. Daily earnings reveal — satisfying number animation
 * 6. POI crisis alert — "The world just changed your empire"
 * 7. Rank-up ceremony — level up dopamine moment
 * 8. "Your street" moment — GPS-triggered local pride
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../../store'

// ─── Viral Moment Types ───────────────────────────────────────────────────────

export type ViralMomentType =
  | 'tower_capture'
  | 'famous_landmark_claimed'
  | 'revenge_notification'
  | 'alliance_war_declared'
  | 'daily_earnings_reveal'
  | 'poi_crisis_alert'
  | 'rank_up'
  | 'local_pride'
  | 'streak_milestone'
  | 'first_tdc_earned'

interface ViralMoment {
  id: string
  type: ViralMomentType
  title: string
  subtitle: string
  emoji: string
  accentColor: string
  shareText: string
  tiktokHook?: string   // First 2 seconds of the TikTok caption
  data: Record<string, unknown>
  expiresAt: number     // Unix timestamp
}

// ─── Viral Moment Definitions ─────────────────────────────────────────────────

export function buildViralMoment(type: ViralMomentType, data: Record<string, unknown>): ViralMoment {
  const id = `vm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const expiresAt = Date.now() + 300_000 // 5 min to share

  const configs: Record<ViralMomentType, Omit<ViralMoment, 'id' | 'type' | 'data' | 'expiresAt'>> = {
    tower_capture: {
      emoji: '🗼',
      accentColor: '#FFB800',
      title: `[${data.alliance_tag}] CAPTURES ${String(data.tower_name).toUpperCase()}`,
      subtitle: `${data.participants} players · ${data.duration_minutes}min battle`,
      shareText: `🗼 My alliance [${data.alliance_tag}] just captured ${data.tower_name} in Hexod! ${data.participants} players fought for ${data.duration_minutes} minutes. terradomini.io`,
      tiktokHook: `"${data.participants} joueurs pour 1 tour. Le verdict :"`,
    },
    famous_landmark_claimed: {
      emoji: data.emoji as string || '🏛️',
      accentColor: '#00FF87',
      title: `YOU OWN ${String(data.name).toUpperCase()}`,
      subtitle: `Estimated ad revenue: ~${data.daily_tdc_estimate} HEX Coin/day`,
      shareText: `🏛️ I just claimed ${data.name} in Hexod! Earning ~${data.daily_tdc_estimate} HEX Coin/day from brand ads. terradomini.io`,
      tiktokHook: `"J'ai acheté ${data.name} pour 0€. Voici ce que ça rapporte."`,
    },
    revenge_notification: {
      emoji: '⚔️',
      accentColor: '#FF3B30',
      title: `${String(data.attacker).toUpperCase()} ATTACKED YOU`,
      subtitle: `${data.territory_name} — Counter-attack window: ${data.hours_remaining}h`,
      shareText: `⚔️ ${data.attacker} attacked my ${data.territory_name} in Hexod. Counter-attack in progress. terradomini.io`,
      tiktokHook: `"${data.attacker} a attaqué ma zone. Voici ma vengeance :"`,
    },
    alliance_war_declared: {
      emoji: '🏰',
      accentColor: '#7B2FFF',
      title: `WAR DECLARED`,
      subtitle: `[${data.attacking_alliance}] → [${data.defending_alliance}]`,
      shareText: `🏰 War declared in Hexod! [${data.attacking_alliance}] vs [${data.defending_alliance}]. Sides being chosen now. terradomini.io`,
      tiktokHook: `"La guerre vient d'être déclarée. 2 alliances. Tout le monde choisit son camp."`,
    },
    daily_earnings_reveal: {
      emoji: '🪙',
      accentColor: '#FFB800',
      title: `+${data.tdc_earned} HEX Coin TODAY`,
      subtitle: `From ${data.territory_count} territories · ${data.top_territory} was #1`,
      shareText: `🪙 My Hexod territories earned ${data.tdc_earned} HEX Coin today (≈€${Number(data.tdc_earned) / 100}) from brand ads. ${data.territory_count} territories · ${data.top_territory} top earner. terradomini.io`,
      tiktokHook: `"Combien j'ai gagné aujourd'hui sans jouer :"`,
    },
    poi_crisis_alert: {
      emoji: '🔥',
      accentColor: '#FF3B30',
      title: `${String(data.poi_name).toUpperCase()} — ACTIVE`,
      subtitle: `${data.effect_summary} · Your territories affected`,
      shareText: `🔥 The ${data.poi_name} just changed my Hexod empire! ${data.effect_summary}. Only game where real-world events affect your territory. terradomini.io`,
      tiktokHook: `"L'actualité mondiale vient de changer mon empire virtuel. Regarde :"`,
    },
    rank_up: {
      emoji: '🎖️',
      accentColor: '#00FF87',
      title: `COMMANDER RANK ${data.new_rank}`,
      subtitle: `${data.rank_title} · Top ${data.percentile}% globally`,
      shareText: `🎖️ Just reached Commander Rank ${data.new_rank} (${data.rank_title}) in Hexod. Top ${data.percentile}% of all players. terradomini.io`,
      tiktokHook: `"Du rang 1 au rang ${data.new_rank}. Voici comment :"`,
    },
    local_pride: {
      emoji: '📍',
      accentColor: '#00FF87',
      title: `YOUR STREET IS IN THE GAME`,
      subtitle: `GPS detected: ${data.street_name} · Available to claim`,
      shareText: `📍 My actual street (${data.street_name}) is a playable territory in Hexod. Just claimed it. terradomini.io`,
      tiktokHook: `"Clique sur ta propre rue."`,
    },
    streak_milestone: {
      emoji: '🔥',
      accentColor: '#FF6B35',
      title: `${data.streak_days}-DAY STREAK`,
      subtitle: `+${data.reward_tdc} HEX Coin bonus · Keep it going`,
      shareText: `🔥 ${data.streak_days}-day login streak in Hexod! Earned ${data.reward_tdc} HEX Coin bonus. terradomini.io`,
      tiktokHook: `"${data.streak_days} jours de suite. Voici le bonus :"`,
    },
    first_tdc_earned: {
      emoji: '🪙',
      accentColor: '#FFB800',
      title: `YOU EARNED YOUR FIRST HEX Coin`,
      subtitle: `+${data.amount} HEX Coin on Polygon · Withdraw anytime`,
      shareText: `🪙 Just earned my first ${data.amount} HEX Coin in Hexod. Real cryptocurrency from a free browser game. terradomini.io`,
      tiktokHook: `"J'ai gagné ma première vraie crypto en jouant à un jeu gratuit."`,
    },
  }

  return { id, type, data, expiresAt, ...configs[type] }
}

// ─── Viral Moment Display ─────────────────────────────────────────────────────

interface ViralMomentDisplayProps {
  moment: ViralMoment
  onDismiss: () => void
  onShare: (moment: ViralMoment) => void
}

export function ViralMomentDisplay({ moment, onDismiss, onShare }: ViralMomentDisplayProps) {
  const [timeLeft, setTimeLeft] = useState(Math.ceil((moment.expiresAt - Date.now()) / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.ceil((moment.expiresAt - Date.now()) / 1000)
      setTimeLeft(remaining)
      if (remaining <= 0) {
        onDismiss()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [moment.expiresAt, onDismiss])

  return (
    <motion.div
      initial={{ y: -100, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -80, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, width: 360, maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div style={{
        background: 'rgba(5,5,8,0.98)',
        border: `1px solid ${moment.accentColor}40`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: `0 8px 40px ${moment.accentColor}20, 0 0 0 1px ${moment.accentColor}20`,
      }}>
        {/* Progress bar — expires in 5min */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 300, ease: 'linear' }}
            style={{ height: '100%', background: moment.accentColor }}
          />
        </div>

        <div style={{ padding: '16px 16px 16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `${moment.accentColor}15`,
              border: `1px solid ${moment.accentColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {moment.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18, letterSpacing: '1px',
                color: '#fff', lineHeight: 1.1, marginBottom: 3,
              }}>
                {moment.title}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                {moment.subtitle}
              </div>
            </div>
            <button onClick={onDismiss} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer', padding: 4, flexShrink: 0,
            }}>
              <X size={14} />
            </button>
          </div>

          {/* TikTok hook preview */}
          {moment.tiktokHook && (
            <div style={{
              padding: '8px 10px', marginBottom: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, fontSize: 11,
              color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
            }}>
              <span style={{ color: moment.accentColor, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', marginRight: 6 }}>
                TIKTOK HOOK
              </span>
              {moment.tiktokHook}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => onShare(moment)}
              style={{
                flex: 1, padding: '10px',
                background: moment.accentColor,
                border: 'none', borderRadius: 8,
                color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Share2 size={14} />
              SHARE · {timeLeft > 0 ? `${timeLeft}s` : ''}
            </motion.button>
            <button onClick={onDismiss} style={{
              padding: '10px 16px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
              color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
            }}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Viral Moment Manager ─────────────────────────────────────────────────────

const MOMENT_QUEUE_KEY = 'td_viral_queue'

export function useViralMoments() {
  const [currentMoment, setCurrentMoment] = useState<ViralMoment | null>(null)
  const [queue, setQueue] = useState<ViralMoment[]>([])
  const player = useStore(s => s.player)

  // Load queue from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MOMENT_QUEUE_KEY)
      if (stored) {
        const q: ViralMoment[] = JSON.parse(stored).filter((m: ViralMoment) => m.expiresAt > Date.now())
        setQueue(q)
        if (q.length > 0 && !currentMoment) {
          setCurrentMoment(q[0])
        }
      }
    } catch {}
  }, [])

  const triggerMoment = useCallback((type: ViralMomentType, data: Record<string, unknown>) => {
    const moment = buildViralMoment(type, data)
    setQueue(prev => {
      const next = [...prev, moment]
      localStorage.setItem(MOMENT_QUEUE_KEY, JSON.stringify(next))
      return next
    })
    if (!currentMoment) {
      setCurrentMoment(moment)
    }
  }, [currentMoment])

  const dismissMoment = useCallback(() => {
    setCurrentMoment(null)
    setQueue(prev => {
      const next = prev.slice(1)
      localStorage.setItem(MOMENT_QUEUE_KEY, JSON.stringify(next))
      if (next.length > 0) {
        setTimeout(() => setCurrentMoment(next[0]), 500)
      }
      return next
    })
  }, [])

  const shareMoment = useCallback(async (moment: ViralMoment) => {
    const text = moment.shareText
    const url = 'https://terradomini.io'

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hexod', text, url })
        toast.success('Shared! 🚀')
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      toast.success('Copied to clipboard! Paste on TikTok/Twitter 📋')
    }

    // Track share in backend
    fetch('/api/social/share-moment/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${useStore.getState().accessToken}`,
      },
      body: JSON.stringify({ moment_type: moment.type, moment_id: moment.id }),
    }).catch(() => {})

    dismissMoment()
  }, [dismissMoment])

  return { currentMoment, triggerMoment, dismissMoment, shareMoment }
}

// ─── Famous Landmark Detector ─────────────────────────────────────────────────

const FAMOUS_LANDMARKS: Record<string, { name: string; emoji: string; daily_tdc_estimate: number }> = {
  '8a3969a40c3ffff': { name: 'Notre Dame de Paris', emoji: '⛪', daily_tdc_estimate: 312 },
  '8a2a1072b59ffff': { name: 'Eiffel Tower', emoji: '🗼', daily_tdc_estimate: 480 },
  '8a2a1072b47ffff': { name: 'Arc de Triomphe', emoji: '🏛️', daily_tdc_estimate: 204 },
  '8a2a30d2a26ffff': { name: 'Burj Khalifa', emoji: '🏙️', daily_tdc_estimate: 520 },
  '8a283082a27ffff': { name: 'Big Ben / Westminster', emoji: '🕰️', daily_tdc_estimate: 390 },
  '8a2830826afffff': { name: 'Buckingham Palace', emoji: '👑', daily_tdc_estimate: 310 },
  '8a2a100d46bffff': { name: 'Colosseum Rome', emoji: '🏟️', daily_tdc_estimate: 445 },
  '8a283082a6bffff': { name: 'Tower Bridge London', emoji: '🌉', daily_tdc_estimate: 280 },
  '8a3961c2a73ffff': { name: 'Sagrada Família', emoji: '⛪', daily_tdc_estimate: 350 },
  '8a2830820cbffff': { name: 'Stonehenge', emoji: '🪨', daily_tdc_estimate: 180 },
  '8a2a110d46bffff': { name: 'Vatican / St Peter', emoji: '✝️', daily_tdc_estimate: 420 },
  '8a2830856b3ffff': { name: 'Times Square', emoji: '🌃', daily_tdc_estimate: 890 },
  '8a2830856a7ffff': { name: 'Statue of Liberty', emoji: '🗽', daily_tdc_estimate: 560 },
  '8a2a100d48fffff': { name: 'Colosseum', emoji: '🏟️', daily_tdc_estimate: 445 },
  '8a2a1072b43ffff': { name: 'Louvre Museum', emoji: '🖼️', daily_tdc_estimate: 380 },
  '8a31282094fffff': { name: 'Shibuya Crossing', emoji: '🚦', daily_tdc_estimate: 650 },
  '8a3128209abffff': { name: 'Tokyo Tower', emoji: '🗼', daily_tdc_estimate: 420 },
  '8a2a307680fffff': { name: 'Burj Al Arab', emoji: '⛵', daily_tdc_estimate: 480 },
}

export function checkLandmarkClaim(h3Index: string): { name: string; emoji: string; daily_tdc_estimate: number } | null {
  return FAMOUS_LANDMARKS[h3Index] ?? null
}
