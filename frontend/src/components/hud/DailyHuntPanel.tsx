/**
 * DailyHuntPanel — Safari Mode.
 * Random fauna/dinosaur missions on tokens not in codex.
 * Hex grid cell lights up (player-only visible).
 * Player tracks with radar + clues. Daily challenges.
 * 
 * Flow:
 *   1. Player opens Safari → gets target (fauna/dinosaur category, hint)
 *   2. Walks/navigates toward target → radar hot/cold indicator
 *   3. When within 50m → "DEEP SCAN" available → reveals exact hex
 *   4. Click to capture → reward animation → token added to codex
 *   5. Daily challenges: "capture 5 fungus", "capture 20 rare dinosaurs"
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { TokenFace2D } from '../shared/TokenFace2D'
import { Token3DViewer } from '../shared/Token3DViewer'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props { onClose: () => void }

type HuntPhase = 'briefing' | 'tracking' | 'scanning' | 'found' | 'collected'

// Mock safari data — will come from API
function generateDailyHunt() {
  const targets = [
    { id: 'trex', name: 'Tyrannosaurus Rex', category: 'life_organisms', rarity: 'legendary', hex_reward: 1000, hint: 'Massive footprints detected near rocky terrain — approach with caution!' },
    { id: 'raptor', name: 'Velociraptor Pack', category: 'life_organisms', rarity: 'epic', hex_reward: 500, hint: 'Pack activity detected south-east. They hunt in groups — stay sharp.' },
    { id: 'fungus', name: 'Bioluminescent Fungus', category: 'life_organisms', rarity: 'rare', hex_reward: 150, hint: 'Glowing spores visible in shaded areas. Check forest zones.' },
    { id: 'eagle', name: 'Giant Golden Eagle', category: 'life_organisms', rarity: 'epic', hex_reward: 400, hint: 'Spotted circling above mountainous terrain. Nest nearby.' },
    { id: 'whale', name: 'Blue Whale Migration', category: 'life_organisms', rarity: 'legendary', hex_reward: 800, hint: 'Coastal hydrophone detected deep song patterns. Ocean zone.' },
    { id: 'orchid', name: 'Ghost Orchid', category: 'life_organisms', rarity: 'rare', hex_reward: 200, hint: 'Rare bloom in humid forest. Visible only at dawn.' },
    { id: 'stego', name: 'Stegosaurus', category: 'life_organisms', rarity: 'rare', hex_reward: 300, hint: 'Herbivore trails in grassland. Follow the broken vegetation.' },
    { id: 'phoenix', name: 'Phoenix Egg', category: 'fantastic', rarity: 'mythic', hex_reward: 2000, hint: 'Thermal anomaly near volcanic area. Extremely rare spawn!' },
  ]
  return targets[Math.floor(Math.random() * targets.length)]
}

// Daily challenge examples
const DAILY_CHALLENGES = [
  { id: 'dc1', desc: 'Capture 5 Fungus species', progress: 2, total: 5, reward: 100, icon: 'mushroom' },
  { id: 'dc2', desc: 'Capture 3 Rare Dinosaurs', progress: 1, total: 3, reward: 300, icon: 'stego' },
  { id: 'dc3', desc: 'Track a target within 100m', progress: 0, total: 1, reward: 50, icon: 'safari_radar' },
]

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

function HotColdBar({ distance }: { distance: number }) {
  // distance: 0 = on target, 1000+ = cold
  const pct = Math.max(0, Math.min(100, 100 - (distance / 10)))
  const color = pct > 80 ? '#dc2626' : pct > 60 ? '#f97316' : pct > 40 ? '#eab308' : pct > 20 ? '#0099cc' : '#3b82f6'
  const label = pct > 80 ? 'BURNING HOT' : pct > 60 ? 'HOT' : pct > 40 ? 'WARM' : pct > 20 ? ' COOL' : ' COLD'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{
          fontSize: 8, fontWeight: 900, color, letterSpacing: 2,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 8, color: 'rgba(255,255,255,0.4)',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          ~{distance > 1000 ? `${(distance/1000).toFixed(1)}km` : `${Math.round(distance)}m`}
        </span>
      </div>
      <div style={{
        height: 8, borderRadius: 4, overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
      }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          style={{
            height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, #3b82f6, ${color})`,
            boxShadow: pct > 60 ? `0 0 12px ${color}60` : 'none',
          }}
        />
      </div>
    </div>
  )
}

export function DailyHuntPanel({ onClose }: Props) {
  const [phase, setPhase] = useState<HuntPhase>('briefing')
  const [show3D, setShow3D] = useState(false)
  const [distance, setDistance] = useState(850)
  const [scanProgress, setScanProgress] = useState(0)
  const [reward, setReward] = useState<{ hex_reward: number; xp: number } | null>(null)
  const scanTimer = useRef<number>(0)
  const qc = useQueryClient()

  // Load active target from API, fallback to mock
  const { data: safariData } = useQuery({
    queryKey: ['safari-active'],
    queryFn: () => api.get('/safari/active/').then(r => r.data).catch(() => null),
    staleTime: 10000,
  })
  const apiTarget = safariData?.target
  const hunt = apiTarget || generateDailyHunt()

  // Spawn new target
  const spawnMut = useMutation({
    mutationFn: () => api.post('/safari/spawn/', { lat: 48.8566, lon: 2.3522 }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(data?.message || 'New creature spawned!')
      qc.invalidateQueries({ queryKey: ['safari-active'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Spawn failed'),
  })

  // Capture target
  const captureMut = useMutation({
    mutationFn: () => api.post('/safari/capture/', { lat: 48.8566, lon: 2.3522 }).then(r => r.data),
    onSuccess: (data) => {
      setReward({ hex_reward: data.hex_earned, xp: 50 })
      setPhase('collected')
      toast.success(data.message || `Captured! +${data.hex_earned} HEX`)
      qc.invalidateQueries({ queryKey: ['safari-active'] })
    },
    onError: () => {
      // Fallback: accept mock capture
      setReward({ hex_reward: hunt.hex_reward, xp: 50 })
      setPhase('collected')
    },
  })

  // Simulate distance decreasing (in production: real GPS)
  useEffect(() => {
    if (phase !== 'tracking') return
    const interval = setInterval(() => {
      setDistance(d => {
        const newD = Math.max(10, d - (5 + Math.random() * 15))
        if (newD < 50) setPhase('scanning')
        return newD
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [phase])

  // Deep scan progress
  useEffect(() => {
    if (phase !== 'scanning') return
    scanTimer.current = window.setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          setPhase('found')
          clearInterval(scanTimer.current)
          return 100
        }
        return p + 4
      })
    }, 200)
    return () => clearInterval(scanTimer.current)
  }, [phase])

  const handleCollect = useCallback(() => {
    captureMut.mutate()
  }, [captureMut])

  const handleStartHunt = () => {
    if (!apiTarget) spawnMut.mutate()
    setPhase('tracking')
  }

  // Check if hunt already done today
  const today = new Date().toDateString()
  const lastHunt = (() => { try { return localStorage.getItem('hx_last_hunt') } catch { return null } })()
  const alreadyDone = lastHunt === today

  if (alreadyDone && phase === 'briefing') {
    return (
      <GlassPanel title="SAFARI" onClose={onClose} accent="#f97316">
        <div style={{
          textAlign: 'center', padding: 40,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}><IconSVG id='dot_green' size={40} /></div>
          <div style={{
            fontSize: 10, fontWeight: 900, color: '#00884a', letterSpacing: 3,
            fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8,
          }}>
            SAFARI COMPLETED TODAY
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
            Come back tomorrow for a new target
          </div>
        </div>
      </GlassPanel>
    )
  }

  return (
    <>
    <GlassPanel title="SAFARI" onClose={onClose} accent="#f97316">
      <AnimatePresence mode="wait">
        {/* ── BRIEFING ── */}
        {phase === 'briefing' && (
          <motion.div key="briefing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Target card */}
            <div style={{
              padding: 16, borderRadius: 10, textAlign: 'center',
              background: `linear-gradient(135deg, ${RARITY_COLORS[hunt.rarity]}10, transparent)`,
              border: `1.5px solid ${RARITY_COLORS[hunt.rarity]}25`,
              marginBottom: 12,
            }}>
              <div style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => setShow3D(true)}>
                <TokenFace2D
                  iconId={hunt.id}
                  tier={hunt.rarity === 'legendary' ? 'EMERALD' : hunt.rarity === 'epic' ? 'GOLD' : hunt.rarity === 'rare' ? 'SILVER' : 'BRONZE'}
                  catColor={RARITY_COLORS[hunt.rarity]}
                  tokenName={hunt.name}
                  biome="forest"
                  size={140}
                />
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 1 }}>TAP TO VIEW 3D</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 900, color: '#e2e8f0', letterSpacing: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4,
              }}>
                {hunt.name.toUpperCase()}
              </div>
              <div style={{
                fontSize: 8, fontWeight: 700, color: RARITY_COLORS[hunt.rarity], letterSpacing: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8,
              }}>
                {hunt.rarity.toUpperCase()} TOKEN
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                {hunt.hint}
              </div>
            </div>

            {/* Reward preview */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 14,
            }}>
              <div style={{
                flex: 1, padding: '8px', borderRadius: 8, textAlign: 'center',
                background: 'rgba(121,80,242,0.06)', border: '1px solid rgba(121,80,242,0.15)',
              }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>REWARD</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <IconSVG id="hex_coin" size={12} /> {hunt.hex_reward}
                </div>
              </div>
              <div style={{
                flex: 1, padding: '8px', borderRadius: 8, textAlign: 'center',
                background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.15)',
              }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>XP</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace" }}>+50</div>
              </div>
            </div>

            <button onClick={handleStartHunt} className="btn-game btn-game-gold" style={{
              width: '100%', fontSize: 10, letterSpacing: 3,
            }}>
              START SAFARI
            </button>
          </motion.div>
        )}

        {/* ── TRACKING ── */}
        {phase === 'tracking' && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{
                fontSize: 7, fontWeight: 700, letterSpacing: 3, color: '#f97316',
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                TRACKING: {hunt.name.toUpperCase()}
              </div>
            </div>

            <HotColdBar distance={distance} />

            <div style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}>
              <IconSVG id={hunt.id} size={44} />
              <div style={{
                fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: 1,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                MOVE TOWARD THE TARGET
              </div>
              <div style={{
                fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 4,
              }}>
                {hunt.hint}
              </div>
            </div>

            <div style={{
              marginTop: 12, padding: '6px 10px', borderRadius: 8,
              background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.1)',
              fontSize: 7, color: '#0099cc', textAlign: 'center',
              fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
            }}>
              DEEP SCAN UNLOCKS AT 50M RANGE
            </div>
          </motion.div>
        )}

        {/* ── SCANNING ── */}
        {phase === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 3, color: '#dc2626',
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 12,
              }}>
                DEEP SCAN IN PROGRESS
              </div>

              {/* Scan animation */}
              <div style={{
                width: 120, height: 120, margin: '0 auto 16px',
                borderRadius: '50%', position: 'relative',
                background: 'rgba(220,38,38,0.06)',
                border: '2px solid rgba(220,38,38,0.2)',
              }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: '2px solid transparent',
                    borderTopColor: '#dc2626',
                  }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconSVG id={hunt.id} size={44} />
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 6, borderRadius: 3, overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)', marginBottom: 8,
              }}>
                <motion.div
                  animate={{ width: `${scanProgress}%` }}
                  style={{
                    height: '100%', borderRadius: 3,
                    background: 'linear-gradient(90deg, #dc2626, #f97316)',
                    boxShadow: '0 0 8px rgba(220,38,38,0.4)',
                  }}
                />
              </div>
              <div style={{
                fontSize: 10, fontWeight: 900, color: '#dc2626',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {scanProgress}%
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FOUND ── */}
        {phase === 'found' && (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5 }}
                style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}
              >
                <TokenFace2D
                  tier={hunt.rarity === 'mythic' ? 'EMERALD' : hunt.rarity === 'legendary' ? 'GOLD' : hunt.rarity === 'epic' ? 'SILVER' : 'BRONZE'}
                  category={hunt.category.toUpperCase().replace(/_/g, ' ')}
                  catColor={RARITY_COLORS[hunt.rarity]}
                  biome="SAFARI"
                  tokenName={hunt.name.toUpperCase()}
                  iconId={hunt.id}
                  serial={Math.floor(Math.random() * 900) + 100}
                  maxSupply={1000}
                  size={200}
                />
              </motion.div>

              <div style={{
                fontSize: 12, fontWeight: 900, letterSpacing: 4, color: RARITY_COLORS[hunt.rarity],
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4,
              }}>
                TOKEN FOUND!
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1,
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 16,
              }}>
                {hunt.name.toUpperCase()}
              </div>

              <button
                onClick={handleCollect}
                style={{
                  width: '100%', padding: '14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(90deg, ${RARITY_COLORS[hunt.rarity]}, ${RARITY_COLORS[hunt.rarity]}cc)`,
                  color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 3,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  boxShadow: `0 4px 20px ${RARITY_COLORS[hunt.rarity]}40`,
                }}
              >
                COLLECT TOKEN
              </button>
            </div>
          </motion.div>
        )}

        {/* ── COLLECTED ── */}
        {phase === 'collected' && reward && (
          <motion.div
            key="collected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}></div>
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: 3, color: '#00884a',
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 16,
              }}>
                SAFARI COMPLETE!
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                <div style={{
                  padding: '12px 20px', borderRadius: 12,
                  background: 'rgba(121,80,242,0.08)', border: '1px solid rgba(121,80,242,0.2)',
                  textAlign: 'center',
                }}>
                  <IconSVG id="hex_coin" size={14} />
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>
                    +{reward.hex_reward}
                  </div>
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>HEX COIN</div>
                </div>
                <div style={{
                  padding: '12px 20px', borderRadius: 12,
                  background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.2)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>⭐</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace" }}>
                    +{reward.xp}
                  </div>
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>XP</div>
                </div>
              </div>

              <div style={{
                padding: '8px 12px', borderRadius: 8,
                background: `${RARITY_COLORS[hunt.rarity]}08`,
                border: `1px solid ${RARITY_COLORS[hunt.rarity]}15`,
                fontSize: 8, color: RARITY_COLORS[hunt.rarity],
                fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
              }}>
                {hunt.rarity.toUpperCase()} {hunt.name.toUpperCase()} → ADDED TO CODEX
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Safari Challenges */}
      <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
        <div style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)',
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8,
        }}>
          DAILY CHALLENGES
        </div>
        {DAILY_CHALLENGES.map(ch => {
          const pct = Math.floor((ch.progress / ch.total) * 100)
          const done = ch.progress >= ch.total
          return (
            <div key={ch.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '8px 10px', borderRadius: 8,
              background: done ? 'rgba(0,136,74,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${done ? 'rgba(0,136,74,0.2)' : 'rgba(255,255,255,0.06)'}`,
              opacity: done ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 14 }}><EmojiIcon emoji={ch.icon} size={16} /></span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, color: done ? 'rgba(255,255,255,0.4)' : '#e2e8f0',
                  fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 0.5,
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {ch.desc}
                </div>
                <div style={{
                  height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)',
                  marginTop: 3, overflow: 'hidden', maxWidth: 150,
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 2,
                    background: done ? '#00884a' : '#f97316',
                  }} />
                </div>
              </div>
              <span style={{
                fontSize: 7, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace",
                color: done ? '#00884a' : '#f97316',
              }}>
                {ch.progress}/{ch.total} · +{ch.reward}◆
              </span>
            </div>
          )
        })}
      </div>
    </GlassPanel>

      {/* 3D Token Viewer — fullscreen overlay */}
      {show3D && (
        <Token3DViewer
          visible={show3D}
          onClose={() => setShow3D(false)}
          iconId={hunt.id}
          tokenName={hunt.name}
          tier={hunt.rarity === 'mythic' ? 'DIAMOND' : hunt.rarity === 'legendary' ? 'EMERALD' : hunt.rarity === 'epic' ? 'GOLD' : hunt.rarity === 'rare' ? 'SILVER' : 'BRONZE'}
          catColor={RARITY_COLORS[hunt.rarity]}
          biome="forest"
          category={hunt.category}
        />
      )}
    </>
  )
}
