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
      const color = TIER_COLOR[Math.min(k.tier, 6)]
      const isMain = k.is_main

      if (zoom >= 10 && k.h3_indexes?.length) {
        // Fill: draw all hexes — clickable
        k.h3_indexes.forEach(hx => {
          try {
            const pts = cellToBoundary(hx) as [number, number][]
            const poly = L.polygon(pts as L.LatLngTuple[], {
              fillColor: color,
              fillOpacity: isMain ? 0.06 : 0.03,
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
        if (k.h3_indexes.length >= 2) {
          const chains = buildOuterBorder(k.h3_indexes)
          chains.forEach(chain => {
            layer.addLayer(L.polyline(chain as L.LatLngTuple[], {
              color,
              weight: isMain ? 3.5 : 2,
              opacity: isMain ? 0.85 : 0.5,
              interactive: false,
              lineCap: 'round', lineJoin: 'round',
            }))
          })
        } else {
          // Single territory: draw hex border normally
          try {
            const pts = cellToBoundary(k.h3_indexes[0]) as [number, number][]
            layer.addLayer(L.polygon(pts as L.LatLngTuple[], {
              fillColor: 'transparent', fillOpacity: 0,
              color, weight: isMain ? 2.5 : 1.5,
              opacity: isMain ? 0.7 : 0.4,
              dashArray: '6,4', interactive: false,
            }))
          } catch (_) {}
        }
      }

      // Kingdom label — only for kingdoms with 2+ territories
      if (k.centroid_lat && k.centroid_lon && k.size >= 2) {
        const size = isMain ? 48 : Math.min(40, 24 + Math.floor(Math.log2(k.size + 1)) * 4)

        const icon = L.divIcon({
          html: `<div style="
            padding:3px 8px;
            background:${color}22;
            border:1.5px solid ${color}88;
            border-radius:8px;
            display:flex;align-items:center;gap:4px;
            box-shadow:0 2px 8px ${color}33;
            font-family:'Orbitron',system-ui,sans-serif;
            cursor:pointer;white-space:nowrap;
          ">
            <div style="font-size:10px;font-weight:900;color:${color}">${k.size}</div>
            <div style="font-size:7px;color:rgba(255,255,255,0.5);letter-spacing:1px">${isMain ? 'MAIN' : `T${k.tier}`}</div>
          </div>`,
          className: '',
          iconSize: [60, 24],
          iconAnchor: [30, 12],
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
          `<div style="font-size:12px">
            <strong style="color:${color}">${isMain ? 'Main Kingdom' : `Kingdom (${k.size})`}</strong><br/>
            Tier ${k.tier} · ${k.size} territories
            ${k.tdc_per_24h ? `<br/>+${Math.round(k.tdc_per_24h)} HEX/day` : ''}
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
