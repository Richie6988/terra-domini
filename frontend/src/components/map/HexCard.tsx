/**
 * HexCard — Hexod collectible territory card.
 * Three.js hex prism with canvas-painted faces.
 * Owned: 3 tabs (Card / Royaume / NFT) + real skill tree.
 */
import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

if (typeof window !== 'undefined') {
  const _w = console.warn
  console.warn = (...a: any[]) => { if (String(a[0]).includes('THREE.Clock')) return; _w(...a) }
}

/* ── Rarity ────────────────────────────────────────────────── */
const R: Record<string, { c:string; glow:string; bg:string; accent:string; label:string; grade:string }> = {
  common:   { c:'#9CA3AF', glow:'none',                                     bg:'#0d0f18', accent:'#E5E7EB', label:'Common',    grade:'F' },
  uncommon: { c:'#10B981', glow:'0 0 30px #10B98166',                        bg:'#04100a', accent:'#34D399', label:'Uncommon',  grade:'C' },
  rare:     { c:'#3B82F6', glow:'0 0 38px #3B82F677',                        bg:'#030a1a', accent:'#93C5FD', label:'Rare',      grade:'B' },
  epic:     { c:'#8B5CF6', glow:'0 0 44px #8B5CF688',                        bg:'#07030f', accent:'#C4B5FD', label:'Epic',      grade:'A' },
  legendary:{ c:'#F59E0B', glow:'0 0 56px #F59E0BAA,0 0 100px #F59E0B33',   bg:'#0f0700', accent:'#FCD34D', label:'Legendary', grade:'S' },
  mythic:   { c:'#EC4899', glow:'0 0 66px #EC4899BB,0 0 120px #EC489933',    bg:'#0f0008', accent:'#F9A8D4', label:'Mythic ✦',  grade:'SS' },
}
type RK = keyof typeof R

/* ── Biome resources ───────────────────────────────────────── */
const BIOME_RES: Record<string, { res:string; icon:string; amount:number }[]> = {
  urban:    [{res:'Données',icon:'📊',amount:12},{res:'Influence',icon:'🌐',amount:8},{res:'Main-d\'œuvre',icon:'👷',amount:15}],
  rural:    [{res:'Nourriture',icon:'🌾',amount:20},{res:'Eau',icon:'💧',amount:15},{res:'Main-d\'œuvre',icon:'👷',amount:10}],
  forest:   [{res:'Nourriture',icon:'🌾',amount:15},{res:'Eau',icon:'💧',amount:12},{res:'Stabilité',icon:'⚖️',amount:8}],
  mountain: [{res:'Fer',icon:'🪨',amount:18},{res:'Titanium',icon:'🔷',amount:5},{res:'Charbon',icon:'⬛',amount:10}],
  coastal:  [{res:'Nourriture',icon:'🌾',amount:12},{res:'Eau',icon:'💧',amount:20},{res:'Gaz',icon:'💨',amount:8}],
  desert:   [{res:'Pétrole',icon:'🛢️',amount:15},{res:'Silicium',icon:'💠',amount:10},{res:'Terres rares',icon:'💎',amount:4}],
  tundra:   [{res:'Gaz',icon:'💨',amount:12},{res:'Uranium',icon:'☢️',amount:3},{res:'Eau',icon:'💧',amount:8}],
  industrial:[{res:'Acier',icon:'⚙️',amount:15},{res:'Composants',icon:'🔌',amount:8},{res:'Pétrole',icon:'🛢️',amount:10}],
  landmark: [{res:'Données',icon:'📊',amount:10},{res:'Influence',icon:'🌐',amount:12},{res:'Stabilité',icon:'⚖️',amount:10}],
  grassland:[{res:'Nourriture',icon:'🌾',amount:18},{res:'Main-d\'œuvre',icon:'👷',amount:8},{res:'Stabilité',icon:'⚖️',amount:6}],
}

/* ── Canvas face painter ───────────────────────────────────── */
function paintFront(cfg: typeof R[RK], name: string, facts: string[], grade: string, imgUrl: string|null, isShiny: boolean): HTMLCanvasElement {
  const W=512, H=512, cv = document.createElement('canvas')
  cv.width=W; cv.height=H
  const ctx = cv.getContext('2d')!

  // Background gradient
  const grad = ctx.createLinearGradient(0,0,0,H)
  grad.addColorStop(0, cfg.bg)
  grad.addColorStop(1, '#030308')
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H)

  // Shiny foil
  if (isShiny) {
    const foil = ctx.createLinearGradient(0,0,W,H)
    foil.addColorStop(0, 'transparent')
    foil.addColorStop(0.4, cfg.c+'22')
    foil.addColorStop(0.5, '#FFD70033')
    foil.addColorStop(0.6, cfg.c+'22')
    foil.addColorStop(1, 'transparent')
    ctx.fillStyle = foil; ctx.fillRect(0,0,W,H)
  }

  // Rarity banner
  ctx.fillStyle = cfg.c+'33'; ctx.fillRect(0,0,W,52)
  ctx.font='bold 22px system-ui'; ctx.fillStyle=cfg.c; ctx.textAlign='center'
  ctx.fillText(cfg.label.toUpperCase(), W/2, 34)
  if (isShiny) { ctx.font='13px system-ui'; ctx.fillStyle='#FCD34D'; ctx.fillText('✨ SHINY', W-60, 34) }

  // Grade badge
  ctx.font='bold 18px system-ui'; ctx.fillStyle='#000'
  ctx.beginPath(); ctx.arc(40, 26, 20, 0, Math.PI*2)
  ctx.fillStyle=cfg.c; ctx.fill()
  ctx.font='bold 16px system-ui'; ctx.fillStyle='#000'; ctx.textAlign='center'
  ctx.fillText(grade, 40, 32)

  // Image zone (half height)
  if (imgUrl) {
    // Will be applied as map texture — signal with color block for now
    ctx.fillStyle = cfg.c+'11'; ctx.fillRect(0,52,W,200)
    // Overlay gradient
    const ov = ctx.createLinearGradient(0,200,0,252)
    ov.addColorStop(0,'transparent'); ov.addColorStop(1,cfg.bg+'ff')
    ctx.fillStyle=ov; ctx.fillRect(0,52,W,200)
  } else {
    // Biome color block
    ctx.fillStyle = cfg.c+'18'; ctx.fillRect(0,52,W,200)
    ctx.font='80px serif'; ctx.textAlign='center'
    ctx.fillText('⬡', W/2, 175)
  }

  // Name
  ctx.font='bold 28px system-ui'; ctx.fillStyle='#ffffff'; ctx.textAlign='center'
  ctx.fillText(name.slice(0,22), W/2, 278)

  // Divider
  ctx.strokeStyle=cfg.c+'66'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(40,295); ctx.lineTo(W-40,295); ctx.stroke()

  // 3 facts
  ctx.font='13px system-ui'; ctx.fillStyle=cfg.accent; ctx.textAlign='left'
  facts.slice(0,3).forEach((f,i) => {
    ctx.fillStyle=cfg.c; ctx.fillText(`${i+1}`, 36, 320+i*52)
    ctx.fillStyle=cfg.accent
    const words = f.split(' '); let line='', y=320+i*52
    words.forEach(w => {
      const t = line ? line+' '+w : w
      if (ctx.measureText(t).width > 400) { ctx.fillText(line, 52, y); line=w; y+=16 }
      else line=t
    })
    ctx.fillText(line, 52, y)
  })

  // Bottom border
  ctx.strokeStyle=cfg.c; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(0,500); ctx.lineTo(W,500); ctx.stroke()
  ctx.font='10px monospace'; ctx.fillStyle=cfg.c+'88'; ctx.textAlign='right'
  ctx.fillText('HEXOD · SAISON 1', W-20, 510)

  return cv
}

function paintBack(cfg: typeof R[RK], h3index: string, income: number, floorPrice: number|null, isShiny: boolean): HTMLCanvasElement {
  const W=512, H=512, cv = document.createElement('canvas')
  cv.width=W; cv.height=H
  const ctx = cv.getContext('2d')!

  // Background
  if (isShiny) {
    const g = ctx.createLinearGradient(0,0,W,H)
    g.addColorStop(0, cfg.bg); g.addColorStop(0.3, cfg.c+'44')
    g.addColorStop(0.5, '#FFD70022'); g.addColorStop(0.7, cfg.c+'44'); g.addColorStop(1, cfg.bg)
    ctx.fillStyle=g
  } else {
    ctx.fillStyle = ctx.createLinearGradient(0,0,0,H)
    ;(ctx.fillStyle as CanvasGradient).addColorStop(0, cfg.bg)
    ;(ctx.fillStyle as CanvasGradient).addColorStop(1, '#020205')
  }
  ctx.fillRect(0,0,W,H)

  // Hex pattern watermark
  ctx.globalAlpha=0.07; ctx.font='42px monospace'; ctx.fillStyle=cfg.c; ctx.textAlign='center'
  for (let y=50; y<H; y+=68) for (let x=(y%136<68?50:95); x<W; x+=90) ctx.fillText('⬡', x, y)
  ctx.globalAlpha=1

  // Big hex logo
  ctx.font='72px monospace'; ctx.fillStyle=cfg.c; ctx.textAlign='center'; ctx.fillText('⬡', W/2, 195)
  ctx.font='bold 36px system-ui'; ctx.fillStyle=cfg.accent; ctx.fillText('HEXOD', W/2, 260)

  // Divider
  ctx.strokeStyle=cfg.c+'55'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(60,280); ctx.lineTo(W-60,280); ctx.stroke()

  // Stats
  ctx.font='15px system-ui'; ctx.fillStyle=cfg.accent; ctx.textAlign='center'
  ctx.fillText(`+${income} HEX Coin / jour`, W/2, 316)
  if (floorPrice) { ctx.fillStyle=cfg.c; ctx.fillText(`💎 Floor ${floorPrice} HEX`, W/2, 342) }

  // H3 index
  ctx.font='11px monospace'; ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.textAlign='center'
  ctx.fillText(h3index.slice(0,18), W/2, 390)

  // Footer
  ctx.font='12px system-ui'; ctx.fillStyle=cfg.c+'66'; ctx.fillText('Saison 1 · Édition Genèse', W/2, 460)

  return cv
}

/* ── 3D Hex Prism ──────────────────────────────────────────── */
function HexPrism({ frontCanvas, backCanvas, imgUrl, cfg, showBack }: {
  frontCanvas: HTMLCanvasElement; backCanvas: HTMLCanvasElement
  imgUrl: string|null; cfg: typeof R[RK]; showBack: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const velY = useRef(-0.28)
  const velX = useRef(0)
  const { gl } = useThree()

  // Drag
  useEffect(() => {
    const c = gl.domElement
    let drag=false, lx=0, ly=0
    const pd=(e:PointerEvent)=>{ drag=true; lx=e.clientX; ly=e.clientY; velY.current=0; velX.current=0 }
    const pm=(e:PointerEvent)=>{ if(!drag) return; velY.current=(e.clientX-lx)*0.022; velX.current=-(e.clientY-ly)*0.013; lx=e.clientX; ly=e.clientY }
    const pu=()=>{ drag=false }
    c.addEventListener('pointerdown',pd); window.addEventListener('pointermove',pm); window.addEventListener('pointerup',pu)
    return ()=>{ c.removeEventListener('pointerdown',pd); window.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu) }
  }, [gl])

  useFrame(() => {
    velY.current *= 0.93; velX.current *= 0.93
    groupRef.current.rotation.y += velY.current
    groupRef.current.rotation.x = Math.max(-0.75, Math.min(0.75, groupRef.current.rotation.x + velX.current))
  })

  const hexShape = useMemo(() => {
    const s = new THREE.Shape()
    for (let i=0;i<6;i++) { const a=(Math.PI/3)*i-Math.PI/6; i===0?s.moveTo(1.5*Math.cos(a),1.5*Math.sin(a)):s.lineTo(1.5*Math.cos(a),1.5*Math.sin(a)) }
    s.closePath(); return s
  }, [])

  const geo = useMemo(() => new THREE.ExtrudeGeometry(hexShape, {
    depth:0.24, bevelEnabled:true, bevelThickness:0.06, bevelSize:0.05, bevelSegments:5,
  }), [hexShape])

  const frontTex = useMemo(() => new THREE.CanvasTexture(frontCanvas), [frontCanvas])
  const backTex  = useMemo(() => new THREE.CanvasTexture(backCanvas),  [backCanvas])

  const [imgTex, setImgTex] = useState<THREE.Texture|null>(null)
  useEffect(() => {
    if (!imgUrl) return
    new THREE.TextureLoader().load(imgUrl, tex => { tex.colorSpace=THREE.SRGBColorSpace; setImgTex(tex) }, undefined, ()=>setImgTex(null))
  }, [imgUrl])

  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color:cfg.c, metalness:0.85, roughness:0.15, envMapIntensity:1.4 })
    const bevel = new THREE.MeshStandardMaterial({ color:cfg.c, metalness:0.7, roughness:0.2, envMapIntensity:1.0 })
    const front = new THREE.MeshStandardMaterial({
      map: imgTex ? blendTextures(imgTex, frontTex) : frontTex,
      metalness:0.1, roughness:0.55, envMapIntensity:0.6,
    })
    const back = new THREE.MeshStandardMaterial({
      map: backTex, metalness:0.85, roughness:0.08, envMapIntensity:2.2,
    })
    return [side, bevel, new THREE.MeshStandardMaterial({color:'#111'}), new THREE.MeshStandardMaterial({color:'#111'}), front, back]
  }, [imgTex, frontTex, backTex, cfg])

  return (
    <group ref={groupRef} rotation={[0.08, showBack ? Math.PI : -0.12, 0]}>
      <mesh geometry={geo} material={mats} />
      <pointLight position={[0,0,3.5]} intensity={0.7} color={cfg.c} />
    </group>
  )
}

function blendTextures(img: THREE.Texture, overlay: THREE.Texture): THREE.Texture {
  // Return image texture — overlay info is painted via canvas
  return img
}

/* ── Skill Tree ────────────────────────────────────────────── */
const SKILLS_LAYOUT = {
  // Central node
  center: { x:0, y:0, label:'⬡ Hexod', color:'#F59E0B' },
  branches: [
    { id:'attack',    angle:-90,  color:'#EF4444', label:'⚔️',  longLabel:'Attaque'     },
    { id:'defense',   angle:-30,  color:'#3B82F6', label:'🛡️',  longLabel:'Défense'     },
    { id:'economy',   angle: 30,  color:'#F59E0B', label:'💰',  longLabel:'Économie'    },
    { id:'influence', angle: 90,  color:'#10B981', label:'🌐',  longLabel:'Rayonnement' },
    { id:'tech',      angle:150,  color:'#8B5CF6', label:'🔬',  longLabel:'Tech'        },
  ]
}

function RealSkillTree({ clusterId, cfg, onClose }: { clusterId:string; cfg:typeof R[RK]; onClose:()=>void }) {
  const qc = useQueryClient()
  const [hoveredSkill, setHoveredSkill] = useState<number|null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string|null>(null)

  const { data } = useQuery({
    queryKey: ['kingdom-skills', clusterId],
    queryFn: () => api.get(`/territories-geo/kingdom-skill-tree/?cluster_id=${clusterId}`).then(r => r.data),
    staleTime: 15000,
  })

  const unlock = useMutation({
    mutationFn: (id:number) => api.post('/territories-geo/kingdom-unlock-skill/', { cluster_id:clusterId, skill_id:id }),
    onSuccess: () => { toast.success('Compétence débloquée!'); qc.invalidateQueries({queryKey:['kingdom-skills',clusterId]}) },
    onError: (e:any) => toast.error(e?.response?.data?.error || 'Ressources insuffisantes'),
  })

  const tree: Record<string,any[]> = data?.tree || {}
  const kingdom = data?.kingdom || {}

  // SVG tree dimensions
  const W=560, H=420, cx=W/2, cy=H/2
  const BRANCH_R = 150  // radius to branch root nodes
  const NODE_R   = 22   // branch root node radius
  const SKILL_R  = 16   // skill node radius
  const SKILL_SPACING = 58  // distance between skills along branch

  return (
    <motion.div
      initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.92}}
      style={{ position:'fixed', inset:0, zIndex:1300, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.88)', backdropFilter:'blur(16px)', padding:'12px' }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{ width:'100%', maxWidth:600, background:'rgba(4,4,12,0.99)',
        border:`2px solid ${cfg.c}44`, borderRadius:18,
        display:'flex', flexDirection:'column', overflow:'hidden', maxHeight:'90vh' }}>

        {/* Header */}
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${cfg.c}22`,
          background:`linear-gradient(90deg,${cfg.c}18,transparent)`,
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🔬 Arbre des Compétences</div>
            <div style={{ fontSize:10, color:cfg.c }}>
              {kingdom.is_main?'👑 Royaume Principal':'🏴 Territoire Isolé'} · {data?.unlocked_count||0}/{Object.values(tree).reduce((s:number,v:any[])=>s+v.length,0)} compétences
            </div>
          </div>
          {/* Kingdom resources */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', flex:1, justifyContent:'center', margin:'0 12px' }}>
            {kingdom.resources && Object.entries({
              '🪨':kingdom.resources.fer, '🛢️':kingdom.resources.petrole,
              '💠':kingdom.resources.silicium, '📊':kingdom.resources.donnees,
              '💎':kingdom.resources.hex_cristaux
            }).filter(([,v])=>(v as number)>0).map(([icon,val])=>(
              <div key={icon} style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                background:'rgba(255,255,255,0.06)', color:'#9CA3AF' }}>
                {icon} {Math.round(val as number)}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* SVG Tree */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block', margin:'0 auto' }}>
            <defs>
              {SKILLS_LAYOUT.branches.map(b => (
                <filter key={b.id} id={`glow-${b.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              ))}
            </defs>

            {/* Branch lines + nodes */}
            {SKILLS_LAYOUT.branches.map(branch => {
              const rad = (branch.angle * Math.PI) / 180
              const bx = cx + Math.cos(rad) * BRANCH_R
              const by = cy + Math.sin(rad) * BRANCH_R
              const skills = tree[branch.id] || []
              const isSelected = selectedBranch === branch.id

              return (
                <g key={branch.id}>
                  {/* Center → branch line */}
                  <line x1={cx} y1={cy} x2={bx} y2={by}
                    stroke={branch.color} strokeWidth={isSelected?2.5:1.5} strokeOpacity={isSelected?0.9:0.4}
                    strokeDasharray={isSelected?'':'4,3'} />

                  {/* Branch root node */}
                  <circle cx={bx} cy={by} r={NODE_R} fill={`${branch.color}22`}
                    stroke={branch.color} strokeWidth={isSelected?2.5:1.5}
                    filter={isSelected?`url(#glow-${branch.id})`:undefined}
                    style={{ cursor:'pointer' }}
                    onClick={() => setSelectedBranch(s => s===branch.id?null:branch.id)} />
                  <text x={bx} y={by+1} textAnchor="middle" dominantBaseline="central"
                    fontSize={16} style={{ pointerEvents:'none' }}>{branch.label}</text>
                  <text x={bx} y={by+NODE_R+12} textAnchor="middle"
                    fontSize={9} fill={branch.color} fontWeight={700} style={{ pointerEvents:'none' }}>
                    {branch.longLabel}
                  </text>

                  {/* Skill nodes along branch */}
                  {isSelected && skills.map((s:any, i:number) => {
                    const dist = BRANCH_R + NODE_R + 14 + i * SKILL_SPACING
                    const sx = cx + Math.cos(rad) * dist
                    const sy = cy + Math.sin(rad) * dist
                    const prevDist = i===0 ? BRANCH_R : BRANCH_R + NODE_R + 14 + (i-1)*SKILL_SPACING
                    const px = cx + Math.cos(rad) * prevDist
                    const py = cy + Math.sin(rad) * prevDist
                    const isHover = hoveredSkill === s.id

                    return (
                      <g key={s.id}>
                        {/* Connector */}
                        <line x1={px} y1={py} x2={sx} y2={sy}
                          stroke={branch.color} strokeWidth={1.5}
                          strokeOpacity={s.unlocked?0.8:0.25}
                          strokeDasharray={s.unlocked?'':'3,3'} />

                        {/* Skill circle */}
                        <circle cx={sx} cy={sy} r={SKILL_R}
                          fill={s.unlocked ? `${branch.color}33` : 'rgba(20,20,30,0.9)'}
                          stroke={branch.color} strokeWidth={s.unlocked?2:1}
                          strokeOpacity={s.unlocked?1:0.4}
                          filter={s.unlocked?`url(#glow-${branch.id})`:undefined}
                          style={{ cursor:'pointer' }}
                          onMouseEnter={()=>setHoveredSkill(s.id)}
                          onMouseLeave={()=>setHoveredSkill(null)} />

                        {/* Icon */}
                        <text x={sx} y={sy+1} textAnchor="middle" dominantBaseline="central"
                          fontSize={13} style={{ pointerEvents:'none' }}>{s.icon}</text>

                        {/* Unlock checkmark */}
                        {s.unlocked && (
                          <text x={sx+SKILL_R-4} y={sy-SKILL_R+4} textAnchor="middle"
                            dominantBaseline="central" fontSize={9} fill="#00FF87" fontWeight={900}
                            style={{ pointerEvents:'none' }}>✓</text>
                        )}

                        {/* Hover tooltip */}
                        {isHover && (
                          <g>
                            <rect x={sx-80} y={sy-56} width={160} height={48} rx={6}
                              fill="rgba(4,4,16,0.97)" stroke={branch.color} strokeWidth={1} />
                            <text x={sx} y={sy-42} textAnchor="middle" fontSize={10} fontWeight={700}
                              fill="#fff">{s.name.slice(0,22)}</text>
                            <text x={sx} y={sy-26} textAnchor="middle" fontSize={8.5}
                              fill={branch.color}>{s.effect.slice(0,30)}</text>
                            <text x={sx} y={sy-13} textAnchor="middle" fontSize={8}
                              fill="#6B7280">{s.cost_json.slice(0,3).join(' · ')}</text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* Center node */}
            <circle cx={cx} cy={cy} r={32} fill="rgba(245,158,11,0.15)"
              stroke="#F59E0B" strokeWidth={2.5} />
            <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central"
              fontSize={26} fontWeight={900} fill="#F59E0B">⬡</text>
            <text x={cx} y={cy+42} textAnchor="middle" fontSize={9}
              fill="#F59E0B" fontWeight={700}>HEXOD</text>
          </svg>

          {/* Selected branch skill list */}
          {selectedBranch && (() => {
            const branch = SKILLS_LAYOUT.branches.find(b => b.id === selectedBranch)!
            const skills = tree[selectedBranch] || []
            return (
              <div style={{ padding:'0 16px 16px' }}>
                <div style={{ fontSize:11, fontWeight:800, color:branch.color, marginBottom:8 }}>
                  {branch.label} {branch.longLabel} — {skills.filter((s:any)=>s.unlocked).length}/{skills.length} débloquées
                </div>
                {skills.map((s:any) => (
                  <div key={s.id} style={{ display:'flex', gap:10, padding:'9px 12px', marginBottom:5, borderRadius:9,
                    background: s.unlocked ? `${branch.color}0f` : 'rgba(255,255,255,0.03)',
                    border:`1px solid ${s.unlocked ? branch.color+'33' : 'rgba(255,255,255,0.07)'}` }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{s.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:s.unlocked?'#fff':'#9CA3AF' }}>{s.name}</div>
                      <div style={{ fontSize:10, color:s.unlocked?branch.color:'#6B7280' }}>{s.effect}</div>
                      {!s.unlocked && (
                        <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                          {s.cost_json.map((c:string)=>(
                            <span key={c} style={{ fontSize:9, padding:'2px 6px', borderRadius:4,
                              background:'rgba(255,255,255,0.06)', color:'#9CA3AF' }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {s.unlocked
                      ? <div style={{ width:24,height:24,borderRadius:'50%',background:branch.color,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:11,fontWeight:900,color:'#000',flexShrink:0 }}>✓</div>
                      : kingdom.is_main
                      ? <button onClick={()=>unlock.mutate(s.id)} disabled={unlock.isPending} style={{
                          padding:'5px 10px',border:'none',borderRadius:7,cursor:'pointer',flexShrink:0,
                          background:`linear-gradient(135deg,${branch.color}cc,${branch.color})`,
                          color:'#000',fontSize:10,fontWeight:900,
                        }}>{unlock.isPending?'…':'Unlock'}</button>
                      : <span style={{fontSize:14}}>🔒</span>
                    }
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Main HexCard ──────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim }:{
  territory:any; onClose:()=>void; onRequestClaim:()=>void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const rarity  = (t.rarity || 'common') as RK
  const isShiny = !!t.is_shiny
  const cfg     = R[rarity] ?? R.common

  const cardName = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const imgUrl   = t.poi_wiki_url || null
  const income   = Math.round((t.resource_credits || t.food_per_tick || 10) * 288) // /jour
  const biomeRes = BIOME_RES[t.territory_type || 'rural'] || BIOME_RES.rural

  const facts = useMemo(() => {
    const r = []
    if (t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visiteurs / an`)
    if (t.poi_geo_score) r.push(`Score géopolitique : ${t.poi_geo_score}/100`)
    if (t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,80))
    if (t.poi_description && r.length<3) r.push(t.poi_description.slice(0,80))
    while (r.length<3) r.push('Territoire unique · Hexod Saison 1')
    return r.slice(0,3)
  }, [t])

  const frontCanvas = useMemo(() => paintFront(cfg, cardName, facts, cfg.grade, imgUrl, isShiny), [cfg, cardName, facts, imgUrl, isShiny])
  const backCanvas  = useMemo(() => paintBack(cfg, t.h3_index||'', income, t.poi_floor_price||null, isShiny), [cfg, t.h3_index, income, t.poi_floor_price, isShiny])

  const [tab, setTab]         = useState<'card'|'kingdom'|'nft'>('card')
  const [showBack, setShowBack]     = useState(false)
  const [showSkillTree, setShowSkillTree] = useState(false)

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:'fixed',inset:0,zIndex:1200,display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:12,
        background:'rgba(0,0,0,0.92)',backdropFilter:'blur(20px)',padding:'10px' }}
    >
      {cfg.glow!=='none' && (
        <div style={{ position:'absolute',width:440,height:440,pointerEvents:'none',
          background:`radial-gradient(ellipse 55% 55% at 50% 42%,${cfg.c}1a 0%,transparent 70%)`,
          filter:'blur(50px)' }} />
      )}

      {/* Three.js canvas */}
      <div style={{ width:250,height:280,cursor:'grab',zIndex:1,flexShrink:0 }}>
        <Canvas camera={{position:[0,0,4.0],fov:44}} gl={{antialias:true,alpha:true}} style={{background:'transparent'}}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.35} />
            <pointLight position={[3,4,3]} intensity={1.6} />
            <pointLight position={[-2,-2,2]} intensity={0.5} color={cfg.c} />
            <Environment preset="city" />
            <HexPrism frontCanvas={frontCanvas} backCanvas={backCanvas} imgUrl={imgUrl} cfg={cfg} showBack={showBack} />
          </Suspense>
        </Canvas>
      </div>

      {/* Card label + flip */}
      <div style={{ display:'flex',alignItems:'center',gap:10,zIndex:1 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:14,fontWeight:900,color:'#fff' }}>{cardName}</div>
          <div style={{ display:'flex',gap:4,justifyContent:'center',marginTop:3 }}>
            <Chip color={cfg.c}>{cfg.label}</Chip>
            {isShiny&&<Chip color="#FCD34D">✨ Shiny</Chip>}
            <Chip color={cfg.c} big>Grade {cfg.grade}</Chip>
          </div>
        </div>
        <button onClick={()=>setShowBack(v=>!v)} style={{
          padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,
          background:`${cfg.c}18`,border:`1px solid ${cfg.c}44`,color:cfg.c,flexShrink:0,
        }}>{showBack?'🃏 Face':'🔄 Dos'}</button>
      </div>

      {/* Info panel */}
      {isOwned ? (
        <div style={{ width:310,background:'rgba(4,4,12,0.99)',border:`1px solid ${cfg.c}44`,
          borderRadius:14,overflow:'hidden',zIndex:1,maxHeight:'42vh',display:'flex',flexDirection:'column' }}>
          <div style={{ display:'flex',borderBottom:`1px solid ${cfg.c}22`,flexShrink:0 }}>
            {(['card','kingdom','nft'] as const).map(tb=>(
              <button key={tb} onClick={()=>setTab(tb)} style={{
                flex:1,padding:'8px 0',border:'none',cursor:'pointer',
                fontSize:10,fontWeight:tab===tb?800:400,
                background:tab===tb?`${cfg.c}14`:'transparent',
                borderBottom:`2px solid ${tab===tb?cfg.c:'transparent'}`,
                color:tab===tb?cfg.c:'#4B5563',
              }}>{tb==='card'?'🃏 Carte':tb==='kingdom'?'⚗️ Royaume':'💎 NFT'}</button>
            ))}
          </div>
          <div style={{ flex:1,overflowY:'auto',padding:'12px 14px' }}>
            {tab==='card' && (
              <div>
                {imgUrl&&<img src={imgUrl} alt={cardName}
                  style={{width:'100%',height:70,objectFit:'cover',borderRadius:7,marginBottom:8}}
                  onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />}
                <div style={{marginBottom:8,padding:'8px 10px',borderRadius:8,background:`${cfg.c}0e`,border:`1px solid ${cfg.c}22`}}>
                  <div style={{fontSize:10,fontWeight:800,color:cfg.accent,marginBottom:5}}>Caractéristiques</div>
                  {facts.map((f,i)=>(
                    <div key={i} style={{display:'flex',gap:5,marginBottom:4}}>
                      <span style={{color:cfg.c,fontWeight:700,flexShrink:0}}>#{i+1}</span>
                      <span style={{fontSize:10,color:'#9CA3AF',lineHeight:1.4}}>{f}</span>
                    </div>
                  ))}
                </div>
                <KV label="H3 Index" val={(t.h3_index||'').slice(0,16)+'…'} mono />
                <KV label="Grade" val={cfg.grade} color={cfg.c} />
              </div>
            )}
            {tab==='kingdom' && (
              <div>
                <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Production / jour</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5,marginBottom:10}}>
                  {biomeRes.map(r=>(
                    <div key={r.res} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'7px 8px',textAlign:'center'}}>
                      <div style={{fontSize:14}}>{r.icon}</div>
                      <div style={{fontSize:11,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{r.amount*288}</div>
                      <div style={{fontSize:8,color:'#4B5563',marginTop:1}}>{r.res.slice(0,12)}</div>
                    </div>
                  ))}
                  <div style={{background:`${cfg.c}0e`,borderRadius:7,padding:'7px 8px',textAlign:'center',border:`1px solid ${cfg.c}22`}}>
                    <div style={{fontSize:14}}>💠</div>
                    <div style={{fontSize:11,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{income}</div>
                    <div style={{fontSize:8,color:cfg.c,marginTop:1}}>HEX Coin</div>
                  </div>
                </div>
                <button onClick={()=>setShowSkillTree(true)} style={{
                  width:'100%',padding:'11px',border:'none',borderRadius:9,cursor:'pointer',
                  background:`linear-gradient(135deg,${cfg.c}cc,${cfg.c})`,
                  color:['legendary','mythic','epic'].includes(rarity)?'#000':'#fff',
                  fontSize:12,fontWeight:900,
                }}>🔬 Arbre des Compétences →</button>
              </div>
            )}
            {tab==='nft' && (
              <div>
                <div style={{padding:'10px 12px',background:'rgba(139,92,246,0.08)',borderRadius:10,border:'1px solid rgba(139,92,246,0.2)',marginBottom:10}}>
                  <KV label="Token ID" val={t.token_id||`HEX-${(t.h3_index||'').slice(0,8).toUpperCase()}`} mono />
                  <KV label="H3 Index" val={(t.h3_index||'').slice(0,18)+'…'} mono />
                  <KV label="Édition" val="Genèse · Saison 1" />
                  <KV label="Rareté" val={cfg.label} color={cfg.c} />
                  <KV label="Grade" val={cfg.grade} color={cfg.c} />
                  {isShiny&&<KV label="Shiny" val="✨ 1/64 — Rarissime" color="#FCD34D" />}
                  {t.poi_floor_price&&<KV label="Floor" val={`${t.poi_floor_price} HEX`} color={cfg.c} />}
                </div>
                <div style={{display:'flex',gap:7}}>
                  <button style={{flex:1,padding:'9px',border:`1px solid ${cfg.c}44`,borderRadius:8,cursor:'pointer',background:`${cfg.c}14`,color:cfg.c,fontSize:11,fontWeight:700}}>💎 Minter</button>
                  <button style={{flex:1,padding:'9px',border:'1px solid rgba(59,130,246,0.35)',borderRadius:8,cursor:'pointer',background:'rgba(59,130,246,0.1)',color:'#60A5FA',fontSize:11,fontWeight:700}}>🏪 Marketplace</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{width:290,background:'rgba(4,4,12,0.99)',border:`1px solid ${cfg.c}44`,borderRadius:14,padding:'12px 14px',zIndex:1}}>
          {t.poi_description&&<div style={{fontSize:11,color:'#9CA3AF',marginBottom:10,lineHeight:1.5}}>{t.poi_description.slice(0,110)}{t.poi_description.length>110?'…':''}</div>}
          <div style={{display:'flex',gap:10,marginBottom:12,fontSize:11}}>
            <span style={{color:'#F59E0B'}}>💰 +{income} HEX Coin/jour</span>
            {t.poi_floor_price&&<span style={{color:cfg.c}}>💎 {t.poi_floor_price} HEX</span>}
            {isEnemy&&<span style={{color:'#F87171'}}>👤 {t.owner_username}</span>}
          </div>
          {isFree&&player&&(
            <button onClick={onRequestClaim} style={{
              width:'100%',padding:'12px',border:'none',borderRadius:10,cursor:'pointer',
              background:`linear-gradient(135deg,${cfg.c}cc,${cfg.c})`,
              color:['legendary','mythic','epic'].includes(rarity)?'#000':'#fff',
              fontSize:14,fontWeight:900,
              boxShadow:cfg.glow!=='none'?`0 4px 24px ${cfg.c}55`:undefined,
            }}>🏴 Revendiquer {cardName.slice(0,20)}</button>
          )}
          {isEnemy&&(
            <button onClick={onRequestClaim} style={{
              width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.1)',
              color:'#EF4444',fontSize:13,fontWeight:700,
            }}>⚔️ Attaquer · 💸 Acheter · 🧩 Puzzle</button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showSkillTree&&(
          <RealSkillTree clusterId={t.owner_kingdom_id||'main'} cfg={cfg} onClose={()=>setShowSkillTree(false)} />
        )}
      </AnimatePresence>

      <div style={{fontSize:9,color:'#1F2937',zIndex:1}}>Glisser pour tourner · Cliquer hors pour fermer</div>
    </motion.div>
  )
}

function Chip({children,color,big}:any) {
  return <span style={{fontSize:big?11:9,padding:big?'3px 9px':'2px 6px',borderRadius:4,background:`${color}18`,color,border:`1px solid ${color}33`,fontWeight:700}}>{children}</span>
}
function KV({label,val,color,mono}:any) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:11}}>
      <span style={{color:'#6B7280'}}>{label}</span>
      <span style={{color:color||'#E5E7EB',fontWeight:600,fontFamily:mono?'monospace':undefined}}>{val}</span>
    </div>
  )
}
