/**
 * HexCard — collectible territory card, Pokémon-style.
 * 
 * OWNED territory shows 3 tabs:
 *   CARD    — Pokémon face (image, 3 facts, grade) + shiny back with real texture
 *   KINGDOM — Resource production + skill tree (feed with resources)
 *   NFT     — Token ID, authenticity, marketplace link
 *
 * FREE/ENEMY — claim/attack CTA with rarity presentation
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

// Suppress THREE.Clock deprecation
if (typeof window !== 'undefined') {
  const _w = console.warn
  console.warn = (...a: any[]) => { if (String(a[0]).includes('THREE.Clock')) return; _w(...a) }
}

/* ── Rarity config ─────────────────────────────────────────── */
const R: Record<string, { c:string; glow:string; bg:string; accent:string; label:string; grade:string }> = {
  common:   { c:'#9CA3AF', glow:'none',                                   bg:'#0d0f18', accent:'#E5E7EB', label:'Common',    grade:'F' },
  uncommon: { c:'#10B981', glow:'0 0 28px #10B98166',                      bg:'#04100a', accent:'#34D399', label:'Uncommon',  grade:'C' },
  rare:     { c:'#3B82F6', glow:'0 0 36px #3B82F677',                      bg:'#030a1a', accent:'#93C5FD', label:'Rare',      grade:'B' },
  epic:     { c:'#8B5CF6', glow:'0 0 42px #8B5CF688',                      bg:'#07030f', accent:'#C4B5FD', label:'Epic',      grade:'A' },
  legendary:{ c:'#F59E0B', glow:'0 0 52px #F59E0BAA,0 0 90px #F59E0B33',  bg:'#0f0700', accent:'#FCD34D', label:'Legendary', grade:'S' },
  mythic:   { c:'#EC4899', glow:'0 0 62px #EC4899BB,0 0 110px #EC489933', bg:'#0f0008', accent:'#F9A8D4', label:'Mythic ✦',  grade:'SS' },
}
type RK = keyof typeof R

const BIOME_RESOURCES: Record<string, { res: string; icon: string; amount: number }[]> = {
  urban:      [{ res:'Données',       icon:'📊', amount:12 }, { res:'Influence politique', icon:'🌐', amount:8  }, { res:'Main d\'œuvre', icon:'👷', amount:15 }],
  rural:      [{ res:'Nourriture',    icon:'🌾', amount:20 }, { res:'Eau',                  icon:'💧', amount:15 }, { res:'Main d\'œuvre', icon:'👷', amount:10 }],
  forest:     [{ res:'Nourriture',    icon:'🌾', amount:15 }, { res:'Eau',                  icon:'💧', amount:12 }, { res:'Stabilité',     icon:'⚖️', amount:8  }],
  mountain:   [{ res:'Fer',           icon:'🪨', amount:18 }, { res:'Titanium',             icon:'🔷', amount:5  }, { res:'Charbon',       icon:'⬛', amount:10 }],
  coastal:    [{ res:'Nourriture',    icon:'🌾', amount:12 }, { res:'Eau',                  icon:'💧', amount:20 }, { res:'Gaz naturel',   icon:'💨', amount:8  }],
  desert:     [{ res:'Pétrole',       icon:'🛢️', amount:15 }, { res:'Silicium',             icon:'💠', amount:10 }, { res:'Terres rares',  icon:'💎', amount:4  }],
  tundra:     [{ res:'Gaz naturel',   icon:'💨', amount:12 }, { res:'Uranium',              icon:'☢️', amount:3  }, { res:'Eau',           icon:'💧', amount:8  }],
  industrial: [{ res:'Acier',         icon:'⚙️', amount:15 }, { res:'Composants',           icon:'🔌', amount:8  }, { res:'Pétrole',       icon:'🛢️', amount:10 }],
  landmark:   [{ res:'Données',       icon:'📊', amount:10 }, { res:'Influence politique',  icon:'🌐', amount:12 }, { res:'Stabilité',     icon:'⚖️', amount:10 }],
  grassland:  [{ res:'Nourriture',    icon:'🌾', amount:18 }, { res:'Main d\'œuvre',        icon:'👷', amount:8  }, { res:'Stabilité',     icon:'⚖️', amount:6  }],
}

const BRANCH_CFG = {
  attack:    { label:'⚔️ Attaque',      color:'#EF4444' },
  defense:   { label:'🛡️ Défense',      color:'#3B82F6' },
  economy:   { label:'💰 Économie',     color:'#F59E0B' },
  influence: { label:'🌐 Rayonnement',  color:'#10B981' },
  tech:      { label:'🔬 Tech',         color:'#8B5CF6' },
}

/* ── 3D Card Mesh ──────────────────────────────────────────── */
function HexPrism({ imgUrl, cfg, isShiny, foilColor, showBack }: {
  imgUrl: string|null; cfg: typeof R[RK]; isShiny: boolean; foilColor: string; showBack: boolean
}) {
  const meshRef = useRef<THREE.Group>(null!)
  const velY = useRef(-0.3)
  const velX = useRef(0)
  const { gl } = useThree()

  useEffect(() => {
    const c = gl.domElement
    let drag=false, lx=0, ly=0
    const pd = (e: PointerEvent) => { drag=true; lx=e.clientX; ly=e.clientY; velY.current=0; velX.current=0 }
    const pm = (e: PointerEvent) => { if(!drag) return; velY.current=(e.clientX-lx)*0.025; velX.current=-(e.clientY-ly)*0.015; lx=e.clientX; ly=e.clientY }
    const pu = () => { drag=false }
    c.addEventListener('pointerdown',pd); window.addEventListener('pointermove',pm); window.addEventListener('pointerup',pu)
    return () => { c.removeEventListener('pointerdown',pd); window.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu) }
  }, [gl])

  useFrame(() => {
    velY.current *= 0.93; velX.current *= 0.93
    meshRef.current.rotation.y += velY.current
    meshRef.current.rotation.x = Math.max(-0.8, Math.min(0.8, meshRef.current.rotation.x + velX.current))
  })

  // Hex shape
  const hexShape = useMemo(() => {
    const s = new THREE.Shape()
    for (let i=0; i<6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6
      const x = 1.5*Math.cos(a), y = 1.5*Math.sin(a)
      i===0 ? s.moveTo(x,y) : s.lineTo(x,y)
    }
    s.closePath(); return s
  }, [])

  const geo = useMemo(() => new THREE.ExtrudeGeometry(hexShape, {
    depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4,
  }), [hexShape])

  // Face textures
  const frontCanvas = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width=cv.height=512
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = cfg.bg; ctx.fillRect(0,0,512,512)
    // Rarity badge
    ctx.font='bold 28px system-ui'; ctx.fillStyle=cfg.c; ctx.textAlign='center'
    ctx.fillText(cfg.label.toUpperCase(), 256, 44)
    if (isShiny) { ctx.font='22px system-ui'; ctx.fillStyle='#FCD34D'; ctx.fillText('✨ SHINY', 256, 72) }
    return cv
  }, [cfg, isShiny])

  const backCanvas = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width=cv.height=512
    const ctx = cv.getContext('2d')!
    // Rich shiny back
    const grad = ctx.createLinearGradient(0,0,512,512)
    if (isShiny) {
      grad.addColorStop(0, cfg.bg)
      grad.addColorStop(0.3, cfg.c+'33')
      grad.addColorStop(0.5, '#FFD70022')
      grad.addColorStop(0.7, cfg.c+'33')
      grad.addColorStop(1, cfg.bg)
    } else {
      grad.addColorStop(0, cfg.bg); grad.addColorStop(1, '#0a0a18')
    }
    ctx.fillStyle = grad; ctx.fillRect(0,0,512,512)
    // Hex watermark pattern
    ctx.globalAlpha = 0.08; ctx.font='40px monospace'; ctx.fillStyle=cfg.c
    for (let y=40; y<512; y+=70) for (let x=(y%140<70?0:50); x<512; x+=100) ctx.fillText('⬡', x, y)
    ctx.globalAlpha = 1
    // Center logo
    ctx.font='bold 48px monospace'; ctx.fillStyle=cfg.c; ctx.textAlign='center'; ctx.fillText('⬡', 256, 220)
    ctx.font='bold 26px system-ui'; ctx.fillStyle=cfg.accent; ctx.fillText('HEXOD', 256, 290)
    ctx.font='16px system-ui'; ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillText('Season 1', 256, 316)
    return cv
  }, [cfg, isShiny])

  const frontTex = useMemo(() => new THREE.CanvasTexture(frontCanvas), [frontCanvas])
  const backTex  = useMemo(() => new THREE.CanvasTexture(backCanvas),  [backCanvas])

  const [imgTex, setImgTex] = useState<THREE.Texture|null>(null)
  useEffect(() => {
    if (!imgUrl) return
    new THREE.TextureLoader().load(imgUrl, tex => { tex.colorSpace=THREE.SRGBColorSpace; setImgTex(tex) }, undefined, ()=>setImgTex(null))
  }, [imgUrl])

  const color = new THREE.Color(cfg.c)
  const mats = useMemo(() => [
    new THREE.MeshStandardMaterial({ color: cfg.c, metalness:0.8, roughness:0.2, envMapIntensity:1.2 }),
    new THREE.MeshStandardMaterial({ color: cfg.c, metalness:0.6, roughness:0.3, envMapIntensity:0.8 }),
    new THREE.MeshStandardMaterial({ color:'#111' }),
    new THREE.MeshStandardMaterial({ color:'#111' }),
    // Front
    new THREE.MeshStandardMaterial({
      map: imgTex || frontTex, metalness:0.1, roughness:0.6,
      emissive: color.clone().multiplyScalar(0.12), envMapIntensity:0.5,
    }),
    // Back
    new THREE.MeshStandardMaterial({
      map: backTex, metalness: isShiny ? 0.9 : 0.2, roughness: isShiny ? 0.05 : 0.7,
      envMapIntensity: isShiny ? 2.0 : 0.5,
    }),
  ], [imgTex, frontTex, backTex, cfg, isShiny])

  return (
    <group ref={meshRef} rotation={[0.1, showBack ? Math.PI : -0.15, 0]}>
      <mesh geometry={geo} material={mats} />
      <pointLight position={[0,0,3]} intensity={0.6} color={cfg.c} />
    </group>
  )
}

/* ── Main HexCard component ────────────────────────────────── */
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

  const cardName  = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const imgUrl    = t.poi_wiki_url || null
  const biomeResources = BIOME_RESOURCES[t.territory_type || 'rural'] || BIOME_RESOURCES.rural
  const income    = Math.round(t.resource_credits || t.food_per_tick || 10)

  const [tab, setTab]       = useState<'card'|'kingdom'|'nft'>('card')
  const [showBack, setShowBack] = useState(false)
  const [showSkillTree, setShowSkillTree] = useState(false)

  // Fun facts from POI description
  const facts = useMemo(() => {
    const desc = t.poi_description || ''
    const fact = t.poi_fun_fact    || ''
    const result = []
    if (t.poi_visitors) result.push(`${(t.poi_visitors/1e6).toFixed(1)}M visiteurs / an`)
    if (t.poi_geo_score) result.push(`Score géopolitique : ${t.poi_geo_score}/100`)
    if (fact) result.push(fact.slice(0,80))
    if (result.length < 3 && desc) result.push(desc.slice(0,80))
    while (result.length < 3) result.push('Territoire unique · Hexod Season 1')
    return result.slice(0,3)
  }, [t])

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target===e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:1200,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
        background:'rgba(0,0,0,0.92)', backdropFilter:'blur(20px)',
        padding:'12px 16px',
      }}
    >
      {/* Ambient glow */}
      {cfg.glow !== 'none' && (
        <div style={{ position:'absolute', width:460, height:460, pointerEvents:'none',
          background:`radial-gradient(ellipse 55% 55% at 50% 42%, ${cfg.c}1a 0%, transparent 70%)`,
          filter:'blur(50px)' }} />
      )}

      {/* 3D card */}
      <div style={{ width:260, height:290, cursor:'grab', zIndex:1, flexShrink:0 }}>
        <Canvas camera={{ position:[0,0,4.2], fov:44 }} gl={{ antialias:true, alpha:true }}
          style={{ background:'transparent' }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <pointLight position={[3,4,3]} intensity={1.5} />
            <pointLight position={[-2,-2,2]} intensity={0.5} color={cfg.c} />
            <Environment preset="city" />
            <HexPrism imgUrl={imgUrl} cfg={cfg} isShiny={isShiny} foilColor={cfg.c} showBack={showBack} />
          </Suspense>
        </Canvas>
      </div>

      {/* Card identity + flip button */}
      <div style={{ display:'flex', alignItems:'center', gap:10, zIndex:1 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>{cardName}</div>
          <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:3 }}>
            <Chip color={cfg.c}>{cfg.label}</Chip>
            {isShiny && <Chip color="#FCD34D">✨ Shiny</Chip>}
            {t.poi_category && <Chip color="#6B7280">{t.poi_category}</Chip>}
            <Chip color={cfg.c} big>GRADE {cfg.grade}</Chip>
          </div>
        </div>
        <button onClick={() => setShowBack(v=>!v)} style={{
          padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700,
          background:`${cfg.c}18`, border:`1px solid ${cfg.c}44`, color:cfg.c,
          flexShrink:0,
        }}>{showBack ? '🃏 Face' : '🔄 Dos'}</button>
      </div>

      {/* Info panel */}
      {isOwned ? (
        <div style={{ width:320, background:'rgba(4,4,12,0.99)', border:`1px solid ${cfg.c}44`,
          borderRadius:14, overflow:'hidden', zIndex:1, maxHeight:'45vh', display:'flex', flexDirection:'column' }}>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:`1px solid ${cfg.c}22`, flexShrink:0 }}>
            {(['card','kingdom','nft'] as const).map(tb => (
              <button key={tb} onClick={() => setTab(tb)} style={{
                flex:1, padding:'8px 0', border:'none', cursor:'pointer', fontSize:10, fontWeight:tab===tb?800:400,
                background: tab===tb ? `${cfg.c}14` : 'transparent',
                borderBottom:`2px solid ${tab===tb ? cfg.c : 'transparent'}`,
                color: tab===tb ? cfg.c : '#4B5563',
              }}>
                {tb==='card' ? '🃏 Carte' : tb==='kingdom' ? '⚗️ Royaume' : '💎 NFT'}
              </button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
            {tab==='card' && (
              <div>
                {/* Pokémon-style facts */}
                <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10,
                  background:`${cfg.c}0e`, border:`1px solid ${cfg.c}22` }}>
                  {imgUrl && (
                    <img src={imgUrl} alt={cardName}
                      style={{ width:'100%', height:80, objectFit:'cover', borderRadius:7, marginBottom:8 }}
                      onError={e => { (e.target as HTMLImageElement).style.display='none' }}
                    />
                  )}
                  <div style={{ fontSize:11, fontWeight:800, color:cfg.accent, marginBottom:6 }}>Caractéristiques</div>
                  {facts.map((f,i) => (
                    <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:5 }}>
                      <span style={{ color:cfg.c, fontWeight:700, flexShrink:0 }}>#{i+1}</span>
                      <span style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6B7280' }}>
                  <span>H3: <span style={{ fontFamily:'monospace', color:'#4B5563' }}>{(t.h3_index||'').slice(0,12)}</span></span>
                  <span style={{ color:cfg.c, fontWeight:800 }}>Grade {cfg.grade}</span>
                </div>
              </div>
            )}

            {tab==='kingdom' && (
              <KingdomTab t={t} cfg={cfg} biomeResources={biomeResources} income={income}
                clusterId={t.owner_kingdom_id} onOpenTree={() => setShowSkillTree(true)} />
            )}

            {tab==='nft' && (
              <NFTTab t={t} cfg={cfg} />
            )}
          </div>
        </div>
      ) : (
        /* Free or enemy — simple panel */
        <div style={{ width:300, background:'rgba(4,4,12,0.99)', border:`1px solid ${cfg.c}44`,
          borderRadius:14, padding:'12px 14px', zIndex:1 }}>
          {t.poi_description && (
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:10, lineHeight:1.5 }}>
              {t.poi_description.slice(0,120)}{t.poi_description.length>120?'…':''}
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginBottom:12, fontSize:11 }}>
            <span style={{ color:'#F59E0B' }}>💰 +{income}/tick</span>
            {t.poi_floor_price && <span style={{ color:cfg.c }}>💎 {t.poi_floor_price} TDI</span>}
            {(isEnemy) && <span style={{ color:'#F87171' }}>👤 {t.owner_username}</span>}
          </div>
          {isFree && player && (
            <button onClick={onRequestClaim} style={{
              width:'100%', padding:'12px', border:'none', borderRadius:10, cursor:'pointer',
              background:`linear-gradient(135deg,${cfg.c}cc,${cfg.c})`,
              color:['legendary','mythic','epic'].includes(rarity)?'#000':'#fff',
              fontSize:14, fontWeight:900,
              boxShadow: cfg.glow!=='none' ? `0 4px 24px ${cfg.c}55` : undefined,
            }}>🏴 Revendiquer</button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              width:'100%', padding:'12px', borderRadius:10, cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.1)',
              color:'#EF4444', fontSize:13, fontWeight:700,
            }}>⚔️ Attaquer · 💸 Acheter · 🧩 Puzzle</button>
          )}
        </div>
      )}

      {/* Kingdom skill tree overlay */}
      <AnimatePresence>
        {showSkillTree && (
          <KingdomSkillTreeInline
            clusterId={t.owner_kingdom_id || 'main'}
            cfg={cfg}
            onClose={() => setShowSkillTree(false)}
          />
        )}
      </AnimatePresence>

      <div style={{ fontSize:9, color:'#1F2937', zIndex:1 }}>Glisser pour tourner · Cliquer hors de la carte pour fermer</div>
    </motion.div>
  )
}

/* ── Kingdom Tab ───────────────────────────────────────────── */
function KingdomTab({ t, cfg, biomeResources, income, clusterId, onOpenTree }: any) {
  const { data: kingdom } = useQuery({
    queryKey: ['territory-kingdom', t.h3_index],
    queryFn: () => api.get(`/territories-geo/territory-kingdom/?h3=${t.h3_index}`).then(r => r.data.kingdom),
    staleTime: 30000,
    enabled: !!t.h3_index,
  })

  return (
    <div>
      {/* Kingdom status */}
      {kingdom && (
        <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:8,
          background: kingdom.is_main ? `${cfg.c}0e` : 'rgba(255,255,255,0.04)',
          border:`1px solid ${kingdom.is_main ? cfg.c+'33' : 'rgba(255,255,255,0.07)'}` }}>
          <div style={{ fontSize:11, fontWeight:700, color: kingdom.is_main ? cfg.c : '#6B7280' }}>
            {kingdom.is_main ? '👑 Royaume Principal' : kingdom.size<=1 ? '🏴 Territoire Isolé' : '🏰 Royaume Secondaire'}
          </div>
          <div style={{ fontSize:10, color:'#4B5563', marginTop:2 }}>
            {kingdom.size} territoire{kingdom.size>1?'s':''} · Tier {kingdom.tier}
            {kingdom.is_main ? '' : kingdom.size<=1 ? ' · Arbre repart à 0' : ''}
          </div>
        </div>
      )}

      {/* Resource production */}
      <div style={{ fontSize:9, color:'#4B5563', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
        Production / cycle
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
        {biomeResources.map((r: any) => (
          <div key={r.res} style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'7px 6px', textAlign:'center' }}>
            <div style={{ fontSize:14 }}>{r.icon}</div>
            <div style={{ fontSize:11, fontWeight:800, color:cfg.c, fontFamily:'monospace' }}>+{r.amount}</div>
            <div style={{ fontSize:8, color:'#4B5563', marginTop:1, lineHeight:1.2 }}>{r.res.slice(0,10)}</div>
          </div>
        ))}
        <div style={{ background:`${cfg.c}0e`, borderRadius:7, padding:'7px 6px', textAlign:'center',
          border:`1px solid ${cfg.c}22` }}>
          <div style={{ fontSize:14 }}>💠</div>
          <div style={{ fontSize:11, fontWeight:800, color:cfg.c, fontFamily:'monospace' }}>+{income}</div>
          <div style={{ fontSize:8, color:cfg.c, marginTop:1 }}>Cristaux</div>
        </div>
      </div>

      {/* Open skill tree */}
      <button onClick={onOpenTree} style={{
        width:'100%', padding:'11px', border:'none', borderRadius:10, cursor:'pointer',
        background:`linear-gradient(135deg,${cfg.c}cc,${cfg.c})`,
        color:['legendary','mythic','epic'].includes(t.rarity||'common')?'#000':'#fff',
        fontSize:13, fontWeight:900,
      }}>
        🔬 Arbre des Compétences du Royaume →
      </button>
    </div>
  )
}

/* ── NFT Tab ───────────────────────────────────────────────── */
function NFTTab({ t, cfg }: any) {
  const tokenId = t.token_id || `HEX-${(t.h3_index||'').slice(0,8).toUpperCase()}`
  return (
    <div>
      <div style={{ padding:'12px', background:'rgba(139,92,246,0.08)', borderRadius:10,
        border:'1px solid rgba(139,92,246,0.2)', marginBottom:10 }}>
        <div style={{ fontSize:10, color:'#A78BFA', fontWeight:700, marginBottom:6 }}>Identité Unique</div>
        <KV label="Token ID"    val={tokenId} mono />
        <KV label="H3 Index"   val={(t.h3_index||'').slice(0,18)+'…'} mono />
        <KV label="Edition"    val="Genesis · Season 1" />
        <KV label="Rareté"     val={cfg.label} color={cfg.c} />
        <KV label="Grade"      val={cfg.grade} color={cfg.c} />
        {t.is_shiny && <KV label="Shiny" val="✨ 1/64 — Rarissime" color="#FCD34D" />}
        {t.poi_floor_price && <KV label="Floor NFT" val={`${t.poi_floor_price} TDI`} color={cfg.c} />}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button style={{
          flex:1, padding:'10px', border:`1px solid ${cfg.c}44`, borderRadius:9, cursor:'pointer',
          background:`${cfg.c}14`, color:cfg.c, fontSize:11, fontWeight:700,
        }}>💎 Minter NFT</button>
        <button style={{
          flex:1, padding:'10px', border:'1px solid rgba(59,130,246,0.35)', borderRadius:9, cursor:'pointer',
          background:'rgba(59,130,246,0.1)', color:'#60A5FA', fontSize:11, fontWeight:700,
        }}>🏪 Marketplace →</button>
      </div>
    </div>
  )
}

/* ── Kingdom Skill Tree inline overlay ─────────────────────── */
function KingdomSkillTreeInline({ clusterId, cfg, onClose }: any) {
  const [branch, setBranch] = useState('attack')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['kingdom-skills', clusterId],
    queryFn: () => api.get(`/territories-geo/kingdom-skill-tree/?cluster_id=${clusterId}`).then(r => r.data),
    staleTime: 15000,
  })

  const unlock = useMutation({
    mutationFn: (id:number) => api.post('/territories-geo/kingdom-unlock-skill/', { cluster_id:clusterId, skill_id:id }),
    onSuccess: () => { toast.success('Compétence débloquée!'); qc.invalidateQueries({ queryKey:['kingdom-skills',clusterId] }) },
    onError: (e:any) => toast.error(e?.response?.data?.error || 'Ressources insuffisantes'),
  })

  const tree: Record<string,any[]> = data?.tree || {}
  const kingdom = data?.kingdom || {}
  const skills = tree[branch] || []
  const branchCfg = BRANCH_CFG[branch as keyof typeof BRANCH_CFG]

  return (
    <motion.div
      initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:40 }}
      style={{
        position:'fixed', inset:0, zIndex:1300,
        display:'flex', alignItems:'flex-end', justifyContent:'center',
        background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)',
        padding:'0 8px 8px',
      }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{ width:'100%', maxWidth:500, background:'rgba(4,4,12,0.99)',
        border:`2px solid ${cfg.c}44`, borderRadius:'16px 16px 0 0',
        maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${cfg.c}22`,
          background:`linear-gradient(90deg,${cfg.c}18,transparent)`,
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🔬 Arbre des Compétences</div>
            <div style={{ fontSize:10, color:cfg.c }}>
              {kingdom.is_main ? '👑 Royaume Principal' : '🏴 Royaume Isolé'} · {data?.unlocked_count||0} débloquées
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* Resources header */}
        {kingdom.resources && (
          <div style={{ padding:'8px 14px', borderBottom:`1px solid ${cfg.c}14`, flexShrink:0,
            display:'flex', gap:6, flexWrap:'wrap' }}>
            {Object.entries({
              '🪨':kingdom.resources.fer, '🛢️':kingdom.resources.petrole,
              '💠':kingdom.resources.silicium, '📊':kingdom.resources.donnees,
              '💎':kingdom.resources.hex_cristaux, '🌐':kingdom.resources.influence,
            }).filter(([,v])=>(v as number)>0).map(([icon,val])=>(
              <div key={icon} style={{ display:'flex', alignItems:'center', gap:3,
                padding:'2px 7px', borderRadius:5, background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize:11 }}>{icon}</span>
                <span style={{ fontSize:10, color:'#9CA3AF', fontFamily:'monospace' }}>{Math.round(val as number)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Branch tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid rgba(255,255,255,0.05)`, flexShrink:0, overflowX:'auto' }}>
          {Object.entries(BRANCH_CFG).map(([id,bc])=>{
            const bs=tree[id]||[]; const bu=bs.filter((s:any)=>s.unlocked).length
            return (
              <button key={id} onClick={()=>setBranch(id)} style={{
                flex:'0 0 auto', padding:'8px 12px', border:'none', cursor:'pointer',
                background: branch===id ? `${bc.color}18` : 'transparent',
                borderBottom:`2px solid ${branch===id?bc.color:'transparent'}`,
                color: branch===id ? bc.color : '#4B5563', fontSize:10, fontWeight:branch===id?800:400,
                whiteSpace:'nowrap',
              }}>
                {bc.label.split(' ')[0]}<span style={{ opacity:0.7 }}> {bu}/{bs.length}</span>
              </button>
            )
          })}
        </div>

        {/* Skills */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {skills.map((s:any, i:number) => (
            <div key={s.id} style={{ position:'relative' }}>
              {/* Connector */}
              {i>0 && <div style={{ position:'absolute', left:21, top:-8, width:2, height:16,
                background: s.unlocked ? branchCfg.color : 'rgba(255,255,255,0.08)' }} />}

              <div style={{ display:'flex', gap:10, padding:'10px 12px', marginBottom:6, borderRadius:10,
                background: s.unlocked ? `${branchCfg.color}0f` : 'rgba(255,255,255,0.03)',
                border:`1px solid ${s.unlocked ? branchCfg.color+'33' : 'rgba(255,255,255,0.06)'}` }}>

                <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                  background: s.unlocked ? `${branchCfg.color}22` : 'rgba(255,255,255,0.05)',
                  border:`2px solid ${s.unlocked ? branchCfg.color+'55' : 'rgba(255,255,255,0.08)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                  {s.icon}
                </div>

                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:800, color: s.unlocked?'#fff':'#9CA3AF' }}>{s.name}</div>
                  <div style={{ fontSize:10, color: s.unlocked ? branchCfg.color : '#6B7280', marginTop:1 }}>{s.effect}</div>
                  {!s.unlocked && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:5 }}>
                      {s.cost_json.map((c:string)=>(
                        <span key={c} style={{ fontSize:9, padding:'2px 6px', borderRadius:4,
                          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)',
                          color:'#9CA3AF' }}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>

                {s.unlocked
                  ? <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0,
                      background:branchCfg.color, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:11, fontWeight:900, color:'#000' }}>✓</div>
                  : !kingdom.is_main
                  ? <div style={{ fontSize:16 }}>🔒</div>
                  : <button onClick={()=>unlock.mutate(s.id)} disabled={unlock.isPending} style={{
                      padding:'5px 10px', border:'none', borderRadius:7, cursor:'pointer',
                      background:`linear-gradient(135deg,${branchCfg.color}cc,${branchCfg.color})`,
                      color:'#000', fontSize:10, fontWeight:900, flexShrink:0,
                    }}>{unlock.isPending?'…':'Unlock'}</button>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */
function Chip({ children, color, big }: any) {
  return <span style={{ fontSize: big?11:9, padding: big?'3px 9px':'2px 6px', borderRadius:4,
    background:`${color}18`, color, border:`1px solid ${color}33`, fontWeight:700 }}>{children}</span>
}
function KV({ label, val, color, mono }: any) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0',
      borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:11 }}>
      <span style={{ color:'#6B7280' }}>{label}</span>
      <span style={{ color:color||'#E5E7EB', fontWeight:600, fontFamily:mono?'monospace':undefined }}>{val}</span>
    </div>
  )
}
