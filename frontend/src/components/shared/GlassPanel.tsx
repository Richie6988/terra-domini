/**
 * GlassPanel — HEXOD glassmorphism slide-in panel wrapper.
 * Used by all side panels (Combat, Shop, Events, Profile, etc.)
 * Replaces the dark rgba(4,4,12,0.97) backgrounds with light_tactical glass.
 * Slides from right by default.
 */
import { motion } from 'framer-motion'

interface GlassPanelProps {
  title: string
  onClose: () => void
  accent?: string
  /** 'right' | 'left' | 'bottom' */
  side?: 'right' | 'left' | 'bottom'
  width?: number | string
  children: React.ReactNode
}

const SLIDE_CONFIG = {
  right: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    style: { right: 0, top: 0, bottom: 0 },
  },
  left: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
    style: { left: 0, top: 0, bottom: 0 },
  },
  bottom: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    style: { bottom: 0, left: 0, right: 0 },
  },
}

export function GlassPanel({
  title, onClose, accent = '#0099cc',
  side = 'right', width = 380, children,
}: GlassPanelProps) {
  const config = SLIDE_CONFIG[side]

  return (
    <motion.div
      initial={config.initial}
      animate={config.animate}
      exit={config.exit}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed',
        ...config.style,
        width: side === 'bottom' ? '100%' : width,
        maxHeight: side === 'bottom' ? '70vh' : '100%',
        zIndex: 1000,
        // Glassmorphism
        background: 'linear-gradient(180deg, rgba(235, 242, 250, 0.97) 0%, rgba(220, 230, 242, 0.97) 100%)',
        backdropFilter: 'blur(30px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
        border: side === 'right'
          ? '1px solid rgba(0, 60, 100, 0.15)'
          : side === 'left'
          ? '1px solid rgba(0, 60, 100, 0.15)'
          : '1px solid rgba(0, 60, 100, 0.15)',
        borderRadius: side === 'bottom' ? '16px 16px 0 0' : 0,
        boxShadow: side === 'right'
          ? '-8px 0 30px rgba(0,0,0,0.15), inset 1px 0 0 rgba(255,255,255,0.8)'
          : side === 'left'
          ? '8px 0 30px rgba(0,0,0,0.15), inset -1px 0 0 rgba(255,255,255,0.8)'
          : '0 -8px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `2px solid ${accent}`,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 3,
          color: accent,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 14 }}>◆</span>
          {title}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(0, 60, 100, 0.08)',
            border: '1px solid rgba(0, 60, 100, 0.12)',
            borderRadius: 6,
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(26, 42, 58, 0.45)',
            fontSize: 14,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        /* Text needs to be dark on light glass */
        color: '#1a2a3a',
      }}>
        {children}
      </div>
    </motion.div>
  )
}
