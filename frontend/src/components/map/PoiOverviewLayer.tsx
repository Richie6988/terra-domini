/**
 * PoiOverviewLayer — points of interest readable from far away (owner 2026-10-18: "voir les zones
 * d'intérêt d'un zoom plus élevé"). Below zoom 13 the hex layer is too dense to read, so the map shows
 * one marker per POI, rarest first: legendary from the continent view, epic from the country view,
 * rare from the region view, everything from the city view (GET /api/map/pois/).
 * Tap a marker → fly to the hex.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useLeafletLayer } from '../ui/Utils'
import { api } from '../../services/api'
import { iconFor } from '../shared/poiIcons'
import { latLngToCell, cellToLatLng } from 'h3-js'
import { useStore } from '../../store'

const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6', epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
}
const SIZE: Record<string, number> = { mythic: 40, legendary: 36, epic: 30, rare: 26, uncommon: 22, common: 20 }
export const POI_OVERVIEW_MAX_ZOOM = 13

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function PoiOverviewLayer({ map, zoom, center }: { map: L.Map | null; zoom: number; center: [number, number] }) {
  const layer = useLeafletLayer(map)
  const reqId = useRef(0)
  const hexCount = useStore(s => Object.keys(s.territories).length)   // re-run when hexes (and their icons) arrive

  useEffect(() => {
    if (!map || !layer) return
    if (zoom >= POI_OVERVIEW_MAX_ZOOM) { layer.clearLayers(); return }
    const b = map.getBounds().pad(0.15)
    const id = ++reqId.current
    api.get('/map/pois/', { params: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom } })
      .then(({ data }) => {
        if (id !== reqId.current) return
        layer.clearLayers()
        const showNames = zoom >= 6
        const placed: { x: number; y: number; r: number }[] = []   // rarest first: later ones yield
        // Area counters: total POIs per zone; the zone's first (rarest) marker carries the "+N" badge
        const clusters = new Map<string, any>((data.clusters || []).map((c: any) => [c.cell, c]))
        const badged = new Set<string>()
        // One marker per POI (owner 2026-10-19 "POIs are doubled, the hexagon is enough"): a POI whose hex is
        // already drawn with its icon is skipped; the others sit on their hex centre, not the raw coordinates
        const drawn = useStore.getState().territories as Record<string, any>
        for (const p0 of data.pois || []) {
          if (p0.h3_index && (drawn[p0.h3_index]?.poi_name || drawn[p0.h3_index]?.is_landmark)) continue
          let p = p0
          if (p0.h3_index) { try { const [la, lo] = cellToLatLng(p0.h3_index); p = { ...p0, lat: la, lon: lo } } catch { /* keep */ } }
          const pt = map.latLngToContainerPoint([p.lat, p.lon])
          const r0 = (SIZE[p.rarity] || 22) / 2 + 6
          const near = placed.find(q => Math.hypot(q.x - pt.x, q.y - pt.y) < q.r + r0)
          if (near && Math.hypot(near.x - pt.x, near.y - pt.y) < (near.r + r0) * 0.6) continue   // hidden: zoom in to see it
          const keepLabel = !near
          placed.push({ x: pt.x, y: pt.y, r: r0 + (keepLabel ? 14 : 0) })
          const col = RARITY_COLOR[p.rarity] || '#6366f1'
          const sz = SIZE[p.rarity] || 22
          const svg = iconFor(p.category).replace('<svg ', '<svg width="100%" height="100%" ')
          const owned = p.owner ? `<span class="hx-poi__owner">${esc(p.owner)}</span>` : ''
          const label = keepLabel && (showNames || p.rarity === 'legendary' || p.rarity === 'mythic')
            ? `<span class="hx-poi__name">${esc(p.name)}</span>${owned}` : ''
          let badge = ''
          try {
            const cell = latLngToCell(p.lat, p.lon, data.cluster_res)
            const cl = clusters.get(cell)
            if (cl && !badged.has(cell) && cl.count > 1) { badged.add(cell); badge = `<span class="hx-poi__count">+${cl.count - 1}</span>` }
          } catch { /* ignore */ }
          const icon = L.divIcon({
            className: 'hx-poi',
            html: `<div class="hx-poi__pin" style="--c:${col};width:${sz}px;height:${sz}px"><div class="hx-poi__ico">${svg}</div></div>${badge}${label}`,
            iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
          })
          const m = L.marker([p.lat, p.lon], { icon, zIndexOffset: 500 + (sz * 10), keyboard: false, title: p.name })
          m.on('click', () => map.flyTo([p.lat, p.lon], 15, { duration: 1.2 }))
          layer.addLayer(m)
        }
        // Zones with POIs but no visible marker yet: a counter bubble (tap → zoom into the zone)
        for (const cl of clusters.values()) {
          if (badged.has(cl.cell) || cl.count < 3) continue
          const pt = map.latLngToContainerPoint([cl.lat, cl.lon])
          if (placed.some(q => Math.hypot(q.x - pt.x, q.y - pt.y) < q.r + 26)) continue   // never over a marker
          placed.push({ x: pt.x, y: pt.y, r: 24 })
          const d = cl.count >= 100 ? 44 : cl.count >= 20 ? 36 : 30
          const icon = L.divIcon({ className: 'hx-poi', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
            html: `<div class="hx-poi__cluster" style="width:${d}px;height:${d}px">${cl.count}</div>` })
          const m = L.marker([cl.lat, cl.lon], { icon, zIndexOffset: 300, keyboard: false, title: `${cl.count} points of interest` })
          m.on('click', () => map.flyTo([cl.lat, cl.lon], Math.min(zoom + 3, 15), { duration: 1 }))
          layer.addLayer(m)
        }
      })
      .catch(() => {})
  }, [map, layer, zoom, center[0].toFixed(2), center[1].toFixed(2), hexCount])

  return null
}
