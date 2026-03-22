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
    <motion.div
      initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
      transition={{ type:'spring', stiffness:280, damping:28 }}
      style={{
        position:'fixed', top:0, right:0, bottom:0,
        width: Math.min(420, window.innerWidth - 8),
        background:'linear-gradient(180deg,#08080f,#050510)',
        border:'1px solid rgba(255,255,255,0.08)',
        zIndex:1300, display:'flex', flexDirection:'column',
        boxShadow:'-8px 0 40px rgba(0,0,0,0.8)',
      }}
    >
      {/* Header */}
      <div style={{ padding:'16px 18px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>🏆 Classement</div>
            <div style={{ fontSize:10, color:'#4B5563', marginTop:2 }}>
              {data?.total || 0} joueurs actifs
              {myRank && <span style={{ color:'#F59E0B', marginLeft:8 }}>· Ta position : #{myRank}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'#4B5563',cursor:'pointer',fontSize:20 }}>×</button>
        </div>

        {/* Scope tabs */}
        <div style={{ display:'flex', gap:6 }}>
          {([['global','🌍 Mondial'],['nearby','📍 Proches']] as const).map(([s,label]) => (
            <button key={s} onClick={() => setScope(s)} style={{
              flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight: scope===s ? 700 : 400,
              background: scope===s ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${scope===s ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: scope===s ? '#F59E0B' : '#6B7280',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* En-têtes colonnes */}
      <div style={{
        display:'grid', gridTemplateColumns:'40px 1fr 52px 60px 52px',
        gap:4, padding:'8px 16px', flexShrink:0,
        borderBottom:'1px solid rgba(255,255,255,0.05)',
        fontSize:9, color:'#374151', textTransform:'uppercase', letterSpacing:'0.08em',
      }}>
        <div style={{ textAlign:'center' }}>#</div>
        <div>Joueur</div>
        <div style={{ textAlign:'center' }}>Zones</div>
        <div style={{ textAlign:'right' }}>💎/j</div>
        <div style={{ textAlign:'center' }}>⚔️</div>
      </div>

      {/* Liste */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {isLoading ? (
          <div style={{ padding:'12px' }}><SkeletonList count={8} /></div>
        ) : scope === 'nearby' && !pos ? (
          <div style={{ padding:'32px', textAlign:'center', color:'#4B5563' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>📍</div>
            <div style={{ fontSize:12 }}>Localisation en cours…</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'#4B5563' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🗺️</div>
            <div style={{ fontSize:12 }}>
              {scope === 'nearby' ? 'Aucun joueur dans un rayon de 500km' : 'Aucun joueur classé'}
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

      {/* Ma position si hors top visible */}
      {myRank && myRank > 20 && player && (
        <div style={{
          padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.08)',
          background:'rgba(245,158,11,0.05)', flexShrink:0,
        }}>
          <div style={{ fontSize:10, color:'#4B5563', marginBottom:6 }}>Ta position</div>
          <LadderRow
            entry={{
              rank: myRank,
              username: player.username,
              commander_rank: player.commander_rank || 1,
              territories: 0,
              daily_income: 0,
              battles_won: 0,
              max_rarity: 'Common',
              max_rarity_color: '#9CA3AF',
              is_me: true,
            }}
            index={myRank - 1}
            compact
          />
        </div>
      )}
    </motion.div>
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
        <div style={{ fontSize:9, color:'#4B5563', marginTop:1, display:'flex', gap:6 }}>
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
        color: isTop3 ? '#00FF87' : '#fff' }}>
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
      <div style={{ textAlign:'center', fontSize:11, color:'#6B7280' }}>
        {entry.battles_won}
      </div>
    </motion.div>
  )
}
