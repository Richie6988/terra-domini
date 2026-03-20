import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../store'

const R: Record<string, { border:string; glow:string; bg:string; accent:string; label:string }> = {
  common:   { border:'#6B7280', glow:'none',                          bg:'#0f1117', accent:'#9CA3AF', label:'Common'    },
  uncommon: { border:'#10B981', glow:'0 0 20px #10B98166',            bg:'#081a12', accent:'#34D399', label:'Uncommon'  },
  rare:     { border:'#3B82F6', glow:'0 0 28px #3B82F677',            bg:'#060e24', accent:'#60A5FA', label:'Rare'      },
  epic:     { border:'#8B5CF6', glow:'0 0 34px #8B5CF688',            bg:'#0d0618', accent:'#A78BFA', label:'Epic'      },
  legendary:{ border:'#F59E0B', glow:'0 0 42px #F59E0BAA',            bg:'#150a00', accent:'#FCD34D', label:'Legendary' },
  mythic:   { border:'#EC4899', glow:'0 0 52px #EC4899BB,0 0 90px #EC489933', bg:'#1a0010', accent:'#F472B6', label:'Mythic ✦' },
}
const BIOME: Record<string,string> = {
  urban:'🏙️',rural:'🌾',forest:'🌲',mountain:'⛰️',coastal:'🌊',
  desert:'🏜️',tundra:'❄️',industrial:'🏭',landmark:'🏛️',grassland:'🌿',
}

// Hexagon SVG points (pointy-top, centered in viewBox 200×230)
const HEX = '100,5 195,52.5 195,177.5 100,225 5,177.5 5,52.5'

export function HexCard({ territory: t, onClose, onRequestClaim }:{
  territory:any; onClose:()=>void; onRequestClaim:()=>void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const cfg     = R[rarity] || R.common

  const name   = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const emoji  = t.custom_emoji || t.poi_emoji || BIOME[t.territory_type||'rural'] || '⬡'
  const imgUrl = t.poi_wiki_url || t.wiki_url || null

  // 360° drag rotation
  const [rotY, setRotY] = useState(-20)
  const [rotX, setRotX] = useState(8)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const raf = useRef<number>()

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    vel.current = { x: 0, y: 0 }
    cancelAnimationFrame(raf.current!)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    vel.current = { x: dx, y: dy }
    setRotY(r => r + dx * 0.8)
    setRotX(r => Math.max(-60, Math.min(60, r - dy * 0.5)))
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    dragging.current = false
    // Inertia spin
    const spin = () => {
      vel.current = { x: vel.current.x * 0.93, y: vel.current.y * 0.93 }
      if (Math.abs(vel.current.x) > 0.2 || Math.abs(vel.current.y) > 0.2) {
        setRotY(r => r + vel.current.x * 0.8)
        setRotX(r => Math.max(-60, Math.min(60, r - vel.current.y * 0.5)))
        raf.current = requestAnimationFrame(spin)
      }
    }
    raf.current = requestAnimationFrame(spin)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current!), [])

  // Foil sweep for shiny
  const [foilX, setFoilX] = useState(-130)
  useEffect(() => {
    if (!isShiny) return
    const tick = () => {
      setFoilX(-130)
      setTimeout(() => {
        let x = -130
        const id = setInterval(() => {
          x += 8
          setFoilX(x)
          if (x > 130) clearInterval(id)
        }, 16)
      }, 400)
    }
    tick()
    const id = setInterval(tick, 3500)
    return () => clearInterval(id)
  }, [isShiny])

  // Specular follow on non-drag hover
  const [spec, setSpec] = useState({ x: 50, y: 50 })
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) return
    const b = e.currentTarget.getBoundingClientRect()
    setSpec({ x: (e.clientX - b.left) / b.width * 100, y: (e.clientY - b.top) / b.height * 100 })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:1200,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.85)', backdropFilter:'blur(14px)',
        perspective:'900px',
      }}
    >
      <motion.div
        initial={{ scale:0.3, rotateY:-40, opacity:0 }}
        animate={{ scale:1, rotateY:0, opacity:1 }}
        transition={{ type:'spring', stiffness:240, damping:18 }}
        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}
      >
        {/* ── 360° rotating hex card ── */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onMouseMove={onMouseMove}
          style={{
            cursor: dragging.current ? 'grabbing' : 'grab',
            userSelect:'none',
            transform:`rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transformStyle:'preserve-3d',
            transition: dragging.current ? 'none' : 'transform 0.05s',
            width:260, height:300,
            position:'relative',
          }}
        >
          {/* FRONT FACE */}
          <div style={{
            position:'absolute', inset:0,
            backfaceVisibility:'hidden',
          }}>
            <svg viewBox="0 0 200 230" width="260" height="300"
              style={{ filter: cfg.glow!=='none' ? `drop-shadow(0 0 14px ${cfg.border})` : undefined }}>
              <defs>
                <clipPath id={`hf-${rarity}`}>
                  <polygon points={HEX} />
                </clipPath>
                <filter id="inner-glow">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
                  <feFlood floodColor={cfg.border} floodOpacity="0.4" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Dark hex fill */}
              <polygon points={HEX} fill={cfg.bg} />

              {/* Image inside hex */}
              {imgUrl && (
                <image href={imgUrl} x="5" y="5" width="190" height="220"
                  clipPath={`url(#hf-${rarity})`}
                  preserveAspectRatio="xMidYMid slice"
                  style={{ opacity:0.7 }}
                />
              )}

              {/* Gradient overlay on image */}
              {imgUrl && (
                <polygon points={HEX}
                  fill="url(#img-fade)" />
              )}
              {imgUrl && (
                <defs>
                  <linearGradient id="img-fade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.bg} stopOpacity="0.2"/>
                    <stop offset="60%" stopColor={cfg.bg} stopOpacity="0.0"/>
                    <stop offset="100%" stopColor={cfg.bg} stopOpacity="0.7"/>
                  </linearGradient>
                </defs>
              )}

              {/* Emoji if no image */}
              {!imgUrl && (
                <text x="100" y="125" textAnchor="middle" dominantBaseline="central"
                  fontSize="60" style={{ userSelect:'none' }}>{emoji}</text>
              )}

              {/* Rarity border — double ring for epic+ */}
              <polygon points={HEX} fill="none" stroke={cfg.border} strokeWidth="3" />
              {['epic','legendary','mythic'].includes(rarity) && (
                <polygon points={HEX} fill="none"
                  stroke="rgba(255,255,255,0.18)" strokeWidth="1"
                  strokeDasharray="8,4"
                  transform="scale(0.92) translate(9,10)" />
              )}

              {/* Shiny foil sweep */}
              {isShiny && (
                <polygon points={HEX}
                  fill="none" clipPath={`url(#hf-${rarity})`}
                  style={{
                    fill:'transparent',
                    background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)`,
                  }}
                />
              )}
              {isShiny && (
                <rect x={foilX} y="0" width="80" height="230"
                  clipPath={`url(#hf-${rarity})`}
                  fill="rgba(255,255,255,0.22)"
                  transform={`skewX(-20)`}
                />
              )}

              {/* Specular highlight */}
              <polygon points={HEX}
                fill={`radial-gradient(circle at ${spec.x}% ${spec.y}%, rgba(255,255,255,0.1), transparent 60%)`}
                clipPath={`url(#hf-${rarity})`}
                style={{ mixBlendMode:'screen' }}
              />

              {/* Rarity label at top */}
              <text x="100" y="30" textAnchor="middle" fill={cfg.accent}
                fontSize="11" fontWeight="900" letterSpacing="2"
                style={{ textTransform:'uppercase', fontFamily:'system-ui' }}>
                {cfg.label}
              </text>
              {isShiny && (
                <text x="100" y="46" textAnchor="middle" fill="#FCD34D"
                  fontSize="9" fontWeight="700">✨ Shiny</text>
              )}

              {/* Name at bottom inside hex */}
              <text x="100" y="195" textAnchor="middle" fill="#fff"
                fontSize="12" fontWeight="800"
                style={{ fontFamily:'system-ui', textShadow:'0 1px 4px #000' }}>
                {name.slice(0,20)}
              </text>
              <text x="100" y="212" textAnchor="middle" fill={cfg.accent}
                fontSize="9" fontWeight="600">
                {hasPOI ? (t.poi_category||'poi') : (t.territory_type||'rural')}
              </text>
            </svg>
          </div>

          {/* BACK FACE */}
          <div style={{
            position:'absolute', inset:0,
            backfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
          }}>
            <svg viewBox="0 0 200 230" width="260" height="300">
              <polygon points={HEX} fill={cfg.bg} stroke={cfg.border} strokeWidth="3" />
              <text x="100" y="80" textAnchor="middle" fill={cfg.accent} fontSize="32">⬡</text>
              <text x="100" y="110" textAnchor="middle" fill="#fff" fontSize="9"
                fontFamily="monospace">{(t.h3_index||'').slice(0,16)}</text>
              <text x="100" y="130" textAnchor="middle" fill="#6B7280" fontSize="8">
                {t.nft_version > 1 ? `v${t.nft_version}` : 'Genesis'}
                {t.token_id ? ` · #${t.token_id}` : ''}
              </text>
              <text x="100" y="150" textAnchor="middle" fill={cfg.accent} fontSize="9">
                +{Math.round(t.resource_credits||t.food_per_tick||10)} credits/tick
              </text>
              {t.poi_floor_price && (
                <text x="100" y="168" textAnchor="middle" fill={cfg.accent} fontSize="9">
                  Floor: {t.poi_floor_price} TDI
                </text>
              )}
              <text x="100" y="200" textAnchor="middle" fill="#374151" fontSize="8"
                fontFamily="monospace">Terra Domini · Season 1</text>
            </svg>
          </div>
        </div>

        {/* ── Info panel below card ── */}
        <div style={{
          width:280, background:'rgba(10,10,20,0.95)',
          border:`1px solid ${cfg.border}44`, borderRadius:14,
          overflow:'hidden',
        }}>
          {/* POI description */}
          {hasPOI && t.poi_description && (
            <div style={{ padding:'10px 14px', fontSize:11, color:'#9CA3AF', lineHeight:1.6,
              borderBottom:`1px solid ${cfg.border}22` }}>
              {t.poi_description.slice(0,120)}{t.poi_description.length>120?'…':''}
              {t.poi_fun_fact && <div style={{ marginTop:4, color:'#6B7280', fontStyle:'italic' }}>💡 {t.poi_fun_fact.slice(0,80)}</div>}
            </div>
          )}

          {/* Owner */}
          {(isOwned||isEnemy) && (
            <div style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:10,
              borderBottom:`1px solid ${cfg.border}22`,
              background: isOwned ? `${t.border_color||cfg.border}10` : 'rgba(239,68,68,0.08)' }}>
              <span style={{ fontSize:18 }}>{isOwned?(t.custom_emoji||'🏴'):'👤'}</span>
              <span style={{ fontSize:12, fontWeight:700,
                color: isOwned?(t.border_color||'#00FF87'):'#F87171' }}>
                {isOwned?'Your territory':t.owner_username}
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
            {isFree && player && (
              <button onClick={onRequestClaim} style={{
                padding:'12px', border:'none', borderRadius:10, cursor:'pointer',
                background:`linear-gradient(135deg,${cfg.border}cc,${cfg.border})`,
                color: rarity==='common'?'#fff':'#000',
                fontSize:14, fontWeight:900,
                boxShadow: cfg.glow!=='none' ? `0 4px 20px ${cfg.border}66` : undefined,
              }}>🏴 {hasPOI?`Claim ${(t.poi_name||name).slice(0,22)}`:'Claim territory'}</button>
            )}
            {isEnemy && (
              <button onClick={onRequestClaim} style={{
                padding:'12px', border:'1px solid rgba(239,68,68,0.4)', borderRadius:10, cursor:'pointer',
                background:'rgba(239,68,68,0.12)', color:'#EF4444', fontSize:14, fontWeight:700,
              }}>⚔️ Attack · 💸 Buy · 🧩 Puzzle</button>
            )}
            {isOwned && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onRequestClaim} style={{
                  flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                  background:`${cfg.border}18`, border:`1px solid ${cfg.border}44`,
                  color:cfg.accent, fontSize:12, fontWeight:700,
                }}>💰 Revenue</button>
                <button style={{
                  flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                  background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)',
                  color:'#A78BFA', fontSize:12, fontWeight:700,
                }}>🎨 Customize</button>
              </div>
            )}
            <button onClick={onClose} style={{
              padding:'8px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, cursor:'pointer',
              background:'transparent', color:'#6B7280', fontSize:12,
            }}>Close</button>
          </div>
        </div>

        <div style={{ fontSize:10, color:'#374151' }}>Drag to rotate · Click outside to close</div>
      </motion.div>
    </motion.div>
  )
}
