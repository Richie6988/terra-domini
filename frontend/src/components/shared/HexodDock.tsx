/**
 * HexodDock — Bottom navigation dock for HEXOD.
 * Hex-shaped icon buttons, horizontal scroll on mobile, centered on desktop.
 * Matches prototype dock layout.
 */
import { useStore, useActiveBattles } from '../../store'

type PanelId = 'combat' | 'alliance' | 'events' | 'profile' | 'trade' | 'shop' | 'ladder' | 'meta' | 'crypto' | 'marketplace' | 'kingdom' | 'codex' | 'hunt' | 'tasks'

interface DockItem {
  panel: PanelId
  icon: string
  label: string
  color: string
}

const DOCK_ITEMS: DockItem[] = [
  { panel: 'combat',      icon: '⚔',  label: 'Military',    color: '#dc2626' },
  { panel: 'events',      icon: '📡', label: 'Events',      color: '#f97316' },
  { panel: 'kingdom',     icon: '👑', label: 'Kingdom',     color: '#cc8800' },
  { panel: 'hunt',        icon: '🎯', label: 'Safari',      color: '#f97316' },
  { panel: 'codex',       icon: '📖', label: 'Codex',       color: '#7950f2' },
  { panel: 'tasks',       icon: '📋', label: 'Tasks',       color: '#0099cc' },
  { panel: 'shop',        icon: '🛒', label: 'Shop',        color: '#fbbf24' },
  { panel: 'trade',       icon: '📊', label: 'Trade',       color: '#22c55e' },
  { panel: 'marketplace', icon: '🏪', label: 'NFT',         color: '#cc8800' },
  { panel: 'alliance',    icon: '🏰', label: 'Alliance',    color: '#3b82f6' },
  { panel: 'ladder',      icon: '🏆', label: 'Ladder',      color: '#8b5cf6' },
  { panel: 'profile',     icon: '👤', label: 'Profile',     color: '#0099cc' },
  { panel: 'crypto',      icon: '💎', label: 'Wallet',      color: '#a855f7' },
]

function DockButton({ item, isActive, badge, onClick }: {
  item: DockItem; isActive: boolean; badge: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '8px 6px', minWidth: 56,
        background: isActive
          ? `linear-gradient(180deg, ${item.color}22, transparent)`
          : 'transparent',
        border: 'none',
        borderTop: isActive ? `2px solid ${item.color}` : '2px solid transparent',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Hex-shaped icon container */}
      <div style={{
        width: 36, height: 36,
        clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
        background: isActive ? item.color : 'rgba(0, 60, 100, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
        transition: 'all 0.25s ease',
      }}>
        <span style={{
          filter: isActive ? 'brightness(2)' : 'none',
          fontSize: 15,
        }}>
          {item.icon}
        </span>
      </div>

      {/* Label */}
      <span style={{
        fontSize: 7,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? item.color : 'var(--text-muted)',
        letterSpacing: 1,
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {item.label}
      </span>

      {/* Notification badge */}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 4,
          background: 'var(--state-alert)',
          borderRadius: '50%',
          width: 14, height: 14,
          fontSize: 8, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          border: '1px solid rgba(0,0,0,0.3)',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

export function HexodDock() {
  const activePanel = useStore(s => s.activePanel)
  const setActivePanel = useStore(s => s.setActivePanel)
  const activeBattles = useActiveBattles()

  const getBadge = (panel: PanelId): number => {
    if (panel === 'combat') return activeBattles?.length ?? 0
    return 0
  }

  const handleClick = (panel: PanelId) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 900,
      display: 'flex', justifyContent: 'center',
      padding: '0 8px',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      pointerEvents: 'none',
    }}>
      <div className="glass-panel" style={{
        display: 'flex',
        gap: 0,
        borderRadius: '16px 16px 0 0',
        padding: '4px 8px',
        maxWidth: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        pointerEvents: 'auto',
        WebkitOverflowScrolling: 'touch' as unknown as string,
        borderBottom: 'none',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}>
        {DOCK_ITEMS.map(item => (
          <DockButton
            key={item.panel}
            item={item}
            isActive={activePanel === item.panel}
            badge={getBadge(item.panel)}
            onClick={() => handleClick(item.panel)}
          />
        ))}
      </div>
    </div>
  )
}
