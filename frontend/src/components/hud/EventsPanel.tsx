/**
 * EventsPanel — Daily Events Mode.
 * News/sport/world events create special tokens.
 * Register → luck skill impacts loot → tap to reveal result.
 * 3 tabs: 🔴 Live | ⏳ Upcoming | 🎁 My Results
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }
const TABS = [
  { id: 'live', label: '🔴 Live' },
  { id: 'upcoming', label: '⏳ Upcoming' },
  { id: 'results', label: '🎁 My Results' },
]

const LIVE = [
  { id:'e1', icon:'🌋', name:'VOLCANIC ERUPTION', loc:'ICELAND', reg:45, max:100, cost:50, color:'#dc2626', mine:false },
  { id:'e2', icon:'⚽', name:'CHAMPIONS LEAGUE FINAL', loc:'LONDON', reg:312, max:500, cost:75, color:'#3b82f6', mine:true },
]
const UPCOMING = [
  { id:'u1', icon:'🌊', name:'TSUNAMI WARNING', loc:'PACIFIC RIM', time:'02:45:12', color:'#f97316', soon:true },
  { id:'u2', icon:'🚀', name:'SATELLITE LAUNCH', loc:'CAPE CANAVERAL', time:'08:12:00', color:'#0099cc', soon:false },
  { id:'u3', icon:'⚽', name:'WORLD CUP QUALIFIER', loc:'PARIS', time:'2D 14:00', color:'#22c55e', soon:false },
]
const RESULTS = [
  { id:'r1', icon:'⚡', name:'SOLAR STORM', rarity:'RARE', rc:'#a855f7', serial:47, status:'won' as const },
  { id:'r2', icon:'🌪', name:'TORNADO OUTBREAK', rarity:'COMMON', rc:'#64748b', serial:12, status:'won' as const },
  { id:'r3', icon:'🌋', name:'VOLCANIC ERUPTION', rarity:'', rc:'', serial:0, status:'pending' as const },
]

export function EventsPanel({ onClose }: Props) {
  const [tab, setTab] = useState('live')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [regging, setRegging] = useState<string|null>(null)

  const doRegister = (id: string, cost: number) => {
    setRegging(id)
    setTimeout(() => { toast.success(`Registered! -${cost} HEX · Good luck!`); setRegging(null) }, 800)
  }
  const doReveal = (id: string) => {
    setRevealed(p => new Set(p).add(id))
    const r = RESULTS.find(x => x.id === id)
    if (r?.status === 'won') toast.success(`${r.rarity} TOKEN won! Added to Codex.`)
  }

  const OrbFont = "'Orbitron', system-ui, sans-serif"

  return (
    <GlassPanel title="ACTIVE EVENTS" onClose={onClose} accent="#f97316" width={440}>
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'7px', borderRadius:20, cursor:'pointer',
            fontSize:7, fontWeight:tab===t.id?700:500, letterSpacing:1,
            background:tab===t.id?'rgba(249,115,22,0.1)':'rgba(255,255,255,0.5)',
            color:tab===t.id?'#f97316':'rgba(26,42,58,0.45)',
            fontFamily:OrbFont,
            border:`1px solid ${tab===t.id?'rgba(249,115,22,0.3)':'rgba(0,60,100,0.1)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'live' && (
          <motion.div key="live" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            {LIVE.map(ev => (
              <div key={ev.id} style={{ padding:16, borderRadius:12, marginBottom:12,
                background:`linear-gradient(135deg,${ev.color}08,rgba(0,0,0,0.02))`,
                border:`1px solid ${ev.color}30`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:900, color:ev.color, letterSpacing:2, fontFamily:OrbFont }}>{ev.icon} {ev.name}</div>
                    <div style={{ fontSize:8, color:'rgba(26,42,58,0.45)', marginTop:2 }}>{ev.loc} · {ev.reg}/{ev.max} REGISTERED</div>
                  </div>
                  <span style={{ background:ev.color, color:'#fff', padding:'4px 10px', fontSize:7, borderRadius:4, fontWeight:700, letterSpacing:1, fontFamily:OrbFont }}>LIVE</span>
                </div>
                <div style={{ fontSize:8, color:'rgba(26,42,58,0.5)', lineHeight:1.6, fontFamily:'system-ui', marginBottom:12 }}>
                  Register to participate. One rare hexagonal token is at stake! After registration, come back later — you'll discover if you won and the rarity level as a surprise.
                </div>
                <div style={{ textAlign:'center', margin:'12px 0' }}>
                  <div style={{ width:64, height:64, margin:'0 auto',
                    clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                    background:`linear-gradient(135deg,${ev.color},${ev.color}88)`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
                    boxShadow:`0 0 25px ${ev.color}40`,
                  }}>{ev.icon}</div>
                  <div style={{ fontSize:9, fontWeight:900, color:ev.color, marginTop:8, letterSpacing:2, fontFamily:OrbFont }}>1 HEX TOKEN AT STAKE</div>
                  <div style={{ fontSize:7, color:'rgba(26,42,58,0.4)', marginTop:2 }}>Rarity: ??? — Revealed after event closes</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {ev.mine ? (
                    <div style={{ flex:1, padding:'10px', borderRadius:10, textAlign:'center',
                      background:'rgba(0,136,74,0.08)', border:'1px solid rgba(0,136,74,0.2)',
                      fontSize:8, fontWeight:700, color:'#00884a', letterSpacing:2, fontFamily:OrbFont,
                    }}>✅ REGISTERED — WAITING</div>
                  ) : (
                    <button onClick={() => doRegister(ev.id, ev.cost)} disabled={regging===ev.id} style={{
                      flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                      background:ev.color, border:'none', color:'#fff',
                      fontSize:8, fontWeight:900, letterSpacing:2, fontFamily:OrbFont,
                      opacity:regging===ev.id?0.6:1,
                    }}>{regging===ev.id?'⏳...':  `REGISTER (${ev.cost} HEX)`}</button>
                  )}
                  <button style={{ padding:'10px 16px', borderRadius:10, cursor:'pointer',
                    background:'rgba(255,255,255,0.5)', border:'1px solid rgba(0,60,100,0.1)',
                    fontSize:8, fontWeight:600, color:'rgba(26,42,58,0.5)', fontFamily:OrbFont,
                  }}>RULES</button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'upcoming' && (
          <motion.div key="up" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            {UPCOMING.map(ev => (
              <div key={ev.id} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'14px 16px', borderRadius:10, marginBottom:8,
                background:'rgba(255,255,255,0.5)', border:'1px solid rgba(0,60,100,0.1)',
              }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:900, color:ev.color, letterSpacing:1, fontFamily:OrbFont }}>{ev.icon} {ev.name}</div>
                  <div style={{ fontSize:8, color:'rgba(26,42,58,0.4)', marginTop:2 }}>{ev.loc} · IN {ev.time}</div>
                </div>
                <span style={{
                  padding:'4px 10px', borderRadius:4,
                  background:ev.soon?`${ev.color}15`:'transparent',
                  color:ev.soon?ev.color:'rgba(26,42,58,0.4)',
                  fontSize:7, fontWeight:700, letterSpacing:1, fontFamily:OrbFont,
                }}>{ev.soon?'SOON':'UPCOMING'}</span>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'results' && (
          <motion.div key="res" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div style={{ fontSize:8, fontWeight:700, letterSpacing:2, color:'rgba(26,42,58,0.35)', marginBottom:10, fontFamily:OrbFont }}>
              🎁 TAP TO REVEAL YOUR TOKENS
            </div>
            {RESULTS.map(ev => {
              const isRevealed = revealed.has(ev.id)
              return (
                <div key={ev.id} onClick={() => ev.status==='won'&&!isRevealed&&doReveal(ev.id)} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'14px 16px', borderRadius:10, marginBottom:8,
                  background:ev.status==='pending'?'rgba(0,60,100,0.02)':'rgba(255,255,255,0.5)',
                  border:`1px solid ${ev.status==='won'?'rgba(0,136,74,0.2)':'rgba(0,60,100,0.08)'}`,
                  cursor:ev.status==='won'&&!isRevealed?'pointer':'default',
                  opacity:ev.status==='pending'?0.5:1,
                }}>
                  {ev.status==='won'&&!isRevealed ? (
                    <><div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:900,color:'#1a2a3a',letterSpacing:1,fontFamily:OrbFont}}>{ev.icon} {ev.name} — WON!</div>
                      <div style={{fontSize:8,color:'rgba(26,42,58,0.4)',marginTop:2}}>Tap to reveal...</div>
                    </div><div style={{fontSize:24}}>🎁</div></>
                  ) : ev.status==='won'&&isRevealed ? (
                    <><div style={{
                      width:44,height:44,flexShrink:0,
                      clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                      background:`linear-gradient(135deg,${ev.rc},${ev.rc}88)`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,
                    }}>{ev.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:900,color:ev.rc,letterSpacing:1,fontFamily:OrbFont}}>✨ {ev.rarity} TOKEN!</div>
                      <div style={{fontSize:8,color:'rgba(26,42,58,0.4)',marginTop:2}}>{ev.name} #{String(ev.serial).padStart(3,'0')} — Added to Codex</div>
                    </div></>
                  ) : (
                    <><div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:700,color:'rgba(26,42,58,0.4)',fontFamily:OrbFont}}>{ev.icon} {ev.name}</div>
                      <div style={{fontSize:8,color:'rgba(26,42,58,0.3)',marginTop:2}}>Pending — event still active</div>
                    </div><span style={{fontSize:7,color:'#cc8800',fontWeight:700,letterSpacing:1,fontFamily:OrbFont}}>⏳ PENDING</span></>
                  )}
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  )
}
