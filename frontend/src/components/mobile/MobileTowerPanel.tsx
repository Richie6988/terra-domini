/**
 * Mobile Control Tower Panel
 * Fully optimized for phones — touch targets min 44px, no hover states,
 * bottom sheet drawer, swipe to dismiss, single-thumb reachable actions.
 *
 * Sofia persona: "1-screen alliance command center, 5 minutes between patients"
 * Kenji persona: "60fps, satisfying animations, clean aesthetic"
 * Fatou persona: "big arrows, clear, no jargon"
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TowerEvent {
  id: string
  territory_name: string
  lat: number
  lon: number
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  starts_at: string
  ends_at: string
  time_remaining_s: number
  registered_alliances: Array<{ id: string; tag: string }>
  winner: { tag: string; name: string } | null
  participant_count: number
  reward_bonus: Record<string, unknown>
  my_alliance_registered: boolean
}

// ─── Mobile Tower Panel ───────────────────────────────────────────────────────

export function MobileTowerPanel({ onClose }: { onClose: () => void }) {
  const [selectedTower, setSelectedTower] = useState<TowerEvent | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tower-events-mobile'],
    queryFn: () => api.get('/control-towers/?limit=20').then(r => r.data),
    refetchInterval: 30000,
  })

  const events: TowerEvent[] = data?.results ?? []
  const active   = events.filter(e => e.status === 'active')
  const upcoming = events.filter(e => e.status === 'scheduled')
  const recent   = events.filter(e => e.status === 'completed').slice(0, 3)

  return (
    <MobileDrawer onClose={onClose} title="🗼 Control Towers">
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          Loading towers...
        </div>
      ) : (
        <div>
          {/* ACTIVE TOWERS — highest priority */}
          {active.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel emoji="⚡" text="ACTIVE NOW" color="#FF3B30" />
              {active.map(t => (
                <TowerCard key={t.id} tower={t} onPress={() => setSelectedTower(t)} urgent />
              ))}
            </div>
          )}

          {/* UPCOMING */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel emoji="⏰" text="UPCOMING" color="#FFB800" />
              {upcoming.map(t => (
                <TowerCard key={t.id} tower={t} onPress={() => setSelectedTower(t)} />
              ))}
            </div>
          )}

          {/* RECENT */}
          {recent.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel emoji="📜" text="RECENT RESULTS" color="#6B7280" />
              {recent.map(t => (
                <TowerCard key={t.id} tower={t} onPress={() => setSelectedTower(t)} muted />
              ))}
            </div>
          )}

          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗼</div>
              <div style={{ fontSize: 15, color: '#fff', marginBottom: 8 }}>No tower events</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Events are scheduled 3 times daily</div>
            </div>
          )}
        </div>
      )}

      {/* Tower detail sheet */}
      <AnimatePresence>
        {selectedTower && (
          <TowerDetailSheet tower={selectedTower} onClose={() => setSelectedTower(null)} />
        )}
      </AnimatePresence>
    </MobileDrawer>
  )
}

// ─── Tower Card ───────────────────────────────────────────────────────────────

function TowerCard({ tower, onPress, urgent, muted }: {
  tower: TowerEvent
  onPress: () => void
  urgent?: boolean
  muted?: boolean
}) {
  const [pressed, setPressed] = useState(false)
  const timeStr = formatTimeRemaining(tower)

  return (
    <motion.div
      onTapStart={() => setPressed(true)}
      onTap={() => { setPressed(false); onPress() }}
      onTapCancel={() => setPressed(false)}
      animate={{ scale: pressed ? 0.97 : 1 }}
      transition={{ duration: 0.1 }}
      style={{
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        background: urgent
          ? 'linear-gradient(135deg, rgba(255,59,48,0.12) 0%, rgba(10,10,18,1) 60%)'
          : muted
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(255,255,255,0.05)',
        border: `1px solid ${urgent ? 'rgba(255,59,48,0.25)' : muted ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.09)'}`,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Urgent progress bar */}
      {urgent && tower.time_remaining_s > 0 && (
        <div style={{ height: 3, background: 'rgba(255,59,48,0.15)' }}>
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${(tower.time_remaining_s / 7200) * 100}%` }}
            style={{ height: '100%', background: '#FF3B30' }}
          />
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: urgent ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${urgent ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            🗼
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: muted ? 'rgba(255,255,255,0.5)' : '#fff',
              marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {tower.territory_name}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {urgent && `⏱ ${timeStr} remaining`}
              {!urgent && tower.status === 'scheduled' && `Starts ${timeStr}`}
              {tower.status === 'completed' && tower.winner && `🏆 ${tower.winner.tag} won`}
              {tower.status === 'completed' && !tower.winner && 'Completed'}
            </div>
          </div>

          {/* Status badge */}
          <div style={{ flexShrink: 0 }}>
            <StatusBadge status={tower.status} />
          </div>
        </div>

        {/* Registered alliances preview */}
        {tower.registered_alliances?.length > 0 && !muted && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tower.registered_alliances.slice(0, 4).map(a => (
              <span key={a.id} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: tower.my_alliance_registered && a.tag === tower.registered_alliances[0]?.tag
                  ? 'rgba(0,255,135,0.15)'
                  : 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.55)',
                fontFamily: 'monospace',
              }}>
                [{a.tag}]
              </span>
            ))}
            {tower.registered_alliances.length > 4 && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '2px 4px' }}>
                +{tower.registered_alliances.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Tower Detail Sheet ───────────────────────────────────────────────────────

function TowerDetailSheet({ tower, onClose }: { tower: TowerEvent; onClose: () => void }) {
  const qc = useQueryClient()
  const player = useStore(s => s.player)

  const registerMut = useMutation({
    mutationFn: (eventId: string) =>
      api.post(`/control-towers/${eventId}/register/`),
    onSuccess: () => {
      toast.success('Alliance registered! ⚔️')
      qc.invalidateQueries({ queryKey: ['tower-events-mobile'] })
    },
    onError: () => toast.error('Could not register'),
  })

  const isActive  = tower.status === 'active'
  const isDone    = tower.status === 'completed' || tower.status === 'cancelled'
  const timeStr   = formatTimeRemaining(tower)
  const rewards   = tower.reward_bonus as Record<string, number>

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div style={{
        background: '#0A0A12',
        borderRadius: '20px 20px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div style={{ padding: '16px 20px 40px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: isActive ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isActive ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              🗼
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                {tower.territory_name}
              </div>
              <StatusBadge status={tower.status} large />
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              fontSize: 24, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }}>
              ×
            </button>
          </div>

          {/* Active timer — big and prominent */}
          {isActive && tower.time_remaining_s > 0 && (
            <div style={{
              textAlign: 'center', padding: '20px 16px', marginBottom: 20,
              background: 'rgba(255,59,48,0.08)',
              border: '1px solid rgba(255,59,48,0.2)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 11, color: '#FF3B30', fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: 8 }}>
                TIME REMAINING
              </div>
              <TimerDisplay seconds={tower.time_remaining_s} />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                {tower.participant_count} participants · battle in progress
              </div>
            </div>
          )}

          {/* Scheduled time */}
          {tower.status === 'scheduled' && (
            <div style={{
              padding: '16px', marginBottom: 20,
              background: 'rgba(255,184,0,0.06)',
              border: '1px solid rgba(255,184,0,0.15)', borderRadius: 14,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#FFB800', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
                STARTS IN
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                {timeStr}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                {new Date(tower.starts_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Winner */}
          {isDone && tower.winner && (
            <div style={{
              padding: '16px', marginBottom: 20, textAlign: 'center',
              background: 'rgba(255,184,0,0.08)',
              border: '1px solid rgba(255,184,0,0.2)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#FFB800', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>
                [{tower.winner.tag}] WINS
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{tower.winner.name}</div>
            </div>
          )}

          {/* Rewards */}
          {Object.keys(rewards).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
                VICTORY REWARDS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(rewards).slice(0, 4).map(([k, v]) => (
                  <div key={k} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#00FF87', fontFamily: "'Bebas Neue',sans-serif" }}>
                      {typeof v === 'number' ? (v > 10 ? `×${v}` : `+${Math.round(v * 100)}%`) : v}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize', marginTop: 2 }}>
                      {k.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered alliances */}
          {tower.registered_alliances?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
                REGISTERED ALLIANCES ({tower.registered_alliances.length})
              </div>
              {tower.registered_alliances.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', padding: '10px 12px', marginBottom: 6,
                  background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#C084FC', fontWeight: 500 }}>[{a.tag}]</div>
                </div>
              ))}
            </div>
          )}

          {/* Register CTA */}
          {tower.status === 'scheduled' && !tower.my_alliance_registered && (
            <MobileCTA
              label="Register Alliance"
              emoji="⚔️"
              color="#00FF87"
              onPress={() => registerMut.mutate(tower.id)}
              loading={registerMut.isPending}
            />
          )}

          {tower.my_alliance_registered && tower.status === 'scheduled' && (
            <div style={{
              padding: '16px', background: 'rgba(0,255,135,0.08)',
              border: '1px solid rgba(0,255,135,0.2)', borderRadius: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, color: '#00FF87', fontWeight: 500 }}>✓ Alliance Registered</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Your alliance will be in the battle</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Mobile Drawer Base ───────────────────────────────────────────────────────

function MobileDrawer({
  children, onClose, title,
}: { children: React.ReactNode; onClose: () => void; title: string }) {
  const y = useMotionValue(0)
  const opacity = useTransform(y, [0, 300], [1, 0])

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      drag="y" dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
      style={{ y, position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', flexDirection: 'column' }}
      onDragEnd={(_, info) => { if (info.offset.y > 100) onClose() }}
    >
      {/* Backdrop */}
      <motion.div style={{ flex: '0 0 60px', background: 'rgba(0,0,0,0)', opacity }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        flex: 1, background: '#0A0A12',
        borderRadius: '20px 20px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Drag handle + header */}
        <div style={{ padding: '10px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>{title}</div>
            <button onClick={onClose} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 22, padding: '0 4px',
            }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' }}>
          {children}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const config = {
    active:    { color: '#FF3B30', label: '⚡ ACTIVE'    },
    scheduled: { color: '#FFB800', label: '⏰ SCHEDULED' },
    completed: { color: '#10B981', label: '✓ DONE'       },
    cancelled: { color: '#6B7280', label: '✗ CANCELLED'  },
  }
  const c = (config as any)[status] ?? { color: '#6B7280', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: large ? '5px 12px' : '3px 8px',
      borderRadius: 6, background: `${c.color}18`, color: c.color,
      fontSize: large ? 13 : 10, fontFamily: 'monospace',
      letterSpacing: '0.07em', fontWeight: 600, border: `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  )
}

function SectionLabel({ emoji, text, color }: { emoji: string; text: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.12em', color, fontWeight: 500 }}>
        {text}
      </span>
    </div>
  )
}

function MobileCTA({ label, emoji, color, onPress, loading }: {
  label: string; emoji: string; color: string
  onPress: () => void; loading?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onPress}
      disabled={loading}
      style={{
        width: '100%', padding: '16px',
        background: color === '#00FF87' ? '#00FF87' : `${color}20`,
        border: `1px solid ${color}50`, borderRadius: 14,
        color: color === '#00FF87' ? '#000' : color,
        fontSize: 16, fontWeight: 700, cursor: 'pointer',
        fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: loading ? 0.7 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      {loading ? 'Loading...' : label}
    </motion.button>
  )
}

function TimerDisplay({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const fmt = (n: number) => String(n).padStart(2, '0')

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'baseline' }}>
      {h > 0 && (
        <>
          <span style={{ fontSize: 36, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{fmt(h)}</span>
          <span style={{ fontSize: 18, color: '#FF3B30' }}>h</span>
        </>
      )}
      <span style={{ fontSize: 36, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{fmt(m)}</span>
      <span style={{ fontSize: 18, color: '#FF3B30' }}>m</span>
      <span style={{ fontSize: 36, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{fmt(s)}</span>
      <span style={{ fontSize: 18, color: '#FF3B30' }}>s</span>
    </div>
  )
}

function formatTimeRemaining(tower: TowerEvent): string {
  const now = Date.now()
  if (tower.status === 'active') {
    const s = tower.time_remaining_s
    if (s <= 0) return 'ending...'
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
  }
  if (tower.status === 'scheduled') {
    const diff = new Date(tower.starts_at).getTime() - now
    if (diff <= 0) return 'starting...'
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
  }
  return ''
}
