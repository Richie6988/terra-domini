/**
 * EventsPanel — Daily Events Mode (deep).
 * News/sport/world events create unique special tokens.
 * Register → luck skill impacts loot → countdown → reveal.
 * Potion de Chance from shop boosts odds.
 * Won tokens can be placed adjacent to captured territories.
 * 
 * 3 tabs: Live | Upcoming | My Results
 */
import { rarityLabel } from '../../services/balance'
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import { IconSVG } from '../shared/iconBank'
import { TokenFace2D } from '../shared/TokenFace2D'
import type { TierKey } from '../shared/hexodTokenFace'
import { FLAT_CATEGORIES } from '../shared/radarIconData'
import { Clock, MapPin, Users, Check, CalendarClock, Trophy } from 'lucide-react'

const RARITY_TIER: Record<string, TierKey> = { common: 'SILVER', uncommon: 'GOLD', rare: 'EMERALD', epic: 'DIAMOND', legendary: 'DIAMOND', mythic: 'DIAMOND' }
const RARITY_COLORS: Record<string, string> = {
  common: '#cbd5e1', uncommon: '#fbbf24', rare: '#10b981',
  epic: '#67e8f9', legendary: '#67e8f9', mythic: '#67e8f9',
}

interface Props { onClose: () => void }

const TABS = [
  { id: 'live', label: 'LIVE', iconId: 'dot_red' },
  { id: 'upcoming', label: 'UPCOMING', iconId: 'compass' },
  { id: 'results', label: 'MY RESULTS', iconId: 'medal' },
]

// Unified event type from API
interface NewsEventData {
  id: string; headline: string; summary: string; image_url: string
  source_name: string; source_url: string
  location_name: string; latitude: number; longitude: number
  category: string; rarity: string; status: string
  hex_reward: number; max_participants: number; registration_cost: number
  registered_count: number; time_remaining: number; is_active: boolean
  starts_at: string; ends_at: string; published_at: string
  my_registered: boolean; my_result: string | null
  event_kind?: string; h3_index?: string; poi_name?: string; holder?: string | null; i_hold?: boolean
  my_hex_earned: number; my_serial: number | null
  editions?: number; draw_slots?: number; tickets?: number; my_luck?: number; my_chance?: number | null; luck_potion_active?: boolean
  my_tickets?: number; next_ticket_cost?: number | null
}

interface MyResultData {
  id: string; event_id: string; headline: string; image_url: string
  location_name: string; category: string; rarity: string; color: string
  result: string; hex_earned: number; serial: number | null; max_serial: number
  luck_bonus: number; registered_at: string; event_ended: boolean
}

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic']

export function EventsPanel({ onClose }: Props) {
  const [tab, setTab] = useState('live')
  const setActivePanel = useStore(s => s.setActivePanel)

  // Real API queries
  const { data: eventsData, refetch: refetchEvents } = useQuery({
    queryKey: ['news-events'],
    queryFn: () => api.get('/events/news/').then(r => r.data?.results || []).catch(() => []),
    staleTime: 30000,
  })

  const { data: resultsData, refetch: refetchResults } = useQuery({
    queryKey: ['news-my-results'],
    queryFn: () => api.get('/events/news/my-results/').then(r => r.data?.results || []).catch(() => []),
    staleTime: 30000,
    enabled: tab === 'results',
  })

  const events: NewsEventData[] = eventsData || []
  const liveEvents = events.filter(e => e.is_active)
  const upcomingEvents = events.filter(e => !e.is_active && e.time_remaining > 0)
  const results: MyResultData[] = resultsData || []

  // Countdown for display
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const formatTime = (s: number) => {
    if (s <= 0) return 'ENDED'
    if (s > 86400) return `${Math.floor(s/86400)}D ${Math.floor((s%86400)/3600)}H`
    const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  const handleRegister = async (ev: NewsEventData) => {
    try {      // as many tickets as wanted: each one is one more chance, the price climbs with every ticket of the day
      const { data: r } = await api.post(`/events/news/${ev.id}/register/`)
      toast.success(`Ticket ${r.event?.my_tickets ?? 1} bought — ${r.event?.my_chance ?? '?'}% chance to get one of the ${ev.editions || 10} tokens`)
      const st = useStore.getState(); st.setBalance({ ...(st.balance || {}), in_game: r.remaining_balance } as any)
      refetchEvents()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Registration failed')
    }
  }

  const [revealedResults, setRevealedResults] = useState<Set<string>>(new Set())
  const handleReveal = (id: string) => setRevealedResults(prev => new Set([...prev, id]))

  const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const

  const player = useStore(s => s.player) as any
  const mono = "'Share Tech Mono', monospace"
  const body = { fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 } as const
  const catInfo = (id: string) => {
    const f = FLAT_CATEGORIES[id]
    const dark = (h: string) => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); if (!m) return true; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 70 }
    const color = f ? (dark(f.cat_color) ? f.categoryColor : f.cat_color) : '#f97316'
    return { name: f?.name || (id || 'Event'), color }
  }
  const counts: Record<string, number> = { live: liveEvents.length, upcoming: upcomingEvents.length, results: results.length }

  return (
    <GlassPanel title="EVENTS" onClose={onClose} accent="#f97316"
      icon={<IconSVG id="event_ticket" size={24} />} subtitle="World news becomes unique tokens">

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.id === 'live'
              ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              : t.id === 'upcoming' ? <CalendarClock size={14} /> : <Trophy size={14} />}
            {t.label}
            {(t.id !== 'results' || resultsData) && <span className="hx-chip" style={{ padding: '1px 6px' }}>{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ LIVE TAB ═══ */}
        {tab === 'live' && (
          <motion.div key="live" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {liveEvents.length === 0 && (
              <div className="hx-empty">
                <IconSVG id="news" size={48} />
                <div className="hx-empty__title">NO LIVE EVENTS</div>
                <div style={body}>Real matches and strategic points in the news appear here every hour. Hold their hex when the event ends to win the bounty.</div>
                {player?.is_staff && <code style={{ fontFamily: mono, fontSize: 11, color: 'var(--hx-text-2)', textTransform: 'none' }}>python manage.py world_events</code>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
            {liveEvents.map((ev, i) => {
              const color = RARITY_COLORS[ev.rarity] || '#94a3b8'
              const cat = catInfo(ev.category)
              const pctFull = ev.max_participants > 0 ? Math.floor((ev.registered_count / ev.max_participants) * 100) : 0
              const remaining = ev.time_remaining - tick
              return (
                <div key={ev.id} className="hx-card hx-rise" style={{
                  animationDelay: `${Math.min(i, 10) * 40}ms`, ['--accent' as any]: color,
                  display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden',
                  borderColor: ev.my_registered ? color + '88' : undefined,
                  background: `linear-gradient(160deg, ${cat.color}1f 0%, rgba(255,255,255,0.03) 45%)`,
                }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: cat.color, boxShadow: `0 0 10px ${cat.color}` }} />
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <TokenFace2D
                      tier={RARITY_TIER[ev.rarity] || 'SILVER'}
                      category={ev.category?.toUpperCase() || 'EVENT'}
                      catColor={color}
                      biome={ev.location_name || 'GLOBAL'}
                      tokenName={ev.headline.split(' — ')[0]?.slice(0, 20) || 'EVENT'}
                      iconId={ev.category || 'news'}
                      imageSrc={ev.image_url}
                      serial={ev.my_serial || ev.editions || 10}
                      maxSupply={ev.editions || 10}
                      size={64}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span className="hx-chip" style={{ color: cat.color, borderColor: cat.color + '66' }}><IconSVG id={ev.category || 'news'} size={12} /> {(cat.name || '').toUpperCase()}</span>
                        <span className="hx-chip hx-chip--accent">{rarityLabel(ev.rarity)}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', letterSpacing: 1, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.headline}</div>
                      <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, ...body }}><MapPin size={11} /> {ev.location_name} · {ev.source_name}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--hx-text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', ...body }}>
                    {ev.summary}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="hx-chip" style={{ fontFamily: mono, fontSize: 11, color: remaining < 3600 ? '#f87171' : '#fdba74' }}><Clock size={11} /> {formatTime(remaining)}</span>
                    <span className="hx-chip" style={{ color: '#fbbf24' }}><IconSVG id="hex_coin" size={12} /> +{ev.hex_reward} REWARD</span>
                    {ev.h3_index
                      ? <span className="hx-chip" style={{ color: ev.i_hold ? '#86efac' : ev.holder ? '#fca5a5' : 'var(--hx-text-2)' }}>
                          {ev.i_hold ? 'YOU HOLD IT' : ev.holder ? `HELD BY ${ev.holder.toUpperCase()}` : 'UNCLAIMED'}</span>
                      : <span className="hx-chip"><Users size={11} /> {ev.registered_count}/{ev.max_participants}</span>}
                    {ev.h3_index && <span className="hx-chip" style={{ color: '#f0abfc' }}>x3 PRODUCTION</span>}
                  </div>
                  {!ev.h3_index && <div className="hx-progress"><div className="hx-progress__fill" style={{ width: `${pctFull}%` }} /></div>}

                  {/* Only 10 numbered tokens: #1 to the hex holder, the others drawn among the tickets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
                                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <div style={{ flex: 1, fontSize: 10, color: 'var(--hx-text-2)', lineHeight: 1.45, ...body }}>
                      <b style={{ color: '#fbbf24', fontFamily: mono, fontSize: 12 }}>{ev.editions || 10} TOKENS ONLY</b> · {ev.tickets ?? ev.registered_count} tickets
                      <br />{ev.h3_index ? `#1 to the holder, ${ev.draw_slots ?? 9} drawn at the end` : `${ev.draw_slots ?? 10} drawn at the end`} · resell them to collectors
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {ev.my_registered && <span className="hx-chip" style={{ color: '#86efac' }}><Check size={11} /> {ev.my_tickets || 1} TICKET{(ev.my_tickets || 1) > 1 ? 'S' : ''}{ev.my_chance != null ? ` · ${ev.my_chance}%` : ''}</span>}
                      <button onClick={() => handleRegister(ev)} className="btn-game btn-game-gold"
                              style={{ padding: '8px 10px', fontSize: 10, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ev.my_registered ? '+1 TICKET' : 'TICKET'} · {(ev.next_ticket_cost ?? ev.registration_cost) === 0 ? 'FREE' : <><IconSVG id="hex_coin" size={12} />{(ev.next_ticket_cost ?? ev.registration_cost).toLocaleString()}</>}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: ev.luck_potion_active ? '#86efac' : 'var(--hx-text-3)', display: 'flex', alignItems: 'center', gap: 6, ...body }}>
                    {ev.luck_potion_active
                      ? <>Luck potion active: x2.5 chances on your tickets</>
                      : <>Luck potion: x2.5 chances <button onClick={() => { onClose(); useStore.getState().setActivePanel('shop') }}
                          className="hx-chip" style={{ cursor: 'pointer' }}>GET ONE</button></>}
                  </div>

                  {ev.h3_index && (
                    <button className={ev.i_hold ? 'btn-game btn-game-green' : 'btn-game btn-game-red'}
                      onClick={() => { window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat: ev.latitude, lon: ev.longitude, zoom: 15 } })); onClose() }}
                      style={{ width: '100%', fontSize: 11, letterSpacing: 1 }}>
                      {ev.i_hold ? 'DEFEND IT: TOKEN #1 IS YOURS' : ev.holder ? 'ATTACK IT FOR TOKEN #1' : 'CLAIM IT FOR TOKEN #1'} · {ev.poi_name}
                    </button>
                  )}
                </div>
              )
            })}
            </div>
          </motion.div>
        )}

        {/* ═══ UPCOMING TAB ═══ */}
        {tab === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {upcomingEvents.length === 0 && (
              <div className="hx-empty">
                <CalendarClock size={40} color="#fb923c" />
                <div className="hx-empty__title">NO UPCOMING EVENTS</div>
                <div style={body}>Scheduled events will show up here before they go live.</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingEvents.map((ev, i) => {
              const color = RARITY_COLORS[ev.rarity] || '#94a3b8'
              const remaining = ev.time_remaining - tick
              const isSoon = remaining < 10800
              return (
                <div key={ev.id} className="hx-card hx-rise" style={{
                  animationDelay: `${Math.min(i, 10) * 40}ms`, ['--accent' as any]: color,
                  display: 'flex', alignItems: 'center', gap: 12, borderColor: isSoon ? color + '66' : undefined,
                }}>
                  <TokenFace2D
                    tier={RARITY_TIER[ev.rarity] || 'SILVER'}
                    category={ev.category?.toUpperCase() || 'EVENT'}
                    catColor={color}
                    biome={ev.location_name || 'GLOBAL'}
                    tokenName={ev.headline.split(' — ')[0]?.slice(0, 20) || 'EVENT'}
                    iconId={ev.category || 'news'}
                    imageSrc={ev.image_url}
                    size={52}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.headline}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span className="hx-chip hx-chip--accent">{rarityLabel(ev.rarity)}</span>
                      <span className="hx-chip"><MapPin size={11} /> {ev.location_name}</span>
                      <span className="hx-chip">{ev.registration_cost === 0 ? 'FREE' : `${ev.registration_cost} HEX`} · {ev.max_participants} MAX</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)' }}>STARTS IN</div>
                    <div style={{ fontSize: isSoon ? 18 : 15, color: isSoon ? '#f87171' : 'var(--hx-text-2)', fontFamily: mono, marginTop: 4 }}>
                      {formatTime(remaining)}
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
          </motion.div>
        )}

        {/* ═══ MY RESULTS TAB ═══ */}
        {tab === 'results' && (
          <motion.div key="results" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div className="hx-stat-grid" style={{ marginBottom: 14 }}>
              {[
                { l: 'WON', v: results.filter(r => r.result === 'won').length, c: '#fb923c' },
                { l: 'HEX EARNED', v: results.filter(r => r.result === 'won').reduce((acc, r) => acc + r.hex_earned, 0), c: '#fbbf24' },
                { l: 'EVENTS', v: results.length, c: '#4ade80' },
              ].map(st => (
                <div key={st.l} className="hx-card hx-stat">
                  <span className="hx-stat__label">{st.l}</span>
                  <span className="hx-stat__value" style={{ color: st.c }}>{st.v.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {results.length === 0 && (
              <div className="hx-empty">
                <Trophy size={40} color="#fb923c" />
                <div className="hx-empty__title">NO RESULTS YET</div>
                <div style={body}>Register for a live event to see your results here.</div>
                <button className="btn-game btn-game-gold" onClick={() => setTab('live')} style={{ marginTop: 6 }}>BROWSE LIVE EVENTS</button>
              </div>
            )}

            {results.map((r, i) => {
              const color = r.color || RARITY_COLORS[r.rarity] || '#94a3b8'
              const rc = r.result === 'won' ? '#4ade80' : r.result === 'pending' ? '#fb923c' : 'var(--hx-text-3)'
              return (
                <motion.div key={r.id} className="hx-card hx-rise" style={{
                  animationDelay: `${Math.min(i, 10) * 40}ms`, marginBottom: 8,
                  borderColor: r.result === 'won' ? color + '66' : undefined,
                  opacity: r.result === 'lost' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TokenFace2D
                      tier={RARITY_TIER[(r.rarity || "").toLowerCase()] || 'SILVER'}
                      category={r.category?.toUpperCase() || 'EVENT'}
                      catColor={color}
                      biome={r.location_name || 'EVENT'}
                      tokenName={r.headline?.slice(0, 20) || 'TOKEN'}
                      iconId={r.category || 'news'}
                      imageSrc={r.image_url}
                      serial={r.serial || 1}
                      maxSupply={r.max_serial || 1000}
                      size={52}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.headline}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <span className="hx-chip" style={{ color, borderColor: color + '55' }}>{rarityLabel(r.rarity)}</span>
                        {r.result === 'won' && r.serial && <span className="hx-chip" style={{ fontFamily: mono }}>#{r.serial}/{r.max_serial}</span>}
                        {r.luck_bonus > 0 && <span className="hx-chip" style={{ color: '#c084fc' }}>+{r.luck_bonus} LUCK</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {r.result === 'won' && (
                        <div style={{ fontSize: 18, color: '#fbbf24', fontFamily: mono, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconSVG id="hex_coin" size={14} />+{r.hex_earned}
                        </div>
                      )}
                      <span className="hx-chip" style={{ color: rc, marginTop: 6 }}>
                        {r.result === 'won' ? 'WON' : r.result === 'pending' ? 'PENDING' : 'MISSED'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  )
}
