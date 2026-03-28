/**
 * LadderPanel — Classement mondial + joueurs proches (Alex + GAME spec)
 *
 * Onglets :
 *   Mondial   — top 100 par territoires + revenus
 *   Proches   — joueurs dans un rayon de 500km (géolocalisation)
 *
 * Colonnes : Rang · Joueur · Territoires · Revenu/j · Rareté max · Batailles
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { SkeletonList } from '../ui/Utils'

interface Props { onClose: () => void }

type Scope = 'global' | 'nearby'

const MEDALS = ['🥇','🥈','🥉']

export function LadderPanel({ onClose }: Props) {
  const [scope, setScope]   = useState<Scope>('global')
  const [pos, setPos]       = useState<{lat:number;lon:number}|null>(null)
  const player = usePlayer()

  // Géolocalisation pour le scope "nearby"
  useEffect(() => {
    if (scope !== 'nearby' || pos) return
    fetch('/api/geoip/').then(r=>r.json())
      .then(d => { if (d.lat && d.lon) setPos({lat:d.lat,lon:d.lon}) })
      .catch(()=>{
        navigator.geolocation?.getCurrentPosition(
          p => setPos({lat:p.coords.latitude, lon:p.coords.longitude}),
          () => {}
        )
      })
  }, [scope])

  const queryParams = scope === 'nearby' && pos
    ? `?scope=nearby&lat=${pos.lat}&lon=${pos.lon}&radius_km=500`
    : '?scope=global'

  const { data, isLoading } = useQuery({
    queryKey: ['ladder', scope, pos?.lat, pos?.lon],
    queryFn: () => api.get(`/territories-geo/ladder/${queryParams}`).then(r => r.data),
    staleTime: 60000,
    enabled: scope === 'global' || !!pos,
  })

  const entries: any[] = data?.entries || []
  const myRank: number | null = data?.my_rank || null

  return (
    <GlassPanel title="LADDER" onClose={onClose} accent="#8b5cf6" width={Math.min(420, window.innerWidth - 8)}>
      {/* Stats bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12,
        padding:'8px 12px', background:'rgba(255,255,255,0.5)', borderRadius:8,
        border:'1px solid rgba(0,60,100,0.1)' }}>
        <span style={{ fontSize:9, color:'rgba(26,42,58,0.45)', fontFamily:"'Share Tech Mono', monospace" }}>
          {data?.total || 0} ACTIVE PLAYERS
        </span>
        {myRank && <span style={{ fontSize:9, color:'#8b5cf6', fontWeight:700, letterSpacing:1 }}>YOUR RANK: #{myRank}</span>}
      </div>

      {/* Scope tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {([['global','🌍 WORLD'],['nearby','📍 NEARBY']] as const).map(([s,label]) => (
          <button key={s} onClick={() => setScope(s)} style={{
            flex:1, padding:'7px', borderRadius:20, cursor:'pointer', fontSize:8, fontWeight: scope===s ? 700 : 500,
            letterSpacing:1, fontFamily:"'Orbitron', system-ui, sans-serif",
            background: scope===s ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.5)',
            border:`1px solid ${scope===s ? 'rgba(139,92,246,0.3)' : 'rgba(0,60,100,0.1)'}`,
            color: scope===s ? '#8b5cf6' : 'rgba(26,42,58,0.45)',
          }}>{label}</button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{
        display:'grid', gridTemplateColumns:'40px 1fr 52px 60px 52px',
        gap:4, padding:'8px 12px', marginBottom:4,
        borderBottom:'1px solid rgba(0,60,100,0.1)',
        fontSize:7, color:'rgba(26,42,58,0.4)', letterSpacing:2,
        fontFamily:"'Orbitron', system-ui, sans-serif",
      }}>
        <div style={{ textAlign:'center' }}>#</div>
        <div>PLAYER</div>
        <div style={{ textAlign:'center' }}>HEX</div>
        <div style={{ textAlign:'right' }}>◆/D</div>
        <div style={{ textAlign:'center' }}>⚔</div>
      </div>

      {/* List */}
      <div>
        {isLoading ? (
          <div style={{ padding:'12px' }}><SkeletonList count={8} /></div>
        ) : scope === 'nearby' && !pos ? (
          <div style={{ padding:'32px', textAlign:'center', color:'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>📍</div>
            <div style={{ fontSize:9, letterSpacing:2 }}>LOCATING...</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'rgba(26,42,58,0.4)' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🗺️</div>
            <div style={{ fontSize:9, letterSpacing:2 }}>
              {scope === 'nearby' ? 'NO PLAYERS IN 500KM RANGE' : 'NO RANKED PLAYERS'}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {entries.map((entry: any, i: number) => (
              <LadderRow key={entry.player_id} entry={entry} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* My position if outside visible top */}
      {myRank && myRank > 20 && player && (
        <div style={{
          padding:'10px 12px', marginTop:8,
          borderTop:'1px solid rgba(0,60,100,0.1)',
          background:'rgba(139,92,246,0.05)', borderRadius:6,
        }}>
          <div style={{ fontSize:8, color:'rgba(26,42,58,0.4)', marginBottom:6, letterSpacing:2 }}>YOUR POSITION</div>
          <LadderRow
            entry={{
              rank: myRank,
              username: player.username,
              commander_rank: player.commander_rank || 1,
              territories: 0,
              daily_income: 0,
              battles_won: 0,
              max_rarity: 'Common',
              max_rarity_color: 'rgba(26,42,58,0.6)',
              is_me: true,
            }}
            index={myRank - 1}
            compact
          />
        </div>
      )}
    </GlassPanel>
  )
}

function LadderRow({ entry, index, compact = false }: { entry:any; index:number; compact?:boolean }) {
  const isTop3 = entry.rank <= 3
  const bgColor = entry.is_me
    ? 'rgba(245,158,11,0.08)'
    : isTop3 ? 'rgba(255,255,255,0.02)' : 'transparent'

  return (
    <motion.div
      initial={{ opacity:0, x:10 }}
      animate={{ opacity:1, x:0 }}
      transition={{ delay: Math.min(index * 0.02, 0.4) }}
      style={{
        display:'grid', gridTemplateColumns:'40px 1fr 52px 60px 52px',
        gap:4, padding: compact ? '6px 16px' : '10px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.04)',
        background: bgColor,
        alignItems:'center',
        borderLeft: entry.is_me ? '3px solid #F59E0B' : '3px solid transparent',
      }}
    >
      {/* Rang */}
      <div style={{ textAlign:'center' }}>
        {entry.rank <= 3
          ? <span style={{ fontSize:16 }}>{MEDALS[entry.rank-1]}</span>
          : <span style={{ fontSize:11, fontFamily:'monospace', color: entry.is_me ? '#F59E0B' : '#6B7280', fontWeight: entry.is_me ? 800 : 400 }}>
              #{entry.rank}
            </span>
        }
      </div>

      {/* Joueur */}
      <div style={{ minWidth:0 }}>
        <div style={{
          fontSize:12, fontWeight: entry.is_me ? 800 : 600,
          color: entry.is_me ? '#F59E0B' : '#fff',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          display:'flex', alignItems:'center', gap:5,
        }}>
          {entry.is_me && <span style={{ fontSize:10 }}>★</span>}
          {entry.username}
        </div>
        <div style={{ fontSize:9, color:'rgba(26,42,58,0.35)', marginTop:1, display:'flex', gap:6 }}>
          <span>Rang {entry.commander_rank}</span>
          {entry.max_rarity && (
            <span style={{ color: entry.max_rarity_color, fontWeight:700 }}>{entry.max_rarity}</span>
          )}
          {entry.distance_km != null && (
            <span>📍 {entry.distance_km < 1 ? '<1' : entry.distance_km}km</span>
          )}
        </div>
      </div>

      {/* Territoires */}
      <div style={{ textAlign:'center', fontSize:12, fontWeight:700,
        color: isTop3 ? '#00884a' : '#fff' }}>
        {entry.territories}
      </div>

      {/* Revenu */}
      <div style={{ textAlign:'right', fontSize:11, fontFamily:'monospace',
        color:'#F59E0B', fontWeight:600 }}>
        {entry.daily_income > 999
          ? `${(entry.daily_income/1000).toFixed(1)}k`
          : entry.daily_income}
      </div>

      {/* Batailles */}
      <div style={{ textAlign:'center', fontSize:11, color:'rgba(26,42,58,0.45)' }}>
        {entry.battles_won}
      </div>
    </motion.div>
  )
}
