/**
 * LoadingGlobe — 3D Earth loading screen.
 * Spins for 2s, then camera dives into player's IP location.
 * Fades out to reveal the 2D Leaflet map underneath.
 */
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

interface Props {
  playerLat?: number
  playerLon?: number
  onComplete: () => void
}

const EARTH_RADIUS = 5
const DURATION_MS = 3500

function latLonToSphere(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

export function LoadingGlobe({ playerLat = 48.8566, playerLon = 2.3522, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'spinning' | 'diving' | 'done'>('spinning')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#050510')

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    camera.position.set(0, 0, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Earth
    const geo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
    const mat = new THREE.MeshPhongMaterial({ color: '#1a4a7a', emissive: '#0a1628', specular: '#334466', shininess: 15 })
    const earth = new THREE.Mesh(geo, mat)
    scene.add(earth)

    // Load texture
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png',
      (texture) => { mat.map = texture; mat.needsUpdate = true },
      undefined,
      () => { mat.color.set('#1a5a8a') }
    )

    // Atmosphere
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64)
    const atmosMat = new THREE.MeshPhongMaterial({ color: '#0099cc', transparent: true, opacity: 0.08, side: THREE.BackSide })
    scene.add(new THREE.Mesh(atmosGeo, atmosMat))

    // Lights
    scene.add(new THREE.AmbientLight('#ffffff', 0.4))
    const sun = new THREE.DirectionalLight('#ffffff', 1.2)
    sun.position.set(10, 8, 10)
    scene.add(sun)

    // Stars
    const starsGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(2400)
    for (let i = 0; i < 2400; i++) starPos[i] = (Math.random() - 0.5) * 200
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.1 })))

    // Player location marker
    const targetPos = latLonToSphere(playerLat, playerLon, EARTH_RADIUS * 1.01)
    const markerGeo = new THREE.SphereGeometry(0.08, 16, 16)
    const markerMat = new THREE.MeshBasicMaterial({ color: '#00FF87' })
    const marker = new THREE.Mesh(markerGeo, markerMat)
    marker.position.copy(targetPos)
    earth.add(marker)

    // Animation
    const startTime = Date.now()
    let animId = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsed = Date.now() - startTime
      const t = Math.min(1, elapsed / DURATION_MS)

      if (t < 0.5) {
        // Phase 1: Spin (0-50%)
        earth.rotation.y += 0.015
        camera.position.z = 14
      } else {
        // Phase 2: Dive toward player location (50-100%)
        const diveT = (t - 0.5) * 2 // 0→1
        const eased = 1 - Math.pow(1 - diveT, 3) // ease-out cubic

        // Rotate earth so player location faces camera
        const targetRotY = -((playerLon + 90) * Math.PI / 180)
        earth.rotation.y = earth.rotation.y + (targetRotY - earth.rotation.y) * 0.05

        // Camera dives in
        camera.position.z = 14 - eased * 12
        camera.position.y = eased * (playerLat > 0 ? 2 : -2)

        if (diveT > 0.3) setPhase('diving')
      }

      if (t >= 1) {
        setPhase('done')
        cancelAnimationFrame(animId)
        setTimeout(onComplete, 400)
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [playerLat, playerLon, onComplete])

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      opacity: phase === 'done' ? 0 : 1,
      transition: 'opacity 0.4s ease-out',
      pointerEvents: phase === 'done' ? 'none' : 'auto',
    }}>
      {/* Loading text */}
      <div style={{
        position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 900, letterSpacing: 8,
          fontFamily: "'Orbitron', monospace",
          color: '#0099cc',
          textShadow: '0 0 20px rgba(0,153,204,0.5)',
        }}>HEXOD</div>
        <div style={{
          fontSize: 9, color: 'rgba(150,190,220,0.6)', letterSpacing: 4, marginTop: 8,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          {phase === 'spinning' ? 'CONNECTING TO WORLD...' : 'LOCATING COMMANDER...'}
        </div>
      </div>
    </div>
  )
}
