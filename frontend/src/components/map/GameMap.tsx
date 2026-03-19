/**
 * GameMap — Leaflet + H3 hex overlay.
 * H3 boundaries computed client-side with h3-js.
 * No boundary_points needed from server.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as h3 from 'h3-js'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { FavoritePinsPanel } from './FavoritePins'
import { ClaimModal } from './ClaimModal'
import { AttackPanel } from '../hud/AttackPanel'
import type { TerritoryLight } from '../../types'

interface Props {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

const TILES = {
  dark:      { label: '🌑 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  satellite: { label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  topo:      { label: '🗺️ Topo',      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
}

function hexColor(t: TerritoryLight, myId?: string): [string, string, number] {
  // [fill, stroke, weight]
  if (!t.owner_id) return ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 1]
  if (t.owner_id === myId) return ['rgba(0,255,135,0.28)', 'rgba(0,255,135,0.9)', 2]
  if (t.is_control_tower) return ['rgba(255,184,0,0.35)', 'rgba(255,184,0,1)', 2]
  return ['rgba(99,145,255,0.22)', 'rgba(99,145,255,0.7)', 1]
}

function h3Boundary(h3Index: string): L.LatLngTuple[] | null {
  try {
    const boundary = h3.cellToBoundary(h3Index)
    return boundary.map(([lat, lng]) => [lat, lng] as L.LatLngTuple)
  } catch {
    return null
  }
}

export function GameMap({ onViewportChange, onTerritoryClick }: Props) {
  const mapRef       = useRef<L.Map | null>(null)
  const tileRef      = useRef<L.TileLayer | null>(null)
  const hexRef       = useRef<L.LayerGroup | null>(null)
  const vtRef        = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tileStyle, setTileStyle] = useState<keyof typeof TILES>('dark')
  const [showHex,   setShowHex]   = useState(true)
  const [zoom,      setZoom]      = useState(13)
  const [center,    setCenter]    = useState<[number, number]>([48.8566, 2.3522])
  const [claimTgt,  setClaimTgt]  = useState<TerritoryLight | null>(null)
  const [attackTgt, setAttackTgt] = useState<TerritoryLight | null>(null)

  const territoriesMap = useStore(s => s.territories)
  const territories    = Object.values(territoriesMap)
  const player         = useStore(s => s.player)
  const storeSetCenter = useStore(s => s.setMapCenter)
  const isFirstClaim   = !player?.stats?.territories_owned

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], zoom: 13,
      zoomControl: false, attributionControl: false,
    })

    tileRef.current = L.tileLayer(TILES.dark.url, { maxZoom: 19 }).addTo(map)
    hexRef.current  = L.layerGroup().addTo(map)
    mapRef.current  = map

    const onMove = () => {
      clearTimeout(vtRef.current)
      vtRef.current = setTimeout(() => {
        const c = map.getCenter()
        const b = map.getBounds()
        const r = Math.min(map.distance(c, b.getNorthEast()) / 1000, 25)
        const z = map.getZoom()
        setZoom(z); setCenter([c.lat, c.lng])
        storeSetCenter([c.lat, c.lng], z)
        onViewportChange(c.lat, c.lng, r)
      }, 350)
    }

    map.on('moveend zoomend', onMove)
    onMove()

    // Server-side IP geolocation
    fetch('/api/geoip/')
      .then(r => r.json())
      .then(d => { if (d.lat && d.lon) map.setView([d.lat, d.lon], 13) })
      .catch(() => {
        navigator.geolocation?.getCurrentPosition(
          p => map.setView([p.coords.latitude, p.coords.longitude], 14), () => {}
        )
      })

    return () => { clearTimeout(vtRef.current); map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  // ── Tile switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(TILES[tileStyle].url, { maxZoom: 19 }).addTo(map)
  }, [tileStyle])

  // ── Draw hexes ───────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexRef.current; if (!layer) return
    layer.clearLayers()
    if (!showHex) return

    territories.forEach(t => {
      // Compute boundary using h3-js (no server boundary_points needed)
      const latlngs = h3Boundary(t.h3_index)
      if (!latlngs) return

      const [fill, stroke, weight] = hexColor(t, player?.id)

      const poly = L.polygon(latlngs, {
        fillColor: fill, fillOpacity: 1,
        color: stroke, weight, opacity: 1,
        interactive: true,
      })

      // Tooltip
      const owned = t.owner_id
        ? (t.owner_id === player?.id ? '🟢 Yours' : `👤 ${t.owner_username}`)
        : '⬜ Tap to claim'

      poly.bindTooltip(`
        <div style="font-size:11px;line-height:1.7;min-width:140px">
          <b style="color:#fff">${t.place_name || t.h3_index.slice(0,10)}</b><br>
          <span style="color:#9CA3AF">${owned}</span>
          ${t.is_control_tower ? '<br><span style="color:#FFB800">🗼 Control Tower</span>' : ''}
          ${t.defense_points ? `<br><span style="color:#6B7280">DEF ${Math.round(t.defense_points)}</span>` : ''}
        </div>
      `, { className: 'td-tip', direction: 'top', sticky: true })

      poly.on('click', () => {
        onTerritoryClick(t.h3_index)
        if (!t.owner_id) {
          setClaimTgt(t)
        } else if (t.owner_id !== player?.id) {
          setAttackTgt(t)
        }
      })

      layer.addLayer(poly)
    })
  }, [territories.length, showHex, player?.id, tileStyle]) // eslint-disable-line

  const doZoom     = useCallback((d: number) => mapRef.current?.setZoom((mapRef.current.getZoom()) + d), [])
  const navigateTo = useCallback((lat: number, lon: number, z: number) => mapRef.current?.setView([lat, lon], z), [])
  const geoLocate  = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(p => mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15))
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <style>{`
        .td-tip{background:rgba(5,5,15,0.95)!important;border:1px solid rgba(255,255,255,0.12)!important;border-radius:10px!important;color:#fff!important;padding:8px 12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.6)!important}
        .td-tip::before{display:none!important}
        .leaflet-container{cursor:crosshair}
        .leaflet-attribution-flag{display:none}
      `}</style>

      {/* Layer controls */}
      <div style={{ position: 'absolute', top: 70, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {(Object.entries(TILES) as any[]).map(([k, v]) => (
            <button key={k} onClick={() => setTileStyle(k)} style={{
              display: 'block', width: '100%', padding: '8px 12px', background: tileStyle === k ? 'rgba(0,255,135,0.12)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: tileStyle === k ? '#00FF87' : '#9CA3AF', fontSize: 11, cursor: 'pointer', textAlign: 'left',
            }}>{v.label}</button>
          ))}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.88)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <ToggleBtn label="⬡ Zones" active={showHex} onClick={() => setShowHex(v => !v)} />
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 90, right: 12, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MapBtn onClick={() => doZoom(1)}>+</MapBtn>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#4B5563', fontFamily: 'monospace' }}>z{zoom}</div>
        <MapBtn onClick={() => doZoom(-1)}>−</MapBtn>
        <div style={{ height: 4 }} />
        <MapBtn onClick={geoLocate} style={{ fontSize: 14 }}>📍</MapBtn>
      </div>

      {/* Favorite pins */}
      <FavoritePinsPanel onNavigate={navigateTo} currentLat={center[0]} currentLon={center[1]} currentZoom={zoom} />

      {/* Claim modal */}
      <AnimatePresence>
        {claimTgt && <ClaimModal territory={claimTgt} isFree={!!isFirstClaim} onClose={() => setClaimTgt(null)} onClaimed={() => setClaimTgt(null)} />}
      </AnimatePresence>

      {/* Attack panel */}
      <AnimatePresence>
        {attackTgt && <AttackPanel target={attackTgt} onClose={() => setAttackTgt(null)} />}
      </AnimatePresence>
    </div>
  )
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px',
      background: 'transparent', border: 'none', color: active ? '#fff' : '#4B5563', fontSize: 11, cursor: 'pointer',
    }}>
      <span>{label}</span>
      <span style={{ width: 28, height: 16, borderRadius: 8, background: active ? '#00FF87' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', transform: active ? 'translateX(12px)' : 'none', transition: 'transform 0.2s' }} />
      </span>
    </button>
  )
}

function MapBtn({ onClick, children, style: s }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 36, height: 36, borderRadius: 8, background: hover ? 'rgba(0,255,135,0.15)' : 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.12)', color: '#E5E7EB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', ...s }}>
      {children}
    </button>
  )
}
