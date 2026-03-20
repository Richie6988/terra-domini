/**
 * HexCard — collectible card, hex-shaped face, opens with animation.
 * Like a Magic/Pokemon card but hexagonal.
 * Rarity drives: border color, glow, background texture, foil shimmer on shiny.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../../store'

/* ─── Rarity config ─────────────────────────────────────────────────── */
const R: Record<string, { border: string; glow: string; bg: string; accent: string; label: string }> = {
  common:   { border:'#6B7280', glow:'none',                           bg:'linear-gradient(160deg,#1a1a2e,#16213e)', accent:'#9CA3AF', label:'Common'    },
  uncommon: { border:'#10B981', glow:'0 0 18px #10B98155',             bg:'linear-gradient(160deg,#0d2b1e,#0a3325)', accent:'#10B981', label:'Uncommon'  },
  rare:     { border:'#3B82F6', glow:'0 0 24px #3B82F666',             bg:'linear-gradient(160deg,#0d1b3e,#0a1628)', accent:'#60A5FA', label:'Rare'       },
  epic:     { border:'#8B5CF6', glow:'0 0 28px #8B5CF677',             bg:'linear-gradient(160deg,#1a0d3e,#120a28)', accent:'#A78BFA', label:'Epic'       },
  legendary:{ border:'#FFB800', glow:'0 0 36px #FFB80088',             bg:'linear-gradient(160deg,#2b1e00,#1a1200)', accent:'#FFB800', label:'Legendary'  },
  mythic:   { border:'#FF006E', glow:'0 0 44px #FF006EAA,0 0 80px #FF006E44', bg:'linear-gradient(160deg,#2b0018,#1a000f)', accent:'#FF006E', label:'Mythic ✦'  },
}

const BIOME_ART: Record<string, string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿',
}

interface Props {
  territory: any
  onClose: () => void
  onRequestClaim: () => void
}

export function HexCard({ territory: t, onClose, onRequestClaim }: Props) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const hasPOI  = !!(t.poi_name || t.is_landmark)

  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const cfg     = R[rarity] || R.common

  const name = t.custom_name || t.poi_name || t.place_name || 'Zone ' + (t.h3_index || '').slice(0,6)
  const biomeEmoji = BIOME_ART[t.territory_type || t.biome || 'rural'] || '🌾'
  const cardEmoji  = t.custom_emoji || t.poi_emoji || biomeEmoji

  /* shiny foil animation */
  const [foil, setFoil] = useState(0)
  useEffect(() => {
    if (!isShiny) return
    const id = setInterval(() => { setFoil(f => (f + 1) % 3) }, 2200)
    return () => clearInterval(id)
  }, [isShiny])

  /* tilt on mouse */
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const onMouseMove = (e: React.MouseEvent) => {
    const r = cardRef.current?.getBoundingClientRect()
    if (!r) return
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 16
    const y = ((e.clientY - r.top ) / r.height - 0.5) * -12
    setTilt({ x, y })
  }
  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position:'fixed', inset:0, zIndex:1200, display:'flex',
        alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={cardRef}
        initial={{ scale:0.5, rotateY:-25, opacity:0 }}
        animate={{ scale:1, rotateY:0, opacity:1 }}
        exit={{ scale:0.6, rotateY:20, opacity:0 }}
        transition={{ type:'spring', stiffness:280, damping:22 }}
        style={{ rotateX: tilt.y, rotateY: tilt.x, transformStyle:'preserve-3d' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* ── Card shell ── */}
        <div style={{
          width: 280,
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          borderRadius: 20,
          boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined,
          overflow: 'hidden',
          position: 'relative',
          userSelect: 'none',
        }}>

          {/* Foil shimmer overlay for shiny */}
          {isShiny && (
            <motion.div
              key={foil}
              initial={{ x:'-120%', opacity:0.6 }}
              animate={{ x:'160%', opacity:0 }}
              transition={{ duration:0.9, ease:'easeInOut' }}
              style={{
                position:'absolute', inset:0, zIndex:20, pointerEvents:'none',
                background:'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.25) 50%,transparent 70%)',
              }}
            />
          )}

          {/* ── Top band: rarity + set ── */}
          <div style={{
            background:`${cfg.border}22`,
            padding:'8px 14px 6px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            borderBottom:`1px solid ${cfg.border}44`,
          }}>
            <span style={{ fontSize:11, fontWeight:800, color:cfg.accent,
              letterSpacing:'0.12em', textTransform:'uppercase' }}>
              {cfg.label}
            </span>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {isShiny && <span style={{ fontSize:11, color:'#FFD700' }}>✨ Shiny</span>}
              {t.nft_version > 1 && <span style={{ fontSize:10, color:'#8B5CF6',
                background:'rgba(139,92,246,0.15)', padding:'1px 6px', borderRadius:4 }}>v{t.nft_version}</span>}
              <button onClick={onClose} style={{ background:'none', border:'none',
                color:'#6B7280', cursor:'pointer', fontSize:16, padding:0, lineHeight:1 }}>✕</button>
            </div>
          </div>

          {/* ── Hex art zone ── */}
          <div style={{ position:'relative', height:150, display:'flex',
            alignItems:'center', justifyContent:'center', overflow:'hidden' }}>

            {/* Background: POI image or procedural */}
            {t.poi_wiki_url ? (
              <img src={t.poi_wiki_url} alt={name}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                  objectFit:'cover', opacity:0.55 }}
                onError={e => { (e.target as HTMLImageElement).style.display='none' }}
              />
            ) : (
              <div style={{ position:'absolute', inset:0,
                background:`radial-gradient(ellipse at center, ${cfg.border}22 0%, transparent 70%)` }} />
            )}

            {/* Dark gradient over image */}
            <div style={{ position:'absolute', inset:0,
              background:'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)' }} />

            {/* ── SVG Hex frame ── */}
            <svg width="110" height="126" viewBox="0 0 110 126" style={{ position:'relative', zIndex:2, filter: cfg.glow !== 'none' ? `drop-shadow(0 0 8px ${cfg.border})` : undefined }}>
              <defs>
                <clipPath id={`hex-clip-${rarity}`}>
                  <polygon points="55,2 107,29 107,97 55,124 3,97 3,29" />
                </clipPath>
              </defs>
              {/* Hex border */}
              <polygon points="55,2 107,29 107,97 55,124 3,97 3,29"
                fill="none" stroke={cfg.border} strokeWidth="2.5" opacity="0.9" />
              {/* Inner fill with image or gradient */}
              {t.poi_wiki_url ? (
                <image href={t.poi_wiki_url} x="3" y="2" width="104" height="122"
                  clipPath={`url(#hex-clip-${rarity})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <polygon points="55,2 107,29 107,97 55,124 3,97 3,29"
                  fill={`${cfg.border}18`} />
              )}
              {/* Center emoji if no image */}
              {!t.poi_wiki_url && (
                <text x="55" y="72" textAnchor="middle" fontSize="38" dominantBaseline="central">{cardEmoji}</text>
              )}
            </svg>
          </div>

          {/* ── Card name ── */}
          <div style={{ padding:'10px 14px 6px', borderBottom:`1px solid ${cfg.border}33` }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', lineHeight:1.2 }}>{name}</div>
            <div style={{ display:'flex', gap:6, marginTop:4, alignItems:'center' }}>
              <span style={{ fontSize:10, color:'#6B7280' }}>
                {hasPOI ? (t.poi_category || 'poi') : (t.territory_type || 'rural')}
              </span>
              {t.h3_index && (
                <span style={{ fontSize:9, color:'#374151', fontFamily:'monospace' }}>
                  {t.h3_index.slice(0,10)}…
                </span>
              )}
            </div>
          </div>

          {/* ── Stats box (like card power/toughness) ── */}
          <div style={{ padding:'8px 14px', display:'grid',
            gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <Stat icon="💰" val={`+${Math.round(t.resource_credits || t.food_per_tick || 10)}`} label="income" accent={cfg.accent} />
            {hasPOI && t.poi_floor_price
              ? <Stat icon="💎" val={`${t.poi_floor_price}`} label="TDI floor" accent={cfg.accent} />
              : <Stat icon="🛡️" val={`${t.defense_tier || 1}★`} label="defense" accent={cfg.accent} />
            }
            {hasPOI && t.poi_visitors
              ? <Stat icon="👥" val={`${(t.poi_visitors/1e6).toFixed(1)}M`} label="visitors" accent={cfg.accent} />
              : <Stat icon="⚡" val={`+${Math.round(t.resource_energy || 5)}`} label="energy" accent={cfg.accent} />
            }
          </div>

          {/* ── POI description (if any) ── */}
          {hasPOI && t.poi_description && (
            <div style={{ margin:'0 14px 8px', padding:'8px 10px',
              background:`${cfg.border}12`, borderRadius:8, fontSize:11,
              color:'#9CA3AF', lineHeight:1.5, fontStyle:'italic',
              border:`1px solid ${cfg.border}22` }}>
              {t.poi_description.slice(0,120)}{t.poi_description.length>120?'…':''}
            </div>
          )}

          {/* ── Owner strip ── */}
          {(isOwned || isEnemy) && (
            <div style={{ margin:'0 14px 8px', padding:'6px 10px', borderRadius:8,
              background: isOwned ? `${t.border_color || cfg.border}18` : 'rgba(239,68,68,0.1)',
              border:`1px solid ${isOwned ? (t.border_color || cfg.border) : '#EF4444'}33`,
              display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
              <span style={{ fontSize:16 }}>{isOwned ? (t.custom_emoji || '🏴') : '👤'}</span>
              <span style={{ fontWeight:600, color: isOwned ? (t.border_color||'#00FF87') : '#F87171' }}>
                {isOwned ? 'Your territory' : t.owner_username}
              </span>
            </div>
          )}

          {/* ── Action button ── */}
          <div style={{ padding:'0 14px 16px' }}>
            {isFree && player && (
              <button onClick={onRequestClaim} style={{
                width:'100%', padding:'11px 0',
                background:`linear-gradient(135deg, ${cfg.border}cc, ${cfg.border})`,
                border:'none', borderRadius:10, color:'#000',
                fontSize:13, fontWeight:800, cursor:'pointer',
                boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined,
              }}>
                🏴 {hasPOI ? `Claim ${t.poi_name || name}` : 'Claim territory'}
              </button>
            )}
            {isEnemy && (
              <button onClick={onRequestClaim} style={{
                width:'100%', padding:'11px 0',
                background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)',
                borderRadius:10, color:'#EF4444', fontSize:13, fontWeight:700, cursor:'pointer',
              }}>⚔️ Attack · 💸 Buy · 🧩 Puzzle</button>
            )}
            {isOwned && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onRequestClaim} style={{
                  flex:1, padding:'10px 0',
                  background:`${cfg.border}18`, border:`1px solid ${cfg.border}44`,
                  borderRadius:10, color:cfg.accent, fontSize:12, fontWeight:600, cursor:'pointer',
                }}>💰 Revenue</button>
                <button style={{
                  flex:1, padding:'10px 0',
                  background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)',
                  borderRadius:10, color:'#A78BFA', fontSize:12, fontWeight:600, cursor:'pointer',
                }}>🎨 Customize</button>
              </div>
            )}
          </div>

          {/* ── Card footer: token ID ── */}
          {t.token_id && (
            <div style={{ padding:'4px 14px 10px', fontSize:9, color:'#374151',
              fontFamily:'monospace', textAlign:'center' }}>
              NFT #{t.token_id} · Genesis Edition
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  )
}

function Stat({ icon, val, label, accent }: { icon:string; val:string; label:string; accent:string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8,
      padding:'5px 6px', textAlign:'center' }}>
      <div style={{ fontSize:10 }}>{icon}</div>
      <div style={{ fontSize:12, fontWeight:700, color:accent, fontFamily:'monospace' }}>{val}</div>
      <div style={{ fontSize:8, color:'#4B5563', marginTop:1 }}>{label}</div>
    </div>
  )
}
