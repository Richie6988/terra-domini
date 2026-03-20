/**
 * POIHexLayer — shows POI hexes glowing on map at all zoom levels.
 * Zoom ≥ 12: individual glowing hex outlines with emoji marker.
 * Zoom < 12: cluster badges (grouped by H3 res4 region) showing count.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

const RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}
const RARITY_PULSE: Record<string, boolean> = {
  legendary: true, mythic: true, epic: false, rare: false, uncommon: false, common: false,
}

interface POIHex {
  h3_index: string; name: string; rarity: string; emoji: string
  lat: number; lon: number; category: string; is_shiny: boolean
}

interface Props {
  map: L.Map | null
  zoom: number
  lat: number
  lon: number
}

export function POIHexLayer({ map, zoom, lat, lon }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Fetch nearby POI hexes
  const radius = zoom <= 8 ? 500 : zoom <= 10 ? 200 : zoom <= 12 ? 80 : 30
  const { data } = useQuery<{ pois: POIHex[] }>({
    queryKey: ['poi-hexes', Math.round(lat*10)/10, Math.round(lon*10)/10, zoom > 11 ? zoom : 'cluster'],
    queryFn: () => api.get(`/pois/hex-map/?lat=${lat}&lon=${lon}&radius_km=${radius}`).then(r => r.data),
    staleTime: 60000,
    enabled: !!map,
  })

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    const layer = layerRef.current
    layer.clearLayers()
    const pois = data?.pois ?? []
    if (!pois.length) return

    if (zoom >= 12) {
      // Individual glowing hex markers
      pois.forEach(poi => {
        const color = RARITY_COLOR[poi.rarity] || '#9CA3AF'
        const pulse = RARITY_PULSE[poi.rarity] || poi.is_shiny
        const size = poi.rarity === 'mythic' ? 38 : poi.rarity === 'legendary' ? 34 : poi.is_shiny ? 30 : 24

        const marker = L.marker([poi.lat, poi.lon], {
          icon: L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;
              clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
              background:${color}22;
              border:2px solid ${color};
              display:flex;align-items:center;justify-content:center;
              font-size:${Math.round(size*0.45)}px;
              box-shadow:0 0 ${size/2}px ${color}88;
              ${pulse ? `animation:tdHexPulse 2s ease-in-out infinite;` : ''}
              ${poi.is_shiny ? `background:linear-gradient(135deg,${color}33,#FFD70033,${color}33);` : ''}
            ">${poi.emoji || '📍'}</div>
            <style>
              @keyframes tdHexPulse {
                0%,100%{box-shadow:0 0 ${size/2}px ${color}88}
                50%{box-shadow:0 0 ${size}px ${color}cc,0 0 ${size*2}px ${color}44}
              }
            </style>`,
            className: 'td-poi-hex',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
          }),
          zIndexOffset: poi.rarity === 'mythic' ? 900 : poi.rarity === 'legendary' ? 800 : 700,
        })

        marker.bindTooltip(`<div style="font-size:11px;font-weight:700;color:#fff">${poi.emoji} ${poi.name}</div>
          <div style="font-size:9px;color:${color};font-weight:600;text-transform:uppercase">${poi.rarity}${poi.is_shiny?' ✨':''}</div>`,
          { className:'td-tooltip', direction:'top', offset:[0,-size/2] })

        layer.addLayer(marker)
      })
    } else {
      // Cluster badges by region
      const clusters: Record<string, { pois: POIHex[]; lat: number; lon: number }> = {}
      pois.forEach(poi => {
        // Group by rounded coords
        const key = `${Math.round(poi.lat*2)/2},${Math.round(poi.lon*2)/2}`
        if (!clusters[key]) clusters[key] = { pois: [], lat: poi.lat, lon: poi.lon }
        clusters[key].pois.push(poi)
      })

      Object.values(clusters).forEach(c => {
        const count = c.pois.length
        const topRarity = c.pois.reduce((best, p) => {
          const rank = {common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5}
          return (rank[p.rarity]||0) > (rank[best.rarity]||0) ? p : best
        }, c.pois[0])
        const color = RARITY_COLOR[topRarity.rarity] || '#9CA3AF'
        const size = Math.min(48, 24 + Math.log2(count) * 6)

        const marker = L.marker([c.lat, c.lon], {
          icon: L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;
              clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
              background:${color}33;border:2px solid ${color};
              display:flex;align-items:center;justify-content:center;flex-direction:column;
              box-shadow:0 0 16px ${color}66;
              font-family:system-ui;
            ">
              <div style="font-size:${Math.round(size*0.3)}px;font-weight:900;color:#fff;line-height:1">${count}</div>
              <div style="font-size:${Math.round(size*0.18)}px;color:${color};line-height:1">POI</div>
            </div>`,
            className: 'td-poi-cluster',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
          }),
          zIndexOffset: 600,
        })

        marker.bindTooltip(`${count} POI zone${count>1?'s':''} · top: ${topRarity.rarity}`,
          { className:'td-tooltip', direction:'top' })

        layer.addLayer(marker)
      })
    }

    return () => { layer.clearLayers() }
  }, [map, data, zoom])

  useEffect(() => {
    return () => { layerRef.current?.remove() }
  }, [])

  return null
}
