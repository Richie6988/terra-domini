/**
 * HexCard — Territory detail view.
 * Opens Token3DViewer (Richard's holographic 3D token) as the PRIMARY experience.
 * Territory info panel overlaid on the left.
 */
import { useMemo, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Token3DViewer } from '../shared/Token3DViewer'
import { ClaimCelebration } from '../shared/ClaimCelebration'
import { OwnedTerritoryHub } from '../kingdom/OwnedTerritoryHub'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import { useSound } from '../../hooks/useSound'
import toast from 'react-hot-toast'
import { Swords, Lock, Shield, User, Compass, Coins, Crown } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import { hexPerDay } from '../../services/balance'

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
  urban:    [{res:'Data',       icon:'res_donnees',amount:12},{res:'Influence', icon:'res_influence',amount:8},{res:'Labor',icon:'res_main_oeuvre',amount:15}],
  rural:    [{res:'Food',       icon:'res_nourriture',amount:20},{res:'Water',  icon:'res_eau',amount:15},{res:'Labor',icon:'res_main_oeuvre',amount:10}],
  forest:   [{res:'Food',       icon:'res_nourriture',amount:15},{res:'Water',  icon:'res_eau',amount:12},{res:'Stability',icon:'res_stabilite',amount:8}],
  mountain: [{res:'Iron',       icon:'res_fer',amount:18},{res:'Titanium',  icon:'res_titanium',amount:5},{res:'Coal',icon:'res_charbon',amount:10}],
  coastal:  [{res:'Food',       icon:'res_nourriture',amount:12},{res:'Water',  icon:'res_eau',amount:20},{res:'Gas',icon:'res_gaz',amount:8}],
  desert:   [{res:'Oil',        icon:'res_petrole',amount:15},{res:'Silicon',   icon:'res_silicium',amount:10},{res:'Rare earths',icon:'res_terres_rares',amount:4}],
  tundra:   [{res:'Gas',        icon:'res_gaz',amount:12},{res:'Uranium',   icon:'res_uranium',amount:3},{res:'Water',icon:'res_eau',amount:8}],
  industrial:[{res:'Steel',     icon:'res_acier',amount:15},{res:'Components',icon:'res_composants',amount:8},{res:'Oil',icon:'res_petrole',amount:10}],
  landmark: [{res:'Data',       icon:'res_donnees',amount:10},{res:'Influence', icon:'res_influence',amount:12},{res:'Stability',icon:'res_stabilite',amount:10}],
  grassland:[{res:'Food',       icon:'res_nourriture',amount:18},{res:'Labor',  icon:'res_main_oeuvre',amount:8},{res:'Stability',icon:'res_stabilite',amount:6}],
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

  // Close ALL other panels when Token3D opens (effect, not during render)
  useEffect(() => { setActivePanel(null) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isOwned=t.owner_id===player?.id
  const isEnemy=!!t.owner_id&&!isOwned
  const isFree=!t.owner_id
  const rarity=(t.rarity||'common') as RK
  const cfg=RARITY[rarity]??RARITY.common
  const isShiny=!!t.is_shiny

  const cardName=t.custom_name||t.poi_name||t.place_name||'Zone'
  const income=hexPerDay(t.rarity, t.is_shiny)

  const facts=useMemo(()=>{
    const r=[]
    if(t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visitors / year`)
    if(t.poi_geo_score) r.push(`Geopolitical score: ${t.poi_geo_score}/100`)
    if(t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,90))
    if(t.poi_description&&r.length<3) r.push(t.poi_description.slice(0,90))
    while(r.length<3) r.push('Unique territory · Hexod Season 1')
    return r.slice(0,3)
  },[t])

  const biome  = t.territory_type || t.biome || 'rural'
  const serieNum = t.token_id ? (parseInt(String(t.token_id)) % cfg.serieMax) + 1 : undefined

  // Claim options from backend
  const [claimOpts, setClaimOpts] = useState<any>(null)
  const [claiming, setClaiming] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Fetch claim options when card opens
  useEffect(() => {
    if (t.h3_index && player && isFree) {
      api.get(`/territories/claim-options/?h3_index=${t.h3_index}`).then(r => {
        setClaimOpts(r.data)
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        toast.success(`Exploration started! ${res.data.hours_required}h remaining`)
        setClaiming(false)
        return
      }
      const owned = { ...t, owner_id: player?.id, owner_username: player?.username }
      useStore.getState().setTerritories([owned as any])
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      qc.invalidateQueries({ queryKey: ['kingdoms'] })
      qc.invalidateQueries({ queryKey: ['my-territories'] })
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


  // For owned territories, wrap as kingdom-like shape for OwnedTerritoryHub
  const asKingdom = useMemo(() => ({
    cluster_id: t.cluster_id || t.h3_index,
    h3_indexes: [t.h3_index],
    size: 1,
    tier: 1,
    is_main: false,
    tdc_per_24h: income,
    centroid_lat: t.center_lat ?? t.lat,
    centroid_lon: t.center_lon ?? t.lon,
    territories: [{
      h3_index: t.h3_index,
      name: cardName,
      rarity: rarity,
      biome: biome,
      poi_category: t.poi_category,
      poi_icon: t.poi_icon,
      income_per_day: income,
      defense_points: t.defense_points || 100,
      is_capital: true,
    }],
  }), [t, cardName, rarity, biome, income])

  return (<>
    {/* OWNED hex: show 3-tab hub (Gallery/Customize/Kingdom) */}
    {isOwned && <OwnedTerritoryHub kingdom={asKingdom as any} onClose={onClose} />}

    {/* NON-OWNED hex (free or enemy): keep Token3D as primary for claim flow */}
    {!isOwned && createPortal(
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
          ['--accent' as any]: cfg.c,
          position: 'relative', overflow: 'hidden',
          width: 'min(600px, calc(100vw - 24px))', boxSizing: 'border-box',
          padding: '14px 16px 16px', borderRadius: 18,
          background: `radial-gradient(120% 90% at 0% 0%, ${cfg.c}22 0%, transparent 55%), linear-gradient(180deg, rgba(14,26,44,0.97), rgba(6,12,24,0.98))`,
          backdropFilter: 'blur(30px) saturate(1.2)',
          border: `1.5px solid ${cfg.c}aa`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.6), 0 0 ${Math.max(12, cfg.glow)}px ${cfg.c}44, inset 0 1px 0 rgba(255,255,255,0.08)`,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Rarity foil strip */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${cfg.c}, ${cfg.accent}, ${cfg.c}, transparent)` }} />

          {/* Header: grade emblem + name + chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
              <svg width="46" height="46" viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 6px ${cfg.c}88)` }}>
                <path d="M12 1.5 21.1 6.75v10.5L12 22.5 2.9 17.25V6.75z" fill={`${cfg.c}26`} stroke={cfg.c} strokeWidth="1.2" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: cfg.grade.length > 1 ? 13 : 16, fontWeight: 900, color: cfg.accent }}>{cfg.grade}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cardName.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="hx-chip hx-chip--accent">{cfg.label.toUpperCase()}</span>
                <span className="hx-chip">
                  <IconSVG id={biome} size={14} />{(biome || 'rural').toUpperCase()}
                </span>
                {isShiny && <span className="hx-chip" style={{ color: '#FCD34D', borderColor: 'rgba(252,211,77,0.4)', background: 'rgba(252,211,77,0.12)' }}>SHINY</span>}
                {isEnemy && <span className="hx-chip" style={{ color: '#FF8A95', borderColor: 'rgba(255,77,94,0.45)', background: 'rgba(255,77,94,0.12)' }}>ENEMY</span>}
                {isFree && <span className="hx-chip" style={{ color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)' }}>UNCLAIMED</span>}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[
              { label: 'INCOME', icon: <Coins size={12} />, value: `+${income.toLocaleString()}`, unit: 'HEX/DAY', color: '#FBBF24' },
              { label: 'DEFENSE', icon: <Shield size={12} />, value: Math.round(t.defense_points || 100).toLocaleString(), unit: `TIER ${t.defense_tier || 1}`, color: '#e2e8f0' },
              { label: 'OWNER', icon: <User size={12} />, value: isFree ? 'NONE' : (t.owner_username || 'UNKNOWN'), unit: isFree ? 'AVAILABLE' : isEnemy ? 'HOSTILE' : 'YOU', color: isFree ? '#6EE7B7' : isEnemy ? '#FF8A95' : '#00FF87', text: true },
            ].map(st => (
              <div key={st.label} style={{
                padding: '8px 10px', borderRadius: 10, minWidth: 0,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>
                  {st.icon}{st.label}
                </div>
                <div style={{
                  marginTop: 4, color: st.color, lineHeight: 1.1,
                  fontFamily: st.text ? "'Orbitron', sans-serif" : "'Share Tech Mono', monospace",
                  fontSize: st.text ? 12 : 19, fontWeight: st.text ? 800 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{st.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginTop: 2 }}>{st.unit}</div>
              </div>
            ))}
          </div>

          {/* Actions — based on claim options */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isFree && player && claimOpts?.locked && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                minHeight: 44, padding: '8px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textAlign: 'center',
              }}>
                <Lock size={14} />
                <span>LOCKED{claimOpts?.locked_reason ? ` — ${String(claimOpts.locked_reason).toUpperCase()}` : ''}</span>
              </div>
            )}
            {isFree && player && !claimOpts?.locked && claimOpts?.options?.map((opt: any) => (
              <button key={opt.method} onClick={() => handleClaim(opt.method)} disabled={claiming || !opt.available}
                className={`btn-game ${opt.method === 'free' ? 'btn-game-green' : opt.method === 'buy' ? 'btn-game-gold' : 'btn-game-blue'}`}
                style={{
                  flex: '1 1 140px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 11, letterSpacing: 1.5,
                  opacity: (claiming || !opt.available) ? 0.5 : 1,
                  cursor: claiming ? 'wait' : opt.available ? 'pointer' : 'not-allowed',
                }}>
                {opt.method === 'free' ? <Crown size={15} /> : opt.method === 'buy' ? <IconSVG id="hex_coin" size={16} /> : <Compass size={15} />}
                {claiming ? '...' : opt.method === 'free' ? 'FREE CLAIM' : opt.method === 'buy' ? `BUY · ${opt.cost} HEX` : `EXPLORE ${opt.hours}h`}
              </button>
            ))}
            {isFree && player && !claimOpts && (
              <button onClick={() => handleClaim('free')} disabled={claiming} className="btn-game btn-game-green" style={{
                flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11, letterSpacing: 1.5,
              }}><Crown size={15} />CLAIM</button>
            )}
            {isEnemy && (
              <button onClick={() => { onClose(); setTimeout(() => useStore.getState().setActivePanel('combat'), 100) }} className="btn-game btn-game-red" style={{
                flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 12, letterSpacing: 2,
              }}><Swords size={17} />ATTACK</button>
            )}
            {isOwned && (
              <button onClick={() => { onClose(); setTimeout(() => useStore.getState().setActivePanel('kingdom'), 100) }} className="btn-game btn-game-blue" style={{
                flex: 1, minHeight: 44, fontSize: 11, letterSpacing: 1.5,
              }}>KINGDOM</button>
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
