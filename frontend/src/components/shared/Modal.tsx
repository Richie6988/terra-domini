/**
 * Modal + SubModal — HEXOD M01 shared modal system.
 * Glass overlay, scale-in animation, sticky header, scroll body, close button.
 * SubModal stacks on top with higher z-index.
 * Escape chain: sub → modal → nothing.
 */
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
              background: 'rgba(26, 42, 58, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 1200,
            }}
          />

          {/* Modal panel */}
          <motion.div
            ref={ref}
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
              background: 'linear-gradient(180deg, rgba(235, 242, 250, 0.97) 0%, rgba(220, 230, 242, 0.97) 100%)',
              backdropFilter: 'blur(30px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
              border: '1px solid rgba(0, 60, 100, 0.15)',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sticky header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: `2px solid ${accent}`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.2) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 3,
                color: accent,
                fontFamily: "'Orbitron', system-ui, sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 10,
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
                  transition: 'all 0.2s ease',
                }}
              >
                ✕
              </button>
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
              background: 'rgba(26, 42, 58, 0.3)',
              backdropFilter: 'blur(2px)',
              zIndex: 1400,
            }}
          />

          {/* SubModal panel */}
          <motion.div
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
              background: 'linear-gradient(180deg, rgba(240, 245, 252, 0.98) 0%, rgba(225, 235, 248, 0.98) 100%)',
              backdropFilter: 'blur(30px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
              border: '1px solid rgba(0, 60, 100, 0.18)',
              borderRadius: 10,
              boxShadow: '0 24px 70px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: `2px solid ${accent}`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 2,
                color: accent,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {title}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: 'rgba(26, 42, 58, 0.4)',
                  fontSize: 13, fontFamily: "'Orbitron', system-ui, sans-serif",
                }}
              >
                ✕
              </button>
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
    <div style={{
      display: 'flex', gap: 4,
      marginBottom: 16,
      borderBottom: '1px solid rgba(0, 60, 100, 0.1)',
      paddingBottom: 8,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '7px 14px',
            borderRadius: 20,
            border: 'none',
            background: active === tab.id
              ? `${accent}18`
              : 'rgba(255, 255, 255, 0.5)',
            color: active === tab.id ? accent : 'rgba(26, 42, 58, 0.45)',
            fontSize: 8,
            fontWeight: active === tab.id ? 700 : 500,
            letterSpacing: 1,
            cursor: 'pointer',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            transition: 'all 0.25s ease',
            boxShadow: active === tab.id
              ? `0 2px 8px ${accent}22`
              : 'none',
          }}
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
        padding: '9px 14px',
        fontFamily: "'Orbitron', system-ui, sans-serif",
        fontSize: 8,
        fontWeight: 500,
        letterSpacing: 1,
        borderRadius: 20,
        border: 'none',
        background: disabled ? 'rgba(0, 60, 100, 0.06)' : 'rgba(255, 255, 255, 0.75)',
        color: disabled ? 'rgba(26, 42, 58, 0.25)' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(0,50,80,0.1), inset 0 1px 0 rgba(255,255,255,0.08)',
        transition: 'all 0.25s ease',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label}
    </button>
  )
}
