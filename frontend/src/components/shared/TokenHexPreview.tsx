/**
 * TokenHexPreview — 2D hexagonal token thumbnail.
 * Renders a hex-shaped card with icon, rarity glow, and tier border.
 * Used everywhere tokens are displayed: Codex grid, Auctions, Marketplace.
 * Click → opens full Token3DViewer.
 */
import { useRef, useEffect } from 'react'
import { getIcon as getIconSVG } from './iconBank'

const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(148,163,184,0.3)',
  uncommon: 'rgba(34,197,94,0.4)',
  rare: 'rgba(59,130,246,0.5)',
  epic: 'rgba(139,92,246,0.5)',
  legendary: 'rgba(245,158,11,0.6)',
  mythic: 'rgba(236,72,153,0.7)',
}

const TIER_BORDER: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
  mythic: '#ec4899',
}

interface Props {
  iconId: string
  rarity?: string
  catColor?: string
  size?: number
  name?: string
  shiny?: boolean
  onClick?: () => void
}

export function TokenHexPreview({ iconId, rarity = 'common', catColor = '#0099cc', size = 64, name, shiny, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = size * 2 // retina
    canvas.width = s
    canvas.height = s
    ctx.clearRect(0, 0, s, s)

    const cx = s / 2
    const cy = s / 2
    const r = s * 0.42

    // Draw hexagon path
    const hexPath = () => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }

    // Glow
    ctx.shadowColor = RARITY_GLOW[rarity] || RARITY_GLOW.common
    ctx.shadowBlur = s * 0.12
    hexPath()
    ctx.fillStyle = '#1a2a3a'
    ctx.fill()
    ctx.shadowBlur = 0

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, s, s)
    grad.addColorStop(0, catColor + '40')
    grad.addColorStop(0.5, '#1a2a3a')
    grad.addColorStop(1, catColor + '25')
    hexPath()
    ctx.fillStyle = grad
    ctx.fill()

    // Border
    const borderColor = TIER_BORDER[rarity] || TIER_BORDER.common
    hexPath()
    ctx.strokeStyle = borderColor
    ctx.lineWidth = s * 0.025
    ctx.stroke()

    // Inner border (metallic)
    const innerR = r * 0.88
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const x = cx + innerR * Math.cos(angle)
      const y = cy + innerR * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = borderColor + '40'
    ctx.lineWidth = s * 0.01
    ctx.stroke()

    // Icon — try SVG, fallback to text
    const svg = getIconSVG(iconId)
    if (svg) {
      const img = new Image()
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(svgBlob)
      img.onload = () => {
        const iconSize = r * 1.0
        ctx.drawImage(img, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize)
        URL.revokeObjectURL(url)
      }
      img.src = url
    }

    // Shiny sparkle overlay
    if (shiny) {
      for (let i = 0; i < 8; i++) {
        const sx = cx + (Math.random() - 0.5) * r * 1.4
        const sy = cy + (Math.random() - 0.5) * r * 1.4
        const sparkR = s * 0.015 + Math.random() * s * 0.02
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`
        ctx.beginPath()
        ctx.arc(sx, sy, sparkR, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [iconId, rarity, catColor, size, shiny])

  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block' }}
      />
      {name && (
        <div style={{
          position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
          fontSize: Math.max(6, size * 0.11), fontWeight: 900,
          color: TIER_BORDER[rarity] || '#94a3b8',
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 0.5, whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>
          {name.length > 12 ? name.slice(0, 10) + '…' : name}
        </div>
      )}
    </div>
  )
}
