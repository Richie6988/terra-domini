import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../store'

const R: Record<string, {
  border: string; glow: string; bg: string; accent: string
  label: string; foil: string
}> = {
  common:   { border:'#6B7280', glow:'none',                    bg:'#0f1117',         accent:'#9CA3AF', label:'Common',    foil:'none'  },
  uncommon: { border:'#10B981', glow:'0 0 20px #10B98166',      bg:'#081a12',         accent:'#34D399', label:'Uncommon',  foil:'none'  },
  rare:     { border:'#3B82F6', glow:'0 0 28px #3B82F677',      bg:'#060e24',         accent:'#60A5FA', label:'Rare',      foil:'rgba(147,197,253,0.3)' },
  epic:     { border:'#8B5CF6', glow:'0 0 32px #8B5CF688',      bg:'#0d0618',         accent:'#A78BFA', label:'Epic',      foil:'rgba(196,181,253,0.35)' },
  legendary:{ border:'#F59E0B', glow:'0 0 40px #F59E0B99',      bg:'#150a00',         accent:'#FCD34D', label:'Legendary', foil:'rgba(253,211,77,0.4)' },
  mythic:   { border:'#EC4899', glow:'0 0 50px #EC489999,0 0 90px #EC489944', bg:'#1a0010', accent:'#F472B6', label:'Mythic ✦', foil:'rgba(244,114,182,0.5)' },
}

const BIOME: Record<string, string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿', water:'💧',
}

export function HexCard({ territory: t, onClose, onRequestClaim }: {
  territory: any; onClose: () => void; onRequestClaim: () => void
}) {
  const player  = usePlayer()
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const cfg     = R[rarity] || R.common

  const name     = t.custom_name || t.poi_name || t.place_name || 'Zone'
  const emoji    = t.custom_emoji || t.poi_emoji || BIOME[t.territory_type || t.biome || 'rural'] || '⬡'
  const imgUrl   = t.poi_wiki_url || t.wiki_url || null

  // Mouse tilt
  const wrap = useRef<HTMLDivElement>(null)
  const [rx, setRx] = useState(0)
  const [ry, setRy] = useState(0)
  const [shine, setShine] = useState({ x: 50, y: 50 })

  const onMove = (e: React.MouseEvent) => {
    const b = wrap.current?.getBoundingClientRect()
    if (!b) return
    const px = (e.clientX - b.left) / b.width
    const py = (e.clientY - b.top) / b.height
    setRx((py - 0.5) * -18)
    setRy((px - 0.5) *  22)
    setShine({ x: px * 100, y: py * 100 })
  }
  const onLeave = () => { setRx(0); setRy(0); setShine({ x: 50, y: 50 }) }

  // Shiny foil cycle
  const [foilPos, setFoilPos] = useState(-120)
  useEffect(() => {
    if (!isShiny) return
    const id = setInterval(() => {
      setFoilPos(-120)
      setTimeout(() => setFoilPos(120), 50)
    }, 3000)
    return () => clearInterval(id)
  }, [isShiny])

  // Hex clip path points (flat-top)
  const HEX_W = 160, HEX_H = 184
  const pts = [
    [HEX_W/2, 0],
    [HEX_W, HEX_H/4],
    [HEX_W, HEX_H*3/4],
    [HEX_W/2, HEX_H],
    [0, HEX_H*3/4],
    [0, HEX_H/4],
  ].map(p => p.join(',')).join(' ')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)',
        perspective: '1000px',
      }}
    >
      <motion.div
        initial={{ scale: 0.4, rotateY: -30, opacity: 0 }}
        animate={{ scale: 1,   rotateY:   0, opacity: 1 }}
        exit={{   scale: 0.5, rotateY:  25, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        ref={wrap}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          rotateX: rx, rotateY: ry,
          transformStyle: 'preserve-3d',
          cursor: 'default',
        }}
      >
        {/* ── Card ── */}
        <div style={{
          width: 300,
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          borderRadius: 18,
          boxShadow: `${cfg.glow !== 'none' ? cfg.glow + ',' : ''}inset 0 0 40px ${cfg.border}11`,
          overflow: 'hidden',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}>

          {/* Specular highlight follows mouse */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none',
            background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${cfg.foil !== 'none' ? cfg.foil : 'rgba(255,255,255,0.06)'} 0%, transparent 60%)`,
            mixBlendMode: 'screen',
          }} />

          {/* Foil sweep on shiny */}
          {isShiny && (
            <motion.div
              animate={{ x: [`${foilPos}%`, `${foilPos < 0 ? 160 : -120}%`] }}
              transition={{ duration: 0.85, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: 0, zIndex: 31, pointerEvents: 'none',
                background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.28) 50%, transparent 65%)',
              }}
            />
          )}

          {/* ── Rarity banner ── */}
          <div style={{
            padding: '9px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: `linear-gradient(90deg, ${cfg.border}33, transparent)`,
            borderBottom: `1px solid ${cfg.border}44`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: cfg.accent,
                letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {cfg.label}
              </span>
              {isShiny && <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 700 }}>✨ Shiny</span>}
              {t.nft_version > 1 && (
                <span style={{ fontSize: 10, color: '#A78BFA', background: '#8B5CF622',
                  padding: '2px 7px', borderRadius: 4 }}>v{t.nft_version}</span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#9CA3AF', cursor: 'pointer',
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>✕</button>
          </div>

          {/* ── Hex art area ── */}
          <div style={{ padding: '16px 0 8px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            {/* Subtle radial bg glow */}
            {cfg.glow !== 'none' && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse 60% 80% at 50% 50%, ${cfg.border}18, transparent)`,
              }} />
            )}

            <svg width={HEX_W} height={HEX_H} viewBox={`0 0 ${HEX_W} ${HEX_H}`}
              style={{ position: 'relative', zIndex: 2, filter: cfg.glow !== 'none' ? `drop-shadow(0 0 10px ${cfg.border}88)` : undefined }}>
              <defs>
                <clipPath id={`hc-${rarity}`}>
                  <polygon points={pts} />
                </clipPath>
              </defs>

              {/* Image or solid fill */}
              {imgUrl ? (
                <image href={imgUrl} x="0" y="0" width={HEX_W} height={HEX_H}
                  clipPath={`url(#hc-${rarity})`}
                  preserveAspectRatio="xMidYMid slice" />
              ) : (
                <polygon points={pts}
                  fill={`${cfg.border}18`}
                  stroke="none" />
              )}

              {/* Hex border */}
              <polygon points={pts}
                fill="none"
                stroke={cfg.border}
                strokeWidth="3" />

              {/* Center emoji when no image */}
              {!imgUrl && (
                <text x={HEX_W/2} y={HEX_H/2} textAnchor="middle"
                  dominantBaseline="central" fontSize="52">{emoji}</text>
              )}

              {/* Rarity shimmer border for epic+ */}
              {['epic','legendary','mythic'].includes(rarity) && (
                <polygon points={pts} fill="none"
                  stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              )}
            </svg>
          </div>

          {/* ── Name + id ── */}
          <div style={{ padding: '4px 16px 10px', borderBottom: `1px solid ${cfg.border}22` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{name}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: cfg.accent, background: `${cfg.border}18`,
                padding: '1px 7px', borderRadius: 4 }}>
                {hasPOI ? (t.poi_category || 'POI') : (t.territory_type || 'rural')}
              </span>
              <span style={{ fontSize: 9, color: '#374151', fontFamily: 'monospace' }}>
                {(t.h3_index || '').slice(0, 14)}
              </span>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
            <Stat v={`+${Math.round(t.resource_credits || t.food_per_tick || 10)}`} l="income/tick" c={cfg.accent} i="💰" />
            {hasPOI && t.poi_floor_price
              ? <Stat v={`${t.poi_floor_price} TDI`} l="NFT floor" c={cfg.accent} i="💎" />
              : <Stat v={`${t.defense_tier||1}★`} l="defense" c="#6B7280" i="🛡️" />
            }
            {hasPOI && t.poi_visitors
              ? <Stat v={`${(t.poi_visitors/1e6).toFixed(1)}M`} l="visitors/yr" c="#10B981" i="👥" />
              : <Stat v={`+${Math.round(t.resource_energy || 5)}`} l="energy/tick" c="#6B7280" i="⚡" />
            }
          </div>

          {/* ── POI description ── */}
          {hasPOI && (t.poi_description || t.poi_fun_fact) && (
            <div style={{ margin: '0 14px 10px', padding: '8px 10px',
              background: `${cfg.border}0f`, border: `1px solid ${cfg.border}22`,
              borderRadius: 9, fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
              {t.poi_description
                ? <>{t.poi_description.slice(0,110)}{t.poi_description.length>110?'…':''}</>
                : null
              }
              {t.poi_fun_fact && (
                <div style={{ marginTop: 4, color: '#6B7280', fontStyle: 'italic' }}>
                  💡 {t.poi_fun_fact.slice(0,80)}
                </div>
              )}
            </div>
          )}

          {/* ── Owner badge ── */}
          {(isOwned || isEnemy) && (
            <div style={{ margin: '0 14px 10px', padding: '7px 12px', borderRadius: 9,
              background: isOwned ? `${t.border_color||cfg.border}14` : 'rgba(239,68,68,0.1)',
              border: `1px solid ${isOwned ? (t.border_color||cfg.border) : '#EF4444'}33`,
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{isOwned ? (t.custom_emoji || '🏴') : '👤'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700,
                  color: isOwned ? (t.border_color || '#00FF87') : '#F87171' }}>
                  {isOwned ? (t.custom_name || 'Your territory') : t.owner_username}
                </div>
                {isOwned && t.border_color && (
                  <div style={{ display:'flex', gap:4, marginTop:2 }}>
                    {['#00FF87','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899'].map(c => (
                      <div key={c} style={{ width:8, height:8, borderRadius:'50%', background:c,
                        opacity: c===t.border_color ? 1 : 0.3 }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ padding: '0 14px 16px' }}>
            {isFree && player && (
              <button onClick={onRequestClaim} style={{
                width: '100%', padding: '13px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                background: `linear-gradient(135deg, ${cfg.border}cc, ${cfg.border})`,
                color: rarity === 'common' ? '#fff' : '#000',
                fontSize: 14, fontWeight: 900,
                boxShadow: cfg.glow !== 'none' ? `0 4px 20px ${cfg.border}66` : undefined,
              }}>
                🏴 {hasPOI ? `Claim ${(t.poi_name||name).slice(0,24)}` : 'Claim territory'}
              </button>
            )}
            {isEnemy && (
              <button onClick={onRequestClaim} style={{
                width:'100%', padding:'13px 0', border:'1px solid rgba(239,68,68,0.4)',
                borderRadius:10, cursor:'pointer', background:'rgba(239,68,68,0.12)',
                color:'#EF4444', fontSize:14, fontWeight:700,
              }}>⚔️ Attack &nbsp;·&nbsp; 💸 Buy &nbsp;·&nbsp; 🧩 Puzzle</button>
            )}
            {isOwned && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onRequestClaim} style={{
                  flex:1, padding:'11px 0', borderRadius:10, cursor:'pointer',
                  background:`${cfg.border}18`, border:`1px solid ${cfg.border}44`,
                  color:cfg.accent, fontSize:12, fontWeight:700,
                }}>💰 Revenue</button>
                <button style={{
                  flex:1, padding:'11px 0', borderRadius:10, cursor:'pointer',
                  background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.35)',
                  color:'#A78BFA', fontSize:12, fontWeight:700,
                }}>🎨 Customize</button>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          {t.token_id && (
            <div style={{ padding:'4px 14px 10px', textAlign:'center',
              fontSize:9, color:'#374151', fontFamily:'monospace', borderTop:`1px solid ${cfg.border}22` }}>
              NFT #{t.token_id} · Genesis Edition {isShiny ? '· ✨ 1/64' : ''}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function Stat({ i, v, l, c }: { i:string; v:string; l:string; c:string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'7px 6px', textAlign:'center' }}>
      <div style={{ fontSize:13 }}>{i}</div>
      <div style={{ fontSize:13, fontWeight:800, color:c, fontFamily:'monospace', lineHeight:1.2 }}>{v}</div>
      <div style={{ fontSize:8, color:'#4B5563', marginTop:2, lineHeight:1.2 }}>{l}</div>
    </div>
  )
}
