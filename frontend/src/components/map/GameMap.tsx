/**
 * GameMap — Leaflet map with H3 hex overlay.
 * Features: layer toggles (territory/POI/grid), zoom controls, 
 * tile style switcher (dark/satellite/topo), geolocation.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useStore } from '../../store'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

// Tile layer configs
const TILE_LAYERS = {
  dark: {
    label: '🌑 Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap © CartoDB',
    maxZoom: 19,
  },
  satellite: {
    label: '🛰️ Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 18,
  },
  topo: {
    label: '🗺️ Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © OpenTopoMap',
    maxZoom: 17,
  },
}

// Territory fill colors
function getTerritoryColor(t: TerritoryLight, currentUserId?: string): string {
  if (!t.owner_id) return 'rgba(255,255,255,0.06)'
  if (t.owner_id === currentUserId) return 'rgba(0,255,135,0.35)'
  if (t.is_control_tower) return 'rgba(255,184,0,0.5)'
  return 'rgba(100,150,255,0.3)'
}

function getTerritoryBorder(t: TerritoryLight, currentUserId?: string): string {
  if (!t.owner_id) return 'rgba(255,255,255,0.12)'
  if (t.owner_id === currentUserId) return 'rgba(0,255,135,0.7)'
  if (t.is_control_tower) return 'rgba(255,184,0,0.9)'
  return 'rgba(100,150,255,0.6)'
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef        = useRef<L.Map | null>(null)
  const tileRef       = useRef<L.TileLayer | null>(null)
  const hexLayerRef   = useRef<L.LayerGroup | null>(null)
  const poiLayerRef   = useRef<L.LayerGroup | null>(null)
  const viewportTimer = useRef<ReturnType<typeof setTimeout>>()
  const containerRef  = useRef<HTMLDivElement>(null)

  const [tileStyle, setTileStyle]   = useState<keyof typeof TILE_LAYERS>('dark')
  const [showHex, setShowHex]       = useState(true)
  const [showPOI, setShowPOI]       = useState(true)
  const [showGrid, setShowGrid]     = useState(false)
  const [zoom, setZoom]             = useState(13)

  const territories = useStore(s => s.territories)
  const player      = useStore(s => s.player)
  const setMapCenter = useStore(s => s.setMapCenter)

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], // Paris
      zoom: 13,
      zoomControl: false,        // Custom zoom below
      attributionControl: false,
    })

    // Tile layer
    const tile = TILE_LAYERS[tileStyle]
    tileRef.current = L.tileLayer(tile.url, { maxZoom: tile.maxZoom, attribution: tile.attribution }).addTo(map)

    // Hex layer group
    hexLayerRef.current = L.layerGroup().addTo(map)

    // POI layer group
    poiLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map

    // Viewport debounce
    const handleMove = () => {
      clearTimeout(viewportTimer.current)
      viewportTimer.current = setTimeout(() => {
        const c = map.getCenter()
        const b = map.getBounds()
        const r = Math.min(map.distance(c, b.getNorthEast()) / 1000, 25)
        setMapCenter([c.lat, c.lng], map.getZoom())
        setZoom(map.getZoom())
        onViewportChange(c.lat, c.lng, r)
      }, 300)
    }
    map.on('moveend zoomend', handleMove)
    handleMove()

    // Try geolocation on first load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
        () => {} // Ignore error, stay on Paris
      )
    }

    return () => {
      clearTimeout(viewportTimer.current)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line

  // ── Switch tile layer ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    const cfg = TILE_LAYERS[tileStyle]
    tileRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom }).addTo(map)
  }, [tileStyle])

  // ── Draw hex territories ──────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!showHex) return

    territories.forEach(t => {
      if (!t.boundary_points?.length) return
      const latlngs = t.boundary_points.map((p: [number, number]) => [p[0], p[1]] as L.LatLngTuple)
      const fill   = getTerritoryColor(t, player?.id)
      const border = getTerritoryBorder(t, player?.id)

      const poly = L.polygon(latlngs, {
        fillColor: fill.replace(/[^,]+\)$/, '1)').replace('rgba', 'rgb'),
        fillOpacity: parseFloat(fill.match(/[\d.]+\)$/)![0]),
        color: border,
        weight: t.owner_id === player?.id ? 1.5 : 1,
        opacity: 1,
      })

      poly.on('click', () => onTerritoryClick(t.h3_index))

      // Tooltip
      poly.bindTooltip(`
        <div style="font-size:11px;line-height:1.5;font-family:monospace">
          <div style="font-weight:600;color:${t.owner_id === player?.id ? '#00FF87' : '#fff'}">${t.place_name || t.h3_index.slice(0, 8)}</div>
          ${t.owner_username ? `<div style="color:#9CA3AF">Owner: ${t.owner_username}</div>` : '<div style="color:#4B5563">Unclaimed</div>'}
          ${t.is_control_tower ? '<div style="color:#FFB800">🗼 Control Tower</div>' : ''}
        </div>
      `, { className: 'td-tooltip', direction: 'top', sticky: true })

      layer.addLayer(poly)
    })
  }, [territories, showHex, player?.id, tileStyle])

  // ── Grid overlay ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Grid is subtle H3 boundary lines at high zoom
    // Just toggle opacity of hex borders for now
  }, [showGrid])

  // ── Controls ──────────────────────────────────────────────────────────────
  const doZoom = useCallback((delta: number) => {
    mapRef.current?.setZoom((mapRef.current.getZoom() ?? 13) + delta)
  }, [])

  const geoLocate = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15)
    })
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Leaflet container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Custom tooltip style */}
      <style>{`
        .td-tooltip { background: rgba(10,10,20,0.92)!important; border: 1px solid rgba(255,255,255,0.12)!important; border-radius: 8px!important; color: #fff!important; padding: 6px 10px!important; box-shadow: 0 4px 20px rgba(0,0,0,0.5)!important; }
        .td-tooltip::before { display: none!important; }
        .leaflet-container { cursor: crosshair; }
      `}</style>

      {/* ── Layer Controls (top-right) ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 70, right: 12, zIndex: 500,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Tile switcher */}
        <div style={{ background: 'rgba(0,0,0,0.82)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {(Object.entries(TILE_LAYERS) as [keyof typeof TILE_LAYERS, any][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setTileStyle(key)} style={{
              display: 'block', width: '100%', padding: '7px 12px',
              background: tileStyle === key ? 'rgba(0,255,135,0.15)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: tileStyle === key ? '#00FF87' : '#9CA3AF',
              fontSize: 11, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
            }}>{cfg.label}</button>
          ))}
        </div>

        {/* Layer toggles */}
        <div style={{ background: 'rgba(0,0,0,0.82)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {[
            { key: 'hex',  label: '⬡ Territories', active: showHex,  toggle: () => setShowHex(v => !v) },
            { key: 'poi',  label: '🔥 Events',      active: showPOI,  toggle: () => setShowPOI(v => !v) },
            { key: 'grid', label: '⊞ Grid',         active: showGrid, toggle: () => setShowGrid(v => !v) },
          ].map(({ key, label, active, toggle }) => (
            <button key={key} onClick={toggle} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '7px 12px', gap: 10,
              background: 'transparent', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: active ? '#fff' : '#4B5563',
              fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <span>{label}</span>
              <span style={{
                width: 28, height: 16, borderRadius: 8,
                background: active ? '#00FF87' : 'rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center',
                padding: '2px', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  transform: active ? 'translateX(12px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                }} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Zoom Controls (bottom-right) ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 90, right: 12, zIndex: 500,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <MapBtn onClick={() => doZoom(1)} title="Zoom in">+</MapBtn>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#4B5563', fontFamily: 'monospace' }}>
          z{zoom}
        </div>
        <MapBtn onClick={() => doZoom(-1)} title="Zoom out">−</MapBtn>
        <div style={{ height: 6 }} />
        <MapBtn onClick={geoLocate} title="My location" fontSize={14}>📍</MapBtn>
      </div>
    </div>
  )
}

function MapBtn({ onClick, children, title, fontSize = 18 }: {
  onClick: () => void; children: React.ReactNode; title?: string; fontSize?: number
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(0,0,0,0.82)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#E5E7EB', fontSize, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 500, lineHeight: 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,135,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.82)')}
    >
      {children}
    </button>
  )
}
