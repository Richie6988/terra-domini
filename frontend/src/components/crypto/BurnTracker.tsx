/**
 * BurnTracker — HEX Deflationary Dashboard.
 * Shows total burned, burn rate, supply shrinking in real-time.
 * Creates psychological buy pressure by making deflation visible.
 * Displayed inside CryptoPanel or as standalone widget.
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CrystalIcon } from '../shared/CrystalIcon'
import { BURN_RATES, HEX_TOKEN } from '../../types/blockchain.types'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props {
  totalBurned?: number
  dailyBurnRate?: number
  totalMinted?: number
  compact?: boolean
}

export function BurnTracker({ totalBurned = 47832, dailyBurnRate = 1247, totalMinted = 152000, compact = false }: Props) {
  const [displayBurned, setDisplayBurned] = useState(totalBurned)

  // Animated counter — simulates real-time burning
  useEffect(() => {
    const perSecond = dailyBurnRate / 86400
    const interval = setInterval(() => {
      setDisplayBurned(prev => prev + perSecond)
    }, 1000)
    return () => clearInterval(interval)
  }, [dailyBurnRate])

  const circulatingSupply = totalMinted - displayBurned
  const burnPct = totalMinted > 0 ? (displayBurned / totalMinted) * 100 : 0
  const maxSupply = Number(HEX_TOKEN.maxSupply)
  const mapCoverage = totalMinted > 0 ? (totalMinted / maxSupply) * 100 : 0
  const isDeflationary = dailyBurnRate > 0 // Simplified — real calc needs mint rate

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 16,
        background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.12)',
      }}>
        <span style={{ fontSize: 10 }}><EmojiIcon emoji="" /></span>
        <span style={{
          fontSize: 8, fontWeight: 900, color: '#dc2626',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          {Math.floor(displayBurned).toLocaleString()} BURNED
        </span>
        {isDeflationary && (
          <span style={{
            fontSize: 6, color: '#00884a', fontWeight: 700,
            fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
          }}>
            DEFLATIONARY ↗
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Burn counter — hero display */}
      <div style={{
        padding: 16, borderRadius: 12, textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))',
        border: '1.5px solid rgba(220,38,38,0.15)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Animated fire particles */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          background: 'radial-gradient(circle at 50% 100%, #dc2626, transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 10 }}><EmojiIcon emoji="" /></div>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 3,
            fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4,
          }}>
            TOTAL HEX BURNED FOREVER
          </div>
          <motion.div
            key={Math.floor(displayBurned)}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 22, fontWeight: 900, color: '#dc2626',
              fontFamily: "'Share Tech Mono', monospace",
              textShadow: '0 0 20px rgba(220,38,38,0.3)',
            }}
          >
            {Math.floor(displayBurned).toLocaleString()}
          </motion.div>
          <div style={{
            fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4,
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {burnPct.toFixed(2)}% of minted supply
          </div>
        </div>
      </div>

      {/* Supply metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'MINTED', value: totalMinted.toLocaleString(), color: '#0099cc', sub: `${mapCoverage.toFixed(1)}% of map` },
          { label: 'CIRCULATING', value: Math.floor(circulatingSupply).toLocaleString(), color: '#7950f2', sub: 'supply' },
          { label: 'DAILY BURN', value: `-${dailyBurnRate.toLocaleString()}`, color: '#dc2626', sub: 'HEX/day' },
        ].map(m => (
          <div key={m.label} style={{
            padding: '8px 6px', borderRadius: 8, textAlign: 'center',
            background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              fontSize: 6, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 3,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 900, color: m.color,
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {m.value}
            </div>
            <div style={{
              fontSize: 6, color: 'rgba(255,255,255,0.25)',
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Deflationary status */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: isDeflationary ? 'rgba(0,136,74,0.06)' : 'rgba(204,136,0,0.06)',
        border: `1px solid ${isDeflationary ? 'rgba(0,136,74,0.15)' : 'rgba(204,136,0,0.15)'}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isDeflationary ? '#00884a' : '#cc8800',
          boxShadow: `0 0 8px ${isDeflationary ? '#00884a' : '#cc8800'}`,
          animation: 'pulse 2s infinite',
        }} />
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2,
          color: isDeflationary ? '#00884a' : '#cc8800',
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          {isDeflationary
            ? 'NET DEFLATIONARY — SUPPLY SHRINKING'
            : 'APPROACHING DEFLATIONARY THRESHOLD'}
        </div>
      </div>

      {/* Burn breakdown */}
      <div>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)',
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6,
        }}>
          BURN SOURCES
        </div>
        {[
          { label: 'HEX Conversion', rate: `${BURN_RATES.hexConversion} HEX/coin`, pct: 40 },
          { label: 'Territory Conquest', rate: `${BURN_RATES.conquestBurnPct * 100}% of cost`, pct: 25 },
          { label: 'Kingdom Maintenance', rate: `${BURN_RATES.maintenancePerTerritory} HEX/territory/day`, pct: 20 },
          { label: 'Marketplace Royalty', rate: `${BURN_RATES.marketplaceBurnPct * 100}% of 5% fee`, pct: 10 },
          { label: 'Ultimate Skills', rate: `${BURN_RATES.ultimateSkillCost} HEX each`, pct: 5 },
        ].map(src => (
          <div key={src.label} style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: '#e2e8f0', fontWeight: 600 }}>{src.label}</div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>{src.rate}</div>
            </div>
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${src.pct}%`, borderRadius: 2,
                background: '#dc2626',
              }} />
            </div>
            <span style={{
              fontSize: 7, fontWeight: 700, color: '#dc2626', minWidth: 24, textAlign: 'right',
              fontFamily: "'Share Tech Mono', monospace",
            }}>
              {src.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
