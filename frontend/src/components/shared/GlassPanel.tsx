/**
 * GlassPanel — HEXOD game panel.
 * Dark theme inspired by Clash Royale: dark navy bg, gold accents, thick borders.
 * Bold, game-like aesthetic with depth and contrast.
 */
import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface GlassPanelProps {
  title: string
  onClose: () => void
  accent?: string
  width?: number | string
  /** Optional icon shown in the header (e.g. <IconSVG id="crown" size={18} />) */
  icon?: React.ReactNode
  /** Optional one-line subtitle under the title */
  subtitle?: React.ReactNode
  children: React.ReactNode
}

export function GlassPanel({
  title, onClose, accent = '#F59E0B', width, icon, subtitle, children,
}: GlassPanelProps) {
  // ESC closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        <div className="hx-glass-panel" role="dialog" aria-label={title} style={{
          ['--accent' as any]: accent,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {icon ? (
              <span style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(180deg, ${accent}33, ${accent}14)`,
                border: `1px solid ${accent}55`,
                boxShadow: `0 0 14px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
                color: accent,
              }}>{icon}</span>
            ) : (
              <span style={{
                width: 8, height: 8, borderRadius: 2, background: accent, flexShrink: 0,
                boxShadow: `0 0 8px ${accent}`,
              }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 900, letterSpacing: 4,
                color: accent,
                fontFamily: "'Orbitron', system-ui, sans-serif",
                textShadow: `0 0 15px ${accent}60`,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ marginTop: 3, fontSize: 9, letterSpacing: 1.5, color: 'rgba(226,232,240,0.5)' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              width: 36, height: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 26, lineHeight: 1,
              fontWeight: 400,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          >
            ×
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
