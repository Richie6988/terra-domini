/**
 * HexCard — Hexod collectible territory card.
 *
 * Architecture Three.js:
 *   - Prism (ExtrudeGeometry, 1 material: sides)
 *   - Front flat hex (ShapeGeometry, canvas texture with all text)
 *   - Back flat hex  (ShapeGeometry, shiny canvas texture)
 *
 * Owned tabs:
 *   🃏 Carte   — Pokémon-style card info
 *   🔬 Royaume — Resources + radial skill tree (always fully deployed)
 *   💎 NFT     — Token, marketplace
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

/* ── Rarity ─────────────────────────────────────────────── */
const RARITY: Record<string, { c:string; bg:string; accent:string; label:string; grade:string; metalness:number; roughness:number }> = {
  common:   { c:'#9CA3AF', bg:'#0d0f18', accent:'#E5E7EB', label:'Common',    grade:'F',  metalness:0.1, roughness:0.9 },
  uncommon: { c:'#10B981', bg:'#04100a', accent:'#34D399', label:'Uncommon',  grade:'C',  metalness:0.3, roughness:0.7 },
  rare:     { c:'#3B82F6', bg:'#030a1a', accent:'#93C5FD', label:'Rare',      grade:'B',  metalness:0.5, roughness:0.5 },
  epic:     { c:'#8B5CF6', bg:'#07030f', accent:'#C4B5FD', label:'Epic',      grade:'A',  metalness:0.7, roughness:0.3 },
  legendary:{ c:'#F59E0B', bg:'#0f0700', accent:'#FCD34D', label:'Legendary', grade:'S',  metalness:0.9, roughness:0.1 },
  mythic:   { c:'#EC4899', bg:'#0f0008', accent:'#F9A8D4', label:'Mythic ✦',  grade:'SS', metalness:0.95,roughness:0.05 },
}
type RK = keyof typeof RARITY

/* ── Biome resources ─────────────────────────────────────── */
const BIOME_RES: Record<string, { res:string; icon:string; base:number }[]> = {
  urban:    [{res:'Données',    icon:'📊',amount:12},{res:'Influence', icon:'🌐',amount:8},{res:'Main-d\'œuvre',icon:'👷',amount:15}],
  rural:    [{res:'Nourriture', icon:'🌾',amount:20},{res:'Eau',       icon:'💧',amount:15},{res:'Main-d\'œuvre',icon:'👷',amount:10}],
  forest:   [{res:'Nourriture', icon:'🌾',amount:15},{res:'Eau',       icon:'💧',amount:12},{res:'Stabilité',   icon:'⚖️',amount:8}],
  mountain: [{res:'Fer',        icon:'🪨',amount:18},{res:'Titanium',  icon:'🔷',amount:5},{res:'Charbon',      icon:'⬛',amount:10}],
  coastal:  [{res:'Nourriture', icon:'🌾',amount:12},{res:'Eau',       icon:'💧',amount:20},{res:'Gaz',         icon:'💨',amount:8}],
  desert:   [{res:'Pétrole',    icon:'🛢️',amount:15},{res:'Silicium',  icon:'💠',amount:10},{res:'Terres rares',icon:'💎',amount:4}],
  tundra:   [{res:'Gaz',        icon:'💨',amount:12},{res:'Uranium',   icon:'☢️',amount:3},{res:'Eau',          icon:'💧',amount:8}],
  industrial:[{res:'Acier',     icon:'⚙️',amount:15},{res:'Composants',icon:'🔌',amount:8},{res:'Pétrole',     icon:'🛢️',amount:10}],
  landmark: [{res:'Données',    icon:'📊',amount:10},{res:'Influence', icon:'🌐',amount:12},{res:'Stabilité',   icon:'⚖️',amount:10}],
  grassland:[{res:'Nourriture', icon:'🌾',amount:18},{res:'Main-d\'œuvre',icon:'👷',amount:8},{res:'Stabilité',icon:'⚖️',amount:6}],
}
const BIOME_RES_MAPPED = Object.fromEntries(Object.entries(BIOME_RES).map(([k,v])=>[k,v.map(r=>({...r,amount:r.base||10}))]))

/* ── Canvas painters ─────────────────────────────────────── */
function makeHexClip(ctx: CanvasRenderingContext2D, cx:number, cy:number, r:number) {
  ctx.beginPath()
  for (let i=0;i<6;i++) {
    const a=(Math.PI/3)*i-Math.PI/6
    i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
           : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
  }
  ctx.closePath()
}

function paintFrontCanvas(cfg: typeof RARITY[RK], name:string, grade:string, facts:string[], imgUrl:string|null, isShiny:boolean): HTMLCanvasElement {
  const S=1024, cv=document.createElement('canvas')
  cv.width=S; cv.height=S
  const ctx=cv.getContext('2d')!

  /* BACKGROUND */
  const bg=ctx.createRadialGradient(S/2,S*0.35,0,S/2,S/2,S*0.75)
  bg.addColorStop(0, cfg.bg+'ff')
  bg.addColorStop(0.6, cfg.bg+'ee')
  bg.addColorStop(1, '#020205ff')
  ctx.fillStyle=bg; ctx.fillRect(0,0,S,S)

  /* SHINY FOIL */
  if (isShiny) {
    const foil=ctx.createLinearGradient(0,0,S,S)
    foil.addColorStop(0,'rgba(0,0,0,0)')
    foil.addColorStop(0.35, cfg.c+'44')
    foil.addColorStop(0.5,'rgba(255,215,0,0.25)')
    foil.addColorStop(0.65, cfg.c+'44')
    foil.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=foil; ctx.fillRect(0,0,S,S)
  }

  /* RARITY BANNER */
  const bannerH=110
  ctx.fillStyle=cfg.c+'33'
  ctx.fillRect(0,0,S,bannerH)
  // Rarity label
  ctx.font=`bold 52px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle=cfg.c
  ctx.textAlign='center'
  ctx.textBaseline='middle'
  ctx.fillText(cfg.label.toUpperCase(), S/2, bannerH/2)
  // Grade badge (left)
  ctx.beginPath(); ctx.arc(60,bannerH/2,42,0,Math.PI*2)
  ctx.fillStyle=cfg.c; ctx.fill()
  ctx.font=`bold 34px Arial,sans-serif`
  ctx.fillStyle='#000'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(grade, 60, bannerH/2+2)
  // Shiny (right)
  if (isShiny) {
    ctx.font=`bold 28px Arial,sans-serif`
    ctx.fillStyle='#FCD34D'; ctx.textAlign='right'; ctx.textBaseline='middle'
    ctx.fillText('✨ SHINY', S-24, bannerH/2)
  }

  /* IMAGE ZONE */
  const imgTop=bannerH+10, imgH=320
  ctx.save()
  makeHexClip(ctx, S/2, imgTop+imgH/2, 155)
  ctx.clip()
  ctx.fillStyle=cfg.c+'22'; ctx.fillRect(0,imgTop,S,imgH)
  // Large hex watermark
  ctx.font=`${imgH*0.85}px serif`
  ctx.fillStyle=cfg.c+'18'
  ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('⬡', S/2, imgTop+imgH/2)
  ctx.restore()
  // Image gradient overlay bottom
  const imgOv=ctx.createLinearGradient(0,imgTop+imgH*0.55,0,imgTop+imgH)
  imgOv.addColorStop(0,'rgba(0,0,0,0)'); imgOv.addColorStop(1,cfg.bg+'ff')
  ctx.fillStyle=imgOv; ctx.fillRect(0,imgTop,S,imgH)
  // Rarity glow line below image
  ctx.fillStyle=cfg.c+'77'; ctx.fillRect(0,imgTop+imgH-8,S,8)

  /* NAME PLATE */
  const nameY=imgTop+imgH+10
  ctx.fillStyle='rgba(0,0,0,0.6)'
  ctx.fillRect(0,nameY,S,80)
  ctx.font=`bold 46px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle='#ffffff'
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const shortName = name.length>20 ? name.slice(0,18)+'…' : name
  ctx.fillText(shortName, S/2, nameY+40)

  /* DIVIDER */
  ctx.strokeStyle=cfg.c+'88'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(50,nameY+90); ctx.lineTo(S-50,nameY+90); ctx.stroke()
  // "CARACTÉRISTIQUES" label
  ctx.font=`bold 22px Arial,sans-serif`
  ctx.fillStyle=cfg.c; ctx.textAlign='left'; ctx.textBaseline='middle'
  ctx.fillText('CARACTÉRISTIQUES', 50, nameY+115)

  /* 3 FACTS */
  const factY=nameY+145
  facts.slice(0,3).forEach((fact,i) => {
    const fy=factY+i*90
    // Number circle
    ctx.beginPath(); ctx.arc(60,fy+20,20,0,Math.PI*2)
    ctx.fillStyle=cfg.c+'33'; ctx.fill()
    ctx.strokeStyle=cfg.c+'88'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.font=`bold 20px Arial,sans-serif`
    ctx.fillStyle=cfg.c; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(`${i+1}`, 60, fy+21)
    // Fact text — word wrap at 840px
    ctx.font=`18px Arial,sans-serif`
    ctx.fillStyle='rgba(255,255,255,0.88)'
    ctx.textAlign='left'; ctx.textBaseline='top'
    const words=fact.split(' '); let line='', ly=fy
    words.forEach(w => {
      const t=line?line+' '+w:w
      if (ctx.measureText(t).width>800) { ctx.fillText(line,90,ly); line=w; ly+=22 }
      else line=t
    })
    ctx.fillText(line,90,ly)
  })

  /* BOTTOM STRIP */
  ctx.fillStyle=cfg.c+'22'; ctx.fillRect(0,S-50,S,50)
  ctx.strokeStyle=cfg.c+'55'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(0,S-50); ctx.lineTo(S,S-50); ctx.stroke()
  ctx.font=`bold 18px Arial,sans-serif`
  ctx.fillStyle=cfg.c+'cc'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('HEXOD  ·  SAISON 1  ·  ÉDITION GENÈSE', S/2, S-25)

  return cv
}

function paintBackCanvas(cfg: typeof RARITY[RK], h3:string, income:number, floor:number|null, isShiny:boolean): HTMLCanvasElement {
  const S=1024, cv=document.createElement('canvas')
  cv.width=S; cv.height=S
  const ctx=cv.getContext('2d')!

  // Background
  const bg=ctx.createLinearGradient(0,0,S,S)
  bg.addColorStop(0,cfg.bg)
  bg.addColorStop(1,'#020205')
  ctx.fillStyle=bg; ctx.fillRect(0,0,S,S)

  if (isShiny) {
    const f=ctx.createLinearGradient(0,0,S,S)
    f.addColorStop(0,'rgba(0,0,0,0)'); f.addColorStop(0.4,cfg.c+'55')
    f.addColorStop(0.5,'rgba(255,215,0,0.3)'); f.addColorStop(0.6,cfg.c+'55')
    f.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=f; ctx.fillRect(0,0,S,S)
  }

  // Hex watermark tiling
  ctx.globalAlpha=0.06; ctx.font=`80px serif`; ctx.fillStyle=cfg.c; ctx.textAlign='center'; ctx.textBaseline='middle'
  for(let y=80;y<S;y+=130) for(let x=(y%260<130?80:145);x<S;x+=180) ctx.fillText('⬡',x,y)
  ctx.globalAlpha=1

  // Big hex center
  ctx.font=`bold 200px serif`; ctx.fillStyle=cfg.c+'44'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('⬡',S/2,S*0.38)

  // HEXOD
  ctx.font=`bold 80px 'Arial Black',Arial,sans-serif`; ctx.fillStyle=cfg.accent; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('HEXOD',S/2,S*0.38+20)

  // Divider
  ctx.strokeStyle=cfg.c+'55'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(80,S*0.56); ctx.lineTo(S-80,S*0.56); ctx.stroke()

  // Stats
  ctx.font=`bold 32px Arial,sans-serif`; ctx.fillStyle=cfg.accent; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(`💠 +${income} HEX Coin / jour`,S/2,S*0.62)
  if(floor){ctx.font=`28px Arial,sans-serif`; ctx.fillStyle=cfg.c; ctx.fillText(`💎 Floor : ${floor} HEX`,S/2,S*0.68)}

  // H3 index
  ctx.font=`22px 'Courier New',monospace`; ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(h3.slice(0,20),S/2,S*0.78)

  // Footer
  ctx.font=`20px Arial,sans-serif`; ctx.fillStyle=cfg.c+'66'; ctx.fillText('Saison 1 · Édition Genèse',S/2,S*0.88)

  return cv
}

/* ── 3D Card (3 meshes) ──────────────────────────────────── */
function HexCard3D({ frontCv, backCv, imgUrl, cfg, showBack, isShiny }: {
  frontCv:HTMLCanvasElement; backCv:HTMLCanvasElement
  imgUrl:string|null; cfg:typeof RARITY[RK]; showBack:boolean; isShiny:boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const velY=useRef(-0.25); const velX=useRef(0)
  const { gl } = useThree()

  useEffect(() => {
    const c=gl.domElement; let drag=false,lx=0,ly=0
    const pd=(e:PointerEvent)=>{ drag=true; lx=e.clientX; ly=e.clientY; velY.current=0; velX.current=0 }
    const pm=(e:PointerEvent)=>{ if(!drag)return; velY.current=(e.clientX-lx)*0.022; velX.current=-(e.clientY-ly)*0.013; lx=e.clientX; ly=e.clientY }
    const pu=()=>{ drag=false }
    c.addEventListener('pointerdown',pd); window.addEventListener('pointermove',pm); window.addEventListener('pointerup',pu)
    return ()=>{ c.removeEventListener('pointerdown',pd); window.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu) }
  },[gl])

  useFrame(()=>{
    velY.current*=0.93; velX.current*=0.93
    groupRef.current.rotation.y+=velY.current
    groupRef.current.rotation.x=Math.max(-0.7,Math.min(0.7,groupRef.current.rotation.x+velX.current))
  })

  const hexShape=useMemo(()=>{ const s=new THREE.Shape(); for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6; i===0?s.moveTo(1.5*Math.cos(a),1.5*Math.sin(a)):s.lineTo(1.5*Math.cos(a),1.5*Math.sin(a))} s.closePath(); return s },[])

  // Prism = just the walls (no faces)
  const prismGeo=useMemo(()=>{ const g=new THREE.ExtrudeGeometry(hexShape,{depth:0.22,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.03,bevelSegments:2}); return g },[hexShape])

  // Flat front/back faces
  const faceGeo=useMemo(()=>{
    const g=new THREE.ShapeGeometry(hexShape)
    // Remap UVs from shape coords (centered, not 0-1) to 0-1 range
    g.computeBoundingBox()
    const box=g.boundingBox!
    const uvAttr=g.attributes.uv
    for(let i=0;i<uvAttr.count;i++){
      uvAttr.setXY(i,
        (uvAttr.getX(i)-box.min.x)/(box.max.x-box.min.x),
        (uvAttr.getY(i)-box.min.y)/(box.max.y-box.min.y)
      )
    }
    uvAttr.needsUpdate=true
    return g
  },[hexShape])

  const [imgTex,setImgTex]=useState<THREE.Texture|null>(null)
  useEffect(()=>{ if(!imgUrl)return; new THREE.TextureLoader().load(imgUrl,tex=>{tex.colorSpace=THREE.SRGBColorSpace;setImgTex(tex)},undefined,()=>setImgTex(null)) },[imgUrl])

  const frontTex=useMemo(()=>{
    // Simple reliable: just wrap the pre-painted canvas
    const t=new THREE.CanvasTexture(frontCv)
    t.flipY=true
    t.needsUpdate=true
    return t
  },[frontCv])
  const sideMat=useMemo(()=>new THREE.MeshStandardMaterial({
    color:cfg.c, metalness:cfg.metalness, roughness:cfg.roughness, envMapIntensity:1.5
  }),[cfg])

  const frontMat=useMemo(()=>new THREE.MeshStandardMaterial({
    map:frontTex, metalness:0.05, roughness:0.65, envMapIntensity:isShiny?1.2:0.4,
  }),[frontTex,isShiny])

  // Back face: plain metallic — no texture, reliable rendering
  const backMat=useMemo(()=>new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.c),
    metalness:isShiny?0.95:0.75, roughness:isShiny?0.04:0.2,
    envMapIntensity:isShiny?2.5:1.5,
    emissive: isShiny ? new THREE.Color(cfg.c).multiplyScalar(0.15) : new THREE.Color(0,0,0),
  }),[cfg,isShiny])

  const D=0.18

  return (
    <group ref={groupRef} rotation={[0.06, showBack?Math.PI:-0.1, 0]}>
      <mesh geometry={prismGeo} material={sideMat} />
      <mesh geometry={faceGeo} material={frontMat} position={[0,0,D+0.12]} />
      <mesh geometry={faceGeo} material={backMat} position={[0,0,-0.12]} rotation={[0,Math.PI,0]} />
      <pointLight position={[0,0,3.5]} intensity={0.8} color={cfg.c} />
    </group>
  )
}

/* ── Kingdom tab ─────────────────────────────────────────── */
function KingdomTab({ t, cfg }: { t:any; cfg:typeof RARITY[RK] }) {
  const qc=useQueryClient()
  const clusterId=t.owner_kingdom_id||'main'

  const {data}=useQuery({
    queryKey:['kingdom-skills',clusterId],
    queryFn:()=>api.get(`/territories-geo/kingdom-skill-tree/?cluster_id=${clusterId}`).then(r=>r.data),
    staleTime:15000,
  })

  const unlock=useMutation({
    mutationFn:(id:number)=>api.post('/territories-geo/kingdom-unlock-skill/',{cluster_id:clusterId,skill_id:id}),
    onSuccess:()=>{ toast.success('Compétence débloquée!'); qc.invalidateQueries({queryKey:['kingdom-skills',clusterId]}) },
    onError:(e:any)=>toast.error(e?.response?.data?.error||'Ressources insuffisantes'),
  })

  const tree=data?.tree||{}
  const kingdom=data?.kingdom||{}
  const resources=kingdom.resources||{}
  const biomeRes=BIOME_RES_MAPPED[t.territory_type||'rural']||BIOME_RES_MAPPED.rural
  const income=Math.round((t.resource_credits||t.food_per_tick||10)*288)

  const RES_LABELS: Record<string,string> = {
    fer:'🪨',petrole:'🛢️',silicium:'💠',donnees:'📊',
    hex_cristaux:'💎',influence:'🌐',acier:'⚙️',
    terres_rares:'💎',composants:'🔌',uranium:'☢️',
  }

  return (
    <div>
      {/* Kingdom status */}
      <div style={{padding:'8px 10px',borderRadius:8,marginBottom:10,
        background:kingdom.is_main?`${cfg.c}12`:'rgba(255,255,255,0.03)',
        border:`1px solid ${kingdom.is_main?cfg.c+'33':'rgba(255,255,255,0.07)'}`}}>
        <span style={{fontSize:11,fontWeight:700,color:kingdom.is_main?cfg.c:'#6B7280'}}>
          {kingdom.is_main?'👑 Royaume Principal':kingdom.size<=1?'🏴 Territoire Isolé — arbre repart à 0':'🏰 Royaume Secondaire'}
        </span>
        <span style={{fontSize:10,color:'#4B5563',marginLeft:8}}>
          {kingdom.size||0} territoires · Tier {kingdom.tier||0}
        </span>
      </div>

      {/* Production */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Production / jour</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:12}}>
        {biomeRes.map((r:any)=>(
          <div key={r.res} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'6px 4px',textAlign:'center'}}>
            <div style={{fontSize:14}}>{r.icon}</div>
            <div style={{fontSize:10,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{r.amount*288}</div>
            <div style={{fontSize:7,color:'#4B5563',marginTop:1}}>{r.res.slice(0,9)}</div>
          </div>
        ))}
        <div style={{background:`${cfg.c}12`,borderRadius:7,padding:'6px 4px',textAlign:'center',border:`1px solid ${cfg.c}22`}}>
          <div style={{fontSize:14}}>💠</div>
          <div style={{fontSize:10,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{income}</div>
          <div style={{fontSize:7,color:cfg.c,marginTop:1}}>HEX Coin</div>
        </div>
      </div>

      {/* Available resources for skill tree */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>
        Ressources du royaume — allouer aux compétences
      </div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:12}}>
        {Object.entries(RES_LABELS).filter(([k])=>resources[k]>0).map(([k,icon])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 8px',
            borderRadius:5,background:`${cfg.c}14`,border:`1px solid ${cfg.c}33`}}>
            <span style={{fontSize:12}}>{icon}</span>
            <span style={{fontSize:10,color:cfg.accent,fontFamily:'monospace',fontWeight:700}}>
              {Math.round(resources[k])}
            </span>
          </div>
        ))}
        {Object.keys(resources).filter(k=>RES_LABELS[k]&&resources[k]>0).length===0&&(
          <span style={{fontSize:10,color:'#374151'}}>Aucune ressource — agrandissez votre royaume</span>
        )}
      </div>

      {/* Skill tree */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>
        Arbre des compétences — hover pour détails · cliquer pour débloquer
      </div>
      <SkillTreeSVG tree={tree} kingdom={kingdom} cfg={cfg}
        onUnlock={(id)=>unlock.mutate(id)} />
    </div>
  )
}

/* ── Main HexCard ────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim }:{
  territory:any; onClose:()=>void; onRequestClaim:()=>void
}) {
  const player=usePlayer()
  const isOwned=t.owner_id===player?.id
  const isEnemy=!!t.owner_id&&!isOwned
  const isFree=!t.owner_id
  const rarity=(t.rarity||'common') as RK
  const cfg=RARITY[rarity]??RARITY.common
  const isShiny=!!t.is_shiny

  const cardName=t.custom_name||t.poi_name||t.place_name||'Zone'
  const imgUrl=t.poi_wiki_url||null
  const income=Math.round((t.resource_credits||t.food_per_tick||10)*288)

  const facts=useMemo(()=>{
    const r=[]
    if(t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visiteurs / an`)
    if(t.poi_geo_score) r.push(`Score géopolitique : ${t.poi_geo_score}/100`)
    if(t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,90))
    if(t.poi_description&&r.length<3) r.push(t.poi_description.slice(0,90))
    while(r.length<3) r.push('Territoire unique · Hexod Saison 1')
    return r.slice(0,3)
  },[t])

  const frontCv=useMemo(()=>paintFrontCanvas(cfg,cardName,cfg.grade,facts,imgUrl,isShiny),[cfg,cardName,facts,imgUrl,isShiny])
  const backCv =useMemo(()=>paintBackCanvas(cfg,t.h3_index||'',income,t.poi_floor_price||null,isShiny),[cfg,t.h3_index,income,t.poi_floor_price,isShiny])

  const [tab,setTab]=useState<'card'|'kingdom'|'nft'>('card')
  const [showBack,setShowBack]=useState(false)

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:'fixed',inset:0,zIndex:1200,display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:10,
        background:'rgba(0,0,0,0.92)',backdropFilter:'blur(20px)',padding:'10px'}}
    >
      {/* Ambient */}
      <div style={{position:'absolute',width:420,height:420,pointerEvents:'none',
        background:`radial-gradient(ellipse 55% 55% at 50% 42%,${cfg.c}1a 0%,transparent 70%)`,
        filter:'blur(50px)'}} />

      {/* 3D canvas */}
      <div style={{width:240,height:270,cursor:'grab',zIndex:1,flexShrink:0}}>
        <Canvas camera={{position:[0,0,4.0],fov:42}} gl={{antialias:true,alpha:true,powerPreference:"high-performance"}} frameloop="demand" style={{background:'transparent'}}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />
            <pointLight position={[3,4,3]} intensity={1.8} />
            <pointLight position={[-2,-2,2]} intensity={0.6} color={cfg.c} />
            <Environment preset="city" />
            <HexCard3D frontCv={frontCv} backCv={backCv} imgUrl={imgUrl}
              cfg={cfg} showBack={showBack} isShiny={isShiny} />
          </Suspense>
        </Canvas>
      </div>

      {/* Label + flip */}
      <div style={{display:'flex',alignItems:'center',gap:10,zIndex:1}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{cardName}</div>
          <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:3}}>
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
      {isOwned?(
        <div style={{width:330,background:'rgba(4,4,12,0.99)',border:`1px solid ${cfg.c}44`,
          borderRadius:14,overflow:'hidden',zIndex:1,maxHeight:'46vh',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',borderBottom:`1px solid ${cfg.c}22`,flexShrink:0}}>
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
          <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
            {tab==='card'&&(
              <div>
                {imgUrl&&<img src={imgUrl} alt={cardName} style={{width:'100%',height:70,objectFit:'cover',borderRadius:7,marginBottom:8}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />}
                <div style={{padding:'8px 10px',borderRadius:8,background:`${cfg.c}0e`,border:`1px solid ${cfg.c}22`,marginBottom:8}}>
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
            {tab==='kingdom'&&<KingdomTab t={t} cfg={cfg} />}
            {tab==='nft'&&(
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
      ):(
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
              boxShadow:`0 4px 24px ${cfg.c}44`,
            }}>🏴 Revendiquer {cardName.slice(0,20)}</button>
          )}
          {isEnemy&&(
            <button onClick={onRequestClaim} style={{
              width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.1)',
              color:'#EF4444',fontSize:13,fontWeight:700,
            }}>⚔️ Attaquer · 💸 Acheter</button>
          )}
        </div>
      )}

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
