/**
 * GlassPanel — HEXOD centered modal panel.
 * 80% screen, centered, click outside closes, X button.
 * One panel at a time. Scale-in animation.
 * Light tactical glassmorphism DA.
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
  title, onClose, accent = '#0099cc', width, children,
}: GlassPanelProps) {
  return (
    <>
      {/* Backdrop — click to close */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(26, 42, 58, 0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel — centered 80% */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width || '80vw',
          maxWidth: 720,
          maxHeight: '80vh',
          zIndex: 1001,
          // Glassmorphism
          background: 'linear-gradient(180deg, rgba(235, 242, 250, 0.97) 0%, rgba(220, 230, 242, 0.97) 100%)',
          backdropFilter: 'blur(30px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
          border: '1px solid rgba(0, 60, 100, 0.15)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
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
              borderRadius: 8,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(26, 42, 58, 0.5)',
              fontSize: 16,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.color = '#dc2626' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,60,100,0.08)'; e.currentTarget.style.color = 'rgba(26,42,58,0.5)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          color: '#1a2a3a',
        }}>
          {children}
        </div>
      </motion.div>
    </>
  )
}
