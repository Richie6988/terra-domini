/**
 * HexodDock — Bottom navigation dock for HEXOD.
 * Hex-shaped icon buttons, horizontal scroll on mobile, centered on desktop.
 * Matches prototype dock layout.
 */
import { useStore } from '../../store'
import { DockIcon } from './DockIcons'
import { NotificationBadge, useNotifications } from '../../hooks/useNotifications'
import { playSound } from '../../hooks/useSound'

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
  { panel: 'info',        label: 'Info',        color: '#38bdf8' },
]

const DOCK_CSS = `
.hxd-bar { display: flex; gap: 2px; padding: 6px 8px; max-width: 100%; overflow-x: auto; scrollbar-width: none;
  pointer-events: auto; border-radius: 20px !important; border: 1px solid rgba(255,255,255,0.10) !important;
  box-shadow: 0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08) !important;
  scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
.hxd-bar::-webkit-scrollbar { display: none; }
.hxd-btn { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;
  min-width: 64px; min-height: 60px; padding: 5px 4px 6px; border: none; border-radius: 14px; background: transparent;
  cursor: pointer; scroll-snap-align: start; }
.hxd-btn:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.hxd-btn:hover .hxd-hex-ring { opacity: 1; }
.hxd-hexwrap { position: relative; width: 40px; height: 40px; transition: filter .2s; }
.hxd-hex-ring, .hxd-hex { position: absolute; clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%); }
.hxd-hex-ring { inset: 0; opacity: 0.75; transition: opacity .2s; }
.hxd-hex { inset: 2px; display: flex; align-items: center; justify-content: center; transition: background .2s; }
.hxd-label { font-family: var(--font-heading); font-size: 9px; letter-spacing: 0.8px; line-height: 1; white-space: nowrap; text-transform: uppercase; }
.hxd-pip { position: absolute; bottom: 0; left: 50%; width: 18px; height: 3px; margin-left: -9px; border-radius: 3px; }
@media (max-width: 640px) {
  .hxd-wrap { padding: 0 6px !important; }
  .hxd-bar { width: 100%; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
  .hxd-btn { min-width: 60px; }
}
`

function DockButton({ item, isActive, onClick, badge }: {
  item: DockItem; isActive: boolean; onClick: () => void; badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className="dock-btn hxd-btn"
      aria-label={item.label}
      aria-pressed={isActive}
      title={item.label}
      style={{
        background: isActive ? `linear-gradient(180deg, ${item.color}2e, ${item.color}08)` : 'transparent',
      }}
    >
      <NotificationBadge count={badge} />
      {/* Hex icon: outer ring + inner face */}
      <div className="hxd-hexwrap" style={{ filter: isActive ? `drop-shadow(0 0 8px ${item.color}aa)` : 'none' }}>
        <div className="hxd-hex-ring" style={{
          background: isActive ? `linear-gradient(180deg, #ffffff, ${item.color})` : `linear-gradient(180deg, ${item.color}99, ${item.color}33)`,
        }} />
        <div className="hxd-hex" style={{
          background: isActive
            ? `linear-gradient(180deg, ${item.color}, ${item.color}bb)`
            : 'linear-gradient(180deg, #16283d, #0b1626)',
        }}>
          <DockIcon id={item.panel} color={isActive ? '#fff' : item.color} size={20} />
        </div>
      </div>

      {/* Label */}
      <span className="hxd-label" style={{
        fontWeight: isActive ? 900 : 700,
        color: isActive ? '#fff' : 'rgba(226,232,240,0.7)',
        textShadow: isActive ? `0 0 10px ${item.color}` : 'none',
      }}>
        {item.label}
      </span>
      {isActive && <span className="hxd-pip" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />}
    </button>
  )
}

export function HexodDock() {
  const activePanel = useStore(s => s.activePanel)
  const setActivePanel = useStore(s => s.setActivePanel)
  const { badgeCounts, markRead } = useNotifications()

  const handleClick = (panel: PanelId) => {
    playSound(activePanel === panel ? 'close' : 'open')
    if (badgeCounts[panel]) markRead(panel)
    setActivePanel(activePanel === panel ? null : panel)
  }

  return (
    <div className="hxd-wrap" style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 900,
      display: 'flex', justifyContent: 'center',
      padding: '0 8px',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      pointerEvents: 'none',
    }}>
      <style>{DOCK_CSS}</style>
      <nav className="glass-panel hxd-bar" aria-label="Main navigation">
        {DOCK_ITEMS.map(item => (
          <DockButton
            key={item.panel}
            item={item}
            isActive={activePanel === item.panel}
            onClick={() => handleClick(item.panel)}
            badge={badgeCounts[item.panel]}
          />
        ))}
      </nav>
    </div>
  )
}
