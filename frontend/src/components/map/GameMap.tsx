/**
 * GameMap — Leaflet map with flashy H3 hex layer.
 * Neon glow styles, bigger hexes via lower H3 resolution,
 * animated towers, IP geolocation, favorite pins, claim/attack modals.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { FavoritePinsPanel } from './FavoritePins'
import { MapOverlayLayer } from './MapOverlayLayer'
import { ResourceLayer } from './ResourceLayer'
import { ClaimModal } from './ClaimModal'
import { AttackPanel } from '../hud/AttackPanel'
import { injectGlowFilter, makeHexPolygon } from './HexLayer'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

const TILES = {
  dark:      { label: '🌑 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', maxZoom: 19 },
  satellite: { label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 18 },
  neon:      { label: '🟣 Neon',      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', maxZoom: 19 },
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef       = useRef<L.Map | null>(null)
  const tileRef      = useRef<L.TileLayer | null>(null)
  const hexRef       = useRef<L.LayerGroup | null>(null)
  const vpTimer      = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tile,        setTile]        = useState<keyof typeof TILES>('dark')
  const [showHex,     setShowHex]     = useState(true)
  const [zoom,        setZoom]        = useState(13)
  const [center,      setCenter]      = useState<[number,number]>([48.8566, 2.3522])
  const [claimTarget, setClaimTarget] = useState<TerritoryLight | null>(null)
  const [attackTarget,setAttackTarget]= useState<TerritoryLight | null>(null)

  const territories   = Object.values(useStore(s => s.territories))
  const player        = useStore(s => s.player)
  const storeSetCenter= useStore(s => s.setMapCenter)
  const isFirstClaim  = !(player?.stats?.territories_owned > 0)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    injectGlowFilter()

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], zoom: 13,
      zoomControl: false, attributionControl: false,
    })
    tileRef.current = L.tileLayer(TILES[tile].url, { maxZoom: TILES[tile].maxZoom }).addTo(map)
    hexRef.current  = L.layerGroup().addTo(map)
    mapRef.current  = map

    const onMove = () => {
      clearTimeout(vpTimer.current)
      vpTimer.current = setTimeout(() => {
        try {
          const c = map.getCenter()
          const b = map.getBounds()
          const r = Math.min(map.distance(c, b.getNorthEast()) / 1000, 25)
          const z = map.getZoom()
          setZoom(z); setCenter([c.lat, c.lng])
          storeSetCenter([c.lat, c.lng], z)
          onViewportChange(c.lat, c.lng, r)
        } catch (_) {
          // Map not ready yet — will retry on next move event
        }
      }, 300)
    }
    map.on('moveend zoomend', onMove)
    // Defer first call until map pane is initialized
    setTimeout(onMove, 100)

    // Server-side IP geolocation
    fetch('/api/geoip/').then(r=>r.json())
      .then(d => { if (d.lat && d.lon) map.setView([d.lat, d.lon], 13) })
      .catch(() => navigator.geolocation?.getCurrentPosition(
        p => map.setView([p.coords.latitude, p.coords.longitude], 14), () => {}
      ))

    return () => { clearTimeout(vpTimer.current); map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  // ── Tile switch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(TILES[tile].url, { maxZoom: TILES[tile].maxZoom }).addTo(map)
  }, [tile])

  // ── Draw hexes ────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexRef.current; if (!layer) return
    layer.clearLayers()
    if (!showHex) return

    territories.forEach(t => {
      const poly = makeHexPolygon({
        territory: t, playerId: player?.id,
        onClick: (ter) => {
          onTerritoryClick(ter.h3_index)
          if (!ter.owner_id) setClaimTarget(ter)
          else if (ter.owner_id !== player?.id) setAttackTarget(ter)
        }
      })
      if (poly) layer.addLayer(poly)
    })
  }, [territories, showHex, player?.id])

  const doZoom     = useCallback((d: number) => mapRef.current?.setZoom((mapRef.current.getZoom()) + d), [])
  const navigateTo = useCallback((lat: number, lon: number, z: number) => mapRef.current?.setView([lat, lon], z), [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Global styles */}
      <style>{`
        .td-tooltip{background:rgba(5,5,15,0.97)!important;border:1px solid rgba(255,255,255,0.15)!important;border-radius:10px!important;color:#fff!important;padding:8px 12px!important;box-shadow:0 4px 32px rgba(0,0,0,0.7)!important;}
        .td-tooltip::before{display:none!important;}
        .leaflet-container{cursor:crosshair;background:#080810;}
        /* Neon glow via CSS filter — works on SVG paths */
        .td-hex-own path{filter:drop-shadow(0 0 6px rgba(0,255,135,0.8))!important;}
        .td-hex-tower path{filter:drop-shadow(0 0 8px rgba(255,184,0,0.9))!important;animation:td-pulse 2s ease-in-out infinite;}
        .td-hex-enemy path{filter:drop-shadow(0 0 4px rgba(99,145,255,0.6))!important;}
        .td-hex-free path{opacity:0.7;}
        @keyframes td-pulse{0%,100%{filter:drop-shadow(0 0 8px rgba(255,184,0,0.9));}50%{filter:drop-shadow(0 0 16px rgba(255,184,0,1.0));}}
        .leaflet-attribution-flag{display:none!important;}
      `}</style>

      {/* Layer controls — top right */}
      <div style={{ position:'absolute', top:70, right:12, zIndex:500, display:'flex', flexDirection:'column', gap:6 }}>
        {/* Tile switcher */}
        <div style={{ background:'rgba(0,0,0,0.88)', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
          {(Object.entries(TILES) as any[]).map(([key, cfg]) => (
            <button key={key} onClick={() => setTile(key)} style={{
              display:'block', width:'100%', padding:'8px 12px',
              background: tile===key ? 'rgba(0,255,135,0.12)' : 'transparent',
              border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)',
              color: tile===key ? '#00FF87' : '#9CA3AF', fontSize:11, cursor:'pointer', textAlign:'left',
            }}>{cfg.label}</button>
          ))}
        </div>
        {/* Toggle */}
        <ToggleBtn label="⬡ Zones" active={showHex} onClick={() => setShowHex(v=>!v)} />
      </div>

      {/* Zoom — bottom right */}
      <div style={{ position:'absolute', bottom:90, right:12, zIndex:500, display:'flex', flexDirection:'column', gap:4 }}>
        <MapBtn onClick={() => doZoom(1)}>+</MapBtn>
        <div style={{ textAlign:'center', fontSize:9, color:'#4B5563', fontFamily:'monospace' }}>z{zoom}</div>
        <MapBtn onClick={() => doZoom(-1)}>−</MapBtn>
        <div style={{ height:4 }} />
        <MapBtn onClick={() => navigator.geolocation?.getCurrentPosition(p => mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15))}>📍</MapBtn>
      </div>

      {/* Favorite pins — bottom left */}
      {showOverlay && <MapOverlayLayer map={mapRef.current} />}
      <ResourceLayer map={mapRef.current} viewportLat={center[0]} viewportLon={center[1]} viewportRadius={zoom < 8 ? 200 : zoom < 11 ? 100 : 50} visible={showResources} />
      <FavoritePinsPanel onNavigate={navigateTo} currentLat={center[0]} currentLon={center[1]} currentZoom={zoom} />

      {/* Modals */}
      <AnimatePresence>
        {attackTarget && <AttackPanel target={attackTarget} onClose={() => setAttackTarget(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {claimTarget && <ClaimModal territory={claimTarget} isFree={isFirstClaim} onClose={() => setClaimTarget(null)} onClaimed={() => setClaimTarget(null)} />}
      </AnimatePresence>
    </div>
  )
}

function MapBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:36, height:36, borderRadius:8, background: h ? 'rgba(0,255,135,0.15)' : 'rgba(0,0,0,0.88)', border:'1px solid rgba(255,255,255,0.12)', color:'#E5E7EB', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}>
      {children}
    </button>
  )
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', gap:10, background:'rgba(0,0,0,0.88)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color: active ? '#fff' : '#4B5563', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
      <span>{label}</span>
      <span style={{ width:28, height:16, borderRadius:8, background: active ? '#00FF87' : 'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', padding:2, transition:'background 0.2s', flexShrink:0 }}>
        <span style={{ width:12, height:12, borderRadius:'50%', background:'#fff', transform: active ? 'translateX(12px)' : 'none', transition:'transform 0.2s' }} />
      </span>
    </button>
  )
}
