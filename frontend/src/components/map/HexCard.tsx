/**
 * HexCard — Territory detail view.
 * Opens Token3DViewer (Richard's holographic 3D token) as the PRIMARY experience.
 * Territory info panel overlaid on the left.
 */
import { useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Token3DViewer } from '../shared/Token3DViewer'
import { ClaimCelebration } from '../shared/ClaimCelebration'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import { useSound } from '../../hooks/useSound'
import toast from 'react-hot-toast'

/* ── Rarity ─────────────────────────────────────────────── */
const RARITY: Record<string, {
  c:string; bg:string; accent:string; label:string; grade:string
  metalness:number; roughness:number
  // Aria visual specs per tier
  foil: 'none'|'subtle'|'shimmer'|'holographic'|'rainbow'|'prismatic'
  glow: number      // px glow radius
  scanlines: boolean
  particles: boolean
  borderStyle: 'solid'|'dashed'|'double'
  serieMax: number  // max per rarity for serie #X/MAX display
}> = {
  common:   { c:'#9CA3AF', bg:'#0d0f18', accent:'#E5E7EB', label:'Common',    grade:'F',  metalness:0.1, roughness:0.9, foil:'none',        glow:0,   scanlines:false, particles:false, borderStyle:'solid',  serieMax:10000 },
  uncommon: { c:'#10B981', bg:'#04100a', accent:'#34D399', label:'Uncommon',  grade:'C',  metalness:0.3, roughness:0.7, foil:'subtle',      glow:4,   scanlines:false, particles:false, borderStyle:'solid',  serieMax:5000  },
  rare:     { c:'#3B82F6', bg:'#030a1a', accent:'#93C5FD', label:'Rare',      grade:'B',  metalness:0.5, roughness:0.5, foil:'shimmer',     glow:8,   scanlines:true,  particles:false, borderStyle:'solid',  serieMax:1000  },
  epic:     { c:'#8B5CF6', bg:'#07030f', accent:'#C4B5FD', label:'Epic',      grade:'A',  metalness:0.7, roughness:0.3, foil:'holographic', glow:14,  scanlines:true,  particles:false, borderStyle:'double', serieMax:250   },
  legendary:{ c:'#F59E0B', bg:'#0f0700', accent:'#FCD34D', label:'Legendary', grade:'S',  metalness:0.9, roughness:0.1, foil:'rainbow',     glow:22,  scanlines:true,  particles:true,  borderStyle:'double', serieMax:50    },
  mythic:   { c:'#EC4899', bg:'#0f0008', accent:'#F9A8D4', label:'Mythic',    grade:'SS', metalness:0.95,roughness:0.05,foil:'prismatic',   glow:32,  scanlines:true,  particles:true,  borderStyle:'double', serieMax:10    },
}
type RK = keyof typeof RARITY

/* ── Biome resources ─────────────────────────────────────── */
const BIOME_RES: Record<string, { res:string; icon:string; amount:number }[]> = {
  urban:    [{res:'Données',    icon:'📊',amount:12},{res:'Influence', icon:'🌐',amount:8},{res:'Main-d\'œuvre',icon:'👷',amount:15}],
  rural:    [{res:'Nourriture', icon:'🌾',amount:20},{res:'Eau',       icon:'💧',amount:15},{res:'Main-d\'œuvre',icon:'👷',amount:10}],
  forest:   [{res:'Nourriture', icon:'🌾',amount:15},{res:'Eau',       icon:'💧',amount:12},{res:'Stabilité',   icon:'⚖️',amount:8}],
  mountain: [{res:'Fer',        icon:'🪨',amount:18},{res:'Titanium',  icon:'🔷',amount:5},{res:'Charbon',      icon:'⬛',amount:10}],
  coastal:  [{res:'Nourriture', icon:'🌾',amount:12},{res:'Eau',       icon:'💧',amount:20},{res:'Gaz',         icon:'💨',amount:8}],
  desert:   [{res:'Pétrole',    icon:'🛢️',amount:15},{res:'Silicium',  icon:'💠',amount:10},{res:'Terres rares',icon:'💎',amount:4}],
  tundra:   [{res:'Gaz',        icon:'💨',amount:12},{res:'Uranium',   icon:'☢️',amount:3},{res:'Eau',          icon:'💧',amount:8}],
  industrial:[{res:'Acier',     icon:'⚙️',amount:15},{res:'Composants',icon:'🔌',amount:8},{res:'Pétrole',     icon:'🛢️',amount:10}],
  landmark: [{res:'Données',    icon:'📊',amount:10},{res:'Influence', icon:'🌐',amount:12},{res:'Stabilité',   icon:'⚖️',amount:10}],
  grassland:[{res:'Nourriture', icon:'🌾',amount:18},{res:'Main-d\'œuvre',icon:'👷',amount:8},{res:'Stabilité',icon:'⚖️',amount:6}],
}
const BIOME_RES_MAPPED = BIOME_RES


/* ── Main HexCard ────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim, isNewClaim = false }:{
  territory:any; onClose:()=>void; onRequestClaim?:()=>void; isNewClaim?: boolean
}) {
  const player=usePlayer()
  const setActivePanel = useStore(s => s.setActivePanel)
  const qc = useQueryClient()
  const { play } = useSound()

  // Close ALL other panels when Token3D opens
  useState(() => { setActivePanel(null) })

  const isOwned=t.owner_id===player?.id
  const isEnemy=!!t.owner_id&&!isOwned
  const isFree=!t.owner_id
  const rarity=(t.rarity||'common') as RK
  const cfg=RARITY[rarity]??RARITY.common
  const isShiny=!!t.is_shiny

  const cardName=t.custom_name||t.poi_name||t.place_name||'Zone'
  const income=Math.round((t.resource_credits||t.food_per_tick||10)*288)

  const facts=useMemo(()=>{
    const r=[]
    if(t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visiteurs / an`)
    if(t.poi_geo_score) r.push(`Score géopolitique : ${t.poi_geo_score}/100`)
    if(t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,90))
    if(t.poi_description&&r.length<3) r.push(t.poi_description.slice(0,90))
    while(r.length<3) r.push('Territoire unique · Hexod Saison 1')
    return r.slice(0,3)
  },[t])

  const biome  = t.territory_type || t.biome || 'rural'
  const serieNum = t.token_id ? (parseInt(String(t.token_id)) % cfg.serieMax) + 1 : undefined

  // Claim options from backend
  const [claimOpts, setClaimOpts] = useState<any>(null)
  const [claiming, setClaiming] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Fetch claim options when card opens
  useState(() => {
    if (t.h3_index && player && isFree) {
      api.get(`/territories/claim-options/?h3_index=${t.h3_index}`).then(r => {
        setClaimOpts(r.data)
      }).catch(() => {})
    }
  })

  const handleClaim = useCallback(async (method: string) => {
    if (claiming || !t.h3_index) return
    setClaiming(true)
    try {
      const res = await api.post('/territories/claim/', {
        h3_index: t.h3_index,
        method,
        lat: t.center_lat ?? t.lat,
        lon: t.center_lon ?? t.lon,
      })
      if (res.data.status === 'exploration_started') {
        toast.success(`🔍 Exploration started! ${res.data.hours_required}h remaining`)
        setClaiming(false)
        return
      }
      const owned = { ...t, owner_id: player?.id, owner_username: player?.username }
      useStore.getState().setTerritories([owned as any])
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      play('claim')
      setCelebrating(true)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Claim failed'
      toast.error(msg)
      play('error')
    } finally {
      setClaiming(false)
    }
  }, [claiming, t, player])


  return (<>
    {createPortal(
    <Token3DViewer
      visible={true}
      onClose={onClose}
      tokenName={cardName.toUpperCase()}
      category={(t.poi_category || biome || 'TERRITORY').toUpperCase()}
      catColor={cfg.c}
      iconId={t.poi_icon || t.poi_category?.toLowerCase() || biome || 'city'}
      tier={rarity === 'mythic' ? 'EMERALD' : rarity === 'legendary' ? 'GOLD' : rarity === 'epic' ? 'SILVER' : 'BRONZE'}
      serial={serieNum || 1}
      maxSupply={cfg.serieMax}
      edition="GENESIS"
      biome={(biome || 'rural').toUpperCase()}
      power={t.poi_geo_score || Math.floor(Math.random() * 50) + 50}
      rarity={rarity === 'mythic' ? 99 : rarity === 'legendary' ? 95 : rarity === 'epic' ? 85 : rarity === 'rare' ? 70 : rarity === 'uncommon' ? 50 : 30}
      infoPanel={
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(235,242,250,0.95), rgba(220,230,242,0.92))',
          backdropFilter: 'blur(30px) saturate(1.2)',
          border: '1px solid rgba(0,60,100,0.15)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          maxWidth: 700, width: '100%',
        }}>
          {/* Territory name + rarity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 900, color: '#1a2a3a', letterSpacing: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cardName.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 10,
                background: `${cfg.c}15`, color: cfg.c,
                fontSize: 7, fontWeight: 700, border: `1px solid ${cfg.c}30`,
              }}>
                {cfg.label}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 10,
                background: 'rgba(0,60,100,0.05)', color: 'rgba(26,42,58,0.5)',
                fontSize: 7, fontWeight: 600,
              }}>
                {(biome || 'rural').toUpperCase()}
              </span>
              {isShiny && <span style={{
                padding: '2px 8px', borderRadius: 10,
                background: 'rgba(252,211,77,0.15)', color: '#cc8800',
                fontSize: 7, fontWeight: 700,
              }}>✨ SHINY</span>}
            </div>
          </div>

          {/* Income */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>
              +{income}
            </div>
            <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.4)', letterSpacing: 1 }}>HEX/DAY</div>
          </div>

          {/* Action buttons — based on claim options */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isFree && player && claimOpts?.locked && (
              <div style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(100,100,100,0.1)', border: '1px solid rgba(100,100,100,0.2)',
                color: '#9CA3AF', fontSize: 8, fontWeight: 700, letterSpacing: 1,
              }}>🔒 LOCKED</div>
            )}
            {isFree && player && !claimOpts?.locked && claimOpts?.options?.map((opt: any) => (
              <button key={opt.method} onClick={() => handleClaim(opt.method)} disabled={claiming || !opt.available}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: claiming ? 'wait' : opt.available ? 'pointer' : 'not-allowed',
                  background: opt.method === 'free'
                    ? `linear-gradient(135deg, ${cfg.c}dd, ${cfg.c})`
                    : opt.method === 'buy'
                    ? 'linear-gradient(135deg, rgba(204,136,0,0.8), rgba(204,136,0,0.6))'
                    : 'linear-gradient(135deg, rgba(0,153,204,0.6), rgba(0,153,204,0.4))',
                  color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1,
                  opacity: (claiming || !opt.available) ? 0.4 : 1,
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                {claiming ? '⏳...' : opt.method === 'free' ? '🏴 FREE' : opt.method === 'buy' ? `💰 ${opt.cost}◆` : `🔍 ${opt.hours}h`}
              </button>
            ))}
            {isFree && player && !claimOpts && (
              <button onClick={() => handleClaim('free')} disabled={claiming} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${cfg.c}dd, ${cfg.c})`,
                color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
              }}>🏴 CLAIM</button>
            )}
            {isEnemy && (
              <button onClick={() => { onClose(); setTimeout(() => useStore.getState().setActivePanel('combat'), 100) }} style={{
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.08)',
                color: '#dc2626', fontSize: 8, fontWeight: 900, letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
              }}>⚔️ ATTACK</button>
            )}
            {isOwned && (
              <button onClick={() => { onClose(); setTimeout(() => useStore.getState().setActivePanel('kingdom'), 100) }} style={{
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid rgba(0,153,204,0.3)', background: 'rgba(0,153,204,0.08)',
                color: '#0099cc', fontSize: 8, fontWeight: 900, letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
              }}>👑 KINGDOM</button>
            )}
          </div>
        </div>
      }
    />,
    document.body
  )}
  {celebrating && createPortal(
    <ClaimCelebration
      visible={celebrating}
      territoryName={cardName.toUpperCase()}
      rarity={rarity}
      onComplete={() => { setCelebrating(false); onClose() }}
    />,
    document.body
  )}
  </>)
}
