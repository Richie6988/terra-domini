/**
 * GameHUD — retained elements not yet migrated to HEXOD shell.
 * Kept: coalition alert, missions widget.
 * Removed: top bar (→ HexodTopHUD), bottom nav (→ HexodDock),
 *          notification dropdown, shop button (→ HexodDock panels).
 */
import { useStore, usePlayer } from '../../store'
import { MissionsDailyWidget } from './MissionsDailyWidget'

export function GameHUD() {
  const player = usePlayer()

  if (!player) return null

  // Dominance check (Board spec: alerte si >8% de la carte)
  const myTerritories = useStore(s => s.myTerritories)
  const totalTerritories = useStore(s => s.territories?.length || 0)
  const dominancePct = totalTerritories > 0 ? (myTerritories?.size || 0) / totalTerritories : 0
  const isDominant = dominancePct > 0.08

  return (
    <>
      {/* Coalition anti-dominant alert */}
      {isDominant && (
        <div style={{
          position:'absolute', top: 98, left:0, right:0, zIndex: 101,
          background:'rgba(220,38,38,0.12)', borderBottom:'1px solid rgba(220,38,38,0.3)',
          padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          backdropFilter:'blur(4px)',
        }}>
          <span style={{ fontSize:12 }}>⚠️</span>
          <span style={{ fontSize:9, color:'var(--state-alert)', fontWeight:700, letterSpacing: 1 }}>
            COALITION ACTIVE — {(dominancePct*100).toFixed(1)}% CONTROLLED — ALL ENEMIES DEF +25%
          </span>
        </div>
      )}

      {/* Missions + Referral widget — fixed bottom-left */}
      <MissionsDailyWidget />
    </>
  )
}

