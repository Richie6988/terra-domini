/**
 * TaskCenter — Daily missions + streak, wired to backend.
 * API: GET /api/progression/daily-missions/
 *      POST /api/progression/login-streak/
 *      POST /api/progression/{id}/claim-mission/
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props { onClose: () => void }

interface Mission {
  id: string; title: string; icon: string; target: number; current: number;
  progress_pct: number; reward_tdc: number; reward_xp: number;
  completed: boolean; claimed: boolean;
}

const FALLBACK_TASKS: Mission[] = [
  { id: 'f1', title: 'Claim 2 territories', icon: '🏴', target: 2, current: 0, progress_pct: 0, reward_tdc: 25, reward_xp: 100, completed: false, claimed: false },
  { id: 'f2', title: 'Win 1 battle', icon: '⚔️', target: 1, current: 0, progress_pct: 0, reward_tdc: 40, reward_xp: 150, completed: false, claimed: false },
  { id: 'f3', title: 'Visit 3 POI zones', icon: '📍', target: 3, current: 0, progress_pct: 0, reward_tdc: 15, reward_xp: 50, completed: false, claimed: false },
  { id: 'f4', title: 'Spend 100 HEX Coins', icon: '💰', target: 100, current: 0, progress_pct: 0, reward_tdc: 30, reward_xp: 120, completed: false, claimed: false },
  { id: 'f5', title: 'Login streak bonus', icon: '🔥', target: 1, current: 1, progress_pct: 100, reward_tdc: 10, reward_xp: 50, completed: true, claimed: false },
]

export function TaskCenter({ onClose }: Props) {
  const isAuth = useStore(s => s.isAuthenticated)
  const qc = useQueryClient()

  // Fetch daily missions from backend
  const { data: missionData, isLoading } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
    enabled: isAuth,
  })

  // Fetch streak
  const { data: streakData } = useQuery({
    queryKey: ['login-streak'],
    queryFn: () => api.post('/progression/login-streak/').then(r => r.data),
    staleTime: 60000,
    enabled: isAuth,
  })

  const missions: Mission[] = missionData?.missions?.length ? missionData.missions : FALLBACK_TASKS
  const streak = streakData?.current_streak || 1
  const streakReward = streakData?.streak?.reward_tdc || 10

  // Claim mission
  const claimMut = useMutation({
    mutationFn: (missionId: string) => api.post(`/progression/${missionId}/claim-mission/`),
    onSuccess: (_, missionId) => {
      const m = missions.find(t => t.id === missionId)
      toast.success(`+${m?.reward_tdc || 0} HEX earned!`)
      qc.invalidateQueries({ queryKey: ['daily-missions'] })
    },
    onError: () => toast.error('Failed to claim reward'),
  })

  // Countdown to reset
  const [resetIn, setResetIn] = useState('')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setUTCHours(24, 0, 0, 0)
      const diff = tomorrow.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setResetIn(`${h}H ${m}M`)
    }
    update()
    const i = setInterval(update, 60000)
    return () => clearInterval(i)
  }, [])

  const completed = missions.filter(t => t.completed).length
  const claimed = missions.filter(t => t.claimed).length
  const totalReward = missions.filter(t => t.completed).reduce((s, t) => s + t.reward_tdc, 0)
  const totalPossible = missions.reduce((s, t) => s + t.reward_tdc, 0)
  const pct = missions.length ? Math.floor((completed / missions.length) * 100) : 0
  const player = useStore(s => s.player)
  const refLink = `hexod.io/ref/${player?.username || 'COMMANDER'}`

  return (
    <GlassPanel title="TASK CENTER" onClose={onClose} accent="#0099cc">
      {/* Reset timer + streak */}
      <div style={{
        textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.35)',
        letterSpacing: 2, marginBottom: 12,
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        DAILY RESET {resetIn} · STREAK: <EmojiIcon emoji="🔥" /> {streak} DAYS {streakReward > 0 && `(+${streakReward}◆)`}
      </div>

      {/* Progress bar */}
      <div style={{
        padding: '12px 14px', borderRadius: 10, marginBottom: 14,
        background: 'rgba(0,153,204,0.05)', border: '1px solid rgba(0,153,204,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
          <span>PROGRESS {completed}/{missions.length}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CrystalIcon size="sm" />{totalReward}/{totalPossible}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? '#22c55e' : '#0099cc', transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>Loading missions...</div>
      )}

      {/* Mission list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missions.map(task => {
          const isDone = task.completed
          const isClaimed = task.claimed
          const taskPct = Math.min(100, task.progress_pct)
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10,
              background: isClaimed ? 'rgba(34,197,94,0.04)' : isDone ? 'rgba(0,153,204,0.04)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${isClaimed ? 'rgba(34,197,94,0.15)' : isDone ? 'rgba(0,153,204,0.15)' : 'rgba(255,255,255,0.05)'}`,
              opacity: isClaimed ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0, filter: isClaimed ? 'grayscale(0.5)' : '' }}><EmojiIcon emoji={task.icon} size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5 }}>{task.title}</div>
                {/* Progress bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${taskPct}%`, height: '100%', borderRadius: 2, background: isDone ? '#22c55e' : '#0099cc', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{task.current}/{task.target}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CrystalIcon size="sm" />
                  <span style={{ fontSize: 11, fontWeight: 900, color: isClaimed ? 'rgba(26,42,58,0.25)' : '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>{task.reward_tdc}</span>
                </div>
                {isDone && !isClaimed && (
                  <button onClick={() => claimMut.mutate(task.id)} disabled={claimMut.isPending} style={{
                    marginTop: 4, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                    background: '#22c55e', border: 'none', color: '#fff',
                    fontSize: 7, fontWeight: 700, letterSpacing: 1,
                    fontFamily: "'Orbitron', sans-serif",
                  }}>CLAIM</button>
                )}
                {isClaimed && <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓ DONE</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bonus: all complete */}
      {completed === missions.length && claimed < missions.length && (
        <div style={{
          marginTop: 14, padding: 14, borderRadius: 10, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}><EmojiIcon emoji="🎉" /></div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
            ALL MISSIONS COMPLETE — CLAIM YOUR REWARDS!
          </div>
        </div>
      )}

      {/* Referral */}
      <div style={{
        marginTop: 14, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(0,153,204,0.04)', border: '1px solid rgba(0,153,204,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#0099cc', letterSpacing: 1, fontFamily: "'Orbitron', sans-serif" }}>
            INVITE FRIENDS · EARN 100◆
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{refLink}</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(`https://${refLink}`); toast.success('Link copied!') }} style={{
          padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
          background: '#0099cc', border: 'none', color: '#fff',
          fontSize: 7, fontWeight: 700, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif",
        }}>COPY</button>
      </div>
    </GlassPanel>
  )
}
