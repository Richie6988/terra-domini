/**
 * LoadingStates — Skeleton patterns + Empty state illustrations.
 * Consistent loading UX across all panels.
 * Glassmorphism style with shimmer animation.
 */

// ── Skeleton Block ──
export function Skeleton({ width, height = 12, radius = 4, style }: {
  width?: number | string; height?: number; radius?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{
      width: width ?? '100%', height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

// ── Skeleton Card ──
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'rgba(255,255,255,0.3)',
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Skeleton width={32} height={32} radius={16} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width="60%" height={10} />
          <Skeleton width="40%" height={8} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 15}%`} height={8} />
      ))}
    </div>
  )
}

// ── Skeleton List ──
export function SkeletonPanelList({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  )
}

// ── Skeleton Grid ──
export function SkeletonGrid({ count = 6, cols = 2 }: { count?: number; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          padding: 10, borderRadius: 8,
          background: 'rgba(255,255,255,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <Skeleton width={40} height={40} radius={20} />
          <Skeleton width="70%" height={8} />
          <Skeleton width="50%" height={6} />
        </div>
      ))}
    </div>
  )
}

// ── Empty State ──
export function EmptyState({ icon, title, message, action }: {
  icon: string
  title: string
  message: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 20px',
    }}>
      {/* Illustrated empty icon */}
      <div style={{
        width: 80, height: 80, margin: '0 auto 16px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        border: '2px dashed rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        {icon}
      </div>

      <div style={{
        fontSize: 10, fontWeight: 900, letterSpacing: 3, color: 'rgba(255,255,255,0.25)',
        fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6,
      }}>
        {title}
      </div>

      <div style={{
        fontSize: 8, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, maxWidth: 250,
        margin: '0 auto',
      }}>
        {message}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 16, padding: '8px 20px', borderRadius: 20,
            background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.2)',
            color: '#0099cc', fontSize: 7, fontWeight: 700, letterSpacing: 2,
            cursor: 'pointer', fontFamily: "'Orbitron', system-ui, sans-serif",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── Loading Spinner (small) ──
export function Spinner({ size = 20, color = '#0099cc' }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(255,255,255,0.06)`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ── Full Panel Loading ──
export function PanelLoading({ message = 'LOADING' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 12,
    }}>
      <Spinner size={28} />
      <div style={{
        fontSize: 8, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.25)',
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {message}…
      </div>
    </div>
  )
}
