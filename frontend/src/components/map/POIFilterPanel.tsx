/**
 * POIFilterPanel — left sidebar
 * Filters POI (rare) hexes by category on the map.
 * Also shows POI pin layer toggle.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

const RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

const CATEGORIES = [
  { id:'all',           label:'Tous',             icon:'🌍' },
  { id:'capital_city',  label:'Capitales',         icon:'🏛️' },
  { id:'world_heritage',label:'Patrimoine',        icon:'🏰' },
  { id:'mountain_peak', label:'Sommets',           icon:'⛰️' },
  { id:'nature_sanctuary',label:'Nature',          icon:'🌿' },
  { id:'oil_field',     label:'Ressources',        icon:'🛢️' },
  { id:'military_base', label:'Militaire',         icon:'⚔️' },
  { id:'ancient_ruins', label:'Ruines',            icon:'🗿' },
  { id:'coastal',       label:'Côtier',            icon:'🌊' },
  { id:'nuclear_plant', label:'Nucléaire',         icon:'☢️' },
  { id:'financial_hub', label:'Finance',           icon:'💰' },
  { id:'space_center',  label:'Espace',            icon:'🚀' },
]

const RARITIES = ['all','uncommon','rare','epic','legendary','mythic'] as const

interface Props {
  onFilterChange: (categories: string[], rarities: string[]) => void
  onClose: () => void
  visible: boolean
}

export function POIFilterPanel({ onFilterChange, onClose, visible }: Props) {
  const [cats, setCats]     = useState<string[]>(['all'])
  const [rars, setRars]     = useState<string[]>(['all'])

  const { data: stats } = useQuery({
    queryKey: ['poi-stats'],
    queryFn: () => api.get('/pois/hex-map/?lat=0&lon=0&radius_km=20000').then(r => {
      const pois = r.data.pois || []
      const byRarity: Record<string, number> = {}
      const byCat: Record<string, number>    = {}
      pois.forEach((p: any) => {
        byRarity[p.rarity] = (byRarity[p.rarity] || 0) + 1
        byCat[p.category]  = (byCat[p.category]  || 0) + 1
      })
      return { byRarity, byCat, total: pois.length }
    }),
    staleTime: 300000,
  })

  const toggleCat = (id: string) => {
    let next: string[]
    if (id === 'all') { next = ['all'] }
    else {
      const cur = cats.filter(c => c !== 'all')
      next = cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]
      if (!next.length) next = ['all']
    }
    setCats(next)
    onFilterChange(next, rars)
  }

  const toggleRar = (id: string) => {
    let next: string[]
    if (id === 'all') { next = ['all'] }
    else {
      const cur = rars.filter(r => r !== 'all')
      next = cur.includes(id) ? cur.filter(r => r !== id) : [...cur, id]
      if (!next.length) next = ['all']
    }
    setRars(next)
    onFilterChange(cats, next)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{
            position: 'fixed', left: 8, top: 56, bottom: 80,
            width: 220, zIndex: 900,
            background: 'rgba(4,4,12,0.97)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            background: 'linear-gradient(90deg, rgba(139,92,246,0.15), transparent)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>📍 Zones POI</div>
              <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>
                {stats?.total || '…'} zones spéciales
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none',
              color: '#6B7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {/* Rarity filters */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
                Rareté
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {RARITIES.map(r => {
                  const color = r === 'all' ? '#6B7280' : RARITY_COLOR[r]
                  const active = rars.includes(r)
                  const count  = r === 'all' ? stats?.total : (stats?.byRarity[r] || 0)
                  return (
                    <button key={r} onClick={() => toggleRar(r)} style={{
                      padding: '4px 9px', borderRadius: 20, fontSize: 10, cursor: 'pointer',
                      background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.07)'}`,
                      color: active ? color : '#6B7280', fontWeight: active ? 700 : 400,
                      transition: 'all 0.15s',
                    }}>
                      {r === 'all' ? 'Tous' : r}
                      {count !== undefined && <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category filters */}
            <div>
              <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
                Catégorie
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {CATEGORIES.map(c => {
                  const active = cats.includes(c.id)
                  const count  = c.id === 'all' ? stats?.total : (stats?.byCat[c.id] || 0)
                  return (
                    <button key={c.id} onClick={() => toggleCat(c.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: active ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
                      <span style={{ fontSize: 11, color: active ? '#C4B5FD' : '#9CA3AF',
                        fontWeight: active ? 700 : 400, flex: 1 }}>{c.label}</span>
                      {count !== undefined && count > 0 && (
                        <span style={{ fontSize: 9, color: '#4B5563', fontFamily: 'monospace' }}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
