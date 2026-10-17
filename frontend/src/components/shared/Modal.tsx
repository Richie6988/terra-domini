/**
 * Modal + SubModal — HEXOD M01 shared modal system.
 * Glass overlay, scale-in animation, sticky header, scroll body, close button.
 * SubModal stacks on top with higher z-index.
 * Escape chain: sub → modal → nothing.
 */
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PANEL_BG = 'linear-gradient(180deg, #0d1b2a 0%, #0a1628 60%, #060e1a 100%)'

// ── Modal (primary) ──

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Accent color for the header border */
  accent?: string
  /** Width override (default 420px) */
  width?: number
  children: React.ReactNode
}

export function Modal({ open, onClose, title, accent = '#0099cc', width = 420, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Escape closes modal
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0, 5, 15, 0.75)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 1200,
            }}
          />

          {/* Modal panel */}
          <motion.div
            ref={ref}
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: Math.min(width, window.innerWidth - 32),
              maxHeight: 'calc(100vh - 80px)',
              zIndex: 1201,
              // Glassmorphism
              ['--accent' as any]: accent,
              background: PANEL_BG,
              border: `2px solid ${accent}40`,
              borderRadius: 18,
              color: '#e2e8f0',
              boxShadow: `0 0 40px ${accent}15, 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sticky header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: `2px solid ${accent}50`,
              background: `linear-gradient(180deg, ${accent}18 0%, ${accent}08 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 3,
                color: accent,
                textShadow: `0 0 14px ${accent}60`,
                fontFamily: "'Orbitron', system-ui, sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
                {title}
              </div>
              <button onClick={onClose} className="hx-close" aria-label="Close">×</button>
            </div>

            {/* Scrollable body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
            }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── SubModal (stacks on top of Modal) ──

interface SubModalProps {
  open: boolean
  onClose: () => void
  title: string
  accent?: string
  width?: number
  children: React.ReactNode
}

export function SubModal({ open, onClose, title, accent = '#0099cc', width = 380, children }: SubModalProps) {
  // Escape closes sub first
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true) // capture phase
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Higher z overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0, 5, 15, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 1400,
            }}
          />

          {/* SubModal panel */}
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: Math.min(width, window.innerWidth - 48),
              maxHeight: 'calc(100vh - 120px)',
              zIndex: 1401,
              ['--accent' as any]: accent,
              background: PANEL_BG,
              border: `2px solid ${accent}40`,
              borderRadius: 16,
              color: '#e2e8f0',
              boxShadow: '0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: `2px solid ${accent}50`,
              background: `linear-gradient(180deg, ${accent}14 0%, ${accent}06 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 900, letterSpacing: 2,
                color: accent,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {title}
              </div>
              <button onClick={onClose} className="hx-close" aria-label="Close">×</button>
            </div>

            {/* Body */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 18px',
            }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Tab bar (shared for modal content) ──

interface TabBarProps {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  accent?: string
}

export function ModalTabBar({ tabs, active, onChange, accent = '#0099cc' }: TabBarProps) {
  return (
    <div className="hx-tabs" role="tablist" style={{ ['--accent' as any]: accent }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          className="hx-tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── Pill button (shared for modal actions) ──

interface PillButtonProps {
  label: string
  onClick: () => void
  color?: string
  disabled?: boolean
  fullWidth?: boolean
}

export function PillButton({ label, onClick, color = '#0099cc', disabled = false, fullWidth = false }: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 36,
        padding: '9px 16px',
        fontFamily: "'Orbitron', system-ui, sans-serif",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        borderRadius: 999,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `${color}66`}`,
        background: disabled ? 'rgba(255,255,255,0.03)' : `linear-gradient(180deg, ${color}2e, ${color}12)`,
        color: disabled ? 'rgba(255,255,255,0.35)' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : `0 0 12px ${color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
        transition: 'all 0.2s ease',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label}
    </button>
  )
}
