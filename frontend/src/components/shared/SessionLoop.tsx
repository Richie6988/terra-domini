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
import { playSound } from '../../hooks/useSound'

interface Nudge {
  id: string; type: string; priority: number; title: string; body: string
  ends_at?: string; battle_id?: string
  cta: { label: string; action?: 'collect' | 'reinforce'; panel?: string } | null
}
interface LoopStatus {
  balance: number; earned_balance: number
  harvest: { rate_per_day: number; pending: number; cap_amount: number; cap_hours: number; fill_pct: number; is_full: boolean; full_at: string; lost: number; resources?: { id: string; name: string; rate_per_day: number; pending: number }[]; beginner_mult?: number; beginner_until?: string | null }
  streak: { current: number; reward_today: number }
  nudges: Nudge[]
}

const NUDGE_ICON: Record<string, string> = {
  under_attack: 'swords', territory_lost: 'flag_red', harvest_full: 'wheat', harvest_ready: 'wheat',
  battle_result: 'trophy', missions_claimable: 'daily_task', first_claim: 'pin', can_expand: 'castle',
  event_hold: 'event_ticket', event_open: 'event_ticket',
}
const NUDGE_COLOR: Record<string, string> = {
  under_attack: '#ef4444', territory_lost: '#ef4444', harvest_full: '#f59e0b', harvest_ready: '#34d058',
  battle_result: '#8b5cf6', missions_claimable: '#f5a623', first_claim: '#3b9bff', can_expand: '#3b9bff',
  event_hold: '#d946ef', event_open: '#d946ef',
}
const URGENT = new Set(['under_attack', 'harvest_full', 'battle_result', 'territory_lost', 'event_hold'])

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

/** Keeps the local owned-hex set equal to the server's (boosters, conquests and raids change it server-side). */
export function useOwnedSync() {
  const { data } = useLoopStatus()
  const size = useStore(s => s.myTerritories?.size ?? 0)
  const server = (data as any)?.territories as number | undefined
  useEffect(() => {
    if (server === undefined || server === size) return
    api.get('/territories-geo/mine/').then(r => {
      const list = r.data?.territories || []
      useStore.getState().setTerritories(list)
      useStore.setState({ myTerritories: new Set(list.map((t: any) => t.h3_index)) })
    }).catch(() => {})
  }, [server, size])
  return server ?? size
}

/** Back from Stripe Checkout (?hex_paid=<session>): verify the payment server-side and show the new balance. */
export function useHexPurchaseReturn() {
  const qc = useQueryClient()
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const sid = q.get('hex_paid'), cancel = q.get('hex_cancel')
    if (!sid && !cancel) return
    q.delete('hex_paid'); q.delete('hex_cancel')
    window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''))
    if (cancel) { toast('Payment cancelled — nothing was charged.'); return }
    api.post('/shop/hex-checkout/confirm/', { session_id: sid }).then(r => {
      const s = useStore.getState()
      s.setBalance({ ...(s.balance || {}), in_game: r.data.balance } as any)
      if (r.data.territory) {
        if (r.data.claimed) toast.success('Territory unlocked — it is yours!', { duration: 6000 })
        else toast(`Someone took that territory first — your ${Math.round(r.data.hex).toLocaleString()} HEX are on your balance.`, { duration: 7000 })
      } else toast.success(`+${Math.round(r.data.hex).toLocaleString()} HEX added to your balance!`, { duration: 6000 })
      ;['loop-status', 'wallet', 'wallet-me', 'player', 'kingdoms', 'my-territories'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    }).catch((e: any) => toast(e?.response?.data?.error || 'Payment received — your HEX will appear in a moment.', { duration: 6000 }))
  }, [])
}

export function useLoopActions() {
  const qc = useQueryClient()
  const syncBalance = (v: number) => {
    const s = useStore.getState()
    s.setBalance({ ...(s.balance || {}), in_game: v } as any)
  }
  const refresh = () => ['loop-status', 'daily-missions', 'wallet', 'kingdoms', 'my-army', 'codex-cards'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  const collect = useMutation({
    mutationFn: () => api.post('/loop/collect/').then(r => r.data),
    onSuccess: (d: any) => {
      const res = Object.entries((d.resources_collected || {}) as Record<string, number>).sort((a, b) => b[1] - a[1])
      const resTxt = res.length ? ` · ${res.slice(0, 3).map(([k, v]) => `+${Math.floor(v)} ${k}`).join(', ')}${res.length > 3 ? ` +${res.length - 3} more` : ''}` : ''
      if (d.collected > 0) playSound('collect')
      if (d.collected > 0) toast.success(`+${d.collected.toLocaleString()} HEX collected${resTxt}`, { duration: 4000 })
      else toast(d.message || 'Nothing to collect yet')
      if (d.lost > 0) toast.error(`${d.lost.toLocaleString()} HEX lost — your stock was full. Come back sooner!`, { duration: 5000 })
      syncBalance(d.balance); refresh()
    },
    onError: (e: any) => { playSound('error'); toast.error(e?.response?.data?.error || 'Collect failed') },
  })
  const reinforce = useMutation({
    mutationFn: (battle_id: string) => api.post('/combat/reinforce/', { battle_id }).then(r => r.data),
    onSuccess: (d: any) => { playSound('reinforce'); toast.success(`Defenses ${Math.round(d.defense_points)}/${Math.round(d.max)}`); refresh() },
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
  // Same button = back to my main kingdom (owner 2026-10-18): collect if there is stock, and fly home
  const player = useStore(st => st.player)
  const { data: kd } = useQuery<any>({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000, enabled: !!player,
  })
  const goHome = () => {
    const ks = kd?.kingdoms || []
    const main = ks.find((k: any) => k.is_main) || ks[0]
    if (main?.centroid_lat) window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat: main.centroid_lat, lon: main.centroid_lon, zoom: 14 } }))
  }
  if (!data || !data.harvest.rate_per_day) return null

  // Live estimate between polls (server stays the source of truth on collect)
  const h = data.harvest
  const capMs = h.cap_hours * 3600e3
  const startMs = new Date(h.full_at).getTime() - capMs
  const pct = Math.min(100, Math.max(0, ((Date.now() - startMs) / capMs) * 100))
  const pending = Math.floor((h.cap_amount * pct) / 100)
  const full = pct >= 100
  // Low-rate first zone: the counter sits at +0 for a while — say when the next whole HEX lands
  const exact = (h.cap_amount * pct) / 100
  const nextHexMin = h.rate_per_day > 0 ? Math.ceil(((1 - (exact % 1)) / h.rate_per_day) * 1440) : 0

  return (
    <button
      className={`hx-harvest ${full ? 'is-full' : ''}`}
      onClick={() => { if (pending > 0) collect.mutate(); goHome() }}
      disabled={collect.isPending}
      aria-label={pending > 0 ? `Collect ${pending} HEX and go to my kingdom` : 'Go to my kingdom'}
      title="Collect and fly back to your kingdom"
    >
      <span className="hx-harvest__icon"><IconSVG id="wheat" size={30} /></span>
      <span className="hx-harvest__body">
        <span className="hx-harvest__label">{full ? 'STOCK FULL!' : 'HARVEST'}
          <span style={{ marginLeft: 6, opacity: 0.85, display: 'inline-flex', verticalAlign: 'middle' }}><IconSVG id="castle" size={14} /></span></span>
        <span className="hx-harvest__value">+{pending.toLocaleString()}</span>
        <span className="hx-progress" style={{ ['--accent' as any]: full ? '#f59e0b' : '#34d058', height: 10 }}>
          <span className="hx-progress__fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="hx-harvest__sub">{full
          ? `${(h.lost || 0).toLocaleString()} HEX lost so far`
          : pending < 1
            ? `First HEX in ${nextHexMin} min · ${Math.round(h.rate_per_day).toLocaleString()}/day`
            : `Full in ${fmtIn(h.full_at)} · ${Math.round(h.rate_per_day).toLocaleString()}/day`}
          {(h.beginner_mult ?? 1) > 1 ? ` · x${h.beginner_mult} starter` : ''}</span>
      </span>
    </button>
  )
}

export function NudgeStack() {
  const { data } = useLoopStatus()
  const { collect, reinforce } = useLoopActions()
  const setActivePanel = useStore(s => s.setActivePanel)
  const ownsLand = useStore(s => (s.myTerritories?.size ?? 0) > 0)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const notified = useRef<Set<string>>(new Set())
  const [perm, setPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  const [alertsHidden, setAlertsHidden] = useState(() => { try { return localStorage.getItem('hx_alerts_hidden') === '1' } catch { return false } })
  const askAlerts = perm === 'default' && ownsLand && !alertsHidden

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

  if (!nudges.length && !askAlerts) return null
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
      {askAlerts && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="hx-nudge__alerts" onClick={() => Notification.requestPermission().then(setPerm)}>
            Turn on alerts — know when you're attacked
          </button>
          <button className="hx-nudge__x" aria-label="Hide" style={{ position: 'static' }}
            onClick={() => { setAlertsHidden(true); try { localStorage.setItem('hx_alerts_hidden', '1') } catch { /* ignore */ } }}>×</button>
        </div>
      )}
    </div>
  )
}
