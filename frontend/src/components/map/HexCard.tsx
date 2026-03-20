/**
 * HexCard — hex-shaped collectible card.
 * - Pure CSS 3D: perspective on wrapper, rotateX/Y on card
 * - Drag to spin 360° on Y axis, ±60° on X
 * - Inertia after release
 * - Back face shows card metadata
 * - Rarity: glow, bg color, border, foil shimmer on shiny
 */
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../store'

const RARITY: Record<string, { border:string; glow:string; bg:string; accent:string; label:string; textOnCard:string }> = {
  common:   { border:'#6B7280', glow:'none',                                 bg:'#10121a', accent:'#9CA3AF', label:'Common',    textOnCard:'#E5E7EB' },
  uncommon: { border:'#10B981', glow:'0 0 24px #10B98177',                   bg:'#071510', accent:'#34D399', label:'Uncommon',  textOnCard:'#D1FAE5' },
  rare:     { border:'#3B82F6', glow:'0 0 32px #3B82F688',                   bg:'#05091a', accent:'#93C5FD', label:'Rare',      textOnCard:'#BFDBFE' },
  epic:     { border:'#8B5CF6', glow:'0 0 36px #8B5CF699',                   bg:'#0a0515', accent:'#C4B5FD', label:'Epic',      textOnCard:'#EDE9FE' },
  legendary:{ border:'#F59E0B', glow:'0 0 44px #F59E0BAA,0 0 80px #F59E0B44', bg:'#130900', accent:'#FCD34D', label:'Legendary', textOnCard:'#FEF3C7' },
  mythic:   { border:'#EC4899', glow:'0 0 52px #EC4899BB,0 0 100px #EC489933', bg:'#170010', accent:'#F9A8D4', label:'Mythic ✦', textOnCard:'#FCE7F3' },
}

const BIOME_ICON: Record<string,string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿', water:'💧',
}

// Flat-top hex: 6 points for SVG viewBox 200×174
const HEX6 = '100,2 198,50 198,148 100,196 2,148 2,50'
// Clip path slightly inset for image
const HEX6_CLIP = '100,5 194,52 194,145 100,192 6,145 6,52'

export function HexCard({ territory:t, onClose, onRequestClaim }:{
  territory:any; onClose:()=>void; onRequestClaim:()=>void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const cfg     = RARITY[rarity] || RARITY.common

  const name    = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const emoji   = t.custom_emoji || t.poi_emoji || BIOME_ICON[t.territory_type||'rural'] || '⬡'
  const imgUrl  = t.poi_wiki_url || null

  /* ─── drag-to-rotate ─────────────────────────────────────── */
  const rotY = useRef(-15)
  const rotX = useRef(8)
  const velY = useRef(0)
  const velX = useRef(0)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const dragging = useRef(false)
  const rafId = useRef<number>()
  const cardEl = useRef<HTMLDivElement>(null)
  const [, forceRender] = useState(0)   // trigger re-render for transform

  const applyTransform = () => {
    if (!cardEl.current) return
    cardEl.current.style.transform =
      `rotateX(${rotX.current.toFixed(2)}deg) rotateY(${rotY.current.toFixed(2)}deg)`
  }

  const inertia = () => {
    velY.current *= 0.92
    velX.current *= 0.92
    rotY.current += velY.current
    rotX.current = Math.max(-55, Math.min(55, rotX.current + velX.current))
    applyTransform()
    if (Math.abs(velY.current) > 0.15 || Math.abs(velX.current) > 0.15) {
      rafId.current = requestAnimationFrame(inertia)
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    cancelAnimationFrame(rafId.current!)
    dragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
    velY.current = 0; velX.current = 0
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    velY.current = dx * 0.7
    velX.current = -dy * 0.45
    rotY.current += dx * 0.7
    rotX.current = Math.max(-55, Math.min(55, rotX.current - dy * 0.45))
    applyTransform()
    lastX.current = e.clientX
    lastY.current = e.clientY
  }
  const onPointerUp = () => {
    dragging.current = false
    rafId.current = requestAnimationFrame(inertia)
  }
  useEffect(() => () => cancelAnimationFrame(rafId.current!), [])
  // Initial transform on mount
  useEffect(() => { applyTransform() }, [])

  /* ─── shiny foil ─────────────────────────────────────────── */
  const [foilPct, setFoilPct] = useState(-120)
  useEffect(() => {
    if (!isShiny) return
    const sweep = () => {
      let p = -120
      const id = setInterval(() => {
        p += 10; setFoilPct(p)
        if (p > 160) clearInterval(id)
      }, 16)
    }
    sweep()
    const id = setInterval(sweep, 3500)
    return () => clearInterval(id)
  }, [isShiny])

  /* ─── specular highlight follows cursor ──────────────────── */
  const [specX, setSpecX] = useState(50)
  const [specY, setSpecY] = useState(40)
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) return
    const b = e.currentTarget.getBoundingClientRect()
    setSpecX((e.clientX - b.left) / b.width * 100)
    setSpecY((e.clientY - b.top)  / b.height * 100)
  }

  const frontBg = cfg.bg
  const income  = Math.round(t.resource_credits || t.food_per_tick || 10)

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:'fixed', inset:0, zIndex:1200,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:20,
        background:'rgba(0,0,0,0.88)', backdropFilter:'blur(16px)',
      }}
    >
      {/* perspective wrapper */}
      <div style={{ perspective:'900px', perspectiveOrigin:'50% 50%' }}>
        <div
          ref={cardEl}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseMove={onMouseMove}
          style={{
            transformStyle: 'preserve-3d',
            transition: dragging.current ? 'none' : 'transform 0.08s ease-out',
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
            width: 240,
            height: 276,
            position: 'relative',
          }}
        >
          {/* ══ FRONT ══ */}
          <div style={{
            position:'absolute', inset:0,
            backfaceVisibility:'hidden',
            WebkitBackfaceVisibility:'hidden',
          }}>
            <svg viewBox="0 0 200 200" width={240} height={240}
              style={{
                filter: cfg.glow !== 'none'
                  ? `drop-shadow(0 0 14px ${cfg.border})`
                  : undefined,
                display:'block',
              }}
            >
              <defs>
                <clipPath id={`cx-${rarity}`}>
                  <polygon points={HEX6_CLIP} />
                </clipPath>
                <radialGradient id={`spec-${rarity}`}
                  cx={`${specX}%`} cy={`${specY}%`} r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              {/* Background fill */}
              <polygon points={HEX6} fill={frontBg} />

              {/* POI image inside hex */}
              {imgUrl && (
                <image href={imgUrl} x="2" y="2" width="196" height="196"
                  clipPath={`url(#cx-${rarity})`}
                  preserveAspectRatio="xMidYMid slice"
                  style={{ opacity: 0.65 }}
                />
              )}

              {/* Image fade to bottom */}
              {imgUrl && (
                <>
                  <defs>
                    <linearGradient id={`fade-${rarity}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="55%" stopColor={frontBg} stopOpacity="0" />
                      <stop offset="100%" stopColor={frontBg} stopOpacity="0.85" />
                    </linearGradient>
                  </defs>
                  <polygon points={HEX6_CLIP}
                    fill={`url(#fade-${rarity})`} />
                </>
              )}

              {/* Emoji if no image */}
              {!imgUrl && (
                <text x="100" y="105" textAnchor="middle" dominantBaseline="central"
                  fontSize="58" style={{ userSelect:'none' }}>{emoji}</text>
              )}

              {/* Specular highlight */}
              <polygon points={HEX6}
                fill={`url(#spec-${rarity})`}
                style={{ mixBlendMode:'screen', pointerEvents:'none' }} />

              {/* Foil sweep */}
              {isShiny && (
                <rect
                  x={foilPct} y="-10" width="60" height="220"
                  fill="rgba(255,255,255,0.24)"
                  clipPath={`url(#cx-${rarity})`}
                  transform="skewX(-20)"
                  style={{ pointerEvents:'none' }}
                />
              )}

              {/* Hex border — double for epic+ */}
              <polygon points={HEX6} fill="none" stroke={cfg.border} strokeWidth="3" />
              {['epic','legendary','mythic'].includes(rarity) && (
                <polygon points={HEX6} fill="none"
                  stroke="rgba(255,255,255,0.15)" strokeWidth="1"
                  strokeDasharray="6,4"
                  transform="scale(0.94,0.94) translate(6,6)" />
              )}

              {/* Rarity label — top */}
              <text x="100" y="26" textAnchor="middle"
                fill={cfg.accent} fontSize="10" fontWeight="900"
                letterSpacing="2" fontFamily="system-ui, sans-serif"
                style={{ textTransform:'uppercase' }}>
                {cfg.label}
              </text>
              {isShiny && (
                <text x="100" y="40" textAnchor="middle"
                  fill="#FCD34D" fontSize="8.5" fontFamily="system-ui">✨ Shiny</text>
              )}

              {/* Name — bottom */}
              <text x="100" y="172" textAnchor="middle"
                fill={cfg.textOnCard} fontSize="12" fontWeight="800"
                fontFamily="system-ui, sans-serif">
                {name.slice(0,22)}{name.length>22?'…':''}
              </text>
              <text x="100" y="186" textAnchor="middle"
                fill={cfg.accent} fontSize="9" fontFamily="system-ui">
                {hasPOI ? (t.poi_category||'poi') : (t.territory_type||'rural')}
              </text>
            </svg>
          </div>

          {/* ══ BACK ══ */}
          <div style={{
            position:'absolute', inset:0,
            backfaceVisibility:'hidden',
            WebkitBackfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
          }}>
            <svg viewBox="0 0 200 200" width={240} height={240} style={{ display:'block' }}>
              <polygon points={HEX6} fill={cfg.bg} stroke={cfg.border} strokeWidth="3" />
              <text x="100" y="60" textAnchor="middle" fill={cfg.accent} fontSize="28">⬡</text>
              <text x="100" y="88" textAnchor="middle" fill="#6B7280" fontSize="8.5"
                fontFamily="monospace">{(t.h3_index||'').slice(0,18)}</text>
              <text x="100" y="106" textAnchor="middle" fill={cfg.accent} fontSize="9"
                fontFamily="system-ui" fontWeight="700">
                +{income} credits/tick
              </text>
              {t.poi_floor_price && (
                <text x="100" y="122" textAnchor="middle" fill={cfg.accent} fontSize="9">
                  Floor {t.poi_floor_price} TDI
                </text>
              )}
              <text x="100" y="148" textAnchor="middle" fill="#4B5563" fontSize="8"
                fontFamily="system-ui">
                {t.nft_version > 1 ? `v${t.nft_version}` : 'Genesis'}{t.token_id ? ` · #${t.token_id}` : ''}
              </text>
              <text x="100" y="178" textAnchor="middle" fill="#374151" fontSize="7.5"
                fontFamily="system-ui">Terra Domini · Season 1</text>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Info panel ── */}
      <div style={{
        width:280, background:'rgba(8,8,18,0.97)',
        border:`1px solid ${cfg.border}44`, borderRadius:14, overflow:'hidden',
        backdropFilter:'blur(8px)',
      }}>
        {/* POI highlight */}
        {hasPOI && (
          <div style={{ padding:'10px 14px',
            background:`linear-gradient(90deg, ${cfg.border}22, transparent)`,
            borderBottom:`1px solid ${cfg.border}22` }}>
            <div style={{ fontSize:13, fontWeight:700, color:cfg.accent }}>
              {t.poi_emoji||'📍'} {t.poi_name}
            </div>
            {t.poi_description && (
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4, lineHeight:1.5 }}>
                {t.poi_description.slice(0,100)}{t.poi_description.length>100?'…':''}
              </div>
            )}
            {t.poi_fun_fact && (
              <div style={{ fontSize:10, color:'#6B7280', marginTop:3, fontStyle:'italic' }}>
                💡 {t.poi_fun_fact.slice(0,80)}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ padding:'8px 14px', display:'flex', gap:10,
          borderBottom:`1px solid ${cfg.border}22`, fontSize:11 }}>
          <div style={{ color:'#FFB800' }}>💰 +{income}/tick</div>
          {t.poi_floor_price && <div style={{ color:cfg.accent }}>💎 {t.poi_floor_price} TDI</div>}
          <div style={{ color:'#6B7280' }}>🛡️ {t.defense_tier||1}★</div>
        </div>

        {/* Owner */}
        {(isOwned||isEnemy) && (
          <div style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:8,
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
              color: ['common','rare'].includes(rarity)?'#fff':'#000',
              fontSize:14, fontWeight:900,
              boxShadow: cfg.glow!=='none' ? `0 4px 20px ${cfg.border}66` : undefined,
            }}>
              🏴 {hasPOI?`Claim ${(t.poi_name||name).slice(0,20)}`:'Claim territory'}
            </button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              padding:'12px', borderRadius:10, cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.35)',
              background:'rgba(239,68,68,0.12)', color:'#EF4444',
              fontSize:14, fontWeight:700,
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
            padding:'7px', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, cursor:'pointer', background:'transparent',
            color:'#4B5563', fontSize:11,
          }}>✕ Close</button>
        </div>
      </div>

      <div style={{ fontSize:10, color:'#374151', marginTop:-8 }}>
        Drag card to rotate · Spin to see back
      </div>
    </motion.div>
  )
}
