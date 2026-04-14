/**
 * TokenFace2D — Static 2D view of the token's front face.
 *
 * Renders the SAME gold-standard front face used in the 3D viewer,
 * but flat on an HTML canvas (no Three.js, no animation).
 *
 * Use this EVERYWHERE a 2D token preview is adequate:
 *   - Marketplace listings
 *   - Auction thumbnails
 *   - Safari captures
 *   - Event rewards
 *   - Codex grid
 *
 * Click handler (onClick) typically opens the full Token3DViewer.
 *
 * Props are identical to Token3DViewer so swapping is trivial.
 */
import { useEffect, useRef } from 'react'
import { createTokenFace2D, type TierKey } from './hexodTokenFace'
import { getIcon } from './iconBank'

export interface TokenFace2DProps {
  tier?: TierKey
  category?: string
  catId?: string
  catColor?: string
  biome?: string
  tokenName?: string
  description?: string
  edition?: string
  serial?: number
  maxSupply?: number
  owner?: string
  date?: string
  iconId?: string           // key into iconBank
  imageSrc?: string
  size?: number             // pixel size of the square canvas (default 256)
  onClick?: () => void
  style?: React.CSSProperties
  clipToHex?: boolean       // default true — clip to hexagon shape
}

export function TokenFace2D({
  tier = 'BRONZE',
  category = 'TERRITORY',
  catId,
  catColor = '#39FF14',
  biome = 'RURAL',
  tokenName = 'HEXOD TERRITORY',
  description,
  edition = 'GENESIS',
  serial = 1,
  maxSupply = 1000,
  owner,
  date,
  iconId,
  imageSrc,
  size = 256,
  onClick,
  style,
  clipToHex = true,
}: TokenFace2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Render at 2x resolution for sharpness, display at 1x
    const pixelSize = Math.min(size * 2, 1024)
    canvas.width = pixelSize
    canvas.height = pixelSize

    const iconSvg = iconId ? getIcon(iconId) : ''

    const cleanup = createTokenFace2D(canvas, {
      tier,
      category: category.toUpperCase(),
      catId,
      catColor,
      biome: biome.toUpperCase(),
      tokenName: tokenName.toUpperCase(),
      description,
      edition,
      serial,
      maxSupply,
      owner,
      date,
      iconSvg,
      imageSrc,
      clipToHex,
    })

    return cleanup
  }, [tier, category, catId, catColor, biome, tokenName, description, edition, serial, maxSupply, owner, date, iconId, imageSrc, size, clipToHex])

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: 'block',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease-out',
        ...style,
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLCanvasElement).style.transform = 'scale(1.04)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLCanvasElement).style.transform = 'scale(1)' }}
    />
  )
}
