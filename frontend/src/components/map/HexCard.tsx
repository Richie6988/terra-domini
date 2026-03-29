/**
 * HexCard — Territory detail view.
 * Opens Token3DViewer (Richard's holographic 3D token) as the PRIMARY experience.
 * Territory info panel overlaid on the left.
 */
import { useMemo } from 'react'
import { Token3DViewer } from '../shared/Token3DViewer'
import { useStore, usePlayer } from '../../store'
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
const BIOME_RES: Record<string, { res:string; icon:string; base:number }[]> = {
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
const BIOME_RES_MAPPED = Object.fromEntries(Object.entries(BIOME_RES).map(([k,v])=>[k,v.map(r=>({...r,amount:r.base||10}))]))


/* ── Main HexCard ────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim, isNewClaim = false }:{
  territory:any; onClose:()=>void; onRequestClaim?:()=>void; isNewClaim?: boolean
}) {
  const player=usePlayer()
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


  // Token3DViewer is the PRIMARY experience — Richard's holographic viewer
  return (
    <Token3DViewer
      visible={true}
      onClose={onClose}
      tokenName={cardName.toUpperCase()}
      category={(t.poi_category || biome || 'TERRITORY').toUpperCase()}
      catColor={cfg.c}
      tier={rarity === 'mythic' ? 'EMERALD' : rarity === 'legendary' ? 'GOLD' : rarity === 'epic' ? 'SILVER' : 'BRONZE'}
      serial={serieNum || 1}
      maxSupply={cfg.serieMax}
      edition="GENESIS"
      biome={(biome || 'rural').toUpperCase()}
      power={t.poi_geo_score || Math.floor(Math.random() * 50) + 50}
      rarity={rarity === 'mythic' ? 99 : rarity === 'legendary' ? 95 : rarity === 'epic' ? 85 : rarity === 'rare' ? 70 : rarity === 'uncommon' ? 50 : 30}
      infoPanel={
        <div style={{
          width: 320, padding: 20,
          background: 'rgba(5,5,10,0.92)', borderRadius: 8,
          backdropFilter: 'blur(25px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
          fontFamily: "'Orbitron', sans-serif", color: '#fff',
          maxHeight: '80vh', overflowY: 'auto',
        }}>
          {/* Territory header */}
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, marginBottom: 4 }}>
            {cardName.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 4, background: `${cfg.c}22`, color: cfg.c, fontSize: 9, fontWeight: 700, border: `1px solid ${cfg.c}44` }}>
              {cfg.label}
            </span>
            {isShiny && <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(252,211,77,0.15)', color: '#FCD34D', fontSize: 9, fontWeight: 700 }}>✨ SHINY</span>}
            <span style={{ padding: '2px 8px', borderRadius: 4, background: `${cfg.c}11`, color: cfg.c, fontSize: 9, fontWeight: 700 }}>
              Grade {cfg.grade}
            </span>
          </div>

          {/* Status */}
          <div style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 12,
            background: isOwned ? 'rgba(0,136,74,0.1)' : isEnemy ? 'rgba(239,68,68,0.1)' : `${cfg.c}11`,
            border: `1px solid ${isOwned ? 'rgba(0,136,74,0.3)' : isEnemy ? 'rgba(239,68,68,0.3)' : cfg.c + '33'}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: isOwned ? '#00FF87' : isEnemy ? '#EF4444' : cfg.c }}>
              {isOwned ? '✅ YOUR TERRITORY' : isEnemy ? `⚔️ ${t.owner_username}` : '⬡ FREE — CLAIM IT'}
            </div>
            <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 4 }}>💰 +{income} HEX Coin/day</div>
          </div>

          {/* Facts */}
          <div style={{ marginBottom: 12 }}>
            {facts.map((f: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <span style={{ color: cfg.c, fontWeight: 700, fontSize: 9, flexShrink: 0 }}>#{i+1}</span>
                <span style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Token info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14, padding: '8px 10px', borderRadius: 6, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div>
              <div style={{ fontSize: 7, opacity: 0.4, letterSpacing: 2 }}>TOKEN ID</div>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace' }}>HEX-{(t.h3_index||'').slice(0,8).toUpperCase()}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, opacity: 0.4, letterSpacing: 2 }}>BIOME</div>
              <div style={{ fontSize: 9, fontWeight: 700 }}>{(biome || 'rural').toUpperCase()}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {isFree && player && (
              <button onClick={onRequestClaim} style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: `linear-gradient(135deg, ${cfg.c}cc, ${cfg.c})`,
                color: ['legendary','mythic','epic'].includes(rarity) ? '#000' : '#fff',
                fontSize: 12, fontWeight: 900, letterSpacing: 2,
                boxShadow: `0 4px 24px ${cfg.c}44`,
              }}>🏴 CLAIM THIS TERRITORY</button>
            )}
            {isEnemy && (
              <button onClick={onRequestClaim} style={{
                width: '100%', padding: '12px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
                color: '#EF4444', fontSize: 12, fontWeight: 700, letterSpacing: 2,
              }}>⚔️ ATTACK · 💸 PURCHASE</button>
            )}
            {isOwned && (
              <button onClick={() => useStore.getState().setActivePanel('kingdom')} style={{
                width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(204,136,0,0.3)', background: 'rgba(204,136,0,0.1)',
                color: '#cc8800', fontSize: 10, fontWeight: 700, letterSpacing: 2,
              }}>👑 MANAGE KINGDOM</button>
            )}
          </div>

          <div style={{ marginTop: 14, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 7, opacity: 0.25, letterSpacing: 2, textAlign: 'center' }}>
            HEXOD · POLYGON POS · ERC-721
          </div>
        </div>
      }
    />
  )
}
