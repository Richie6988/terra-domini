/**
 * SessionLoop — the "5-minute session" HUD (owner, 2026-10-17).
 * HarvestButton: territories fill a stock capped at 8h; collect it or lose production.
 * NotificationBell (top bar inbox) + NudgeStack (toast for urgent alerts only), from GET /api/loop/status/.
 * Browser notifications (opt-in) fire for urgent nudges when the tab is in the background.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Home } from 'lucide-react'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { IconSVG } from './iconBank'
import { openBattle } from '../combat/BattleFaceOff'
import { celebrate } from './Celebrate'
import { playSound } from '../../hooks/useSound'

interface Nudge {
  id: string; type: string; priority: number; title: string; body: string
  ends_at?: string; battle_id?: string
  cta: { label: string; action?: 'collect' | 'reinforce'; panel?: string; tab?: string } | null
}
interface LoopStatus {
  balance: number; earned_balance: number
  harvest: { rate_per_day: number; pending: number; cap_amount: number; cap_hours: number; fill_pct: number; is_full: boolean; full_at: string; lost: number; beginner_mult?: number; beginner_until?: string | null }
  streak: { current: number; reward_today: number }
  nudges: Nudge[]
}

const NUDGE_ICON: Record<string, string> = {
  under_attack: 'swords', territory_lost: 'flag_red', harvest_full: 'wheat', harvest_ready: 'wheat',
  battle_result: 'trophy', missions_claimable: 'daily_task', first_claim: 'pin', can_expand: 'castle',
  event_hold: 'event_ticket', event_open: 'event_ticket', region_threat: 'flag_red', region_close: 'crown',
}
const NUDGE_COLOR: Record<string, string> = {
  under_attack: '#ef4444', territory_lost: '#ef4444', harvest_full: '#f59e0b', harvest_ready: '#34d058',
  battle_result: '#8b5cf6', missions_claimable: '#f5a623', first_claim: '#3b9bff', can_expand: '#3b9bff',
  event_hold: '#d946ef', event_open: '#d946ef', region_threat: '#f97316', region_close: '#fbbf24',
}
const URGENT = new Set(['under_attack', 'harvest_full', 'battle_result', 'territory_lost', 'event_hold', 'region_threat'])

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
      if (d.collected > 0) { playSound('collect'); celebrate(d.collected >= 2000 ? 'big' : 'small', `+${Math.floor(d.collected).toLocaleString()} HEX`) }
      if (d.collected > 0) toast.success(`+${d.collected.toLocaleString()} HEX collected`, { duration: 4000 })
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

  // Compact pill (owner 2026-10-19): progress ring around the icon, amount, time left; separate HOME button
  return (
    <div className={`hx-harvest ${full ? 'is-full' : ''}`}>
      <button className="hx-harvest__main" onClick={() => { if (pending > 0) collect.mutate() }} disabled={collect.isPending || pending < 1}
        aria-label={pending > 0 ? `Collect ${pending} HEX` : 'Harvest filling'} title="Collect your harvest">
        <span className="hx-harvest__ring" style={{ ['--p' as any]: pct }}><span><IconSVG id="hex_coin" size={22} /></span></span>
        <span className="hx-harvest__body">
          <span className="hx-harvest__value">+{pending.toLocaleString()}</span>
          <span className="hx-harvest__sub">{full
            ? `FULL · ${(h.lost || 0).toLocaleString()} lost`
            : pending < 1 ? `first HEX in ${nextHexMin} min` : `full in ${fmtIn(h.full_at)}`}
            {(h.beginner_mult ?? 1) > 1 ? ` · x${h.beginner_mult}` : ''}</span>
        </span>
      </button>
      <button className="hx-harvest__home" onClick={goHome} aria-label="Back to my kingdom" title={`Back to my kingdom · ${Math.round(h.rate_per_day).toLocaleString()} HEX/day`}>
        <Home size={18} strokeWidth={2.6} />
      </button>
    </div>
  )
}

// Dismissed alerts, shared by the bell inbox and the toasts (kept for the session)
const _dismissed = new Set<string>()
const _subs = new Set<() => void>()
function useDismissed(): [Set<string>, (id: string | string[]) => void] {
  const [, bump] = useState(0)
  useEffect(() => { const f = () => bump(n => n + 1); _subs.add(f); return () => { _subs.delete(f) } }, [])
  return [_dismissed, (id) => { (Array.isArray(id) ? id : [id]).forEach(x => _dismissed.add(x)); _subs.forEach(f => f()) }]
}

function useNudgeActions() {
  const { collect } = useLoopActions()
  const setActivePanel = useStore(s => s.setActivePanel)
  return (n: Nudge) => {
    if (!n.cta) return
    if (n.cta.action === 'collect') collect.mutate()
    else if (n.cta.action === 'reinforce' && n.battle_id) openBattle(n.battle_id)   // war room: troops, walls, bonus
    else if (n.cta.panel) {
      if (n.cta.tab) try { sessionStorage.setItem(`hx_tab_${n.cta.panel}`, n.cta.tab) } catch {}   // open on that tab
      setActivePanel(n.cta.panel as any)
    }
  }
}

/** Bell in the top bar: badge = live alerts, click = inbox (every alert, its action, dismiss). */
export function NotificationBell() {
  const { data } = useLoopStatus()
  const [dismissed, dismiss] = useDismissed()
  const run = useNudgeActions()
  const [open, setOpen] = useState(false)
  const ownsLand = useStore(s => (s.myTerritories?.size ?? 0) > 0)
  const [perm, setPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  const list = (data?.nudges || []).filter(n => !dismissed.has(n.id) && !n.type.startsWith('harvest'))
  const urgent = list.some(n => URGENT.has(n.type))
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.hx-bell, .hx-inbox')) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <>
      <button className={`hx-bell${urgent ? ' is-urgent' : ''}`} aria-label={`Notifications (${list.length})`}
        onClick={() => { setOpen(o => !o); playSound('click') }}>
        <Bell size={22} strokeWidth={2.5} />
        {list.length > 0 && <span className="hx-bell__badge">{list.length > 9 ? '9+' : list.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="hx-inbox" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
            <div className="hx-inbox__head">
              <span>NOTIFICATIONS</span>
              {list.length > 0 && <button onClick={() => dismiss(list.map(n => n.id))}>CLEAR ALL</button>}
            </div>
            {list.length === 0 && <div className="hx-inbox__empty">All quiet on your borders.</div>}
            {list.map(n => (
              <div key={n.id} className="hx-inbox__item" style={{ ['--accent' as any]: NUDGE_COLOR[n.type] || '#3b9bff' }}>
                <span className="hx-inbox__icon"><IconSVG id={NUDGE_ICON[n.type] || 'megaphone'} size={22} /></span>
                <span className="hx-inbox__text">
                  <b>{n.title}</b>
                  <span>{n.body}</span>
                </span>
                <span className="hx-inbox__acts">
                  {n.cta && <button className="btn-game btn-game-gold" onClick={() => { run(n); setOpen(false) }}>{n.cta.label}</button>}
                  <button className="hx-inbox__x" aria-label="Dismiss" onClick={() => dismiss(n.id)}>×</button>
                </span>
              </div>
            ))}
            {perm === 'default' && ownsLand && (
              <button className="hx-inbox__alerts" onClick={() => Notification.requestPermission().then(setPerm)}>
                Turn on phone/desktop alerts — know when you're attacked
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Toasts for urgent alerts only (attack, battle result, live event): one slim banner at the top, 7 s, then it lives
 *  in the bell inbox. Background browser notifications when the tab is hidden. */
export function NudgeStack() {
  const { data } = useLoopStatus()
  const [dismissed, dismiss] = useDismissed()
  const run = useNudgeActions()
  const seen = useRef<Set<string>>(new Set())
  const [toastN, setToastN] = useState<Nudge | null>(null)

  useEffect(() => {
    if (!data) return
    const fresh = data.nudges.find(n => URGENT.has(n.type) && !n.type.startsWith('harvest') && !seen.current.has(n.id) && !dismissed.has(n.id))
    for (const n of data.nudges) if (URGENT.has(n.type) && !seen.current.has(n.id) && document.hidden
      && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(`HEXOD — ${n.title}`, { body: n.body, icon: '/favicon.svg', tag: n.id }) } catch { /* ignore */ }
    }
    if (fresh && !toastN) {
      seen.current.add(fresh.id)
      setToastN(fresh)
      playSound(fresh.type === 'under_attack' ? 'battle' : 'notify')
    }
    data.nudges.forEach(n => { if (URGENT.has(n.type) && document.hidden) seen.current.add(n.id) })
  }, [data, toastN]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toastN) return
    const t = setTimeout(() => setToastN(null), 7000)
    return () => clearTimeout(t)
  }, [toastN])

  return (
    <AnimatePresence>
      {toastN && (
        <motion.div key={toastN.id} className={`hx-toastn${toastN.type === 'under_attack' ? ' is-urgent' : ''}`}
          style={{ ['--accent' as any]: NUDGE_COLOR[toastN.type] || '#3b9bff' }}
          initial={{ opacity: 0, y: -30, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -30, x: '-50%' }}>
          <IconSVG id={NUDGE_ICON[toastN.type] || 'megaphone'} size={24} />
          <span className="hx-toastn__text"><b>{toastN.title}</b><span>{toastN.body}</span></span>
          {toastN.cta && <button className="btn-game btn-game-gold" onClick={() => { run(toastN); setToastN(null) }}>{toastN.cta.label}</button>}
          <button className="hx-inbox__x" aria-label="Close" onClick={() => { dismiss(toastN.id); setToastN(null) }}>×</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
