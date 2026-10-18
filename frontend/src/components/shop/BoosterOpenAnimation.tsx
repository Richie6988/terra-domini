/**
 * BoosterOpenAnimation — 3D booster pack opening with Three.js.
 *
 * Phase 1: Metallic pack floating + rotating, pulsing glow. "TAP TO OPEN"
 * Phase 2: Explosion — pack shatters, particles burst, light flash
 * Phase 3: Cards fan out as 3D planes with TokenFace2D textures. Auto-flip.
 * Phase 4: Summary — best card highlighted, "CONTINUE" button.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { cellToLatLng } from 'h3-js'
import { IconSVG } from '../shared/iconBank'
import { createTokenFace2D } from '../shared/hexodTokenFace'
import type { TierKey } from '../shared/hexodTokenFace'
import { playSound } from '../../hooks/useSound'

const RC: Record<string,string> = { common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6', epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899' }
const RL: Record<string,string> = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary', mythic:'Mythic' }
const RT: Record<string, TierKey> = { common:'BRONZE', uncommon:'BRONZE', rare:'SILVER', epic:'GOLD', legendary:'EMERALD', mythic:'EMERALD' }
const RK: Record<string,number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }

interface Card { h3_index: string; poi_name?: string; rarity: string; biome?: string; territory_type?: string; is_shiny?: boolean }
interface Props { cards: Card[]; packName?: string; onClose: () => void }
type Phase = 'pack' | 'explode' | 'reveal' | 'done'

function mkPart(sc: THREE.Scene, n: number, col: string, spd: number) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n*3), v = new Float32Array(n*3)
  for (let i=0;i<n;i++) { p[i*3]=(Math.random()-0.5)*0.3; p[i*3+1]=(Math.random()-0.5)*0.3; p[i*3+2]=(Math.random()-0.5)*0.3
    const t=Math.random()*Math.PI*2, ph=Math.random()*Math.PI, s=(0.5+Math.random())*spd
    v[i*3]=Math.sin(ph)*Math.cos(t)*s; v[i*3+1]=Math.sin(ph)*Math.sin(t)*s; v[i*3+2]=Math.cos(ph)*s }
  g.setAttribute('position', new THREE.BufferAttribute(p,3))
  const m = new THREE.PointsMaterial({ color: col, size:0.04, transparent:true, opacity:1 })
  const pts = new THREE.Points(g, m); sc.add(pts); return { pts, v, m }
}

function mkCardTex(card: Card): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width=512; c.height=512
  const b = card.biome||'rural'
  createTokenFace2D(c, { tier:RT[card.rarity]||'BRONZE', category:(card.territory_type||'TERRITORY').toUpperCase(),
    catColor:RC[card.rarity]||'#39FF14', biome:b.toUpperCase(), tokenName:(card.poi_name||card.h3_index?.slice(-6)||'TOKEN').toUpperCase(),
    description:'', edition:'GENESIS', serial:Math.floor(Math.random()*999)+1, maxSupply:1000, owner:'VAULT_HOLDER',
    date:new Date().toISOString().slice(0,10), iconSvg:'', imageSrc:'' })
  const t = new THREE.CanvasTexture(c); t.needsUpdate=true
  setTimeout(()=>{t.needsUpdate=true},800); setTimeout(()=>{t.needsUpdate=true},2000); return t
}

function mkBackTex(r: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width=512; c.height=512; const x=c.getContext('2d')!; const col=RC[r]||'#9CA3AF'
  x.fillStyle='#0a0a0f'; x.fillRect(0,0,512,512); x.strokeStyle=col; x.lineWidth=8; x.strokeRect(16,16,480,480)
  x.strokeStyle=col+'30'; x.lineWidth=1
  for (let y=40;y<480;y+=40) for (let xx=40+((y/40)%2)*20;xx<480;xx+=40) {
    x.beginPath(); for (let a=0;a<6;a++){const ag=(Math.PI/3)*a-Math.PI/6; const px=xx+15*Math.cos(ag),py=y+15*Math.sin(ag); a===0?x.moveTo(px,py):x.lineTo(px,py)} x.closePath();x.stroke() }
  x.fillStyle=col; x.font='bold 48px Orbitron, sans-serif'; x.textAlign='center'; x.fillText('HEXOD',256,250)
  x.font='24px Orbitron, sans-serif'; x.fillStyle=col+'80'; x.fillText(RL[r]?.toUpperCase()||'TOKEN',256,290)
  x.font='bold 100px Georgia, serif'; x.fillStyle=col+'20'; x.fillText('?',256,400)
  return new THREE.CanvasTexture(c)
}

/** Grid layout for revealed cards — fits the visible frustum at z=0 (camera z=5, fov 50). */
function layoutTargets(n: number, aspect: number) {
  const visH = 2 * 5 * Math.tan((25 * Math.PI) / 180)
  const visW = visH * aspect
  const maxCols = aspect < 0.8 ? 2 : 5
  const cols = Math.max(1, n > maxCols ? Math.ceil(n / Math.ceil(n / maxCols)) : n)
  const rows = Math.ceil(n / cols)
  const pitch = Math.min(1.25, (visW * 0.9) / cols, (visH * 0.58) / rows)
  const scale = pitch / 0.92
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i - r * cols
    return { x: (c - (inRow - 1) / 2) * pitch, y: (aspect < 0.8 ? 0.95 : 0.45) + ((rows - 1) / 2 - r) * pitch, scale }
  })
}

export function BoosterOpenAnimation({ cards, packName, onClose }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<any>(null)
  const [phase, setPhase] = useState<Phase>('pack')
  const [bestCard, setBestCard] = useState<Card|null>(null)
  const [revealed, setRevealed] = useState(0)
  const [flash, setFlash] = useState<{ color: string; k: number } | null>(null)

  useEffect(() => {
    const el = elRef.current; if (!el) return
    const w=el.clientWidth, h=el.clientHeight
    const sc = new THREE.Scene(); sc.fog = new THREE.FogExp2(0x020208, 0.12)
    const cam = new THREE.PerspectiveCamera(50,w/h,0.1,100); cam.position.set(0,0,5)
    const ren = new THREE.WebGLRenderer({ antialias:true, alpha:true })
    ren.setSize(w,h); ren.setPixelRatio(Math.min(devicePixelRatio,2))
    ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.2
    el.appendChild(ren.domElement)
    sc.add(new THREE.AmbientLight(0xffffff, 0.9))
    const kl = new THREE.DirectionalLight(0xffffff,1.5); kl.position.set(3,4,5); sc.add(kl)
    const rl = new THREE.PointLight(0xf59e0b,2,10); rl.position.set(-2,-1,3); sc.add(rl)

    const pk = new THREE.Group()
    const bx = new THREE.BoxGeometry(1.2,1.6,0.3)
    // Saturated cartoon pack, coloured by pack tier (was a near-black metal box)
    const pn = (packName || '').toUpperCase()
    const packCol = pn.includes('LEGEND') ? 0xf5a70b : pn.includes('RARE') ? 0x8b5cf6 : 0x1e90ff
    const bm = new THREE.MeshStandardMaterial({ color:packCol, metalness:0.25, roughness:0.45, emissive:packCol, emissiveIntensity:0.12 })
    pk.add(new THREE.Mesh(bx, bm))
    const em = new THREE.LineBasicMaterial({ color:0x0b1828, transparent:true, opacity:0.9 })
    pk.add(new THREE.LineSegments(new THREE.EdgesGeometry(bx), em))
    const lc = document.createElement('canvas'); lc.width=256; lc.height=64
    const lx = lc.getContext('2d')!; lx.fillStyle='#ffffff'; lx.font='bold 30px "Lilita One", Orbitron, sans-serif'; lx.textAlign='center'
    lx.strokeStyle='#0b1828'; lx.lineWidth=5; lx.strokeText('HEXOD',128,35)
    lx.fillText('HEXOD',128,35); lx.font='15px "Lilita One", Orbitron, sans-serif'; lx.fillStyle='#ffffffd0'
    lx.fillText(packName?.toUpperCase()||'BOOSTER PACK',128,55)
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(1,0.3), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(lc), transparent:true }))
    lb.position.z=0.16; pk.add(lb); sc.add(pk)

    const sp = new Float32Array(600*3)
    for (let i=0;i<600;i++){sp[i*3]=(Math.random()-0.5)*30;sp[i*3+1]=(Math.random()-0.5)*30;sp[i*3+2]=-5-Math.random()*20}
    const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(sp,3))
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.03,transparent:true,opacity:0.6})))

    const st: any = { sc,cam,ren,pk,bm,em,rl,cms:[] as THREE.Mesh[],prt:null,phase:'pack',fl:new Set<number>() }
    sRef.current = st; const ck = new THREE.Clock()
    const loop = () => { st._r=requestAnimationFrame(loop); const t=ck.getElapsedTime()
      if(st.phase==='pack'){pk.rotation.y=Math.sin(t*0.5)*0.3;pk.rotation.x=Math.sin(t*0.7)*0.05;pk.position.y=Math.sin(t*1.2)*0.08;bm.emissiveIntensity=0.1+Math.sin(t*2)*0.06;rl.position.x=Math.sin(t)*3;rl.position.z=Math.cos(t)*3+2}
      if(st.phase==='explode'){pk.scale.multiplyScalar(0.92);pk.rotation.y+=0.3;pk.rotation.z+=0.1;if(st.prt){const pp=st.prt.pts.geometry.attributes.position;for(let i=0;i<pp.count;i++){pp.array[i*3]+=st.prt.v[i*3]*0.016;pp.array[i*3+1]+=st.prt.v[i*3+1]*0.016;pp.array[i*3+2]+=st.prt.v[i*3+2]*0.016}pp.needsUpdate=true;st.prt.m.opacity*=0.98}}
      if(st.phase==='reveal'||st.phase==='done'){st.cms.forEach((m:any,i:number)=>{if(!m._tgt)return;m.position.lerp(m._tgt,0.06);const ry=st.fl.has(i)?0:Math.PI;m.rotation.y+=(ry-m.rotation.y)*0.1})}
      ren.render(sc,cam) }
    loop()
    const onR=()=>{const w2=el.clientWidth,h2=el.clientHeight;cam.aspect=w2/h2;cam.updateProjectionMatrix();ren.setSize(w2,h2)
      if(st.cms.length){const L=layoutTargets(st.cms.length,cam.aspect);st.cms.forEach((m:any,i:number)=>{m._tgt?.set(L[i].x,L[i].y,0);m.scale.setScalar(L[i].scale)})}}
    window.addEventListener('resize',onR)
    return ()=>{cancelAnimationFrame(st._r);window.removeEventListener('resize',onR);ren.dispose();if(el.contains(ren.domElement))el.removeChild(ren.domElement)}
  }, [])

  const doExplode = useCallback(() => {
    const s=sRef.current; if(!s||s.phase!=='pack') return; s.phase='explode'; setPhase('explode')
    s.prt=mkPart(s.sc,300,'#f59e0b',3); const p2=mkPart(s.sc,200,'#ffffff',2)
    const fl=new THREE.PointLight(0xffffff,10,20);fl.position.set(0,0,2);s.sc.add(fl)
    let fi=0;const ff=setInterval(()=>{fl.intensity*=0.9;fi++;if(fi>30){clearInterval(ff);s.sc.remove(fl)}},30)
    setTimeout(()=>{
      s.sc.remove(s.pk);if(s.prt){s.sc.remove(s.prt.pts);s.prt=null};s.sc.remove(p2.pts)
      const n=cards.length
      const L=layoutTargets(n,s.cam.aspect)
      if(n===0){s.phase='done';setPhase('done');return}
      cards.forEach((card,i)=>{
        const geo=new THREE.PlaneGeometry(0.7,0.7)
        const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:mkCardTex(card),metalness:0.1,roughness:0.5}))
        // Back = separate plane turned away (FrontSide). It was BackSide, so it z-fought the face and the
        // revealed cards showed a mirrored 'HEXOD' back instead of the territory.
        const back=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:mkBackTex(card.rarity),metalness:0.3,roughness:0.4,side:THREE.FrontSide}))
        back.rotation.y=Math.PI;back.position.z=-0.002;mesh.add(back);mesh.position.set(0,0,0);mesh.rotation.y=Math.PI
        mesh.scale.setScalar(L[i].scale)
        ;(mesh as any)._tgt=new THREE.Vector3(L[i].x,L[i].y,0)
        if(['rare','epic','legendary','mythic'].includes(card.rarity)){
          const gm=new THREE.MeshBasicMaterial({color:RC[card.rarity],transparent:true,opacity:0,side:THREE.DoubleSide})
          const gl=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.8),gm);gl.position.z=-0.01;mesh.add(gl);(mesh as any)._gm=gm}
        s.sc.add(mesh);s.cms.push(mesh)})
      s.phase='reveal';setPhase('reveal')
      let idx=0;const flipNext=()=>{
        if(idx>=n){setTimeout(()=>{s.phase='done';setPhase('done');setBestCard(cards.reduce((a,b)=>(RK[b.rarity]||0)>(RK[a.rarity]||0)?b:a,cards[0]))},600);return}
        s.fl.add(idx);setRevealed(idx+1)
        { const rk=RK[cards[idx]?.rarity]||0; playSound(rk>=4?'card_legendary':rk>=3?'card_epic':rk>=2?'card_rare':'card') }
        if((RK[cards[idx]?.rarity]||0)>=2)setFlash({color:RC[cards[idx].rarity]||'#fff',k:idx})
        const gm=(s.cms[idx] as any)?._gm
        if(gm){let g=0;const gi=setInterval(()=>{g+=0.05;gm.opacity=Math.min(0.3,g);if(g>=0.3)clearInterval(gi)},30)}
        idx++;setTimeout(flipNext,500)};setTimeout(flipNext,400)
    },900)
  },[cards])

  useEffect(()=>{const el=elRef.current;if(!el)return;const h=()=>{if(phase==='pack')doExplode()};el.addEventListener('click',h);return()=>el.removeEventListener('click',h)},[phase,doExplode])

  const bc=bestCard?RC[bestCard.rarity]:'#F59E0B'
  const counts = Object.keys(RK).map(r => ({ r, n: cards.filter(c => c.rarity === r).length })).filter(x => x.n > 0).reverse()
  const orb = 'var(--font-heading)'
  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'radial-gradient(ellipse at 50% 42%, #14284f 0%, #081326 48%, #020208 100%)',overflow:'hidden'}}>
      <div ref={elRef} style={{position:'absolute',inset:0}} />
      {/* Header */}
      <div style={{position:'absolute',top:22,left:0,right:0,textAlign:'center',pointerEvents:'none',padding:'0 64px'}}>
        <div style={{fontSize: 11,letterSpacing:0.5,color:'rgba(255,255,255,0.5)',fontFamily:orb}}>HEXOD BOOSTER</div>
        <div style={{fontSize:18,fontWeight:900,letterSpacing:0.5,color:'#fbbf24',fontFamily:orb,textShadow:'0 2px 0 rgba(0,0,0,0.45)',marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {(packName || 'BOOSTER PACK').toUpperCase()}
        </div>
        {(phase==='reveal'||phase==='done') && cards.length>0 && (
          <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:10,padding:'4px 12px',borderRadius:999,background:'rgba(255,255,255,0.06)',border:'2px solid rgba(255,255,255,0.12)',fontSize:11,color:'#e2e8f0',fontFamily:"'Share Tech Mono', monospace"}}>
            REVEALED {revealed}/{cards.length}
          </div>
        )}
      </div>
      {/* Rarity flash */}
      <AnimatePresence>
        {flash && (<motion.div key={'f'+flash.k} initial={{opacity:0}} animate={{opacity:[0,1,0]}} transition={{duration:0.7}}
          style={{position:'absolute',inset:0,pointerEvents:'none',background:`radial-gradient(circle at 50% 45%, ${flash.color}66 0%, ${flash.color}22 35%, transparent 65%)`}} />)}
      </AnimatePresence>
      <AnimatePresence>
        {phase==='pack'&&(<motion.div key="glow" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'absolute',top:'50%',left:'50%',width:340,height:340,marginLeft:-170,marginTop:-170,borderRadius:'50%',pointerEvents:'none',
            background:'radial-gradient(circle, rgba(245,158,11,0.28) 0%, rgba(245,158,11,0.08) 40%, transparent 70%)'}} />)}
        {phase==='pack'&&(<motion.button key="tap" onClick={doExplode} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          style={{position:'absolute',bottom:72,left:'50%',x:'-50%',padding:'14px 30px',borderRadius:999,cursor:'pointer',border:'3px solid rgba(251,191,36,0.6)',
            background:'linear-gradient(180deg, rgba(251,191,36,0.22), rgba(251,191,36,0.06))',boxShadow:'0 4px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            color:'#fbbf24',fontSize:14,fontWeight:900,letterSpacing:0.5,fontFamily:orb,textShadow:'0 2px 0 rgba(0,0,0,0.45)'}}>
          <motion.span animate={{opacity:[0.6,1,0.6]}} transition={{duration:1.5,repeat:Infinity}}>TAP TO OPEN</motion.span>
          <div style={{fontSize: 11,letterSpacing:0.5,color:'rgba(255,255,255,0.55)',marginTop:4,fontWeight:400}}>{cards.length} TOKENS INSIDE</div>
        </motion.button>)}
        {phase==='explode'&&(<motion.div key="white" initial={{opacity:0.9}} animate={{opacity:0}} transition={{duration:0.6}}
          style={{position:'absolute',inset:0,background:'#fff',pointerEvents:'none'}} />)}
        {phase==='explode'&&(<motion.div key="bang" initial={{opacity:0,scale:2}} animate={{opacity:[0,1,0],scale:[2,3,4]}} transition={{duration:0.8}}
          style={{position:'absolute',top:'50%',left:'50%',x:'-50%',y:'-50%',color:'#fff',fontSize:24,fontWeight:900,letterSpacing:0.5,fontFamily:orb}}>OPENING</motion.div>)}
        {phase==='done'&&(<motion.div key="sum" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
          style={{position:'absolute',bottom:28,left:16,right:16,margin:'0 auto',maxWidth:420,display:'flex',flexDirection:'column',alignItems:'center',gap:12,zIndex:10,
            padding:'16px 18px',borderRadius:18,background:'linear-gradient(180deg, rgba(13,27,42,0.92), rgba(6,14,26,0.96))',border:`3px solid ${bc}55`,boxShadow:`0 4px 0 rgba(0,0,0,0.35), 0 18px 50px rgba(0,0,0,0.6)`}}>
          {bestCard ? (<>
            <div style={{fontSize: 11,letterSpacing:0.5,color:'rgba(255,255,255,0.5)',fontFamily:orb}}>BEST PULL</div>
            <div style={{padding:'8px 18px',borderRadius:999,background:`${bc}1f`,border:`2px solid ${bc}66`,color:bc,fontSize:12,fontWeight:900,letterSpacing:0.5,fontFamily:orb,textShadow:'0 2px 0 rgba(0,0,0,0.45)',display:'flex',alignItems:'center',gap:6,maxWidth:'100%'}}>
              {bestCard.is_shiny&&<IconSVG id="sparkles" size={14} />}
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(RL[bestCard.rarity]||bestCard.rarity||'').toUpperCase()} · {bestCard.poi_name||bestCard.h3_index?.slice(-6)}</span>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
              {counts.map(({r,n})=>(
                <span key={r} style={{padding:'3px 10px',borderRadius:999,fontSize: 11,fontWeight:700,letterSpacing:0.5,fontFamily:orb,color:RC[r],background:`${RC[r]}18`,border:`2px solid ${RC[r]}44`}}>{n} × {(RL[r]||r).toUpperCase()}</span>
              ))}
            </div>
            <div style={{fontSize:13,color:'#fff',letterSpacing:0.5,fontFamily:orb,textShadow:'0 2px 0 rgba(0,0,0,0.45)'}}>{cards.length} TERRITORIES ADDED TO YOUR EMPIRE</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%',maxHeight:170,overflowY:'auto'}}>
              {cards.map(c=>(
                <button key={c.h3_index} onClick={()=>{try{const [lat,lon]=cellToLatLng(c.h3_index);window.dispatchEvent(new CustomEvent('terra:flyto',{detail:{lat,lon,zoom:15}}))}catch{};onClose()}}
                  style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 10px',borderRadius:10,cursor:'pointer',textAlign:'left',
                    background:'rgba(255,255,255,0.06)',border:`2px solid ${RC[c.rarity]||'#9CA3AF'}55`,color:'#e2e8f0',fontSize:12,fontFamily:'var(--font-body)'}}>
                  <span style={{width:10,height:10,borderRadius:3,background:RC[c.rarity]||'#9CA3AF',flexShrink:0,border:'1.5px solid #0b1828'}} />
                  <span style={{flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.poi_name||`Zone ${c.h3_index.slice(0,8)}`}</span>
                  <span style={{fontSize:10,color:RC[c.rarity],fontFamily:orb}}>{(RL[c.rarity]||c.rarity||'').toUpperCase()}</span>
                  <span style={{fontSize:10,color:'#fbbf24',fontFamily:orb}}>SEE</span>
                </button>
              ))}
            </div>
          </>) : (
            <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',letterSpacing:0.5,fontFamily:orb}}>THIS PACK WAS EMPTY</div>
          )}
          <button onClick={onClose} className="btn-game btn-game-gold" style={{width:'100%',minHeight:44,fontSize:12,letterSpacing:0.5}}>CONTINUE</button></motion.div>)}
      </AnimatePresence>
      <button onClick={onClose} aria-label="Close" className="hx-close" style={{position:'absolute',top:16,right:16,zIndex:10}}>×</button>
    </div>)
}
