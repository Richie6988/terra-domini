/**
 * HexodTopHUD — Light tactical glassmorphism top bar.
 * Left: avatar + commander label + empire hex count
 * Right: crystal SVG icon + crystal balance
 * Matches main_prototype.html HUD exactly.
 */
import { useStore } from '../../store'
import { CrystalIcon } from '../shared/CrystalIcon'

const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0

export function HexodTopHUD() {
  const player = useStore(s => s.player)
  const balance = useStore(s => s.balance)
  const setActivePanel = useStore(s => s.setActivePanel)
  const myTerritories = useStore(s => s.myTerritories)

  if (!player) return null

  const crystals = toNum(balance?.in_game ?? player.tdc_in_game)
  const hexCount = myTerritories?.size ?? player.stats?.territories_owned ?? 0

  return (
    <div style={{
      position: 'fixed',
      top: 28, // below news ticker
      left: 0, right: 0,
      height: 70,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 24px',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {/* Left segment — Player identity */}
      <div
        className="glass-panel hud-segment"
        onClick={() => setActivePanel('profile')}
        style={{
          pointerEvents: 'auto',
          animationDelay: '0.2s',
        }}
      >
        {/* Avatar frame */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: `linear-gradient(135deg, var(--hud-cyan), var(--hud-amber))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, color: 'white', fontSize: 14,
          border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          {player.username?.slice(0, 3)?.toUpperCase() ?? '???'}
          {/* Shimmer effect */}
          <div style={{
            position: 'absolute', top: '-50%', left: '-50%',
            width: '200%', height: '200%',
            background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            animation: 'shimmer 3s infinite',
            pointerEvents: 'none',
          }} />
        </div>
        {/* Info stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontSize: 8, color: 'var(--text-muted)',
            letterSpacing: 2, fontWeight: 500,
          }}>
            Commander
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: 1,
          }}>
            {player.username}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--hud-cyan)',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 1,
          }}>
            EMPIRE: {hexCount} HEX
          </div>
        </div>
      </div>

      {/* Right segment — Crystal balance */}
      <div
        className="glass-panel hud-segment"
        onClick={() => setActivePanel('crypto')}
        style={{
          pointerEvents: 'auto',
          animationDelay: '0.35s',
        }}
      >
        {/* Crystal icon with drop-shadow */}
        <div style={{
          filter: 'drop-shadow(0 2px 8px rgba(121,80,242,0.4))',
          flexShrink: 0,
        }}>
          <CrystalIcon size="xl" />
        </div>
        {/* Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontSize: 8, color: 'var(--text-muted)',
            letterSpacing: 2, fontWeight: 500,
          }}>
            Crystals
          </div>
          <div style={{
            fontSize: 16, fontWeight: 900, color: 'var(--crystal)',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 1,
          }}>
            {crystals.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}
