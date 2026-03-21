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
import { HexCard } from './HexCard'
import { AttackPanel } from '../hud/AttackPanel'
import { ClaimModal } from './ClaimModal'
import { HexodBottomBar } from '../hud/HexodBottomBar'
import { injectGlowFilter, makeHexPolygon, injectHexAnimations } from './HexLayer'
import { POIHexLayer } from './POIHexLayer'
import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

const TILES = {
  dark:      {
    label: '🌑 Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
  },
  satellite: {
    label: '🛰️ Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 18,
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  topo: {
    label: '🗺️ Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
  },
  terrain: {
    label: '🏔️ Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef       = useRef<L.Map | null>(null)
  const tileRef      = useRef<L.TileLayer | null>(null)
  const hexRef       = useRef<L.LayerGroup | null>(null)
  const overlayRef   = useRef<L.TileLayer | null>(null)
  const vpTimer      = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tile,        setTile]        = useState<keyof typeof TILES>('dark')
  const [showHex,     setShowHex]     = useState(true)
  const [showOverlay,  setShowOverlay]  = useState(true)
  const [showGrid,     setShowGrid]     = useState(false)
  const [zoom,        setZoom]        = useState(13)
  const [center,      setCenter]      = useState<[number,number]>([48.8566, 2.3522])
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [selectedTerritory, setSelectedTerritoryState] = useState<any | null>(null)
  const selectedHexRef = useRef<string | null>(null)
  const [selectedHexLatLon, setSelectedHexLatLon] = useState<[number,number]|null>(null)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimTarget, setClaimTarget] = useState<TerritoryLight | null>(null)
  const [attackTarget,setAttackTarget]= useState<TerritoryLight | null>(null)

  const territories   = Object.values(useStore(s => s.territories))
  const player        = useStore(s => s.player)
  const storeSetCenter= useStore(s => s.setMapCenter)
  const [hasClaimed, setHasClaimed] = useState(() => {
    return localStorage.getItem('td_claimed_first') === '1'
  })
  const isFirstClaim = !hasClaimed && !(player?.territories_owned > 0)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    injectGlowFilter()
    injectHexAnimations()

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], zoom: 13,
      zoomControl: false, attributionControl: false,
    })
    const tileCfg = TILES[tile as keyof typeof TILES]
    tileRef.current = L.tileLayer(tileCfg.url, { maxZoom: tileCfg.maxZoom ?? 19 }).addTo(map)
    if ((tileCfg as any).overlay) {
      overlayRef.current = L.tileLayer((tileCfg as any).overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }
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

    // Teleport listener — fired from ProfilePanel territory click
    const onFlyTo = (e: Event) => {
      const { lat, lon, zoom } = (e as CustomEvent).detail
      map.flyTo([lat, lon], zoom ?? 15, { duration: 1.2 })
    }
    window.addEventListener('terra:flyto', onFlyTo)
    // ── Hover ghost hex ─────────────────────────────────────────
    const hoverLayer    = L.layerGroup().addTo(map)
    const selectedLayer = L.layerGroup().addTo(map)  // locked selected hex
    let hoverPoly: L.Polygon | null = null
    let selectedPoly: L.Polygon | null = null

    
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      try {
        const zoom = map.getZoom()
        const res = zoom <= 11 ? 6 : zoom <= 14 ? 7 : 8
        const hx = latLngToCell(e.latlng.lat, e.latlng.lng, res)
        if ((hoverPoly as any)?._hxId === hx) return

        hoverLayer.clearLayers()

        // Faint neighbors — lets player see the hex grid
        gridDisk(hx, 2).forEach((n: string) => {
          if (n === hx) return
          const nb = cellToBoundary(n).map((p: number[]) => [p[0], p[1]])
          const nt = useStore.getState().territories[n]
          const isOwned = !!nt?.owner_id
          hoverLayer.addLayer(L.polygon(nb as L.LatLngTuple[], {
            fillColor: isOwned ? '#00FF87' : '#ffffff',
            fillOpacity: isOwned ? 0.08 : 0.02,
            color: isOwned ? '#00FF87' : '#ffffff',
            weight: 0.5, opacity: isOwned ? 0.4 : 0.15,
          }))
        })

        // Main hex under cursor
        const owned = useStore.getState().territories[hx]
        const col = owned?.owner_id ? '#EF4444' : '#00FF87'
        const boundary = cellToBoundary(hx).map((p: number[]) => [p[0], p[1]])
        hoverPoly = L.polygon(boundary as L.LatLngTuple[], {
          fillColor: col, fillOpacity: 0.20,
          color: col, weight: 2, opacity: 1,
          dashArray: owned?.owner_id ? '' : '5,4',
        })
        ;(hoverPoly as any)._hxId = hx
        hoverLayer.addLayer(hoverPoly)
      } catch (_) {}
    })

    map.on('mouseout', () => {
      hoverLayer.clearLayers()
      hoverPoly = null
    })
    // ─────────────────────────────────────────────────────────────

    map.on('click', (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent?.target as HTMLElement
      if (target?.closest('.territory-panel, .claim-modal, .attack-panel, .poi-panel')) return

      // If a panel is open → close it and stop
      if (selectedHexRef.current) {
        selectedHexRef.current = null
        selectedLayer.clearLayers()
        selectedPoly = null
        setSelectedHex(null)
        setSelectedTerritoryState(null)
        setAttackTarget(null)
        setClaimTarget(null)
        return
      }

      // Open territory panel for clicked hex
      try {
        const zoom = map.getZoom()
        const res = zoom <= 11 ? 6 : zoom <= 14 ? 7 : 8
        const hx = latLngToCell(e.latlng.lat, e.latlng.lng, res)
        const geo = e.latlng
        const boundary = cellToBoundary(hx).map((p: number[]) => [p[0], p[1]])
        const existing = useStore.getState().territories[hx]
        const terr = existing || {
          h3_index: hx, h3: hx, h3_resolution: res,
          owner_id: null, owner_username: null,
          alliance_id: null, alliance_tag: null,
          territory_type: 'rural', type: 'rural',
          defense_tier: 1, defense_points: 100,
          is_control_tower: false, is_landmark: false,
          is_under_attack: false, ad_slot_enabled: false,
          landmark_name: null, place_name: null,
          center_lat: geo.lat, center_lon: geo.lng,
          boundary_points: boundary as [number,number][],
          resource_food: 10, resource_energy: 10,
          resource_credits: 10, resource_materials: 10,
          resource_intel: 5, food_per_tick: 10,
        }
        // Highlight hex immediately
        selectedLayer.clearLayers()
        hoverLayer.clearLayers()
        hoverPoly = null
        try {
          const selBoundary = cellToBoundary(hx).map((p: number[]) => [p[0], p[1]])
          selectedPoly = L.polygon(selBoundary as L.LatLngTuple[], {
            fillColor: '#fff', fillOpacity: 0.15,
            color: '#fff', weight: 2.5, opacity: 1, dashArray: '6,3',
          })
          selectedLayer.addLayer(selectedPoly)
        } catch (_) {}

        // Fetch full hex data (with POI) THEN open card
        const zoom2 = map.getZoom()
        const storeToken = useStore.getState().accessToken
        const enrichFetch = storeToken
          ? fetch(`/api/territories/map-view/?lat=${geo.lat}&lon=${geo.lng}&radius_km=0.3&zoom=${zoom2}`, {
              headers: { 'Authorization': `Bearer ${storeToken}` }
            })
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                const hexData = (data?.territories || data || []).find((h: any) => h.h3_index === hx)
                return hexData ? { ...terr, ...hexData } : terr
              })
              .catch(() => terr)
          : Promise.resolve(terr)

        enrichFetch.then(enriched => {
          selectedHexRef.current = hx
          setSelectedHex(hx)
          setSelectedTerritoryState(enriched)
        })
      } catch (_) {}
    })
    // Defer first call until map pane is initialized
    setTimeout(onMove, 100)

    // Server-side IP geolocation
    fetch('/api/geoip/').then(r=>r.json())
      .then(d => { if (d.lat && d.lon) map.setView([d.lat, d.lon], 13) })
      .catch(() => navigator.geolocation?.getCurrentPosition(
        p => map.setView([p.coords.latitude, p.coords.longitude], 14), () => {}
      ))

    return () => { clearTimeout(vpTimer.current); map.remove(); mapRef.current = null; selectedLayer.clearLayers() }
  }, []) // eslint-disable-line

  // ── Tile switch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    const cfg = TILES[tile as keyof typeof TILES]
    tileRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom ?? 19 }).addTo(map)
    overlayRef.current?.remove()
    overlayRef.current = null
    if ((cfg as any).overlay) {
      overlayRef.current = L.tileLayer((cfg as any).overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }
  }, [tile])

  // ── Draw hexes ────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexRef.current; if (!layer) return
    layer.clearLayers()
    if (!showHex) return

    // Draw owned territories + all free POI hexes (POI identity is the territory)
    territories.filter(t => t.owner_id || (t as any).is_landmark).forEach(t => {
      const poly = makeHexPolygon({
        territory: t, playerId: player?.id,
        onClick: (ter) => {
          onTerritoryClick(ter.h3_index)
          setSelectedHex(ter.h3_index)
          setSelectedTerritoryState(ter)
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
      <FavoritePinsPanel onNavigate={navigateTo} currentLat={center[0]} currentLon={center[1]} currentZoom={zoom} />

      {/* Territory Panel */}
      <AnimatePresence>
        {selectedHex && selectedTerritory && (
          <HexCard
            territory={selectedTerritory}
            onClose={() => { setSelectedHex(null); setSelectedTerritoryState(null); selectedLayer.clearLayers() }}
            onRequestClaim={() => setShowClaimModal(true)}
          />
        )}
      </AnimatePresence>

      <POIHexLayer map={mapRef.current} zoom={zoom} lat={center[0]} lon={center[1]} />

      {/* Claim Modal — at root level so position:fixed works */}
      <AnimatePresence>
        {showClaimModal && selectedTerritory && (
          <ClaimModal
            territory={selectedTerritory}
            isFree={localStorage.getItem('td_claimed_first') !== '1'}
            onClose={() => setShowClaimModal(false)}
            onClaimed={() => {
              setShowClaimModal(false)
              localStorage.setItem('td_claimed_first', '1')
              // Update store so hex shows as owned on map + in profile
              if (selectedTerritory) {
                const owned = { ...selectedTerritory, owner_id: player?.id, owner_username: player?.username }
                useStore.getState().setTerritories([owned as any])
                setSelectedTerritoryState(owned)
              }
              setSelectedHex(null)
              setSelectedTerritoryState(null)
              selectedLayer.clearLayers()
            }}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {attackTarget && <AttackPanel target={attackTarget} onClose={() => setAttackTarget(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {claimTarget && <ClaimModal territory={claimTarget} isFree={isFirstClaim} onClose={() => setClaimTarget(null)} onClaimed={() => { setClaimTarget(null); setHasClaimed(true); localStorage.setItem('td_claimed_first','1') }} />}
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
