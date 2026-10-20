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
  series?: number        // series number (#1 until a conquest mints #2)
  pictos?: string[]      // raw SVGs: category · terrain · main resource — what makes this token unique (original design)
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
  common: '#cbd5e1', uncommon: '#fbbf24', rare: '#10b981', epic: '#67e8f9', legendary: '#67e8f9', mythic: '#67e8f9',
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

// ── Engraved icons (owner 2026-10-19): every picto of the token cut into the frame, monochrome so 1, 2 or 3 stay
// clean. iconBank SVGs are multi-colour with a background disc and <g transform>: rendered as images (the browser
// handles transforms), disc removed, then turned into a silhouette.
const _engraveImgs: Record<string, HTMLImageElement> = {}
function engraveImg(svg: string): HTMLImageElement {
  let im = _engraveImgs[svg]
  if (!im) {
    let clean = svg.replace(/<circle cx="128" cy="128" r="9\d"[^>]*\/>/, '')     // background disc
    if (!clean.includes('xmlns')) clean = clean.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    clean = clean.replace('<svg ', '<svg width="256" height="256" ')
    im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clean)
    _engraveImgs[svg] = im
  }
  return im
}
/** Resolves once the engraved icons can be drawn (callers repaint then). */
export function whenEngravingsReady(svgs: (string | undefined)[]): Promise<void> {
  return Promise.all(svgs.filter(Boolean).map(svg => new Promise<void>(res => {
    const im = engraveImg(svg!)
    if (im.complete) return res()
    im.addEventListener('load', () => res(), { once: true }); im.addEventListener('error', () => res(), { once: true })
  }))).then(() => undefined)
}
function engravedIcon(ctx: CanvasRenderingContext2D, svg: string, size: number) {
  const im = engraveImg(svg)
  if (!im.complete || !im.naturalWidth) return
  const px = Math.ceil(size * 2.2)                          // the artwork fills ~45 % of the iconBank box: scale it up
  const tint = (color: string) => {
    const oc = document.createElement('canvas'); oc.width = oc.height = px
    const o = oc.getContext('2d')!
    o.drawImage(im, 0, 0, px, px)
    o.globalCompositeOperation = 'source-in'; o.fillStyle = color; o.fillRect(0, 0, px, px)
    return oc
  }
  // set into the metal: dark cut outline around the shape, then the icon in its own colours (owner 2026-10-19:
  // "improve icon readability, colour it")
  const cut = tint('#1c1002'), o = Math.max(1.5, size * 0.06)
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]])
    ctx.drawImage(cut, -px / 2 + dx, -px / 2 + dy, px, px)
  ctx.drawImage(tint('rgba(255,255,255,0.55)'), -px / 2, -px / 2 + o * 1.6, px, px)   // bevel light below
  ctx.drawImage(cut, -px / 2, -px / 2 + o * 0.8, px, px)
  ctx.drawImage(im, -px / 2, -px / 2, px, px)
}

const SPECIES_LABEL: Record<string, string> = {
  species_animal: 'ANIMAL', species_bird: 'BIRD', species_marine: 'MARINE LIFE', species_fossil: 'DINOSAUR',
  species_insect: 'INSECT', species_vegetal: 'PLANT', species_mushroom: 'FUNGUS', species_microorganism: 'MICROBE',
}
const nice = (v?: string) => { const k = (v || '').toLowerCase().replace(/\s+/g, '_'); return SPECIES_LABEL[k] || (v || '').replace(/_/g, ' ').trim().toUpperCase() }
const RARITY_NAME: Record<string, string> = { common: 'SILVER', uncommon: 'GOLD', rare: 'EMERALD', epic: 'DIAMOND', legendary: 'DIAMOND', mythic: 'DIAMOND' }

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/**
 * Collectible face, Sorare-grade (owner 2026-10-18: "think Sorare: clean, premium, the picture first").
 * Full-bleed sharp picture; centre: name with a dark outline; 3 bright lines of story; bottom: HEX / day.
 * The wide metal frame is engraved (owner 2026-10-19, v7): NAME top-left edge, HEX value top-right edge, CATEGORY left
 * edge, RARITY right edge, ID bottom-left, series "#1" bottom-right — the picture fills the centre (the story is engraved on the back); bottom: main picto + "184 HEX". A dark glass panel sits
 * behind the name and the story for contrast. The inner line carries the rarity colour.
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
  const SANS = 'Nunito, "Segoe UI", sans-serif'

  ctx.save()
  drawHex(ctx, c, c, s * 0.49); ctx.clip()

  // ── Picture, full bleed ──
  if (hasImg) {
    const img = anim.cardImg!
    const iw = img.naturalWidth, ih = img.naturalHeight
    const k = Math.max(s / iw, s / ih), dw = iw * k, dh = ih * k
    // 1280 px Wikimedia photos scaled down: high-quality smoothing, and a light grade so they pop like a premium card
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.filter = 'saturate(1.12) contrast(1.06)'
    ctx.drawImage(img, (s - dw) / 2, (s - dh) * 0.4, dw, dh)
    ctx.filter = 'none'
  } else {
    const pg = ctx.createRadialGradient(c, s * 0.36, s * 0.02, c, s * 0.45, s * 0.65)
    pg.addColorStop(0, rc + 'cc'); pg.addColorStop(0.5, tier.carbon); pg.addColorStop(1, '#020308')
    ctx.fillStyle = pg; ctx.fillRect(0, 0, s, s)
    if (state.iconSvg) drawSVGIcon(ctx, c, s * 0.36, s * 0.2, state.iconSvg, state.catColor, tier.metal)
  }

  // ── Soft bottom shade for the title block; a light top shade for the pill ──
  const top = ctx.createLinearGradient(0, 0, 0, s * 0.22)
  top.addColorStop(0, 'rgba(0,0,0,0.55)'); top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top; ctx.fillRect(0, 0, s, s * 0.22)
  const bot = ctx.createLinearGradient(0, s * 0.46, 0, s)
  bot.addColorStop(0, 'rgba(4,6,12,0)'); bot.addColorStop(0.7, 'rgba(4,6,12,0.25)'); bot.addColorStop(1, 'rgba(4,6,12,0.55)')
  ctx.fillStyle = bot; ctx.fillRect(0, s * 0.46, s, s * 0.54)

  // ── Gloss: one slow diagonal sheen; a faint prism only on rare+ ──
  const sx = (anim.shineOffset % (s * 2)) - s * 0.5
  const shine = ctx.createLinearGradient(sx, 0, sx + s * 0.3, s)
  shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(0.5, 'rgba(255,255,255,0.09)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = shine; ctx.fillRect(0, 0, s, s)
  if (['rare', 'epic', 'legendary', 'mythic'].includes(rarity)) {
    const hr = s * 0.5, a = anim.holoAngle
    const holo = ctx.createLinearGradient(c + Math.cos(a) * hr, c + Math.sin(a) * hr, c - Math.cos(a) * hr, c - Math.sin(a) * hr)
    const f = rarity === 'rare' ? 0.05 : rarity === 'epic' ? 0.08 : 0.12
    holo.addColorStop(0, `rgba(255,0,140,${f})`); holo.addColorStop(0.5, `rgba(0,220,255,${f})`); holo.addColorStop(1, `rgba(255,230,0,${f})`)
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = holo; ctx.fillRect(0, 0, s, s); ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()

  if (opts.enableFilmGrain !== false) {
    ctx.save(); ctx.globalAlpha = 0.01
    for (let i = 0; i < 1200; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2) }
    ctx.restore()
  }

  // ── Frame: wide polished tier metal, engraved (owner 2026-10-19): terrain on the left edge, edition + date on the right ──
  const metal = ctx.createLinearGradient(0, 0, s, s)
  metal.addColorStop(0, '#ffffff'); metal.addColorStop(0.2, tier.metal); metal.addColorStop(0.5, tier.engrave_metal)
  metal.addColorStop(0.8, tier.metal); metal.addColorStop(1, '#ffffff')
  const band = s * 0.06, rb = s * 0.5 - band / 2 - s * 0.002
  ctx.strokeStyle = metal; ctx.lineWidth = band; ctx.lineJoin = 'miter'; drawHex(ctx, c, c, rb); ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = s * 0.003; drawHex(ctx, c, c, rb - band / 2); ctx.stroke()
  ctx.strokeStyle = rc; ctx.lineWidth = s * 0.005; drawHex(ctx, c, c, rb - band / 2 - s * 0.006); ctx.stroke()
  // text radius: a hair inside the band's middle — the 3D lip hides the outer rim (owner: "trop à l'extérieur")
  const rt = rb - band * 0.18
  // engraved text centred in the band's height: the cap box (not the font box) is centred on the band's middle line
  const cutText = (text: string, x: number) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    const m = ctx.measureText(text)
    const y = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(text, x, y + s * 0.0022)    // bevel light
    ctx.fillStyle = 'rgba(28,16,2,0.92)'; ctx.fillText(text, x, y)                     // cut into the metal
  }
  const engrave = (text: string, side: -1 | 1) => {
    if (!text) return
    const x = c + side * rt * Math.cos(Math.PI / 6)          // middle of the vertical edge's band
    ctx.save(); ctx.translate(x, c); ctx.rotate(side * Math.PI / 2)
    let ef = s * 0.034
    ctx.font = `900 ${ef}px Orbitron, ${SANS}`; (ctx as any).letterSpacing = `${(s * 0.004).toFixed(1)}px`
    while (ctx.measureText(text).width > rb * 0.9 && ef > s * 0.012) { ef -= s * 0.001; ctx.font = `900 ${ef}px Orbitron, ${SANS}` }
    cutText(text, 0)
    ;(ctx as any).letterSpacing = '0px'; ctx.restore()
  }
  engrave(nice(state.category), -1)
  engrave(RARITY_NAME[rarity] || tier.id, 1)
  // Upper edges (owner 2026-10-19): the NAME on the top-left edge, the HEX value on the top-right edge — the picture
  // keeps the whole centre. Same engraving as the vertical edges.
  const rm = rt * Math.cos(Math.PI / 6)                       // centre → edge middle
  const onEdge = (deg: number, rot: number, text: string, maxRatio: number) => {
    if (!text) return
    const a = deg * Math.PI / 180
    ctx.save(); ctx.translate(c + rm * Math.cos(a), c + rm * Math.sin(a)); ctx.rotate(rot)
    let ef = s * 0.036
    ctx.font = `900 ${ef}px Orbitron, ${SANS}`; (ctx as any).letterSpacing = `${(s * 0.003).toFixed(1)}px`
    while (ctx.measureText(text).width > rb * maxRatio && ef > s * 0.012) { ef -= s * 0.001; ctx.font = `900 ${ef}px Orbitron, ${SANS}` }
    cutText(text, 0)
    ;(ctx as any).letterSpacing = '0px'; ctx.restore()
  }
  onEdge(-120, -Math.PI / 6, (state.tokenName || '').toUpperCase(), 0.86)
  onEdge(-60, Math.PI / 6, state.hexPerDay ? `HEX ${Math.round(state.hexPerDay).toLocaleString()}` : '', 0.8)
  // Lower edges (owner 2026-10-19): the unique ID bottom-left, the series number bottom-right (read upright)
  const uid = state.tokenNo ? `ID ${String(state.tokenNo).replace(/^#/, '')}` : state.cellId ? `ID ${state.cellId}` : ''
  onEdge(120, Math.PI / 6, uid, 0.8)
  onEdge(60, -Math.PI / 6, `#${state.series && state.series > 1 ? state.series : 1}`, 0.8)
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
  whenEngravingsReady([...(props.pictos || []), props.iconSvg]).then(() => { if (!aborted) paint() })
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
