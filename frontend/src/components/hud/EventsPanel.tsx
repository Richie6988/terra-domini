/**
 * EventsPanel — Daily Events Mode (deep).
 * News/sport/world events create unique special tokens.
 * Register → luck skill impacts loot → countdown → reveal.
 * Potion de Chance from shop boosts odds.
 * Won tokens can be placed adjacent to captured territories.
 * 
 * 3 tabs: 🔴 Live | ⏳ Upcoming | 🎁 My Results
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props { onClose: () => void }

const TABS = [
  { id: 'live', label: '🔴 LIVE' },
  { id: 'upcoming', label: '⏳ UPCOMING' },
  { id: 'results', label: '🎁 MY RESULTS' },
]

interface GameEvent {
  id: string; icon: string; name: string; loc: string
  registered: number; maxPlayers: number; cost: number
  color: string; category: string; rarity: string
  desc: string; endsIn?: string; mine: boolean
}

const LIVE_EVENTS: GameEvent[] = [
  { id:'e1', icon:'🌋', name:'VOLCANIC ERUPTION — MT. HEKLA', loc:'ICELAND', registered:45, maxPlayers:100, cost:50, color:'#dc2626', category:'disaster', rarity:'epic', desc:'Active eruption detected. First responders get an exclusive Hekla Eruption token. Geo score: 95/100.', mine:false },
  { id:'e2', icon:'⚽', name:'CHAMPIONS LEAGUE FINAL', loc:'LONDON WEMBLEY', registered:312, maxPlayers:500, cost:75, color:'#3b82f6', category:'culture', rarity:'rare', desc:'The biggest match in European football. Register for a unique Final 2026 token. 312/500 spots taken.', mine:true },
  { id:'e3', icon:'🚀', name:'MARS COLONY SUPPLY DROP', loc:'CAPE CANAVERAL', registered:89, maxPlayers:200, cost:100, color:'#8b5cf6', category:'science', rarity:'legendary', desc:'SpaceX Starship mission. Legendary token for registered players. Luck skill determines loot tier.', mine:false },
  { id:'e4', icon:'🏆', name:'OLYMPIC CEREMONY — PARIS 2028', loc:'STADE DE FRANCE', registered:478, maxPlayers:1000, cost:30, color:'#f59e0b', category:'culture', rarity:'uncommon', desc:'Opening ceremony broadcast. Mass event — low cost, high participation. Uncommon token guaranteed.', mine:false },
  { id:'e5', icon:'🌊', name:'GREAT BARRIER REEF ALERT', loc:'AUSTRALIA', registered:23, maxPlayers:50, cost:150, color:'#22c55e', category:'nature', rarity:'legendary', desc:'Coral bleaching emergency. Only 50 tokens. High cost but legendary rarity guaranteed.', mine:false },
]

interface UpcomingEvent {
  id: string; icon: string; name: string; loc: string
  startsIn: number; color: string; category: string; rarity: string
  desc: string; cost: number; maxPlayers: number
}

const UPCOMING_EVENTS: UpcomingEvent[] = [
  { id:'u1', icon:'🌪', name:'HURRICANE SEASON TRACKER', loc:'GULF OF MEXICO', startsIn: 9900, color:'#f97316', category:'disaster', rarity:'rare', desc:'Track hurricane paths. Accurate predictions win rare tokens.', cost:60, maxPlayers:200 },
  { id:'u2', icon:'🏈', name:'SUPER BOWL LXI', loc:'NEW ORLEANS', startsIn: 172800, color:'#dc2626', category:'culture', rarity:'epic', desc:'The biggest American sports event. Epic token with team hologram.', cost:100, maxPlayers:500 },
  { id:'u3', icon:'🔭', name:'TOTAL SOLAR ECLIPSE', loc:'GREENLAND → SPAIN', startsIn: 604800, color:'#0099cc', category:'science', rarity:'legendary', desc:'Path of totality tokens. Location-based rarity — closer = rarer.', cost:80, maxPlayers:300 },
  { id:'u4', icon:'🎭', name:'VENICE BIENNALE OPENING', loc:'VENICE, ITALY', startsIn: 1209600, color:'#ec4899', category:'culture', rarity:'rare', desc:'Art world event. Token features actual exhibited artwork metadata.', cost:40, maxPlayers:150 },
  { id:'u5', icon:'☢', name:'CHERNOBYL MEMORIAL DAY', loc:'UKRAINE', startsIn: 2592000, color:'#64748b', category:'disaster', rarity:'epic', desc:'Annual memorial. Limited edition token with reactor 4 hologram.', cost:0, maxPlayers:1000 },
]

interface EventResult {
  id: string; icon: string; name: string; rarity: string
  color: string; serial: number; maxSerial: number
  status: 'won' | 'lost' | 'pending'; luckBonus: number
  hexEarned: number; placeable: boolean
}

const MY_RESULTS: EventResult[] = [
  { id:'r1', icon:'⚡', name:'SOLAR STORM 2026', rarity:'RARE', color:'#a855f7', serial:47, maxSerial:200, status:'won', luckBonus:12, hexEarned:150, placeable:true },
  { id:'r2', icon:'🌪', name:'TORNADO OUTBREAK — OKLAHOMA', rarity:'COMMON', color:'#64748b', serial:312, maxSerial:500, status:'won', luckBonus:0, hexEarned:25, placeable:true },
  { id:'r3', icon:'⚽', name:'EUROPA LEAGUE SEMI', rarity:'UNCOMMON', color:'#22c55e', serial:89, maxSerial:300, status:'won', luckBonus:5, hexEarned:50, placeable:true },
  { id:'r4', icon:'🚀', name:'ARTEMIS IV LAUNCH', rarity:'LEGENDARY', color:'#f59e0b', serial:3, maxSerial:50, status:'won', luckBonus:18, hexEarned:500, placeable:true },
  { id:'r5', icon:'🏆', name:'WIMBLEDON FINAL', rarity:'EPIC', color:'#8b5cf6', serial:0, maxSerial:100, status:'lost', luckBonus:8, hexEarned:0, placeable:false },
  { id:'r6', icon:'🌋', name:'ETNA ERUPTION', rarity:'RARE', color:'#dc2626', serial:0, maxSerial:150, status:'pending', luckBonus:0, hexEarned:0, placeable:false },
]

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic']

export function EventsPanel({ onClose }: Props) {
  const [tab, setTab] = useState('live')
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set(['e2']))
  const [countdowns, setCountdowns] = useState<Record<string,number>>({})
  const [revealedResults, setRevealedResults] = useState<Set<string>>(new Set())
  const setActivePanel = useStore(s => s.setActivePanel)

  // Load real events from API, fallback to built-in showcase events
  const { data: apiEvents } = useQuery({
    queryKey: ['game-events'],
    queryFn: () => api.get('/events/').then(r => r.data?.results || []).catch(() => []),
    staleTime: 60000,
  })
  const liveEvents: GameEvent[] = (apiEvents && apiEvents.length > 0)
    ? apiEvents.map((e: any) => ({
        id: e.id, icon: '📡', name: e.name?.toUpperCase(), loc: e.affected_countries?.[0] || 'GLOBAL',
        registered: 0, maxPlayers: 100, cost: 50, color: '#0099cc',
        category: e.event_type || 'world', rarity: 'rare',
        desc: e.description, mine: false,
      }))
    : LIVE_EVENTS  // Fallback to built-in showcase

  // Player luck stats (from player profile when available)
  const luckBase = 42
  const luckPotion = 15
  const luckTotal = luckBase + luckPotion

  // Countdown timers for upcoming events
  useEffect(() => {
    const init: Record<string,number> = {}
    UPCOMING_EVENTS.forEach(e => { init[e.id] = e.startsIn })
    setCountdowns(init)
    const iv = setInterval(() => {
      setCountdowns(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => { if (next[k] > 0) next[k]-- })
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const formatTime = (s: number) => {
    if (s > 86400) return `${Math.floor(s/86400)}D ${Math.floor((s%86400)/3600)}H`
    const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  const handleRegister = (ev: GameEvent) => {
    if (registeredIds.has(ev.id)) return
    setRegisteredIds(prev => new Set([...prev, ev.id]))
    toast.success(`✅ Registered for ${ev.name}! Cost: ${ev.cost} HEX`)
  }

  const handleReveal = (id: string) => {
    setRevealedResults(prev => new Set([...prev, id]))
  }

  const s = { fontFamily: "'Orbitron', system-ui, sans-serif" } as const

  return (
    <GlassPanel title="EVENTS" onClose={onClose} accent="#f97316">
      {/* Luck stat bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
        borderRadius: 10, marginBottom: 10,
        background: 'linear-gradient(90deg, rgba(251,191,36,0.06), rgba(168,85,247,0.06))',
        border: '1px solid rgba(251,191,36,0.15)',
      }}>
        <div style={{ fontSize: 20 }}><EmojiIcon emoji="🍀" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', letterSpacing: 2, ...s }}>YOUR LUCK RATING</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>{luckTotal}</span>
            <span style={{ fontSize: 7, color: 'rgba(26,42,58,0.35)' }}>/ 100</span>
            {luckPotion > 0 && <span style={{ fontSize: 7, color: '#a855f7', fontWeight: 700 }}>+{luckPotion} POTION</span>}
          </div>
        </div>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }} style={{
          padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)',
          color: '#a855f7', fontSize: 7, fontWeight: 700, letterSpacing: 1, ...s,
        }}><EmojiIcon emoji="🧪" /> BUY POTION</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px', borderRadius: 16, cursor: 'pointer',
            fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.5)',
            color: tab === t.id ? '#f97316' : 'rgba(26,42,58,0.45)',
            border: `1px solid ${tab === t.id ? 'rgba(249,115,22,0.3)' : 'rgba(0,60,100,0.1)'}`,
            ...s,
          }}>{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ LIVE TAB ═══ */}
        {tab === 'live' && (
          <motion.div key="live" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {LIVE_EVENTS.map(ev => {
              const isReg = registeredIds.has(ev.id)
              const spotsLeft = ev.maxPlayers - ev.registered
              const pctFull = Math.floor((ev.registered / ev.maxPlayers) * 100)
              return (
                <div key={ev.id} style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                  background: isReg ? `${ev.color}06` : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${isReg ? ev.color + '30' : 'rgba(0,60,100,0.1)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}><EmojiIcon emoji={ev.icon} size={16} /></span>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 900, color: ev.color, letterSpacing: 1, ...s }}>{ev.name}</div>
                          <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', marginTop: 1 }}><EmojiIcon emoji="📍" /> {ev.loc}</div>
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 6, fontWeight: 700,
                      background: ev.color + '15', color: ev.color, border: `1px solid ${ev.color}30`,
                      ...s,
                    }}>{ev.rarity.toUpperCase()}</span>
                  </div>

                  <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.5)', lineHeight: 1.6, marginBottom: 8, fontFamily: 'system-ui' }}>
                    {ev.desc}
                  </div>

                  {/* Capacity bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'rgba(26,42,58,0.35)', marginBottom: 3, ...s }}>
                      <span>{ev.registered}/{ev.maxPlayers} REGISTERED</span>
                      <span style={{ color: spotsLeft < 20 ? '#dc2626' : 'rgba(26,42,58,0.35)' }}>
                        {spotsLeft < 20 ? `⚠ ${spotsLeft} SPOTS LEFT` : `${spotsLeft} SPOTS`}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,60,100,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pctFull}%`, borderRadius: 2, background: ev.color, transition: 'width 0.5s' }} />
                    </div>
                  </div>

                  {/* Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handleRegister(ev)}
                      disabled={isReg}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 10, cursor: isReg ? 'default' : 'pointer',
                        background: isReg ? 'rgba(0,136,74,0.06)' : `${ev.color}10`,
                        border: `1px solid ${isReg ? 'rgba(0,136,74,0.25)' : ev.color + '30'}`,
                        color: isReg ? '#00884a' : ev.color,
                        fontSize: 8, fontWeight: 700, letterSpacing: 1, ...s,
                        opacity: isReg ? 0.7 : 1,
                      }}
                    >
                      {isReg ? '✅ REGISTERED' : `<EmojiIcon emoji="⚡" /> REGISTER — ${ev.cost} HEX`}
                    </button>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', ...s }}>LUCK</div>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>
                        {luckTotal}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* ═══ UPCOMING TAB ═══ */}
        {tab === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {UPCOMING_EVENTS.map(ev => {
              const remaining = countdowns[ev.id] ?? ev.startsIn
              const isSoon = remaining < 10800 // < 3h
              return (
                <div key={ev.id} style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                  background: isSoon ? `${ev.color}05` : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${isSoon ? ev.color + '25' : 'rgba(0,60,100,0.1)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}><EmojiIcon emoji={ev.icon} size={16} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: ev.color, letterSpacing: 1, ...s }}>{ev.name}</div>
                      <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', marginTop: 1 }}><EmojiIcon emoji="📍" /> {ev.loc} · {ev.rarity.toUpperCase()}</div>
                      <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.4)', marginTop: 2, fontFamily: 'system-ui' }}>{ev.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: isSoon ? 14 : 11, fontWeight: 900,
                        color: isSoon ? '#dc2626' : 'rgba(26,42,58,0.5)',
                        fontFamily: "'Share Tech Mono', monospace",
                        animation: isSoon ? 'blink 1s infinite' : 'none',
                      }}>
                        {formatTime(remaining)}
                      </div>
                      <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', marginTop: 2, ...s }}>
                        {ev.cost === 0 ? 'FREE' : `${ev.cost} HEX`} · {ev.maxPlayers} MAX
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <style>{`@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
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
                  {MY_RESULTS.filter(r => r.status === 'won').length}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.35)', ...s }}>WON</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>
                  {MY_RESULTS.filter(r => r.status === 'won').reduce((s,r) => s + r.hexEarned, 0)}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.35)', ...s }}>HEX EARNED</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e', fontFamily: "'Share Tech Mono'" }}>
                  {MY_RESULTS.filter(r => r.placeable).length}
                </div>
                <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.35)', ...s }}>PLACEABLE</div>
              </div>
            </div>

            {MY_RESULTS.map(r => {
              const isRevealed = revealedResults.has(r.id) || r.status !== 'pending'
              return (
                <motion.div key={r.id} style={{
                  padding: '10px 14px', borderRadius: 12, marginBottom: 8,
                  background: r.status === 'won' ? `${r.color}06` : r.status === 'pending' ? 'rgba(251,191,36,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${r.status === 'won' ? r.color + '25' : r.status === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(0,60,100,0.06)'}`,
                  opacity: r.status === 'lost' ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}><EmojiIcon emoji={r.icon} size={16} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: r.status === 'lost' ? 'rgba(26,42,58,0.4)' : r.color, letterSpacing: 1, ...s }}>
                        {r.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 700, background: r.color + '12', color: r.color, ...s }}>{r.rarity}</span>
                        {r.status === 'won' && <span style={{ fontSize: 6, color: '#00884a' }}>#{r.serial}/{r.maxSerial}</span>}
                        {r.luckBonus > 0 && <span style={{ fontSize: 6, color: '#a855f7' }}><EmojiIcon emoji="🍀" />+{r.luckBonus}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {r.status === 'won' && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>+{r.hexEarned}</div>
                          <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', ...s }}>HEX</div>
                          {r.placeable && (
                            <div style={{ fontSize: 6, color: '#22c55e', marginTop: 2, fontWeight: 700, ...s }}><EmojiIcon emoji="📍" /> PLACE</div>
                          )}
                        </>
                      )}
                      {r.status === 'pending' && !isRevealed && (
                        <button onClick={() => handleReveal(r.id)} style={{
                          padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                          background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                          border: 'none', color: '#fff', fontSize: 7, fontWeight: 900, ...s,
                        }}><EmojiIcon emoji="🎁" /> REVEAL</button>
                      )}
                      {r.status === 'pending' && isRevealed && (
                        <div style={{ fontSize: 8, color: '#f97316', fontWeight: 700, ...s }}>⏳ PROCESSING</div>
                      )}
                      {r.status === 'lost' && (
                        <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.3)', ...s }}>MISSED</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {/* Place token reminder */}
            <div style={{
              marginTop: 8, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 700, letterSpacing: 1, ...s }}>
                <EmojiIcon emoji="📍" /> WON TOKENS ARE PLACEABLE
              </div>
              <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)', marginTop: 3, fontFamily: 'system-ui', lineHeight: 1.5 }}>
                Place event tokens adjacent to your captured territories to expand your empire. Higher rarity = stronger territory bonus.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  )
}
