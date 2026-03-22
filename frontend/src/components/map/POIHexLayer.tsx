/**
 * POIHexLayer — Discovery layer for POI territories.
 * KEPT because: helps users FIND POI hexes on the map.
 *
 * NOT a data source — POIs are part of territories.
 * This layer only draws discovery markers and cluster badges.
 *
 * zoom ≥ 13 → individual pins with rarity glow (click = fly to hex)
 * zoom 10-12 → medium pins (top rarity per zone)
 * zoom < 10  → cluster badges showing count
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

const RC: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

interface POIPin {
  h3_index: string; name: string; rarity: string; emoji: string
  lat: number; lon: number; category: string; is_shiny: boolean
}

interface Props {
  map: L.Map | null; zoom: number; lat: number; lon: number
  catFilter?: string[]; rarFilter?: string[]
}

export function POIHexLayer({ map, zoom, lat, lon, catFilter = ['all'], rarFilter = ['all'] }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)

  const radius = zoom <= 7 ? 600 : zoom <= 9 ? 300 : zoom <= 11 ? 120 : zoom <= 13 ? 50 : 20

  const { data } = useQuery<{ pois: POIPin[] }>({
    queryKey: ['poi-discovery', Math.round(lat * 8) / 8, Math.round(lon * 8) / 8, Math.floor(zoom / 2), catFilter.join(','), rarFilter.join(',')],
    queryFn: () => api.get(`/pois/hex-map/?lat=${lat}&lon=${lon}&radius_km=${radius}`).then(r => r.data),
    staleTime: 90000,
    enabled: !!map,
  })

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()
    let pois: POIPin[] = data?.pois ?? []
    if (!pois.length) return

    // Apply filters
    if (!catFilter.includes('all')) {
      pois = pois.filter(p => catFilter.includes(p.category))
    }
    if (!rarFilter.includes('all')) {
      pois = pois.filter(p => rarFilter.includes(p.rarity))
    }
    if (!pois.length) return

    const flyTo = (poi: POIPin) => {
      map.flyTo([poi.lat, poi.lon], Math.max(zoom, 14), { duration: 1.2 })
    }

    if (zoom >= 12) {
      // Hex polygons from HexLayer already show POI at close zoom — nothing to add

    } else if (zoom >= 10) {
      // Medium zoom — one pin per cluster of nearby POIs, showing top rarity
      const grid: Record<string, POIPin[]> = {}
      pois.forEach(p => {
        const key = `${Math.round(p.lat * 4) / 4},${Math.round(p.lon * 4) / 4}`
        grid[key] = [...(grid[key] || []), p]
      })

      Object.values(grid).forEach(group => {
        const RANK: Record<string, number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }
        const top = group.reduce((a, b) => (RANK[b.rarity] || 0) > (RANK[a.rarity] || 0) ? b : a)
        const color = RC[top.rarity] || '#9CA3AF'
        const count = group.length
        const size = Math.min(44, 22 + Math.floor(Math.log2(count + 1)) * 6)

        const icon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
            background:${color}33;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;flex-direction:column;
            box-shadow:0 0 14px ${color}66;font-family:system-ui;cursor:pointer;
          ">
            <div style="font-size:${Math.round(size*0.28)}px;font-weight:900;color:#fff;line-height:1.1">${count}</div>
            <div style="font-size:${Math.round(size*0.16)}px;color:${color};line-height:1">POI</div>
          </div>`,
          className: 'td-poi-cluster-mid',
          iconSize: [size, size], iconAnchor: [size/2, size/2],
        })

        const marker = L.marker([top.lat, top.lon], { icon, zIndexOffset: 600 })
        marker.bindTooltip(
          `${count} POI · meilleur: <span style="color:${color};font-weight:700">${top.rarity}</span>`,
          { className: 'td-tooltip', direction: 'top' }
        )
        marker.on('click', () => flyTo(top))
        layer.addLayer(marker)
      })

    } else {
      // Far zoom — regional cluster badges (counts by ~2° region)
      const grid: Record<string, POIPin[]> = {}
      pois.forEach(p => {
        const key = `${Math.round(p.lat / 2) * 2},${Math.round(p.lon / 2) * 2}`
        grid[key] = [...(grid[key] || []), p]
      })

      Object.entries(grid).forEach(([key, group]) => {
        const [slat, slon] = key.split(',').map(Number)
        const RANK: Record<string, number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }
        const top = group.reduce((a, b) => (RANK[b.rarity]||0) > (RANK[a.rarity]||0) ? b : a)
        const color = RC[top.rarity] || '#9CA3AF'
        const count = group.length
        const size  = Math.min(52, 30 + Math.floor(Math.log2(count + 1)) * 5)

        const icon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${color}22;border:2px solid ${color}88;
            display:flex;align-items:center;justify-content:center;flex-direction:column;
            box-shadow:0 0 12px ${color}44;font-family:system-ui;cursor:pointer;
          ">
            <div style="font-size:${Math.round(size*0.3)}px;font-weight:900;color:#fff;line-height:1">${count}</div>
            <div style="font-size:${Math.round(size*0.17)}px;color:${color};line-height:1">POI</div>
          </div>`,
          className: 'td-poi-cluster-far',
          iconSize: [size, size], iconAnchor: [size/2, size/2],
        })

        const center = group.reduce((acc, p) => ({ lat: acc.lat + p.lat/group.length, lon: acc.lon + p.lon/group.length }), { lat: 0, lon: 0 })
        const marker = L.marker([center.lat, center.lon], { icon, zIndexOffset: 500 })
        marker.bindTooltip(`${count} POI dans cette région`, { className: 'td-tooltip' })
        marker.on('click', () => map.flyTo([center.lat, center.lon], 10, { duration: 1.5 }))
        layer.addLayer(marker)
      })
    }

    return () => { layer.clearLayers() }
  }, [map, data, zoom, catFilter.join(','), rarFilter.join(',')])

  useEffect(() => () => { layerRef.current?.remove() }, [])

  return null
}
