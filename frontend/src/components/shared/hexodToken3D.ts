/**
 * hexodToken3D — Direct port of read_only_templates/token_3Dviewer_admin_overlay.html
 *
 * Creates a premium holographic 3D NFT token viewer inside any container.
 * Call createTokenViewer(container, props) → returns { update, dispose }.
 *
 * Usage:
 *   const viewer = createTokenViewer(divElement, {
 *     tier: 'BRONZE', category: 'RURAL', catColor: '#39FF14',
 *     biome: 'RURAL', tokenName: 'ZONE', serial: 42, maxSupply: 1000,
 *     iconSvg: '<svg>...</svg>', imageSrc: 'https://...'
 *   })
 *   viewer.update({ tokenName: 'NEW NAME' })  // update anything
 *   viewer.dispose()                           // cleanup
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ══════════════════════════════════════════════════════════════
// CONFIG — identical to gold standard
// ══════════════════════════════════════════════════════════════
const CONFIG = {
  textureSize: 2048,
  cardThickness: 0.14,
  anisotropy: 16,
  maxPixelRatio: 2.0,
  rotationSpeed: 0.002,
  zoomDamping: 0.08,
  zoomSpeed: 0.6,
}

// ══════════════════════════════════════════════════════════════
// TIERS — identical to gold standard
// ══════════════════════════════════════════════════════════════
export const TIERS = {
  BRONZE:  { id: 'BRONZE',  metal: '#CD7F32', carbon: '#1C1610', title: '#EBC49F', engrave_metal: '#5C3317' },
  SILVER:  { id: 'SILVER',  metal: '#C0C0C0', carbon: '#16181A', title: '#FFFFFF', engrave_metal: '#4A4A4A' },
  GOLD:    { id: 'GOLD',    metal: '#D4AF37', carbon: '#1A1608', title: '#FFECB3', engrave_metal: '#634E14' },
  EMERALD: { id: 'EMERALD', metal: '#2ECC71', carbon: '#051209', title: '#A9DFBF', engrave_metal: '#145A32' },
} as const

export type TierKey = keyof typeof TIERS

// ══════════════════════════════════════════════════════════════
// Props — what the caller passes in
// ══════════════════════════════════════════════════════════════
export interface TokenViewerProps {
  tier?: TierKey           // BRONZE | SILVER | GOLD | EMERALD
  category?: string        // e.g. "RURAL", "ANCIENT FOREST"
  catColor?: string        // category color for holographic accents
  biome?: string           // e.g. "RURAL"
  tokenName?: string       // e.g. "CRIMSON PEAK"
  description?: string     // description text (wraps inside box)
  edition?: string         // e.g. "GENESIS"
  serial?: number          // e.g. 42
  maxSupply?: number       // e.g. 1000
  owner?: string           // e.g. "VAULT_HOLDER"
  date?: string            // e.g. "2026-03-27"
  iconSvg?: string         // raw SVG string for category icon
  imageSrc?: string        // URL of territory photo
}

interface ViewerHandle {
  update: (props: Partial<TokenViewerProps>) => void
  dispose: () => void
}

// ══════════════════════════════════════════════════════════════
// HELPERS — identical to gold standard
// ══════════════════════════════════════════════════════════════
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
  // Draw circles
  const circleRegex = /<circle([^>]*)\/?>/g
  let m: RegExpExecArray | null
  while ((m = circleRegex.exec(svgString)) !== null) {
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
  // Draw paths
  const pathRegex = /<path([^>]*)\/?>/g
  while ((m = pathRegex.exec(svgString)) !== null) {
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
  // Draw rects
  const rectRegex = /<rect([^>]*)\/?>/g
  while ((m = rectRegex.exec(svgString)) !== null) {
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

function drawSVGIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, svgString: string, iconColor: string, tierMetal: string) {
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

  // Draw SVG content
  ctx.save()
  ctx.translate(x, y)
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
  let viewBoxSize = 24
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat)
    if (parts.length === 4) viewBoxSize = parts[2]
  }
  const scale = (size - size * 0.35) / viewBoxSize
  ctx.scale(scale, scale)
  ctx.translate(-viewBoxSize / 2, -viewBoxSize / 2)
  ctx.fillStyle = iconColor
  ctx.strokeStyle = iconColor
  drawSVGContent(ctx, svgString, iconColor)
  ctx.restore()
}

// ══════════════════════════════════════════════════════════════
// MAIN — createTokenViewer
// ══════════════════════════════════════════════════════════════
export function createTokenViewer(container: HTMLElement, initialProps: TokenViewerProps = {}): ViewerHandle {
  // State that can be updated via .update()
  const props: Required<TokenViewerProps> = {
    tier: initialProps.tier || 'BRONZE',
    category: initialProps.category || 'TERRITORY',
    catColor: initialProps.catColor || '#39FF14',
    biome: initialProps.biome || 'RURAL',
    tokenName: initialProps.tokenName || 'HEXOD TERRITORY',
    description: initialProps.description || '',
    edition: initialProps.edition || 'GENESIS',
    serial: initialProps.serial || 1,
    maxSupply: initialProps.maxSupply || 1000,
    owner: initialProps.owner || 'VAULT_HOLDER',
    date: initialProps.date || new Date().toISOString().slice(0, 10),
    iconSvg: initialProps.iconSvg || '',
    imageSrc: initialProps.imageSrc || '',
  }

  // ─── THREE.js setup ───────────────────────────────────────
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

  // Lights — identical to gold standard
  scene.add(new THREE.AmbientLight(0xffffff, 2.2))
  const keyLight = new THREE.PointLight(0xffffff, 3.5, 25); keyLight.position.set(3, 3, 6); scene.add(keyLight)
  const rim = new THREE.PointLight(0xffffff, 2.5, 18); rim.position.set(-5, -5, 4); scene.add(rim)
  const fillLight = new THREE.PointLight(0x8888ff, 1.5, 15); fillLight.position.set(-4, 2, 3); scene.add(fillLight)
  const topLight = new THREE.PointLight(0xffffff, 1.5, 12); topLight.position.set(0, 6, 4); scene.add(topLight)

  // Image
  const cardImg = new Image()
  cardImg.crossOrigin = 'anonymous'
  if (props.imageSrc) cardImg.src = props.imageSrc

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

  // Materials — identical to gold standard
  const getTier = () => TIERS[props.tier]
  const fMat = new THREE.MeshPhysicalMaterial({
    map: fTex, roughness: 0.02, metalness: 0.88, clearcoat: 1.0, clearcoatRoughness: 0.01, reflectivity: 1.0, envMapIntensity: 10,
  })
  const bMat = new THREE.MeshPhysicalMaterial({
    map: bTex, clearcoat: 1, roughness: 0.01, metalness: 0.9,
    emissive: new THREE.Color(getTier().metal), emissiveIntensity: 0.08,
    clearcoatRoughness: 0.01, reflectivity: 1.0,
  })
  const sMat = new THREE.MeshPhysicalMaterial({
    metalness: 1.0, roughness: 0.0,
    emissive: new THREE.Color(getTier().metal), emissiveIntensity: 0.25,
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

  // ─── DRAW FRONT — faithful port of gold standard ───────────
  function drawFront() {
    const tier = getTier()
    fCtx.fillStyle = '#020202'
    fCtx.fillRect(0, 0, s, s)

    const boxW = s * 0.71
    const boxX = (s - boxW) / 2

    // Holographic rainbow overlay
    fCtx.save()
    const holoRadius = s * 0.4
    const holoGradient = fCtx.createLinearGradient(
      c + Math.cos(holoAngle) * holoRadius, c + Math.sin(holoAngle) * holoRadius,
      c - Math.cos(holoAngle) * holoRadius, c - Math.sin(holoAngle) * holoRadius,
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

    // Rarity badge
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
    fCtx.fillText(props.category, c, s * 0.166)

    // Icon row (single icon)
    const iconRowY = s * 0.205
    const iconSize = s * 0.032
    drawSVGIcon(fCtx, c, iconRowY, iconSize, props.iconSvg, props.catColor, tier.metal)

    // Biome
    fCtx.textAlign = 'center'
    fCtx.fillStyle = g
    fCtx.font = `bold ${s * 0.032}px Orbitron`
    fCtx.fillText(props.biome, c, s * 0.264)

    // Image
    const imageY = s * 0.293
    const imageH = s * 0.342
    fCtx.save()
    fCtx.shadowBlur = s * 0.05
    fCtx.shadowColor = props.catColor
    if (cardImg.complete && cardImg.naturalWidth > 0) {
      fCtx.drawImage(cardImg, boxX, imageY, boxW, imageH)
    }
    fCtx.restore()

    // Title bar
    const titleY = imageY + imageH - s * 0.034
    const titleBarH = s * 0.05
    const fadeW = s * 0.025
    fCtx.save()
    fCtx.fillStyle = 'rgba(0,0,0,0.88)'
    fCtx.fillRect(boxX, titleY - titleBarH * 0.55, boxW, titleBarH)
    const tfL = fCtx.createLinearGradient(boxX - fadeW, 0, boxX, 0)
    tfL.addColorStop(0, 'rgba(0,0,0,0)')
    tfL.addColorStop(1, 'rgba(0,0,0,0.88)')
    fCtx.fillStyle = tfL
    fCtx.fillRect(boxX - fadeW, titleY - titleBarH * 0.55, fadeW, titleBarH)
    const tfR = fCtx.createLinearGradient(boxX + boxW, 0, boxX + boxW + fadeW, 0)
    tfR.addColorStop(0, 'rgba(0,0,0,0.88)')
    tfR.addColorStop(1, 'rgba(0,0,0,0)')
    fCtx.fillStyle = tfR
    fCtx.fillRect(boxX + boxW, titleY - titleBarH * 0.55, fadeW, titleBarH)
    fCtx.restore()

    // Title text
    fCtx.save()
    fCtx.textAlign = 'center'
    fCtx.font = `900 ${s * 0.047}px Orbitron`
    fCtx.strokeStyle = 'rgba(0,0,0,0.9)'
    fCtx.lineWidth = s * 0.003
    fCtx.strokeText(props.tokenName, c, titleY + s * 0.008)
    fCtx.fillStyle = g
    fCtx.shadowBlur = 40
    fCtx.shadowColor = props.catColor
    fCtx.fillText(props.tokenName, c, titleY + s * 0.008)
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
    fCtx.fillText(`${props.serial}/${props.maxSupply}`, 0, 0)
    fCtx.restore()

    // Description box
    const descY = imageY + imageH + s * 0.02
    const descH = s * 0.352
    fCtx.save()
    fCtx.shadowBlur = 40
    fCtx.shadowColor = props.catColor
    fCtx.fillStyle = 'rgba(5,5,5,0.98)'
    fCtx.fillRect(boxX, descY, boxW, descH)
    fCtx.restore()
    fCtx.strokeStyle = g
    fCtx.lineWidth = 4
    fCtx.strokeRect(boxX + s * 0.01, descY + s * 0.01, boxW - s * 0.02, descH - s * 0.02)
    fCtx.strokeStyle = props.catColor
    fCtx.globalAlpha = 0.35
    fCtx.lineWidth = 2
    fCtx.strokeRect(boxX + s * 0.012, descY + s * 0.012, boxW - s * 0.024, descH - s * 0.024)
    fCtx.globalAlpha = 1

    fCtx.textAlign = 'center'
    fCtx.fillStyle = '#e0e0e0'
    fCtx.font = `italic 42px Georgia`
    const text = props.description || `This token certifies sovereign ownership of the identified HEXOD territory. Geospatial data encrypted via Vault Alpha protocol. Rarity guaranteed by Tier ${tier.id}.`
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

  // ─── DRAW BACK — simplified (metal carbon + engraved metadata) ──
  function drawBack() {
    const tier = getTier()
    const metalColor = tier.metal
    const carbonColor = tier.carbon
    const coreRadius = s * 0.22

    bCtx.fillStyle = carbonColor
    bCtx.fillRect(0, 0, s, s)

    // Carbon fiber weave
    bCtx.save()
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

    // Outer border
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = s * 0.035
    bCtx.shadowColor = metalColor
    bCtx.shadowBlur = 40
    drawHex(bCtx, c, c, s * 0.49)
    bCtx.stroke()
    bCtx.shadowBlur = 0

    // Inner border
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = 2
    bCtx.globalAlpha = 0.5
    drawHex(bCtx, c, c, s * 0.455)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // "NON FUNGIBLE TERRITORY"
    bCtx.textAlign = 'center'
    bCtx.font = `bold ${s * 0.022}px Orbitron`
    bCtx.fillStyle = metalColor
    bCtx.shadowBlur = 25
    bCtx.shadowColor = metalColor
    bCtx.fillText('NON FUNGIBLE TERRITORY', c, c - coreRadius - s * 0.055)
    bCtx.shadowBlur = 0

    // Decorative line
    bCtx.strokeStyle = metalColor
    bCtx.lineWidth = 1
    bCtx.globalAlpha = 0.4
    bCtx.beginPath()
    bCtx.moveTo(c - s * 0.15, c - coreRadius - s * 0.035)
    bCtx.lineTo(c + s * 0.15, c - coreRadius - s * 0.035)
    bCtx.stroke()
    bCtx.globalAlpha = 1

    // Core metal
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
    bCtx.strokeStyle = props.catColor
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

    // Metadata engraved
    const fontSize = s * 0.018
    const lineH = fontSize * 1.7
    const lines = [
      `#HEX-${props.category.slice(0, 3).toUpperCase()}-${String(props.serial).padStart(4, '0')}`,
      props.edition,
      `TIER ${tier.id}`,
      props.date,
      props.owner,
    ]
    const totalH = lines.length * lineH
    const startY = c - totalH / 2 + lineH * 0.4
    bCtx.font = `700 ${fontSize}px "Roboto Mono", monospace`
    bCtx.textAlign = 'center'
    bCtx.textBaseline = 'middle'
    lines.forEach((line, i) => {
      const y = startY + i * lineH
      const baseAlpha = (i === 0 || i === 2) ? 1.0 : 0.7
      bCtx.save()
      // Shadow (engraved look)
      bCtx.fillStyle = 'rgba(0,0,0,0.7)'
      bCtx.fillText(line, c + 1, y + 1)
      // Main text
      bCtx.fillStyle = tier.engrave_metal
      bCtx.globalAlpha = baseAlpha
      bCtx.fillText(line, c, y)
      bCtx.restore()
    })

    bTex.needsUpdate = true
  }

  // Initial draw
  drawFront()
  drawBack()
  if (!cardImg.complete && props.imageSrc) {
    cardImg.onload = () => drawFront()
  }

  // ─── ANIMATION LOOP — identical to gold standard ──────────
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

    // Shimmer update every 4th frame — identical to gold standard
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

  // ─── Public API ─────────────────────────────────────────
  return {
    update(partial: Partial<TokenViewerProps>) {
      Object.assign(props, partial)
      if (partial.imageSrc !== undefined) {
        cardImg.src = partial.imageSrc
      }
      if (partial.tier !== undefined) {
        const t = getTier()
        bMat.emissive = new THREE.Color(t.metal)
        sMat.emissive = new THREE.Color(t.metal)
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
