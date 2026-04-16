/**
 * hexodTokenFace.ts
 *
 * Shared token face drawing logic — extracted from the gold standard
 * front-face renderer (read_only_templates/token_3Dviewer_admin_overlay.html).
 *
 * Two exports:
 *   - TIERS, TokenFaceProps, helpers (used by both 3D and 2D viewers)
 *   - drawTokenFront(ctx, size, state, anim) — the single source-of-truth
 *     for painting the token's front face into ANY canvas context.
 *
 * The 3D viewer (hexodToken3D) calls this into its texture canvas with
 * animated shineOffset/holoAngle.
 * The 2D viewer (createTokenFace2D) calls this once into an HTML canvas
 * with static shineOffset/holoAngle = 0.
 */

// ══════════════════════════════════════════════════════════════════
// TIERS — from gold standard
// ══════════════════════════════════════════════════════════════════
export const TIERS = {
  BRONZE:  { id: 'BRONZE',  metal: '#CD7F32', carbon: '#1C1610', title: '#EBC49F', engrave_metal: '#5C3317' },
  SILVER:  { id: 'SILVER',  metal: '#C0C0C0', carbon: '#16181A', title: '#FFFFFF', engrave_metal: '#4A4A4A' },
  GOLD:    { id: 'GOLD',    metal: '#D4AF37', carbon: '#1A1608', title: '#FFECB3', engrave_metal: '#634E14' },
  EMERALD: { id: 'EMERALD', metal: '#2ECC71', carbon: '#051209', title: '#A9DFBF', engrave_metal: '#145A32' },
} as const

export type TierKey = keyof typeof TIERS

// ══════════════════════════════════════════════════════════════════
// BIOME IMAGES — random territory photos for demo/showcase
// ══════════════════════════════════════════════════════════════════
export const BIOME_IMAGES: Record<string, string[]> = {
  urban:      ['https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600','https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600','https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600'],
  rural:      ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600','https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600','https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600'],
  forest:     ['https://images.unsplash.com/photo-1448375240586-882707db888b?w=600','https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=600','https://images.unsplash.com/photo-1476362555312-ab9e108a0b7e?w=600'],
  mountain:   ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600','https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600','https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600'],
  coastal:    ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600','https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600','https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=600'],
  desert:     ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600','https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=600','https://images.unsplash.com/photo-1542401886-65d6c61db217?w=600'],
  tundra:     ['https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=600','https://images.unsplash.com/photo-1484950763426-56b5bf172dbb?w=600'],
  industrial: ['https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600','https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=600'],
  landmark:   ['https://images.unsplash.com/photo-1431274172761-fca41d930114?w=600','https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600','https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'],
}

const ALL_IMAGES = Object.values(BIOME_IMAGES).flat()
const TIER_KEYS: TierKey[] = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD']

/** Pick a random image URL for a biome (or any random if biome unknown). */
export function randomBiomeImage(biome?: string): string {
  const pool = (biome && BIOME_IMAGES[biome.toLowerCase()]) || ALL_IMAGES
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Pick a random tier key. Weighted: BRONZE 50%, SILVER 25%, GOLD 15%, EMERALD 10%. */
export function randomTier(): TierKey {
  const r = Math.random()
  if (r < 0.50) return 'BRONZE'
  if (r < 0.75) return 'SILVER'
  if (r < 0.90) return 'GOLD'
  return 'EMERALD'
}

export interface TokenFaceProps {
  tier: TierKey
  category: string       // e.g. 'ANCIENT FOREST'
  catId?: string         // e.g. 'FOR'
  catColor: string       // e.g. '#39FF14'
  biome: string          // e.g. 'EUROPA'
  tokenName: string      // e.g. 'CRIMSON PEAK'
  description?: string
  edition?: string
  serial: number
  maxSupply: number
  owner?: string
  date?: string
  iconSvg?: string       // raw SVG string for category icon
}

export interface FrontAnim {
  shineOffset: number
  holoAngle: number
  cardImg: HTMLImageElement | null
}

// ══════════════════════════════════════════════════════════════════
// HELPERS — from gold standard
// ══════════════════════════════════════════════════════════════════
export function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle = 0) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI / 3) - Math.PI / 2 + angle
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
  }
  ctx.closePath()
}

export function wrapTextCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      lines.push(line.trim())
      line = words[n] + ' '
    } else {
      line = testLine
    }
  }
  lines.push(line.trim())
  const totalHeight = lines.length * lineHeight
  let startY = y - (totalHeight / 2) + (lineHeight / 2)
  lines.forEach(l => {
    ctx.fillText(l, x, startY)
    startY += lineHeight
  })
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  const regex = /(\w+[-\w]*)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(s)) !== null) out[m[1]] = m[2]
  return out
}

function drawSVGContent(ctx: CanvasRenderingContext2D, svgString: string, useColor: string) {
  const circleRe = /<circle([^>]*)\/?>/g
  let m: RegExpExecArray | null
  while ((m = circleRe.exec(svgString)) !== null) {
    const a = parseAttrs(m[1])
    ctx.beginPath()
    ctx.arc(parseFloat(a.cx || '0'), parseFloat(a.cy || '0'), parseFloat(a.r || '0'), 0, Math.PI * 2)
    if (a.fill && a.fill !== 'none') {
      ctx.fillStyle = a.fill === 'currentColor' ? useColor : a.fill
      ctx.fill()
    }
    if (a.stroke && a.stroke !== 'none') {
      ctx.strokeStyle = a.stroke === 'currentColor' ? useColor : a.stroke
      ctx.lineWidth = parseFloat(a['stroke-width'] || '1')
      ctx.stroke()
    }
  }
  const pathRe = /<path([^>]*)\/?>/g
  while ((m = pathRe.exec(svgString)) !== null) {
    const a = parseAttrs(m[1])
    if (!a.d) continue
    try {
      const p = new Path2D(a.d)
      if (a.fill && a.fill !== 'none') {
        ctx.fillStyle = a.fill === 'currentColor' ? useColor : a.fill
        ctx.fill(p)
      }
      if (a.stroke && a.stroke !== 'none') {
        ctx.strokeStyle = a.stroke === 'currentColor' ? useColor : a.stroke
        ctx.lineWidth = parseFloat(a['stroke-width'] || '1')
        ctx.lineCap = (a['stroke-linecap'] as CanvasLineCap) || 'butt'
        ctx.lineJoin = (a['stroke-linejoin'] as CanvasLineJoin) || 'miter'
        ctx.stroke(p)
      }
    } catch {}
  }
  const rectRe = /<rect([^>]*)\/?>/g
  while ((m = rectRe.exec(svgString)) !== null) {
    const a = parseAttrs(m[1])
    const x = parseFloat(a.x || '0'), y = parseFloat(a.y || '0')
    const w = parseFloat(a.width || '0'), h = parseFloat(a.height || '0')
    if (a.fill && a.fill !== 'none') {
      ctx.fillStyle = a.fill === 'currentColor' ? useColor : a.fill
      ctx.fillRect(x, y, w, h)
    }
    if (a.stroke && a.stroke !== 'none') {
      ctx.strokeStyle = a.stroke === 'currentColor' ? useColor : a.stroke
      ctx.lineWidth = parseFloat(a['stroke-width'] || '1')
      ctx.strokeRect(x, y, w, h)
    }
  }
}

export function drawSVGIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  svgString: string, iconColor: string, tierMetal: string,
) {
  if (!svgString) return
  const lineW = Math.max(2, size * 0.04)

  ctx.save()
  ctx.translate(x, y)
  ctx.shadowBlur = size * 0.4
  ctx.shadowColor = iconColor
  ctx.fillStyle = 'rgba(2, 2, 2, 0.95)'
  drawHex(ctx, 0, 0, size / 2)
  ctx.fill()
  ctx.strokeStyle = tierMetal
  ctx.lineWidth = lineW
  ctx.stroke()
  ctx.beginPath()
  drawHex(ctx, 0, 0, (size / 2) - size * 0.08)
  ctx.strokeStyle = iconColor
  ctx.globalAlpha = 0.5
  ctx.lineWidth = lineW * 0.6
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.restore()

  ctx.save()
  ctx.translate(x, y)
  const vbMatch = svgString.match(/viewBox="([^"]+)"/)
  let vbSize = 24
  if (vbMatch) {
    const parts = vbMatch[1].split(/\s+/).map(parseFloat)
    if (parts.length === 4) vbSize = parts[2]
  }
  const scale = (size - size * 0.35) / vbSize
  ctx.scale(scale, scale)
  ctx.translate(-vbSize / 2, -vbSize / 2)
  ctx.fillStyle = iconColor
  ctx.strokeStyle = iconColor
  drawSVGContent(ctx, svgString, iconColor)
  ctx.restore()
}

// ══════════════════════════════════════════════════════════════════
// drawTokenFront — port of gold standard front face
//
// ctx    : target 2D context (any canvas — texture, offscreen, visible)
// s      : size in pixels (canvas is assumed s×s)
// state  : token data (tier/category/biome/title/etc)
// anim   : animation state (shineOffset, holoAngle, loaded image)
// opts   : enableFilmGrain (true for 3D animated viewer, false for static 2D)
// ══════════════════════════════════════════════════════════════════
export function drawTokenFront(
  ctx: CanvasRenderingContext2D,
  s: number,
  state: TokenFaceProps,
  anim: FrontAnim,
  opts: { enableFilmGrain?: boolean } = {},
) {
  const c = s / 2
  const tier = TIERS[state.tier]

  // Deep black background
  ctx.fillStyle = '#020202'
  ctx.fillRect(0, 0, s, s)

  const boxW = s * 0.71, boxX = (s - boxW) / 2

  // Holographic rainbow overlay
  ctx.save()
  const holoRadius = s * 0.4
  const holoGradient = ctx.createLinearGradient(
    c + Math.cos(anim.holoAngle) * holoRadius,
    c + Math.sin(anim.holoAngle) * holoRadius,
    c - Math.cos(anim.holoAngle) * holoRadius,
    c - Math.sin(anim.holoAngle) * holoRadius,
  )
  holoGradient.addColorStop(0, 'rgba(255,0,128,0.15)')
  holoGradient.addColorStop(0.2, 'rgba(255,128,0,0.12)')
  holoGradient.addColorStop(0.4, 'rgba(255,255,0,0.15)')
  holoGradient.addColorStop(0.6, 'rgba(0,255,128,0.12)')
  holoGradient.addColorStop(0.8, 'rgba(0,128,255,0.15)')
  holoGradient.addColorStop(1, 'rgba(128,0,255,0.12)')
  ctx.fillStyle = holoGradient
  drawHex(ctx, c, c, s * 0.49)
  ctx.fill()
  ctx.restore()

  // Metallic shimmer gradient (static for 2D: shineOffset = s * 0.15)
  const shineWidth = s * 0.5
  const g = ctx.createLinearGradient(anim.shineOffset * 2, 0, anim.shineOffset * 2 + shineWidth, 0)
  g.addColorStop(0, tier.metal)
  g.addColorStop(0.4, '#ffffff')
  g.addColorStop(0.5, '#ffffff')
  g.addColorStop(0.6, '#ffffff')
  g.addColorStop(1, tier.metal)

  // Rarity badge (top-right)
  const badgeX = boxX + boxW - s * 0.06
  const badgeY = s * 0.14
  const badgeSize = s * 0.042
  ctx.save()
  ctx.shadowBlur = 50
  ctx.shadowColor = tier.metal
  ctx.fillStyle = tier.carbon
  drawHex(ctx, badgeX, badgeY, badgeSize)
  ctx.fill()
  ctx.strokeStyle = tier.metal
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.fillStyle = tier.metal
  ctx.font = `900 ${s * 0.03}px Orbitron`
  ctx.textAlign = 'center'
  ctx.fillText(tier.id[0], badgeX, badgeY + s * 0.01)
  ctx.restore()

  // Category
  ctx.textAlign = 'center'
  ctx.fillStyle = g
  ctx.font = `bold ${s * 0.032}px Orbitron`
  ctx.fillText(state.category, c, s * 0.166)

  // Icon row (single icon)
  const iconRowY = s * 0.205
  const iconSize = s * 0.032
  if (state.iconSvg) drawSVGIcon(ctx, c, iconRowY, iconSize, state.iconSvg, state.catColor, tier.metal)

  // Biome
  ctx.textAlign = 'center'
  ctx.fillStyle = g
  ctx.font = `bold ${s * 0.032}px Orbitron`
  ctx.fillText(state.biome, c, s * 0.264)

  // Image
  const imageY = s * 0.293
  const imageH = s * 0.342
  ctx.save()
  ctx.shadowBlur = s * 0.05
  ctx.shadowColor = state.catColor
  if (anim.cardImg && anim.cardImg.complete && anim.cardImg.naturalWidth > 0) {
    ctx.drawImage(anim.cardImg, boxX, imageY, boxW, imageH)
  } else {
    // Placeholder: catColor gradient
    const pg = ctx.createLinearGradient(boxX, imageY, boxX + boxW, imageY + imageH)
    pg.addColorStop(0, state.catColor + '40')
    pg.addColorStop(1, '#0a0a0a')
    ctx.fillStyle = pg
    ctx.fillRect(boxX, imageY, boxW, imageH)
  }
  ctx.restore()

  // Title bar behind title
  const titleY = imageY + imageH - s * 0.034
  const titleBarH = s * 0.05
  const fadeW = s * 0.025
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.88)'
  ctx.fillRect(boxX, titleY - titleBarH * 0.55, boxW, titleBarH)
  const titleFadeL = ctx.createLinearGradient(boxX - fadeW, 0, boxX, 0)
  titleFadeL.addColorStop(0, 'rgba(0,0,0,0)')
  titleFadeL.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = titleFadeL
  ctx.fillRect(boxX - fadeW, titleY - titleBarH * 0.55, fadeW, titleBarH)
  const titleFadeR = ctx.createLinearGradient(boxX + boxW, 0, boxX + boxW + fadeW, 0)
  titleFadeR.addColorStop(0, 'rgba(0,0,0,0.88)')
  titleFadeR.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = titleFadeR
  ctx.fillRect(boxX + boxW, titleY - titleBarH * 0.55, fadeW, titleBarH)
  ctx.restore()

  // Title text
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `900 ${s * 0.047}px Orbitron`
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'
  ctx.lineWidth = s * 0.003
  ctx.strokeText(state.tokenName, c, titleY + s * 0.008)
  ctx.fillStyle = g
  ctx.shadowBlur = 40
  ctx.shadowColor = state.catColor
  ctx.fillText(state.tokenName, c, titleY + s * 0.008)
  ctx.restore()

  // Side vertical text
  ctx.font = `900 ${s * 0.026}px Orbitron`
  ctx.save()
  ctx.translate(boxX - s * 0.035, imageY + imageH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = g
  ctx.shadowBlur = 25
  ctx.shadowColor = tier.metal
  ctx.fillText(tier.id, 0, 0)
  ctx.restore()
  ctx.save()
  ctx.translate(boxX + boxW + s * 0.035, imageY + imageH / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = g
  ctx.shadowBlur = 25
  ctx.shadowColor = tier.metal
  ctx.fillText(`${state.serial}/${state.maxSupply}`, 0, 0)
  ctx.restore()

  // Description box
  const descY = imageY + imageH + s * 0.02
  const descH = s * 0.352
  ctx.save()
  ctx.shadowBlur = 40
  ctx.shadowColor = state.catColor
  ctx.fillStyle = 'rgba(5,5,5,0.98)'
  ctx.fillRect(boxX, descY, boxW, descH)
  ctx.restore()
  ctx.strokeStyle = g
  ctx.lineWidth = 4
  ctx.strokeRect(boxX + s * 0.01, descY + s * 0.01, boxW - s * 0.02, descH - s * 0.02)
  ctx.strokeStyle = state.catColor
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 2
  ctx.strokeRect(boxX + s * 0.012, descY + s * 0.012, boxW - s * 0.024, descH - s * 0.024)
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e0e0e0'
  ctx.font = `italic ${s * 0.021}px Georgia`
  const text = state.description || `This token certifies sovereign ownership of the identified HEXOD territory. Geospatial data encrypted via Vault Alpha protocol. Rarity guaranteed by Tier ${tier.id}.`
  wrapTextCentered(ctx, text, c, descY + s * 0.08, boxW - s * 0.1, s * 0.03)

  // Vignette
  ctx.save()
  const vignette = ctx.createRadialGradient(c, c, s * 0.25, c, c, s * 0.55)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, s, s)
  ctx.restore()

  // Film grain (expensive — skip for small 2D thumbnails)
  if (opts.enableFilmGrain !== false) {
    ctx.save()
    ctx.globalAlpha = 0.02
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Outer hex border
  ctx.strokeStyle = tier.metal
  ctx.lineWidth = s * 0.022
  drawHex(ctx, c, c, s * 0.492)
  ctx.stroke()
}

// ══════════════════════════════════════════════════════════════════
// createTokenFace2D — paints a static token face into an HTML canvas.
//
// Usage:
//   const canvas = document.createElement('canvas')
//   canvas.width = 256; canvas.height = 256
//   createTokenFace2D(canvas, { tier: 'GOLD', category: 'FOREST', ... })
//
// Async-safe: if imageSrc provided, re-paints after image loads.
// Returns a cleanup function that aborts pending image load.
// ══════════════════════════════════════════════════════════════════
export interface TokenFace2DProps extends TokenFaceProps {
  imageSrc?: string
  clipToHex?: boolean  // clip rendering to hexagonal shape (default true)
}

export function createTokenFace2D(canvas: HTMLCanvasElement, props: TokenFace2DProps): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const s = canvas.width
  const c = s / 2

  // Static anim values — shineOffset positioned for best static look
  const anim: FrontAnim = {
    shineOffset: s * 0.15,
    holoAngle: Math.PI * 0.33,
    cardImg: null,
  }

  const paint = () => {
    ctx.clearRect(0, 0, s, s)

    // Clip to hexagon if requested (default: yes)
    if (props.clipToHex !== false) {
      ctx.save()
      drawHex(ctx, c, c, s * 0.495)
      ctx.clip()
    }

    drawTokenFront(ctx, s, props, anim, { enableFilmGrain: s >= 512 })

    if (props.clipToHex !== false) ctx.restore()
  }

  paint()

  // Async image load
  let aborted = false
  if (props.imageSrc) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (aborted) return
      anim.cardImg = img
      paint()
    }
    img.onerror = () => {}
    img.src = props.imageSrc
  }

  return () => { aborted = true }
}
