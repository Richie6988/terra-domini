/**
 * EventsPanel — Daily Events Mode (deep).
 * News/sport/world events create unique special tokens.
 * Register → luck skill impacts loot → countdown → reveal.
 * Potion de Chance from shop boosts odds.
 * Won tokens can be placed adjacent to captured territories.
 * 
 * 3 tabs:  Live | ⏳ Upcoming |  My Results
 */
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

const RARITY_TIER: Record<string, TierKey> = { common: 'BRONZE', uncommon: 'BRONZE', rare: 'SILVER', epic: 'GOLD', legendary: 'EMERALD', mythic: 'DIAMOND' }
const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
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
  my_hex_earned: number; my_serial: number | null
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
    if (ev.my_registered) return
    try {
      await api.post(`/events/news/${ev.id}/register/`)
      toast.success(`Registered for ${ev.headline.slice(0, 40)}! Cost: ${ev.registration_cost} HEX`)
      refetchEvents()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Registration failed')
    }
  }

  const [revealedResults, setRevealedResults] = useState<Set<string>>(new Set())
  const handleReveal = (id: string) => setRevealedResults(prev => new Set([...prev, id]))

  const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const

  return (
    <GlassPanel title="EVENTS" onClose={onClose} accent="#f97316">

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px', borderRadius: 16, cursor: 'pointer',
            fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.04)',
            color: tab === t.id ? '#f97316' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${tab === t.id ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
            ...s,
          }}><IconSVG id={t.iconId} size={10} /> {t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ LIVE TAB ═══ */}
        {tab === 'live' && (
          <motion.div key="live" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {liveEvents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 9, ...s }}>
                No live events. Run: python manage.py fetch_news --demo
              </div>
            )}
            {liveEvents.map(ev => {
              const color = RARITY_COLORS[ev.rarity] || '#94a3b8'
              const spotsLeft = ev.max_participants - ev.registered_count
              const pctFull = Math.floor((ev.registered_count / ev.max_participants) * 100)
              return (
                <div key={ev.id} style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                  background: ev.my_registered ? `${color}06` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${ev.my_registered ? color + '30' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <TokenFace2D
                        tier={RARITY_TIER[ev.rarity] || 'BRONZE'}
                        category={ev.category?.toUpperCase() || 'EVENT'}
                        catColor={color}
                        biome={ev.location_name || 'GLOBAL'}
                        tokenName={ev.headline.split(' — ')[0]?.slice(0, 20) || 'EVENT'}
                        iconId={ev.category || 'news'}
                        imageSrc={ev.image_url}
                        serial={ev.registered_count + 1}
                        maxSupply={ev.max_participants}
                        size={52}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: 1, ...s, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.headline}</div>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}><IconSVG id="pin" size={8} /> {ev.location_name} · {ev.source_name}</div>
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 6, fontWeight: 700,
                      background: color + '15', color, border: `1px solid ${color}30`, ...s, flexShrink: 0,
                    }}>{ev.rarity.toUpperCase()}</span>
                  </div>

                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 8, fontFamily: 'system-ui' }}>
                    {ev.summary?.slice(0, 150)}
                  </div>

                  {/* Capacity bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'rgba(255,255,255,0.3)', marginBottom: 3, ...s }}>
                      <span>{ev.registered_count}/{ev.max_participants} REGISTERED</span>
                      <span>{formatTime(ev.time_remaining - tick)} LEFT</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pctFull}%`, borderRadius: 2, background: color, transition: 'width 0.5s' }} />
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => handleRegister(ev)}
                    disabled={ev.my_registered}
                    className={ev.my_registered ? 'btn-game btn-game-glass' : 'btn-game btn-game-blue'}
                    style={{
                      width: '100%', fontSize: 9, letterSpacing: 1,
                      opacity: ev.my_registered ? 0.7 : 1,
                    }}
                  >
                    {ev.my_registered ? 'REGISTERED' : `REGISTER — ${ev.registration_cost} HEX`}
                  </button>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* ═══ UPCOMING TAB ═══ */}
        {tab === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {upcomingEvents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 9, ...s }}>
                No upcoming events
              </div>
            )}
            {upcomingEvents.map(ev => {
              const color = RARITY_COLORS[ev.rarity] || '#94a3b8'
              const remaining = ev.time_remaining - tick
              const isSoon = remaining < 10800
              return (
                <div key={ev.id} style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                  background: isSoon ? `${color}05` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSoon ? color + '25' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TokenFace2D
                      tier={RARITY_TIER[ev.rarity] || 'BRONZE'}
                      category={ev.category?.toUpperCase() || 'EVENT'}
                      catColor={color}
                      biome={ev.location_name || 'GLOBAL'}
                      tokenName={ev.headline.split(' — ')[0]?.slice(0, 20) || 'EVENT'}
                      iconId={ev.category || 'news'}
                      imageSrc={ev.image_url}
                      size={44}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: 1, ...s }}>{ev.headline}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}><IconSVG id="pin" size={8} /> {ev.location_name} · {ev.rarity.toUpperCase()}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: isSoon ? 14 : 11, fontWeight: 900,
                        color: isSoon ? '#dc2626' : 'rgba(255,255,255,0.45)',
                        fontFamily: "'Share Tech Mono', monospace",
                      }}>
                        {formatTime(remaining)}
                      </div>
                      <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 2, ...s }}>
                        {ev.registration_cost === 0 ? 'FREE' : `${ev.registration_cost} HEX`} · {ev.max_participants} MAX
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* ═══ MY RESULTS TAB ═══ */}
        {tab === 'results' && (
          <motion.div key="results" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {/* Stats summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12,
              padding: '10px', borderRadius: 10, background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.12)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#f97316', fontFamily: "'Share Tech Mono'" }}>
                  {results.filter(r => r.result === 'won').length}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', ...s }}>WON</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>
                  {results.filter(r => r.result === 'won').reduce((acc, r) => acc + r.hex_earned, 0)}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', ...s }}>HEX EARNED</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e', fontFamily: "'Share Tech Mono'" }}>
                  {results.length}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', ...s }}>EVENTS</div>
              </div>
            </div>

            {results.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)', fontSize: 9, ...s }}>
                Register for events to see results here
              </div>
            )}

            {results.map(r => {
              const color = r.color || RARITY_COLORS[r.rarity] || '#94a3b8'
              return (
                <motion.div key={r.id} style={{
                  padding: '10px 14px', borderRadius: 12, marginBottom: 8,
                  background: r.result === 'won' ? `${color}06` : r.result === 'pending' ? 'rgba(251,191,36,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${r.result === 'won' ? color + '25' : r.result === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: r.result === 'lost' ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TokenFace2D
                      tier={RARITY_TIER[r.rarity?.toLowerCase()] || 'BRONZE'}
                      category={r.category?.toUpperCase() || 'EVENT'}
                      catColor={color}
                      biome={r.location_name || 'EVENT'}
                      tokenName={r.headline?.slice(0, 20) || 'TOKEN'}
                      iconId={r.category || 'news'}
                      imageSrc={r.image_url}
                      serial={r.serial || 1}
                      maxSupply={r.max_serial || 1000}
                      size={48}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: r.result === 'lost' ? 'rgba(255,255,255,0.4)' : color, letterSpacing: 1, ...s }}>
                        {r.headline}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 700, background: color + '12', color, ...s }}>{r.rarity?.toUpperCase()}</span>
                        {r.result === 'won' && r.serial && <span style={{ fontSize: 6, color: '#00884a' }}>#{r.serial}/{r.max_serial}</span>}
                        {r.luck_bonus > 0 && <span style={{ fontSize: 6, color: '#a855f7' }}>+{r.luck_bonus} LUCK</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {r.result === 'won' && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>+{r.hex_earned}</div>
                          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', ...s }}>HEX</div>
                        </>
                      )}
                      {r.result === 'pending' && (
                        <div style={{ fontSize: 8, color: '#f97316', fontWeight: 700, ...s }}>PENDING</div>
                      )}
                      {r.result === 'lost' && (
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', ...s }}>MISSED</div>
                      )}
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
