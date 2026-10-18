/**
 * ResourceIconLayer — what the land produces, drawn on the map (GET /api/map/resources/): exact POI spots
 * (oil field, gold mine…) plus one icon per area from its terrain and region. Zoom 9+.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useLeafletLayer } from '../ui/Utils'
import { api } from '../../services/api'
import { getIcon } from '../shared/iconBank'
import { RES_ICON } from '../shared/resourceIcons'
import { useStore } from '../../store'

export const RESOURCE_MIN_ZOOM = 9
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function ResourceIconLayer({ map, zoom, center }: { map: L.Map | null; zoom: number; center: [number, number] }) {
  const layer = useLeafletLayer(map)
  const reqId = useRef(0)
  const isAuth = useStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!map || !layer || !isAuth) return
    if (zoom < RESOURCE_MIN_ZOOM) { layer.clearLayers(); return }
    const b = map.getBounds()
    const id = ++reqId.current
    const t = setTimeout(() => {
      api.get('/map/resources/', { params: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom } })
        .then(({ data }) => {
          // markers swapped during a zoom animation crash Leaflet (_leaflet_pos): skip, the next move redraws
          if (id !== reqId.current || (map as any)._animatingZoom) return
          layer.clearLayers()
          for (const r of data.icons || []) {
            const size = r.poi ? 40 : 32
            const icon = L.divIcon({
              className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
              html: `<div class="hx-res${r.poi ? ' is-poi' : ''}" title="${esc(r.name)} · ${esc(r.where)}">${getIcon(RES_ICON[r.resource] || 'box')}</div>`,
            })
            layer.addLayer(L.marker([r.lat, r.lon], { icon, interactive: false, keyboard: false, zIndexOffset: r.poi ? 400 : 100 }))
          }
        }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [map, layer, zoom, center[0], center[1], isAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
