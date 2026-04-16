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
import { IconSVG } from '../shared/iconBank'
import { createTokenFace2D, randomBiomeImage } from '../shared/hexodTokenFace'
import type { TierKey } from '../shared/hexodTokenFace'

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
    date:new Date().toISOString().slice(0,10), iconSvg:'', imageSrc:randomBiomeImage(b) })
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

export function BoosterOpenAnimation({ cards, packName, onClose }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<any>(null)
  const [phase, setPhase] = useState<Phase>('pack')
  const [bestCard, setBestCard] = useState<Card|null>(null)

  useEffect(() => {
    const el = elRef.current; if (!el) return
    const w=el.clientWidth, h=el.clientHeight
    const sc = new THREE.Scene(); sc.fog = new THREE.FogExp2(0x020208, 0.12)
    const cam = new THREE.PerspectiveCamera(50,w/h,0.1,100); cam.position.set(0,0,5)
    const ren = new THREE.WebGLRenderer({ antialias:true, alpha:true })
    ren.setSize(w,h); ren.setPixelRatio(Math.min(devicePixelRatio,2))
    ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.2
    el.appendChild(ren.domElement)
    sc.add(new THREE.AmbientLight(0x223344, 0.5))
    const kl = new THREE.DirectionalLight(0xffffff,1.5); kl.position.set(3,4,5); sc.add(kl)
    const rl = new THREE.PointLight(0xf59e0b,2,10); rl.position.set(-2,-1,3); sc.add(rl)

    const pk = new THREE.Group()
    const bx = new THREE.BoxGeometry(1.2,1.6,0.3)
    const bm = new THREE.MeshStandardMaterial({ color:0x1a1200, metalness:0.9, roughness:0.2, emissive:0xf59e0b, emissiveIntensity:0.05 })
    pk.add(new THREE.Mesh(bx, bm))
    const em = new THREE.LineBasicMaterial({ color:0xf59e0b, transparent:true, opacity:0.6 })
    pk.add(new THREE.LineSegments(new THREE.EdgesGeometry(bx), em))
    const lc = document.createElement('canvas'); lc.width=256; lc.height=64
    const lx = lc.getContext('2d')!; lx.fillStyle='#F59E0B'; lx.font='bold 28px Orbitron, sans-serif'; lx.textAlign='center'
    lx.fillText('HEXOD',128,35); lx.font='14px Orbitron, sans-serif'; lx.fillStyle='#F59E0B80'
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
      if(st.phase==='pack'){pk.rotation.y=Math.sin(t*0.5)*0.3;pk.rotation.x=Math.sin(t*0.7)*0.05;pk.position.y=Math.sin(t*1.2)*0.08;bm.emissiveIntensity=0.03+Math.sin(t*2)*0.03;em.opacity=0.4+Math.sin(t*3)*0.3;rl.position.x=Math.sin(t)*3;rl.position.z=Math.cos(t)*3+2}
      if(st.phase==='explode'){pk.scale.multiplyScalar(0.92);pk.rotation.y+=0.3;pk.rotation.z+=0.1;if(st.prt){const pp=st.prt.pts.geometry.attributes.position;for(let i=0;i<pp.count;i++){pp.array[i*3]+=st.prt.v[i*3]*0.016;pp.array[i*3+1]+=st.prt.v[i*3+1]*0.016;pp.array[i*3+2]+=st.prt.v[i*3+2]*0.016}pp.needsUpdate=true;st.prt.m.opacity*=0.98}}
      if(st.phase==='reveal'||st.phase==='done'){st.cms.forEach((m:any,i:number)=>{if(!m._tgt)return;m.position.lerp(m._tgt,0.06);const ry=st.fl.has(i)?0:Math.PI;m.rotation.y+=(ry-m.rotation.y)*0.1})}
      ren.render(sc,cam) }
    loop()
    const onR=()=>{const w2=el.clientWidth,h2=el.clientHeight;cam.aspect=w2/h2;cam.updateProjectionMatrix();ren.setSize(w2,h2)}
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
      cards.forEach((card,i)=>{
        const geo=new THREE.PlaneGeometry(0.7,0.7)
        const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:mkCardTex(card),metalness:0.1,roughness:0.5}))
        const back=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:mkBackTex(card.rarity),metalness:0.3,roughness:0.4,side:THREE.BackSide}))
        back.rotation.y=Math.PI;mesh.add(back);mesh.position.set(0,0,0);mesh.rotation.y=Math.PI
        const angle=((i-(n-1)/2)/Math.max(n-1,1))*1.5
        ;(mesh as any)._tgt=new THREE.Vector3(Math.sin(angle)*2,-Math.cos(angle)*0.15+0.1,-0.5+Math.abs(angle)*-0.3)
        if(['rare','epic','legendary','mythic'].includes(card.rarity)){
          const gm=new THREE.MeshBasicMaterial({color:RC[card.rarity],transparent:true,opacity:0,side:THREE.DoubleSide})
          const gl=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.8),gm);gl.position.z=-0.01;mesh.add(gl);(mesh as any)._gm=gm}
        s.sc.add(mesh);s.cms.push(mesh)})
      s.phase='reveal';setPhase('reveal')
      let idx=0;const flipNext=()=>{
        if(idx>=n){setTimeout(()=>{s.phase='done';setPhase('done');setBestCard(cards.reduce((a,b)=>(RK[b.rarity]||0)>(RK[a.rarity]||0)?b:a,cards[0]))},600);return}
        s.fl.add(idx);const gm=(s.cms[idx] as any)?._gm
        if(gm){let g=0;const gi=setInterval(()=>{g+=0.05;gm.opacity=Math.min(0.3,g);if(g>=0.3)clearInterval(gi)},30)}
        idx++;setTimeout(flipNext,500)};setTimeout(flipNext,400)
    },900)
  },[cards])

  useEffect(()=>{const el=elRef.current;if(!el)return;const h=()=>{if(phase==='pack')doExplode()};el.addEventListener('click',h);return()=>el.removeEventListener('click',h)},[phase,doExplode])

  const bc=bestCard?RC[bestCard.rarity]:'#F59E0B'
  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'#020208'}}>
      <div ref={elRef} style={{position:'absolute',inset:0}} />
      <AnimatePresence>
        {phase==='pack'&&(<motion.div key="tap" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          style={{position:'absolute',bottom:80,left:'50%',transform:'translateX(-50%)',color:'#F59E0B',fontSize:14,fontWeight:900,letterSpacing:3,fontFamily:"'Orbitron', sans-serif",textShadow:'0 0 20px #F59E0B80'}}>
          <motion.span animate={{opacity:[0.5,1,0.5]}} transition={{duration:1.5,repeat:Infinity}}>TAP TO OPEN</motion.span></motion.div>)}
        {phase==='explode'&&(<motion.div key="bang" initial={{opacity:0,scale:2}} animate={{opacity:[0,1,0],scale:[2,3,4]}} transition={{duration:0.8}}
          style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',color:'#fff',fontSize:24,fontWeight:900,letterSpacing:8,fontFamily:"'Orbitron', sans-serif"}}>OPENING</motion.div>)}
        {phase==='done'&&bestCard&&(<motion.div key="sum" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
          style={{position:'absolute',bottom:40,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:12,zIndex:10}}>
          <div style={{padding:'8px 20px',borderRadius:20,background:`${bc}15`,border:`1px solid ${bc}40`,color:bc,fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Orbitron', sans-serif",textShadow:`0 0 15px ${bc}60`,display:'flex',alignItems:'center',gap:6}}>
            {bestCard.is_shiny&&<IconSVG id="sparkles" size={12} />}
            {RL[bestCard.rarity]?.toUpperCase()} · {bestCard.poi_name||bestCard.h3_index?.slice(-6)}</div>
          <div style={{fontSize:8,color:'rgba(255,255,255,0.4)',letterSpacing:1,fontFamily:"'Share Tech Mono', monospace"}}>{cards.length} TOKENS OBTAINED</div>
          <button onClick={onClose} style={{padding:'12px 40px',borderRadius:30,cursor:'pointer',background:'linear-gradient(135deg, #F59E0B, #cc8800)',border:'none',color:'#fff',fontSize:12,fontWeight:900,letterSpacing:3,fontFamily:"'Orbitron', sans-serif",boxShadow:'0 4px 30px rgba(245,158,11,0.4)'}}>CONTINUE</button></motion.div>)}
      </AnimatePresence>
      <button onClick={onClose} style={{position:'absolute',top:20,right:20,zIndex:10,width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
    </div>)
}
