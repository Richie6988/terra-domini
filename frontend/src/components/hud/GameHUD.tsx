/**
 * GameHUD — persistent top overlay with player stats, TDC, active battles.
 */
import { useState, useEffect } from 'react'
import { Sword, Shield, Users, Trophy, Wifi, WifiOff, Bell, Map } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePlayer, useTDCBalance, useActiveBattles, useWsConnected, useNotifications, useStore } from '../../store'
import { TDCShopPanel } from '../shop/TDCShopPanel'

// Django DecimalField serializes as string — always parse before arithmetic
const toNum = (v: unknown): number => parseFloat(String(v ?? 0)) || 0


function useBattleCountdown(resolves_at: string): string {
  const [time, setTime] = useState('')
  useEffect(() => {
    const calc = () => {
      const diff = new Date(resolves_at).getTime() - Date.now()
      if (diff <= 0) { setTime('Resolving…'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTime(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [resolves_at])
  return time
}

function BattleTimer({ battle }: { battle: { id: string; territory_h3: string; resolves_at: string; battle_type: string } }) {
  const countdown = useBattleCountdown(battle.resolves_at)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 12px',
      background: 'rgba(239,68,68,0.15)', borderRadius: 8,
      border: '1px solid rgba(239,68,68,0.3)',
    }}>
      <Sword size={13} color="#EF4444" />
      <span style={{ fontSize: 12, color: '#FCA5A5' }}>
        {(battle.territory_name || battle.territory_h3 || 'Zone').slice(0, 12)}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{countdown}</span>
    </div>
  )
}

export function GameHUD() {
  const player = usePlayer()
  const balance = useTDCBalance()
  const activeBattles = useActiveBattles()
  const wsConnected = useWsConnected()
  const notifications = useNotifications()
  const setActivePanel = useStore((s) => s.setActivePanel)
  const dismissNotification = useStore((s) => s.dismissNotification)

  const [showShop, setShowShop] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)

  if (!player) return null

  const unreadNotifs = notifications.length

  return (
    <>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 900,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {/* Player info */}
        <div style={{ ...glassPill, pointerEvents: 'auto', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>
            {player?.username?.slice(0, 2)?.toUpperCase() ?? '??'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{player.username}</div>
            <div style={{ fontSize: 10, color: '#10B981' }}>Rank {player.commander_rank} • {player.spec_path}</div>
          </div>
        </div>

        {/* TDC Balance */}
        <button
          onClick={() => setShowShop(true)}
          style={{ ...glassPill, pointerEvents: 'auto', cursor: 'pointer', gap: 8 }}
        >
          <span style={{ fontSize: 16 }}>🪙</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>
              {toNum(balance?.in_game ?? player.tdc_in_game).toFixed(0)} TDC
            </div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>≈ €{(toNum(balance?.in_game ?? player.tdc_in_game) / toNum(balance?.tdc_eur_rate ?? 100)).toFixed(2)}</div>
          </div>
          <span style={{ fontSize: 10, color: '#8B5CF6', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>Buy +</span>
        </button>

        {/* Territory count */}
        <div style={{ ...glassPill, gap: 6 }}>
          <Map size={14} color="#3B82F6" />
          <span style={{ fontSize: 13, color: '#93C5FD' }}>
            {player.stats?.territories_owned ?? 0}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Active battles */}
        {activeBattles.slice(0, 3).map(b => (
          <div key={b.id} style={{ pointerEvents: 'auto' }}>
            <BattleTimer battle={b} />
          </div>
        ))}

        {/* Notifications */}
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          style={{ ...glassPill, pointerEvents: 'auto', cursor: 'pointer', position: 'relative', padding: '8px' }}
        >
          <Bell size={16} color={unreadNotifs > 0 ? '#F59E0B' : '#6B7280'} />
          {unreadNotifs > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: '#EF4444', borderRadius: '50%',
              width: 16, height: 16, fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700,
            }}>
              {unreadNotifs > 9 ? '9+' : unreadNotifs}
            </span>
          )}
        </button>

        {/* WS status */}
        <div style={{ ...glassPill, padding: '6px 8px', gap: 5 }}>
          {wsConnected
            ? <><Wifi size={13} color="#10B981" /><span style={{ fontSize: 10, color: '#10B981' }}>Live</span></>
            : <><WifiOff size={13} color="#EF4444" /><span style={{ fontSize: 10, color: '#EF4444' }}>Offline</span></>
          }
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 900, display: 'flex', gap: 8,
        background: 'rgba(0,0,0,0.85)', borderRadius: 16,
        padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {[
          { panel: 'combat' as const, icon: <Sword size={18} />, label: 'Combat', badge: activeBattles.length },
          { panel: 'alliance' as const, icon: <Users size={18} />, label: 'Alliance', badge: 0 },
          { panel: 'events' as const, icon: <Trophy size={18} />, label: 'Events', badge: 0 },
          { panel: 'profile' as const, icon: <Shield size={18} />, label: 'Profile', badge: 0 },
          { panel: 'trade' as const,        icon: <ArrowRightLeft size={18} />, label: 'Trade',     badge: 0 },
          { panel: 'crypto' as const,       icon: <Bitcoin size={18} />,         label: 'Crypto',    badge: 0 },
          { panel: 'leaderboard' as const,  icon: <Star size={18} />,            label: 'Ranks',     badge: 0 },
        ].map(({ panel, icon, label, badge }) => (
          <button
            key={panel}
            onClick={() => setActivePanel(panel)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#9CA3AF',
              position: 'relative',
            }}
          >
            {icon}
            <span style={{ fontSize: 10 }}>{label}</span>
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: '#EF4444', borderRadius: '50%',
                width: 14, height: 14, fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700,
              }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification dropdown */}
      <AnimatePresence>
        {showNotifs && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute', top: 60, right: 16, zIndex: 1500,
              width: 320, maxHeight: 400, overflowY: 'auto',
              background: '#0D0D1A', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={() => notifications.forEach((_, i) => dismissNotification(i))}
                  style={{ fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear all
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#4B5563', fontSize: 13 }}>
                No notifications
              </div>
            ) : (
              notifications.slice(0, 20).map((n, i) => (
                <div key={i} style={{
                  padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {n.type === 'attack_incoming' ? '🚨' : n.type === 'battle_resolved' ? '⚔️' : '📢'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#E5E7EB' }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{n.message}</div>
                  </div>
                  <button onClick={() => dismissNotification(i)} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop modal */}
      <AnimatePresence>
        {showShop && <TDCShopPanel onClose={() => setShowShop(false)} />}
      </AnimatePresence>
    </>
  )
}

const glassPill: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '7px 12px', borderRadius: 10,
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(8px)',
  flexShrink: 0,
}
