import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../store'

const RARITY = {
  common:   { c:'#9CA3AF', glow:'none',                                        bg:'#0d0f18', shine:'none',                       label:'Common'    },
  uncommon: { c:'#10B981', glow:'0 0 40px #10B98177',                          bg:'#03100a', shine:'rgba(16,185,129,0.3)',        label:'Uncommon'  },
  rare:     { c:'#3B82F6', glow:'0 0 50px #3B82F688',                          bg:'#020818', shine:'rgba(59,130,246,0.35)',       label:'Rare'      },
  epic:     { c:'#8B5CF6', glow:'0 0 55px #8B5CF699',                          bg:'#060310', shine:'rgba(139,92,246,0.4)',        label:'Epic'      },
  legendary:{ c:'#F59E0B', glow:'0 0 65px #F59E0BAA,0 0 120px #F59E0B33',     bg:'#100800', shine:'rgba(245,158,11,0.5)',        label:'Legendary' },
  mythic:   { c:'#EC4899', glow:'0 0 75px #EC4899BB,0 0 140px #EC489933',      bg:'#100008', shine:'rgba(236,72,153,0.55)',       label:'Mythic ✦'  },
} as const
type RK = keyof typeof RARITY

const BIOME: Record<string, string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿',
}

// Pointy-top hex, snug in 220×254 viewBox
const HEX  = '110,3  215,57  215,199  110,253  5,199   5,57'
const HEXIN= '110,9  208,61  208,194  110,247  12,194  12,61'

export function HexCard({ territory:t, onClose, onRequestClaim }:{
  territory:any; onClose:()=>void; onRequestClaim:()=>void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const rarity  = (t.rarity || 'common') as RK
  const cfg     = RARITY[rarity] ?? RARITY.common
  const isShiny = !!t.is_shiny

  // Hex = POI if one exists — full identity from POI
  const cardName = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const cardEmoji= t.custom_emoji || t.poi_emoji || BIOME[t.territory_type||'rural'] || '⬡'
  const cardImg  = t.poi_wiki_url || null
  const cardType = t.poi_category || t.territory_type || 'rural'
  const cardDesc = t.poi_description || null
  const cardFact = t.poi_fun_fact || null
  const income   = Math.round(t.resource_credits || t.food_per_tick || 10)

  /* ── 3D rotation via direct DOM ──────────────────────────── */
  const sceneRef = useRef<HTMLDivElement>(null)
  const rotY = useRef(0)
  const rotX = useRef(8)
  const velY = useRef(-0.35)
  const velX = useRef(0)
  const drag = useRef(false)
  const lx = useRef(0), ly = useRef(0)
  const raf = useRef<number>()

  const applyTransform = () => {
    if (!sceneRef.current) return
    sceneRef.current.style.transform =
      `perspective(900px) rotateX(${rotX.current.toFixed(2)}deg) rotateY(${rotY.current.toFixed(2)}deg)`
  }

  const loop = () => {
    if (!drag.current) {
      velY.current *= 0.94
      velX.current *= 0.94
    }
    rotY.current += velY.current
    rotX.current  = Math.max(-55, Math.min(55, rotX.current + velX.current))
    applyTransform()
    raf.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    applyTransform()
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current!)
  }, [])

  const onPD = (e: React.PointerEvent) => {
    drag.current = true
    velY.current = 0; velX.current = 0
    lx.current = e.clientX; ly.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onPM = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - lx.current
    const dy = e.clientY - ly.current
    velY.current = dx * 0.8; velX.current = -dy * 0.5
    rotY.current += dx * 0.8
    rotX.current  = Math.max(-55, Math.min(55, rotX.current - dy * 0.5))
    applyTransform()
    lx.current = e.clientX; ly.current = e.clientY
  }
  const onPU = () => { drag.current = false }

  /* ── specular light ──────────────────────────────────────── */
  const [sx, setSx] = useState(50), [sy, setSy] = useState(38)
  const onMM = (e: React.MouseEvent) => {
    const b = sceneRef.current?.getBoundingClientRect()
    if (!b) return
    setSx((e.clientX - b.left) / b.width * 100)
    setSy((e.clientY - b.top)  / b.height * 100)
  }

  /* ── foil sweep ──────────────────────────────────────────── */
  const [foil, setFoil] = useState(-130)
  useEffect(() => {
    if (!isShiny) return
    const sweep = () => {
      let f = -130
      const id = setInterval(() => { f += 12; setFoil(f); if (f > 160) clearInterval(id) }, 14)
    }
    sweep(); const id = setInterval(sweep, 3600); return () => clearInterval(id)
  }, [isShiny])

  /* ── derived back face visibility ───────────────────────── */
  const normY = ((rotY.current % 360) + 360) % 360
  const onBack = normY > 90 && normY < 270

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:1200,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:18,
        background:'rgba(0,0,0,0.93)', backdropFilter:'blur(20px)',
      }}
    >
      {/* Cinematic ambient glow behind card */}
      {cfg.glow !== 'none' && (
        <div style={{
          position:'absolute', width:400, height:500,
          background:`radial-gradient(ellipse 60% 70% at 50% 46%, ${cfg.c}20 0%, transparent 75%)`,
          filter:'blur(48px)', pointerEvents:'none',
        }}/>
      )}

      {/* ── Card 3D scene ── */}
      <div
        ref={sceneRef}
        onPointerDown={onPD} onPointerMove={onPM}
        onPointerUp={onPU} onPointerCancel={onPU}
        onMouseMove={onMM}
        style={{
          transformStyle: 'preserve-3d',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          position: 'relative',
          width: 264, height: 304,
          // Large drop-shadow = perceived depth / thickness
          filter: `
            drop-shadow(0 0 ${cfg.glow !== 'none' ? '22px' : '0px'} ${cfg.c}88)
            drop-shadow(0 8px 2px rgba(0,0,0,0.9))
            drop-shadow(0 16px 6px rgba(0,0,0,0.7))
            drop-shadow(0 32px 16px rgba(0,0,0,0.5))
          `,
        }}
      >
        {/* FRONT face */}
        <div style={{
          position:'absolute', inset:0,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
        }}>
          <svg viewBox="0 0 220 256" width={264} height={304} style={{ display:'block' }}>
            <defs>
              <clipPath id={`cc-${rarity}`}><polygon points={HEXIN}/></clipPath>

              {/* Specular gradient */}
              <radialGradient id={`sp-${rarity}`} cx={`${sx}%`} cy={`${sy}%`} r="58%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.2)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
              </radialGradient>

              {/* Image bottom fade */}
              {cardImg && (
                <linearGradient id={`gf-${rarity}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="42%" stopColor={cfg.bg} stopOpacity="0"/>
                  <stop offset="100%" stopColor={cfg.bg} stopOpacity="0.92"/>
                </linearGradient>
              )}
            </defs>

            {/* ── Hex body ── */}
            <polygon points={HEX} fill={cfg.bg}/>

            {/* Thick edge illusion — stacked strokes at slightly different opacities */}
            <polygon points={HEX} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12"/>
            <polygon points={HEX} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7"/>
            <polygon points={HEX} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3"/>

            {/* ── POI Image ── */}
            {cardImg && <>
              <image href={cardImg}
                x="5" y="5" width="210" height="246"
                clipPath={`url(#cc-${rarity})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ opacity: 0.78 }}
              />
              <polygon points={HEXIN} fill={`url(#gf-${rarity})`}/>
            </>}

            {/* ── Emoji fallback ── */}
            {!cardImg && (
              <text x="110" y="132" textAnchor="middle" dominantBaseline="central"
                fontSize="70" style={{ userSelect:'none' }}>{cardEmoji}</text>
            )}

            {/* ── Specular sheen ── */}
            <polygon points={HEX} fill={`url(#sp-${rarity})`}
              style={{ mixBlendMode:'screen', pointerEvents:'none' }}/>

            {/* ── Foil sweep (shiny only) ── */}
            {isShiny && (
              <rect x={foil} y="-10" width="72" height="280"
                fill={cfg.shine}
                clipPath={`url(#cc-${rarity})`}
                transform="skewX(-20)"
                style={{ pointerEvents:'none' }}/>
            )}

            {/* ── Borders ── */}
            {/* Outer border */}
            <polygon points={HEX} fill="none" stroke={cfg.c} strokeWidth="3.5"/>
            {/* Inner line */}
            <polygon points={HEXIN} fill="none" stroke={cfg.c} strokeWidth="0.6" strokeOpacity="0.5"/>
            {/* Dashed ring for epic+ */}
            {(['epic','legendary','mythic'] as RK[]).includes(rarity) && (
              <polygon points={HEX} fill="none"
                stroke={cfg.c} strokeWidth="1.2" strokeOpacity="0.2"
                strokeDasharray="10,6"
                transform="scale(1.05,1.04) translate(-5.5,-5.5)"/>
            )}

            {/* ── Rarity badge ── */}
            <rect x="68" y="11" width="84" height="20" rx="10"
              fill={`${cfg.c}2a`} stroke={cfg.c} strokeWidth="1"/>
            <text x="110" y="24" textAnchor="middle" dominantBaseline="central"
              fill={cfg.c} fontSize="9.5" fontWeight="900" letterSpacing="1.8"
              fontFamily="system-ui">{cfg.label.toUpperCase()}</text>
            {isShiny && (
              <text x="110" y="40" textAnchor="middle"
                fill="#FCD34D" fontSize="8.5" fontFamily="system-ui" fontWeight="700">
                ✨ SHINY
              </text>
            )}

            {/* ── Name plate ── */}
            <rect x="18" y="216" width="184" height="32" rx="8"
              fill={`${cfg.bg}ee`} stroke={cfg.c} strokeWidth="1"/>
            <text x="110" y="229" textAnchor="middle" dominantBaseline="central"
              fill="#fff" fontSize="12.5" fontWeight="900" fontFamily="system-ui">
              {cardName.slice(0,20)}{cardName.length>20?'…':''}
            </text>
            <text x="110" y="243" textAnchor="middle" dominantBaseline="central"
              fill={cfg.c} fontSize="8.5" fontFamily="system-ui" letterSpacing="0.5">
              {cardType.toUpperCase()}
            </text>
          </svg>
        </div>

        {/* BACK face */}
        <div style={{
          position:'absolute', inset:0,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          transform: 'rotateY(180deg)',
        }}>
          <svg viewBox="0 0 220 256" width={264} height={304} style={{ display:'block' }}>
            <polygon points={HEX} fill={cfg.bg} stroke={cfg.c} strokeWidth="3"/>
            <polygon points={HEXIN} fill="none" stroke={cfg.c} strokeWidth="0.6" strokeOpacity="0.4"/>

            {/* Faint hex watermark */}
            {[60,90,120,150,180].map((y, i) => (
              <text key={i} x={i%2?20:30} y={y} fill={`${cfg.c}0e`}
                fontSize="28" fontFamily="monospace">⬡ ⬡ ⬡ ⬡</text>
            ))}

            <text x="110" y="75" textAnchor="middle" fill={cfg.c} fontSize="36">⬡</text>
            <text x="110" y="105" textAnchor="middle" fill="#6B7280" fontSize="8.5"
              fontFamily="monospace">{(t.h3_index||'').slice(0,18)}</text>

            <line x1="40" y1="118" x2="180" y2="118" stroke={cfg.c} strokeWidth="0.5" strokeOpacity="0.3"/>

            <text x="110" y="134" textAnchor="middle" fill={cfg.c} fontSize="11"
              fontFamily="system-ui" fontWeight="800">+{income} credits / tick</text>
            {t.poi_floor_price && (
              <text x="110" y="152" textAnchor="middle" fill={cfg.c} fontSize="10"
                fontFamily="system-ui">💎 Floor {t.poi_floor_price} TDI</text>
            )}
            {t.poi_visitors && (
              <text x="110" y="170" textAnchor="middle" fill="#6B7280" fontSize="9"
                fontFamily="system-ui">👥 {(t.poi_visitors/1e6).toFixed(1)}M visitors/yr</text>
            )}

            <line x1="40" y1="185" x2="180" y2="185" stroke={cfg.c} strokeWidth="0.5" strokeOpacity="0.3"/>

            <text x="110" y="200" textAnchor="middle" fill="#4B5563" fontSize="8.5"
              fontFamily="system-ui">
              {t.nft_version>1?`Edition v${t.nft_version}`:'Genesis Edition'}
              {t.token_id?`  ·  #${t.token_id}`:''}
            </text>
            <text x="110" y="216" textAnchor="middle" fill="#1F2937" fontSize="8"
              fontFamily="system-ui">Terra Domini  ·  Season 1</text>
          </svg>
        </div>
      </div>

      {/* ── Info panel ── */}
      <motion.div
        initial={{ y:20, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.15 }}
        style={{
          width:290, background:'rgba(4,4,12,0.99)',
          border:`1px solid ${cfg.c}55`, borderRadius:14,
          boxShadow:`0 0 40px ${cfg.c}18`,
          overflow:'hidden',
        }}
      >
        <div style={{
          padding:'12px 16px',
          background:`linear-gradient(100deg, ${cfg.c}28 0%, transparent 60%)`,
          borderBottom:`1px solid ${cfg.c}25`,
        }}>
          <div style={{ fontSize:15, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>{cardEmoji}</span>
            <span>{cardName}</span>
          </div>
          {cardDesc && (
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:5, lineHeight:1.55 }}>
              {cardDesc.slice(0,110)}{cardDesc.length>110?'…':''}
            </div>
          )}
          {cardFact && (
            <div style={{ fontSize:10, color:'#6B7280', marginTop:3, fontStyle:'italic' }}>
              💡 {cardFact.slice(0,90)}
            </div>
          )}
        </div>

        <div style={{ padding:'7px 16px', display:'flex', gap:14, fontSize:11,
          borderBottom:`1px solid ${cfg.c}18`, color:'#6B7280' }}>
          <span style={{ color:'#F59E0B' }}>💰 +{income}/tick</span>
          {t.poi_floor_price && <span style={{ color:cfg.c }}>💎 {t.poi_floor_price} TDI</span>}
          <span>🛡️ {t.defense_tier||1}★</span>
        </div>

        {(isOwned||isEnemy) && (
          <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', gap:9,
            borderBottom:`1px solid ${cfg.c}18`,
            background: isOwned?`${t.border_color||cfg.c}0d`:'rgba(239,68,68,0.06)' }}>
            <span style={{ fontSize:18 }}>{isOwned?(t.custom_emoji||'🏴'):'👤'}</span>
            <span style={{ fontSize:12, fontWeight:700,
              color:isOwned?(t.border_color||'#00FF87'):'#F87171' }}>
              {isOwned?'Your territory':t.owner_username}
            </span>
          </div>
        )}

        <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
          {isFree && player && (
            <button onClick={onRequestClaim} style={{
              padding:'13px', border:'none', borderRadius:10, cursor:'pointer',
              background:`linear-gradient(135deg, ${cfg.c}cc, ${cfg.c})`,
              color:['legendary','mythic','epic'].includes(rarity)?'#000':'#fff',
              fontSize:14, fontWeight:900,
              boxShadow:cfg.glow!=='none'?`0 4px 28px ${cfg.c}66`:undefined,
            }}>🏴 Claim {cardName.slice(0,22)}</button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              padding:'13px', borderRadius:10, cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.4)',
              background:'rgba(239,68,68,0.1)', color:'#EF4444',
              fontSize:14, fontWeight:700,
            }}>⚔️ Attack · 💸 Buy · 🧩 Puzzle</button>
          )}
          {isOwned && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onRequestClaim} style={{
                flex:1, padding:'11px', borderRadius:9, cursor:'pointer',
                background:`${cfg.c}16`, border:`1px solid ${cfg.c}44`,
                color:cfg.c, fontSize:12, fontWeight:700,
              }}>💰 Revenue</button>
              <button style={{
                flex:1, padding:'11px', borderRadius:9, cursor:'pointer',
                background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)',
                color:'#A78BFA', fontSize:12, fontWeight:700,
              }}>🎨 Customize</button>
            </div>
          )}
          <button onClick={onClose} style={{
            padding:'7px', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:7, cursor:'pointer', background:'transparent',
            color:'#374151', fontSize:10,
          }}>✕ Close</button>
        </div>
      </motion.div>

      <div style={{ fontSize:9, color:'#1F2937' }}>Drag · Spin · Flip for card back</div>
    </motion.div>
  )
}
