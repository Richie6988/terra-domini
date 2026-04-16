/**
 * SoundToggle — fixed position sound on/off button.
 * Glassmorphism pill style, bottom-left above dock.
 * Persists state in localStorage.
 */
import { useState, useEffect } from 'react'

export function SoundToggle() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('hx_muted') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('hx_muted', muted ? '1' : '0') } catch {}
    // Future: dispatch to audio engine
    window.dispatchEvent(new CustomEvent('hexod:audio', { detail: { muted } }))
  }, [muted])

  return (
    <button
      onClick={() => setMuted(m => !m)}
      title={muted ? 'UNMUTE' : 'MUTE'}
      style={{
        position: 'fixed',
        bottom: 80, left: 16,
        zIndex: 900,
        width: 36, height: 36,
        borderRadius: '50%',
        background: 'rgba(13,27,42,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s ease',
        color: muted ? 'rgba(255,255,255,0.25)' : '#0099cc',
      }}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {muted ? (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        )}
      </svg>
    </button>
  )
}
