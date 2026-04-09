/**
 * hexodToken3D.ts
 *
 * Direct port of read_only_templates/token_3Dviewer_admin_overlay.html
 * wrapped as a reusable function. Takes token data as parameters,
 * returns { update, dispose } handle for mounting into any HTMLElement.
 *
 * The drawFront/drawBack/helpers are ported line-for-line from Richard's
 * original template — no interpretation, same values, same order.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ═══════════════════════════════════════════════════════════════
// CONFIG — from gold standard
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  textureSize: 2048,
  cardThickness: 0.14,
  anisotropy: 16,
  maxPixelRatio: 2.0,
  rotationSpeed: 0.002,
  zoomDamping: 0.08,
  zoomSpeed: 0.6,
}

// ═══════════════════════════════════════════════════════════════
// TIERS — from gold standard
// ═══════════════════════════════════════════════════════════════
export const TIERS = {
  BRONZE:  { id: 'BRONZE',  metal: '#CD7F32', carbon: '#1C1610', title: '#EBC49F', engrave_metal: '#5C3317' },
  SILVER:  { id: 'SILVER',  metal: '#C0C0C0', carbon: '#16181A', title: '#FFFFFF', engrave_metal: '#4A4A4A' },
  GOLD:    { id: 'GOLD',    metal: '#D4AF37', carbon: '#1A1608', title: '#FFECB3', engrave_metal: '#634E14' },
  EMERALD: { id: 'EMERALD', metal: '#2ECC71', carbon: '#051209', title: '#A9DFBF', engrave_metal: '#145A32' },
} as const

export type TierKey = keyof typeof TIERS

export interface TokenViewerProps {
  tier?: TierKey
  category?: string       // e.g. 'ANCIENT FOREST'
  catId?: string          // e.g. 'FOR' — used in serial number
  catColor?: string       // e.g. '#39FF14'
  biome?: string          // e.g. 'EUROPA'
  tokenName?: string      // e.g. 'CRIMSON PEAK'
  description?: string
  edition?: string        // e.g. 'GENESIS'
  serial?: number
  maxSupply?: number
  owner?: string
  date?: string
  iconSvg?: string        // raw SVG string for icon
  imageSrc?: string       // image URL
}

interface ViewerHandle {
  update: (p: Partial<TokenViewerProps>) => void
  dispose: () => void
}

// ═══════════════════════════════════════════════════════════════
// HELPERS — from gold standard
// ═══════════════════════════════════════════════════════════════
function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle = 0) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI / 3) - Math.PI / 2 + angle
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
  }
  ctx.closePath()
}

function wrapTextCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
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
  // circles
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
  // paths
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
  // rects
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

function drawSVGIcon(
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
  // Background hex
  ctx.fillStyle = 'rgba(2, 2, 2, 0.95)'
  drawHex(ctx, 0, 0, size / 2)
  ctx.fill()
  // Outer ring
  ctx.strokeStyle = tierMetal
  ctx.lineWidth = lineW
  ctx.stroke()
  // Inner accent
  ctx.beginPath()
  drawHex(ctx, 0, 0, (size / 2) - size * 0.08)
  ctx.strokeStyle = iconColor
  ctx.globalAlpha = 0.5
  ctx.lineWidth = lineW * 0.6
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.restore()

  // SVG content
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

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════
export function createTokenViewer(container: HTMLElement, initial: TokenViewerProps = {}): ViewerHandle {
  // State holders for parameters (mutable via update)
  const state = {
    tier: TIERS[initial.tier || 'BRONZE'],
    category: initial.category || 'TERRITORY',
    catId: initial.catId || 'XXX',
    catColor: initial.catColor || '#39FF14',
    biome: initial.biome || 'RURAL',
    tokenName: initial.tokenName || 'HEXOD TERRITORY',
    description: initial.description || '',
    edition: initial.edition || 'GENESIS',
    serial: initial.serial || 1,
    maxSupply: initial.maxSupply || 1000,
    owner: initial.owner || 'VAULT_HOLDER',
    date: initial.date || new Date().toISOString().slice(0, 10),
    iconSvg: initial.iconSvg || '',
    imageSrc: initial.imageSrc || '',
  }

  // ─── THREE.js setup ──────────────────────────────────────
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(0, 0, 9)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.6
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)
  renderer.domElement.style.cursor = 'grab'

  // Lights — from gold standard
  scene.add(new THREE.AmbientLight(0xffffff, 2.2))
  const keyLight = new THREE.PointLight(0xffffff, 3.5, 25)
  keyLight.position.set(3, 3, 6); scene.add(keyLight)
  const rim = new THREE.PointLight(0xffffff, 2.5, 18)
  rim.position.set(-5, -5, 4); scene.add(rim)
  const fillLight = new THREE.PointLight(0x8888ff, 1.5, 15)
  fillLight.position.set(-4, 2, 3); scene.add(fillLight)
  const topLight = new THREE.PointLight(0xffffff, 1.5, 12)
  topLight.position.set(0, 6, 4); scene.add(topLight)

  // Image
  const cardImg = new Image()
  cardImg.crossOrigin = 'anonymous'
  if (state.imageSrc) cardImg.src = state.imageSrc

  // Canvases
  const s = CONFIG.textureSize
  const c = s / 2
  const frontCanvas = document.createElement('canvas')
  frontCanvas.width = s; frontCanvas.height = s
  const backCanvas = document.createElement('canvas')
  backCanvas.width = s; backCanvas.height = s
  const fCtx = frontCanvas.getContext('2d')!
  const bCtx = backCanvas.getContext('2d')!

  // Textures
  const fTex = new THREE.CanvasTexture(frontCanvas)
  fTex.rotation = Math.PI / 2; fTex.center.set(0.5, 0.5); fTex.anisotropy = CONFIG.anisotropy
  const bTex = new THREE.CanvasTexture(backCanvas)
  bTex.rotation = -Math.PI / 2; bTex.center.set(0.5, 0.5); bTex.repeat.set(-1, -1); bTex.anisotropy = CONFIG.anisotropy

  // Materials — from gold standard
  const fMat = new THREE.MeshPhysicalMaterial({
    map: fTex, roughness: 0.02, metalness: 0.88,
    clearcoat: 1.0, clearcoatRoughness: 0.01, reflectivity: 1.0, envMapIntensity: 10,
  })
  const bMat = new THREE.MeshPhysicalMaterial({
    map: bTex, clearcoat: 1, roughness: 0.01, metalness: 0.9,
    emissive: new THREE.Color(state.tier.metal), emissiveIntensity: 0.08,
    clearcoatRoughness: 0.01, reflectivity: 1.0,
  })
  const sMat = new THREE.MeshPhysicalMaterial({
    metalness: 1.0, roughness: 0.0,
    emissive: new THREE.Color(state.tier.metal), emissiveIntensity: 0.25,
    clearcoat: 1.0, clearcoatRoughness: 0.0, reflectivity: 1.0,
  })

  const geo = new THREE.CylinderGeometry(1.5, 1.5, CONFIG.cardThickness, 6)
  geo.rotateX(Math.PI / 2)
  const card = new THREE.Group()
  const cardMesh = new THREE.Mesh(geo, [sMat, fMat, bMat])
  card.add(cardMesh)
  scene.add(card)

  let entryProgress = 0
  card.rotation.y = -Math.PI
  card.scale.set(0, 0, 0)

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = CONFIG.zoomDamping
  controls.zoomSpeed = CONFIG.zoomSpeed
  controls.minDistance = 4
  controls.maxDistance = 15
  controls.enablePan = false
  controls.rotateSpeed = 0.5

  // Animation state
  let shineOffset = -2000
  let holoAngle = 0
  let frameCount = 0

  // ═══════════════════════════════════════════════════════════
  // drawFront — port of gold standard
  // ═══════════════════════════════════════════════════════════
  function drawFront() {
    const tier = state.tier

    // Deep black background
    fCtx.fillStyle = '#020202'
    fCtx.fillRect(0, 0, s, s)

    const boxW = s * 0.71, boxX = (s - boxW) / 2

    // Holographic rainbow overlay
    fCtx.save()
    const holoRadius = s * 0.4
    const holoGradient = fCtx.createLinearGradient(
      c + Math.cos(holoAngle) * holoRadius,
      c + Math.sin(holoAngle) * holoRadius,
      c - Math.cos(holoAngle) * holoRadius,
      c - Math.sin(holoAngle) * holoRadius,
    )
    holoGradient.addColorStop(0, 'rgba(255,0,128,0.15)')
    holoGradient.addColorStop(0.2, 'rgba(255,128,0,0.12)')
    holoGradient.addColorStop(0.4, 'rgba(255,255,0,0.15)')
    holoGradient.addColorStop(0.6, 'rgba(0,255,128,0.12)')
    holoGradient.addColorStop(0.8, 'rgba(0,128,255,0.15)')
    holoGradient.addColorStop(1, 'rgba(128,0,255,0.12)')
    fCtx.fillStyle = holoGradient
    drawHex(fCtx, c, c, s * 0.49)
    fCtx.fill()
    fCtx.restore()

    // Metallic shimmer gradient
    const shineWidth = s * 0.5
    const g = fCtx.createLinearGradient(shineOffset * 2, 0, shineOffset * 2 + shineWidth, 0)
    g.addColorStop(0, tier.metal)
    g.addColorStop(0.4, '#ffffff')
    g.addColorStop(0.5, '#ffffff')
    g.addColorStop(0.6, '#ffffff')
    g.addColorStop(1, tier.metal)

    // Rarity badge (top-right)
    const badgeX = boxX + boxW - s * 0.06
    const badgeY = s * 0.14
    const badgeSize = s * 0.042
    fCtx.save()
    fCtx.shadowBlur = 50
    fCtx.shadowColor = tier.metal
    fCtx.fillStyle = tier.carbon
    drawHex(fCtx, badgeX, badgeY, badgeSize)
    fCtx.fill()
    fCtx.strokeStyle = tier.metal
    fCtx.lineWidth = 5
    fCtx.stroke()
    fCtx.fillStyle = tier.metal
    fCtx.font = `900 ${s * 0.03}px Orbitron`
    fCtx.textAlign = 'center'
    fCtx.fillText(tier.id[0], badgeX, badgeY + s * 0.01)
    fCtx.restore()

    // Category
    fCtx.textAlign = 'center'
    fCtx.fillStyle = g
    fCtx.font = `bold ${s * 0.032}px Orbitron`
    fCtx.fillText(state.category, c, s * 0.166)

    // Icon row (single icon)
    const iconRowY = s * 0.205
    const iconSize = s * 0.032
    drawSVGIcon(fCtx, c, iconRowY, iconSize, state.iconSvg, state.catColor, tier.metal)

    // Biome
    fCtx.textAlign = 'center'
    fCtx.fillStyle = g
    fCtx.font = `bold ${s * 0.032}px Orbitron`
    fCtx.fillText(state.biome, c, s * 0.264)

    // Image
    const imageY = s * 0.293
    const imageH = s * 0.342
    fCtx.save()
    fCtx.shadowBlur = s * 0.05
    fCtx.shadowColor = state.catColor
    if (cardImg.complete && cardImg.naturalWidth > 0) {
      fCtx.drawImage(cardImg, boxX, imageY, boxW, imageH)
    }
    fCtx.restore()

    // Title bar behind title
    const titleY = imageY + imageH - s * 0.034
    const titleBarH = s * 0.05
    const fadeW = s * 0.025
    fCtx.save()
    fCtx.fillStyle = 'rgba(0,0,0,0.88)'
    fCtx.fillRect(boxX, titleY - titleBarH * 0.55, boxW, titleBarH)
    const titleFadeL = fCtx.createLinearGradient(boxX - fadeW, 0, boxX, 0)
    titleFadeL.addColorStop(0, 'rgba(0,0,0,0)')
    titleFadeL.addColorStop(1, 'rgba(0,0,0,0.88)')
    fCtx.fillStyle = titleFadeL
    fCtx.fillRect(boxX - fadeW, titleY - titleBarH * 0.55, fadeW, titleBarH)
    const titleFadeR = fCtx.createLinearGradient(boxX + boxW, 0, boxX + boxW + fadeW, 0)
    titleFadeR.addColorStop(0, 'rgba(0,0,0,0.88)')
    titleFadeR.addColorStop(1, 'rgba(0,0,0,0)')
    fCtx.fillStyle = titleFadeR
    fCtx.fillRect(boxX + boxW, titleY - titleBarH * 0.55, fadeW, titleBarH)
    fCtx.restore()

    // Title text
    fCtx.save()
    fCtx.textAlign = 'center'
    fCtx.font = `900 ${s * 0.047}px Orbitron`
    fCtx.strokeStyle = 'rgba(0,0,0,0.9)'
    fCtx.lineWidth = s * 0.003
    fCtx.strokeText(state.tokenName, c, titleY + s * 0.008)
    fCtx.fillStyle = g
    fCtx.shadowBlur = 40
    fCtx.shadowColor = state.catColor
    fCtx.fillText(state.tokenName, c, titleY + s * 0.008)
    fCtx.restore()

    // Side vertical text
    fCtx.font = `900 ${s * 0.026}px Orbitron`
    fCtx.save()
    fCtx.translate(boxX - s * 0.035, imageY + imageH / 2)
    fCtx.rotate(-Math.PI / 2)
    fCtx.fillStyle = g
    fCtx.shadowBlur = 25
    fCtx.shadowColor = tier.metal
    fCtx.fillText(tier.id, 0, 0)
    fCtx.restore()
    fCtx.save()
    fCtx.translate(boxX + boxW + s * 0.035, imageY + imageH / 2)
    fCtx.rotate(Math.PI / 2)
    fCtx.fillStyle = g
    fCtx.shadowBlur = 25
    fCtx.shadowColor = tier.metal
    fCtx.fillText(`${state.serial}/${state.maxSupply}`, 0, 0)
    fCtx.restore()

    // Description box
    const descY = imageY + imageH + s * 0.02
    const descH = s * 0.352
    fCtx.save()
    fCtx.shadowBlur = 40
    fCtx.shadowColor = state.catColor
    fCtx.fillStyle = 'rgba(5,5,5,0.98)'
    fCtx.fillRect(boxX, descY, boxW, descH)
    fCtx.restore()
    fCtx.strokeStyle = g
    fCtx.lineWidth = 4
    fCtx.strokeRect(boxX + s * 0.01, descY + s * 0.01, boxW - s * 0.02, descH - s * 0.02)
    fCtx.strokeStyle = state.catColor
    fCtx.globalAlpha = 0.35
    fCtx.lineWidth = 2
    fCtx.strokeRect(boxX + s * 0.012, descY + s * 0.012, boxW - s * 0.024, descH - s * 0.024)
    fCtx.globalAlpha = 1

    fCtx.textAlign = 'center'
    fCtx.fillStyle = '#e0e0e0'
    fCtx.font = `italic 42px Georgia`
    const text = state.description || `This token certifies sovereign ownership of the identified HEXOD territory. Geospatial data encrypted via Vault Alpha protocol. Rarity guaranteed by Tier ${tier.id}.`
    wrapTextCentered(fCtx, text, c, descY + s * 0.08, boxW - s * 0.1, s * 0.03)

    // Vignette
    fCtx.save()
    const vignette = fCtx.createRadialGradient(c, c, s * 0.25, c, c, s * 0.55)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
    fCtx.fillStyle = vignette
    fCtx.fillRect(0, 0, s, s)
    fCtx.restore()

    // Film grain
    fCtx.save()
    fCtx.globalAlpha = 0.02
    for (let i = 0; i < 3000; i++) {
      fCtx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
      fCtx.fillRect(Math.random() * s, Math.random() * s, 2, 2)
    }
    fCtx.globalAlpha = 1
    fCtx.restore()

    // Outer hex border
    fCtx.strokeStyle = tier.metal
    fCtx.lineWidth = s * 0.022
    drawHex(fCtx, c, c, s * 0.492)
    fCtx.stroke()

    fTex.needsUpdate = true
  }

  // ═══════════════════════════════════════════════════════════
  // drawBack — port of gold standard
  // ═══════════════════════════════════════════════════════════
  function drawBack() {
    const tier = state.tier
    const metalColor = tier.metal
    const carbonColor = tier.carbon
    const catColor = state.catColor
    const coreRadius = s * 0.22

    // Full carbon base
    bCtx.fillStyle = carbonColor
    bCtx.fillRect(0, 0, s, s)

    // Carbon fiber weave pattern
    bCtx.save()
    bCtx.beginPath()
    drawHex(bCtx, c, c, s * 0.47)
    bCtx.clip()
    bCtx.strokeStyle = 'rgba(255,255,255,0.04)'
    bCtx.lineWidth = 1
    const weaveStep = s * 0.008
    for (let i = -s; i < s * 2; i += weaveStep) {
      bCtx.beginPath(); bCtx.moveTo(i, 0); bCtx.lineTo(i + s * 0.5, s); bCtx.stroke()
    }
    for (let i = -s; i < s * 2; i += weaveStep) {
      bCtx.beginPath(); bCtx.moveTo(i, 0); bCtx.lineTo(i - s * 0.5, s); bCtx.stroke()
    }
    bCtx.restore()

    // Outer border (tier metal)
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = s * 0.035
    bCtx.shadowColor = metalColor
    bCtx.shadowBlur = 40
    drawHex(bCtx, c, c, s * 0.49)
    bCtx.stroke()
    bCtx.shadowBlur = 0

    // Inner border line
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = 2
    bCtx.globalAlpha = 0.5
    drawHex(bCtx, c, c, s * 0.455)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // "NON FUNGIBLE TERRITORY" top
    bCtx.textAlign = 'center'
    bCtx.font = `bold ${s * 0.022}px Orbitron`
    bCtx.fillStyle = metalColor
    bCtx.shadowBlur = 25
    bCtx.shadowColor = metalColor
    bCtx.fillText('NON FUNGIBLE TERRITORY', c, c - coreRadius - s * 0.055)
    bCtx.shadowBlur = 0

    // Decorative line under text
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = 1
    bCtx.globalAlpha = 0.4
    bCtx.beginPath()
    bCtx.moveTo(c - s * 0.15, c - coreRadius - s * 0.035)
    bCtx.lineTo(c + s * 0.15, c - coreRadius - s * 0.035)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // Central core
    const coreGrad = bCtx.createRadialGradient(c - coreRadius * 0.3, c - coreRadius * 0.3, 0, c, c, coreRadius)
    coreGrad.addColorStop(0.3, metalColor)
    coreGrad.addColorStop(1, tier.engrave_metal)
    bCtx.fillStyle = coreGrad
    bCtx.shadowBlur = 50
    bCtx.shadowColor = metalColor
    drawHex(bCtx, c, c, coreRadius)
    bCtx.fill()
    bCtx.shadowBlur = 0

    // Core border highlight
    bCtx.strokeStyle = catColor
    bCtx.lineWidth = 42
    bCtx.globalAlpha = 0.6
    drawHex(bCtx, c, c, coreRadius)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // Inner bevel
    bCtx.strokeStyle = tier.engrave_metal
    bCtx.lineWidth = 2
    drawHex(bCtx, c, c, coreRadius - s * 0.012)
    bCtx.stroke()

    // Engraved metadata
    const fontSize = s * 0.018
    const lineH = fontSize * 1.7
    const lines = [
      `#HEX-${state.catId}-${String(state.serial).padStart(4, '0')}`,
      state.edition,
      `TIER ${tier.id}`,
      state.date,
      state.owner,
    ]
    const totalH = lines.length * lineH
    const startY = c - totalH / 2 + lineH * 0.4
    bCtx.font = `700 ${fontSize}px "Roboto Mono", "Courier New", monospace`
    bCtx.textAlign = 'center'
    bCtx.textBaseline = 'middle'

    lines.forEach((line, i) => {
      const x = c
      const y = startY + i * lineH
      const baseAlpha = (i === 0 || i === 2) ? 1.0 : 0.7

      bCtx.save()
      // Bright rim
      bCtx.globalAlpha = baseAlpha * 0.3
      bCtx.fillStyle = '#ffffff'
      bCtx.fillText(line, x, y + 2)
      // Multi-layer internal walls
      bCtx.fillStyle = '#000000'
      bCtx.globalAlpha = baseAlpha * 0.4
      bCtx.fillText(line, x, y - 1.5)
      bCtx.fillText(line, x - 1, y - 1)
      bCtx.fillText(line, x + 1, y - 1)
      // Floor of cut
      bCtx.globalAlpha = baseAlpha
      bCtx.shadowColor = 'rgba(0,0,0,0.8)'
      bCtx.shadowBlur = 3
      bCtx.fillStyle = tier.engrave_metal
      bCtx.fillText(line, x, y)
      // Inner glow
      bCtx.globalAlpha = 0.1
      bCtx.strokeStyle = '#000000'
      bCtx.lineWidth = 0.5
      bCtx.strokeText(line, x, y)
      bCtx.restore()
    })

    // Hash signature
    const hash = '0x' + Math.random().toString(16).slice(2, 10).toUpperCase()
    bCtx.font = `500 ${fontSize * 0.6}px Orbitron`
    bCtx.globalAlpha = 0.5
    bCtx.fillText(hash, c, startY + lines.length * lineH + s * 0.008)
    bCtx.globalAlpha = 1

    // "HEXOD" bottom
    bCtx.font = `900 ${s * 0.055}px Orbitron`
    bCtx.fillStyle = metalColor
    bCtx.shadowBlur = 45
    bCtx.shadowColor = metalColor
    bCtx.fillText('HEXOD', c, c + coreRadius + s * 0.075)
    bCtx.shadowBlur = 0

    // Decorative line above HEXOD
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = 1
    bCtx.globalAlpha = 0.4
    bCtx.beginPath()
    bCtx.moveTo(c - s * 0.12, c + coreRadius + s * 0.035)
    bCtx.lineTo(c + s * 0.12, c + coreRadius + s * 0.035)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // Corner hex accents
    bCtx.fillStyle = metalColor
    bCtx.globalAlpha = 0.7
    drawHex(bCtx, s * 0.15, s * 0.12, s * 0.018); bCtx.fill()
    drawHex(bCtx, s * 0.85, s * 0.12, s * 0.018); bCtx.fill()
    drawHex(bCtx, s * 0.15, s * 0.88, s * 0.018); bCtx.fill()
    drawHex(bCtx, s * 0.85, s * 0.88, s * 0.018); bCtx.fill()
    bCtx.globalAlpha = 1

    bTex.needsUpdate = true
  }

  // Initial draws
  drawFront()
  drawBack()
  if (!cardImg.complete && state.imageSrc) {
    cardImg.onload = () => drawFront()
  }

  // ═══════════════════════════════════════════════════════════
  // Animation loop — from gold standard
  // ═══════════════════════════════════════════════════════════
  let animId = 0
  function animate() {
    animId = requestAnimationFrame(animate)

    if (entryProgress < 1) {
      entryProgress += 0.008
      const ease = 1 - Math.pow(1 - entryProgress, 3)
      card.scale.set(ease, ease, ease)
      card.rotation.y = -Math.PI + ease * Math.PI
    } else {
      card.rotation.y += CONFIG.rotationSpeed
    }

    // Shimmer update every 4th frame
    frameCount++
    if (frameCount % 4 === 0) {
      shineOffset += 25
      if (shineOffset > 3500) shineOffset = -1500
      holoAngle += 0.03
      drawFront()
    }

    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // Resize
  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // ─── Public API ──────────────────────────────────────────
  return {
    update(p: Partial<TokenViewerProps>) {
      if (p.tier !== undefined) {
        state.tier = TIERS[p.tier]
        bMat.emissive = new THREE.Color(state.tier.metal)
        sMat.emissive = new THREE.Color(state.tier.metal)
      }
      if (p.category !== undefined) state.category = p.category
      if (p.catId !== undefined) state.catId = p.catId
      if (p.catColor !== undefined) state.catColor = p.catColor
      if (p.biome !== undefined) state.biome = p.biome
      if (p.tokenName !== undefined) state.tokenName = p.tokenName
      if (p.description !== undefined) state.description = p.description
      if (p.edition !== undefined) state.edition = p.edition
      if (p.serial !== undefined) state.serial = p.serial
      if (p.maxSupply !== undefined) state.maxSupply = p.maxSupply
      if (p.owner !== undefined) state.owner = p.owner
      if (p.date !== undefined) state.date = p.date
      if (p.iconSvg !== undefined) state.iconSvg = p.iconSvg
      if (p.imageSrc !== undefined && p.imageSrc !== cardImg.src) {
        state.imageSrc = p.imageSrc
        cardImg.src = p.imageSrc
      }
      drawFront()
      drawBack()
    },
    dispose() {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      geo.dispose()
      fMat.dispose()
      bMat.dispose()
      sMat.dispose()
      fTex.dispose()
      bTex.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    },
  }
}
