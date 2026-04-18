/**
 * GlassPanel — HEXOD game panel.
 * Dark theme inspired by Clash Royale: dark navy bg, gold accents, thick borders.
 * Bold, game-like aesthetic with depth and contrast.
 */
import { motion } from 'framer-motion'

interface GlassPanelProps {
  title: string
  onClose: () => void
  accent?: string
  width?: number | string
  children: React.ReactNode
}

export function GlassPanel({
  title, onClose, accent = '#F59E0B', width, children,
}: GlassPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 5, 15, 0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: width || '92vw',
          maxWidth: 960,
          maxHeight: '92vh',
          pointerEvents: 'auto',
          background: 'linear-gradient(180deg, #0d1b2a 0%, #0a1628 60%, #060e1a 100%)',
          border: `2px solid ${accent}40`,
          borderRadius: 18,
          boxShadow: `0 0 40px ${accent}15, 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
        }}>
        {/* Header — banner style */}
        <div style={{
          padding: '14px 20px',
          background: `linear-gradient(180deg, ${accent}18 0%, ${accent}08 100%)`,
          borderBottom: `2px solid ${accent}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 15, fontWeight: 900, letterSpacing: 4,
            color: accent,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            display: 'flex', alignItems: 'center', gap: 10,
            textShadow: `0 0 15px ${accent}60`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2, background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }} />
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 22,
              fontWeight: 400,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          >
            
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          color: '#e2e8f0',
        }}>
          {children}
        </div>
        </div>
      </motion.div>
    </>
  )
}
