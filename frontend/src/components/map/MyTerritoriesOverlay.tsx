/**
 * MyTerritoriesOverlay — accès rapide à tous mes territoires depuis la carte.
 *
 * Bouton fixe haut-gauche (sous le bouton POI filter).
 * Popup compact : liste de tous mes territoires par rareté décroissante.
 * Clic → flyTo immédiat + fermeture.
 * Tri : mythic → common, puis shiny first.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'

const RC: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
}
const RANK: Record<string, number> = {
  mythic: 5, legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0,
}

// Icône biome
const BIOME_ICON: Record<string, string> = {
  urban: 'city', rural: 'wheat', forest: 'forest', mountain: 'mountain',
  coastal: 'ocean', desert: 'desert', tundra: 'snowflake', industrial: 'gear',
  landmark: 'museum', grassland: 'leaf',
}

interface Props {
  onFlyTo: (lat: number, lon: number, zoom?: number) => void
}

export function MyTerritoriesOverlay({ onFlyTo }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'rarity' | 'income' | 'biome'>('rarity')
  const player = usePlayer()

  const { data, isLoading } = useQuery({
    queryKey: ['my-territories-overlay'],
    queryFn: () => api.get('/territories-geo/mine/').then(r => r.data),
    staleTime: 30000,
    enabled: open,
  })

  const territories: any[] = (data?.territories || [])
    .filter((t: any) => {
      if (!search) return true
      const n = (t.custom_name || t.poi_name || t.place_name || t.h3_index || '').toLowerCase()
      return n.includes(search.toLowerCase())
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'rarity') {
        const dr = (RANK[b.rarity || 'common'] - RANK[a.rarity || 'common'])
        if (dr !== 0) return dr
        return (b.is_shiny ? 1 : 0) - (a.is_shiny ? 1 : 0)
      }
      if (sortBy === 'income') return (b.resource_credits || 10) - (a.resource_credits || 10)
      if (sortBy === 'biome') return (a.territory_type || '').localeCompare(b.territory_type || '')
      return 0
    })

  const totalIncome = (data?.territories || []).reduce(
    (s: number, t: any) => s + (parseFloat(t.resource_credits) || 10), 0
  )
  const totalCount = data?.count || 0

  const flyTo = (t: any) => {
    if (t.center_lat && t.center_lon) {
      onFlyTo(t.center_lat, t.center_lon, 15)
      setOpen(false)
    }
  }

  return (
    <>
      {/* Bouton fixe gauche */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Mes territoires"
        style={{
          position: 'fixed', left: 8, top: 110, zIndex: 920,
          background: open ? 'rgba(0,255,135,0.25)' : 'rgba(13,27,42,0.92)',
          border: `1px solid ${open ? 'rgba(0,255,135,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          backdropFilter: 'blur(8px)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
          stroke={open ? '#00FF87' : '#6B7280'} strokeWidth="1.5" strokeLinecap="round">
          <polygon points="10,2 17.3,6 17.3,14 10,18 2.7,14 2.7,6" />
          <polygon points="10,6 13.5,8 13.5,12 10,14 6.5,12 6.5,8" opacity="0.5" />
        </svg>
        <span style={{ fontSize: 8, color: open ? '#00FF87' : '#6B7280', fontWeight: 700 }}>
          {totalCount > 0 ? totalCount : 'Zones'}
        </span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            style={{
              position: 'fixed', left: 68, top: 60, zIndex: 910,
              width: 310, maxHeight: 'calc(100vh - 120px)',
              background: 'linear-gradient(180deg, rgba(13,27,42,0.95) 0%, rgba(10,22,40,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 14px 8px', flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,255,135,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
                  Mes territoires
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                    {totalCount} zones · +{Math.round(totalIncome)}/j
                  </span>
                </div>
                <button onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 16,
                }}>×</button>
              </div>

              {/* Search */}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                autoFocus
                style={{
                  width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box', marginBottom: 8,
                }}
              />

              {/* Sort pills */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[
                  { id: 'rarity', label: 'Rareté' },
                  { id: 'income', label: 'Revenus' },
                  { id: 'biome',  label: 'Biome' },
                ].map(s => (
                  <button key={s.id} onClick={() => setSortBy(s.id as any)} style={{
                    padding: '3px 9px', borderRadius: 12, fontSize: 9, cursor: 'pointer',
                    background: sortBy === s.id ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${sortBy === s.id ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: sortBy === s.id ? '#00FF87' : '#6B7280', fontWeight: sortBy === s.id ? 700 : 400,
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {isLoading && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#374151', fontSize: 12 }}>
                  Chargement…
                </div>
              )}
              {!isLoading && territories.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#374151' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}></div>
                  <div style={{ fontSize: 12 }}>No territories</div>
                  <div style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>
                    Cliquez sur un hex pour revendiquer
                  </div>
                </div>
              )}
              {territories.map((t: any) => {
                const rarity  = t.rarity || 'common'
                const rc      = RC[rarity] || '#9CA3AF'
                const name    = t.custom_name || t.poi_name || t.place_name || (t.h3_index?.slice(0,10) + '…')
                const biome   = t.territory_type || 'rural'
                const income  = parseFloat(t.resource_credits) || 10
                const biomeIcon = BIOME_ICON[biome] || ''
                const hasPOI  = !!(t.poi_name || t.is_landmark)

                return (
                  <motion.button
                    key={t.h3_index}
                    onClick={() => flyTo(t)}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 14px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    {/* Rarity indicator */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${rc}18`, border: `1.5px solid ${rc}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15,
                    }}>
                      {biomeIcon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: '#e2e8f0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.is_shiny && <span style={{ color: '#FCD34D', marginRight: 4 }}></span>}
                        {name}
                        {hasPOI && <span style={{ color: rc, fontSize: 9, marginLeft: 5 }}>POI</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: rc, fontWeight: 700 }}>{rarity}</span>
                        <span style={{ fontSize: 9, color: '#374151' }}>{biome}</span>
                      </div>
                    </div>

                    {/* Income + flyto */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, fontFamily: 'monospace' }}>
                        +{Math.round(income)}
                      </div>
                      <div style={{ fontSize: 8, color: '#374151' }}>/j</div>
                    </div>

                    {/* Arrow */}
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                      stroke="#374151" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M7 4 L13 10 L7 16" />
                    </svg>
                  </motion.button>
                )
              })}
            </div>

            {/* Footer stats */}
            {totalCount > 0 && (
              <div style={{
                padding: '8px 14px', flexShrink: 0,
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', gap: 12, fontSize: 10, color: '#4B5563',
              }}>
                {Object.entries(
                  (data?.territories || []).reduce((acc: any, t: any) => {
                    const r = t.rarity || 'common'
                    acc[r] = (acc[r] || 0) + 1
                    return acc
                  }, {})
                )
                  .sort(([a], [b]) => (RANK[b] || 0) - (RANK[a] || 0))
                  .map(([r, cnt]) => (
                    <span key={r}>
                      <span style={{ color: RC[r] || '#9CA3AF', fontWeight: 700 }}>{cnt as number}</span>
                      <span style={{ marginLeft: 2 }}>{r.slice(0, 3)}</span>
                    </span>
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
