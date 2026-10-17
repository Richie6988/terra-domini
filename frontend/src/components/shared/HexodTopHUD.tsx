/**
 * HexodTopHUD — Top bar: player identity (left) + HEX balance (right) + staff GOD MODE switch (centre).
 * Uses SVG icons from Richard's icon bank. NO EMOJIS.
 * Also exports <MissionsButton/> (game-style MISSIONS entry point, meant to replace the inline one in App.tsx).
 */
import { useQuery } from '@tanstack/react-query'
import { useStore } from '../../store'
import { api } from '../../services/api'
import { IconSVG } from './iconBank'
import { emojiToIcon } from './emojiIcons'

const AVATARS_SET = new Set(['eagle','dragon','lion','wolf','fox','bear','bat','shark','snake','scorpion','octopus','squid','crab','bee','butterfly','horse','deer','elephant','rhino','bison','crocodile','trex','whale','bug'])

const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0

/** Avatar value (icon id or emoji char from the backend) → iconBank id, or null for initials. */
function resolveAvatarIcon(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  if (AVATARS_SET.has(v)) return v
  return emojiToIcon(v)
}

const HUD_CSS = `
.hxh-top { position: fixed; top: 28px; left: 0; right: 0; height: 70px; display: flex; justify-content: space-between;
  align-items: center; padding: 0 16px; z-index: 900; pointer-events: none; gap: 8px; }
.hxh-seg { pointer-events: auto; gap: 12px !important; padding: 8px 16px 8px 8px !important; border-radius: 16px !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  box-shadow: 0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07) !important; min-width: 0 !important; }
.hxh-seg:focus-visible, .hxh-god:focus-visible, .hxh-missions:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.hxh-avatar { width: 46px; height: 46px; border-radius: 50%; padding: 2px; flex-shrink: 0; position: relative; }
.hxh-avatar__inner { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 35% 30%, #1b3550, #0a1628 70%); }
.hxh-name { font-family: var(--font-heading); font-size: 13px; font-weight: 900; letter-spacing: 1.5px; color: #fff;
  max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hxh-chips { display: flex; gap: 6px; margin-top: 4px; }
.hxh-chip { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 7px; border-radius: 999px;
  font-family: var(--font-mono); font-size: 11px; color: #e2e8f0; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10); white-space: nowrap; }
.hxh-chip small { font-family: var(--font-heading); font-size: 9px; letter-spacing: 1px; color: rgba(226,232,240,0.6); }
.hxh-hex-label { font-family: var(--font-heading); font-size: 9px; font-weight: 700; letter-spacing: 2px; color: rgba(226,232,240,0.6); }
.hxh-hex-value { font-family: var(--font-mono); font-size: 22px; line-height: 1; color: #fbbf24; letter-spacing: 1px;
  font-variant-numeric: tabular-nums; text-shadow: 0 0 14px rgba(251,191,36,0.35); }
.hxh-god { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: auto;
  display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 8px 0 10px; border-radius: 999px; cursor: pointer;
  font-family: var(--font-heading); font-size: 10px; font-weight: 900; letter-spacing: 2px;
  transition: transform .15s var(--hx-spring), box-shadow .2s, background .2s; }
.hxh-god:hover { transform: translate(-50%, -50%) translateY(-1px); }
.hxh-god:active { transform: translate(-50%, -50%) scale(0.96); }
.hxh-god__state { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 20px; padding: 0 6px;
  border-radius: 999px; font-size: 9px; letter-spacing: 1px; }
.hxh-missions { position: relative; display: flex; align-items: center; gap: 10px; padding: 7px 14px 7px 7px; border-radius: 14px;
  cursor: pointer; pointer-events: auto; border: 1px solid rgba(251,191,36,0.35);
  background: linear-gradient(180deg, rgba(60,40,8,0.92), rgba(18,14,6,0.92));
  box-shadow: 0 4px 0 rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12);
  transition: transform .15s var(--hx-spring), box-shadow .2s, border-color .2s; animation: hxh-pulse 3s ease-in-out infinite; }
.hxh-missions:hover { transform: translateY(-2px); border-color: rgba(251,191,36,0.7); }
.hxh-missions:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12); }
.hxh-missions.is-active { animation: none; border-color: #fbbf24; box-shadow: 0 0 0 1px #fbbf24, 0 0 22px rgba(251,191,36,0.45); }
.hxh-missions__hex { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
  background: linear-gradient(180deg, #fbbf24, #b45309); }
.hxh-missions__badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px;
  background: #22c55e; color: #fff; border: 2px solid #0a1628; font-family: var(--font-mono); font-size: 11px;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(34,197,94,0.6); }
@keyframes hxh-pulse { 0%,100% { box-shadow: 0 4px 0 rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12); }
  50% { box-shadow: 0 4px 0 rgba(0,0,0,0.45), 0 0 26px rgba(251,191,36,0.35), inset 0 1px 0 rgba(255,255,255,0.12); } }
@media (max-width: 640px) {
  .hxh-top { padding: 0 8px; height: 64px; }
  .hxh-seg { gap: 8px !important; padding: 6px 10px 6px 6px !important; }
  .hxh-avatar { width: 38px; height: 38px; }
  .hxh-name { font-size: 11px; max-width: 92px; }
  .hxh-rank { display: none !important; }
  .hxh-hex-label { display: none; }
  .hxh-hex-value { font-size: 16px; }
  .hxh-god { top: auto; bottom: -34px; left: auto; right: 8px; transform: none; height: 30px; font-size: 9px; letter-spacing: 1px; }
  .hxh-god:hover, .hxh-god:active { transform: none; }
  .hxh-god__label { display: none; }
}
@media (prefers-reduced-motion: reduce) { .hxh-missions { animation: none; } }
`

export function HexodTopHUD() {
  const player = useStore(s => s.player)
  const balance = useStore(s => s.balance)
  const setActivePanel = useStore(s => s.setActivePanel)
  const myTerritories = useStore(s => s.myTerritories)
  const godMode = useStore(s => s.godMode)
  const toggleGodMode = useStore(s => s.toggleGodMode)

  if (!player) return null

  const HEX = toNum(balance?.in_game ?? player.tdc_in_game)
  const hexCount = myTerritories?.size ?? player.stats?.territories_owned ?? 0
  const p = player as any
  const color: string = p.avatar_color || '#0099cc'
  const avatarIcon = resolveAvatarIcon(p.avatar_emoji)
  const rank = p.commander_rank

  return (
    <div className="hxh-top">
      <style>{HUD_CSS}</style>

      {/* Left — Player identity */}
      <div
        className="glass-panel hud-segment hxh-seg"
        role="button" tabIndex={0}
        aria-label="Open profile"
        onClick={() => setActivePanel('profile')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setActivePanel('profile') }}
        style={{ animationDelay: '0.2s' }}
      >
        <div className="hxh-avatar" style={{
          background: `conic-gradient(from 210deg, ${color}, #ffffff 25%, ${color} 50%, ${color}88 75%, ${color})`,
          boxShadow: `0 0 14px ${color}66`,
        }}>
          <div className="hxh-avatar__inner">
            {avatarIcon
              ? <IconSVG id={avatarIcon} size={30} />
              : <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-heading)' }}>{player.username?.slice(0, 2)?.toUpperCase()}</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="hxh-name">{player.display_name || player.username}</div>
          <div className="hxh-chips">
            <span className="hxh-chip" title="Territories owned">
              <IconSVG id="ui_kingdom" size={14} />{hexCount}<small>HEX</small>
            </span>
            {rank != null && (
              <span className="hxh-chip hxh-rank" title="Commander rank" style={{ borderColor: `${color}55` }}>
                <small>RANK</small>{rank}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* God Mode — staff only */}
      {p.is_staff && (
        <button
          className="hxh-god"
          onClick={toggleGodMode}
          role="switch"
          aria-checked={godMode}
          aria-label="God mode"
          style={{
            background: godMode ? 'linear-gradient(180deg, #fbbf24, #d97706)' : 'rgba(13,27,42,0.92)',
            border: `1.5px solid ${godMode ? '#fde68a' : 'rgba(251,191,36,0.6)'}`,
            color: godMode ? '#1a0a00' : '#fbbf24',
            boxShadow: godMode ? '0 0 22px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.4)' : '0 4px 14px rgba(0,0,0,0.45)',
          }}
        >
          <IconSVG id="crown" size={18} />
          <span className="hxh-god__label">GOD MODE</span>
          <span className="hxh-god__state" style={{
            background: godMode ? 'rgba(26,10,0,0.85)' : 'rgba(255,255,255,0.08)',
            color: godMode ? '#fbbf24' : 'rgba(255,255,255,0.7)',
          }}>{godMode ? 'ON' : 'OFF'}</span>
        </button>
      )}

      {/* Right — HEX Balance */}
      <div
        className="glass-panel hud-segment hxh-seg"
        role="button" tabIndex={0}
        aria-label="Open wallet"
        onClick={() => setActivePanel('crypto')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setActivePanel('crypto') }}
        style={{ animationDelay: '0.35s' }}
      >
        <div style={{ flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.45))' }}>
          <IconSVG id="hex_coin" size={34} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="hxh-hex-label">HEX COINS</div>
          <div className="hxh-hex-value">
            {HEX.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * MissionsButton — game-style entry point for the Task Center.
 * Drop-in replacement for the inline MISSIONS div in App.tsx (same position: fixed top 108 / left 16).
 * Badge = number of completed-but-unclaimed missions from GET /progression/daily-missions/ (same cache as TaskCenter).
 */
export function MissionsButton() {
  const activePanel = useStore(s => s.activePanel)
  const setActivePanel = useStore(s => s.setActivePanel)
  const isAuth = useStore(s => s.isAuthenticated)
  const { data } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
    enabled: isAuth,
  })
  const claimable = (data?.missions ?? []).filter((m: any) => m.completed && !m.claimed).length
  const active = activePanel === 'tasks'

  return (
    <button
      type="button"
      className={`hxh-missions${active ? ' is-active' : ''}`}
      aria-label="Missions"
      aria-pressed={active}
      onClick={() => setActivePanel(active ? null : 'tasks')}
      style={{ position: 'fixed', top: 108, left: 16, zIndex: 900 }}
    >
      <style>{HUD_CSS}</style>
      <span className="hxh-missions__hex"><IconSVG id="daily_task" size={30} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#fbbf24', textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>MISSIONS</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)' }}>DAILY REWARDS</span>
      </span>
      {claimable > 0 && <span className="hxh-missions__badge">{claimable}</span>}
    </button>
  )
}
