/**
 * LoadingGlobe — intro (2026-10-18 rewrite: "the intro isn't fluid, we could have beautiful FX").
 *
 * Fully local (no remote texture that may fail): the Earth is painted on a canvas from the real coastlines
 * (world-atlas land-50m), cartoon colours + a subtle hex grid, a fresnel atmosphere, stars, and pulsing rings
 * on the player's location. ONE continuous, time-based camera path (no per-frame lerp → same motion at
 * 30 or 144 fps): the globe turns to bring you in front, then the camera dives to your spot and the intro
 * cross-fades to the map. Tap anywhere to skip; prefers-reduced-motion skips it.
 */
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { feature } from 'topojson-client'

interface Props {
  playerLat?: number
  playerLon?: number
  onComplete: () => void
}

const R = 5
const TURN_MS = 2600
const DIVE_MS = 2000
const FADE_MS = 600
const TOTAL_MS = TURN_MS + DIVE_MS

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeIn = (t: number) => t * t * t
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

function latLonToSphere(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

/** Equirectangular Earth texture: ocean gradient, land with soft relief, coast glow, faint hex grid. */
async function paintEarth(w: number): Promise<HTMLCanvasElement> {
  const h = w / 2
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const ocean = g.createLinearGradient(0, 0, 0, h)
  ocean.addColorStop(0, '#1b3f8f'); ocean.addColorStop(0.5, '#1f6fd1'); ocean.addColorStop(1, '#1b3f8f')
  g.fillStyle = ocean; g.fillRect(0, 0, w, h)

  const topo: any = (await import('world-atlas/land-50m.json')).default
  const land: any = feature(topo, topo.objects.land)
  const px = (lon: number) => ((lon + 180) / 360) * w
  const py = (lat: number) => ((90 - lat) / 180) * h
  const path = new Path2D()
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) for (const ring of poly) {
      let prev: number | null = null
      ring.forEach(([lon, lat]: number[], i: number) => {
        const x = px(lon), y = py(lat)
        if (i === 0 || (prev !== null && Math.abs(lon - prev) > 180)) path.moveTo(x, y)   // antimeridian: no wrap line
        else path.lineTo(x, y)
        prev = lon
      })
      path.closePath()
    }
  }
  // Shallow-water glow around the coasts, then land with a latitude tint (green → sand → ice)
  g.save(); g.shadowColor = 'rgba(120,220,255,0.9)'; g.shadowBlur = w / 180; g.strokeStyle = 'rgba(140,225,255,0.55)'
  g.lineWidth = w / 600; g.stroke(path); g.restore()
  const tint = g.createLinearGradient(0, 0, 0, h)
  tint.addColorStop(0.0, '#eef6ff'); tint.addColorStop(0.12, '#d8e8f0'); tint.addColorStop(0.2, '#5fae58')
  tint.addColorStop(0.36, '#4f9e48'); tint.addColorStop(0.43, '#c9b46a'); tint.addColorStop(0.5, '#3f9a4a')
  tint.addColorStop(0.57, '#c9b46a'); tint.addColorStop(0.66, '#4f9e48'); tint.addColorStop(0.86, '#d8e8f0'); tint.addColorStop(1, '#eef6ff')
  g.fillStyle = tint; g.fill(path)
  g.save(); g.clip(path)
  const shade = g.createLinearGradient(0, 0, w, h)          // soft cartoon relief
  shade.addColorStop(0, 'rgba(255,255,255,0.10)'); shade.addColorStop(1, 'rgba(0,0,0,0.12)')
  g.fillStyle = shade; g.fillRect(0, 0, w, h); g.restore()
  g.lineWidth = Math.max(1, w / 1400); g.strokeStyle = 'rgba(10,40,30,0.55)'; g.stroke(path)

  // Faint hex grid (the game's world grid)
  const s = w / 140
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1
  for (let row = 0, y = 0; y < h + s; row++, y += s * 1.5) {
    for (let x = (row % 2) * s * 0.866; x < w + s; x += s * 1.732) {
      g.beginPath()
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6
        k ? g.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)) : g.moveTo(x + s * Math.cos(a), y + s * Math.sin(a))
      }
      g.closePath(); g.stroke()
    }
  }
  return c
}

export function LoadingGlobe({ playerLat = 48.8566, playerLon = 2.3522, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'loading' | 'turn' | 'dive' | 'fade'>('loading')
  const doneRef = useRef(false)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setPhase('fade')
    setTimeout(onComplete, FADE_MS)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return }

    const W = () => container.clientWidth || window.innerWidth
    const H = () => container.clientHeight || window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.05, 500)
    camera.position.set(0, 0, 18)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(W(), H())
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor('#050a1c')
    container.appendChild(renderer.domElement)

    // Earth (texture painted asynchronously; a plain ocean sphere shows meanwhile)
    const earthMat = new THREE.MeshStandardMaterial({ color: '#2a6fd0', roughness: 0.85, metalness: 0 })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), earthMat)
    scene.add(earth)
    let tex: THREE.CanvasTexture | null = null
    let disposed = false
    let ready = false                                   // timeline starts once the Earth is painted (≤ 1.5 s)
    const readyTimer = setTimeout(() => { ready = true }, 1500)
    paintEarth(Math.min(window.innerWidth, window.innerHeight) < 700 ? 2048 : 4096).then(cv => {
      if (disposed) return
      tex = new THREE.CanvasTexture(cv)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      earthMat.map = tex; earthMat.color.set('#ffffff'); earthMat.needsUpdate = true
      ready = true
    }).catch(() => { ready = true /* plain ocean globe still animates */ })

    // Fresnel atmosphere (additive glow on the limb)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.14, 64, 64), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.35,0.75,1.0,1.0) * i * 1.6; }',
    }))
    scene.add(atmo)

    scene.add(new THREE.HemisphereLight('#dbeeff', '#0b1a3a', 0.9))
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2)
    sun.position.set(-6, 5, 10)
    scene.add(sun)

    // Stars (two layers, slow parallax)
    const stars = new THREE.Group()
    for (const [n, size, spread] of [[1400, 0.08, 220], [400, 0.16, 160]] as const) {
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(spread * (0.6 + Math.random() * 0.4))
        pos.set([v.x, v.y, v.z], i * 3)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      stars.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#cfe3ff', size, sizeAttenuation: true, transparent: true, opacity: 0.85 })))
    }
    scene.add(stars)

    // Player location: beacon + pulsing rings, oriented on the surface normal
    const target = latLonToSphere(playerLat, playerLon, R)
    const normal = target.clone().normalize()
    const beacon = new THREE.Group()
    beacon.position.copy(target)
    beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    earth.add(beacon)
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.085, 48),
        new THREE.MeshBasicMaterial({ color: '#34d058', transparent: true, depthWrite: false, side: THREE.DoubleSide }))
      ring.position.z = 0.01
      beacon.add(ring); rings.push(ring)
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    dot.position.z = 0.012
    beacon.add(dot)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.03, 1.2, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
    beam.rotation.x = Math.PI / 2; beam.position.z = 0.6
    beacon.add(beam)

    // Orientation that puts the player in front of the camera (Y then X, Euler 'XYZ' applies Y first)
    const lat = (playerLat * Math.PI) / 180
    const ryEnd = -((playerLon + 90) * Math.PI) / 180
    const ryStart = ryEnd - Math.PI * 1.15

    const onResize = () => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()) }
    window.addEventListener('resize', onResize)

    let t0 = 0, raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!t0 && ready) { t0 = now; setPhase('turn') }
      const t = t0 ? now - t0 : 0
      const a = easeInOut(clamp01(t / TURN_MS))                 // turn the globe
      const d = clamp01((t - TURN_MS) / DIVE_MS)                // dive
      earth.rotation.y = ryStart + (ryEnd - ryStart) * a
      earth.rotation.x = lat * a
      atmo.rotation.copy(earth.rotation)
      const dist = 18 - 6 * a - (12 - R - 0.16) * easeIn(d)     // 18 → 12 → just above the ground
      camera.position.set(0, 0, dist)
      camera.fov = 42 - 14 * easeInOut(d)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      stars.rotation.y = t * 0.00002
      rings.forEach((rg, i) => {                                // expanding, fading rings
        const p = ((t / 1400) + i / 3) % 1
        rg.scale.setScalar(1 + p * 6)
        ;(rg.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9
      })
      ;(beam.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(t / 220)
      if (d > 0 && t < TOTAL_MS) setPhase(p => (p === 'turn' ? 'dive' : p))
      if (t >= TOTAL_MS - FADE_MS) finish()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      clearTimeout(readyTimer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      scene.traverse(o => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
        mats.forEach(mm => mm.dispose())
      })
      tex?.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [playerLat, playerLon])

  return (
    <div ref={containerRef} onClick={finish} role="button" aria-label="Skip intro"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, cursor: 'pointer', background: '#050a1c',
        opacity: phase === 'fade' ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-in`,
        pointerEvents: phase === 'fade' ? 'none' : 'auto',
      }}>
      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
        opacity: phase === 'dive' || phase === 'fade' ? 0 : 1, transform: `translateY(${phase === 'loading' ? 12 : 0}px)`,
        transition: 'opacity 500ms ease, transform 700ms cubic-bezier(.2,.9,.3,1.2)',
      }}>
        <div style={{
          fontFamily: "'Lilita One', sans-serif", fontSize: 54, letterSpacing: 4, color: '#fff',
          textShadow: '0 4px 0 #0f2266, 0 0 30px rgba(80,170,255,0.55)', WebkitTextStroke: '2px #0f2266',
        }}>HEXOD</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: 'rgba(200,225,255,0.85)', marginTop: 6 }}>
          Conquer the real world · tap to skip
        </div>
      </div>
    </div>
  )
}
