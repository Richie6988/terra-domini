/**
 * RadarWidget — M17 Radar Widget.
 * Small fixed SVG element (100×100px) bottom-right.
 * Rotating sweep line + colored blips for nearby tokens.
 * Click opens Radar Detail (future sub-modal).
 */
import { useState, useEffect, useRef } from 'react'

interface Blip {
  id: string
  angle: number   // radians
  distance: number // 0-1 normalized
  color: string
}

const CATEGORY_BLIP_COLORS: Record<string, string> = {
  natural_disasters: '#f97316',
  places_structures: '#6366f1',
  nature_geography: '#7c3aed',
  knowledge_science: '#2563eb',
  economic_assets: '#64748b',
  culture_society: '#d946ef',
  conflict_intrigue: '#dc2626',
  life_organisms: '#22c55e',
  fantastic: '#a855f7',
  game: '#0ea5e9',
}

// Generate mock blips for demo — replaced by real API data later
function generateMockBlips(): Blip[] {
  const cats = Object.keys(CATEGORY_BLIP_COLORS)
  return Array.from({ length: 8 }, (_, i) => ({
    id: `blip-${i}`,
    angle: (Math.PI * 2 * i) / 8 + Math.random() * 0.5,
    distance: 0.25 + Math.random() * 0.6,
    color: CATEGORY_BLIP_COLORS[cats[i % cats.length]],
  }))
}

export function RadarWidget() {
  const [sweepAngle, setSweepAngle] = useState(0)
  const [blips] = useState<Blip[]>(generateMockBlips)
  const animRef = useRef<number>(0)

  // Sweep rotation — 3s per revolution
  useEffect(() => {
    let lastTime = 0
    const animate = (time: number) => {
      if (!lastTime) lastTime = time
      const delta = time - lastTime
      lastTime = time
      setSweepAngle(prev => (prev + (delta / 3000) * Math.PI * 2) % (Math.PI * 2))
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const cx = 50, cy = 50, r = 40

  // Sweep line endpoint
  const sweepX = cx + Math.cos(sweepAngle) * r
  const sweepY = cy + Math.sin(sweepAngle) * r

  // Sweep trail (fading arc)
  const trailAngle = 0.8 // radians
  const trailStart = sweepAngle - trailAngle
  const trailStartX = cx + Math.cos(trailStart) * r
  const trailStartY = cy + Math.sin(trailStart) * r
  const largeArc = trailAngle > Math.PI ? 1 : 0

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80, right: 16,
        zIndex: 100,
        cursor: 'pointer',
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
      }}
      title="CARD RADAR"
    >
      <svg viewBox="0 0 100 100" width={100} height={100}>
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r + 4} fill="rgba(235,242,250,0.85)"
          stroke="rgba(0,60,100,0.15)" strokeWidth="1" />

        {/* Concentric rings */}
        <circle cx={cx} cy={cy} r={r * 0.75} fill="none"
          stroke="rgba(0,153,204,0.12)" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={r * 0.5} fill="none"
          stroke="rgba(0,153,204,0.12)" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={r * 0.25} fill="none"
          stroke="rgba(0,153,204,0.12)" strokeWidth="0.5" />

        {/* Crosshairs */}
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy}
          stroke="rgba(0,153,204,0.1)" strokeWidth="0.5" />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r}
          stroke="rgba(0,153,204,0.1)" strokeWidth="0.5" />

        {/* Sweep trail (fading gradient) */}
        <path
          d={`M ${cx} ${cy} L ${trailStartX} ${trailStartY} A ${r} ${r} 0 ${largeArc} 1 ${sweepX} ${sweepY} Z`}
          fill="url(#sweepGradient)"
          opacity="0.3"
        />

        {/* Gradient definition */}
        <defs>
          <radialGradient id="sweepGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,153,204,0)" />
            <stop offset="100%" stopColor="rgba(0,153,204,0.4)" />
          </radialGradient>
        </defs>

        {/* Sweep line */}
        <line x1={cx} y1={cy} x2={sweepX} y2={sweepY}
          stroke="#0099cc" strokeWidth="1.5" opacity="0.8" />

        {/* Blips */}
        {blips.map(blip => {
          const bx = cx + Math.cos(blip.angle) * (blip.distance * r)
          const by = cy + Math.sin(blip.angle) * (blip.distance * r)
          // Calculate proximity to sweep for pulse effect
          const angleDiff = Math.abs(sweepAngle - blip.angle) % (Math.PI * 2)
          const nearSweep = angleDiff < 0.5 || angleDiff > Math.PI * 2 - 0.5
          return (
            <circle
              key={blip.id}
              cx={bx} cy={by}
              r={nearSweep ? 3 : 2}
              fill={blip.color}
              opacity={nearSweep ? 1 : 0.6}
              style={{ transition: 'r 0.3s, opacity 0.3s' }}
            >
              {nearSweep && (
                <animate attributeName="r" values="2;4;2" dur="1s" repeatCount="1" />
              )}
            </circle>
          )
        })}

        {/* Center dot (player position) */}
        <circle cx={cx} cy={cy} r={3} fill="#0099cc" />
        <circle cx={cx} cy={cy} r={5} fill="none" stroke="#0099cc" strokeWidth="0.5" opacity="0.5" />

        {/* North indicator */}
        <text x={cx} y={14} textAnchor="middle"
          fontSize="7" fontWeight="700" fill="#dc2626"
          fontFamily="'Orbitron', system-ui, sans-serif">
          N
        </text>

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(0,153,204,0.3)" strokeWidth="1" />
      </svg>

      {/* Label */}
      <div style={{
        textAlign: 'center',
        fontSize: 6,
        fontWeight: 700,
        letterSpacing: 2,
        color: 'rgba(26,42,58,0.45)',
        fontFamily: "'Orbitron', system-ui, sans-serif",
        marginTop: -2,
      }}>
        CARD RADAR
      </div>
    </div>
  )
}
