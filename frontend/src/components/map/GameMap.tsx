/**
 * GameMap — Leaflet + H3 hex overlay with full metadata, layer toggles,
 * favorite pins, claim modal, IP geolocation.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { FavoritePinsPanel } from './FavoritePins'
import { ClaimModal } from './ClaimModal'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

const TILE_LAYERS = {
  dark:      { label: '🌑 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '© CartoDB', maxZoom: 19 },
  satellite: { label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri', maxZoom: 18 },
  topo:      { label: '🗺️ Topo',      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap', maxZoom: 17 },
}

function terColor(t: TerritoryLight, uid?: string) {
  if (!t.owner_id) return ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)']
  if (t.owner_id === uid)  return ['rgba(0,255,135,0.28)', 'rgba(0,255,135,0.8)']
  if (t.is_control_tower)  return ['rgba(255,184,0,0.35)',  'rgba(255,184,0,0.9)']
  return ['rgba(99,145,255,0.22)', 'rgba(99,145,255,0.6)']
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef        = useRef<L.Map | null>(null)
  const tileRef       = useRef<L.TileLayer | null>(null)
  const hexLayerRef   = useRef<L.LayerGroup | null>(null)
  const viewportTimer = useRef<ReturnType<typeof setTimeout>>()
  const containerRef  = useRef<HTMLDivElement>(null)

  const [tileStyle, setTileStyle] = useState<keyof typeof TILE_LAYERS>('dark')
  const [showHex,  setShowHex]    = useState(true)
  const [showGrid, setShowGrid]   = useState(false)
  const [zoom,     setZoom]       = useState(13)
  const [center,   setCenter]     = useState<[number, number]>([48.8566, 2.3522])
  const [claimTarget, setClaimTarget] = useState<TerritoryLight | null>(null)

  const territories  = Object.values(useStore(s => s.territories))
  const player       = useStore(s => s.player)
  const storeSetCenter = useStore(s => s.setMapCenter)

  const isFirstClaim = !player?.stats?.territories_owned || player.stats.territories_owned === 0

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], zoom: 13,
      zoomControl: false, attributionControl: false,
    })

    const cfg = TILE_LAYERS[tileStyle]
    tileRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom }).addTo(map)
    hexLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const onMove = () => {
      clearTimeout(viewportTimer.current)
      viewportTimer.current = setTimeout(() => {
        const c = map.getCenter()
        const b = map.getBounds()
        const r = Math.min(map.distance(c, b.getNorthEast()) / 1000, 25)
        const z = map.getZoom()
        setZoom(z)
        setCenter([c.lat, c.lng])
        storeSetCenter([c.lat, c.lng], z)
        onViewportChange(c.lat, c.lng, r)
      }, 300)
    }

    map.on('moveend zoomend', onMove)
    onMove()

    // IP geolocation — server-side proxy, no CORS
    fetch('/api/geoip/')
      .then(r => r.json())
      .then(d => { if (d.lat && d.lon) map.setView([d.lat, d.lon], 13) })
      .catch(() => {
        navigator.geolocation?.getCurrentPosition(
          p => map.setView([p.coords.latitude, p.coords.longitude], 14),
          () => {}
        )
      })

    return () => { clearTimeout(viewportTimer.current); map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  // ── Tile layer switch ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    const cfg = TILE_LAYERS[tileStyle]
    tileRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom }).addTo(map)
  }, [tileStyle])

  // ── Draw territories ─────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!showHex) return

    territories.forEach(t => {
      if (!t.boundary_points?.length) return
      const latlngs = (t.boundary_points as [number,number][]).map(p => [p[0], p[1]] as L.LatLngTuple)
      const [fill, stroke] = terColor(t, player?.id)

      const poly = L.polygon(latlngs, {
        fillColor: fill, fillOpacity: 0.9,
        color: stroke, weight: t.owner_id === player?.id ? 2 : 1, opacity: 1,
      })

      // Rich tooltip with H3 metadata
      const owned   = t.owner_id ? (t.owner_id === player?.id ? '🟢 Yours' : `👤 ${t.owner_username}`) : '⬜ Unclaimed'
      const income  = t.food_per_tick ? `+${t.food_per_tick} food/tick` : ''
      const tower   = t.is_control_tower ? '<div style="color:#FFB800;font-weight:600">🗼 Control Tower</div>' : ''
      const resolution = t.h3_index?.length === 15 ? 'res 10' : 'res ?'

      poly.bindTooltip(`
        <div style="font-size:11px;line-height:1.6;font-family:monospace;min-width:160px">
          <div style="font-weight:700;color:#fff;font-size:12px;margin-bottom:2px">${t.place_name || 'Unnamed zone'}</div>
          <div style="color:#9CA3AF">${owned}</div>
          ${income ? `<div style="color:#10B981">${income}</div>` : ''}
          ${tower}
          <div style="color:#374151;font-size:9px;margin-top:4px">${t.h3_index?.slice(0,8)}… · ${resolution}</div>
        </div>
      `, { className: 'td-tooltip', direction: 'top', sticky: true })

      poly.on('click', () => {
        onTerritoryClick(t.h3_index)
        if (!t.owner_id) {
          setClaimTarget(t)
        }
      })

      layer.addLayer(poly)
    })
  }, [territories, showHex, showGrid, player?.id])

  // ── Zoom + navigate ──────────────────────────────────────────────────────
  const doZoom    = useCallback((d: number) => mapRef.current?.setZoom((mapRef.current.getZoom()) + d), [])
  const navigateTo = useCallback((lat: number, lon: number, z: number) => mapRef.current?.setView([lat, lon], z), [])
  const geoLocate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(p => mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15))
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <style>{`
        .td-tooltip{background:rgba(5,5,15,0.95)!important;border:1px solid rgba(255,255,255,0.12)!important;border-radius:10px!important;color:#fff!important;padding:8px 12px!important;box-shadow:0 4px 24px rgba(0,0,0,0.6)!important;}
        .td-tooltip::before{display:none!important;}
        .leaflet-container{cursor:crosshair;}
        .leaflet-attribution-flag{display:none;}
      `}</style>

      {/* Layer controls — top right */}
      <div style={{ position: 'absolute', top: 70, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tile switcher */}
        <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {(Object.entries(TILE_LAYERS) as [keyof typeof TILE_LAYERS, any][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setTileStyle(key)} style={{
              display: 'block', width: '100%', padding: '8px 12px', background: tileStyle === key ? 'rgba(0,255,135,0.12)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: tileStyle === key ? '#00FF87' : '#9CA3AF', fontSize: 11, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
            }}>{cfg.label}</button>
          ))}
        </div>

        {/* Layer toggles */}
        <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {[
            { label: '⬡ Zones', active: showHex,  toggle: () => setShowHex(v => !v) },
            { label: '⊞ Grid',  active: showGrid, toggle: () => setShowGrid(v => !v) },
          ].map(({ label, active, toggle }) => (
            <button key={label} onClick={toggle} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', gap: 10,
              background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: active ? '#fff' : '#4B5563', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <span>{label}</span>
              <span style={{ width: 28, height: 16, borderRadius: 8, background: active ? '#00FF87' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: 2, transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', transform: active ? 'translateX(12px)' : 'none', transition: 'transform 0.2s' }} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Zoom controls — bottom right */}
      <div style={{ position: 'absolute', bottom: 90, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MapBtn onClick={() => doZoom(1)}>+</MapBtn>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#4B5563', fontFamily: 'monospace', padding: '2px 0' }}>z{zoom}</div>
        <MapBtn onClick={() => doZoom(-1)}>−</MapBtn>
        <div style={{ height: 4 }} />
        <MapBtn onClick={geoLocate} title="My location" style={{ fontSize: 14 }}>📍</MapBtn>
      </div>

      {/* Favorite pins — bottom left */}
      <FavoritePinsPanel
        onNavigate={navigateTo}
        currentLat={center[0]}
        currentLon={center[1]}
        currentZoom={zoom}
      />

      {/* Claim modal */}
      <AnimatePresence>
        {claimTarget && (
          <ClaimModal
            territory={claimTarget}
            isFree={isFirstClaim}
            onClose={() => setClaimTarget(null)}
            onClaimed={() => { setClaimTarget(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MapBtn({ onClick, children, title, style: extra }: { onClick: () => void; children: React.ReactNode; title?: string; style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 36, height: 36, borderRadius: 8, background: hover ? 'rgba(0,255,135,0.15)' : 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.12)', color: '#E5E7EB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, transition: 'background 0.15s', ...extra }}>
      {children}
    </button>
  )
}
