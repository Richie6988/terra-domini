/**
 * OnboardingHotspots — highlights clickable elements during the tutorial.
 * Semi-transparent mask + circular spotlight + positioned tip bubble.
 * Triggered by event 'hexod:hotspot:show' / 'hexod:hotspot:hide'.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Hotspot {
  id: string
  x: number        // px from left
  y: number        // px from top
  r: number        // spotlight radius px
  label: string
  tip: string
  tipDir: 'top' | 'bottom' | 'left' | 'right'
}

export function OnboardingHotspots() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = (e: Event) => {
      const { spots } = (e as CustomEvent).detail
      setHotspots(spots)
      setVisible(true)
    }
    const hide = () => setVisible(false)
    window.addEventListener('hexod:hotspot:show', show)
    window.addEventListener('hexod:hotspot:hide', hide)
    return () => {
      window.removeEventListener('hexod:hotspot:show', show)
      window.removeEventListener('hexod:hotspot:hide', hide)
    }
  }, [])

  if (!visible || !hotspots.length) return null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    >
      {/* SVG mask with a hole for each hotspot */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <mask id="hotspot-mask">
            <rect width="100%" height="100%" fill="white" />
            {hotspots.map(h => (
              <circle key={h.id} cx={h.x} cy={h.y} r={h.r + 8} fill="black" />
            ))}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(10,24,70,0.7)"
          mask="url(#hotspot-mask)"
        />
        {/* Highlight rings */}
        {hotspots.map(h => (
          <g key={h.id}>
            <circle cx={h.x} cy={h.y} r={h.r} fill="none" stroke="#ffd23f" strokeWidth="4" opacity="1" />
            <circle cx={h.x} cy={h.y} r={h.r + 6} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6">
              <animate attributeName="r" values={`${h.r+6};${h.r+18};${h.r+6}`} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* Tip bubbles */}
      {hotspots.map(h => {
        const off = 20 + h.r
        const pos: Record<string, React.CSSProperties> = {
          top:    { left: h.x, top:    h.y - off, transform: 'translate(-50%, -100%)' },
          bottom: { left: h.x, top:    h.y + off, transform: 'translateX(-50%)' },
          left:   { left: h.x - off, top: h.y,    transform: 'translate(-100%, -50%)' },
          right:  { left: h.x + off, top: h.y,    transform: 'translateY(-50%)' },
        }
        const arrowStyle: Record<string, React.CSSProperties> = {
          top:    { bottom: -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #0f2266', width: 0, height: 0 },
          bottom: { top:    -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '7px solid #0f2266', width: 0, height: 0 },
          left:   { right:  -7, top:  '50%', transform: 'translateY(-50%)',  borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '7px solid #0f2266', width: 0, height: 0 },
          right:  { left:   -7, top:  '50%', transform: 'translateY(-50%)',  borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: '7px solid #0f2266', width: 0, height: 0 },
        }
        return (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position: 'absolute', pointerEvents: 'none',
              ...pos[h.tipDir],
              maxWidth: 230,
              background: 'linear-gradient(180deg, #2f5fd0, #1e3c8f)',
              border: '3px solid #0f2266',
              borderRadius: 16, padding: '10px 14px',
              boxShadow: '0 5px 0 #0f2266',
            }}
          >
            <div style={{ position: 'absolute', ...arrowStyle[h.tipDir] }} />
            <div style={{ fontSize: 17, color: '#ffd23f', marginBottom: 4, fontFamily: 'var(--font-heading)', letterSpacing: 0.5, textTransform: 'uppercase', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>{h.label}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, lineHeight: 1.45, textTransform: 'none', letterSpacing: 0, fontFamily: 'system-ui, sans-serif' }}>{h.tip}</div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/** Helper — show hotspots from any component */
export function showHotspots(spots: Hotspot[]) {
  window.dispatchEvent(new CustomEvent('hexod:hotspot:show', { detail: { spots } }))
}
export function hideHotspots() {
  window.dispatchEvent(new CustomEvent('hexod:hotspot:hide'))
}

/** Predefined hotspots for the tutorial — anchored on the real elements (hard-coded x/y pointed at the wrong buttons) */
export function showTutorialHotspots() {
  const spot = (sel: string, id: string, label: string, tip: string, tipDir: Hotspot['tipDir'], rMax = 70): Hotspot | null => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return null
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) return null
    return { id, x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.min(rMax, Math.max(b.width, b.height) / 2 + 6), label, tip, tipDir }
  }
  const narrow = window.innerWidth < 600
  const spots = [
    spot('.hxh-missions', 'missions-btn', 'Missions', '3 goals a day that pay HEX. Start here every session.', narrow ? 'bottom' : 'right', 60),
    spot('.hx-harvest', 'harvest-btn', 'Harvest', 'Your zones fill this stock. Tap it to collect your HEX.', narrow ? 'bottom' : 'right', 80),
  ].filter(Boolean) as Hotspot[]
  if (!spots.length) return
  showHotspots(spots)
  setTimeout(hideHotspots, 8000)
}
