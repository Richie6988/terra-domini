/**
 * TaskCenter — Daily challenges, streaks, earn-to-play.
 * Ported from main_prototype.html modal-gig.
 * 
 * Features:
 *   - Daily reset 00:00 UTC with streak counter
 *   - 5 daily tasks: verify, enrich territory, moderate, content creator, login streak
 *   - Progress bar with HEX earnings
 *   - Referral system (invite friends → earn HEX)
 */
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }

interface Task {
  id: string
  icon: string
  name: string
  desc: string
  reward: number
  completed: boolean
  action: string // 'claim' | 'start' | 'completed'
  color?: string
}

const DAILY_TASKS: Task[] = [
  { id: 'verify',   icon: '✅', name: 'VERIFY HUMANITY',     desc: 'Complete daily captcha verification',           reward: 5,  completed: false, action: 'claim' },
  { id: 'enrich',   icon: '📷', name: 'ENRICH TERRITORY',    desc: 'Add image or historical data to an empty hex',  reward: 15, completed: false, action: 'start' },
  { id: 'moderate', icon: '🔍', name: 'MODERATION DUTY',     desc: 'Review and validate 10 player reports',          reward: 25, completed: false, action: 'start' },
  { id: 'content',  icon: '⭐', name: 'CONTENT CREATOR',     desc: 'Write detailed description for a rare location', reward: 50, completed: false, action: 'start', color: '#cc8800' },
  { id: 'streak',   icon: '🔥', name: 'LOGIN STREAK',        desc: 'Daily login bonus — streak multiplier active!',  reward: 10, completed: false, action: 'claim' },
]

export function TaskCenter({ onClose }: Props) {
  const [tasks, setTasks] = useState(() => {
    // Load from localStorage or reset daily
    const stored = localStorage.getItem('hx_daily_tasks')
    const today = new Date().toISOString().slice(0, 10)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.date === today) return parsed.tasks as Task[]
    }
    return DAILY_TASKS
  })

  const [streak] = useState(() => {
    try { return parseInt(localStorage.getItem('hx_streak') || '1') } catch { return 1 }
  })

  // Persist tasks
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('hx_daily_tasks', JSON.stringify({ date: today, tasks }))
  }, [tasks])

  const completed = tasks.filter(t => t.completed).length
  const totalReward = tasks.filter(t => t.completed).reduce((s, t) => s + t.reward, 0)
  const totalPossible = tasks.reduce((s, t) => s + t.reward, 0)
  const pct = Math.floor((completed / tasks.length) * 100)

  // Time until reset
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

  const handleComplete = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: true, action: 'completed' } : t
    ))
    const task = tasks.find(t => t.id === taskId)
    if (task) toast.success(`+${task.reward} HEX earned!`)
  }

  const refLink = 'hexod.io/ref/' + (localStorage.getItem('hx_username') || 'COMMANDER')

  return (
    <GlassPanel title="TASK CENTER" onClose={onClose} accent="#0099cc" width={400}>
      {/* Reset timer + streak */}
      <div style={{
        textAlign: 'center', fontSize: 8, color: 'rgba(26,42,58,0.45)',
        letterSpacing: 2, marginBottom: 12,
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        DAILY RESET {resetIn} · STREAK: 🔥 {streak} DAYS
      </div>

      {/* Progress bar */}
      <div style={{
        padding: '12px 14px', borderRadius: 10, marginBottom: 14,
        background: 'rgba(0,153,204,0.05)', border: '1px solid rgba(0,153,204,0.15)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 6,
          fontSize: 8, color: 'rgba(26,42,58,0.45)', letterSpacing: 1,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <span>TODAY'S PROGRESS</span>
          <span style={{ color: '#0099cc', fontWeight: 700 }}>
            {completed}/{tasks.length} COMPLETED — {totalReward} HEX
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,60,100,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 3,
            background: 'linear-gradient(90deg, #0099cc, #00ff87)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {tasks.map(task => (
          <motion.div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10,
              background: task.completed ? 'rgba(0,136,74,0.04)' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${task.completed ? 'rgba(0,136,74,0.2)' : task.color ? task.color + '30' : 'rgba(0,60,100,0.1)'}`,
              opacity: task.completed ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <span style={{ fontSize: 16 }}>{task.icon}</span>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 1,
                  color: task.completed ? 'rgba(26,42,58,0.4)' : (task.color || '#1a2a3a'),
                  textDecoration: task.completed ? 'line-through' : 'none',
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                }}>
                  {task.completed ? '✅ ' : ''}{task.name}
                </div>
                <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>
                  {task.desc}
                </div>
              </div>
            </div>

            {task.completed ? (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#00884a',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                +{task.reward} ✓
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#0099cc',
                  fontFamily: "'Share Tech Mono', monospace",
                }}>
                  +{task.reward} HEX
                </span>
                <button
                  onClick={() => handleComplete(task.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 16, cursor: 'pointer',
                    background: task.color ? `${task.color}15` : 'rgba(0,153,204,0.08)',
                    border: `1px solid ${task.color || '#0099cc'}40`,
                    color: task.color || '#0099cc',
                    fontSize: 8, fontWeight: 700, letterSpacing: 1,
                    fontFamily: "'Orbitron', system-ui, sans-serif",
                  }}
                >
                  {task.action === 'claim' ? 'Claim' : 'Start'}
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Referral section */}
      <div style={{
        padding: 16, borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(0,0,0,0.01))',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: '#22c55e', marginBottom: 6,
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 2,
        }}>
          🤝 INVITE FRIENDS — EARN TOGETHER
        </div>
        <div style={{
          fontSize: 8, color: 'rgba(26,42,58,0.5)', marginBottom: 10, lineHeight: 1.6,
          textTransform: 'none', fontFamily: 'system-ui',
        }}>
          Share your referral link. Both you and your friend earn 100 HEX when they reach LVL 5!
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            readOnly
            value={refLink}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.1)',
              fontSize: 9, color: '#1a2a3a', fontFamily: "'Share Tech Mono', monospace",
              outline: 'none',
            }}
          />
          <button
            onClick={() => { navigator.clipboard?.writeText(refLink); toast.success('📋 Referral link copied!') }}
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#22c55e', fontSize: 8, fontWeight: 700,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}
          >
            Copy
          </button>
        </div>
        <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.35)', marginTop: 8 }}>
          4 friends invited · 2 reached LVL 5 · <span style={{ color: '#22c55e' }}>+200 HEX earned</span>
        </div>
      </div>
    </GlassPanel>
  )
}
