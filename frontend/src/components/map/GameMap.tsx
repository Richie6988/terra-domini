/**
 * GameMap — core Leaflet map with H3 hex overlay.
 * Territory hexagons rendered as GeoJSON with color coding by owner/type.
 * Viewport changes trigger WebSocket update requests.
 */
import { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cellToBoundary, latLngToCell } from 'h3-js'
import { useStore, useMyTerritories } from '../../store'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

// Territory color coding
const TERRITORY_COLORS = {
  urban:      { fill: '#3B82F6', stroke: '#1D4ED8' },
  rural:      { fill: '#22C55E', stroke: '#15803D' },
  industrial: { fill: '#F59E0B', stroke: '#B45309' },
  coastal:    { fill: '#06B6D4', stroke: '#0E7490' },
  landmark:   { fill: '#8B5CF6', stroke: '#6D28D9' },
  mountain:   { fill: '#78716C', stroke: '#57534E' },
  forest:     { fill: '#166534', stroke: '#14532D' },
  water:      { fill: '#BFDBFE', stroke: '#93C5FD' },
}

const OWNER_COLORS = {
  mine:     { fill: '#10B981', stroke: '#059669', opacity: 0.7 },
  allied:   { fill: '#6366F1', stroke: '#4338CA', opacity: 0.6 },
  enemy:    { fill: '#EF4444', stroke: '#B91C1C', opacity: 0.6 },
  neutral:  { fill: '#6B7280', stroke: '#4B5563', opacity: 0.3 },
  unclaimed:{ fill: '#D1D5DB', stroke: '#9CA3AF', opacity: 0.15 },
}

function getTerritoryStyle(t: TerritoryLight, myId: string | null, myAllianceId: string | null) {
  let colorSet

  if (!t.owner_id) {
    colorSet = OWNER_COLORS.unclaimed
  } else if (t.owner_id === myId) {
    colorSet = OWNER_COLORS.mine
  } else if (myAllianceId && t.alliance_id === myAllianceId) {
    colorSet = OWNER_COLORS.allied
  } else {
    colorSet = OWNER_COLORS.enemy
  }

  const base = TERRITORY_COLORS[t.type] || TERRITORY_COLORS.rural

  return {
    fillColor: colorSet.fill,
    color: colorSet.stroke,
    weight: t.is_under_attack ? 2.5 : 0.8,
    fillOpacity: colorSet.opacity,
    opacity: 0.9,
    // Pulse effect for under-attack territories via className
    className: t.is_under_attack ? 'hex-under-attack' : '',
  }
}

function h3ToGeoJSON(h3Index: string): GeoJSON.Feature<GeoJSON.Polygon> {
  const boundary = cellToBoundary(h3Index, true)  // true = GeoJSON lat/lon order
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[...boundary, boundary[0]]]  // close polygon
    },
    properties: { h3: h3Index }
  }
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const viewportTimer = useRef<ReturnType<typeof setTimeout>>()

  const territories = useStore((s) => s.territories)
  const mapCenter = useStore((s) => s.mapCenter)
  const mapZoom = useStore((s) => s.mapZoom)
  const setMapCenter = useStore((s) => s.setMapCenter)
  const player = useStore((s) => s.player)

  const myAllianceId = player?.alliance?.id ?? null

  // ─── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: false,
      attributionControl: true,
    })

    // Base tile layer — OSM with dark styling via CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    // Satellite layer (togglable)
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 19, opacity: 0 }
    ).addTo(map)

    // H3 hex layer
    const hexLayer = L.geoJSON(undefined, {
      style: () => ({ fillColor: '#gray', color: '#666', weight: 0.5 }),
      onEachFeature: (feature, layer) => {
        const h3Idx = feature.properties?.h3
        if (!h3Idx) return
        layer.on({
          click: () => onTerritoryClick(h3Idx),
          mouseover: (e) => {
            const l = e.target as L.Path
            l.setStyle({ weight: 2, fillOpacity: Math.min(0.9, (l.options.fillOpacity ?? 0.5) + 0.2) })
            useStore.getState().setHoveredH3(h3Idx)
          },
          mouseout: (e) => {
            hexLayer.resetStyle(e.target)
            useStore.getState().setHoveredH3(null)
          },
        })
      },
    }).addTo(map)

    layerRef.current = hexLayer
    mapRef.current = map

    // Viewport change handler (debounced)
    const handleMoveEnd = () => {
      clearTimeout(viewportTimer.current)
      viewportTimer.current = setTimeout(() => {
        const center = map.getCenter()
        const bounds = map.getBounds()
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        const radiusKm = Math.min(
          map.distance(center, L.latLng(ne.lat, ne.lng)) / 1000,
          25  // Cap at 25km
        )
        setMapCenter([center.lat, center.lng], map.getZoom())
        onViewportChange(center.lat, center.lng, radiusKm)
      }, 300)
    }

    map.on('moveend', handleMoveEnd)
    map.on('zoomend', handleMoveEnd)

    // Initial viewport request
    handleMoveEnd()

    // Zoom controls
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    return () => {
      clearTimeout(viewportTimer.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ─── Update hex layer when territories change ──────────────────────────────
  useEffect(() => {
    const layer = layerRef.current
    const map = mapRef.current
    if (!layer || !map) return

    // Only update visible territories
    const bounds = map.getBounds()
    const visibleTerritories = Object.values(territories).filter(t => {
      // Quick check: is hex center in bounds?
      // For full accuracy would use h3 center point
      return true  // Layer handles clipping
    })

    layer.clearLayers()

    for (const t of visibleTerritories) {
      try {
        const feature = h3ToGeoJSON(t.h3)
        const style = getTerritoryStyle(t, player?.id ?? null, myAllianceId)
        layer.addData(feature)
        // Apply style to the last added layer
        const layers = layer.getLayers()
        const last = layers[layers.length - 1] as L.Path
        if (last) {
          last.setStyle(style)
          // Tooltip
          last.bindTooltip(
            `<div class="hex-tooltip">
              <strong>${t.owner_username ?? 'Unclaimed'}</strong>
              <span>${t.type}</span>
              ${t.is_under_attack ? '<span class="attack-indicator">⚔️ Under Attack</span>' : ''}
              ${t.is_control_tower ? '<span class="tower-indicator">🗼 Tower</span>' : ''}
            </div>`,
            { permanent: false, sticky: true, className: 'hex-tooltip-container' }
          )
        }
      } catch {
        // Invalid h3 index — skip
      }
    }
  }, [territories, player?.id, myAllianceId])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
      />
      {/* CSS for attack pulse animation */}
      <style>{`
        .hex-under-attack {
          animation: attackPulse 1s ease-in-out infinite alternate;
        }
        @keyframes attackPulse {
          from { opacity: 0.6; }
          to   { opacity: 1.0; }
        }
        .hex-tooltip-container {
          background: rgba(0,0,0,0.85);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          padding: 6px 10px;
          color: #fff;
          font-size: 12px;
          pointer-events: none;
        }
        .hex-tooltip strong { display: block; font-size: 13px; margin-bottom: 2px; }
        .hex-tooltip span { display: block; color: #aaa; }
        .attack-indicator { color: #EF4444 !important; }
        .tower-indicator { color: #8B5CF6 !important; }
      `}</style>
    </div>
  )
}
