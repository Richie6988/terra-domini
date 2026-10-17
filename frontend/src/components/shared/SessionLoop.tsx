/**
 * SessionLoop — the "5-minute session" HUD (owner, 2026-10-17).
 * HarvestButton: territories fill a stock capped at 8h; collect it or lose production.
 * NudgeStack: actionable reminders from GET /api/loop/status/ (attacks, full stock, results, missions).
 * Browser notifications (opt-in) fire for urgent nudges when the tab is in the background.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { IconSVG } from './iconBank'

interface Nudge {
  id: string; type: string; priority: number; title: string; body: string
  ends_at?: string; battle_id?: string
  cta: { label: string; action?: 'collect' | 'reinforce'; panel?: string } | null
}
interface LoopStatus {
  balance: number; earned_balance: number
  harvest: { rate_per_day: number; pending: number; cap_amount: number; cap_hours: number; fill_pct: number; is_full: boolean; full_at: string; lost: number }
  streak: { current: number; reward_today: number }
  nudges: Nudge[]
}

const NUDGE_ICON: Record<string, string> = {
  under_attack: 'swords', territory_lost: 'flag_red', harvest_full: 'wheat', harvest_ready: 'wheat',
  battle_result: 'trophy', missions_claimable: 'daily_task', first_claim: 'pin', can_expand: 'castle',
}
const NUDGE_COLOR: Record<string, string> = {
  under_attack: '#ef4444', territory_lost: '#ef4444', harvest_full: '#f59e0b', harvest_ready: '#34d058',
  battle_result: '#8b5cf6', missions_claimable: '#f5a623', first_claim: '#3b9bff', can_expand: '#3b9bff',
}
const URGENT = new Set(['under_attack', 'harvest_full', 'battle_result', 'territory_lost'])

const fmtIn = (iso?: string) => {
  if (!iso) return ''
  const s = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

export function useLoopStatus() {
  const isAuth = useStore(s => s.isAuthenticated)
  return useQuery<LoopStatus>({
    queryKey: ['loop-status'],
    queryFn: () => api.get('/loop/status/').then(r => r.data),
    enabled: isAuth,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })
}

function useLoopActions() {
  const qc = useQueryClient()
  const syncBalance = (v: number) => {
    const s = useStore.getState()
    s.setBalance({ ...(s.balance || {}), in_game: v } as any)
  }
  const refresh = () => ['loop-status', 'daily-missions', 'wallet', 'kingdoms', 'my-army'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  const collect = useMutation({
    mutationFn: () => api.post('/loop/collect/').then(r => r.data),
    onSuccess: (d: any) => {
      if (d.collected > 0) toast.success(`+${d.collected.toLocaleString()} HEX collected`)
      else toast(d.message || 'Nothing to collect yet')
      if (d.lost > 0) toast.error(`${d.lost.toLocaleString()} HEX lost — your stock was full. Come back sooner!`, { duration: 5000 })
      syncBalance(d.balance); refresh()
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Collect failed'),
  })
  const reinforce = useMutation({
    mutationFn: (battle_id: string) => api.post('/combat/reinforce/', { battle_id }).then(r => r.data),
    onSuccess: (d: any) => { toast.success(`Defenses ${Math.round(d.defense_points)}/${Math.round(d.max)}`); refresh() },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Reinforce failed'),
  })
  return { collect, reinforce, syncBalance }
}

export function HarvestButton() {
  const { data } = useLoopStatus()
  const { collect, syncBalance } = useLoopActions()
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { if (data) syncBalance(data.balance) }, [data?.balance])  // keep top HUD live
  const shownStreak = useRef(false)
  useEffect(() => {
    if (data?.streak?.reward_today && !shownStreak.current) {
      shownStreak.current = true
      toast.success(`Day ${data.streak.current} streak! +${data.streak.reward_today} HEX`, { duration: 4000 })
    }
  }, [data?.streak?.reward_today])
  if (!data || !data.harvest.rate_per_day) return null

  // Live estimate between polls (server stays the source of truth on collect)
  const h = data.harvest
  const capMs = h.cap_hours * 3600e3
  const startMs = new Date(h.full_at).getTime() - capMs
  const pct = Math.min(100, Math.max(0, ((Date.now() - startMs) / capMs) * 100))
  const pending = Math.floor((h.cap_amount * pct) / 100)
  const full = pct >= 100

  return (
    <button
      className={`hx-harvest ${full ? 'is-full' : ''}`}
      onClick={() => collect.mutate()}
      disabled={collect.isPending || pending <= 0}
      aria-label={`Collect ${pending} HEX`}
    >
      <span className="hx-harvest__icon"><IconSVG id="wheat" size={30} /></span>
      <span className="hx-harvest__body">
        <span className="hx-harvest__label">{full ? 'STOCK FULL!' : 'HARVEST'}</span>
        <span className="hx-harvest__value">+{pending.toLocaleString()}</span>
        <span className="hx-progress" style={{ ['--accent' as any]: full ? '#f59e0b' : '#34d058', height: 10 }}>
          <span className="hx-progress__fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="hx-harvest__sub">{full ? `${(h.lost || 0).toLocaleString()} HEX lost so far` : `Full in ${fmtIn(h.full_at)} · ${Math.round(h.rate_per_day).toLocaleString()}/day`}</span>
      </span>
    </button>
  )
}

export function NudgeStack() {
  const { data } = useLoopStatus()
  const { collect, reinforce } = useLoopActions()
  const setActivePanel = useStore(s => s.setActivePanel)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const notified = useRef<Set<string>>(new Set())
  const [perm, setPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  // Harvest nudges are shown by HarvestButton itself (still used for background notifications below)
  const nudges = (data?.nudges || []).filter(n => !dismissed.has(n.id) && !n.type.startsWith('harvest')).slice(0, 3)

  // Background notifications for urgent nudges
  useEffect(() => {
    if (perm !== 'granted' || !data) return
    for (const n of data.nudges) {
      if (!URGENT.has(n.type) || notified.current.has(n.id)) continue
      notified.current.add(n.id)
      if (document.hidden) {
        try { new Notification(`HEXOD — ${n.title}`, { body: n.body, icon: '/favicon.svg', tag: n.id }) } catch { /* ignore */ }
      }
    }
  }, [data, perm])

  const run = (n: Nudge) => {
    if (!n.cta) return
    if (n.cta.action === 'collect') collect.mutate()
    else if (n.cta.action === 'reinforce' && n.battle_id) reinforce.mutate(n.battle_id)
    else if (n.cta.panel) setActivePanel(n.cta.panel as any)
  }

  if (!nudges.length) return null
  return (
    <div className="hx-nudges">
      <AnimatePresence initial={false}>
        {nudges.map(n => (
          <motion.div key={n.id} layout initial={{ opacity: 0, x: -30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30 }} className={`hx-nudge ${n.type === 'under_attack' ? 'is-urgent' : ''}`}
            style={{ ['--accent' as any]: NUDGE_COLOR[n.type] || '#3b9bff' }}>
            <span className="hx-nudge__icon"><IconSVG id={NUDGE_ICON[n.type] || 'megaphone'} size={26} /></span>
            <span className="hx-nudge__text">
              <span className="hx-nudge__title">{n.title}</span>
              <span className="hx-nudge__body">{n.body}</span>
            </span>
            {n.cta && (
              <button className="btn-game btn-game-gold hx-nudge__cta" onClick={() => run(n)}
                disabled={collect.isPending || reinforce.isPending}>{n.cta.label}</button>
            )}
            <button className="hx-nudge__x" aria-label="Dismiss" onClick={() => setDismissed(s => new Set(s).add(n.id))}>×</button>
          </motion.div>
        ))}
      </AnimatePresence>
      {perm === 'default' && (
        <button className="hx-nudge__alerts" onClick={() => Notification.requestPermission().then(setPerm)}>
          Turn on alerts — know when you're attacked
        </button>
      )}
    </div>
  )
}
