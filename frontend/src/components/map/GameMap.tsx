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
import { injectGlowFilter, makeHexPolygon, injectHexAnimations, getVisibleHexes, getHexBoundary } from './HexLayer'
import { KingdomBorderLayer } from './KingdomBorderLayer'
import { KingdomDetailOverlay } from '../kingdom/KingdomDetailOverlay'
import { AttackAnimationLayer } from './AttackAnimationLayer'
import { BuildingsOverlayLayer } from './BuildingsOverlayLayer'
import { TutorialArrow } from './TutorialArrow'
import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

const TILES: Record<string, { label: string; url: string; maxZoom: number; overlay?: string }> = {
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
  },
  light: {
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 18,
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
  },
}

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef       = useRef<L.Map | null>(null)
  const tileRef      = useRef<L.TileLayer | null>(null)
  const hexRef       = useRef<L.LayerGroup | null>(null)
  const gridRef      = useRef<L.LayerGroup | null>(null)
  const overlayRef   = useRef<L.TileLayer | null>(null)
  const vpTimer      = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tile,        setTile]        = useState<keyof typeof TILES>('dark')
  const [poiCatFilter, setPoiCatFilter] = useState<string[]>(['all'])
  const [poiRarFilter, setPoiRarFilter] = useState<string[]>(['all'])
  const [showOverlay,  setShowOverlay]  = useState(true)
  const [showGrid,     setShowGrid]     = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480
  const [zoom, setZoom] = useState(isMobile ? 14 : 13)
  const [center,      setCenter]      = useState<[number,number]>([48.8566, 2.3522])
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [selectedTerritory, setSelectedTerritoryState] = useState<any | null>(null)
  const selectedHexRef = useRef<string | null>(null)
  const selectedLayerRef = useRef<L.LayerGroup | null>(null)
  const [selectedHexLatLon, setSelectedHexLatLon] = useState<[number,number]|null>(null)
  const [attackTarget,setAttackTarget]= useState<TerritoryLight | null>(null)
  const [selectedKingdom, setSelectedKingdom] = useState<any | null>(null)

  const territories   = Object.values(useStore(s => s.territories))
  const player        = useStore(s => s.player)
  const storeSetCenter= useStore(s => s.setMapCenter)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    injectGlowFilter()
    injectHexAnimations()

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522], zoom: (typeof window !== 'undefined' && window.innerWidth < 480) ? 14 : 13,
      zoomControl: false, attributionControl: false,
    })
    const tileCfg = TILES[tile as keyof typeof TILES]
    tileRef.current = L.tileLayer(tileCfg.url, { maxZoom: tileCfg.maxZoom ?? 19 }).addTo(map)
    if (tileCfg.overlay) {
      overlayRef.current = L.tileLayer(tileCfg.overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }

    hexRef.current  = L.layerGroup().addTo(map)
    gridRef.current = L.layerGroup().addTo(map)
    mapRef.current  = map

    // Force Leaflet to recalculate container size (React mount timing issue)
    setTimeout(() => map.invalidateSize(), 200)

    let isZoomingMap = false
    const onMove = () => {
      if (isZoomingMap) return // skip during zoom animation
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
        } catch (_) {}
      }, 500)
    }
    map.on('moveend', onMove)
    map.on('zoomstart', () => { isZoomingMap = true; clearTimeout(vpTimer.current) })
    map.on('zoomend', () => { isZoomingMap = false; onMove() })

    // Teleport listener — fired from ProfilePanel territory click
    const onFlyTo = (e: Event) => {
      const { lat, lon, zoom } = (e as CustomEvent).detail
      map.flyTo([lat, lon], zoom ?? 15, { duration: 1.2 })
    }
    window.addEventListener('terra:flyto', onFlyTo)
    // ── Hover ghost hex ─────────────────────────────────────────
    const hoverLayer    = L.layerGroup().addTo(map)
    const selectedLayer = L.layerGroup().addTo(map)  // locked selected hex
    selectedLayerRef.current = selectedLayer
    let hoverPoly: L.Polygon | null = null
    let selectedPoly: L.Polygon | null = null

    
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      try {
        // ALWAYS res 8, show at ALL zoom levels — hex + 1 ring around cursor
        const hx = latLngToCell(e.latlng.lat, e.latlng.lng, 8)
        if ((hoverPoly as any)?._hxId === hx) return

        hoverLayer.clearLayers()

        // 1-ring neighbors — subtle grid preview
        gridDisk(hx, 1).forEach((n: string) => {
          if (n === hx) return
          const nb = cellToBoundary(n).map((p: number[]) => [p[0], p[1]])
          const nt = useStore.getState().territories[n]
          const isOwned = !!nt?.owner_id
          hoverLayer.addLayer(L.polygon(nb as L.LatLngTuple[], {
            fillColor: isOwned ? '#00FF87' : '#0099cc',
            fillOpacity: isOwned ? 0.08 : 0.03,
            color: isOwned ? '#00FF87' : '#0099cc',
            weight: 0.8, opacity: isOwned ? 0.4 : 0.2,
          }))
        })

        // Main hex under cursor — bright highlight
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

      // Always compute clicked hex at res 8
      try {
        const hx = latLngToCell(e.latlng.lat, e.latlng.lng, 8)

        // If clicking the SAME hex → close
        if (selectedHexRef.current === hx) {
          selectedHexRef.current = null
          selectedLayer.clearLayers()
          selectedPoly = null
          setSelectedHex(null)
          setSelectedTerritoryState(null)
          setAttackTarget(null)
          return
        }

        // Open this hex (whether a different hex was open or not)
        const geo = e.latlng
        const boundary = cellToBoundary(hx).map((p: number[]) => [p[0], p[1]])
        const existing = useStore.getState().territories[hx]
        const terr = existing || {
          h3_index: hx, h3: hx, h3_resolution: 8,
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
      .then(d => { if (d.lat && d.lon) map.setView([d.lat, d.lon], (window.innerWidth < 480) ? 15 : 13) })
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
    if (cfg.overlay) {
      overlayRef.current = L.tileLayer(cfg.overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }

  }, [tile])

  // ── Draw hexes ────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexRef.current; if (!layer) return
    layer.clearLayers()
    // Draw owned + POI hexes — always visible
    const POI_CAT_COLORS: Record<string, string> = {
      volcano:'#dc2626', earthquake:'#f97316', tsunami:'#0ea5e9', nuclear:'#a855f7',
      monument:'#f59e0b', city:'#6366f1', temple:'#ec4899', bridge:'#14b8a6',
      mountain:'#22c55e', ocean:'#0284c7', forest:'#16a34a', lake:'#06b6d4',
      battle:'#ef4444', military:'#b91c1c', war:'#991b1b',
      sport:'#3b82f6', music:'#d946ef', food:'#f97316', festival:'#f43f5e',
      space:'#8b5cf6', lab:'#6366f1', energy:'#eab308',
      dragon:'#dc2626', dinosaur:'#84cc16', alien:'#a3e635', mythic_creature:'#e879f9',
      oil:'#1e293b', mine:'#78716c', gas:'#94a3b8', uranium:'#facc15',
    }
    territories.filter(t => t.owner_id || (t as any).is_landmark || (t as any).poi_name).forEach(t => {
      const poly = makeHexPolygon({
        territory: t, playerId: player?.id,
        catFilter: poiCatFilter, rarFilter: poiRarFilter,
        onClick: async (ter) => {
          // Close any open panel — 3D viewer takes full screen
          useStore.getState().setActivePanel(null)
          onTerritoryClick(ter.h3_index)
          setSelectedHex(ter.h3_index)
          // Generate territory on first click if not already in DB (standard hex)
          let enriched: any = ter
          if (!(ter as any).rarity && !(ter as any).is_landmark) {
            try {
              const r = await fetch(`/api/territories/generate/`, {
                method: 'POST',
                headers: { 'Content-Type':'application/json', Authorization:`Bearer ${useStore.getState().accessToken}` },
                body: JSON.stringify({ h3_index: ter.h3_index, lat: (ter as any).center_lat, lon: (ter as any).center_lon }),
              })
              if (r.ok) { const d = await r.json(); enriched = { ...ter, ...d.territory } }
            } catch(_) {}
          }
          setSelectedTerritoryState(enriched)
          if ((enriched as any).owner_id && (enriched as any).owner_id !== player?.id) setAttackTarget(enriched)
        }
      })
      if (poly) layer.addLayer(poly)

      // POI icon marker at hex center — visible on map for special territories
      const ta = t as any
      if ((ta.poi_name || ta.is_landmark) && (ta.center_lat || ta.lat)) {
        const catCol = POI_CAT_COLORS[ta.poi_category] || '#6366f1'
        const poiLabel = (ta.poi_category || '').slice(0, 3).toUpperCase()
        const icon = L.divIcon({
          html: `<div style="
            width:20px;height:20px;border-radius:50%;
            background:${catCol};border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:6px;font-weight:900;color:#fff;
            font-family:'Orbitron',sans-serif;letter-spacing:0.5px;
            box-shadow:0 1px 6px ${catCol}66;
          ">${poiLabel}</div>`,
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        const marker = L.marker([ta.center_lat || ta.lat, ta.center_lon || ta.lon], {
          icon, zIndexOffset: 400, interactive: false,
        })
        layer.addLayer(marker)
      }
    })
  }, [territories, player?.id])

  // ── Draw H3 grid overlay — debounced, only at high zoom ──
  useEffect(() => {
    const grid = gridRef.current
    const map = mapRef.current
    if (!grid || !map) return

    let isZooming = false
    let drawTimer: ReturnType<typeof setTimeout> | null = null

    const drawGrid = () => {
      grid.clearLayers()
      if (isZooming) return
      const z = map.getZoom()
      if (z < 15) return // Higher threshold — was 14, reduces hex count

      const b = map.getBounds()
      const hexes = getVisibleHexes({
        south: b.getSouth(), west: b.getWest(),
        north: b.getNorth(), east: b.getEast(),
      }, 8)

      if (hexes.length > 300) return // Lower cap — was 500

      const ownedH3 = new Set(territories.map(t => t.h3_index))

      for (const h3 of hexes) {
        if (ownedH3.has(h3)) continue
        const pts = getHexBoundary(h3)
        if (pts.length === 0) continue
        const poly = L.polygon(pts as L.LatLngTuple[], {
          fillColor: '#0099cc',
          fillOpacity: 0.04,
          color: 'rgba(0,153,204,0.2)',
          weight: 1,
          interactive: false,
        })
        grid.addLayer(poly)
      }
    }

    const debouncedDraw = () => {
      if (drawTimer) clearTimeout(drawTimer)
      drawTimer = setTimeout(drawGrid, 400)
    }

    const onZoomStart = () => { isZooming = true; grid.clearLayers() }
    const onZoomEnd = () => { isZooming = false; debouncedDraw() }

    debouncedDraw()
    map.on('moveend', debouncedDraw)
    map.on('zoomstart', onZoomStart)
    map.on('zoomend', onZoomEnd)
    return () => {
      if (drawTimer) clearTimeout(drawTimer)
      map.off('moveend', debouncedDraw)
      map.off('zoomstart', onZoomStart)
      map.off('zoomend', onZoomEnd)
    }
  }, [territories])

  const doZoom     = useCallback((d: number) => mapRef.current?.setZoom((mapRef.current.getZoom()) + d), [])
  const navigateTo = useCallback((lat: number, lon: number, z: number) => mapRef.current?.setView([lat, lon], z), [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%',  }} />



      {/* Global styles */}
      <style>{`
        .td-tooltip{background:rgba(235,242,250,0.97)!important;border:1px solid rgba(0,60,100,0.15)!important;border-radius:10px!important;color:#1a2a3a!important;padding:8px 12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.15)!important;font-family:'Orbitron',system-ui,sans-serif!important;font-size:9px!important;letter-spacing:1px!important;}
        .td-tooltip::before{display:none!important;}
        .leaflet-container{cursor:crosshair;background:#e8eef5;}
        .td-hex-own path{filter:drop-shadow(0 0 6px rgba(0,255,135,0.8))!important;}
        .td-hex-tower path{filter:drop-shadow(0 0 8px rgba(255,184,0,0.9))!important;animation:td-pulse 2s ease-in-out infinite;}
        .td-hex-enemy path{filter:drop-shadow(0 0 4px rgba(99,145,255,0.6))!important;}
        .td-hex-free path{opacity:0.7;}
        @keyframes td-pulse{0%,100%{filter:drop-shadow(0 0 8px rgba(255,184,0,0.9));}50%{filter:drop-shadow(0 0 16px rgba(255,184,0,1.0));}}
        .leaflet-attribution-flag{display:none!important;}
        .td-hex-poi-rare path{filter:drop-shadow(0 0 6px #3B82F6aa);}
        .td-hex-poi-epic path{animation:hexPulseEpic 3s ease-in-out infinite;}
        .td-hex-poi-legendary path{animation:hexPulseLegendary 2.5s ease-in-out infinite;}
        .td-hex-poi-mythic path{animation:hexPulseMythic 2s ease-in-out infinite;}
        @keyframes hexPulseLegendary{0%,100%{filter:drop-shadow(0 0 6px #F59E0Baa);}50%{filter:drop-shadow(0 0 14px #F59E0Bff) drop-shadow(0 0 28px #F59E0B55);}}
        @keyframes hexPulseMythic{0%,100%{filter:drop-shadow(0 0 8px #EC4899cc);}50%{filter:drop-shadow(0 0 20px #EC4899ff) drop-shadow(0 0 40px #EC489966);}}
        @keyframes hexPulseEpic{0%,100%{filter:drop-shadow(0 0 5px #8B5CF6aa);}50%{filter:drop-shadow(0 0 12px #8B5CF6ff);}}
      `}</style>

      {/* Map controls — top right: tile picker + zoom slider */}
      <div style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', zIndex:500, display:'flex', flexDirection:'column', gap:0,
        background:'rgba(235,242,250,0.92)', backdropFilter:'blur(20px)', borderRadius:10, border:'1px solid rgba(0,60,100,0.12)',
        overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}>
        {/* Tile style buttons */}
        {(Object.entries(TILES) as any[]).map(([key, cfg]) => (
          <button key={key} onClick={() => setTile(key)} style={{
            display:'block', width:'100%', padding:'8px 14px',
            background: tile===key ? 'rgba(0,153,204,0.1)' : 'transparent',
            border:'none', borderBottom:'1px solid rgba(0,60,100,0.06)',
            color: tile===key ? '#0099cc' : 'rgba(26,42,58,0.5)', fontSize:10, cursor:'pointer', textAlign:'left',
            fontFamily:"'Orbitron',system-ui,sans-serif", fontWeight: tile===key ? 700 : 400, letterSpacing:1,
          }}>{cfg.label}</button>
        ))}
        {/* Zoom slider */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderTop:'1px solid rgba(0,60,100,0.08)' }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#6b7280', fontFamily:'monospace', cursor:'pointer' }}
            onClick={() => mapRef.current?.setZoom(zoom - 1)}>−</span>
          <input type="range" min={3} max={19} step={1} value={zoom}
            onChange={e => mapRef.current?.setZoom(Number(e.target.value))}
            style={{ flex:1, height:4, cursor:'pointer', accentColor:'#0099cc' }}
          />
          <span style={{ fontSize:9, fontWeight:700, color:'#0099cc', fontFamily:'monospace', cursor:'pointer' }}
            onClick={() => mapRef.current?.setZoom(zoom + 1)}>+</span>
          <span style={{ fontSize:8, color:'#9ca3ab', fontFamily:'monospace', minWidth:18, textAlign:'right' }}>{zoom}</span>
        </div>
      </div>

      {/* Favorite pins — bottom left */}
      {showOverlay && <MapOverlayLayer map={mapRef.current} />}
      <FavoritePinsPanel onNavigate={navigateTo} currentLat={center[0]} currentLon={center[1]} currentZoom={zoom} />

      {/* Territory Panel */}
      <AnimatePresence>
        {selectedHex && selectedTerritory && (
          <HexCard
            territory={selectedTerritory}
            onClose={() => { setSelectedHex(null); setSelectedTerritoryState(null); selectedLayerRef.current?.clearLayers() }}
          />
        )}
      </AnimatePresence>

      {/* Attack modal (direct hex-click on enemy territory) */}
      <AnimatePresence>
        {attackTarget && <AttackPanel target={attackTarget} onClose={() => setAttackTarget(null)} />}
      </AnimatePresence>

      <KingdomBorderLayer map={mapRef.current} zoom={zoom} onKingdomClick={setSelectedKingdom} />
      <AttackAnimationLayer map={mapRef.current} />
      <BuildingsOverlayLayer map={mapRef.current} zoom={zoom} playerId={player?.id} />
      <TutorialArrow map={mapRef.current} />

      {/* Kingdom detail overlay */}
      {selectedKingdom && (() => {
        const tStore = useStore.getState().territories
        return (
          <KingdomDetailOverlay
            kingdom={{
              ...selectedKingdom,
              territories: (selectedKingdom.h3_indexes || []).map((h: string, i: number) => {
                const t = tStore[h] as any
                return {
                  h3_index: h,
                  name: t?.poi_name || t?.place_name || h.slice(0, 12),
                  rarity: t?.rarity || 'common',
                  biome: t?.territory_type || 'rural',
                  income_per_day: Math.round((t?.resource_credits || 10) * 288),
                  defense_points: t?.defense_points || 100,
                  is_capital: i === 0,
                  has_shield: !!t?.shield_expires_at,
                  poi_category: t?.poi_category,
                }
              }),
              total_defense: (selectedKingdom.h3_indexes || []).reduce((s: number, h: string) => s + ((tStore[h] as any)?.defense_points || 100), 0),
              total_attack: (selectedKingdom.h3_indexes || []).length * 50,
            }}
            isOwn={selectedKingdom.isOwn ?? selectedKingdom.is_main}
            onClose={() => setSelectedKingdom(null)}
          />
        )
      })()}


    </div>
  )
}

function MapBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:36, height:36, borderRadius:8, background: h ? 'rgba(0,153,204,0.12)' : 'rgba(235,242,250,0.92)', backdropFilter:'blur(20px)', border:'1px solid rgba(0,60,100,0.12)', color:'#1a2a3a', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      {children}
    </button>
  )
}