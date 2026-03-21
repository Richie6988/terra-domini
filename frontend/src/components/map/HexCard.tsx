/**
 * HexCard — real WebGL 3D hex card using Three.js / React Three Fiber
 * The card is a proper 3D object: extruded hexagonal prism with depth.
 * Rarity drives: emissive glow, material metalness, foil texture, env mapping.
 * POI hexes show image texture on face. Others show biome emoji baked to canvas.
 */
import { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { useTexture, Environment } from '@react-three/drei'
import * as THREE from 'three'
// Suppress deprecated Clock warning
if (typeof window !== 'undefined') { const _warn = console.warn; console.warn = (...a: any[]) => { if (String(a[0]).includes('THREE.Clock')) return; _warn(...a) } }
import { motion, AnimatePresence } from 'framer-motion'
import { KingdomSkillTree } from './KingdomSkillTree'
import { usePlayer } from '../../store'

/* ── rarity ─────────────────────────────────────────────────── */
const R: Record<string, { hex: string; emissive: string; metal: number; rough: number; envInt: number; label: string }> = {
  common:   { hex:'#6B7280', emissive:'#000000', metal:0.1, rough:0.9, envInt:0.2, label:'Common'    },
  uncommon: { hex:'#10B981', emissive:'#052e1c', metal:0.4, rough:0.6, envInt:0.5, label:'Uncommon'  },
  rare:     { hex:'#3B82F6', emissive:'#0a1a3d', metal:0.6, rough:0.4, envInt:0.8, label:'Rare'      },
  epic:     { hex:'#8B5CF6', emissive:'#1a0a3d', metal:0.7, rough:0.3, envInt:1.0, label:'Epic'      },
  legendary:{ hex:'#F59E0B', emissive:'#3d2200', metal:0.9, rough:0.15, envInt:1.4, label:'Legendary'},
  mythic:   { hex:'#EC4899', emissive:'#3d0020', metal:1.0, rough:0.05, envInt:1.8, label:'Mythic ✦' },
}

const BIOME: Record<string,string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿',
}

type Rarity = keyof typeof R

/* ── hex geometry helper ─────────────────────────────────────── */
function makeHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const x = size * Math.cos(angle)
    const y = size * Math.sin(angle)
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

/* ── emoji → canvas texture ──────────────────────────────────── */
function makeEmojiTexture(emoji: string, bg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 512)
  ctx.font = '200px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 256, 256)
  return new THREE.CanvasTexture(c)
}

/* ── Back face texture — rich card back ──────────────────────── */
function makeBackTexture(rarityLabel: string, h3index: string, income: number,
  floorPrice: number|null, color: string, bgHex: string): THREE.CanvasTexture {
  const W = 512
  const c = document.createElement('canvas')
  c.width = W; c.height = W
  const ctx = c.getContext('2d')!

  // Dark background
  ctx.fillStyle = bgHex
  ctx.fillRect(0, 0, W, W)

  // Subtle hex grid watermark
  ctx.globalAlpha = 0.06
  ctx.font = '48px monospace'
  ctx.fillStyle = color
  for (let y = 40; y < W; y += 80) {
    for (let x = y % 2 === 0 ? 20 : 60; x < W; x += 100) {
      ctx.fillText('⬡', x, y)
    }
  }
  ctx.globalAlpha = 1

  // Hex icon
  ctx.font = 'bold 72px monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText('⬡', W/2, 140)

  // H3 index
  ctx.font = '20px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(h3index.slice(0,18), W/2, 185)

  // Separator
  ctx.strokeStyle = color + '44'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 210); ctx.lineTo(W-60, 210); ctx.stroke()

  // Income
  ctx.font = 'bold 36px system-ui'
  ctx.fillStyle = color
  ctx.fillText(`+${income} cristaux/tick`, W/2, 260)

  // Floor price
  if (floorPrice) {
    ctx.font = '28px system-ui'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(`💎 Floor ${floorPrice} TDI`, W/2, 310)
  }

  // Separator
  ctx.beginPath(); ctx.moveTo(60, 345); ctx.lineTo(W-60, 345); ctx.stroke()

  // Rarity badge
  ctx.font = 'bold 22px system-ui'
  ctx.fillStyle = color
  ctx.fillText(rarityLabel.toUpperCase(), W/2, 382)

  // Footer
  ctx.font = '18px system-ui'
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillText('Hexod · Season 1', W/2, 460)

  return new THREE.CanvasTexture(c)
}

/* ── Front face overlay texture (name + type painted on image) ─ */
function makeFrontOverlay(name: string, type: string, rarityLabel: string, color: string): THREE.CanvasTexture {
  const W = 512
  const c = document.createElement('canvas')
  c.width = W; c.height = W
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, W, W)

  // Rarity label at top
  ctx.font = 'bold 22px system-ui'
  ctx.textAlign = 'center'
  // Badge bg
  const bw = ctx.measureText(rarityLabel.toUpperCase()).width + 24
  ctx.fillStyle = color + '44'
  ctx.beginPath()
  ctx.roundRect(W/2 - bw/2, 28, bw, 32, 8)
  ctx.fill()
  ctx.strokeStyle = color + '88'; ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(rarityLabel.toUpperCase(), W/2, 50)

  // Name at bottom (semi-transparent bg)
  const nameLines: string[] = []
  const words = name.split(' ')
  let cur = ''
  ctx.font = 'bold 44px system-ui'
  words.forEach(w => {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > 420) { nameLines.push(cur); cur = w }
    else cur = t
  })
  nameLines.push(cur)

  const nameH = nameLines.length * 52 + 30
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, W - nameH - 40, W, nameH + 40)

  ctx.fillStyle = '#ffffff'
  const startY = W - nameH - 10
  nameLines.forEach((l, i) => ctx.fillText(l, W/2, startY + i * 52, 460))

  // Type badge
  ctx.font = '22px system-ui'
  ctx.fillStyle = color
  ctx.fillText(type.toUpperCase(), W/2, W - 8)

  return new THREE.CanvasTexture(c)
}

/* ── 3D Card mesh ────────────────────────────────────────────── */
function HexMesh({ t, cfg, imgUrl }: { t: any; cfg: typeof R[Rarity]; imgUrl: string | null }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const edgeRef = useRef<THREE.Mesh>(null!)

  // Drag rotation
  const velY = useRef(-0.4)
  const velX = useRef(0)
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    let drag = false, lx = 0, ly = 0

    const down = (e: PointerEvent) => { drag = true; lx = e.clientX; ly = e.clientY; velY.current = 0; velX.current = 0 }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - lx, dy = e.clientY - ly
      velY.current = dx * 0.022; velX.current = -dy * 0.012
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { drag = false }
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl])

  useFrame(() => {
    velY.current *= 0.93; velX.current *= 0.93
    meshRef.current.rotation.y += velY.current
    meshRef.current.rotation.x = Math.max(-0.9, Math.min(0.9, meshRef.current.rotation.x + velX.current))
    edgeRef.current.rotation.y = meshRef.current.rotation.y
    edgeRef.current.rotation.x = meshRef.current.rotation.x
  })

  // Geometry
  const hexShape = useMemo(() => makeHexShape(1.6), [])
  const extrudeSettings = useMemo(() => ({
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4,
  }), [])
  const geometry = useMemo(() => new THREE.ExtrudeGeometry(hexShape, extrudeSettings), [hexShape, extrudeSettings])

  // Edge ring for glow effect
  const edgeGeo = useMemo(() => {
    const outer = makeHexShape(1.64)
    const inner = makeHexShape(1.58)
    outer.holes.push(inner)
    return new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: false })
  }, [])

  // Face texture: image or emoji
  const faceColor = useMemo(() => new THREE.Color(cfg.hex).multiplyScalar(0.15).add(new THREE.Color('#05050f')), [cfg.hex])
  const emojiBg = '#' + faceColor.getHexString()
  const emojiTex = useMemo(() =>
    makeEmojiTexture(t.custom_emoji || t.poi_emoji || BIOME[t.territory_type||'rural'] || '⬡', emojiBg),
    [t.custom_emoji, t.poi_emoji, t.territory_type, emojiBg]
  )

  // Back face texture
  const income = Math.round(t.resource_credits || t.food_per_tick || 10)
  const labelTex = useMemo(() =>
    makeBackTexture(
      cfg.label,
      t.h3_index || '',
      income,
      t.poi_floor_price || null,
      cfg.hex,
      cfg.emissive || '#050510'
    ),
    [cfg.label, cfg.hex, t.h3_index, income, t.poi_floor_price]
  )

  // Front overlay (name + rarity painted on top of image/emoji)
  const cardName = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const cardType = t.poi_category || t.territory_type || 'standard'
  const overlayTex = useMemo(() =>
    makeFrontOverlay(cardName, cardType, cfg.label, cfg.hex),
    [cardName, cardType, cfg.label, cfg.hex]
  )

  const [imgTex, setImgTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!imgUrl) return
    const loader = new THREE.TextureLoader()
    loader.load(imgUrl, tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      setImgTex(tex)
    }, undefined, () => setImgTex(null))
  }, [imgUrl])

  const faceTex = imgTex || emojiTex

  // Materials: [side, side, side, side, front, back]
  const materials = useMemo(() => [
    // Side material — metallic edge
    new THREE.MeshStandardMaterial({
      color: cfg.hex, metalness: cfg.metal + 0.1,
      roughness: Math.max(0, cfg.rough - 0.1), envMapIntensity: cfg.envInt,
    }),
    // Bevel material
    new THREE.MeshStandardMaterial({
      color: cfg.hex, metalness: cfg.metal,
      roughness: cfg.rough, envMapIntensity: cfg.envInt * 0.8,
    }),
    // (unused groups)
    new THREE.MeshStandardMaterial({ color: '#111' }),
    new THREE.MeshStandardMaterial({ color: '#111' }),
    // Front face — image + overlay composited
    new THREE.MeshStandardMaterial({
      map: faceTex,
      alphaMap: overlayTex,
      metalness: cfg.metal * 0.3, roughness: cfg.rough * 0.7,
      envMapIntensity: cfg.envInt * 0.6,
      emissive: new THREE.Color(cfg.emissive),
      emissiveIntensity: 0.25,
    }),
    // Back face
    new THREE.MeshStandardMaterial({
      map: labelTex, metalness: 0.2, roughness: 0.7,
      color: '#111',
    }),
  ], [faceTex, labelTex, overlayTex, cfg])

  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: cfg.hex, metalness: cfg.metal + 0.2,
    roughness: Math.max(0, cfg.rough - 0.2),
    emissive: new THREE.Color(cfg.hex),
    emissiveIntensity: cfg.metal > 0.6 ? 0.6 : 0.1,
    envMapIntensity: cfg.envInt * 1.5,
    side: THREE.DoubleSide,
    transparent: true, opacity: 0.8,
  }), [cfg])

  return (
    <>
      {/* Edge glow ring */}
      <mesh ref={edgeRef} geometry={edgeGeo} material={edgeMat}
        position={[0, 0, -0.02]} />

      {/* Main card body */}
      <mesh ref={meshRef} geometry={geometry} material={materials}
        rotation={[0.08, -0.2, 0]} />
    </>
  )
}

/* ── Point lights ────────────────────────────────────────────── */
function Lights({ color }: { color: string }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 4, 3]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-2, -2, 2]} intensity={0.5} color={color} />
      <pointLight position={[0, 0, 4]} intensity={0.3} color={color} />
      <spotLight position={[0, 5, 3]} intensity={1.5} angle={0.4} penumbra={0.5} color="#ffffff" />
    </>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export function HexCard({ territory: t, onClose, onRequestClaim }: {
  territory: any; onClose: () => void; onRequestClaim: () => void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id

  const rarity = (t.rarity || 'common') as Rarity
  const cfg    = R[rarity] ?? R.common
  const [showSkillTree, setShowSkillTree] = useState(false)

  const cardName = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const cardDesc = t.poi_description || null
  const cardFact = t.poi_fun_fact || null
  const imgUrl   = t.poi_wiki_url || null
  const income   = Math.round(t.resource_credits || t.food_per_tick || 10)
  const cardEmoji = t.custom_emoji || t.poi_emoji || BIOME[t.territory_type||'rural'] || '⬡'
  const cardType  = t.poi_category || t.territory_type || 'rural'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', width: 500, height: 500, pointerEvents: 'none',
        background: `radial-gradient(ellipse 50% 50% at 50% 42%, ${cfg.hex}18 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      {/* Three.js canvas */}
      <div style={{ width: 320, height: 340, cursor: 'grab', zIndex: 1 }}>
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Lights color={cfg.hex} />
            <Environment preset="city" />
            <HexMesh t={t} cfg={cfg} imgUrl={imgUrl} />
          </Suspense>
        </Canvas>
      </div>

      {/* Info panel */}
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
        style={{
          width: 300, background: 'rgba(4,4,12,0.99)',
          border: `1px solid ${cfg.hex}55`, borderRadius: 14,
          boxShadow: `0 0 40px ${cfg.hex}18`, overflow: 'hidden', zIndex: 1,
        }}
      >
        {/* Rarity strip */}
        <div style={{
          padding: '4px 14px',
          background: `linear-gradient(90deg, ${cfg.hex}33, transparent)`,
          borderBottom: `1px solid ${cfg.hex}22`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: cfg.hex,
            letterSpacing: '0.12em', textTransform: 'uppercase' }}>{cfg.label}</span>
          {t.is_shiny && <span style={{ fontSize: 10, color: '#FCD34D', fontWeight: 700 }}>✨ Shiny</span>}
          {t.nft_version > 1 && <span style={{ fontSize: 10, color: '#A78BFA' }}>v{t.nft_version}</span>}
        </div>

        {/* Identity */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${cfg.hex}18` }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{cardEmoji}</span><span>{cardName}</span>
          </div>
          <div style={{ fontSize: 10, color: cfg.hex, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cardType}
          </div>
          {cardDesc && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.55 }}>
              {cardDesc.slice(0,110)}{cardDesc.length > 110 ? '…' : ''}
            </div>
          )}
          {cardFact && (
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3, fontStyle: 'italic' }}>
              💡 {cardFact.slice(0, 90)}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ padding: '7px 14px', display: 'flex', gap: 14, fontSize: 11,
          borderBottom: `1px solid ${cfg.hex}18`, color: '#6B7280' }}>
          <span style={{ color: '#F59E0B' }}>💰 +{income}/tick</span>
          {t.poi_floor_price && <span style={{ color: cfg.hex }}>💎 {t.poi_floor_price} TDI</span>}
          {t.poi_visitors && <span style={{ color: '#10B981' }}>👥 {(t.poi_visitors/1e6).toFixed(1)}M</span>}
          <span>🛡️ {t.defense_tier || 1}★</span>
        </div>

        {/* Owner */}
        {(isOwned || isEnemy) && (
          <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: `1px solid ${cfg.hex}18`,
            background: isOwned ? `${t.border_color||cfg.hex}0d` : 'rgba(239,68,68,0.06)' }}>
            <span style={{ fontSize: 16 }}>{isOwned ? (t.custom_emoji || '🏴') : '👤'}</span>
            <span style={{ fontSize: 12, fontWeight: 700,
              color: isOwned ? (t.border_color||'#00FF87') : '#F87171' }}>
              {isOwned ? 'Your territory' : t.owner_username}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {isFree && player && (
            <button onClick={onRequestClaim} style={{
              padding: '12px', border: 'none', borderRadius: 9, cursor: 'pointer',
              background: `linear-gradient(135deg, ${cfg.hex}cc, ${cfg.hex})`,
              color: ['legendary','mythic','epic'].includes(rarity) ? '#000' : '#fff',
              fontSize: 14, fontWeight: 900,
              boxShadow: cfg.metal > 0.5 ? `0 4px 24px ${cfg.hex}55` : undefined,
            }}>🏴 Claim {cardName.slice(0,22)}</button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              padding: '12px', borderRadius: 9, cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: '#EF4444',
              fontSize: 14, fontWeight: 700,
            }}>⚔️ Attack · 💸 Buy · 🧩 Puzzle</button>
          )}
          {isOwned && (
            <div style={{ display: 'flex', flexDirection:'column', gap: 6 }}>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={onRequestClaim} style={{
                  flex:1, padding:'9px', borderRadius:9, cursor:'pointer',
                  background:`${cfg.hex}14`, border:`1px solid ${cfg.hex}44`,
                  color:cfg.hex, fontSize:11, fontWeight:700,
                }}>💰 Revenus</button>
                <button style={{
                  flex:1, padding:'9px', borderRadius:9, cursor:'pointer',
                  background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)',
                  color:'#A78BFA', fontSize:11, fontWeight:700,
                }}>🎨 Style</button>
              </div>
              <button onClick={() => setShowSkillTree(true)} style={{
                width:'100%', padding:'10px', border:'none', borderRadius:9, cursor:'pointer',
                background:`linear-gradient(135deg, ${cfg.hex}cc, ${cfg.hex})`,
                color: ['legendary','mythic','epic'].includes(rarity) ? '#000':'#fff',
                fontSize:12, fontWeight:900,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
                🔬 Arbre des compétences du royaume
              </button>
            </div>
          )}
          <button onClick={onClose} style={{
            padding: '6px', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 7, cursor: 'pointer', background: 'transparent',
            color: '#374151', fontSize: 10,
          }}>✕ Close</button>
        </div>
      </motion.div>

      <div style={{ fontSize: 9, color: '#1F2937', zIndex: 1 }}>
        Drag to rotate · Spin to flip
      </div>

      <AnimatePresence>
        {showSkillTree && t.owner_kingdom_id && (
          <KingdomSkillTree
            clusterId={t.owner_kingdom_id}
            onClose={() => setShowSkillTree(false)}
          />
        )}
        {showSkillTree && !t.owner_kingdom_id && (
          <KingdomSkillTree
            clusterId={'main'}
            onClose={() => setShowSkillTree(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
