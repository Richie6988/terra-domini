/**
 * OnboardingHotspots — met en évidence les éléments cliquables lors du tutorial.
 * Masque semi-transparent + spotlight circulaire + bulle explicative positionnée.
 * Déclenché par event 'hexod:hotspot:show' / 'hexod:hotspot:hide'.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Hotspot {
  id: string
  x: number        // px depuis gauche
  y: number        // px depuis haut
  r: number        // rayon spotlight px
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
      {/* Masque SVG avec trous pour chaque hotspot */}
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
          fill="rgba(0,0,0,0.72)"
          mask="url(#hotspot-mask)"
        />
        {/* Cercles de mise en évidence */}
        {hotspots.map(h => (
          <g key={h.id}>
            <circle cx={h.x} cy={h.y} r={h.r} fill="none" stroke="#00FF87" strokeWidth="2" opacity="0.9" />
            <circle cx={h.x} cy={h.y} r={h.r + 6} fill="none" stroke="#00FF87" strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values={`${h.r+6};${h.r+18};${h.r+6}`} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* Bulles explicatives */}
      {hotspots.map(h => {
        const off = 20 + h.r
        const pos: Record<string, React.CSSProperties> = {
          top:    { left: h.x, top:    h.y - off, transform: 'translate(-50%, -100%)' },
          bottom: { left: h.x, top:    h.y + off, transform: 'translateX(-50%)' },
          left:   { left: h.x - off, top: h.y,    transform: 'translate(-100%, -50%)' },
          right:  { left: h.x + off, top: h.y,    transform: 'translateY(-50%)' },
        }
        const arrowStyle: Record<string, React.CSSProperties> = {
          top:    { bottom: -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid rgba(0,255,135,0.25)', width: 0, height: 0 },
          bottom: { top:    -7, left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '7px solid rgba(0,255,135,0.25)', width: 0, height: 0 },
          left:   { right:  -7, top:  '50%', transform: 'translateY(-50%)',  borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '7px solid rgba(0,255,135,0.25)', width: 0, height: 0 },
          right:  { left:   -7, top:  '50%', transform: 'translateY(-50%)',  borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: '7px solid rgba(0,255,135,0.25)', width: 0, height: 0 },
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
              maxWidth: 200,
              background: 'rgba(4,4,16,0.96)',
              border: '1px solid rgba(0,255,135,0.25)',
              borderRadius: 12, padding: '10px 14px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ position: 'absolute', ...arrowStyle[h.tipDir] }} />
            <div style={{ fontSize: 12, fontWeight: 800, color: '#00FF87', marginBottom: 4 }}>{h.label}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>{h.tip}</div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/** Helper — déclenche les hotspots depuis n'importe quel composant */
export function showHotspots(spots: Hotspot[]) {
  window.dispatchEvent(new CustomEvent('hexod:hotspot:show', { detail: { spots } }))
}
export function hideHotspots() {
  window.dispatchEvent(new CustomEvent('hexod:hotspot:hide'))
}

/** Hotspots prédéfinis pour le tutorial step 2 */
export function showTutorialHotspots() {
  const W = window.innerWidth, H = window.innerHeight
  showHotspots([
    {
      id: 'missions-btn',
      x: 38, y: H - 84,
      r: 32,
      label: '🎯 Missions du jour',
      tip: 'Tes objectifs quotidiens. Commence ici chaque jour.',
      tipDir: 'right',
    },
    {
      id: 'poi-filter',
      x: 34, y: 60,
      r: 28,
      label: '📍 Filtres POI',
      tip: 'Filter special zones by type or rarity.',
      tipDir: 'right',
    },
    {
      id: 'my-territories',
      x: 34, y: 110,
      r: 28,
      label: '⬡ Mes zones',
      tip: 'Accès rapide à tous tes territoires. Clique pour vous y téléporter.',
      tipDir: 'right',
    },
    {
      id: 'bottom-nav',
      x: W / 2, y: H - 40,
      r: 120,
      label: '🧭 Navigation',
      tip: 'Combat, Alliance, Profil, Crypto — tout est là.',
      tipDir: 'top',
    },
  ])
  setTimeout(hideHotspots, 8000)
}
