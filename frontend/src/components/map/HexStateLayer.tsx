/**
 * HexStateLayer — what is happening on a hex, visible from the map (Clash of Clans style), from GET /api/map/states/:
 * attack = red pulsing outline + crossed swords; shield = blue dome; event = golden glow + x3 badge.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { cellToBoundary, cellToLatLng } from 'h3-js'
import { useLeafletLayer } from '../ui/Utils'
import { api } from '../../services/api'
import { getIcon } from '../shared/iconBank'
import { useStore } from '../../store'

const STYLE: Record<string, { cls: string; icon: string; label?: string }> = {
  attack: { cls: 'hx-st-attack', icon: 'swords' },
  shield: { cls: 'hx-st-shield', icon: 'ui_shield' },
  event:  { cls: 'hx-st-event', icon: 'sparkles', label: 'x3' },
}

export function HexStateLayer({ map, zoom, center }: { map: L.Map | null; zoom: number; center: [number, number] }) {
  const layer = useLeafletLayer(map)
  const reqId = useRef(0)
  const isAuth = useStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!map || !layer || !isAuth) return
    if (zoom < 9) { layer.clearLayers(); return }
    const load = () => {
      const b = map.getBounds(), id = ++reqId.current
      api.get('/map/states/', { params: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } })
        .then(({ data }) => {
          if (id !== reqId.current || (map as any)._animatingZoom) return
          layer.clearLayers()
          for (const st of data.states || []) {
            const sty = STYLE[st.state]
            if (!sty) continue
            const ring = cellToBoundary(st.h3).map(([a, b]) => [a, b]) as L.LatLngTuple[]
            layer.addLayer(L.polygon(ring, { className: sty.cls, interactive: false }))
            const [lat, lon] = cellToLatLng(st.h3)
            layer.addLayer(L.marker([lat, lon], {
              interactive: false, keyboard: false, zIndexOffset: 800,
              icon: L.divIcon({ className: '', iconSize: [38, 38], iconAnchor: [19, 46],
                html: `<div class="hx-stbadge ${sty.cls}-badge">${getIcon(sty.icon)}${sty.label ? `<b>${sty.label}</b>` : ''}</div>` }),
            }))
          }
        }).catch(() => {})
    }
    const t = setTimeout(load, 300)
    const iv = setInterval(load, 30000)   // battles start and end: keep the map honest
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [map, layer, zoom, center[0], center[1], isAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
