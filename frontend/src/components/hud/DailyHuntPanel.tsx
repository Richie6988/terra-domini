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
import { Star, Flame, Snowflake, Radar } from 'lucide-react'

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

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

function HotColdBar({ distance }: { distance: number }) {
  // distance: 0 = on target, 1000+ = cold
  const pct = Math.max(0, Math.min(100, 100 - (distance / 10)))
  const color = pct > 80 ? '#dc2626' : pct > 60 ? '#f97316' : pct > 40 ? '#eab308' : pct > 20 ? '#0099cc' : '#3b82f6'
  const label = pct > 80 ? 'BURNING HOT' : pct > 60 ? 'HOT' : pct > 40 ? 'WARM' : pct > 20 ? 'COOL' : 'COLD'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 900, color, letterSpacing: 2,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {pct > 40 ? <Flame size={13} /> : <Snowflake size={13} />}{label}
        </span>
        <span style={{
          fontSize: 9, color: 'rgba(255,255,255,0.4)',
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
  // Stable sample (was re-rolled on every render) + map API fields (creature_id / creature_name)
  const [sampleHunt] = useState(generateDailyHunt)
  const hunt: any = apiTarget
    ? { ...apiTarget, id: apiTarget.creature_id || apiTarget.id, name: apiTarget.creature_name || apiTarget.name }
    : sampleHunt

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
    onError: (e: any) => {
      // RULE 1: no fake capture/reward when the server refuses
      toast.error(e?.response?.data?.error || 'Capture failed')
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

  return (
    <>
    <GlassPanel title="SAFARI" onClose={onClose} accent="#f97316" width={480}
      icon={<IconSVG id="safari_radar" size={24} />} subtitle="Track rare creatures, earn HEX">
      <AnimatePresence mode="wait">
        {/* ── BRIEFING ── */}
        {phase === 'briefing' && (
          <motion.div key="briefing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* HERO target — takes center stage */}
            <div style={{
              padding: '24px 20px', borderRadius: 14, textAlign: 'center',
              background: `radial-gradient(ellipse at center, ${RARITY_COLORS[hunt.rarity]}20 0%, ${RARITY_COLORS[hunt.rarity]}05 50%, transparent 100%)`,
              border: `1.5px solid ${RARITY_COLORS[hunt.rarity]}30`,
              marginBottom: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Ambient glow */}
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at center, ${RARITY_COLORS[hunt.rarity]}10 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />

              <div style={{
                position: 'relative', zIndex: 1,
                marginBottom: 10, cursor: 'pointer',
                display: 'flex', justifyContent: 'center',
              }} onClick={() => setShow3D(true)}>
                <TokenFace2D
                  iconId={hunt.id}
                  tier={hunt.rarity === 'legendary' ? 'EMERALD' : hunt.rarity === 'epic' ? 'GOLD' : hunt.rarity === 'rare' ? 'SILVER' : 'BRONZE'}
                  catColor={RARITY_COLORS[hunt.rarity]}
                  tokenName={hunt.name}
                  biome="forest"
                  size={220}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                <span className="hx-chip">TAP TO VIEW 3D</span>
                {!apiTarget && <span className="hx-chip" style={{ color: '#fdba74', borderColor: 'rgba(249,115,22,0.45)' }}>SAMPLE · REAL TARGET ASSIGNED ON START</span>}
              </div>

              <div style={{
                fontSize: 16, fontWeight: 900, color: '#e2e8f0', letterSpacing: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif", marginTop: 14, marginBottom: 4,
              }}>
                {(hunt.name || "").toUpperCase()}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: RARITY_COLORS[hunt.rarity], letterSpacing: 3,
                fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 10,
              }}>
                {(hunt.rarity || "").toUpperCase()} TARGET
              </div>
              <div style={{ fontSize: 12, color: 'var(--hx-text-2)', lineHeight: 1.5, maxWidth: 360, margin: '0 auto', fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                {hunt.hint}
              </div>
            </div>

            {/* Reward preview */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 14,
            }}>
              <div className="hx-card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(251,191,36,0.35)', background: 'linear-gradient(180deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))' }}>
                <IconSVG id="hex_coin" size={30} />
                <div className="hx-stat">
                  <span className="hx-stat__label">HEX REWARD</span>
                  <span className="hx-stat__value" style={{ color: '#fbbf24' }}>{hunt.hex_reward}</span>
                </div>
              </div>
              <div className="hx-card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(56,189,248,0.3)', background: 'linear-gradient(180deg, rgba(56,189,248,0.10), rgba(56,189,248,0.02))' }}>
                <Star size={26} color="#38bdf8" fill="#38bdf8" />
                <div className="hx-stat">
                  <span className="hx-stat__label">XP</span>
                  <span className="hx-stat__value" style={{ color: '#38bdf8' }}>+50</span>
                </div>
              </div>
            </div>

            <button onClick={handleStartHunt} disabled={spawnMut.isPending} className="btn-game btn-game-gold" style={{
              width: '100%', fontSize: 13, letterSpacing: 3, padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Radar size={18} /> {spawnMut.isPending ? 'SCANNING...' : 'START SAFARI'}
            </button>
          </motion.div>
        )}

        {/* ── TRACKING ── */}
        {phase === 'tracking' && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* HERO TOKEN — center stage, pulsing with "tracking" energy */}
            <div style={{
              padding: '28px 20px 22px', borderRadius: 14, textAlign: 'center',
              background: `radial-gradient(ellipse at center, ${RARITY_COLORS[hunt.rarity]}22 0%, ${RARITY_COLORS[hunt.rarity]}06 55%, transparent 100%)`,
              border: `1.5px solid ${RARITY_COLORS[hunt.rarity]}35`,
              marginBottom: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Pulsing scanline effect */}
              <motion.div
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at center, ${RARITY_COLORS[hunt.rarity]}18 0%, transparent 55%)`,
                  pointerEvents: 'none',
                }}
              />

              <div style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 4, color: '#f97316',
                fontFamily: "'Orbitron', sans-serif", marginBottom: 14,
                position: 'relative', zIndex: 1,
              }}>
                ⬢ TRACKING ⬢
              </div>

              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                onClick={() => setShow3D(true)}
                style={{
                  position: 'relative', zIndex: 1,
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'center',
                }}
              >
                <TokenFace2D
                  iconId={hunt.id}
                  tier={hunt.rarity === 'legendary' ? 'EMERALD' : hunt.rarity === 'epic' ? 'GOLD' : hunt.rarity === 'rare' ? 'SILVER' : 'BRONZE'}
                  catColor={RARITY_COLORS[hunt.rarity]}
                  tokenName={hunt.name}
                  biome="forest"
                  size={200}
                />
              </motion.div>

              <div style={{
                fontSize: 13, fontWeight: 900, color: '#e2e8f0', letterSpacing: 2,
                fontFamily: "'Orbitron', sans-serif", marginTop: 12,
                position: 'relative', zIndex: 1,
              }}>
                {(hunt.name || "").toUpperCase()}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: RARITY_COLORS[hunt.rarity], letterSpacing: 3,
                fontFamily: "'Orbitron', sans-serif", marginTop: 4,
                position: 'relative', zIndex: 1,
              }}>
                {(hunt.rarity || "").toUpperCase()}
              </div>
            </div>

            {/* Hot/cold bar — AFTER the hero, not pushing it down */}
            <HotColdBar distance={distance} />

            <div style={{
              marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.5)',
              textAlign: 'center', lineHeight: 1.5,
              maxWidth: 360, margin: '10px auto 0',
            }}>
              {hunt.hint}
            </div>

            <div style={{
              marginTop: 14, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.15)',
              fontSize: 9, color: '#0099cc', textAlign: 'center',
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            }}>
              DEEP SCAN UNLOCKS AT 50M RANGE
            </div>
          </motion.div>
        )}

        {/* ── SCANNING ── */}
        {phase === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{
              padding: '26px 20px', borderRadius: 14, textAlign: 'center',
              background: `radial-gradient(ellipse at center, rgba(220,38,38,0.22) 0%, rgba(220,38,38,0.04) 55%, transparent 100%)`,
              border: '1.5px solid rgba(220,38,38,0.35)',
              marginBottom: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 900, letterSpacing: 4, color: '#dc2626',
                fontFamily: "'Orbitron', sans-serif", marginBottom: 18,
              }}>
                ⬢ DEEP SCAN ⬢
              </div>

              {/* Scanning ring + token center */}
              <div style={{
                width: 240, height: 240, margin: '0 auto 16px',
                position: 'relative',
              }}>
                {/* Outer rotating ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: '2px solid transparent',
                    borderTopColor: '#dc2626',
                    borderRightColor: 'rgba(220,38,38,0.4)',
                  }}
                />
                {/* Inner pulsing ring */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: 12,
                    borderRadius: '50%',
                    border: '1px solid rgba(220,38,38,0.3)',
                  }}
                />
                {/* Token HERO in center */}
                <div style={{
                  position: 'absolute', inset: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TokenFace2D
                    iconId={hunt.id}
                    tier={hunt.rarity === 'legendary' ? 'EMERALD' : hunt.rarity === 'epic' ? 'GOLD' : hunt.rarity === 'rare' ? 'SILVER' : 'BRONZE'}
                    catColor={RARITY_COLORS[hunt.rarity]}
                    tokenName={hunt.name}
                    biome="forest"
                    size={190}
                  />
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 8, borderRadius: 4, overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)', marginBottom: 10,
              }}>
                <motion.div
                  animate={{ width: `${scanProgress}%` }}
                  style={{
                    height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg, #dc2626, #f97316)',
                    boxShadow: '0 0 12px rgba(220,38,38,0.5)',
                  }}
                />
              </div>
              <div style={{
                fontSize: 14, fontWeight: 900, color: '#dc2626',
                fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2,
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
                  category={(hunt.category || "").toUpperCase().replace(/_/g, ' ')}
                  catColor={RARITY_COLORS[hunt.rarity]}
                  biome="SAFARI"
                  tokenName={(hunt.name || "").toUpperCase()}
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
                {(hunt.name || "").toUpperCase()}
              </div>

              <button
                onClick={handleCollect}
                disabled={captureMut.isPending}
                className="btn-game btn-game-green"
                style={{ width: '100%', padding: '15px', fontSize: 12, letterSpacing: 3 }}
              >
                {captureMut.isPending ? 'CAPTURING...' : 'COLLECT TOKEN'}
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
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 0 18px rgba(34,197,94,0.45))' }}><IconSVG id="trophy" size={72} /></div>
              <div style={{
                fontSize: 11, fontWeight: 900, letterSpacing: 3, color: '#22c55e',
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
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>HEX COIN</div>
                </div>
                <div style={{
                  padding: '12px 20px', borderRadius: 12,
                  background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.2)',
                  textAlign: 'center',
                }}>
                  <Star size={16} color="#38bdf8" fill="#38bdf8" />
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace" }}>
                    +{reward.xp}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>XP</div>
                </div>
              </div>

              <div style={{
                padding: '8px 12px', borderRadius: 8,
                background: `${RARITY_COLORS[hunt.rarity]}08`,
                border: `1px solid ${RARITY_COLORS[hunt.rarity]}15`,
                fontSize: 9, color: RARITY_COLORS[hunt.rarity],
                fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
              }}>
                {(hunt.rarity || "").toUpperCase()} {(hunt.name || "").toUpperCase()} → ADDED TO CODEX
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
