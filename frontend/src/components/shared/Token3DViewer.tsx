/**
 * Token3DViewer — Premium holographic NFT token viewer.
 * Faithful React port of read_only_templates/token_3Dviewer_admin_overlay.html
 * 
 * Features:
 *   - Hexagonal 3D card (CylinderGeometry 6 sides)
 *   - Canvas 2D textures: holographic rainbow, metallic shimmer, carbon fiber
 *   - MeshPhysicalMaterial: clearcoat, metalness, reflectivity
 *   - Entry animation (spin + scale)
 *   - Auto-rotation + mouse/touch drag
 *   - 4 rarity tiers (Bronze/Silver/Gold/Emerald)
 *   - Film grain, vignette, CNC-engraved metadata on back
 * 
 * Props: tokenName, category, tier, serial, maxSupply, catColor, iconSvg
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORIES } from '../shared/radarIconData'
import { getIcon } from '../shared/iconBank'

// ═══ TIER CONFIG (from original) ═══
const TIERS: Record<string, {id:string; metal:string; carbon:string; title:string; engrave_metal:string}> = {
  BRONZE:  { id:'BRONZE',  metal:'#CD7F32', carbon:'#1C1610', title:'#EBC49F', engrave_metal:'#5C3317' },
  SILVER:  { id:'SILVER',  metal:'#C0C0C0', carbon:'#16181A', title:'#FFFFFF', engrave_metal:'#4A4A4A' },
  GOLD:    { id:'GOLD',    metal:'#D4AF37', carbon:'#1A1608', title:'#FFECB3', engrave_metal:'#634E14' },
  EMERALD: { id:'EMERALD', metal:'#2ECC71', carbon:'#051209', title:'#A9DFBF', engrave_metal:'#145A32' },
}

const CONFIG = {
  textureSize: 1024, // Lower than 2048 for React perf, still crisp
  cardThickness: 0.14,
  rotationSpeed: 0.002,
}

export interface Token3DProps {
  visible: boolean
  onClose: () => void
  tokenName?: string
  category?: string
  catColor?: string
  tier?: keyof typeof TIERS
  serial?: number
  maxSupply?: number
  edition?: string
  biome?: string
  power?: number
  rarity?: number
  description?: string
  /** Custom info panel content — replaces the default VAULT PRESTIGE panel */
  infoPanel?: React.ReactNode
}

export function Token3DViewer({
  visible, onClose,
  tokenName = 'CRIMSON PEAK',
  category = 'ANCIENT FOREST',
  catColor = '#39FF14',
  tier: tierKey = 'GOLD',
  serial = 42,
  maxSupply = 1000,
  edition = 'GENESIS',
  biome = 'EUROPA',
  power = 87,
  rarity = 94,
  description,
  infoPanel,
}: Token3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    card: THREE.Group
    fMat: THREE.MeshPhysicalMaterial
    bMat: THREE.MeshPhysicalMaterial
    sMat: THREE.MeshPhysicalMaterial
    frontCanvas: HTMLCanvasElement
    backCanvas: HTMLCanvasElement
    fCtx: CanvasRenderingContext2D
    bCtx: CanvasRenderingContext2D
    animId: number
    entryProgress: number
    shineOffset: number
    holoAngle: number
    frameCount: number
    isDragging: boolean
    dragStart: {x:number; y:number}
    rotationTarget: {x:number; y:number}
  } | null>(null)

  const tier = TIERS[tierKey] || TIERS.GOLD

  // ═══ DRAWING HELPERS ═══

  const drawHex = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI / 3) - Math.PI / 2
      ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
    }
    ctx.closePath()
  }, [])

  const wrapTextCentered = useCallback((ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line.trim())
        line = word + ' '
      } else line = test
    }
    lines.push(line.trim())
    const totalH = lines.length * lineHeight
    let startY = y - totalH / 2 + lineHeight / 2
    lines.forEach(l => { ctx.fillText(l, x, startY); startY += lineHeight })
  }, [])

  // ═══ INIT THREE.JS ═══
  useEffect(() => {
    if (!visible || !containerRef.current) return

    const el = containerRef.current
    const s = CONFIG.textureSize
    const c = s / 2

    // Scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.6
    renderer.outputEncoding = THREE.sRGBEncoding
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'

    // Lights (faithful to original)
    scene.add(new THREE.AmbientLight(0xffffff, 2.2))
    const keyLight = new THREE.PointLight(0xffffff, 3.5, 25)
    keyLight.position.set(5, 4, 8)
    scene.add(keyLight)
    const rim = new THREE.PointLight(0xffffff, 2.5, 18)
    rim.position.set(-5, 2, -4)
    scene.add(rim)
    const fillLight = new THREE.PointLight(0x8888ff, 1.5, 15)
    fillLight.position.set(-3, -3, 5)
    scene.add(fillLight)
    const topLight = new THREE.PointLight(0xffffff, 1.5, 12)
    topLight.position.set(0, 6, 4)
    scene.add(topLight)

    // Canvases
    const frontCanvas = document.createElement('canvas')
    frontCanvas.width = s; frontCanvas.height = s
    const fCtx = frontCanvas.getContext('2d')!
    const backCanvas = document.createElement('canvas')
    backCanvas.width = s; backCanvas.height = s
    const bCtx = backCanvas.getContext('2d')!

    // Textures
    const fTex = new THREE.CanvasTexture(frontCanvas)
    fTex.rotation = Math.PI / 2
    fTex.center.set(0.5, 0.5)
    const bTex = new THREE.CanvasTexture(backCanvas)
    bTex.rotation = -Math.PI / 2
    bTex.center.set(0.5, 0.5)
    bTex.repeat.set(-1, -1)

    // Materials (premium physical)
    const fMat = new THREE.MeshPhysicalMaterial({
      map: fTex, roughness: 0.02, metalness: 0.88,
      clearcoat: 1.0, clearcoatRoughness: 0.01, reflectivity: 1.0,
    })
    const bMat = new THREE.MeshPhysicalMaterial({
      map: bTex, clearcoat: 1, roughness: 0.01, metalness: 0.9,
      emissive: new THREE.Color(tier.metal), emissiveIntensity: 0.08,
      clearcoatRoughness: 0.01, reflectivity: 1.0,
    })
    const sMat = new THREE.MeshPhysicalMaterial({
      metalness: 1.0, roughness: 0.0,
      emissive: new THREE.Color(tier.metal), emissiveIntensity: 0.25,
      clearcoat: 1.0, clearcoatRoughness: 0.0, reflectivity: 1.0,
    })
    sMat.color.set(catColor)

    // Geometry — hexagonal cylinder
    const geo = new THREE.CylinderGeometry(1.5, 1.5, CONFIG.cardThickness, 6)
    geo.rotateX(Math.PI / 2)
    const card = new THREE.Group()
    const cardMesh = new THREE.Mesh(geo, [sMat, fMat, bMat])
    card.add(cardMesh)
    scene.add(card)
    card.rotation.y = -Math.PI
    card.scale.set(0, 0, 0)

    // Store refs
    const state = {
      scene, camera, renderer, card, fMat, bMat, sMat,
      frontCanvas, backCanvas, fCtx, bCtx,
      animId: 0, entryProgress: 0,
      shineOffset: -2000, holoAngle: 0, frameCount: 0,
      isDragging: false, dragStart: { x: 0, y: 0 },
      rotationTarget: { x: 0, y: 0 },
    }
    sceneRef.current = state

    // ═══ DRAW FRONT FACE ═══
    function drawFront() {
      const boxW = s * 0.71, boxX = (s - boxW) / 2

      fCtx.fillStyle = '#020202'
      fCtx.fillRect(0, 0, s, s)

      // Holographic rainbow overlay
      fCtx.save()
      const holoR = s * 0.4
      const holoG = fCtx.createLinearGradient(
        c + Math.cos(state.holoAngle) * holoR, c + Math.sin(state.holoAngle) * holoR,
        c - Math.cos(state.holoAngle) * holoR, c - Math.sin(state.holoAngle) * holoR,
      )
      holoG.addColorStop(0, 'rgba(255,0,128,0.15)')
      holoG.addColorStop(0.2, 'rgba(255,128,0,0.12)')
      holoG.addColorStop(0.4, 'rgba(255,255,0,0.15)')
      holoG.addColorStop(0.6, 'rgba(0,255,128,0.12)')
      holoG.addColorStop(0.8, 'rgba(0,128,255,0.15)')
      holoG.addColorStop(1, 'rgba(128,0,255,0.12)')
      fCtx.fillStyle = holoG
      drawHex(fCtx, c, c, s * 0.49)
      fCtx.fill()
      fCtx.restore()

      // Metallic shimmer gradient
      const shineW = s * 0.5
      const g = fCtx.createLinearGradient(state.shineOffset * 2, 0, state.shineOffset * 2 + shineW, 0)
      g.addColorStop(0, tier.metal)
      g.addColorStop(0.4, '#ffffff')
      g.addColorStop(0.6, '#ffffff')
      g.addColorStop(1, tier.metal)

      // Rarity badge (top-right)
      const badgeX = boxX + boxW - s * 0.06, badgeY = s * 0.14, badgeSize = s * 0.042
      fCtx.save()
      fCtx.shadowBlur = 50; fCtx.shadowColor = tier.metal
      fCtx.fillStyle = tier.carbon
      drawHex(fCtx, badgeX, badgeY, badgeSize); fCtx.fill()
      fCtx.strokeStyle = tier.metal; fCtx.lineWidth = 5; fCtx.stroke()
      fCtx.fillStyle = tier.metal
      fCtx.font = `900 ${s * 0.03}px Orbitron`; fCtx.textAlign = 'center'
      fCtx.fillText(tier.id[0], badgeX, badgeY + s * 0.01)
      fCtx.restore()

      // Category label
      fCtx.textAlign = 'center'; fCtx.fillStyle = g
      fCtx.font = `bold ${s * 0.032}px Orbitron`
      fCtx.fillText(category, c, s * 0.166)

      // Biome
      fCtx.fillStyle = g; fCtx.font = `bold ${s * 0.032}px Orbitron`
      fCtx.fillText(biome, c, s * 0.264)

      // Image area (dark placeholder with category color glow)
      const imageY = s * 0.293, imageH = s * 0.342
      fCtx.save()
      fCtx.shadowBlur = s * 0.05; fCtx.shadowColor = catColor
      const imgGrad = fCtx.createRadialGradient(c, imageY + imageH / 2, 0, c, imageY + imageH / 2, boxW * 0.6)
      imgGrad.addColorStop(0, catColor + '25')
      imgGrad.addColorStop(1, '#020202')
      fCtx.fillStyle = imgGrad
      fCtx.fillRect(boxX, imageY, boxW, imageH)
      fCtx.restore()

      // Title bar
      const titleY = imageY + imageH - s * 0.034
      fCtx.fillStyle = 'rgba(0,0,0,0.88)'
      fCtx.fillRect(boxX, titleY - s * 0.025, boxW, s * 0.05)
      fCtx.save()
      fCtx.textAlign = 'center'
      fCtx.font = `900 ${s * 0.047}px Orbitron`
      fCtx.strokeStyle = 'rgba(0,0,0,0.9)'; fCtx.lineWidth = s * 0.003
      fCtx.strokeText(tokenName, c, titleY + s * 0.008)
      fCtx.fillStyle = g; fCtx.shadowBlur = 40; fCtx.shadowColor = catColor
      fCtx.fillText(tokenName, c, titleY + s * 0.008)
      fCtx.restore()

      // Side text — TIER (left) + SERIAL (right)
      fCtx.font = `900 ${s * 0.026}px Orbitron`
      fCtx.save()
      fCtx.translate(boxX - s * 0.035, imageY + imageH / 2); fCtx.rotate(-Math.PI / 2)
      fCtx.fillStyle = g; fCtx.shadowBlur = 25; fCtx.shadowColor = tier.metal
      fCtx.fillText(tier.id, 0, 0); fCtx.restore()
      fCtx.save()
      fCtx.translate(boxX + boxW + s * 0.035, imageY + imageH / 2); fCtx.rotate(Math.PI / 2)
      fCtx.fillStyle = g; fCtx.shadowBlur = 25; fCtx.shadowColor = tier.metal
      fCtx.fillText(`${serial}/${maxSupply}`, 0, 0); fCtx.restore()

      // Description box
      const descY = imageY + imageH + s * 0.02, descH = s * 0.352
      fCtx.save()
      fCtx.shadowBlur = 40; fCtx.shadowColor = catColor
      fCtx.fillStyle = 'rgba(5,5,5,0.98)'; fCtx.fillRect(boxX, descY, boxW, descH)
      fCtx.restore()
      fCtx.strokeStyle = g; fCtx.lineWidth = 4
      fCtx.strokeRect(boxX + s * 0.01, descY + s * 0.01, boxW - s * 0.02, descH - s * 0.02)
      fCtx.strokeStyle = catColor; fCtx.globalAlpha = 0.35; fCtx.lineWidth = 2
      fCtx.strokeRect(boxX + s * 0.012, descY + s * 0.012, boxW - s * 0.024, descH - s * 0.024)
      fCtx.globalAlpha = 1
      fCtx.textAlign = 'center'; fCtx.fillStyle = '#e0e0e0'
      fCtx.font = `italic ${s * 0.02}px Georgia`
      const descText = description || `Ce jeton certifie la propriété souveraine du territoire HEXOD identifié. Données géospatiales cryptées via protocole Vault Alpha. Rareté garantie par Tier ${tier.id}.`
      wrapTextCentered(fCtx, descText, c, descY + s * 0.08, boxW - s * 0.1, s * 0.03)

      // Vignette
      fCtx.save()
      const vig = fCtx.createRadialGradient(c, c, s * 0.25, c, c, s * 0.55)
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.45)')
      fCtx.fillStyle = vig; fCtx.fillRect(0, 0, s, s); fCtx.restore()

      // Film grain
      fCtx.save(); fCtx.globalAlpha = 0.02
      for (let i = 0; i < 1500; i++) {
        fCtx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
        fCtx.fillRect(Math.random() * s, Math.random() * s, 2, 2)
      }
      fCtx.globalAlpha = 1; fCtx.restore()

      // Outer hex border
      fCtx.strokeStyle = tier.metal; fCtx.lineWidth = s * 0.022
      drawHex(fCtx, c, c, s * 0.492); fCtx.stroke()

      fMat.map!.needsUpdate = true
    }

    // ═══ DRAW BACK FACE ═══
    function drawBack() {
      const metalColor = tier.metal
      const coreRadius = s * 0.22

      // Carbon base
      bCtx.fillStyle = tier.carbon; bCtx.fillRect(0, 0, s, s)

      // Carbon fiber weave
      bCtx.save(); bCtx.beginPath(); drawHex(bCtx, c, c, s * 0.47); bCtx.clip()
      bCtx.strokeStyle = 'rgba(255,255,255,0.03)'; bCtx.lineWidth = 1
      const step = s * 0.008
      for (let i = -s; i < s * 2; i += step) {
        bCtx.beginPath(); bCtx.moveTo(i, 0); bCtx.lineTo(i + s * 0.5, s); bCtx.stroke()
        bCtx.beginPath(); bCtx.moveTo(i, 0); bCtx.lineTo(i - s * 0.5, s); bCtx.stroke()
      }
      bCtx.restore()

      // Outer border
      bCtx.strokeStyle = metalColor; bCtx.lineWidth = s * 0.035
      bCtx.shadowColor = metalColor; bCtx.shadowBlur = 40
      drawHex(bCtx, c, c, s * 0.49); bCtx.stroke(); bCtx.shadowBlur = 0

      // Inner border
      bCtx.strokeStyle = metalColor; bCtx.lineWidth = 2; bCtx.globalAlpha = 0.5
      drawHex(bCtx, c, c, s * 0.455); bCtx.stroke(); bCtx.globalAlpha = 1

      // "NON FUNGIBLE TERRITORY" text
      bCtx.textAlign = 'center'; bCtx.font = `bold ${s * 0.022}px Orbitron`
      bCtx.fillStyle = metalColor; bCtx.shadowBlur = 25; bCtx.shadowColor = metalColor
      bCtx.fillText('NON FUNGIBLE TERRITORY', c, c - coreRadius - s * 0.055)
      bCtx.shadowBlur = 0

      // Decorative line
      bCtx.strokeStyle = metalColor; bCtx.lineWidth = 1; bCtx.globalAlpha = 0.4
      bCtx.beginPath(); bCtx.moveTo(c - s * 0.15, c - coreRadius - s * 0.035)
      bCtx.lineTo(c + s * 0.15, c - coreRadius - s * 0.035); bCtx.stroke(); bCtx.globalAlpha = 1

      // Central core — metallic gradient
      const coreGrad = bCtx.createRadialGradient(c - coreRadius * 0.3, c - coreRadius * 0.3, 0, c, c, coreRadius)
      coreGrad.addColorStop(0.3, metalColor); coreGrad.addColorStop(1, tier.engrave_metal)
      bCtx.fillStyle = coreGrad; bCtx.shadowBlur = 50; bCtx.shadowColor = metalColor
      drawHex(bCtx, c, c, coreRadius); bCtx.fill(); bCtx.shadowBlur = 0
      bCtx.strokeStyle = catColor; bCtx.lineWidth = 20; bCtx.globalAlpha = 0.6
      drawHex(bCtx, c, c, coreRadius); bCtx.stroke(); bCtx.globalAlpha = 1
      bCtx.strokeStyle = tier.engrave_metal; bCtx.lineWidth = 2
      drawHex(bCtx, c, c, coreRadius - s * 0.012); bCtx.stroke()

      // CNC-engraved metadata
      const catId = category.slice(0, 3).toUpperCase()
      const lines = [
        `#HEX-${catId}-${String(serial).padStart(4, '0')}`,
        edition, `TIER ${tier.id}`,
        new Date().toISOString().slice(0, 10), 'VAULT_HOLDER',
      ]
      const fontSize = s * 0.018, lineH = fontSize * 1.7
      const totalH = lines.length * lineH
      const startY = c - totalH / 2 + lineH * 0.4
      bCtx.font = `700 ${fontSize}px "Courier New", monospace`
      bCtx.textAlign = 'center'; bCtx.textBaseline = 'middle'

      lines.forEach((line, i) => {
        const y = startY + i * lineH
        const baseAlpha = (i === 0 || i === 2) ? 1.0 : 0.7
        bCtx.save()
        // Rim light
        bCtx.globalAlpha = baseAlpha * 0.3; bCtx.fillStyle = '#ffffff'; bCtx.fillText(line, c, y + 2)
        // Shadow depth
        bCtx.fillStyle = '#000000'; bCtx.globalAlpha = baseAlpha * 0.4
        bCtx.fillText(line, c, y - 1.5); bCtx.fillText(line, c - 1, y - 1); bCtx.fillText(line, c + 1, y - 1)
        // Floor of cut
        bCtx.globalAlpha = baseAlpha; bCtx.shadowColor = 'rgba(0,0,0,0.8)'; bCtx.shadowBlur = 3
        bCtx.fillStyle = tier.engrave_metal; bCtx.fillText(line, c, y)
        bCtx.restore()
      })

      // Hash
      const hash = '0x' + Math.random().toString(16).slice(2, 10).toUpperCase()
      bCtx.font = `500 ${fontSize * 0.6}px Orbitron`; bCtx.globalAlpha = 0.5
      bCtx.fillText(hash, c, startY + lines.length * lineH + s * 0.008); bCtx.globalAlpha = 1

      // "HEXOD" branding
      bCtx.font = `900 ${s * 0.055}px Orbitron`; bCtx.fillStyle = metalColor
      bCtx.shadowBlur = 45; bCtx.shadowColor = metalColor
      bCtx.fillText('HEXOD', c, c + coreRadius + s * 0.075); bCtx.shadowBlur = 0

      // Line above HEXOD
      bCtx.strokeStyle = metalColor; bCtx.lineWidth = 1; bCtx.globalAlpha = 0.4
      bCtx.beginPath(); bCtx.moveTo(c - s * 0.12, c + coreRadius + s * 0.035)
      bCtx.lineTo(c + s * 0.12, c + coreRadius + s * 0.035); bCtx.stroke(); bCtx.globalAlpha = 1

      // Corner hex accents
      bCtx.fillStyle = metalColor; bCtx.globalAlpha = 0.7;
      [[s * 0.15, s * 0.12], [s * 0.85, s * 0.12], [s * 0.15, s * 0.88], [s * 0.85, s * 0.88]].forEach(([x, y]) => {
        drawHex(bCtx, x, y, s * 0.018); bCtx.fill()
      })
      bCtx.globalAlpha = 1

      bMat.map!.needsUpdate = true
    }

    // Initial draw
    drawFront()
    drawBack()

    // ═══ MOUSE/TOUCH CONTROLS ═══
    const onPointerDown = (e: PointerEvent) => {
      state.isDragging = true
      state.dragStart = { x: e.clientX, y: e.clientY }
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!state.isDragging) return
      const dx = e.clientX - state.dragStart.x
      const dy = e.clientY - state.dragStart.y
      state.rotationTarget.y += dx * 0.005
      state.rotationTarget.x += dy * 0.005
      state.dragStart = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = () => {
      state.isDragging = false
      renderer.domElement.style.cursor = 'grab'
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', onPointerUp)

    // Scroll zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camera.position.z = Math.max(4, Math.min(15, camera.position.z + e.deltaY * 0.01))
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // ═══ ANIMATION LOOP ═══
    function animate() {
      state.animId = requestAnimationFrame(animate)

      // Entry animation
      if (state.entryProgress < 1) {
        state.entryProgress += 0.008
        const ease = 1 - Math.pow(1 - state.entryProgress, 3)
        card.scale.set(ease, ease, ease)
        card.rotation.y = -Math.PI + ease * Math.PI
      } else {
        // Auto-rotate when not dragging
        if (!state.isDragging) {
          card.rotation.y += CONFIG.rotationSpeed
        }
        // Apply drag rotation
        card.rotation.y += state.rotationTarget.y
        card.rotation.x += state.rotationTarget.x
        state.rotationTarget.y *= 0.92
        state.rotationTarget.x *= 0.92
      }

      // Shimmer update every 4th frame
      state.frameCount++
      if (state.frameCount % 4 === 0) {
        state.shineOffset += 12
        if (state.shineOffset > 1800) state.shineOffset = -800
        state.holoAngle += 0.03
        drawFront()
      }

      renderer.render(scene, camera)
    }

    animate()

    // Resize
    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // Fade in
    renderer.domElement.style.opacity = '0'
    renderer.domElement.style.transition = 'opacity 1.5s ease-out'
    requestAnimationFrame(() => { renderer.domElement.style.opacity = '1' })

    // Cleanup
    return () => {
      cancelAnimationFrame(state.animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.dispose()
      geo.dispose()
      fMat.dispose(); bMat.dispose(); sMat.dispose()
      fTex.dispose(); bTex.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [visible, tokenName, category, catColor, tierKey, serial, maxSupply, edition, biome, tier, description, drawHex, wrapTextCentered])

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'radial-gradient(ellipse at center, #0a0a12 0%, #000000 70%)',
        }}
      >
        {/* Three.js canvas container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 10,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Info overlay — custom or default VAULT PRESTIGE panel */}
        {infoPanel ? (
          <motion.div
            initial={{ x: -120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              position: 'absolute', top: 20, left: 20, zIndex: 10,
              maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
            }}
          >
            {infoPanel}
          </motion.div>
        ) : (
          <motion.div
            initial={{ x: -120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              position: 'absolute', top: 20, left: 20, zIndex: 10,
              padding: 24, width: 280,
              background: 'rgba(5,5,10,0.92)', borderRadius: 4,
              backdropFilter: 'blur(25px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
              fontFamily: "'Orbitron', sans-serif", color: '#fff',
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2, marginBottom: 8 }}>VAULT PRESTIGE</div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, marginBottom: 4 }}>{tokenName}</div>
            <div style={{ fontSize: 10, color: catColor, letterSpacing: 2, marginBottom: 16 }}>{category}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'TIER', value: tier.id, color: tier.metal },
                { label: 'EDITION', value: edition, color: '#fff' },
                { label: 'SERIAL', value: `${serial}/${maxSupply}`, color: '#fff' },
                { label: 'BIOME', value: biome, color: '#fff' },
                { label: 'POWER', value: `${power}`, color: catColor },
                { label: 'RARITY', value: `${rarity}%`, color: tier.metal },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 8, opacity: 0.4, letterSpacing: 2, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: 8, opacity: 0.3, letterSpacing: 2, textAlign: 'center',
            }}>
              HEXOD · POLYGON POS · ERC-721
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
