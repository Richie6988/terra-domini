/**
 * TaskCenter — Daily missions + streak, wired to backend.
 * API: GET /api/progression/daily-missions/
 *      POST /api/progression/login-streak/
 *      POST /api/progression/{id}/claim-mission/
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'
import { Check, Clock, Copy, Flame } from 'lucide-react'


interface Props { onClose: () => void }

interface Mission {
  id: string; title: string; icon: string; target: number; current: number;
  progress_pct: number; reward_tdc: number; reward_xp: number;
  completed: boolean; claimed: boolean;
  type?: string; description?: string;
}

// Where each mission is done — every unfinished mission gets a GO button (no dead ends)
const MISSION_GO: Record<string, { label: string; panel?: string; hint?: string }> = {
  claim:       { label: 'GO', hint: 'Tap an empty hex next to your land, then BUY or EXPLORE.' },
  spend_tdc:   { label: 'GO', hint: 'Buy a hex next to your land, or recruit troops in Military.' },
  produce:     { label: 'GO', hint: 'Tap HARVEST (left side) when your stock has HEX in it.' },
  win_battles: { label: 'GO', panel: 'combat' },
  recruit:     { label: 'GO', panel: 'combat' },
}

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

  // RULE 1: no fake fallback missions — an empty list shows an honest empty state
  const missions: Mission[] = missionData?.missions ?? []
  const streak: number | null = streakData?.current_streak ?? null
  const streakReward: number = streakData?.streak?.reward_tdc ?? 0

  // Real invite link (GET /social/my-referral/) — replaces the old hard-coded hexod.io/ref/<username>
  const { data: referral, isLoading: refLoading } = useQuery({
    queryKey: ['my-referral'],
    queryFn: () => api.get('/social/my-referral/').then(r => r.data),
    staleTime: 300000,
    enabled: isAuth,
  })

  // Claim mission
  const claimMut = useMutation({
    mutationFn: (missionId: string) => api.post(`/progression/${missionId}/claim-mission/`),
    onSuccess: (_, missionId) => {
      const m = missions.find(t => t.id === missionId)
      toast.success(`+${m?.reward_tdc || 0} HEX earned!`)
      // Balance in the top HUD + the "reward to claim" nudge come from loop-status
      ;['daily-missions', 'loop-status', 'wallet'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
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
  const inviteUrl: string = referral?.invite_url || ''
  const copyInvite = () => {
    if (!inviteUrl || !navigator.clipboard) { toast.error('Copy not available'); return }
    navigator.clipboard.writeText(inviteUrl).then(() => toast.success('Invite link copied')).catch(() => toast.error('Copy failed'))
  }

  return (
    <GlassPanel
      title="TASK CENTER" onClose={onClose} accent="#f5a524" width={620}
      icon={<IconSVG id="daily_task" size={24} />}
      subtitle={`Daily missions · resets in ${resetIn}`}
    >
      {/* Key stats */}
      <div className="hx-stat-grid" style={{ marginBottom: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="hx-card hx-stat">
          <span className="hx-stat__label">COMPLETED</span>
          <span className="hx-stat__value hx-stat__value--accent">{completed}<span style={{ fontSize: 14, color: 'var(--hx-text-3)' }}>/{missions.length}</span></span>
        </div>
        <div className="hx-card hx-stat">
          <span className="hx-stat__label">REWARDS</span>
          <span className="hx-stat__value" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24' }}>
            <IconSVG id="hex_coin" size={20} />{totalReward}<span style={{ fontSize: 14, color: 'var(--hx-text-3)' }}>/{totalPossible}</span>
          </span>
        </div>
        <div className="hx-card hx-stat">
          <span className="hx-stat__label">LOGIN STREAK</span>
          <span className="hx-stat__value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={18} color="#f97316" />{streak ?? '—'}
            <span style={{ fontSize: 10, color: 'var(--hx-text-3)', fontFamily: 'var(--font-heading)' }}>DAYS</span>
          </span>
          {streakReward > 0 && (
            <span className="hx-chip hx-chip--accent" style={{ alignSelf: 'flex-start', marginTop: 2 }}>
              +{streakReward} <IconSVG id="hex_coin" size={12} /> TODAY
            </span>
          )}
        </div>
        <div className="hx-card hx-stat">
          <span className="hx-stat__label">NEXT RESET</span>
          <span className="hx-stat__value" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18 }}>
            <Clock size={16} color="rgba(226,232,240,0.6)" />{resetIn}
          </span>
        </div>
      </div>

      {/* Overall progress */}
      {missions.length > 0 && (
        <div className="hx-progress" style={{ height: 8, marginBottom: 16, ['--accent' as any]: pct >= 100 ? '#22c55e' : '#f5a524' }}>
          <div className="hx-progress__fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="hx-section-title">TODAY'S MISSIONS</div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      )}

      {/* Empty state — honest: the API returned no missions */}
      {!isLoading && missions.length === 0 && (
        <div className="hx-empty">
          <IconSVG id="daily_task" size={44} />
          <div className="hx-empty__title">NO MISSIONS TODAY</div>
          <div>New daily missions arrive at the next reset — in {resetIn}.</div>
        </div>
      )}

      {/* Mission list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missions.map((task, i) => {
          const isDone = task.completed
          const isClaimed = task.claimed
          const taskPct = Math.min(100, task.progress_pct)
          const tone = isClaimed ? '#22c55e' : isDone ? '#22c55e' : '#f5a524'
          return (
            <div key={task.id} className={`hx-card hx-rise${isDone && !isClaimed ? ' hx-card--accent' : ''}`} style={{
              ['--accent' as any]: tone, animationDelay: `${i * 50}ms`,
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: isClaimed ? 0.6 : 1,
            }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(180deg, ${tone}2a, ${tone}0a)`, border: `1px solid ${tone}44`,
                filter: isClaimed ? 'grayscale(0.5)' : undefined,
              }}><EmojiIcon emoji={task.icon} size={26} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5, marginBottom: task.description && !isClaimed ? 2 : 6 }}>{task.title}</div>
                {task.description && !isClaimed && (
                  <div style={{ fontSize: 12, color: 'var(--hx-text-2)', fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'none', letterSpacing: 0, marginBottom: 6 }}>{task.description}</div>
                )}
                <div className="hx-progress">
                  <div className="hx-progress__fill" style={{ width: `${taskPct}%` }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{task.current}/{task.target}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span className="hx-chip" style={{ color: isClaimed ? 'var(--hx-text-3)' : '#fbbf24', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <IconSVG id="hex_coin" size={14} />+{task.reward_tdc}
                </span>
                {isDone && !isClaimed && (
                  <button className="btn-game btn-game-green" onClick={() => claimMut.mutate(task.id)} disabled={claimMut.isPending}
                    style={{ padding: '7px 14px', fontSize: 10 }}>CLAIM</button>
                )}
                {isClaimed && (
                  <span className="hx-chip" style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)' }}><Check size={12} /> DONE</span>
                )}
                {!isDone && task.type && MISSION_GO[task.type] && (
                  <button className="btn-game btn-game-blue" style={{ padding: '7px 16px', fontSize: 12 }}
                    onClick={() => {
                      const go = MISSION_GO[task.type!]
                      if (go.panel) { useStore.getState().setActivePanel(go.panel as any); return }
                      onClose()
                      if (go.hint) toast(go.hint, { duration: 5000 })
                    }}>{MISSION_GO[task.type].label}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bonus: all complete */}
      {missions.length > 0 && completed === missions.length && claimed < missions.length && (
        <div className="hx-card hx-card--accent" style={{
          ['--accent' as any]: '#22c55e', marginTop: 14, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <IconSVG id="trophy" size={28} />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
            ALL MISSIONS COMPLETE — CLAIM YOUR REWARDS!
          </div>
        </div>
      )}

      {/* Referral — real invite link; reward attribution is not wired yet (see report) */}
      <div className="hx-card" style={{
        ['--accent' as any]: '#3b82f6', marginTop: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <IconSVG id="referral" size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1.5, fontFamily: "'Orbitron', sans-serif" }}>INVITE FRIENDS</span>
            <span className="hx-chip">REWARDS SOON</span>
          </div>
          {refLoading
            ? <div className="hx-skeleton" style={{ height: 10, width: '70%', marginTop: 6 }} />
            : <div style={{ fontSize: 10, color: 'var(--hx-text-2)', marginTop: 4, fontFamily: 'var(--font-mono)', textTransform: 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteUrl || 'Invite link unavailable'}</div>}
        </div>
        <button className="btn-game btn-game-blue" onClick={copyInvite} disabled={!inviteUrl}
          aria-label="Copy invite link" style={{ padding: '8px 14px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Copy size={13} /> COPY
        </button>
      </div>
    </GlassPanel>
  )
}
