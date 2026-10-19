/**
 * KingdomBorderLayer — Merged kingdom borders on the map.
 *
 * Connected territories form ONE kingdom with:
 * - Single outer border (no internal edges between adjacent hexes)
 * - Filled area in kingdom color
 * - Badge at centroid: tier icon + territory count
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useLeafletLayer } from '../ui/Utils'
import { useQuery } from '@tanstack/react-query'
import { cellToBoundary, gridDisk, latLngToCell, cellToLatLng, getResolution } from 'h3-js'
import { api } from '../../services/api'
import { usePlayer } from '../../store'

interface Kingdom {
  cluster_id: string
  size: number
  is_main: boolean
  tier: number
  tdc_per_24h: number
  h3_indexes: string[]
  centroid_lat: number
  centroid_lon: number
  forces?: { attack: number; defense: number; spy: number }
}

interface Props {
  map: L.Map | null
  zoom: number
  onKingdomClick?: (kingdom: Kingdom & { isOwn: boolean }) => void
}

const TIER_COLOR = [
  '#4B5563', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#FF0080',
]

/** Build outer-only boundary segments for a cluster of hexes.
 *  Returns array of [lat,lng] polyline segments forming the outer border.
 *
 *  FIX: Previously used gridDisk neighbor ordering which does NOT match
 *  cellToBoundary edge ordering. Now uses latLngToCell on edge midpoints
 *  nudged outward to correctly identify which neighbor is across each edge. */
function buildOuterBorder(h3Indexes: string[]): [number, number][][] {
  const clusterSet = new Set(h3Indexes)
  const outerEdges: [number, number][][] = []

  for (const hx of h3Indexes) {
    try {
      const boundary = cellToBoundary(hx) as [number, number][]
      const center = cellToLatLng(hx) as [number, number]
      const res = getResolution(hx)

      for (let i = 0; i < boundary.length; i++) {
        const v1 = boundary[i]
        const v2 = boundary[(i + 1) % boundary.length]

        // Midpoint of this edge
        const midLat = (v1[0] + v2[0]) / 2
        const midLon = (v1[1] + v2[1]) / 2

        // Nudge midpoint slightly AWAY from hex center (outward)
        const dLat = midLat - center[0]
        const dLon = midLon - center[1]
        const nudgedLat = midLat + dLat * 0.3
        const nudgedLon = midLon + dLon * 0.3

        // Find which cell is across this edge
        const neighborAcrossEdge = latLngToCell(nudgedLat, nudgedLon, res)

        // If the neighbor is NOT in our cluster → this is an outer edge
        if (!clusterSet.has(neighborAcrossEdge)) {
          outerEdges.push([v1, v2])
        }
      }
    } catch (_) {}
  }

  // Merge connected edges into polylines (greedy chain merge)
  if (outerEdges.length === 0) return []

  const chains: [number, number][][] = []
  const used = new Set<number>()
  const EPS = 1e-8

  for (let start = 0; start < outerEdges.length; start++) {
    if (used.has(start)) continue
    used.add(start)
    const chain = [...outerEdges[start]]

    let changed = true
    while (changed) {
      changed = false
      for (let j = 0; j < outerEdges.length; j++) {
        if (used.has(j)) continue
        const [a, b] = outerEdges[j]
        const last = chain[chain.length - 1]
        const first = chain[0]

        if (Math.abs(a[0] - last[0]) < EPS && Math.abs(a[1] - last[1]) < EPS) {
          chain.push(b); used.add(j); changed = true
        } else if (Math.abs(b[0] - last[0]) < EPS && Math.abs(b[1] - last[1]) < EPS) {
          chain.push(a); used.add(j); changed = true
        } else if (Math.abs(b[0] - first[0]) < EPS && Math.abs(b[1] - first[1]) < EPS) {
          chain.unshift(a); used.add(j); changed = true
        } else if (Math.abs(a[0] - first[0]) < EPS && Math.abs(a[1] - first[1]) < EPS) {
          chain.unshift(b); used.add(j); changed = true
        }
      }
    }
    chains.push(chain)
  }

  return chains
}



export function KingdomBorderLayer({ map, zoom, onKingdomClick }: Props) {
  const player = usePlayer()
  const _layerFromHook = useLeafletLayer(map)
  const layerRef = useRef<L.LayerGroup | null>(null)

  const { data } = useQuery<{ kingdoms: Kingdom[] }>({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000,
    enabled: !!map && !!player,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()

    const kingdoms: Kingdom[] = data?.kingdoms ?? []
    if (!kingdoms.length) return

    kingdoms.forEach(k => {
      // Player customisation (server) first, tier colour otherwise
      const color = (k as any).border_color || TIER_COLOR[Math.min(k.tier, 6)]
      const fill = (k as any).fill_color || color
      const kname: string = ((k as any).name || '').replace(/[&<>"']/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])
      const isMain = k.is_main

      if (zoom >= 10 && k.h3_indexes?.length) {
        // Fill: draw all hexes — clickable
        k.h3_indexes.forEach(hx => {
          try {
            const pts = cellToBoundary(hx) as [number, number][]
            const poly = L.polygon(pts as L.LatLngTuple[], {
              fillColor: fill,
              fillOpacity: (k as any).fill_color ? 0.28 : (isMain ? 0.07 : 0.04),
              color: 'transparent', weight: 0,
              interactive: true,
            })
            poly.on('click', () => {
              if (onKingdomClick) {
                const isOwn = !!player && k.h3_indexes.some((h: string) => {
                  const t = (window as any).__HEXOD_TERRITORIES__?.[h]
                  return t?.owner_id === player.id
                })
                onKingdomClick({ ...k, isOwn } as any)
              }
            })
            layer.addLayer(poly)
          } catch (_) {}
        })

        // Border: only outer edges (merged kingdom border)
        // Neon stack, drawn bottom→top: soft halo, glow, crisp core, white highlight
        if (k.h3_indexes.length >= 2) {
          const chains = buildOuterBorder(k.h3_indexes)
          const stack: L.PolylineOptions[] = [
            { color, weight: isMain ? 14 : 10, opacity: isMain ? 0.10 : 0.06 },
            { color, weight: isMain ? 6 : 4.5, opacity: isMain ? 0.28 : 0.18 },
            { color, weight: isMain ? 2.6 : 2, opacity: isMain ? 1 : 0.85 },
            { color: '#ffffff', weight: 0.8, opacity: isMain ? 0.55 : 0.35 },
          ]
          stack.forEach(opts => {
            chains.forEach(chain => {
              layer.addLayer(L.polyline(chain as L.LatLngTuple[], {
                ...opts, interactive: false, lineCap: 'round', lineJoin: 'round',
              }))
            })
          })
        } else {
          // Single territory: draw hex border normally
          try {
            const pts = cellToBoundary(k.h3_indexes[0]) as [number, number][]
            layer.addLayer(L.polygon(pts as L.LatLngTuple[], {
              fillColor: 'transparent', fillOpacity: 0,
              color, weight: isMain ? 2.2 : 1.6,
              opacity: isMain ? 0.85 : 0.6,
              dashArray: '6,4', interactive: false,
            }))
          } catch (_) {}
        }
      }

      // Kingdom label + its forces (attack / defense / spy points, owner 2026-10-19: "visible above the kingdom or territory")
      if (k.centroid_lat && k.centroid_lon) {
        const compact = zoom < 12
        // Outposts (1-2 hexes) zoomed out: a small hex emblem only, no forces row (owner 2026-10-19)
        const tiny = zoom < 11 && k.size <= 2
        const size = tiny ? 18 : compact ? 26 : 32
        // Hex emblem (tier colour) with tier digit, then size + label. Static strings only (no player text).
        const emblem = `<svg width="${tiny ? 14 : compact ? 18 : 22}" height="${tiny ? 14 : compact ? 18 : 22}" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 4px ${color}aa)">
            <path d="M12 1.5 21.1 6.75v10.5L12 22.5 2.9 17.25V6.75z" fill="${color}" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>
            <text x="12" y="16" text-anchor="middle" font-family="Orbitron,sans-serif" font-size="10" font-weight="900" fill="#06101e">${k.tier}</text>
          </svg>`
        // Kingdom picture (uploaded /media/ file or https link), as a round avatar before the emblem
        const pic: string = (k as any).embed_url || ''
        const avatar = /^(https:\/\/|\/media\/)[^"'()<>\s]+$/.test(pic)
          ? `<span style="width:${size - 6}px;height:${size - 6}px;border-radius:50%;flex-shrink:0;border:1.5px solid ${color};background:#0b1626 url('${pic}') center/cover"></span>` : ''
        const crown = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#FCD34D" style="flex-shrink:0"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>`
        const icon = L.divIcon({
          html: `<div class="td-kingdom-pill" style="
            position:absolute;left:0;top:0;transform:translate(-50%,-50%);
            height:${size}px;padding:0 ${tiny ? 2 : compact ? 8 : 11}px 0 ${tiny ? 2 : compact ? 4 : 5}px;
            background:linear-gradient(180deg,rgba(14,26,44,0.94),rgba(6,12,24,0.94));
            border:1.5px solid ${color}cc;border-radius:999px;
            display:flex;align-items:center;gap:${compact ? 5 : 7}px;
            box-shadow:0 0 14px ${color}55,0 3px 10px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.08);
            cursor:pointer;white-space:nowrap;
          ">
            ${avatar}${emblem}
            ${tiny ? '' : `<span style="font-family:'Share Tech Mono',monospace;font-size:${compact ? 13 : 15}px;font-weight:700;color:#fff;line-height:1">${k.size}</span>`}
            ${compact ? '' : `<span style="width:1px;height:14px;background:rgba(255,255,255,0.18)"></span>
            ${isMain ? crown : ''}
            <span style="font-family:'Orbitron',sans-serif;font-size:10px;font-weight:800;letter-spacing:1.5px;color:${isMain ? '#FCD34D' : 'rgba(255,255,255,0.8)'}">${kname || (isMain ? 'MAIN' : 'KINGDOM')}</span>`}
          </div>
          ${k.forces && !tiny && (zoom >= 13 || k.forces.attack + k.forces.defense + k.forces.spy > 0) ? `<div style="position:absolute;left:0;top:${size / 2 + 3}px;transform:translateX(-50%);display:flex;gap:4px;white-space:nowrap;pointer-events:none">
            ${[['#f87171', 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2', k.forces.attack],
               ['#60a5fa', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', k.forces.defense],
               ['#c084fc', 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', k.forces.spy]]
              .map(([c, d, v]) => `<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:999px;background:rgba(6,12,24,0.88);border:1px solid ${c}88;font-family:'Share Tech Mono',monospace;font-size:${compact ? 10 : 11}px;color:#fff"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>${Number(v).toLocaleString()}</span>`).join('')}
          </div>` : ''}`,
          className: 'td-kingdom-badge',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })

        const marker = L.marker([k.centroid_lat, k.centroid_lon], {
          icon, zIndexOffset: isMain ? 800 : 600, interactive: true,
        })

        marker.on('click', () => {
          if (onKingdomClick) {
            onKingdomClick({ ...k, isOwn: isMain } as any)
          }
        })

        marker.bindTooltip(
          `<div style="font-size:11px;line-height:1.5;font-family:system-ui,sans-serif;letter-spacing:0">
            <strong style="color:${color};font-family:'Orbitron',sans-serif;font-size:12px;letter-spacing:0.5px">${kname || (isMain ? 'Main Kingdom' : `Kingdom (${k.size})`)}</strong><br/>
            <span style="color:rgba(255,255,255,0.75)">Tier ${k.tier} · ${k.size} territories</span>
            ${k.tdc_per_24h ? `<br/><span style="color:#34D399;font-family:'Share Tech Mono',monospace">+${Math.round(k.tdc_per_24h).toLocaleString()} HEX/day</span>` : ''}
            ${k.size <= 1 ? '<br/><span style="color:#F87171;font-size:10px"> Isolated — skills frozen</span>' : ''}
          </div>`,
          { className: 'td-tooltip', direction: 'top', offset: [0, -size / 2] }
        )
        layer.addLayer(marker)
      }
    })

    return () => { layer.clearLayers() }
  }, [map, data, zoom, onKingdomClick, player])

  useEffect(() => () => { layerRef.current?.remove() }, [])

  return null
}
