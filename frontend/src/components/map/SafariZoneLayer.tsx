/**
 * SafariZoneLayer — the hunting zone of a running radar hunt, drawn on the map in safari colours (owner 2026-10-19:
 * "for safari we shall see special hunting colours on the target zone"). Built only from what the radar told the
 * player (GET /api/safari/active/: clue region + scans), never from the hidden hex:
 *  - no scan yet: the clue region (dashed savanna ring around clue_lat/lon)
 *  - after a scan: the sector it points to — bearing ± spread, between the band's min and max distance
 *  - "IT IS HERE": the hexes within capture range of that scan, striped amber / olive and pulsing — tap the one hiding
 *    the creature (POST /safari/probe/ {h3}): right → SafariReveal; wrong → greyed with its distance in hexes
 * Every scan stays as a small dot in its band colour.
 */
import { useEffect } from 'react'
import L from 'leaflet'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { playSound } from '../../hooks/useSound'
import { cellToBoundary, gridDisk, latLngToCell, cellToLatLng } from 'h3-js'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { useLeafletLayer } from '../ui/Utils'
import { BAND } from '../hud/DailyHuntPanel'

const AMBER = '#f59e0b', OLIVE = '#65a30d', INK = '#3f2a05'
// Distance range of each radar band, km (safari/scan in territories/views.py)
const RANGE: Record<string, [number, number]> = { burning: [2.5, 20], hot: [20, 100], warm: [100, 500], cold: [500, 2000], freezing: [2000, 6000] }
const SPREAD: Record<string, number> = { burning: 40, hot: 30, warm: 24, cold: 20, freezing: 18 }   // ± degrees

function dest(lat: number, lon: number, km: number, brg: number): [number, number] {
  const R = 6371, d = km / R, b = brg * Math.PI / 180, p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b))
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180]
}
function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
const label = (text: string, color: string) => L.divIcon({ className: '', iconSize: [0, 0], html:
  `<div style="transform:translate(-50%,-50%);white-space:nowrap;padding:3px 9px;border-radius:999px;background:${INK}e6;border:2px solid ${color};
   color:#fef3c7;font:900 10px/1.2 'Lilita One',sans-serif;letter-spacing:1.5px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${text}</div>` })

/** Fill a Leaflet SVG path with the safari stripes (diagonal amber / olive), defined once in that SVG's <defs>. */
function stripe(path: L.Path) {
  const el = (path as any)._path as SVGPathElement | undefined
  const svg = el?.ownerSVGElement
  if (!el || !svg) return
  if (!svg.querySelector('#hxSafariStripes')) {
    const ns = 'http://www.w3.org/2000/svg'
    const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(ns, 'defs'), svg.firstChild)
    const pat = document.createElementNS(ns, 'pattern')
    pat.setAttribute('id', 'hxSafariStripes'); pat.setAttribute('patternUnits', 'userSpaceOnUse')
    pat.setAttribute('width', '18'); pat.setAttribute('height', '18'); pat.setAttribute('patternTransform', 'rotate(45)')
    pat.innerHTML = `<rect width="18" height="18" fill="${AMBER}"/><rect width="9" height="18" fill="${OLIVE}"/>`
    defs.appendChild(pat)
  }
  el.setAttribute('fill', 'url(#hxSafariStripes)')
}

export function SafariZoneLayer({ map }: { map: L.Map | null }) {
  const layer = useLeafletLayer(map)
  const qc = useQueryClient()
  const isAuth = useStore(s => s.isAuthenticated)
  const { data } = useQuery<any>({ queryKey: ['safari-active'], queryFn: () => api.get('/safari/active/').then(r => r.data), enabled: isAuth, staleTime: 15000 })
  const t = data?.target
  const hunt = t && t.mode === 'world' && t.status === 'active' ? t : null

  useEffect(() => {
    if (!layer) return
    layer.clearLayers()
    if (!hunt) return
    const probes: any[] = hunt.probes || []
    const scans = probes.filter(p => p.band)                       // radar pings
    const tried = new Map(probes.filter(p => p.h3 && p.ring != null).map(p => [p.h3, p.ring]))   // hexes tapped, wrong
    const last = scans[scans.length - 1]
    // own pane above the hex grid (overlayPane 400) so the zone hexes get the taps, below markers (600)
    if (map && !map.getPane('hxSafari')) { map.createPane('hxSafari'); map.getPane('hxSafari')!.style.zIndex = '450' }
    const base = { interactive: false, bubblingMouseEvents: false, pane: 'hxSafari' }
    const tap = async (h3: string) => {
      try {
        const { data: r } = await api.post('/safari/probe/', { h3 })
        if (r.result === 'captured') {
          qc.setQueryData(['safari-active'], (o: any) => ({ ...o, target: null }))
          window.dispatchEvent(new CustomEvent('hx:safari-reveal', { detail: { target: r.target, hex_earned: r.hex_earned, won_hex: r.won_hex } }))
          ;['codex-cards', 'loop-status', 'player', 'kingdoms', 'territories', 'my-territories'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
        } else {
          qc.setQueryData(['safari-active'], (o: any) => ({ ...o, target: r.result === 'fled' ? null : r.target }))
          if (r.result === 'fled') { playSound('flee'); toast.error(r.message) }
          else { playSound('probe'); toast(`Not this one — ${r.ring} hex${r.ring > 1 ? 'es' : ''} away`, { duration: 2500 }) }
        }
      } catch (e: any) { toast.error(e?.response?.data?.error || 'Not here') }
    }

    if (!last && hunt.clue_lat != null) {
      // Clue region: where to start scanning
      stripe(L.circle([hunt.clue_lat, hunt.clue_lon], { ...base, radius: (hunt.clue_km || 400) * 1000, color: AMBER, weight: 3, dashArray: '14 10',
        fillColor: OLIVE, fillOpacity: 0.12, className: 'hx-safari-zone' }).addTo(layer))
      L.marker([hunt.clue_lat, hunt.clue_lon], { ...base, icon: label('HUNTING ZONE', AMBER) }).addTo(layer)
    } else if (last && last.band === 'here') {
      // Within capture range: the candidate hexes, striped safari colours
      const centre: [number, number] = [last.lat, last.lon]
      const cap = hunt.capture_km || 2.5
      gridDisk(latLngToCell(last.lat, last.lon, 8), 4).forEach((c, i) => {
        const ll = cellToLatLng(c) as [number, number]
        if (km(centre, ll) > cap) return
        const ring = tried.get(c)
        const poly = L.polygon(cellToBoundary(c) as L.LatLngTuple[], ring != null
          ? { ...base, color: INK, weight: 1.5, fillColor: '#334155', fillOpacity: 0.55 }
          : { interactive: true, bubblingMouseEvents: false, pane: 'hxSafari', color: INK, weight: 1.5, fillColor: i % 2 ? AMBER : OLIVE,
              fillOpacity: 0.45, className: 'hx-safari-hex' }).addTo(layer)
        if (ring != null) L.marker(ll, { ...base, icon: label(String(ring), '#94a3b8') }).addTo(layer)
        else poly.on('click', () => tap(c))
      })
      L.circle(centre, { ...base, radius: cap * 1000, color: BAND.here.color, weight: 3, dashArray: '6 6', fill: false }).addTo(layer)
      L.marker(dest(last.lat, last.lon, cap, 0), { ...base, icon: label('IT IS HERE · TAP THE HEX HIDING IT', BAND.here.color) }).addTo(layer)
    } else if (last && RANGE[last.band]) {
      // The sector the last scan points to
      const [r0, r1] = RANGE[last.band], s = SPREAD[last.band], pts: [number, number][] = []
      for (let a = -s; a <= s; a += 2) pts.push(dest(last.lat, last.lon, r1, last.bearing + a))
      for (let a = s; a >= -s; a -= 2) pts.push(dest(last.lat, last.lon, r0, last.bearing + a))
      const col = BAND[last.band]?.color || AMBER
      stripe(L.polygon(pts, { ...base, color: col, weight: 3, dashArray: '12 8', fillColor: AMBER, fillOpacity: 0.16, className: 'hx-safari-zone' }).addTo(layer))
      L.polyline([[last.lat, last.lon], dest(last.lat, last.lon, (r0 + r1) / 2, last.bearing)], { ...base, color: col, weight: 2, opacity: 0.7, dashArray: '2 8' }).addTo(layer)
      L.marker(dest(last.lat, last.lon, (r0 + r1) / 2, last.bearing), { ...base, icon: label(`${BAND[last.band]?.label} · ${r0}-${r1} KM`, col) }).addTo(layer)
    }
    // Every scan: a dot in its band colour
    probes.forEach((p: any) => {
      if (p.lat == null) return
      L.circleMarker([p.lat, p.lon], { ...base, radius: 6, color: INK, weight: 2, fillColor: BAND[p.band]?.color || '#94a3b8', fillOpacity: 1 }).addTo(layer)
    })
  }, [layer, hunt?.id, hunt?.probes?.length, hunt?.clue_lat]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
