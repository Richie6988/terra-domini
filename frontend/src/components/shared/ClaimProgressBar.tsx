/**
 * ClaimProgressBar — Shows ongoing territory claim progress.
 * Used in: HexCard (on territory), ProfilePanel (list), map overlay.
 * Auto-updates every second with countdown timer.
 */
import { useState, useEffect } from 'react'

interface ClaimProgress {
  id: number
  h3_index: string
  method: 'explore' | 'attack' | 'buy'
  progress: number       // 0.0 → 1.0
  eta_seconds: number    // seconds remaining
  hours_required: number
  started_at: string     // ISO timestamp
  territory_name: string
  is_adjacent: boolean
}

export function ClaimProgressBar({ claim, compact = false, onComplete }: {
  claim: ClaimProgress
  compact?: boolean
  onComplete?: () => void
}) {
  const [eta, setEta] = useState(claim.eta_seconds)
  const [pct, setPct] = useState(claim.progress)

  // Live countdown
  useEffect(() => {
    const startEta = claim.eta_seconds
    const startTime = Date.now()

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const remaining = Math.max(0, startEta - elapsed)
      const totalSec = claim.hours_required * 3600
      const newPct = Math.min(1, 1 - (remaining / totalSec))

      setEta(remaining)
      setPct(newPct)

      if (remaining <= 0 && onComplete) onComplete()
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [claim.eta_seconds, claim.hours_required, onComplete])

  const methodIcon = claim.method === 'explore' ? 'magnifier' : claim.method === 'attack' ? 'swords' : 'money_bag'
  const methodColor = claim.method === 'explore' ? '#0099cc' : claim.method === 'attack' ? '#dc2626' : '#cc8800'

  // Format time
  const h = Math.floor(eta / 3600)
  const m = Math.floor((eta % 3600) / 60)
  const s = Math.floor(eta % 60)
  const timeStr = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', borderRadius: 8,
        background: `${methodColor}10`, border: `1px solid ${methodColor}25`,
      }}>
        <span style={{ fontSize: 10 }}>{methodIcon}</span>
        {/* Mini progress bar */}
        <div style={{
          flex: 1, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct * 100}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${methodColor}, ${methodColor}cc)`,
            transition: 'width 1s linear',
          }} />
        </div>
        <span style={{
          fontSize: 7, fontWeight: 700, color: methodColor, minWidth: 40, textAlign: 'right',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {eta <= 0 ? 'READY' : timeStr}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: 'linear-gradient(180deg, rgba(13,27,42,0.95), rgba(220,230,242,0.92))',
      border: `1px solid ${methodColor}30`,
      boxShadow: `0 2px 12px ${methodColor}15`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{methodIcon}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1,
            fontFamily: "'Orbitron', sans-serif",
          }}>
            {claim.method === 'explore' ? 'EXPLORING' : claim.method === 'attack' ? 'ATTACKING' : 'BUYING'}
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 900, color: methodColor,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {eta <= 0 ? 'READY!' : timeStr}
        </span>
      </div>

      {/* Territory name */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 6,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {claim.territory_name}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, borderRadius: 4,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${methodColor}, ${methodColor}cc)`,
          boxShadow: `0 0 8px ${methodColor}40`,
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 7, color: 'rgba(255,255,255,0.4)',
      }}>
        <span>{Math.round(pct * 100)}%</span>
        <span>{claim.is_adjacent ? 'Adjacent' : 'Distant'} · {claim.hours_required}h total</span>
      </div>
    </div>
  )
}

/** List of all pending claims (for ProfilePanel / KingdomPanel) */
export function PendingClaimsList({ claims, onClaimComplete }: {
  claims: ClaimProgress[]
  onClaimComplete?: (claimId: number) => void
}) {
  if (!claims.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Orbitron', sans-serif", marginBottom: 2,
      }}>
        ONGOING CLAIMS ({claims.length})
      </div>
      {claims.map(c => (
        <ClaimProgressBar
          key={c.id}
          claim={c}
          onComplete={() => onClaimComplete?.(c.id)}
        />
      ))}
    </div>
  )
}

export type { ClaimProgress }
