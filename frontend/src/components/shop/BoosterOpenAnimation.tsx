/**
 * BoosterOpenAnimation — 3D booster pack opening with Three.js.
 *
 * Phase 1: Metallic pack floating + rotating, pulsing glow. "TAP TO OPEN"
 * Phase 2: Explosion — pack shatters, particles burst, light flash
 * Phase 3: One card at a time, like a revelation (owner 2026-10-19): the next card comes face down to the centre;
 *          tap → suspense (it shakes and glows longer the rarer it is) → it flips; tap again → it joins the row
 *          at the bottom and the next one comes up. SKIP reveals the rest.
 * Phase 4: Summary — best card highlighted, "CONTINUE" button.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { IconSVG, getIcon } from '../shared/iconBank'
import { createTokenFace2D } from '../shared/hexodTokenFace'
import { iconFor } from '../shared/poiIcons'
import type { TierKey } from '../shared/hexodTokenFace'
import { playSound } from '../../hooks/useSound'
import { RARITY_LABEL } from '../../services/balance'

const RC: Record<string,string> = { common:'#cbd5e1', uncommon:'#fbbf24', rare:'#10b981', epic:'#67e8f9', legendary:'#67e8f9', mythic:'#67e8f9' }
const RL: Record<string,string> = RARITY_LABEL
const RT: Record<string, TierKey> = { common: 'SILVER', uncommon: 'GOLD', rare: 'EMERALD', epic: 'DIAMOND', legendary: 'DIAMOND', mythic: 'DIAMOND' }
const RK: Record<string,number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }

// A booster card (economy.views._open_booster_pack): a shop boost, a HEX amount, or a POI (rarer)
interface Card {
  kind?: 'boost' | 'hex' | 'poi'; rarity: string
  h3_index?: string; poi_name?: string; place_name?: string; category?: string; image_url?: string; description?: string; lat?: number; lon?: number
  code?: string; name?: string; effect_type?: string; note?: string; duration_seconds?: number
  amount?: number; biome?: string; territory_type?: string; is_shiny?: boolean
}
const BOOST_ICON: Record<string, string> = { shield: 'ui_shield', atk_multiplier: 'muscle', def_multiplier: 'castle', hex_bonus: 'hex_coin',
  explore_slots: 'compass', explore_speed: 'lightning', claim_instant: 'lightning', distant_attack: 'target', rare_chance: 'gem',
  trade_discount: 'chart_up', safari_continuous: 'safari_radar', safari_hints: 'crystal_ball', rarity_boost: 'cards', luck_boost: 'clover' }
const cardTitle = (c: Card) => c.kind === 'boost' ? (c.name || 'Boost') : c.kind === 'hex' ? `+${(c.amount || 0).toLocaleString()} HEX` : (c.poi_name || c.place_name || 'Point of interest')
const cardKind = (c: Card) => c.kind === 'boost' ? 'SHOP BOOST' : c.kind === 'hex' ? 'HEX' : 'POINT OF INTEREST'
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
  const common = { serial: 1, maxSupply: 1000, owner: 'VAULT_HOLDER', date: new Date().toISOString().slice(0, 10), clipToHex: true }
  if (card.kind === 'boost') {
    createTokenFace2D(c, { ...common, tier: 'SILVER', rarity: 'uncommon', category: 'SHOP BOOST', catColor: '#cbd5e1', biome: '',
      tokenName: (card.name || 'BOOST').toUpperCase(), description: card.note || '', iconSvg: getIcon(BOOST_ICON[card.effect_type || ''] || 'lightning'), imageSrc: '' })
  } else if (card.kind === 'hex') {
    createTokenFace2D(c, { ...common, tier: card.rarity === 'rare' ? 'GOLD' : 'BRONZE', rarity: card.rarity, category: 'HEX', catColor: '#fbbf24', biome: '',
      tokenName: `+${(card.amount || 0).toLocaleString()} HEX`, description: 'Added to your balance', iconSvg: getIcon('hex_coin'), imageSrc: '' })
  } else {
    createTokenFace2D(c, { ...common, tier: RT[card.rarity] || 'GOLD', rarity: card.rarity, category: (card.category || 'POINT OF INTEREST').toUpperCase(),
      catColor: RC[card.rarity] || '#fbbf24', biome: '', tokenName: (card.poi_name || card.place_name || 'POINT OF INTEREST').toUpperCase(),
      description: card.description || '', iconSvg: iconFor(card.category || 'monument'),
      imageSrc: card.image_url || (card.h3_index ? `/api/tiles/satcard/${card.h3_index}.jpg?v=2` : '') })
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate=true
  ;[400, 900, 1600, 2600, 4000].forEach(ms => setTimeout(() => { t.needsUpdate = true }, ms)); return t
}

/** Card back: the same for every card (the rarity is the surprise), hexagon on a transparent background. */
function mkBackTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width=512; c.height=512; const x=c.getContext('2d')!
  const hex = (r: number) => { x.beginPath(); for (let a=0;a<6;a++){const ag=(Math.PI/3)*a-Math.PI/2; const px=256+r*Math.cos(ag),py=256+r*Math.sin(ag); a===0?x.moveTo(px,py):x.lineTo(px,py)} x.closePath() }
  hex(250); const g=x.createLinearGradient(0,0,512,512); g.addColorStop(0,'#f6c453'); g.addColorStop(0.5,'#b7791f'); g.addColorStop(1,'#f6c453'); x.fillStyle=g; x.fill()
  hex(222); x.fillStyle='#0b1628'; x.fill()
  x.save(); hex(222); x.clip(); x.strokeStyle='rgba(246,196,83,0.16)'; x.lineWidth=2
  for (let y=40;y<480;y+=40) for (let xx=40+((y/40)%2)*20;xx<480;xx+=40) {
    x.beginPath(); for (let a=0;a<6;a++){const ag=(Math.PI/3)*a-Math.PI/6; const px=xx+15*Math.cos(ag),py=y+15*Math.sin(ag); a===0?x.moveTo(px,py):x.lineTo(px,py)} x.closePath();x.stroke() }
  x.restore()
  x.fillStyle='#f6c453'; x.font='64px "Lilita One", sans-serif'; x.textAlign='center'; x.fillText('HEXOD',256,250)
  x.font='bold 120px "Lilita One", Georgia, serif'; x.fillStyle='rgba(246,196,83,0.35)'; x.fillText('?',256,380)
  return new THREE.CanvasTexture(c)
}

const score = (c: Card) => c.kind === 'poi' ? 100 + (RK[c.rarity] || 0) : c.kind === 'hex' ? (c.amount || 0) / 100 : 1

/** Small row at the bottom for the cards already revealed. */
function rowTarget(i: number, n: number, aspect: number) {
  const visH = 2 * 5 * Math.tan((25 * Math.PI) / 180), visW = visH * aspect
  const pitch = Math.min(0.62, (visW * 0.92) / Math.max(1, n))
  return { x: (i - (n - 1) / 2) * pitch, y: -visH / 2 + pitch * 0.62 + 0.15, scale: pitch / 0.78 }
}
const CENTRE_SCALE = 1.75

export function BoosterOpenAnimation({ cards, packName, onClose }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<any>(null)
  const [phase, setPhase] = useState<Phase>('pack')
  const [bestCard, setBestCard] = useState<Card|null>(null)
  const [revealed, setRevealed] = useState(0)
  const [flash, setFlash] = useState<{ color: string; k: number } | null>(null)
  const [cur, setCur] = useState(0)                         // card at the centre
  const [step, setStep] = useState<'hidden' | 'charging' | 'shown'>('hidden')

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
    sRef.current = st; const ck = new THREE.Clock(); st.clock = ck
    const loop = () => { st._r=requestAnimationFrame(loop); const t=ck.getElapsedTime()
      if(st.phase==='pack'){pk.rotation.y=Math.sin(t*0.5)*0.3;pk.rotation.x=Math.sin(t*0.7)*0.05;pk.position.y=Math.sin(t*1.2)*0.08;bm.emissiveIntensity=0.1+Math.sin(t*2)*0.06;rl.position.x=Math.sin(t)*3;rl.position.z=Math.cos(t)*3+2}
      if(st.phase==='explode'){pk.scale.multiplyScalar(0.92);pk.rotation.y+=0.3;pk.rotation.z+=0.1;if(st.prt){const pp=st.prt.pts.geometry.attributes.position;for(let i=0;i<pp.count;i++){pp.array[i*3]+=st.prt.v[i*3]*0.016;pp.array[i*3+1]+=st.prt.v[i*3+1]*0.016;pp.array[i*3+2]+=st.prt.v[i*3+2]*0.016}pp.needsUpdate=true;st.prt.m.opacity*=0.98}}
      if(st.phase==='reveal'||st.phase==='done'){st.cms.forEach((m:any,i:number)=>{if(!m._tgt)return;m.position.lerp(m._tgt,0.08)
        if(m._sc){const k=m.scale.x+(m._sc-m.scale.x)*0.1;m.scale.setScalar(k)}
        const ry=st.fl.has(i)?0:Math.PI;m.rotation.y+=(ry-m.rotation.y)*0.12
        if(st.charge===i){const a=Math.min(1,(t-st.chargeT)/1.2);m.rotation.z=Math.sin(t*38)*0.05*a;m.position.x=m._tgt.x+Math.sin(t*45)*0.03*a;if(m._gm)m._gm.opacity=0.15+0.35*a*(0.6+0.4*Math.sin(t*20))}
        else m.rotation.z*=0.8})}
      ren.render(sc,cam) }
    loop()
    const onR=()=>{const w2=el.clientWidth,h2=el.clientHeight;cam.aspect=w2/h2;cam.updateProjectionMatrix();ren.setSize(w2,h2)
      if(st.cms.length){const n=st.cms.length;st.cms.forEach((m:any,i:number)=>{if(i<(st.cur??0)||st.phase==='done'){const R=rowTarget(i,n,cam.aspect);m._tgt?.set(R.x,R.y,0);m._sc=R.scale}})}}
    window.addEventListener('resize',onR)
    return ()=>{cancelAnimationFrame(st._r);window.removeEventListener('resize',onR);ren.dispose();if(el.contains(ren.domElement))el.removeChild(ren.domElement)}
  }, [])

  // Card i comes face down to the centre
  const bring = (i: number) => {
    const s = sRef.current; const m: any = s?.cms[i]; if (!m) return
    m._tgt.set(0, 0.3, 0.4); m._sc = CENTRE_SCALE; s.cur = i; setCur(i); setStep('hidden')
  }
  const finish = () => {
    const s = sRef.current; if (!s) return
    s.phase = 'done'; setPhase('done'); setRevealed(cards.length)
    s.cms.forEach((m: any, i: number) => { const R = rowTarget(i, cards.length, s.cam.aspect); m._tgt.set(R.x, R.y, 0); m._sc = R.scale; s.fl.add(i); if (m._gm) m._gm.opacity = 0 })
    setBestCard(cards.reduce((a, b) => score(b) > score(a) ? b : a, cards[0]))
  }
  // Tap: reveal the centre card (suspense grows with rarity), or send it to the row and bring the next
  const tap = useCallback(() => {
    const s = sRef.current; if (!s || s.phase !== 'reveal') return
    const i = s.cur, card = cards[i], rk = RK[card?.rarity] || 0
    if (step === 'charging') return
    if (step === 'hidden') {
      setStep('charging'); s.charge = i; s.chargeT = s.clock?.getElapsedTime?.() ?? performance.now() / 1000
      playSound('booster')
      setTimeout(() => {
        s.charge = null; s.fl.add(i); setRevealed(i + 1); setStep('shown')
        playSound(rk >= 4 ? 'card_legendary' : rk >= 3 ? 'card_epic' : rk >= 2 ? 'card_rare' : 'card')
        if (rk >= 2) setFlash({ color: RC[card.rarity] || '#fff', k: i })
        const m: any = s.cms[i]; if (m?._gm) m._gm.opacity = rk >= 2 ? 0.35 : 0
      }, 450 + rk * 350)
      return
    }
    const R = rowTarget(i, cards.length, s.cam.aspect); const m: any = s.cms[i]
    m._tgt.set(R.x, R.y, 0); m._sc = R.scale; if (m._gm) m._gm.opacity = 0
    if (i + 1 < cards.length) bring(i + 1)
    else setTimeout(finish, 350)
  }, [cards, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const doExplode = useCallback(() => {
    const s=sRef.current; if(!s||s.phase!=='pack') return; s.phase='explode'; setPhase('explode')
    s.prt=mkPart(s.sc,300,'#f59e0b',3); const p2=mkPart(s.sc,200,'#ffffff',2)
    const fl=new THREE.PointLight(0xffffff,10,20);fl.position.set(0,0,2);s.sc.add(fl)
    let fi=0;const ff=setInterval(()=>{fl.intensity*=0.9;fi++;if(fi>30){clearInterval(ff);s.sc.remove(fl)}},30)
    setTimeout(()=>{
      s.sc.remove(s.pk);if(s.prt){s.sc.remove(s.prt.pts);s.prt=null};s.sc.remove(p2.pts)
      const n=cards.length
      if(n===0){s.phase='done';setPhase('done');return}
      const backTex=mkBackTex()
      cards.forEach((card,i)=>{
        const geo=new THREE.PlaneGeometry(0.7,0.7)
        const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:mkCardTex(card),transparent:true,alphaTest:0.05}))   // unlit: the face keeps its true colours
        // Back = separate plane turned away (FrontSide). It was BackSide, so it z-fought the face and the
        // revealed cards showed a mirrored 'HEXOD' back instead of the territory.
        const back=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:backTex,metalness:0.3,roughness:0.4,side:THREE.FrontSide,transparent:true,alphaTest:0.05}))
        back.rotation.y=Math.PI;back.position.z=-0.002;mesh.add(back);mesh.rotation.y=Math.PI
        // Face-down pile slightly below centre; the first card rises to the centre
        mesh.position.set(0,-0.2-i*0.02,-0.4-i*0.05);mesh.scale.setScalar(1.6)
        ;(mesh as any)._tgt=new THREE.Vector3(0,-0.2-i*0.02,-0.4-i*0.05);(mesh as any)._sc=1.6
        const gm=new THREE.MeshBasicMaterial({color:RC[card.rarity]||'#fff',transparent:true,opacity:0,side:THREE.DoubleSide})
        const gl=new THREE.Mesh(new THREE.CircleGeometry(0.47,6),gm);gl.rotation.z=Math.PI/6;gl.position.z=-0.01;mesh.add(gl);(mesh as any)._gm=gm
        s.sc.add(mesh);s.cms.push(mesh)})
      s.cur=0;s.phase='reveal';setPhase('reveal');bring(0)
    },900)
  },[cards])

  useEffect(()=>{const el=elRef.current;if(!el)return;const h=()=>{if(phase==='pack')doExplode();else if(phase==='reveal')tap()};el.addEventListener('click',h);return()=>el.removeEventListener('click',h)},[phase,doExplode,tap])

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
      {/* Centre card caption: the revelation, one card at a time */}
      {phase==='reveal' && cards[cur] && (
        <div style={{position:'absolute',left:0,right:0,bottom:'24%',textAlign:'center',pointerEvents:'none',padding:'0 20px'}}>
          {step==='shown' ? (<motion.div key={'c'+cur} initial={{opacity:0,y:10,scale:0.9}} animate={{opacity:1,y:0,scale:1}}>
            <div style={{fontFamily:orb,fontSize:22,color:RC[cards[cur].rarity],textShadow:'0 2px 0 rgba(0,0,0,0.6), 0 0 18px '+RC[cards[cur].rarity]}}>{cards[cur].kind === 'poi' ? `${(RL[cards[cur].rarity]||'').toUpperCase()} · ` : ''}{cardKind(cards[cur])}</div>
            <div style={{fontFamily:orb,fontSize:15,color:'#fff',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cardTitle(cards[cur])}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:6,fontFamily:orb,letterSpacing:1}}>{cur+1<cards.length?`TAP FOR THE NEXT ONE · ${cards.length-cur-1} LEFT`:'TAP TO FINISH'}</div>
          </motion.div>) : (
            <motion.div key={'h'+cur+step} animate={{opacity:[0.5,1,0.5]}} transition={{duration:step==='charging'?0.4:1.4,repeat:Infinity}}
              style={{fontFamily:orb,fontSize:14,color:'#fbbf24',letterSpacing:1}}>{step==='charging'?'…':`TAP TO REVEAL · ${cur+1}/${cards.length}`}</motion.div>
          )}
        </div>
      )}
      {phase==='reveal' && cur+1<cards.length && (
        <button onClick={(e)=>{e.stopPropagation();finish()}} className="hx-chip" style={{position:'absolute',top:20,left:16,zIndex:10,cursor:'pointer'}}>SKIP</button>
      )}
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
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{bestCard.kind === 'poi' ? `${(RL[bestCard.rarity]||'').toUpperCase()} · ` : ''}{cardTitle(bestCard)}</span>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
              {counts.map(({r,n})=>(
                <span key={r} style={{padding:'3px 10px',borderRadius:999,fontSize: 11,fontWeight:700,letterSpacing:0.5,fontFamily:orb,color:RC[r],background:`${RC[r]}18`,border:`2px solid ${RC[r]}44`}}>{n} × {(RL[r]||r).toUpperCase()}</span>
              ))}
            </div>
            <div style={{fontSize:13,color:'#fff',letterSpacing:0.5,fontFamily:orb,textShadow:'0 2px 0 rgba(0,0,0,0.45)'}}>{(() => { const p = cards.filter(c => c.kind === 'poi').length, b = cards.filter(c => c.kind === 'boost').length, h = cards.reduce((a, c) => a + (c.kind === 'hex' ? c.amount || 0 : 0), 0)
              return [p ? `${p} PLACE${p > 1 ? 'S' : ''} ADDED` : '', b ? `${b} BOOST${b > 1 ? 'S' : ''} ACTIVE` : '', h ? `+${h.toLocaleString()} HEX` : ''].filter(Boolean).join(' · ') })()}</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%',maxHeight:170,overflowY:'auto'}}>
              {cards.map((c, i)=>(
                <button key={i} onClick={()=>{ if (c.kind === 'poi' && c.lat != null) { window.dispatchEvent(new CustomEvent('terra:flyto',{detail:{lat:c.lat,lon:c.lon,zoom:15}})); onClose() } }}
                  style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 10px',borderRadius:10,cursor:c.kind === 'poi' ? 'pointer' : 'default',textAlign:'left',
                    background:'rgba(255,255,255,0.06)',border:`2px solid ${RC[c.rarity]||'#9CA3AF'}55`,color:'#e2e8f0',fontSize:12,fontFamily:'var(--font-body)'}}>
                  <IconSVG id={c.kind === 'boost' ? (BOOST_ICON[c.effect_type || ''] || 'lightning') : c.kind === 'hex' ? 'hex_coin' : 'monument'} size={18} />
                  <span style={{flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cardTitle(c)}</span>
                  <span style={{fontSize:10,color:RC[c.rarity],fontFamily:orb}}>{c.kind === 'poi' ? (RL[c.rarity]||'').toUpperCase() : cardKind(c)}</span>
                  {c.kind === 'poi' && <span style={{fontSize:10,color:'#fbbf24',fontFamily:orb}}>SEE</span>}
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
