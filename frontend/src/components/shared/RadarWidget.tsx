/**
 * RadarWidget — Radar with Safari mode.
 * Small: 100×100px bottom-right, click to expand.
 * Expanded: 280×280px centered overlay with safari tracking info.
 * 
 * Safari mode: shows dedicated blip for active safari target,
 * distance/direction text, hot/cold indicator.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Blip {
  id: string; angle: number; distance: number; color: string
  label?: string; isSafari?: boolean; category?: string
}

const CAT_COLORS: Record<string, string> = {
  natural_disasters: '#f97316', places_structures: '#6366f1',
  nature_geography: '#22c55e', conflict_intrigue: '#dc2626',
  culture_society: '#d946ef', life_organisms: '#22c55e',
  fantastic: '#a855f7', economic_assets: '#cc8800',
}

function generateMockBlips(): Blip[] {
  const cats = Object.keys(CAT_COLORS)
  const blips: Blip[] = Array.from({ length: 6 }, (_, i) => ({
    id: `blip-${i}`, angle: (Math.PI * 2 * i) / 6 + Math.random() * 0.5,
    distance: 0.25 + Math.random() * 0.6,
    color: CAT_COLORS[cats[i % cats.length]],
    category: cats[i % cats.length],
  }))
  // Safari target blip
  blips.push({
    id: 'safari-target', angle: Math.random() * Math.PI * 2,
    distance: 0.4 + Math.random() * 0.4,
    color: '#fbbf24', label: 'SAFARI TARGET', isSafari: true,
  })
  return blips
}

export function RadarWidget() {
  const [expanded, setExpanded] = useState(false)
  const [sweepAngle, setSweepAngle] = useState(0)
  const [blips] = useState<Blip[]>(generateMockBlips)
  const animRef = useRef<number>(0)

  useEffect(() => {
    let lastTime = 0
    const animate = (time: number) => {
      if (!lastTime) lastTime = time
      setSweepAngle(prev => (prev + ((time - lastTime) / 3000) * Math.PI * 2) % (Math.PI * 2))
      lastTime = time
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  // Escape closes expanded
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const safariBlip = blips.find(b => b.isSafari)
  const safariDist = safariBlip ? Math.floor(safariBlip.distance * 5000) : 0
  const safariHeat = safariBlip ? (safariBlip.distance < 0.3 ? 'HOT' : safariBlip.distance < 0.6 ? 'WARM' : 'COLD') : 'COLD'
  const safariHeatColor = safariHeat === 'HOT' ? '#dc2626' : safariHeat === 'WARM' ? '#f97316' : '#3b82f6'

  const renderRadar = useCallback((size: number, detailed: boolean) => {
    const cx = size / 2, cy = size / 2, r = size * 0.4
    const sweepX = cx + Math.cos(sweepAngle) * r
    const sweepY = cy + Math.sin(sweepAngle) * r
    const trailAngle = 0.8
    const trailStart = sweepAngle - trailAngle
    const trailStartX = cx + Math.cos(trailStart) * r
    const trailStartY = cy + Math.sin(trailStart) * r

    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r + 4} fill="rgba(235,242,250,0.85)" stroke="rgba(0,60,100,0.15)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke="rgba(0,153,204,0.1)" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="rgba(0,153,204,0.1)" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={r * 0.25} fill="none" stroke="rgba(0,153,204,0.1)" strokeWidth="0.5" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(0,153,204,0.08)" strokeWidth="0.5" />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="rgba(0,153,204,0.08)" strokeWidth="0.5" />

        <path
          d={`M ${cx} ${cy} L ${trailStartX} ${trailStartY} A ${r} ${r} 0 0 1 ${sweepX} ${sweepY} Z`}
          fill="url(#sweepG)" opacity="0.3"
        />
        <defs>
          <radialGradient id="sweepG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,153,204,0)" />
            <stop offset="100%" stopColor="rgba(0,153,204,0.4)" />
          </radialGradient>
        </defs>

        <line x1={cx} y1={cy} x2={sweepX} y2={sweepY} stroke="#0099cc" strokeWidth={detailed ? 2 : 1.5} opacity="0.8" />

        {blips.map(blip => {
          const bx = cx + Math.cos(blip.angle) * (blip.distance * r)
          const by = cy + Math.sin(blip.angle) * (blip.distance * r)
          const angleDiff = Math.abs(sweepAngle - blip.angle) % (Math.PI * 2)
          const nearSweep = angleDiff < 0.5 || angleDiff > Math.PI * 2 - 0.5
          const blipR = blip.isSafari ? (detailed ? 6 : 4) : (detailed ? 4 : 2)
          return (
            <g key={blip.id}>
              <circle cx={bx} cy={by} r={blipR}
                fill={blip.color} opacity={nearSweep ? 1 : 0.6}
                style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
              >
                <title>{blip.isSafari ? `🎯 SAFARI TARGET — ${Math.floor(blip.distance * 5000)}m` : `${blip.category || 'Signal'} — ${Math.floor(blip.distance * 5000)}m`}</title>
              </circle>
              {blip.isSafari && (
                <>
                  <circle cx={bx} cy={by} r={blipR + 4} fill="none"
                    stroke={blip.color} strokeWidth="1" opacity="0.4">
                    <animate attributeName="r" values={`${blipR + 2};${blipR + 8};${blipR + 2}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {detailed && (
                    <text x={bx} y={by - blipR - 6} textAnchor="middle"
                      fontSize="8" fontWeight="900" fill="#fbbf24"
                      fontFamily="'Orbitron', system-ui, sans-serif">
                      🎯 SAFARI
                    </text>
                  )}
                </>
              )}
            </g>
          )
        })}

        <circle cx={cx} cy={cy} r={detailed ? 4 : 3} fill="#0099cc" />
        <circle cx={cx} cy={cy} r={detailed ? 7 : 5} fill="none" stroke="#0099cc" strokeWidth="0.5" opacity="0.5" />
        <text x={cx} y={detailed ? 18 : 14} textAnchor="middle"
          fontSize={detailed ? 9 : 7} fontWeight="700" fill="#dc2626"
          fontFamily="'Orbitron', system-ui, sans-serif">N</text>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,153,204,0.3)" strokeWidth="1" />
      </svg>
    )
  }, [sweepAngle, blips])

  return (
    <>
      {/* Small radar — click to expand */}
      <div
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 900,
          cursor: 'pointer', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
        }}
        title="CLICK TO EXPAND RADAR"
      >
        {renderRadar(100, false)}
        <div style={{
          textAlign: 'center', fontSize: 6, fontWeight: 700, letterSpacing: 2,
          color: safariHeatColor, fontFamily: "'Orbitron', system-ui, sans-serif", marginTop: -2,
        }}>
          {safariBlip ? `🎯 ${safariHeat} · ${safariDist}m` : 'RADAR'}
        </div>
      </div>

      {/* Expanded radar overlay */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => setExpanded(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1500,
              background: 'rgba(26,42,58,0.4)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}
          >
            <div onClick={e => e.stopPropagation()}>
              {renderRadar(280, true)}
            </div>

            {/* Safari tracking info */}
            {safariBlip && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: '12px 20px', borderRadius: 14,
                  background: 'linear-gradient(180deg, rgba(235,242,250,0.97), rgba(220,230,242,0.97))',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(0,60,100,0.15)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  display: 'flex', alignItems: 'center', gap: 16,
                  maxWidth: 400,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${safariHeatColor}20, ${safariHeatColor}05)`,
                  border: `2px solid ${safariHeatColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>🎯</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#1a2a3a', letterSpacing: 2 }}>
                    ACTIVE SAFARI
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.45)', marginTop: 2 }}>
                    Track the target using clues · Check Safari panel for details
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 16, fontWeight: 900, color: safariHeatColor,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    {safariDist}m
                  </div>
                  <div style={{
                    fontSize: 7, fontWeight: 700, color: safariHeatColor, letterSpacing: 2,
                  }}>
                    {safariHeat}
                  </div>
                </div>
              </motion.div>
            )}

            <div style={{
              fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              CLICK OUTSIDE TO CLOSE · ESC
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
