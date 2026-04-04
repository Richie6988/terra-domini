/**
 * GlobeView — 3D sphere when zoom < 5.
 * Uses Three.js with OrbitControls for a spinning Earth globe.
 * Territories and kingdoms rendered as colored hexagonal patches on the sphere.
 * Transition: Leaflet map dissolves → globe appears.
 */
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

interface Props {
  visible: boolean
  territories?: { lat: number; lon: number; color: string }[]
  onZoomIn?: (lat: number, lon: number) => void
}

const EARTH_RADIUS = 5
const EARTH_TEXTURE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png'

function latLonToSphere(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

export function GlobeView({ visible, territories = [], onZoomIn }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible || !containerRef.current || sceneRef.current) return

    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#050510')

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    camera.position.set(0, 0, 14)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.3
    controls.enableZoom = true
    controls.minDistance = 7
    controls.maxDistance = 25
    controls.enablePan = false

    // Earth sphere
    const geo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
    const mat = new THREE.MeshPhongMaterial({
      color: '#1a3d5c',
      emissive: '#0a1628',
      specular: '#334466',
      shininess: 15,
    })

    // Load texture
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(EARTH_TEXTURE, (texture) => {
      mat.map = texture
      mat.needsUpdate = true
      setLoaded(true)
    }, undefined, () => {
      // Fallback: use solid blue if texture fails
      mat.color.set('#1a4a7a')
      setLoaded(true)
    })

    const earth = new THREE.Mesh(geo, mat)
    scene.add(earth)

    // Atmosphere glow
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.015, 64, 64)
    const atmosMat = new THREE.MeshPhongMaterial({
      color: '#0099cc',
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    })
    scene.add(new THREE.Mesh(atmosGeo, atmosMat))

    // Lights
    const ambient = new THREE.AmbientLight('#ffffff', 0.4)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight('#ffffff', 1.2)
    sun.position.set(10, 8, 10)
    scene.add(sun)

    // Stars
    const starsGeo = new THREE.BufferGeometry()
    const starPositions = new Float32Array(3000)
    for (let i = 0; i < 3000; i++) {
      starPositions[i] = (Math.random() - 0.5) * 200
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starsMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.1 })
    scene.add(new THREE.Points(starsGeo, starsMat))

    // Territory markers on globe surface
    territories.forEach(t => {
      const pos = latLonToSphere(t.lat, t.lon, EARTH_RADIUS * 1.005)
      const dotGeo = new THREE.SphereGeometry(0.03, 8, 8)
      const dotMat = new THREE.MeshBasicMaterial({ color: t.color })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(pos)
      earth.add(dot)
    })

    // Click handler — zoom back to map
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    renderer.domElement.addEventListener('dblclick', (e) => {
      mouse.x = (e.offsetX / w) * 2 - 1
      mouse.y = -(e.offsetY / h) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObject(earth)
      if (hits.length > 0) {
        const p = hits[0].point
        const lat = 90 - Math.acos(p.y / EARTH_RADIUS) * (180 / Math.PI)
        const lon = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180
        onZoomIn?.(lat, ((lon + 540) % 360) - 180)
      }
    })

    // Animate
    let animId: number = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      earth.rotation.y += 0.001
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    sceneRef.current = { scene, camera, renderer, controls, animId }

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      container.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [visible])

  // Resize
  useEffect(() => {
    if (!sceneRef.current || !containerRef.current) return
    const onResize = () => {
      const { camera, renderer } = sceneRef.current
      const w = containerRef.current!.clientWidth
      const h = containerRef.current!.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [visible])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 600,
        background: '#050510',
        transition: 'opacity 0.5s',
        opacity: loaded ? 1 : 0,
      }}
    >
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        padding: '8px 20px', borderRadius: 20,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0,153,204,0.3)',
        fontSize: 9, color: 'rgba(255,255,255,0.6)',
        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
        pointerEvents: 'none',
      }}>
        DOUBLE-CLICK TO ZOOM IN · DRAG TO ROTATE
      </div>
    </div>
  )
}
