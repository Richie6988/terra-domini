import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../store'

const RARITY: Record<string, {
  border: string; glow: string; bg: string
  accent: string; label: string; foil: string
}> = {
  common:   { border:'#6B7280', glow:'none',                                    bg:'#0d0f18', accent:'#9CA3AF', label:'Common',    foil:'none'             },
  uncommon: { border:'#10B981', glow:'0 0 20px #10B98166',                      bg:'#040f0a', accent:'#34D399', label:'Uncommon',  foil:'rgba(52,211,153,0.25)' },
  rare:     { border:'#3B82F6', glow:'0 0 28px #3B82F677',                      bg:'#030818', accent:'#93C5FD', label:'Rare',      foil:'rgba(147,197,253,0.3)' },
  epic:     { border:'#8B5CF6', glow:'0 0 34px #8B5CF688',                      bg:'#07030f', accent:'#C4B5FD', label:'Epic',      foil:'rgba(196,181,253,0.35)' },
  legendary:{ border:'#F59E0B', glow:'0 0 42px #F59E0BAA,0 0 70px #F59E0B33',  bg:'#0f0700', accent:'#FCD34D', label:'Legendary', foil:'rgba(252,211,77,0.45)' },
  mythic:   { border:'#EC4899', glow:'0 0 50px #EC4899BB,0 0 90px #EC489933',   bg:'#0f0008', accent:'#F9A8D4', label:'Mythic ✦',  foil:'rgba(249,168,212,0.5)' },
}

const BIOME_EMOJI: Record<string,string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿', water:'💧',
}

// Pointy-top hex, viewBox 160×185, tight
const HEX = '80,3 157,42 157,143 80,182 3,143 3,42'
const HEX_CLIP = '80,6 153,44 153,140 80,178 7,140 7,44'

export function HexCard({ territory: t, onClose, onRequestClaim }: {
  territory: any; onClose: () => void; onRequestClaim: () => void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id

  // Hex = POI if it has one. The hex IS the POI.
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const cfg     = RARITY[rarity] || RARITY.common

  // Card identity — fully derived from POI if present
  const cardName    = t.custom_name || t.poi_name || t.place_name || 'Zone ' + (t.h3_index||'').slice(0,6)
  const cardEmoji   = t.custom_emoji || t.poi_emoji || BIOME_EMOJI[t.territory_type||'rural'] || '⬡'
  const cardImg     = t.poi_wiki_url || null
  const cardType    = t.poi_category || t.territory_type || 'rural'
  const cardIncome  = Math.round(t.resource_credits || t.food_per_tick || 10)
  const cardDesc    = t.poi_description || null
  const cardFact    = t.poi_fun_fact || null

  /* ── CSS 3D drag-to-rotate ── */
  const cardEl = useRef<HTMLDivElement>(null)
  const rotY   = useRef(-15)
  const rotX   = useRef(6)
  const velY   = useRef(0)
  const velX   = useRef(0)
  const lastX  = useRef(0)
  const lastY  = useRef(0)
  const active = useRef(false)
  const raf    = useRef<number>()

  const setTransform = () => {
    if (cardEl.current)
      cardEl.current.style.transform =
        `rotateX(${rotX.current.toFixed(2)}deg) rotateY(${rotY.current.toFixed(2)}deg)`
  }

  const runInertia = () => {
    velY.current *= 0.91
    velX.current *= 0.91
    rotY.current += velY.current
    rotX.current  = Math.max(-55, Math.min(55, rotX.current + velX.current))
    setTransform()
    if (Math.abs(velY.current) > 0.12 || Math.abs(velX.current) > 0.12)
      raf.current = requestAnimationFrame(runInertia)
  }

  const onPD = (e: React.PointerEvent) => {
    e.preventDefault()
    cancelAnimationFrame(raf.current!)
    active.current = true
    lastX.current  = e.clientX
    lastY.current  = e.clientY
    velY.current   = 0; velX.current = 0
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPM = (e: React.PointerEvent) => {
    if (!active.current) return
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    velY.current = dx * 0.65; velX.current = -dy * 0.42
    rotY.current += dx * 0.65
    rotX.current  = Math.max(-55, Math.min(55, rotX.current - dy * 0.42))
    setTransform()
    lastX.current = e.clientX; lastY.current = e.clientY
  }
  const onPU = () => {
    active.current = false
    raf.current    = requestAnimationFrame(runInertia)
  }
  useEffect(() => { setTransform() }, [])
  useEffect(() => () => cancelAnimationFrame(raf.current!), [])

  /* ── specular highlight ── */
  const [sx, setSx] = useState(50)
  const [sy, setSy] = useState(40)
  const onMM = (e: React.MouseEvent) => {
    if (active.current) return
    const b = e.currentTarget.getBoundingClientRect()
    setSx((e.clientX - b.left) / b.width * 100)
    setSy((e.clientY - b.top)  / b.height * 100)
  }

  /* ── shiny foil ── */
  const [foilX, setFoilX] = useState(-110)
  useEffect(() => {
    if (!isShiny || cfg.foil === 'none') return
    const sweep = () => {
      let x = -110
      const id = setInterval(() => { x += 9; setFoilX(x); if (x > 140) clearInterval(id) }, 14)
    }
    sweep()
    const id = setInterval(sweep, 3800)
    return () => clearInterval(id)
  }, [isShiny])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(18px)',
      }}
    >
      {/* perspective container */}
      <div style={{ perspective: '900px' }}>
        <div
          ref={cardEl}
          onPointerDown={onPD} onPointerMove={onPM}
          onPointerUp={onPU} onPointerCancel={onPU}
          onMouseMove={onMM}
          style={{
            transformStyle: 'preserve-3d',
            transition: active.current ? 'none' : 'transform 0.06s ease-out',
            cursor: 'grab', userSelect: 'none', touchAction: 'none',
            position: 'relative',
            width: 200, height: 230,      // trading-card proportions, thin
          }}
        >
          {/* ══ FRONT ══ */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          }}>
            <svg viewBox="0 0 160 185" width={200} height={230}
              style={{
                display: 'block',
                filter: cfg.glow !== 'none'
                  ? `drop-shadow(0 0 12px ${cfg.border}) drop-shadow(0 0 24px ${cfg.border}55)`
                  : undefined,
              }}
            >
              <defs>
                <clipPath id={`c-${rarity}`}><polygon points={HEX_CLIP}/></clipPath>
                <radialGradient id={`s-${rarity}`} cx={`${sx}%`} cy={`${sy}%`} r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.14)"/>
                  <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
                </radialGradient>
                {cardImg && (
                  <linearGradient id={`f-${rarity}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="50%" stopColor={cfg.bg} stopOpacity="0"/>
                    <stop offset="100%" stopColor={cfg.bg} stopOpacity="0.82"/>
                  </linearGradient>
                )}
              </defs>

              {/* Hex fill */}
              <polygon points={HEX} fill={cfg.bg}/>

              {/* Image */}
              {cardImg && (
                <>
                  <image href={cardImg} x="3" y="3" width="154" height="179"
                    clipPath={`url(#c-${rarity})`}
                    preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.72 }}/>
                  <polygon points={HEX_CLIP} fill={`url(#f-${rarity})`}/>
                </>
              )}

              {/* Emoji fallback */}
              {!cardImg && (
                <text x="80" y="98" textAnchor="middle" dominantBaseline="central"
                  fontSize="52">{cardEmoji}</text>
              )}

              {/* Specular */}
              <polygon points={HEX} fill={`url(#s-${rarity})`} style={{ mixBlendMode:'screen' }}/>

              {/* Foil sweep */}
              {isShiny && cfg.foil !== 'none' && (
                <rect x={foilX} y="-5" width="55" height="195"
                  fill={cfg.foil}
                  clipPath={`url(#c-${rarity})`}
                  transform="skewX(-18)"/>
              )}

              {/* Border */}
              <polygon points={HEX} fill="none" stroke={cfg.border} strokeWidth="2.5"/>
              {['epic','legendary','mythic'].includes(rarity) && (
                <polygon points={HEX} fill="none"
                  stroke="rgba(255,255,255,0.12)" strokeWidth="1"
                  strokeDasharray="5,4"
                  transform="scale(0.94,0.94) translate(5,5)"/>
              )}

              {/* Rarity top */}
              <text x="80" y="22" textAnchor="middle" fill={cfg.accent}
                fontSize="9" fontWeight="900" letterSpacing="2"
                fontFamily="system-ui">{cfg.label.toUpperCase()}</text>
              {isShiny && (
                <text x="80" y="34" textAnchor="middle" fill="#FCD34D"
                  fontSize="7.5" fontFamily="system-ui">✨ Shiny</text>
              )}

              {/* Name bottom */}
              <text x="80" y="162" textAnchor="middle" fill="#fff"
                fontSize="11" fontWeight="800" fontFamily="system-ui">
                {cardName.slice(0,22)}{cardName.length > 22 ? '…' : ''}
              </text>
              <text x="80" y="175" textAnchor="middle" fill={cfg.accent}
                fontSize="8" fontFamily="system-ui">{cardType}</text>
            </svg>
          </div>

          {/* ══ BACK ══ */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}>
            <svg viewBox="0 0 160 185" width={200} height={230} style={{ display:'block' }}>
              <polygon points={HEX} fill={cfg.bg} stroke={cfg.border} strokeWidth="2.5"/>
              <text x="80" y="55" textAnchor="middle" fill={cfg.accent} fontSize="26">⬡</text>
              <text x="80" y="80" textAnchor="middle" fill="#4B5563" fontSize="7.5"
                fontFamily="monospace">{(t.h3_index||'').slice(0,16)}</text>
              <text x="80" y="98" textAnchor="middle" fill={cfg.accent} fontSize="9"
                fontFamily="system-ui" fontWeight="700">+{cardIncome} credits/tick</text>
              {t.poi_floor_price && (
                <text x="80" y="114" textAnchor="middle" fill={cfg.accent} fontSize="9">
                  Floor {t.poi_floor_price} TDI
                </text>
              )}
              {t.poi_visitors && (
                <text x="80" y="130" textAnchor="middle" fill="#6B7280" fontSize="8">
                  {(t.poi_visitors/1e6).toFixed(1)}M visitors/yr
                </text>
              )}
              <text x="80" y="155" textAnchor="middle" fill="#374151" fontSize="7.5"
                fontFamily="system-ui">
                {t.nft_version > 1 ? `v${t.nft_version}` : 'Genesis'}
                {t.token_id ? ` · #${t.token_id}` : ''}
              </text>
              <text x="80" y="170" textAnchor="middle" fill="#1F2937" fontSize="7"
                fontFamily="system-ui">Terra Domini · Season 1</text>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Info panel below ── */}
      <div style={{
        width: 260, background: 'rgba(6,6,14,0.98)',
        border: `1px solid ${cfg.border}44`, borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Card identity */}
        <div style={{
          padding: '10px 14px',
          background: `linear-gradient(90deg, ${cfg.border}22, transparent)`,
          borderBottom: `1px solid ${cfg.border}22`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            {cardEmoji} {cardName}
          </div>
          {cardDesc && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.5 }}>
              {cardDesc.slice(0, 110)}{cardDesc.length > 110 ? '…' : ''}
            </div>
          )}
          {cardFact && (
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3, fontStyle: 'italic' }}>
              💡 {cardFact.slice(0, 80)}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          padding: '7px 14px', display: 'flex', gap: 12, fontSize: 11,
          borderBottom: `1px solid ${cfg.border}18`, color: '#6B7280',
        }}>
          <span style={{ color: '#FFB800' }}>💰 +{cardIncome}/tick</span>
          {t.poi_floor_price && <span style={{ color: cfg.accent }}>💎 {t.poi_floor_price} TDI</span>}
          <span>🛡️ {t.defense_tier || 1}★</span>
        </div>

        {/* Owner */}
        {(isOwned || isEnemy) && (
          <div style={{
            padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: `1px solid ${cfg.border}18`,
            background: isOwned ? `${t.border_color||cfg.border}0f` : 'rgba(239,68,68,0.06)',
          }}>
            <span style={{ fontSize: 16 }}>{isOwned ? (t.custom_emoji||'🏴') : '👤'}</span>
            <span style={{ fontSize: 12, fontWeight: 700,
              color: isOwned ? (t.border_color||'#00FF87') : '#F87171' }}>
              {isOwned ? 'Your territory' : t.owner_username}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {isFree && player && (
            <button onClick={onRequestClaim} style={{
              padding: '11px', border: 'none', borderRadius: 9, cursor: 'pointer',
              background: `linear-gradient(135deg, ${cfg.border}dd, ${cfg.border})`,
              color: ['legendary','mythic','epic'].includes(rarity) ? '#000' : '#fff',
              fontSize: 13, fontWeight: 900,
              boxShadow: cfg.glow !== 'none' ? `0 3px 18px ${cfg.border}55` : undefined,
            }}>
              🏴 Claim {cardName.slice(0, 20)}
            </button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              padding: '11px', borderRadius: 9, cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.1)', color: '#EF4444',
              fontSize: 13, fontWeight: 700,
            }}>⚔️ Attack · 💸 Buy · 🧩 Puzzle</button>
          )}
          {isOwned && (
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={onRequestClaim} style={{
                flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer',
                background: `${cfg.border}14`, border: `1px solid ${cfg.border}40`,
                color: cfg.accent, fontSize: 11, fontWeight: 700,
              }}>💰 Revenue</button>
              <button style={{
                flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer',
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#A78BFA', fontSize: 11, fontWeight: 700,
              }}>🎨 Customize</button>
            </div>
          )}
          <button onClick={onClose} style={{
            padding: '6px', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 7, cursor: 'pointer', background: 'transparent',
            color: '#374151', fontSize: 10,
          }}>✕ Close</button>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#1F2937' }}>
        Drag · Spin · Flip to see back
      </div>
    </motion.div>
  )
}
