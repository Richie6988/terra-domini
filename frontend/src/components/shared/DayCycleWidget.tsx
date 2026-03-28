/**
 * DayCycleWidget — Automatic day cycle timer.
 * Shows countdown to next day processing.
 * Auto-triggers processDay for all kingdoms when timer hits 0.
 * Displayed in HexodTopHUD area.
 * 
 * For prototype: 60-second cycles (1 min = 1 game day).
 * Production: 24h real-time cycles.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useKingdomStore } from '../../store/kingdomStore'
import { CrystalIcon } from '../shared/CrystalIcon'

const DAY_DURATION_SEC = 60 // Prototype: 60s. Production: 86400 (24h)

export function DayCycleWidget() {
  const [timeLeft, setTimeLeft] = useState(DAY_DURATION_SEC)
  const [dayCount, setDayCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('hx_day_count') ?? '1') || 1
    } catch { return 1 }
  })
  const [lastCrystals, setLastCrystals] = useState(0)
  const [flash, setFlash] = useState(false)
  const intervalRef = useRef<number>(0)
  const { kingdoms, processDay } = useKingdomStore()

  const processDayForAll = useCallback(() => {
    let totalCrystals = 0
    const biomes = ['urban', 'rural', 'forest', 'mountain', 'coastal', 'desert', 'industrial', 'tundra', 'landmark'] as const

    for (const kingdom of kingdoms) {
      const mockTerritories = kingdom.territories.map((_, i) => ({
        biome: biomes[i % biomes.length],
        rarity: i === 0 ? 'rare' : i < 3 ? 'uncommon' : 'common',
      }))
      const result = processDay(kingdom.id, mockTerritories)
      totalCrystals += result.crystalsGenerated
    }

    setLastCrystals(totalCrystals)
    setDayCount(d => {
      const next = d + 1
      try { localStorage.setItem('hx_day_count', String(next)) } catch {}
      return next
    })

    // Flash effect
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
  }, [kingdoms, processDay])

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Process day
          processDayForAll()
          return DAY_DURATION_SEC
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [processDayForAll])

  // Format time
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const pct = ((DAY_DURATION_SEC - timeLeft) / DAY_DURATION_SEC) * 100

  if (kingdoms.length === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 10px', borderRadius: 20,
      background: flash
        ? 'linear-gradient(90deg, rgba(121,80,242,0.15), rgba(121,80,242,0.05))'
        : 'rgba(255,255,255,0.5)',
      border: `1px solid ${flash ? 'rgba(121,80,242,0.3)' : 'rgba(0,60,100,0.1)'}`,
      transition: 'all 0.5s ease',
    }}>
      {/* Day counter */}
      <div style={{
        fontSize: 7, fontWeight: 900, color: '#cc8800', letterSpacing: 2,
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        DAY {dayCount}
      </div>

      {/* Timer progress ring */}
      <svg width={22} height={22} viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(0,60,100,0.08)" strokeWidth="2" />
        <circle
          cx="11" cy="11" r="9" fill="none" stroke="#0099cc" strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 9}`}
          strokeDashoffset={`${2 * Math.PI * 9 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 11 11)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>

      {/* Timer text */}
      <div style={{
        fontSize: 9, fontWeight: 900, color: '#0099cc', minWidth: 32,
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        {mins}:{secs.toString().padStart(2, '0')}
      </div>

      {/* Last crystals earned */}
      {lastCrystals > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 8, fontWeight: 900, color: flash ? '#7950f2' : 'rgba(26,42,58,0.4)',
          fontFamily: "'Share Tech Mono', monospace",
          transition: 'color 0.5s',
        }}>
          <CrystalIcon size="sm" />
          +{lastCrystals.toLocaleString()}
        </div>
      )}
    </div>
  )
}
