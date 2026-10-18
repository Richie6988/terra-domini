/**
 * ExplorationLayer — hexes being explored are greyed on the map with their countdown inside
 * (owner 2026-10-18). Data: the 'pending-claims' query (usePendingClaims); the timer ticks locally
 * from started_at + hours_required, the server stays the referee when the claim completes.
 */
import { useEffect } from 'react'
import L from 'leaflet'
import { cellToBoundary, cellToLatLng } from 'h3-js'
import { useLeafletLayer } from '../ui/Utils'
import { usePendingClaims } from '../../hooks/usePendingClaims'

const fmt = (s: number) => {
  if (s <= 0) return 'READY'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(sec).padStart(2, '0')}`
}

export function ExplorationLayer({ map }: { map: L.Map | null }) {
  const layer = useLeafletLayer(map)
  const { claims, completeClaim } = usePendingClaims()

  useEffect(() => {
    if (!layer) return
    layer.clearLayers()
    const timers: { el: () => HTMLElement | null; end: number; id: number; done?: boolean }[] = []
    for (const c of claims) {
      if (c.method !== 'explore' || !c.h3_index) continue
      let pts: [number, number][], center: [number, number]
      try { pts = cellToBoundary(c.h3_index) as [number, number][]; center = cellToLatLng(c.h3_index) as [number, number] } catch { continue }
      layer.addLayer(L.polygon(pts, {
        color: '#94a3b8', weight: 2, dashArray: '6 5', fillColor: '#475569', fillOpacity: 0.55, interactive: false,
        className: 'hx-exploring',
      }))
      const end = c.started_at && c.hours_required
        ? new Date(c.started_at).getTime() + c.hours_required * 3600e3
        : Date.now() + (c.eta_seconds || 0) * 1000
      const id = `hx-exp-${c.id}`
      layer.addLayer(L.marker(center, {
        interactive: false, keyboard: false, zIndexOffset: 900,
        icon: L.divIcon({ className: 'hx-exp', iconSize: [90, 34], iconAnchor: [45, 17],
          html: `<div class="hx-exp__label">EXPLORING</div><div class="hx-exp__time" id="${id}">${fmt((end - Date.now()) / 1000)}</div>` }),
      }))
      timers.push({ el: () => document.getElementById(id), end, id: c.id })
    }
    if (!timers.length) return
    const t = setInterval(() => timers.forEach(x => {
      const left = (x.end - Date.now()) / 1000
      const el = x.el(); if (el) el.textContent = fmt(left)
      if (left <= 0 && !x.done) { x.done = true; completeClaim(x.id) }   // finish the claim (server checks the time)
    }), 1000)
    return () => clearInterval(t)
  }, [layer, claims, completeClaim])

  return null
}
