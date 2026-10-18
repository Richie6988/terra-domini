/**
 * hexodToken3D.ts
 *
 * 3D collectible token viewer. Started as a port of
 * read_only_templates/token_3Dviewer_admin_overlay.html, re-lit (2026-10) after owner
 * feedback ("eclairage illisible, on ne voit pas l'objet precieux"):
 *   - studio environment reflections (PMREM of a small dark softbox studio) so metal actually reads as metal
 *   - key / rim / fill directional lights + slowly turning studio so light streaks glide over the metal
 *   - ACES tone mapping at exposure ~1 and sRGB face textures (no more washed-out face)
 *   - raised bevelled hex bezel in the tier metal (BRONZE/SILVER/GOLD/EMERALD/DIAMOND),
 *     gem inlays + iridescence + sparkles on rare tiers
 *   - halo behind the token and a light pool under it for a clear silhouette
 *   - reveal (spin + overshoot + shockwave), idle sway/bob, drag-to-rotate with inertia, wheel zoom
 *   - face texture drawn ONCE (re-drawn on font/image load), not every 4th frame
 *
 * Uses the shared drawTokenFront from hexodTokenFace.ts so 2D and 3D share the face rendering.
 */
import * as THREE from 'three'
import {
  TIERS, type TierKey, drawHex, drawTokenFront,
} from './hexodTokenFace'

export { TIERS, type TierKey }

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  textureSize: 2048,
  textureSizeMobile: 1536,
  cardThickness: 0.14,
  faceRadius: 1.5,
  bezelOuter: 1.6,
  bezelInner: 1.49,
  maxPixelRatio: 2.0,
  fov: 30,
}

/** Physically-based look per tier (rim metal, gloss, gems, sparkles). */
const TIER_LOOK: Record<TierKey, {
  rim: string; rimRough: number; rimMetal: number; rimIri: number; faceIri: number;
  halo: string; gems: string | null; sparkles: number; envI: number
}> = {
  BRONZE:  { rim: '#c47a3c', rimRough: 0.30, rimMetal: 1,    rimIri: 0,    faceIri: 0,    halo: '#ff9a4a', gems: null,      sparkles: 0,  envI: 1.2 },
  SILVER:  { rim: '#e3e8ee', rimRough: 0.2,  rimMetal: 0.92,  rimIri: 0,    faceIri: 0,    halo: '#b8d4ff', gems: null,      sparkles: 6,  envI: 1.3 },
  GOLD:    { rim: '#ffc85a', rimRough: 0.14, rimMetal: 1,    rimIri: 0,    faceIri: 0,    halo: '#ffcf4a', gems: null,      sparkles: 14, envI: 1.4 },
  EMERALD: { rim: '#ffd27a', rimRough: 0.12, rimMetal: 1,    rimIri: 0.35, faceIri: 0,    halo: '#3dff9a', gems: '#16c96b', sparkles: 22, envI: 1.5 },
  DIAMOND: { rim: '#eef8ff', rimRough: 0.14, rimMetal: 0.72, rimIri: 1.0,  faceIri: 0.3,  halo: '#9be8ff', gems: '#e8fbff', sparkles: 36, envI: 2.2 },
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
  /** Real territory data printed on the back (GET /api/codex/territory/<h3>/). */
  back?: TokenBack | null
  // Face data (rarity ribbon, stats row, footer)
  rarity?: string
  hexPerDay?: number
  region?: string
  country?: string
  terrain?: string
  tokenNo?: string
  cellId?: string
}

export interface TokenBack {
  h3Index: string
  lat: number
  lon: number
  rarity: string
  owner: string | null
  capturedAt: string | null
  hexPerDay: number
  region: string | null
  continent: string | null
  resources: { name: string; perDay: number }[]
  tokenId: number | null
  minted: boolean
  edition?: number
}

interface ViewerHandle {
  update: (p: Partial<TokenViewerProps>) => void
  dispose: () => void
}

/** Pointy-top hexagon (matches drawHex in hexodTokenFace). */
function hexPath(target: THREE.Shape | THREE.Path, r: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2
    const x = r * Math.cos(a), y = r * Math.sin(a)
    if (i === 0) target.moveTo(x, y); else target.lineTo(x, y)
  }
  target.closePath()
}

/** Soft radial gradient sprite texture (white core, transparent edge). */
function radialTexture(stops: Array<[number, string]>, size = 256): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const x = cv.getContext('2d')!
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([o, c]) => g.addColorStop(o, c))
  x.fillStyle = g
  x.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 4-point star glint texture for sparkles. */
function starTexture(size = 128): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const x = cv.getContext('2d')!
  const c = size / 2
  const core = x.createRadialGradient(c, c, 0, c, c, c * 0.35)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = core
  x.fillRect(0, 0, size, size)
  x.globalCompositeOperation = 'lighter'
  for (const [w, h] of [[size, size * 0.06], [size * 0.06, size]]) {
    const g = x.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(c - w / 2, c - h / 2, w, h)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Tiny product-photo studio used only to bake reflections: dark room + bright softboxes,
 * so polished metal shows crisp light streaks instead of flat grey.
 */
function buildStudio(): THREE.Scene {
  const sc = new THREE.Scene()
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x0e1117, side: THREE.BackSide }),
  )
  sc.add(room)
  const box = (w: number, h: number, color: THREE.Color, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    sc.add(m)
  }
  box(12, 4, new THREE.Color(6, 6, 6), 0, 8, 3)             // top softbox
  box(2.2, 10, new THREE.Color(5, 4.4, 3.6), 8, 0, 4)       // warm right strip
  box(2.2, 10, new THREE.Color(3.2, 4.2, 6), -8, 1, 3)      // cool left strip
  box(6, 2, new THREE.Color(1.4, 1.4, 1.5), 0, -5, 8)       // low front fill
  box(4, 4, new THREE.Color(1.3, 1.3, 1.4), 4, 3, 9)        // key reflector
  box(8, 4, new THREE.Color(1.2, 1.5, 2.2), 0, 2, -9)       // back rim
  return sc
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (t: number) => { const k = 1.6; return 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2) }

function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}
// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════
export function createTokenViewer(container: HTMLElement, initial: TokenViewerProps = {}): ViewerHandle {
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
    date: initial.date || '',   // emission date of the edition (codex/territory issued_at); never invented
    iconSvg: initial.iconSvg || '',
    imageSrc: initial.imageSrc || '',
    back: initial.back || null as TokenBack | null,
    rarity: initial.rarity || '', hexPerDay: initial.hexPerDay || 0, region: initial.region || '', country: initial.country || '',
    terrain: initial.terrain || '', tokenNo: initial.tokenNo || '', cellId: initial.cellId || '',
  }
  const tierKey = (): TierKey =>
    (Object.keys(TIERS) as TierKey[]).find(k => TIERS[k] === state.tier) || 'BRONZE'

  const reducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ─── Renderer / scene / camera ───────────────────────────
  const W = () => Math.max(1, container.clientWidth)
  const H = () => Math.max(1, container.clientHeight)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, W() / H(), 0.1, 100)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio))
  renderer.setSize(W(), H())
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)
  const canvasEl = renderer.domElement
  canvasEl.style.cursor = 'grab'
  canvasEl.style.touchAction = 'none'
  canvasEl.style.display = 'block'

  // Studio reflections — this is what makes the metal read as metal.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = buildStudio()
  const envTex = pmrem.fromScene(room, 0.02).texture
  scene.environment = envTex
  room.traverse(o => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => mm.dispose())
  })

  // Lights: warm key, cool + warm rims from behind, soft fill, low hemisphere ambient.
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1208, 0.35))
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4)
  key.position.set(3.5, 4, 6); scene.add(key)
  const rimL = new THREE.DirectionalLight(0x9cc8ff, 3.0)
  rimL.position.set(-5, 3, -4); scene.add(rimL)
  const rimR = new THREE.DirectionalLight(0xffd7a8, 2.0)
  rimR.position.set(5, -2, -3); scene.add(rimR)
  const fill = new THREE.DirectionalLight(0xffffff, 0.6)
  fill.position.set(-4, -1, 5); scene.add(fill)

  // ─── Face / back canvases ────────────────────────────────
  const cardImg = new Image()
  cardImg.crossOrigin = 'anonymous'

  const s = Math.min(window.innerWidth, window.innerHeight) < 700 ? CONFIG.textureSizeMobile : CONFIG.textureSize
  const c = s / 2
  const frontCanvas = document.createElement('canvas')
  frontCanvas.width = s; frontCanvas.height = s
  const backCanvas = document.createElement('canvas')
  backCanvas.width = s; backCanvas.height = s
  const fCtx = frontCanvas.getContext('2d')!
  const bCtx = backCanvas.getContext('2d')!

  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const fTex = new THREE.CanvasTexture(frontCanvas)
  fTex.rotation = Math.PI / 2; fTex.center.set(0.5, 0.5); fTex.anisotropy = maxAniso
  fTex.colorSpace = THREE.SRGBColorSpace
  const bTex = new THREE.CanvasTexture(backCanvas)
  bTex.rotation = -Math.PI / 2; bTex.center.set(0.5, 0.5); bTex.repeat.set(-1, -1); bTex.anisotropy = maxAniso
  bTex.colorSpace = THREE.SRGBColorSpace

  // ─── Materials ───────────────────────────────────────────
  // Glossy printed face: dielectric + clearcoat, with a little emissive so it is always legible.
  const fMat = new THREE.MeshPhysicalMaterial({
    map: fTex, emissiveMap: fTex, emissive: 0xffffff, emissiveIntensity: 0.42,
    roughness: 0.55, metalness: 0.0, specularIntensity: 0.3,
    clearcoat: 0.45, clearcoatRoughness: 0.14,
    envMapIntensity: 0.22,
  })
  const bMat = new THREE.MeshPhysicalMaterial({
    map: bTex, emissiveMap: bTex, emissive: 0xffffff, emissiveIntensity: 0.3,
    roughness: 0.3, metalness: 0.35,
    clearcoat: 1.0, clearcoatRoughness: 0.04,
    envMapIntensity: 0.9,
  })
  // Edge groove between the two bezel lips (darker engraved metal).
  const sMat = new THREE.MeshPhysicalMaterial({ metalness: 1.0, roughness: 0.35 })
  // Raised bezel in tier metal.
  const rimMat = new THREE.MeshPhysicalMaterial({
    metalness: 1.0, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.08,
    iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 620],
  })
  const gemMat = new THREE.MeshPhysicalMaterial({
    metalness: 0.0, roughness: 0.02, ior: 2.4, flatShading: true,
    clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 3.0,
    iridescence: 0.6, iridescenceIOR: 1.8, specularIntensity: 1,
  })

  // ─── Geometry ────────────────────────────────────────────
  const card = new THREE.Group()
  const pivot = new THREE.Group() // bob + entry scale live here; card gets rotation
  pivot.add(card)
  scene.add(pivot)

  const geo = new THREE.CylinderGeometry(CONFIG.faceRadius, CONFIG.faceRadius, CONFIG.cardThickness, 6)
  geo.rotateX(Math.PI / 2)
  card.add(new THREE.Mesh(geo, [sMat, fMat, bMat]))

  const lip = 0.05
  const bezelDepth = CONFIG.cardThickness + lip * 2
  const bezelShape = new THREE.Shape(); hexPath(bezelShape, CONFIG.bezelOuter)
  const bezelHole = new THREE.Path(); hexPath(bezelHole, CONFIG.bezelInner)
  bezelShape.holes.push(bezelHole)
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: bezelDepth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 5, curveSegments: 1,
  })
  bezelGeo.translate(0, 0, -bezelDepth / 2)
  bezelGeo.computeVertexNormals()
  card.add(new THREE.Mesh(bezelGeo, rimMat))

  // Gem inlays at the six bezel corners (EMERALD / DIAMOND)
  const gemGeo = new THREE.OctahedronGeometry(0.075, 0)
  gemGeo.scale(1, 1, 0.6)
  const gems = new THREE.Group()
  for (const side of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 2
      const r = (CONFIG.bezelOuter + CONFIG.bezelInner) / 2
      const m = new THREE.Mesh(gemGeo, gemMat)
      m.position.set(r * Math.cos(a), r * Math.sin(a), side * (bezelDepth / 2 + 0.03))
      m.rotation.z = a
      gems.add(m)
    }
  }
  card.add(gems)

  // Halo behind + light pool under the token (do not rotate with it)
  const haloTex = radialTexture([[0, 'rgba(255,255,255,0.9)'], [0.42, 'rgba(255,255,255,0.5)'], [0.7, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']])
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const halo = new THREE.Sprite(haloMat)
  halo.scale.set(7.2, 7.2, 1)
  halo.position.set(0, 0, -1.6)
  scene.add(halo)

  const poolMat = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), poolMat)
  pool.rotation.x = -Math.PI / 2
  pool.scale.set(1, 0.5, 1)
  pool.position.set(0, -2.15, 0)
  scene.add(pool)

  // Reveal shockwave ring
  const ringTex = radialTexture([[0, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,255,255,0)'], [0.86, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']])
  const ringMat = new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const ring = new THREE.Sprite(ringMat)
  ring.position.set(0, 0, -0.3)
  scene.add(ring)

  // Sparkles (count by tier)
  const starTex = starTexture()
  const sparkles: Array<{ sp: THREE.Sprite; phase: number; speed: number; size: number }> = []
  const sparkleGroup = new THREE.Group()
  scene.add(sparkleGroup)
  function buildSparkles(n: number) {
    sparkles.splice(0).forEach(o => { sparkleGroup.remove(o.sp); o.sp.material.dispose() })
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
      const sp = new THREE.Sprite(m)
      const a = Math.random() * Math.PI * 2
      const r = 1.55 + Math.random() * 0.75
      sp.position.set(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.3) * 1.2)
      sparkleGroup.add(sp)
      sparkles.push({ sp, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.4, size: 0.12 + Math.random() * 0.22 })
    }
  }

  function applyTierLook() {
    const L = TIER_LOOK[tierKey()]
    rimMat.color.set(L.rim)
    rimMat.roughness = L.rimRough
    rimMat.metalness = L.rimMetal
    rimMat.iridescence = L.rimIri
    rimMat.envMapIntensity = L.envI
    sMat.color.set(L.rim).multiplyScalar(0.55)
    fMat.iridescence = L.faceIri
    fMat.iridescenceIOR = 1.45
    fMat.iridescenceThicknessRange = [200, 700]
    gems.visible = !!L.gems
    if (L.gems) gemMat.color.set(L.gems)
    haloMat.color.set(L.halo)
    poolMat.color.set(L.halo)
    ringMat.color.set(L.halo)
    buildSparkles(reducedMotion ? 0 : L.sparkles)
    sparkles.forEach(o => o.sp.material.color.set(L.halo).lerp(new THREE.Color('#ffffff'), 0.6))
    rimMat.needsUpdate = true
    fMat.needsUpdate = true
  }

  // ═══════════════════════════════════════════════════════════
  // drawFront — shared drawTokenFront (static: drawn once, re-drawn on data/font/image change)
  // ═══════════════════════════════════════════════════════════
  function drawFront() {
    drawTokenFront(fCtx, s, {
      tier: tierKey(),
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
      rarity: state.rarity, hexPerDay: state.hexPerDay, region: state.region, country: state.country,
      terrain: state.terrain, tokenNo: state.tokenNo, cellId: state.cellId,
    }, {
      shineOffset: s * 0.15,
      holoAngle: Math.PI * 0.33,
      cardImg,
    }, { enableFilmGrain: true })
    fTex.needsUpdate = true
  }


  // ═══════════════════════════════════════════════════════════
  // drawBack — sober engraved jewel (owner 2026-10-18): brushed tier metal, text cut into the metal,
  // no colours. Real data only: place, coordinates, region, owner, production, H3 cell, mint status.
  // ═══════════════════════════════════════════════════════════
  function drawBack() {
    const tier = state.tier
    const metal = tier.metal
    const b = state.back
    const R = s * 0.47

    // Brushed metal plate
    const g = bCtx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, shade(metal, 1.25)); g.addColorStop(0.45, shade(metal, 0.82))
    g.addColorStop(0.55, shade(metal, 1.05)); g.addColorStop(1, shade(metal, 0.62))
    bCtx.fillStyle = g
    bCtx.fillRect(0, 0, s, s)
    bCtx.save()
    drawHex(bCtx, c, c, R); bCtx.clip()
    for (let y = 0; y < s; y += 2) {           // brushing: fine horizontal streaks, deterministic
      const k = Math.sin(y * 12.9898) * 43758.5453
      const a = (k - Math.floor(k)) * 0.07
      bCtx.fillStyle = (y % 4 === 0) ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
      bCtx.fillRect(0, y, s, 1)
    }
    bCtx.restore()

    // Bevelled rim: engraved double line
    const groove = (r: number, w: number) => {
      bCtx.lineWidth = w
      bCtx.strokeStyle = 'rgba(0,0,0,0.45)'; drawHex(bCtx, c, c - 1.5, r); bCtx.stroke()
      bCtx.strokeStyle = 'rgba(255,255,255,0.35)'; drawHex(bCtx, c, c + 1.5, r); bCtx.stroke()
    }
    groove(s * 0.455, 4); groove(s * 0.43, 2)

    // Engraved text: dark cut + light lower lip + metal floor
    const engrave = (str: string, y: number, size: number, weight = 800, font = '"Lilita One", Orbitron, sans-serif', maxW = s * 0.62) => {
      bCtx.font = `${weight} ${size}px ${font}`
      const w = bCtx.measureText(str).width
      if (w > maxW) { size = size * maxW / w; bCtx.font = `${weight} ${size}px ${font}` }
      bCtx.textAlign = 'center'; bCtx.textBaseline = 'middle'
      const o = Math.max(1.5, size * 0.045)
      bCtx.fillStyle = 'rgba(255,255,255,0.55)'; bCtx.fillText(str, c, y + o)
      bCtx.fillStyle = 'rgba(0,0,0,0.7)'; bCtx.fillText(str, c, y - o * 0.6)
      bCtx.fillStyle = shade(metal, 0.5); bCtx.fillText(str, c, y)
    }
    const rule = (y: number, half: number) => {
      bCtx.lineWidth = 2
      bCtx.strokeStyle = 'rgba(0,0,0,0.4)'; bCtx.beginPath(); bCtx.moveTo(c - half, y - 1); bCtx.lineTo(c + half, y - 1); bCtx.stroke()
      bCtx.strokeStyle = 'rgba(255,255,255,0.4)'; bCtx.beginPath(); bCtx.moveTo(c - half, y + 1); bCtx.lineTo(c + half, y + 1); bCtx.stroke()
    }

    // Hallmark: small engraved hex with the tier
    bCtx.lineWidth = 3
    bCtx.strokeStyle = 'rgba(0,0,0,0.5)'; drawHex(bCtx, c, s * 0.155 - 1.5, s * 0.045); bCtx.stroke()
    bCtx.strokeStyle = 'rgba(255,255,255,0.4)'; drawHex(bCtx, c, s * 0.155 + 1.5, s * 0.045); bCtx.stroke()
    engrave('H', s * 0.157, s * 0.05)
    engrave(`HEXOD · ${tier.id}`, s * 0.235, s * 0.026, 800)

    engrave(state.tokenName, s * 0.315, s * 0.058)
    if (!b) {
      rule(s * 0.38, s * 0.16)
      engrave('TERRITORY DEED', s * 0.44, s * 0.03)
      bTex.needsUpdate = true
      return
    }
    const ns = `${Math.abs(b.lat).toFixed(4)}° ${b.lat >= 0 ? 'N' : 'S'}   ${Math.abs(b.lon).toFixed(4)}° ${b.lon >= 0 ? 'E' : 'W'}`
    engrave(ns, s * 0.375, s * 0.03, 700, '"Roboto Mono", "Courier New", monospace')
    if (b.region) engrave(b.region.toUpperCase(), s * 0.425, s * 0.03)
    rule(s * 0.47, s * 0.2)
    engrave(b.owner ? `HELD BY ${b.owner.toUpperCase()}` : 'UNCLAIMED', s * 0.525, s * 0.038)
    if (b.capturedAt) engrave(`SINCE ${b.capturedAt}`, s * 0.575, s * 0.026, 700)
    engrave(`${b.rarity.toUpperCase()} · ${Math.round(b.hexPerDay).toLocaleString()} HEX A DAY`, s * 0.635, s * 0.032)
    if (b.resources.length) engrave(b.resources.slice(0, 3).map(r => r.name.toUpperCase()).join(' · '), s * 0.68, s * 0.024, 700)
    rule(s * 0.725, s * 0.2)
    const ed = b.edition && b.edition > 1 ? `EDITION ${b.edition} · VALUE 1/${b.edition}` : 'GENESIS EDITION'
    engrave(`${ed} · ${b.minted && b.tokenId ? `TOKEN ${b.tokenId}` : 'NOT MINTED'}`, s * 0.77, s * 0.024, 700)
    engrave(b.h3Index, s * 0.81, s * 0.026, 700, '"Roboto Mono", "Courier New", monospace')

    bTex.needsUpdate = true
  }

  // ─── Initial draws ───────────────────────────────────────
  let disposed = false
  applyTierLook()
  drawFront()
  drawBack()
  cardImg.onload = () => { if (!disposed) drawFront() }
  if (state.imageSrc) cardImg.src = state.imageSrc
  // Canvas text needs the (bundled) font loaded, otherwise it falls back to a system font.
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) {
      Promise.all([fonts.load(`900 ${Math.round(s * 0.047)}px Orbitron`), fonts.ready])
        .then(() => { if (!disposed) { drawFront(); drawBack() } })
        .catch(() => {})
    }
  } catch { /* ignore */ }

  // ─── Framing: fit the token in both portrait and landscape ─
  let zoom = 1
  function frame() {
    const aspect = W() / H()
    camera.aspect = aspect
    const t = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2))
    const needH = 2.2    // half-height incl. light pool + bob
    const needW = aspect < 1 ? 1.62 : 1.9  // half-width (flat sides ~1.39) + sway margin
    const dist = Math.max(needH / t, needW / (t * aspect))
    camera.position.set(0, 0.05, dist * zoom)
    camera.lookAt(0, -0.1, 0)
    camera.updateProjectionMatrix()
    renderer.setSize(W(), H())
  }
  frame()

  // ─── Interaction: drag rotates the object (lights stay fixed, so reflections sweep) ─
  let dragging = false
  let lastX = 0, lastY = 0
  let userY = 0, userX = 0     // user offsets (radians)
  let velY = 0, velX = 0
  let lastInteract = -10
  const now = () => performance.now() / 1000

  const onDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX; lastY = e.clientY
    velY = velX = 0
    lastInteract = now()
    canvasEl.style.cursor = 'grabbing'
    try { canvasEl.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    lastX = e.clientX; lastY = e.clientY
    const k = 0.0105
    userY += dx * k; userX += dy * k
    userX = THREE.MathUtils.clamp(userX, -0.9, 0.9)
    velY = dx * k; velX = dy * k
    lastInteract = now()
  }
  const onUp = (e: PointerEvent) => {
    dragging = false
    canvasEl.style.cursor = 'grab'
    lastInteract = now()
    try { canvasEl.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    zoom = THREE.MathUtils.clamp(zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.72, 1.45)
    frame()
  }
  canvasEl.addEventListener('pointerdown', onDown)
  canvasEl.addEventListener('pointermove', onMove)
  canvasEl.addEventListener('pointerup', onUp)
  canvasEl.addEventListener('pointercancel', onUp)
  canvasEl.addEventListener('wheel', onWheel, { passive: false })

  // ═══════════════════════════════════════════════════════════
  // Animation loop (time-based)
  // ═══════════════════════════════════════════════════════════
  const ENTRY = reducedMotion ? 0.35 : 1.6
  const t0 = now()
  let prev = t0
  let animId = 0
  pivot.scale.setScalar(0.001)

  function animate() {
    animId = requestAnimationFrame(animate)
    const tn = now()
    const dt = Math.min(0.05, tn - prev)
    prev = tn
    const t = tn - t0

    // Reveal: spin in with a slight overshoot, shockwave ring, halo fades in
    const e = Math.min(1, t / ENTRY)
    const sc = reducedMotion ? e : easeOutBack(e)
    pivot.scale.setScalar(Math.max(0.001, sc))
    const entrySpin = reducedMotion ? 0 : (1 - easeOutCubic(e)) * -Math.PI * 2.0

    const r = Math.max(0, (t - ENTRY * 0.55) / 0.9)
    if (r > 0 && r < 1) {
      ring.scale.setScalar(2.6 + r * 5.5)
      ringMat.opacity = (1 - r) * 0.7
    } else ringMat.opacity = 0

    const haloIn = Math.min(1, t / (ENTRY * 0.9))
    haloMat.opacity = haloIn * (0.42 + Math.sin(t * 1.3) * 0.05)
    poolMat.opacity = haloIn * 0.42

    // Inertia + ease back to front after a pause
    if (!dragging) {
      userY += velY; userX += velX
      velY *= 0.92; velX *= 0.92
      if (tn - lastInteract > 3.5) {
        const targetY = Math.round(userY / (Math.PI * 2)) * Math.PI * 2
        userY += (targetY - userY) * Math.min(1, dt * 1.6)
        userX += (0 - userX) * Math.min(1, dt * 1.6)
      }
    }

    // Idle presentation: gentle sway + tilt + bob (face stays readable)
    const amp = reducedMotion ? 0 : 1
    const swayY = Math.sin(t * 0.55) * 0.42 * amp
    const swayX = (Math.sin(t * 0.41) * 0.1 - 0.06) * amp
    card.rotation.y = entrySpin + swayY + userY
    card.rotation.x = swayX + userX
    card.rotation.z = Math.sin(t * 0.33) * 0.025 * amp
    pivot.position.y = Math.sin(t * 1.1) * 0.06 * amp
    halo.position.y = pivot.position.y

    // Slowly turn the studio so light streaks glide across the metal and the glossy face
    scene.environmentRotation.y = Math.sin(t * 0.35) * 0.45 * amp
    scene.environmentRotation.x = Math.sin(t * 0.23) * 0.1 * amp

    // Sparkles twinkle
    for (const o of sparkles) {
      const v = Math.max(0, Math.sin(t * o.speed * 2 + o.phase))
      const tw = Math.pow(v, 6) * haloIn
      o.sp.material.opacity = tw
      o.sp.scale.setScalar(o.size * (0.4 + tw))
    }
    sparkleGroup.rotation.z = t * 0.05
    sparkleGroup.position.y = pivot.position.y

    renderer.render(scene, camera)
  }
  animate()

  // Resize
  const onResize = () => frame()
  window.addEventListener('resize', onResize)
  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(onResize); ro.observe(container) }

  // ─── Public API ──────────────────────────────────────────
  return {
    update(p: Partial<TokenViewerProps>) {
      let tierChanged = false
      if (p.tier !== undefined && TIERS[p.tier] !== state.tier) { state.tier = TIERS[p.tier]; tierChanged = true }
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
      if (p.back !== undefined) state.back = p.back
      for (const k of ['rarity', 'region', 'country', 'terrain', 'tokenNo', 'cellId'] as const) if (p[k] !== undefined) state[k] = p[k] as string
      if (p.hexPerDay !== undefined) state.hexPerDay = p.hexPerDay
      if (p.imageSrc !== undefined && p.imageSrc && p.imageSrc !== state.imageSrc) {
        state.imageSrc = p.imageSrc
        cardImg.src = p.imageSrc
      }
      if (tierChanged) applyTierLook()
      drawFront()
      drawBack()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      canvasEl.removeEventListener('pointerdown', onDown)
      canvasEl.removeEventListener('pointermove', onMove)
      canvasEl.removeEventListener('pointerup', onUp)
      canvasEl.removeEventListener('pointercancel', onUp)
      canvasEl.removeEventListener('wheel', onWheel)
      cardImg.onload = null
      sparkles.splice(0).forEach(o => o.sp.material.dispose())
      ;[geo, bezelGeo, gemGeo, pool.geometry].forEach(g => g.dispose())
      ;[fMat, bMat, sMat, rimMat, gemMat, haloMat, poolMat, ringMat].forEach(m => m.dispose())
      ;[fTex, bTex, haloTex, ringTex, starTex, envTex].forEach(tx => tx.dispose())
      pmrem.dispose()
      renderer.dispose()
      if (container.contains(canvasEl)) container.removeChild(canvasEl)
    },
  }
}
