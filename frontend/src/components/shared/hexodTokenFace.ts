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
  DIAMOND: { id: 'DIAMOND', metal: '#B9F2FF', carbon: '#050D14', title: '#E0F7FA', engrave_metal: '#0D47A1' },
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
  // Real data shown on the face (owner 2026-10-18: "map every visible datum, excellent visibility")
  rarity?: string        // common … mythic (the ribbon); tier stays the metal
  hexPerDay?: number
  region?: string        // DB biome region (e.g. 'Central European Plain')
  country?: string       // ISO2
  terrain?: string       // urban / rural / mountain … (territory type)
  tokenNo?: string       // token id or album number
  cellId?: string        // H3 cell
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
export const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b', mythic: '#ef4444',
}

/** Text with a dark outline: readable on any background (photo, holo, metal). */
function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string,
  o: { weight?: number; font?: string; maxW?: number; align?: CanvasTextAlign; stroke?: number } = {}) {
  const font = o.font || '"Lilita One", Orbitron, sans-serif'
  ctx.font = `${o.weight ?? 900} ${size}px ${font}`
  if (o.maxW) {
    const w = ctx.measureText(text).width
    if (w > o.maxW) { size = size * o.maxW / w; ctx.font = `${o.weight ?? 900} ${size}px ${font}` }
  }
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  ctx.lineWidth = size * (o.stroke ?? 0.22); ctx.strokeStyle = 'rgba(0,0,0,0.92)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color; ctx.fillText(text, x, y)
  return size
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string) {
  const r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.max(2, h * 0.08); ctx.strokeStyle = stroke; ctx.stroke()
}

const nice = (v?: string) => (v || '').replace(/_/g, ' ').trim().toUpperCase()

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const issuedLabel = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '')
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''
}

/**
 * Premium collectible face (owner 2026-10-18: "readable, premium, the picture showcased, an emission date"):
 * the real picture fills the whole hexagon; few elements, big type — rarity, category, name, 3 stats, issue date, number.
 * The long description lives in the info sheet, not on the face.
 */
export function drawTokenFront(
  ctx: CanvasRenderingContext2D,
  s: number,
  state: TokenFaceProps,
  anim: FrontAnim,
  opts: { enableFilmGrain?: boolean } = {},
) {
  const c = s / 2
  const tier = TIERS[state.tier]
  const rarity = (state.rarity || '').toLowerCase()
  const rc = RARITY_COLORS[rarity] || tier.metal
  const hasImg = !!(anim.cardImg && anim.cardImg.complete && anim.cardImg.naturalWidth > 0)

  ctx.save()
  drawHex(ctx, c, c, s * 0.49); ctx.clip()

  // ── Picture, full bleed (cover-fit, slightly above centre so faces/monuments sit in the window) ──
  if (hasImg) {
    const img = anim.cardImg!
    const iw = img.naturalWidth, ih = img.naturalHeight
    const k = Math.max(s / iw, s / ih) * 1.02, dw = iw * k, dh = ih * k
    ctx.drawImage(img, (s - dw) / 2, (s - dh) * 0.42, dw, dh)
  } else {
    // No verified picture yet: a designed plate (never a random stock photo)
    const pg = ctx.createRadialGradient(c, s * 0.4, s * 0.02, c, s * 0.45, s * 0.62)
    pg.addColorStop(0, rc); pg.addColorStop(0.45, tier.carbon); pg.addColorStop(1, '#020308')
    ctx.fillStyle = pg; ctx.fillRect(0, 0, s, s)
    ctx.globalAlpha = 0.16; ctx.strokeStyle = tier.metal; ctx.lineWidth = Math.max(1, s * 0.0015)
    const hr = s * 0.035
    for (let row = 0, y = 0; y < s + hr; row++, y += hr * 1.5)
      for (let x = row % 2 ? hr * 0.866 : 0; x < s + hr; x += hr * 1.732) { drawHex(ctx, x, y, hr); ctx.stroke() }
    ctx.globalAlpha = 1
    if (state.iconSvg) drawSVGIcon(ctx, c, s * 0.38, s * 0.24, state.iconSvg, state.catColor, tier.metal)
  }

  // ── Legibility: dark veil top (header) and bottom (name + stats), picture stays bright in the middle ──
  const top = ctx.createLinearGradient(0, 0, 0, s * 0.34)
  top.addColorStop(0, 'rgba(3,5,12,0.88)'); top.addColorStop(1, 'rgba(3,5,12,0)')
  ctx.fillStyle = top; ctx.fillRect(0, 0, s, s * 0.34)
  const bot = ctx.createLinearGradient(0, s * 0.44, 0, s)
  bot.addColorStop(0, 'rgba(3,5,12,0)'); bot.addColorStop(0.28, 'rgba(3,5,12,0.72)'); bot.addColorStop(0.55, 'rgba(3,5,12,0.94)')
  bot.addColorStop(1, 'rgba(3,5,12,0.98)')
  ctx.fillStyle = bot; ctx.fillRect(0, s * 0.44, s, s * 0.56)

  // ── Foil: holographic sheen + one glossy diagonal (animated in 3D) ──
  const hr2 = s * 0.5
  const holo = ctx.createLinearGradient(c + Math.cos(anim.holoAngle) * hr2, c + Math.sin(anim.holoAngle) * hr2,
    c - Math.cos(anim.holoAngle) * hr2, c - Math.sin(anim.holoAngle) * hr2)
  const foil = ['legendary', 'mythic', 'epic'].includes(rarity) ? 0.14 : 0.06
  holo.addColorStop(0, `rgba(255,0,140,${foil})`); holo.addColorStop(0.33, `rgba(255,230,0,${foil})`)
  holo.addColorStop(0.66, `rgba(0,220,255,${foil})`); holo.addColorStop(1, `rgba(170,0,255,${foil})`)
  ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = holo; ctx.fillRect(0, 0, s, s)
  ctx.globalCompositeOperation = 'source-over'
  const sx = (anim.shineOffset % (s * 2)) - s * 0.5
  const shine = ctx.createLinearGradient(sx, 0, sx + s * 0.35, s)
  shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(0.5, 'rgba(255,255,255,0.10)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = shine; ctx.fillRect(0, 0, s, s)
  ctx.restore()

  // ── Header: rarity gem pill + category ──
  const ribY = s * 0.13, ribH = s * 0.058, ribW = s * 0.32
  pill(ctx, c - ribW / 2, ribY - ribH / 2, ribW, ribH, rc, 'rgba(0,0,0,0.9)')
  const gloss = ctx.createLinearGradient(0, ribY - ribH / 2, 0, ribY + ribH / 2)
  gloss.addColorStop(0, 'rgba(255,255,255,0.5)'); gloss.addColorStop(0.55, 'rgba(255,255,255,0)')
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = gloss
  ctx.fillRect(c - ribW / 2, ribY - ribH / 2, ribW, ribH / 2); ctx.restore()
  outlined(ctx, nice(rarity || tier.id), c, ribY + s * 0.002, s * 0.036, '#ffffff', { maxW: ribW * 0.84, stroke: 0.16 })
  ctx.save(); ctx.font = `800 ${s * 0.026}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ;(ctx as any).letterSpacing = `${(s * 0.004).toFixed(1)}px`
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = s * 0.012
  ctx.fillStyle = '#e8edff'; ctx.fillText(nice(state.category).slice(0, 26), c, s * 0.198)
  ctx.restore()

  // ── Name: the hero, up to 2 lines, auto-fit ──
  const name = (state.tokenName || '').toUpperCase()
  const maxW = s * 0.76
  let fs = s * 0.078
  ctx.font = `400 ${fs}px "Lilita One", Orbitron, sans-serif`
  let lines = [name]
  if (ctx.measureText(name).width > maxW) {
    const words = name.split(/\s+/)
    let best = [name], bestW = Infinity
    for (let i = 1; i < words.length; i++) {
      const l = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
      const w = Math.max(...l.map(t => ctx.measureText(t).width))
      if (w < bestW) { best = l; bestW = w }
    }
    lines = best
    const w = Math.max(...lines.map(t => ctx.measureText(t).width))
    if (w > maxW) fs = fs * maxW / w
  }
  const nameY = s * (lines.length > 1 ? 0.512 : 0.585)
  lines.forEach((l, i) => outlined(ctx, l, c, nameY + i * fs * 1.02, fs, '#ffffff', { weight: 400, maxW, stroke: 0.14 }))

  // ── Divider in the rarity colour ──
  const dy = s * 0.648
  ctx.strokeStyle = rc; ctx.lineWidth = s * 0.004
  ctx.beginPath(); ctx.moveTo(c - s * 0.2, dy); ctx.lineTo(c - s * 0.025, dy); ctx.moveTo(c + s * 0.025, dy); ctx.lineTo(c + s * 0.2, dy); ctx.stroke()
  ctx.fillStyle = rc; ctx.beginPath(); ctx.moveTo(c, dy - s * 0.014); ctx.lineTo(c + s * 0.014, dy); ctx.lineTo(c, dy + s * 0.014); ctx.lineTo(c - s * 0.014, dy); ctx.closePath(); ctx.fill()

  // ── Stats: 3 columns, big values ──
  const stats: [string, string, string][] = [
    [state.hexPerDay ? `+${Math.round(state.hexPerDay).toLocaleString()}` : '—', 'HEX / DAY', '#fcd34d'],
    [nice(state.terrain || state.biome) || '—', 'TERRAIN', '#a7f3d0'],
    [nice(state.country) || nice(state.region) || '—', state.country ? 'COUNTRY' : 'REGION', '#bfdbfe'],
  ]
  const colW = s * 0.23
  stats.forEach(([val, lab, col], i) => {
    const x = c + (i - 1) * colW
    outlined(ctx, val, x, s * 0.695, s * 0.04, col, { maxW: colW * 0.92, stroke: 0.14 })
    ctx.font = `800 ${s * 0.017}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(214,224,255,0.78)'; ctx.fillText(lab, x, s * 0.731)
  })

  // ── Issue date + edition, then the token number ──
  const issued = issuedLabel(state.date)
  const line1 = [issued ? `ISSUED ${issued}` : '', state.edition ? nice(state.edition) : ''].filter(Boolean).join(' · ')
  if (line1) outlined(ctx, line1, c, s * 0.786, s * 0.024, tier.metal, { font: 'Nunito, sans-serif', weight: 900, maxW: s * 0.6, stroke: 0.2 })
  if (state.tokenNo) outlined(ctx, `No ${state.tokenNo}`, c, s * 0.832, s * 0.028, '#ffffff', { font: '"Roboto Mono", "Courier New", monospace', weight: 700, maxW: s * 0.42, stroke: 0.2 })

  if (opts.enableFilmGrain !== false) {
    ctx.save(); ctx.globalAlpha = 0.012
    for (let i = 0; i < 1500; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2) }
    ctx.restore()
  }

  // ── Frame: bevelled tier metal + inner rarity line ──
  const metal = ctx.createLinearGradient(0, 0, s, s)
  metal.addColorStop(0, '#ffffff'); metal.addColorStop(0.18, tier.metal); metal.addColorStop(0.5, tier.engrave_metal)
  metal.addColorStop(0.82, tier.metal); metal.addColorStop(1, '#ffffff')
  ctx.strokeStyle = metal; ctx.lineWidth = s * 0.026; drawHex(ctx, c, c, s * 0.49); ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = s * 0.004; drawHex(ctx, c, c, s * 0.474); ctx.stroke()
  ctx.strokeStyle = rc; ctx.lineWidth = s * 0.006; drawHex(ctx, c, c, s * 0.466); ctx.stroke()
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
