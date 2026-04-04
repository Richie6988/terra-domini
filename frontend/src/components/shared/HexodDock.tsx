/**
 * HexodDock — Bottom navigation dock for HEXOD.
 * Hex-shaped icon buttons, horizontal scroll on mobile, centered on desktop.
 * Matches prototype dock layout.
 */
import { useStore } from '../../store'
import { DockIcon } from './DockIcons'
import { NotificationBadge, useNotifications } from '../../hooks/useNotifications'

type PanelId = 'empire' | 'alliance' | 'codex' | 'marketplace' | 'ladder' | 'events' | 'hunt' | 'auction' | 'shop' | 'info' | 'combat' | 'trade' | 'profile' | 'crypto' | 'kingdom' | 'meta' | 'tasks'

interface DockItem {
  panel: PanelId
  label: string
  color: string
}

const DOCK_ITEMS: DockItem[] = [
  { panel: 'empire',      label: 'Empire',      color: '#cc8800' },
  { panel: 'alliance',    label: 'Alliance',    color: '#3b82f6' },
  { panel: 'codex',       label: 'Codex',       color: '#7950f2' },
  { panel: 'marketplace', label: 'Market',      color: '#cc8800' },
  { panel: 'ladder',      label: 'Ladder',      color: '#8b5cf6' },
  { panel: 'events',      label: 'Events',      color: '#f97316' },
  { panel: 'hunt',        label: 'Safari',      color: '#22c55e' },
  { panel: 'auction',     label: 'Auction',     color: '#f59e0b' },
  { panel: 'shop',        label: 'Shop',        color: '#fbbf24' },
  { panel: 'info',        label: 'Info',        color: '#64748b' },
]

function DockButton({ item, isActive, onClick, badge }: {
  item: DockItem; isActive: boolean; onClick: () => void; badge?: number
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
        transition: 'all 0.25s ease',
        position: 'relative',
      }}
    >
      <NotificationBadge count={badge} />
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
        }}>
          <DockIcon id={item.panel} color={isActive ? '#fff' : 'rgba(26,42,58,0.5)'} size={18} />
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
    </button>
  )
}

export function HexodDock() {
  const activePanel = useStore(s => s.activePanel)
  const setActivePanel = useStore(s => s.setActivePanel)
  const { badgeCounts, markRead } = useNotifications()

  const handleClick = (panel: PanelId) => {
    if (badgeCounts[panel]) markRead(panel)
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
        WebkitOverflowScrolling: 'touch' as any,
        borderBottom: 'none',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}>
        {DOCK_ITEMS.map(item => (
          <DockButton
            key={item.panel}
            item={item}
            isActive={activePanel === item.panel}
            onClick={() => handleClick(item.panel)}
            badge={badgeCounts[item.panel]}
          />
        ))}
      </div>
    </div>
  )
}
