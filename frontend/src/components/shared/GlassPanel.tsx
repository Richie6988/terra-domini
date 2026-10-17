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
          background: 'rgba(6, 14, 34, 0.6)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
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
          background: 'var(--hx-panel)',
          border: '3px solid var(--hx-line-strong)',
          borderRadius: 22,
          boxShadow: '0 8px 0 var(--hx-ink), 0 24px 50px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.18)',
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
        }}>
        {/* Header — banner style */}
        <div style={{
          padding: '12px 16px 12px 18px',
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 78%, #fff 22%) 0%, ${accent} 60%, color-mix(in srgb, ${accent} 82%, #000) 100%)`,
          borderBottom: '3px solid var(--hx-line-strong)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {icon ? (
              <span style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(180deg, #ffffff 0%, #e3ecff 100%)',
                border: '3px solid var(--hx-line-strong)',
                boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
                color: `color-mix(in srgb, ${accent} 75%, #000)`,
              }}>{icon}</span>
            ) : (
              <span style={{
                width: 14, height: 14, borderRadius: 4, background: '#fff', flexShrink: 0,
                border: '2px solid var(--hx-line-strong)', transform: 'rotate(45deg)',
              }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 22, fontWeight: 400, letterSpacing: 0.8,
                color: '#fff',
                fontFamily: 'var(--font-heading)',
                textShadow: '0 3px 0 rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ marginTop: 2, fontSize: 11, letterSpacing: 0.4, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="hx-close">×</button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px 20px',
          color: '#fff',
        }}>
          {children}
        </div>
        </div>
      </motion.div>
    </>
  )
}
