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
import { cellToBoundary, gridDisk } from 'h3-js'
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
 *  Returns array of [lat,lng] polyline segments forming the outer border. */
function buildOuterBorder(h3Indexes: string[]): [number, number][][] {
  const clusterSet = new Set(h3Indexes)
  // Edge = pair of boundary vertices. An edge is "outer" if its hex neighbor is NOT in cluster.
  // For each hex, get 6 boundary points + 6 neighbors (in order).
  // Edge i connects vertex[i] and vertex[(i+1)%6].
  // Neighbor i shares edge i with this hex.

  const outerEdges: [number, number][][] = []

  for (const hx of h3Indexes) {
    try {
      const boundary = cellToBoundary(hx) as [number, number][]
      const neighbors = gridDisk(hx, 1).filter((n: string) => n !== hx)

      for (let i = 0; i < 6; i++) {
        // Check if neighbor across edge i is in cluster
        const neighbor = neighbors[i]
        if (!neighbor || !clusterSet.has(neighbor)) {
          // This edge is outer — add as segment
          const v1 = boundary[i]
          const v2 = boundary[(i + 1) % 6]
          outerEdges.push([v1, v2])
        }
      }
    } catch (_) {}
  }

  // Merge connected edges into polylines
  if (outerEdges.length === 0) return []

  // Simple greedy chain merge
  const chains: [number, number][][] = []
  const used = new Set<number>()

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
        // Connect to end
        if (Math.abs(a[0] - last[0]) < 1e-8 && Math.abs(a[1] - last[1]) < 1e-8) {
          chain.push(b); used.add(j); changed = true
        } else if (Math.abs(b[0] - last[0]) < 1e-8 && Math.abs(b[1] - last[1]) < 1e-8) {
          chain.push(a); used.add(j); changed = true
        }
        // Connect to start
        else if (Math.abs(b[0] - first[0]) < 1e-8 && Math.abs(b[1] - first[1]) < 1e-8) {
          chain.unshift(a); used.add(j); changed = true
        } else if (Math.abs(a[0] - first[0]) < 1e-8 && Math.abs(a[1] - first[1]) < 1e-8) {
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

      // Badge centroid
      if (k.centroid_lat && k.centroid_lon) {
        const tierLabel = isMain ? '' : k.size <= 1 ? '' : '⬡'
        const size = isMain ? 52 : Math.min(44, 28 + Math.floor(Math.log2(k.size + 1)) * 4)

        const icon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
            background:${color}${isMain ? '28' : '18'};
            border:${isMain ? 2 : 1.5}px solid ${color}${isMain ? 'cc' : '88'};
            display:flex;align-items:center;justify-content:center;flex-direction:column;
            box-shadow:0 0 ${isMain ? 18 : 10}px ${color}${isMain ? '66' : '33'};
            font-family:system-ui;cursor:default;
          ">
            <div style="font-size:${Math.round(size * 0.28)}px;line-height:1">${tierLabel}</div>
            <div style="font-size:${Math.round(size * 0.2)}px;font-weight:900;color:#fff;line-height:1.1">${k.size}</div>
          </div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
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
