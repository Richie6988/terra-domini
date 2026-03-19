/**
 * ResourceLayer — Leaflet overlay for world resource POIs.
 * Fog of war: only shows resources near the current viewport.
 * Rarity-coded icons with pulsing glow for legendary/rare.
 * Click → resource detail panel.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'

type Resource = {
  id: string; name: string; category: string; category_label: string
  lat: number; lon: number; emoji: string; color: string
  rarity: string; rarity_color: string; game_resource: string
  bonus_pct: number; tdc_per_24h: number; description: string
  real_output: string; distance_km: number | null
}

const RARITY_PULSE: Record<string, string> = {
  legendary: '0 0 20px currentColor, 0 0 40px currentColor',
  rare:      '0 0 12px currentColor',
  uncommon:  '0 0 6px currentColor',
  common:    'none',
}

function makeResourceIcon(r: Resource): L.DivIcon {
  const pulse = RARITY_PULSE[r.rarity] ?? 'none'
  const size = r.rarity === 'legendary' ? 36 : r.rarity === 'rare' ? 30 : 26
  const anim = r.rarity === 'legendary'
    ? `@keyframes rp{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}animation:rp 2s infinite;`
    : ''
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${r.color}33;border:2px solid ${r.color};
      display:flex;align-items:center;justify-content:center;
      font-size:${size*0.5}px;color:${r.color};
      box-shadow:${pulse.replace('currentColor', r.color)};
      ${anim}
    ">${r.emoji}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  })
}

// Resource detail panel
function ResourceDetail({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const RARITY_BG: Record<string, string> = {
    legendary: 'rgba(255,184,0,0.08)',
    rare:      'rgba(59,130,246,0.08)',
    uncommon:  'rgba(16,185,129,0.08)',
    common:    'rgba(255,255,255,0.03)',
  }
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, zIndex: 1200,
        background: '#0A0A14', borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 18px', background: `${resource.color}10`, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 4 }}>{resource.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{resource.name}</div>
            <div style={{ fontSize: 11, color: resource.color, marginTop: 3 }}>{resource.category_label}</div>
            {resource.real_output && (
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>📊 {resource.real_output}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {/* Rarity badge */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: resource.rarity_color, background: `${resource.rarity_color}15`, padding: '4px 10px', borderRadius: 20, border: `1px solid ${resource.rarity_color}40`, textTransform: 'capitalize' }}>
            {resource.rarity === 'legendary' ? '⭐ Legendary' : resource.rarity === 'rare' ? '🔷 Rare' : resource.rarity === 'uncommon' ? '🔹 Uncommon' : '⬜ Common'}
          </span>
          {resource.distance_km !== null && (
            <span style={{ fontSize: 11, color: '#6B7280', padding: '4px 10px' }}>📍 {resource.distance_km}km away</span>
          )}
        </div>

        {/* Game bonuses */}
        <div style={{ background: RARITY_BG[resource.rarity], border: `1px solid ${resource.rarity_color}20`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>💰 If you own this zone</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resource bonus</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: resource.rarity_color, fontFamily: 'monospace' }}>+{resource.bonus_pct}%</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{resource.game_resource}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TDC Income</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFB800', fontFamily: 'monospace' }}>{resource.tdc_per_24h}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>per 24h</div>
            </div>
          </div>
        </div>

        {/* Description */}
        {resource.description && (
          <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 14 }}>{resource.description}</div>
        )}

        {/* How to get */}
        <div style={{ padding: '10px 14px', background: 'rgba(0,255,135,0.05)', border: '1px solid rgba(0,255,135,0.1)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#00FF87', marginBottom: 6 }}>How to capture</div>
          <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
            1. Zoom in on the map near this location<br />
            2. Claim or attack the H3 zone covering it<br />
            3. The bonus activates immediately on ownership
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Category filter bar
const CATEGORY_ICONS: Record<string, string> = {
  oil_field:'🛢️', gas_reserve:'🔥', coal_mine:'⚫', gold_mine:'🥇',
  diamond_mine:'💎', rare_earth:'🔮', iron_ore:'⚙️', copper_mine:'🟠',
  lithium_deposit:'⚡', uranium_mine:'☢️', military_base:'🏛️', nuclear_plant:'⚛️',
  space_center:'🚀', chokepoint:'⚓', port_megacity:'🚢', nature_sanctuary:'🌿',
  ancient_forest:'🌲', freshwater:'💧', fertile_land:'🌾', deep_sea_fish:'🐟',
}

interface Props {
  map: L.Map | null
  viewportLat: number
  viewportLon: number
  viewportRadius: number
  visible: boolean
}

export function ResourceLayer({ map, viewportLat, viewportLon, viewportRadius, visible }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [selected, setSelected] = useState<Resource | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const { data } = useQuery({
    queryKey: ['resources', Math.round(viewportLat * 10), Math.round(viewportLon * 10), filter],
    queryFn: () => {
      const params = new URLSearchParams({
        lat: String(viewportLat),
        lon: String(viewportLon),
        radius_km: String(Math.max(viewportRadius * 2, 50)),
      })
      if (filter) params.set('category', filter)
      return api.get(`/resources/?${params}`).then(r => r.data?.resources ?? [])
    },
    enabled: visible && viewportLat !== 0,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const resources: Resource[] = Array.isArray(data) ? data : []

  useEffect(() => {
    const m = map
    if (!m) return
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(m)
    }
    return () => { layerRef.current?.remove(); layerRef.current = null }
  }, [map])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!visible) return

    resources.forEach(r => {
      const marker = L.marker([r.lat, r.lon], { icon: makeResourceIcon(r) })
      marker.bindTooltip(`
        <div style="font-family:monospace;font-size:11px;background:#050510;color:#fff;padding:8px 12px;border-radius:8px;border:1px solid ${r.color}40;min-width:160px">
          <div style="font-weight:700;font-size:13px">${r.emoji} ${r.name}</div>
          <div style="color:${r.color};font-size:10px;margin-top:2px">${r.category_label}</div>
          <div style="color:${r.rarity_color};font-size:10px;margin-top:4px;text-transform:capitalize">${r.rarity}</div>
          <div style="color:#FFB800;font-size:11px;margin-top:4px">+${r.bonus_pct}% ${r.game_resource} · ${r.tdc_per_24h} TDC/day</div>
        </div>
      `, { className: 'td-resource-tooltip', direction: 'top', sticky: true })
      marker.on('click', () => setSelected(r))
      layer.addLayer(marker)
    })
  }, [resources, visible])

  const activeCategories = [...new Set(resources.map(r => r.category))].slice(0, 10)

  return (
    <>
      {/* Category filter — bottom-left floating */}
      {visible && (
        <div style={{ position: 'fixed', bottom: 90, left: 12, zIndex: 800 }}>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 12px', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            🗺️ Resources {resources.length > 0 && <span style={{ color: '#00FF87', fontSize: 10 }}>{resources.length}</span>}
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{ position: 'absolute', bottom: '100%', marginBottom: 8, background: 'rgba(5,5,15,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto', minWidth: 180 }}>
                <button onClick={() => setFilter('')}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${!filter ? '#00FF87' : 'rgba(255,255,255,0.08)'}`, background: !filter ? 'rgba(0,255,135,0.1)' : 'transparent', color: !filter ? '#00FF87' : '#9CA3AF', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
                  🌍 All types
                </button>
                {activeCategories.map(cat => (
                  <button key={cat} onClick={() => setFilter(cat === filter ? '' : cat)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${filter === cat ? '#FFB800' : 'rgba(255,255,255,0.08)'}`, background: filter === cat ? 'rgba(255,184,0,0.1)' : 'transparent', color: filter === cat ? '#FFB800' : '#9CA3AF', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
                    {CATEGORY_ICONS[cat] ?? '📍'} {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Resource detail panel */}
      <AnimatePresence>
        {selected && <ResourceDetail resource={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  )
}
