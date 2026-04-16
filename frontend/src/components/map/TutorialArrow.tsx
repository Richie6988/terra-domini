/**
 * TutorialArrow — flèche verte pulsante "TON PREMIER TERRITOIRE →"
 * Affichée pendant l'étape tutorial "Revendique ta première zone".
 * S'auto-positionne vers un POI libre à proximité du joueur.
 * Disparaît quand hexod:tutorial:hide-arrow est dispatché.
 */
import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { latLngToCell, cellToLatLng, cellToBoundary, gridDisk } from 'h3-js'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props { map: L.Map | null }

export function TutorialArrow({ map }: Props) {
  const [active, setActive] = useState(false)
  const [playerPos, setPlayerPos] = useState<[number, number] | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Écouter les events tutorial
  useEffect(() => {
    const show = (e: Event) => {
      const { lat, lon } = (e as CustomEvent).detail
      setPlayerPos([lat, lon])
      setActive(true)
    }
    const hide = () => { setActive(false) }
    window.addEventListener('hexod:tutorial:show-arrow', show)
    window.addEventListener('hexod:tutorial:hide-arrow', hide)
    return () => {
      window.removeEventListener('hexod:tutorial:show-arrow', show)
      window.removeEventListener('hexod:tutorial:hide-arrow', hide)
    }
  }, [])

  // Requête territoires proches pour trouver un POI libre
  const { data } = useQuery({
    queryKey: ['tutorial-nearby', playerPos],
    queryFn: async () => {
      if (!playerPos) return null
      const [lat, lon] = playerPos
      return api.get(`/territories/map-view/?lat=${lat}&lon=${lon}&radius_km=20&zoom=13`)
        .then(r => r.data)
    },
    enabled: active && !!playerPos,
    staleTime: 60000,
  })

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)
    const layer = layerRef.current
    layer.clearLayers()

    if (!active || !playerPos || !data) return

    // Trouver le meilleur POI libre proche : priorité rarity desc
    const RANK: Record<string, number> = { mythic: 5, legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0 }
    const free = (data as any[])
      .filter((t: any) => !t.owner_id && (t.poi_name || t.is_landmark))
      .sort((a: any, b: any) => (RANK[b.rarity || 'common'] || 0) - (RANK[a.rarity || 'common'] || 0))

    const target = free[0]
    if (!target) return

    const tLat = target.center_lat
    const tLon = target.center_lon
    if (!tLat || !tLon) return

    // Fly to target
    map.flyTo([tLat, tLon], 14, { duration: 1.5 })

    // Pulse hex cible
    try {
      const boundary = cellToBoundary(target.h3) || cellToBoundary(target.h3_index)
      const pulse = L.polygon(boundary as any, {
        fillColor: '#00FF87',
        fillOpacity: 0.25,
        color: '#00FF87',
        weight: 4,
        className: 'td-tutorial-pulse',
      })
      layer.addLayer(pulse)
    } catch {}

    // Flèche + label "TON PREMIER TERRITOIRE GRATUIT"
    const icon = L.divIcon({
      html: `
        <style>
          @keyframes tutBounce {
            0%,100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-8px) scale(1.1); }
          }
          @keyframes tutPulseRing {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          .tut-arrow-wrap { animation: tutBounce 1.2s ease-in-out infinite; }
          .tut-ring {
            position: absolute; inset: -6px;
            border: 2px solid #00FF87; border-radius: 50%;
            animation: tutPulseRing 1.5s ease-out infinite;
          }
          .tut-ring2 { animation-delay: 0.5s; }
        </style>
        <div class="tut-arrow-wrap" style="
          position: relative;
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; cursor: pointer;
        ">
          <div style="
            background: rgba(235,242,250,0.97);
            border: 1.5px solid #00FF87;
            border-radius: 10px;
            padding: 5px 10px;
            font-size: 11px; font-weight: 800;
            color: #00FF87;
            white-space: nowrap;
            font-family: system-ui;
            box-shadow: 0 0 12px rgba(0,255,135,0.4);
          "><EmojiIcon emoji="🏴" /> GRATUIT — Revendique ici !</div>
          <div style="position: relative; width: 32px; height: 32px;">
            <div class="tut-ring"></div>
            <div class="tut-ring tut-ring2"></div>
            <div style="
              width: 32px; height: 32px;
              background: #00FF87;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 16px;
              box-shadow: 0 0 16px rgba(0,255,135,0.6);
            ">⬇</div>
          </div>
        </div>
      `,
      className: '',
      iconSize: [160, 70],
      iconAnchor: [80, 70],
    })

    const marker = L.marker([tLat, tLon], { icon, zIndexOffset: 9999, interactive: true })
    marker.on('click', () => {
      map.flyTo([tLat, tLon], 16, { duration: 0.8 })
    })
    layer.addLayer(marker)

    return () => { layer.clearLayers() }
  }, [map, active, playerPos, data])

  useEffect(() => () => { layerRef.current?.remove() }, [])
  return null
}
