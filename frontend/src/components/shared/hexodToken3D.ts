/**
 * hexodToken3D.ts
 *
 * 3D holographic token viewer — direct port of
 * read_only_templates/token_3Dviewer_admin_overlay.html.
 *
 * Uses the shared drawTokenFront + helpers from hexodTokenFace.ts so
 * the 2D preview and 3D viewer share the exact same front-face rendering
 * code (single source of truth).
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  TIERS, type TierKey, drawHex, drawTokenFront,
} from './hexodTokenFace'

export { TIERS, type TierKey }

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

export interface TokenViewerProps {
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
  iconSvg?: string
  imageSrc?: string
}

interface ViewerHandle {
  update: (p: Partial<TokenViewerProps>) => void
  dispose: () => void
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
  // ═══════════════════════════════════════════════════════════
  // drawFront — delegates to shared drawTokenFront from hexodTokenFace
  // ═══════════════════════════════════════════════════════════
  function drawFront() {
    drawTokenFront(fCtx, s, {
      tier: (Object.keys(TIERS) as Array<keyof typeof TIERS>).find(k => TIERS[k] === state.tier) || 'BRONZE',
      category: state.category,
      catId: state.catId,
      catColor: state.catColor,
      biome: state.biome,
      tokenName: state.tokenName,
      description: state.description,
      edition: state.edition,
      serial: state.serial,
      maxSupply: state.maxSupply,
      owner: state.owner,
      date: state.date,
      iconSvg: state.iconSvg,
    }, {
      shineOffset,
      holoAngle,
      cardImg,
    }, { enableFilmGrain: true })
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
