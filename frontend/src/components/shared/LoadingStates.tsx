/**
 * LoadingStates — Skeleton patterns + Empty state illustrations.
 * Consistent loading UX across all panels.
 * Glassmorphism style with shimmer animation.
 */
import { EmojiIcon } from './emojiIcons'

// ── Skeleton Block ──
export function Skeleton({ width, height = 12, radius = 4, style }: {
  width?: number | string; height?: number; radius?: number; style?: React.CSSProperties
}) {
  return (
    <div className="hx-skeleton" style={{
      width: width ?? '100%', height, borderRadius: radius, flexShrink: 0,
      ...style,
    }} />
  )
}

// ── Skeleton Card ──
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="hx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <div key={i} className="hx-card" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <Skeleton width={40} height={40} radius={20} />
          <Skeleton width="70%" height={8} />
          <Skeleton width="50%" height={8} />
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
    <div className="hx-empty">
      {/* icon = iconBank id (or legacy emoji) → always rendered as SVG */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--hx-line-strong)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon ? <EmojiIcon emoji={icon} size={40} /> : null}
      </div>
      <div className="hx-empty__title">{title}</div>
      <div style={{ fontSize: 10, lineHeight: 1.6, maxWidth: 280 }}>{message}</div>
      {action && (
        <button className="btn-game btn-game-blue" onClick={action.onClick} style={{ marginTop: 6, padding: '9px 18px', fontSize: 10 }}>
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
        fontSize: 10, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.5)',
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {message}…
      </div>
    </div>
  )
}
