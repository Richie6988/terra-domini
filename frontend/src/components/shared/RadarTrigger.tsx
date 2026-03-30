/**
 * RadarTrigger — left edge trigger (48px strip).
 * Click opens the Codex panel.
 * Extracted from RadarFilterPanel (now deleted — Codex replaces it).
 */
export function RadarTrigger({ onClick, scanning }: { onClick: () => void; scanning: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed',
        left: 0, top: 0, width: 48, height: '100%',
        zIndex: 900,
        cursor: 'pointer',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.4s ease',
      }}
    >
      <svg
        viewBox="0 0 28 28"
        style={{
          width: 28, height: 28, marginLeft: 8,
          opacity: scanning ? 1 : 0.6,
          animation: scanning ? 'scanning-glow 1.5s infinite' : 'pulse-icon 2.5s infinite',
          transition: 'all 0.3s ease',
        }}
      >
        <circle cx="12" cy="12" r="8" fill="none"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="2.5" />
        <line x1="18" y1="18" x2="24" y2="24"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="3" strokeLinecap="round" />
        <circle cx="9" cy="9" r="2" fill="rgba(255,255,255,0.4)" />
        <circle cx="12" cy="8" r="3" fill="none"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  )
}
