/**
 * HexCard — Territory detail view.
 * Opens Token3DViewer (Richard's holographic 3D token) as the PRIMARY experience.
 * Territory info panel overlaid on the left.
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
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
import { gridDisk } from 'h3-js'

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


const fmtHours = (h: number) => {
  const m = Math.round((Number(h) || 0) * 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${Math.max(1, m)} min`
}

/* ── Main HexCard ────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim, onAttack, isNewClaim = false }:{
  territory:any; onClose:()=>void; onRequestClaim?:()=>void; onAttack?:()=>void; isNewClaim?: boolean
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
  // Real yield from the server: rarity x resources on the hex (oil, gold…) ± per-hex variation
  const { data: card } = useQuery<any>({
    queryKey: ['territory-card', t.h3_index],
    queryFn: () => api.get(`/codex/territory/${t.h3_index}/`).then(r => r.data),
    enabled: !!t.h3_index, staleTime: 60000,
  })
  const income = Math.round(card?.hex_per_day ?? hexPerDay(t.rarity, t.is_shiny))

  const facts=useMemo(()=>{
    const r=[]
    if(t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visitors / year`)
    if(t.poi_geo_score) r.push(`Geopolitical score: ${t.poi_geo_score}/100`)
    if(t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,90))
    if(t.poi_description&&r.length<3) r.push(t.poi_description.slice(0,90))
    while(r.length<3) r.push('Unique territory · Hexod Season 1')
    return r.slice(0,3)
  },[t])

  // measured terrain (ocean, lake, ice, farmland…) is more precise than the territory type; 'grassland' = legacy default
  // Hexes nobody created yet have no terrain on the client: ask the server (land/sea mask + measured land cover)
  const { data: cardInfo } = useQuery<any>({ queryKey: ['codex-territory', t.h3_index],
    queryFn: () => api.get(`/codex/territory/${t.h3_index}/`).then(r => r.data), enabled: !!t.h3_index, staleTime: 300000 })
  const biome  = (t.biome && t.biome !== 'grassland' ? t.biome : '') || cardInfo?.terrain || t.territory_type || ''
  const biomeIcon = ({ lake: 'water_drop', ice: 'glacier', farmland: 'wheat', grassland: 'sprout', wetland: 'leaf', water: 'ocean', arctic: 'tundra' } as Record<string, string>)[biome] || biome
  const serieNum = t.token_id ? (parseInt(String(t.token_id)) % cfg.serieMax) + 1 : undefined

  // Claim options from backend
  const [claimOpts, setClaimOpts] = useState<any>(null)
  const [optsError, setOptsError] = useState(false)
  const [optsTry, setOptsTry] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [bonusHex, setBonusHex] = useState(0)

  // Fetch claim options for THIS hex (re-runs when the player switches hex or the profile loads late —
  // a [] dependency left a stale/missing option set and fell back to a FREE claim that the server refuses)
  useEffect(() => {
    setClaimOpts(null); setOptsError(false)
    if (!t.h3_index || !player?.id || !isFree) return
    let alive = true
    api.get(`/territories/claim-options/?h3_index=${t.h3_index}`)
      .then(r => { if (alive) setClaimOpts(r.data) })
      .catch(() => { if (alive) setOptsError(true) })
    return () => { alive = false }
  }, [t.h3_index, player?.id, isFree, optsTry])

  // Not enough HEX: the shop sells HEX packs (real money only ever buys HEX)
  const openShop = () => { onClose(); setTimeout(() => useStore.getState().setActivePanel('shop'), 100) }

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
      if (res.data.status === 'exploration_started' || res.data.status === 'in_progress') {
        // Exploration is NOT a claim yet: no local ownership, no celebration (RULE 1)
        play(res.data.status === 'exploration_started' ? 'explore' : 'notify')
        const secs = Number(res.data.eta_seconds ?? (res.data.hours_required || 0) * 3600)
        const left = secs >= 3600 ? `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m` : `${Math.max(1, Math.round(secs / 60))} min`
        toast.success(res.data.status === 'in_progress'
          ? `Still exploring — ${left} left. Come back to finish the claim.`
          : `Exploration started — ${left}. Come back to finish the claim.`, { duration: 5000 })
        qc.invalidateQueries({ queryKey: ['pending-claims'] })
        setClaiming(false)
        onClose()
        return
      }
      const owned = { ...t, owner_id: player?.id, owner_username: player?.username }
      useStore.getState().setTerritories([owned as any])
      if (typeof res.data.balance === 'number') {
        const s = useStore.getState()
        s.setBalance({ ...(s.balance || {}), in_game: res.data.balance } as any)
      }
      setBonusHex(Number(res.data.bonus_hex) || 0)
      ;['player', 'wallet', 'kingdoms', 'my-territories', 'loop-status', 'daily-missions', 'pending-claims']
        .forEach(k => qc.invalidateQueries({ queryKey: [k] }))
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


  // Stable callback: ClaimCelebration restarts its animation whenever onComplete changes identity,
  // so an inline arrow (new on every re-render after the claim invalidations) meant it never finished.
  const doneRef = useRef<() => void>(() => {})
  doneRef.current = () => {
    setCelebrating(false)
    if (bonusHex > 0) toast.success(`+${bonusHex} HEX starter bonus`, { duration: 4000 })
    window.dispatchEvent(new CustomEvent('hexod:claim-celebrated'))
    onClose()
  }
  const onCelebrated = useCallback(() => doneRef.current(), [])

  // Owned hex: the token opens first; its button leads to DEFENSE (lone territory) or KINGDOM (connected hexes),
  // both on the ARMY tab where the stationed troops, defense and upgrades are (owner 2026-10-19)
  const [hub, setHub] = useState(false)
  const cluster = useMemo(() => {
    if (!isOwned) return [t.h3_index]
    const mine = useStore.getState().territories
    const seen = new Set([t.h3_index]), todo = [t.h3_index]
    while (todo.length && seen.size < 200) {
      for (const n of gridDisk(todo.pop()!, 1)) {
        if (!seen.has(n) && (mine as any)[n]?.owner_id === player?.id) { seen.add(n); todo.push(n) }
      }
    }
    return [t.h3_index, ...[...seen].filter(h => h !== t.h3_index)]
  }, [isOwned, t.h3_index, player?.id])
  const inKingdom = cluster.length > 1

  // For owned territories, wrap as kingdom-like shape for OwnedTerritoryHub
  const asKingdom = useMemo(() => ({
    cluster_id: t.cluster_id || t.h3_index,
    h3_indexes: cluster,
    size: cluster.length,
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
  }), [t, cardName, rarity, biome, income, cluster])

  return (<>
    {/* OWNED hex: show 3-tab hub (Gallery/Customize/Kingdom) */}
    {isOwned && hub && <OwnedTerritoryHub kingdom={asKingdom as any} initialTab="army" onClose={onClose} />}

    {/* Token first for every hex (owned: DEFENSE / KINGDOM button below) */}
    {!(isOwned && hub) && !celebrating && createPortal(
    <Token3DViewer
      visible={true}
      onClose={onClose}
      tokenName={cardName.toUpperCase()}
      category={(t.poi_category || biome || 'TERRITORY').toUpperCase()}
      catColor={cfg.c}
      iconId={t.poi_icon || t.poi_category?.toLowerCase() || biomeIcon || 'city'}
      rarityKey={rarity}
      h3Index={t.h3_index}
      description={t.poi_description ? String(t.poi_description).slice(0, 220) : undefined}
      serial={serieNum || 1}
      maxSupply={cfg.serieMax}
      edition="GENESIS"
      biome={(biome || '...').toUpperCase()}
      power={t.poi_geo_score || 50}
      rarity={rarity === 'mythic' ? 99 : rarity === 'legendary' ? 95 : rarity === 'epic' ? 85 : rarity === 'rare' ? 70 : rarity === 'uncommon' ? 50 : 30}
      infoPanel={
        <div style={{
          ['--accent' as any]: cfg.c,
          position: 'relative', overflow: 'hidden',
          width: 'min(560px, calc(100vw - 24px))', boxSizing: 'border-box',
          padding: '10px 14px 12px', borderRadius: 16,
          // Dark glass matching the token studio: the token stays the star
          background: 'linear-gradient(180deg, rgba(18,26,48,0.92), rgba(8,12,24,0.94))',
          border: `1px solid ${cfg.c}55`,
          boxShadow: '0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'var(--font-heading)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Rarity foil strip */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${cfg.c}, ${cfg.accent}, ${cfg.c}, transparent)` }} />

          {/* Header: grade emblem + name + chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 400, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 0 rgba(0,0,0,0.45)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cardName.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', transform: 'scale(0.92)', transformOrigin: 'left center' }}>
                <span className="hx-chip hx-chip--accent">{cfg.label.toUpperCase()}</span>
                <span className="hx-chip">
                  <IconSVG id={biomeIcon || 'globe'} size={14} />{(biome || '...').toUpperCase()}
                </span>
                {isShiny && <span className="hx-chip" style={{ color: '#FCD34D', borderColor: 'rgba(252,211,77,0.4)', background: 'rgba(252,211,77,0.12)' }}>SHINY</span>}
                {isEnemy && <span className="hx-chip" style={{ color: '#FF8A95', borderColor: 'rgba(255,77,94,0.45)', background: 'rgba(255,77,94,0.12)' }}>ENEMY</span>}
                {isFree && <span className="hx-chip" style={{ color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)' }}>UNCLAIMED</span>}
              </div>
            </div>
          </div>

          {/* What this hex sits on, in one line */}
          {card && (card.hex_bonuses?.length > 0 || card.resources?.length > 0) && (
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: '#cbd5e1', textTransform: 'none', letterSpacing: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {card.resources?.length > 0 && <>Produces <b style={{ color: '#fff' }}>{card.resources.slice(0, 3).map((r: any) => r.name).join(', ')}</b></>}
              {card.bonus_pct > 0 && <span style={{ color: '#fde68a' }}> · +{card.bonus_pct}% HEX</span>}
            </div>
          )}

          {/* Stats: one compact row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ color: '#FBBF24', fontSize: 20, textShadow: '0 2px 0 rgba(0,0,0,0.35)' }}>+{income.toLocaleString()}
              <small style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>HEX/DAY</small></span>
            <span style={{ color: '#e2e8f0', fontSize: 14 }}><Shield size={12} /> {Math.round(t.defense_points || 100).toLocaleString()}
              <small style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>DEF</small></span>
            <span style={{ color: isFree ? '#6EE7B7' : isEnemy ? '#FF8A95' : '#00FF87', fontSize: 13 }}><User size={12} /> {isFree ? 'FREE' : (t.owner_username || 'UNKNOWN')}</span>
          </div>

          {/* Plain-language context: why this price, what explore means, what you can afford */}
          {isFree && player && claimOpts && !claimOpts.locked && (() => {
            const buy = claimOpts.options?.find((o: any) => o.method === 'buy')
            const exp = claimOpts.options?.find((o: any) => o.method === 'explore')
            const bal = Math.floor(Number(buy?.balance ?? claimOpts.balance ?? 0))
            const lines: string[] = []
            if (claimOpts.is_first) lines.push('Your first zone is free. It starts filling your HARVEST stock right away.')
            else {
              lines.push(claimOpts.is_adjacent
                ? 'Next to your kingdom: best price.'
                : 'Not touching your kingdom: costs more and explores slower. Pick a hex next to your land to save.')
              if (buy && !buy.available) lines.push(`You have ${bal.toLocaleString()} HEX: ${Math.ceil(buy.cost - bal).toLocaleString()} more needed. Collect your harvest or claim mission rewards.`)
              if (exp && exp.available) lines.push(`Explore is free but takes ${fmtHours(exp.hours)}. Come back after that and tap EXPLORE again to take the zone.`)
              if (exp && !exp.available) lines.push(`You already have ${exp.running} exploration${exp.running > 1 ? 's' : ''} running (${exp.slots} at a time). Wait for it, or get an Extra Explorer in the Shop.`)
            }
            return (
              <div style={{ fontSize: 11, lineHeight: 1.4, color: '#94a3b8', fontWeight: 600, fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}>
                {lines.length > 0 && <div>{lines[lines.length > 1 ? 1 : 0]}</div>}
              </div>
            )
          })()}

          {/* Actions — based on claim options */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isFree && player && claimOpts?.locked && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                minHeight: 44, padding: '8px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textAlign: 'center',
              }}>
                <Lock size={14} />
                <span>LOCKED{claimOpts?.locked_reason ? ` — ${String(claimOpts.locked_reason).toUpperCase()}` : ''}</span>
              </div>
            )}
            {isFree && player && claimOpts?.options?.filter((o: any) => o.method === 'unlock').map((opt: any) => (
              <button key="unlock" onClick={() => opt.available ? handleClaim('unlock') : openShop()} disabled={claiming}
                className="btn-game btn-game-gold"
                title={opt.available ? `Unlock this place now for ${opt.cost} HEX` : 'Not enough HEX: open the shop to get more'}
                style={{ flex: '1 1 140px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}>
                <IconSVG id="hex_coin" size={16} />{claiming ? '...' : opt.available ? `UNLOCK NOW · ${opt.cost.toLocaleString()} HEX` : `GET HEX · ${opt.cost.toLocaleString()} NEEDED`}
              </button>
            ))}
            {isFree && player && !claimOpts?.locked && claimOpts?.options?.filter((o: any) => o.method !== 'unlock').map((opt: any) => (
              <button key={opt.method} onClick={() => (opt.method === 'buy' && !opt.available ? openShop() : handleClaim(opt.method))}
                disabled={claiming || (!opt.available && opt.method !== 'buy')}
                className={`btn-game ${opt.method === 'free' ? 'btn-game-green' : opt.method === 'buy' ? 'btn-game-gold' : 'btn-game-blue'}`}
                style={{
                  flex: '1 1 140px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 13, letterSpacing: 0.5,
                  opacity: (claiming || (!opt.available && opt.method !== 'buy')) ? 0.5 : 1,
                  cursor: claiming ? 'wait' : (opt.available || opt.method === 'buy') ? 'pointer' : 'not-allowed',
                }}>
                {opt.method === 'free' ? <Crown size={15} /> : opt.method === 'buy' ? <IconSVG id="hex_coin" size={16} /> : <Compass size={15} />}
                {claiming ? '...' : opt.method === 'free' ? 'FREE CLAIM' : opt.method === 'buy' ? (opt.available ? `BUY · ${opt.cost} HEX` : `GET HEX · ${opt.cost} NEEDED`) : `EXPLORE · ${fmtHours(opt.hours)}`}
              </button>
            ))}
            {isFree && player && !claimOpts && !optsError && (
              <div className="hx-skeleton" style={{ flex: 1, minHeight: 44, borderRadius: 12 }} aria-label="Loading claim options" />
            )}
            {isFree && player && optsError && (
              <button onClick={() => setOptsTry(n => n + 1)} className="btn-game btn-game-blue" style={{
                flex: 1, minHeight: 44, fontSize: 12, letterSpacing: 0.5,
              }}>COULD NOT LOAD PRICES — RETRY</button>
            )}
            {isEnemy && (
              <button onClick={() => { if (onAttack) onAttack(); else { onClose(); setTimeout(() => useStore.getState().setActivePanel('combat'), 100) } }} className="btn-game btn-game-red" style={{
                flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, letterSpacing: 0.5,
              }}><Swords size={17} />ATTACK</button>
            )}
            {isOwned && (
              <button onClick={() => setHub(true)} className={`btn-game ${inKingdom ? 'btn-game-gold' : 'btn-game-blue'}`} style={{
                flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, letterSpacing: 0.5,
              }}>{inKingdom ? <><Crown size={16} />KINGDOM · {cluster.length} HEXES</> : <><Shield size={16} />DEFENSE</>}</button>
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
      onComplete={onCelebrated}
    />,
    document.body
  )}
  </>)
}
