/**
 * KingdomBorderLayer — Rendu des borders de royaumes sur la carte.
 *
 * - Bordure épaisse distincte par cluster (couleur joueur = vert, ennemi = rouge/bleu)
 * - Badge centroïde : taille royaume + tier
 * - Mise à jour automatique quand les territoires du joueur changent
 * - Zoom < 10 : badges seulement, pas de polygones individuels
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { cellToBoundary } from 'h3-js'
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
}

const TIER_COLOR = [
  '#4B5563', // tier 0 — gray
  '#10B981', // tier 1 — green
  '#3B82F6', // tier 2 — blue
  '#8B5CF6', // tier 3 — purple
  '#F59E0B', // tier 4 — gold
  '#EC4899', // tier 5 — pink
  '#FF0080', // tier 6 — mythic
]

/** Compute outer border edges: edges shared by exactly 1 hex in cluster */
function computeBorderEdges(h3Indexes: string[]): [number, number][][][] {
  const clusterSet = new Set(h3Indexes)
  // For each hex, get its 6 edges. An edge is a border if its neighbor is NOT in the cluster.
  // Return polygons of contiguous border segments (simplified: one poly per hex for now)
  const borderPolygons: [number, number][][][] = []

  for (const hx of h3Indexes) {
    try {
      const boundary = cellToBoundary(hx) as [number, number][]
      // Check all 6 neighbors
      // If any neighbor is not in cluster, draw that side — for simplicity draw full hex outline
      // Outer border = hull of all boundary pts. We just draw each hex and leaflet merges visually.
      borderPolygons.push([boundary])
    } catch (_) {}
  }
  return borderPolygons
}

export function KingdomBorderLayer({ map, zoom }: Props) {
  const player = usePlayer()
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

    kingdoms.forEach((k, ki) => {
      const color = TIER_COLOR[Math.min(k.tier, 6)]
      const isMain = k.is_main

      if (zoom >= 10 && k.h3_indexes?.length) {
        // Draw hex outlines for all member hexes
        // Use SVG renderer for better performance
        k.h3_indexes.forEach(hx => {
          try {
            const pts = cellToBoundary(hx) as [number, number][]
            const poly = L.polygon(pts as L.LatLngTuple[], {
              fillColor: color,
              fillOpacity: isMain ? 0.04 : 0.02,
              color: color,
              weight: isMain ? 2.5 : 1.5,
              opacity: isMain ? 0.7 : 0.4,
              dashArray: isMain ? '' : '6,4',
              // Kingdom border is on top of hex fill
              interactive: false,
            })
            layer.addLayer(poly)
          } catch (_) {}
        })
      }

      // Badge centroïde — toujours visible
      if (k.centroid_lat && k.centroid_lon) {
        const tierLabel = isMain ? '👑' : k.size <= 1 ? '🏴' : '🏰'
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
            <div style="font-size:${Math.round(size*0.28)}px;line-height:1">${tierLabel}</div>
            <div style="font-size:${Math.round(size*0.2)}px;font-weight:900;color:#fff;line-height:1.1">${k.size}</div>
          </div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })

        const marker = L.marker([k.centroid_lat, k.centroid_lon], {
          icon,
          zIndexOffset: isMain ? 800 : 600,
          interactive: true,
        })

        const hexPerDay = k.tdc_per_24h ? `+${Math.round(k.tdc_per_24h)} 💎/jour` : ''
        marker.bindTooltip(
          `<div style="font-size:12px">
            <strong style="color:${color}">${isMain ? '👑 Royaume Principal' : `🏰 Royaume (${k.size})`}</strong><br/>
            Tier ${k.tier} · ${k.size} territoires${hexPerDay ? `<br/>${hexPerDay}` : ''}
            ${k.size <= 1 ? '<br/><span style="color:#F87171;font-size:10px">⚠️ Isolé — skills gelés</span>' : ''}
          </div>`,
          { className: 'td-tooltip', direction: 'top', offset: [0, -size / 2] }
        )

        layer.addLayer(marker)
      }
    })

    return () => { layer.clearLayers() }
  }, [map, data, zoom])

  useEffect(() => () => { layerRef.current?.remove() }, [])

  return null
}
