/**
 * HexodTopHUD — Top bar: player identity (left) + HEX balance (right).
 * Uses SVG icons from Richard's icon bank. NO EMOJIS.
 */
import { useStore } from '../../store'
import { IconSVG } from './iconBank'

const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0

export function HexodTopHUD() {
  const player = useStore(s => s.player)
  const balance = useStore(s => s.balance)
  const setActivePanel = useStore(s => s.setActivePanel)
  const myTerritories = useStore(s => s.myTerritories)

  if (!player) return null

  const HEX = toNum(balance?.in_game ?? player.tdc_in_game)
  const hexCount = myTerritories?.size ?? player.stats?.territories_owned ?? 0

  return (
    <div style={{
      position: 'fixed',
      top: 28,
      left: 0, right: 0,
      height: 70,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 16px',
      zIndex: 900,
      pointerEvents: 'none',
    }}>
      {/* Left — Player identity */}
      <div
        className="glass-panel hud-segment"
        onClick={() => setActivePanel('profile')}
        style={{ pointerEvents: 'auto', animationDelay: '0.2s', gap: 10, padding: '10px 16px', minWidth: 180 }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `linear-gradient(135deg, ${(player as any).avatar_color || '#0099cc'}, ${(player as any).avatar_color || '#0099cc'}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)', flexShrink: 0,
        }}>
          {(player as any).avatar_emoji || player.username?.slice(0, 2)?.toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>
            {player.display_name || player.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--hud-cyan)', fontFamily: "'Share Tech Mono', monospace" }}>
            <IconSVG id="ui_kingdom" size={12} />
            <span>{hexCount} TERRITORIES</span>
          </div>
        </div>
      </div>

      {/* Right — HEX Balance */}
      <div
        className="glass-panel hud-segment"
        onClick={() => setActivePanel('crypto')}
        style={{ pointerEvents: 'auto', animationDelay: '0.35s', cursor: 'pointer', gap: 10, padding: '10px 16px', minWidth: 140 }}
      >
        <div style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(204,136,0,0.4))' }}>
          <IconSVG id="hex_coin" size={32} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700 }}>
            HEX COINS
          </div>
          <div style={{
            fontSize: 18, fontWeight: 900, color: '#cc8800',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 1,
          }}>
            {HEX.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}
