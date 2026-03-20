/**
 * UnifiedPOILayer — single layer for all POIs.
 * Mount Everest, Epstein Island, OTAN HQ, nuclear plants, oil fields...
 * All the same concept: Point of Interest with game bonuses.
 * Fog of war: only visible in viewport. Zoom-dependent density.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'

type POI = {
  id: string; name: string; category: string; category_label: string
  lat: number; lon: number; emoji: string; color: string
  rarity: string; rarity_color: string; size: string
  game_resource: string; bonus_pct: number; tdc_per_24h: number
  description: string; fun_fact: string; country_code: string
  is_featured: boolean; threat_level: string; wiki_url?: string
}

const RARITY_GLOW: Record<string, string> = {
  legendary: '0 0 20px currentColor, 0 0 40px currentColor',
  rare:      '0 0 12px currentColor',
  uncommon:  '0 0 6px currentColor',
  common:    'none',
}
const RARITY_COLOR: Record<string, string> = {
  legendary: '#FFB800', rare: '#3B82F6', uncommon: '#10B981', common: '#9CA3AF',
}
const SIZE_PX: Record<string, number> = { xs: 20, sm: 24, md: 30, lg: 36, xl: 44 }

function makePOIIcon(p: POI): L.DivIcon {
  const px = SIZE_PX[p.size] ?? 30
  const glow = RARITY_GLOW[p.rarity]?.replace(/currentColor/g, p.color) ?? 'none'
  const pulse = p.rarity === 'legendary' || p.is_featured
    ? 'animation:tdPulse 2s ease-in-out infinite;' : ''
  return L.divIcon({
    html: `<div style="
      width:${px}px;height:${px}px;border-radius:50%;
      background:${p.color}22;border:2px solid ${p.color};
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(px*0.45)}px;
      box-shadow:${glow};cursor:pointer;
      ${pulse}
    ">${p.emoji}</div>`,
    className: 'td-poi-icon',
    iconSize: [px, px],
    iconAnchor: [px/2, px/2],
  })
}

// Filter categories for the UI
const FILTER_GROUPS = [
  { id: 'all',         label: '🌍 All',         cats: [] },
  { id: 'resources',   label: '⛏️ Resources',   cats: ['oil_field','gas_reserve','gold_mine','diamond_mine','rare_earth','lithium_deposit','uranium_mine','coal_mine','iron_ore','copper_mine'] },
  { id: 'military',    label: '🪖 Military',    cats: ['military_base','naval_base','missile_site','intelligence_hq','alliance_hq'] },
  { id: 'strategic',   label: '⚓ Strategic',   cats: ['chokepoint','mega_port','nuclear_plant','space_center','capital_city','financial_hub','stock_exchange'] },
  { id: 'nature',      label: '🌿 Nature',      cats: ['mountain_peak','volcano','waterfall','ancient_forest','nature_sanctuary','freshwater','coral_reef','island'] },
  { id: 'secrets',     label: '👁️ Secrets',    cats: ['conspiracy','secret_facility','oligarch_asset','offshore_haven','anomaly'] },
  { id: 'culture',     label: '🏛️ Culture',    cats: ['ancient_wonder','ancient_ruins','world_heritage','religious_site','royal_palace','control_tower'] },
  { id: 'tech',        label: '💻 Tech',        cats: ['tech_giant','data_center','media_hq','international_org'] },
]

// POI detail panel
function POIDetail({ poi, onClose }: { poi: POI; onClose: () => void }) {
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, zIndex: 1200,
        background: '#08080F', borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Hero */}
      <div style={{ padding: '20px 18px 16px', background: `linear-gradient(135deg, ${poi.color}18 0%, transparent 60%)`, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>{poi.emoji}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{poi.name}</div>
          <div style={{ fontSize: 12, color: poi.color, marginTop: 4, fontWeight: 600 }}>{poi.category_label}</div>
          {poi.country_code && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>📍 {poi.country_code}</div>}
        </div>
        {/* Rarity */}
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: RARITY_COLOR[poi.rarity], background: `${RARITY_COLOR[poi.rarity]}18`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${RARITY_COLOR[poi.rarity]}40`, textTransform: 'capitalize' }}>
            {poi.rarity === 'legendary' ? '⭐ Legendary' : poi.rarity === 'rare' ? '🔷 Rare' : poi.rarity === 'uncommon' ? '🔹 Uncommon' : '⬜ Common'}
          </span>
          {poi.threat_level !== 'none' && (
            <span style={{ fontSize: 10, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: 20 }}>
              ⚠️ {poi.threat_level}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 18px', flex: 1 }}>
        {/* Image */}
        {(poi as any).wiki_url && (
          <div style={{ margin: '0 0 14px', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            <img src={(poi as any).wiki_url} alt={poi.name}
              style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}
        {/* Description */}
        {poi.description && (
          <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.7, margin: '0 0 14px' }}>{poi.description}</p>
        )}

        {/* Fun fact */}
        {poi.fun_fact && (
          <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#FFB800', fontWeight: 700, marginBottom: 4 }}>💡 Did you know?</div>
            <div style={{ fontSize: 12, color: '#D97706', lineHeight: 1.6 }}>{poi.fun_fact}</div>
          </div>
        )}

        {/* Game bonuses */}
        <div style={{ background: `${poi.color}0A`, border: `1px solid ${poi.color}25`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 }}>🎮 Own this zone to earn:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{poi.game_resource} bonus</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: RARITY_COLOR[poi.rarity], fontFamily: 'monospace' }}>+{poi.bonus_pct}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TDC / day</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#FFB800', fontFamily: 'monospace' }}>{poi.tdc_per_24h}</div>
            </div>
          </div>
        </div>

        {/* How to capture */}
        <div style={{ padding: '10px 14px', background: 'rgba(0,255,135,0.04)', border: '1px solid rgba(0,255,135,0.1)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#00FF87', marginBottom: 6 }}>How to capture</div>
          <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.7 }}>
            1. Zoom to this location on the map<br />
            2. Claim or attack the H3 hex covering it<br />
            3. Bonus activates immediately on ownership
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface Props {
  map: L.Map | null
  viewportLat: number
  viewportLon: number
  zoom: number
  visible: boolean
}

export function UnifiedPOILayer({ map, viewportLat, viewportLon, zoom, visible }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [selected, setSelected] = useState<POI | null>(null)
  const [filterGroup, setFilterGroup] = useState('all')
  const [showPanel, setShowPanel] = useState(false)

  const radiusKm = zoom < 4 ? 2000 : zoom < 6 ? 800 : zoom < 8 ? 300 : zoom < 11 ? 100 : 50
  const maxPOIs  = zoom < 4 ? 30 : zoom < 6 ? 60 : zoom < 8 ? 80 : 120

  const { data } = useQuery({
    queryKey: ['unified-pois', Math.round(viewportLat * 5)/5, Math.round(viewportLon * 5)/5, filterGroup, zoom],
    queryFn: async () => {
      const params: Record<string, string> = {
        lat: String(viewportLat), lon: String(viewportLon),
        radius_km: String(radiusKm), limit: String(maxPOIs),
      }
      const grp = FILTER_GROUPS.find(g => g.id === filterGroup)
      if (grp && grp.cats.length > 0) params.categories = grp.cats.join(',')
      const res = await api.get('/pois/?' + new URLSearchParams(params))
      return res.data?.pois ?? res.data?.results ?? []
    },
    enabled: visible && viewportLat !== 0,
    refetchInterval: 120000,
    staleTime: 60000,
  })

  const pois: POI[] = Array.isArray(data) ? data : []

  // Init layer
  useEffect(() => {
    if (!map) return
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove(); layerRef.current = null }
  }, [map])

  // Render markers
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!visible) return

    // Add pulse CSS once
    if (!document.getElementById('td-poi-css')) {
      const style = document.createElement('style')
      style.id = 'td-poi-css'
      style.textContent = `
        @keyframes tdPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:0.85} }
        .td-poi-icon { background: transparent !important; border: none !important; }
        .td-resource-tooltip .leaflet-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
      `
      document.head.appendChild(style)
    }

    pois.forEach(p => {
      const marker = L.marker([p.lat, p.lon], { icon: makePOIIcon(p) })
      marker.bindTooltip(`
        <div style="font-family:system-ui;font-size:11px;background:#08080F;color:#fff;padding:8px 12px;border-radius:10px;border:1px solid ${p.color}40;min-width:160px;pointer-events:none">
          <div style="font-weight:800;font-size:13px;margin-bottom:2px">${p.emoji} ${p.name}</div>
          <div style="color:${p.color};font-size:10px">${p.category_label}</div>
          <div style="color:${RARITY_COLOR[p.rarity]};font-size:10px;margin-top:3px;text-transform:capitalize">${p.rarity}</div>
          <div style="color:#FFB800;font-size:11px;margin-top:4px;font-family:monospace">+${p.bonus_pct}% ${p.game_resource} · ${p.tdc_per_24h} TDC/day</div>
        </div>
      `, { className: 'td-resource-tooltip', direction: 'top', sticky: true, offset: [0, -10] })
      marker.on('click', () => setSelected(p))
      layer.addLayer(marker)
    })
  }, [pois, visible])

  return (
    <>
      {/* Filter panel toggle */}
      {visible && (
        <div style={{ position: 'fixed', bottom: 90, left: 12, zIndex: 800 }}>
          <button onClick={() => setShowPanel(v => !v)}
            style={{ background: 'rgba(5,5,15,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            {FILTER_GROUPS.find(g => g.id === filterGroup)?.label ?? '🌍 All'}
            {pois.length > 0 && <span style={{ background: 'rgba(0,255,135,0.15)', color: '#00FF87', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{pois.length}</span>}
          </button>

          <AnimatePresence>
            {showPanel && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{ position: 'absolute', bottom: '100%', marginBottom: 8, background: 'rgba(5,5,15,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 8, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 170, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                {FILTER_GROUPS.map(g => (
                  <button key={g.id} onClick={() => { setFilterGroup(g.id); setShowPanel(false) }}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${filterGroup === g.id ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.06)'}`, background: filterGroup === g.id ? 'rgba(0,255,135,0.08)' : 'transparent', color: filterGroup === g.id ? '#00FF87' : '#9CA3AF', cursor: 'pointer', fontSize: 12, textAlign: 'left', fontWeight: filterGroup === g.id ? 700 : 400 }}>
                    {g.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* POI Detail */}
      <AnimatePresence>
        {selected && <POIDetail poi={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  )
}
