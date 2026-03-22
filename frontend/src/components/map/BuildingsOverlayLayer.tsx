/**
 * BuildingsOverlayLayer — affiche les constructions sur les territoires.
 *
 * Chaque bâtiment = une icône SVG Leaflet positionnée au centroïde du hex.
 * Taille selon le zoom (plus grand quand on zoom).
 * Tooltip : nom du bâtiment + niveau + effet.
 *
 * Bâtiments supportés (CDC §2.8) :
 *   🏰 Fortification  ⛏️ Mine  🗼 Tour de contrôle
 *   💻 Centre données  🛢️ Raffinerie  🚀 Port spatial
 *   ⚛️ Réacteur  🌾 Ferme
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { cellToLatLng } from 'h3-js'
import { api } from '../../services/api'

interface Building {
  id: string
  building_type: string
  level: number
  h3_index: string
}

interface Props {
  map: L.Map | null
  zoom: number
  playerId?: string
}

// Specs visuelles par type de bâtiment
const BUILD_SPEC: Record<string, {
  svg: string       // SVG path ou shape (viewBox 0 0 40 40)
  color: string
  label: string
  bgColor: string
  glow: string
}> = {
  fortification: {
    color: '#3B82F6', bgColor: 'rgba(59,130,246,0.2)', glow: '#3B82F6',
    label: 'Fortification',
    svg: `
      <rect x="8" y="18" width="24" height="16" rx="2" stroke="#3B82F6" stroke-width="2" fill="#3B82F6" fill-opacity="0.3"/>
      <rect x="6" y="14" width="6" height="8" rx="1" stroke="#3B82F6" stroke-width="1.5" fill="#3B82F6" fill-opacity="0.4"/>
      <rect x="28" y="14" width="6" height="8" rx="1" stroke="#3B82F6" stroke-width="1.5" fill="#3B82F6" fill-opacity="0.4"/>
      <rect x="17" y="10" width="6" height="8" rx="1" stroke="#3B82F6" stroke-width="1.5" fill="#3B82F6" fill-opacity="0.4"/>
      <path d="M12 18 L20 12 L28 18" stroke="#93C5FD" stroke-width="1.5" fill="none"/>
    `,
  },
  mine: {
    color: '#78716C', bgColor: 'rgba(120,113,108,0.2)', glow: '#A8A29E',
    label: 'Mine',
    svg: `
      <path d="M20 8 L32 28 L8 28 Z" stroke="#A8A29E" stroke-width="2" fill="#78716C" fill-opacity="0.4"/>
      <line x1="20" y1="12" x2="20" y2="28" stroke="#D6D3D1" stroke-width="2"/>
      <line x1="14" y1="20" x2="26" y2="20" stroke="#D6D3D1" stroke-width="2"/>
      <circle cx="20" cy="20" r="3" fill="#FCD34D"/>
      <rect x="17" y="28" width="6" height="5" rx="1" fill="#A8A29E" fill-opacity="0.6"/>
    `,
  },
  data_center: {
    color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.2)', glow: '#8B5CF6',
    label: 'Centre de données',
    svg: `
      <rect x="8" y="10" width="24" height="22" rx="3" stroke="#8B5CF6" stroke-width="2" fill="#8B5CF6" fill-opacity="0.2"/>
      <line x1="8" y1="16" x2="32" y2="16" stroke="#C4B5FD" stroke-width="1"/>
      <line x1="8" y1="22" x2="32" y2="22" stroke="#C4B5FD" stroke-width="1"/>
      <line x1="8" y1="28" x2="32" y2="28" stroke="#C4B5FD" stroke-width="1"/>
      <rect x="11" y="13" width="4" height="2" rx="1" fill="#C4B5FD"/>
      <circle cx="29" cy="14" r="2" fill="#10B981"/>
      <circle cx="24" cy="14" r="2" fill="#F59E0B"/>
      <!-- Antenne *)
      <line x1="20" y1="10" x2="20" y2="5" stroke="#8B5CF6" stroke-width="2"/>
      <circle cx="20" cy="4" r="2" fill="#8B5CF6"/>
    `,
  },
  refinery: {
    color: '#F59E0B', bgColor: 'rgba(245,158,11,0.2)', glow: '#F59E0B',
    label: 'Raffinerie',
    svg: `
      <rect x="10" y="20" width="20" height="14" rx="2" stroke="#F59E0B" stroke-width="2" fill="#F59E0B" fill-opacity="0.3"/>
      <rect x="14" y="12" width="5" height="12" rx="1" stroke="#FCD34D" stroke-width="1.5" fill="#F59E0B" fill-opacity="0.4"/>
      <rect x="21" y="14" width="4" height="10" rx="1" stroke="#FCD34D" stroke-width="1.5" fill="#F59E0B" fill-opacity="0.4"/>
      <!-- Flamme *)
      <path d="M16 8 C16 6 18 5 16.5 3 C18 5 20 4 18 7 C19 5 21 5 20 3 C22 6 20 9 19 12 L14 12 C13 9 15 8 16 8Z"
        fill="#EF4444" fill-opacity="0.8"/>
      <path d="M22 10 C22 8.5 23.5 8 23 6 C24 7.5 25 7 24 9.5 C24.5 8 26 8 25 6.5 C26 8.5 24.5 11 24 13 L21 13 C20.5 10.5 21.5 10 22 10Z"
        fill="#F59E0B" fill-opacity="0.9"/>
    `,
  },
  control_tower: {
    color: '#FFD700', bgColor: 'rgba(255,215,0,0.2)', glow: '#FFD700',
    label: 'Tour de contrôle',
    svg: `
      <!-- Tour *)
      <polygon points="20,4 26,18 22,18 22,32 18,32 18,18 14,18" stroke="#FFD700" stroke-width="1.5" fill="#FFD700" fill-opacity="0.35"/>
      <!-- Radar dish *)
      <ellipse cx="20" cy="18" rx="8" ry="4" stroke="#FCD34D" stroke-width="1.5" fill="none"/>
      <line x1="20" y1="14" x2="20" y2="18" stroke="#FCD34D" stroke-width="1.5"/>
      <!-- Antennes *)
      <line x1="16" y1="10" x2="12" y2="6" stroke="#FFD700" stroke-width="1.5"/>
      <line x1="24" y1="10" x2="28" y2="6" stroke="#FFD700" stroke-width="1.5"/>
      <circle cx="12" cy="6" r="2" fill="#FFD700"/>
      <circle cx="28" cy="6" r="2" fill="#FFD700"/>
    `,
  },
  reactor: {
    color: '#10B981', bgColor: 'rgba(16,185,129,0.2)', glow: '#10B981',
    label: 'Réacteur nucléaire',
    svg: `
      <!-- Dôme *)
      <ellipse cx="20" cy="22" rx="14" ry="12" stroke="#10B981" stroke-width="2" fill="#10B981" fill-opacity="0.2"/>
      <ellipse cx="20" cy="18" rx="10" ry="7" stroke="#34D399" stroke-width="1.5" fill="#10B981" fill-opacity="0.15"/>
      <!-- Symbole radioactif *)
      <circle cx="20" cy="20" r="3" stroke="#34D399" stroke-width="2" fill="none"/>
      <path d="M20 17 L14 9" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M20 17 L26 9" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M17 22 L11 30" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Cheminées *)
      <rect x="8" y="6" width="5" height="16" rx="2" fill="#6B7280" fill-opacity="0.8"/>
      <rect x="27" y="6" width="5" height="16" rx="2" fill="#6B7280" fill-opacity="0.8"/>
      <!-- Vapeur *)
      <path d="M10 5 C9 3 11 1 10 0" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M29 5 C28 3 30 1 29 0" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none" stroke-linecap="round"/>
    `,
  },
  spatial_port: {
    color: '#EC4899', bgColor: 'rgba(236,72,153,0.2)', glow: '#EC4899',
    label: 'Port spatial',
    svg: `
      <!-- Rampe de lancement *)
      <rect x="16" y="20" width="8" height="14" rx="2" stroke="#EC4899" stroke-width="1.5" fill="#EC4899" fill-opacity="0.3"/>
      <!-- Fusée *)
      <path d="M20 4 L24 18 L16 18 Z" stroke="#F9A8D4" stroke-width="1.5" fill="#EC4899" fill-opacity="0.6"/>
      <rect x="17" y="14" width="6" height="6" fill="#EC4899" fill-opacity="0.5"/>
      <!-- Ailettes *)
      <path d="M16 16 L12 22 L16 20 Z" fill="#EC4899" fill-opacity="0.7"/>
      <path d="M24 16 L28 22 L24 20 Z" fill="#EC4899" fill-opacity="0.7"/>
      <!-- Flammes *)
      <path d="M17 20 C16 23 18 26 17 28" stroke="#FF6B00" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 20 C19.5 24 21 27 20 30" stroke="#FCD34D" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M23 20 C24 23 22 26 23 28" stroke="#FF6B00" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  farm: {
    color: '#10B981', bgColor: 'rgba(16,185,129,0.15)', glow: '#10B981',
    label: 'Ferme intensive',
    svg: `
      <!-- Grange *)
      <path d="M8 30 L8 18 L20 10 L32 18 L32 30 Z" stroke="#10B981" stroke-width="1.5" fill="#10B981" fill-opacity="0.25"/>
      <rect x="12" y="22" width="6" height="8" rx="1" fill="#6B7280" fill-opacity="0.6"/>
      <rect x="22" y="20" width="7" height="10" rx="1" fill="#10B981" fill-opacity="0.4"/>
      <!-- Silo *)
      <ellipse cx="26" cy="20" rx="3.5" ry="1.5" stroke="#34D399" stroke-width="1" fill="none"/>
      <!-- Épis de blé *)
      <line x1="6" y1="30" x2="6" y2="20" stroke="#F59E0B" stroke-width="2"/>
      <ellipse cx="6" cy="19" rx="2" ry="4" fill="#F59E0B" fill-opacity="0.8"/>
    `,
  },
}

function makeBuildIcon(type: string, level: number, size: number): L.DivIcon {
  const spec = BUILD_SPEC[type] || BUILD_SPEC.fortification
  const glowAnim = `@keyframes buildGlow{0%,100%{filter:drop-shadow(0 0 4px ${spec.glow}88)}50%{filter:drop-shadow(0 0 10px ${spec.glow}cc)}}`

  return L.divIcon({
    html: `
      <style>${glowAnim}</style>
      <div style="
        position:relative;
        width:${size}px; height:${size}px;
        background:${spec.bgColor};
        border:1.5px solid ${spec.color}88;
        border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        animation:buildGlow 3s ease-in-out infinite;
        backdrop-filter:blur(2px);
      ">
        <svg viewBox="0 0 40 40" width="${size-6}" height="${size-6}" xmlns="http://www.w3.org/2000/svg">
          ${spec.svg}
        </svg>
        ${level > 1 ? `
          <div style="
            position:absolute; bottom:-2px; right:-2px;
            background:${spec.color}; color:#000; border-radius:4px;
            font-size:8px; font-weight:900; padding:1px 4px;
            line-height:1.2;
          ">Lv${level}</div>
        ` : ''}
      </div>
    `,
    className: 'td-building-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function BuildingsOverlayLayer({ map, zoom, playerId }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)

  const { data } = useQuery<{ territories: any[] }>({
    queryKey: ['my-territories-buildings', playerId],
    queryFn: () => api.get('/territories-geo/mine/').then(r => r.data),
    staleTime: 60000,
    enabled: !!map && !!playerId,
  })

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()

    if (!data?.territories || zoom < 12) return  // pas visible avant zoom 12

    const iconSize = zoom >= 16 ? 44 : zoom >= 14 ? 36 : 28

    data.territories.forEach((t: any) => {
      const buildings: Building[] = t.buildings || []
      if (!buildings.length) return

      let lat: number, lon: number
      try {
        const [la, lo] = cellToLatLng(t.h3_index)
        lat = la; lon = lo
      } catch {
        lat = t.center_lat; lon = t.center_lon
      }
      if (!lat || !lon) return

      // Positions décalées si plusieurs buildings (disposition en couronne)
      const offsets = buildings.length === 1
        ? [[0, 0]]
        : buildings.map((_, i) => {
            const angle = (i / buildings.length) * Math.PI * 2 - Math.PI / 2
            const d = 0.00025
            return [Math.cos(angle) * d, Math.sin(angle) * d]
          })

      buildings.forEach((b, i) => {
        const [dlat, dlon] = offsets[i] || [0, 0]
        const spec = BUILD_SPEC[b.building_type]
        if (!spec) return

        const icon = makeBuildIcon(b.building_type, b.level, iconSize)
        const marker = L.marker([lat + dlat, lon + dlon], {
          icon,
          zIndexOffset: 700,
          interactive: true,
        })

        marker.bindTooltip(
          `<div style="font-size:12px">
            <strong style="color:${spec.color}">${spec.label}</strong>
            ${b.level > 1 ? `<span style="color:#6B7280"> Niv.${b.level}</span>` : ''}
          </div>`,
          { className: 'td-tooltip', direction: 'top', offset: [0, -iconSize / 2] }
        )

        layer.addLayer(marker)
      })
    })

    return () => { layer.clearLayers() }
  }, [map, data, zoom])

  useEffect(() => () => { layerRef.current?.remove() }, [])
  return null
}
