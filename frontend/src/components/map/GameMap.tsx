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
import { PoiOverviewLayer } from './PoiOverviewLayer'
import { CoinPickupLayer } from './CoinPickupLayer'
import { ResourceIconLayer } from './ResourceIconLayer'
import { iconIdFor } from '../shared/poiIcons'
import { ExplorationLayer } from './ExplorationLayer'
import { OwnedTerritoryHub } from '../kingdom/OwnedTerritoryHub'
import { KingdomDetailOverlay } from '../kingdom/KingdomDetailOverlay'
import { AttackAnimationLayer } from './AttackAnimationLayer'
import { BuildingsOverlayLayer } from './BuildingsOverlayLayer'
import { TutorialArrow } from './TutorialArrow'
import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js'
import { Layers, Plus, Minus, Check } from 'lucide-react'
import { getIcon } from '../shared/iconBank'
import type { TerritoryLight } from '../../types'

interface GameMapProps {
  onViewportChange: (lat: number, lon: number, radius_km: number) => void
  onTerritoryClick: (h3: string) => void
}

/** Mini preview gradients for the map-style picker */
const TILE_SWATCH: Record<string, string> = {
  game: 'linear-gradient(135deg,#1d3b6e 0%,#2f6f8f 45%,#5fae6b 100%)',
  satellite: 'linear-gradient(135deg,#14321f 0%,#2f4f2a 50%,#5b6b3c 100%)',
}

/** POI category → iconBank id (categories without a dedicated icon) */
const POI_ICON_ALIAS: Record<string, string> = {
  temple: 'cult', bridge: 'infrastructure', lake: 'ocean', battle: 'war', military: 'weapon',
  festival: 'party', lab: 'science', energy: 'lightning', mythic_creature: 'mythology',
  oil: 'oil_barrel', gas: 'res_gaz', uranium: 'nuclear',
}
const POI_RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6', epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

// No API key needed (Carto basemaps now require one on production domains → "API KEY REQUIRED" tiles)
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
// Two ambiances (owner 2026-10-18): a stylised game board (OSM recoloured in CSS: .hx-tiles-game) and real satellite imagery
const ZOOM_MIN = 5, ZOOM_MAX = 16
const TILES: Record<string, { label: string; url: string; maxZoom: number; overlay?: string; className?: string; attribution: string }> = {
  game: { label: 'Game', url: OSM_URL, maxZoom: ZOOM_MAX, className: 'hx-tiles-game', attribution: OSM_ATTR },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: ZOOM_MAX,
    overlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
}
const tileLayerFor = (cfg: typeof TILES[string]) =>
  // OSM's tile policy requires a Referer header (blocked otherwise)
  L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom ?? 19, className: cfg.className, attribution: cfg.attribution,
    referrerPolicy: 'strict-origin-when-cross-origin' } as L.TileLayerOptions)

export function GameMap({ onViewportChange, onTerritoryClick }: GameMapProps) {
  const mapRef       = useRef<L.Map | null>(null)
  const tileRef      = useRef<L.TileLayer | null>(null)
  const hexRef       = useRef<L.LayerGroup | null>(null)
  const gridRef      = useRef<L.LayerGroup | null>(null)
  const overlayRef   = useRef<L.TileLayer | null>(null)
  const vpTimer      = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const mapTheme = useStore(s => s.mapTheme)
  const setMapTheme = useStore(s => s.setMapTheme)
  const tile = (mapTheme in TILES ? mapTheme : 'satellite') as keyof typeof TILES   // old saved styles → satellite
  // One-time switch to the satellite view (default ambiance; 'game' stays one tap away)
  useEffect(() => {
    try {
      if (!localStorage.getItem('hx_tiles_sat')) { localStorage.setItem('hx_tiles_sat', '1'); setMapTheme('satellite' as any) }
    } catch { /* ignore */ }
  }, [setMapTheme])
  const setTile = (t: keyof typeof TILES) => setMapTheme(t as any)
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
      zoomControl: false, attributionControl: true, minZoom: ZOOM_MIN, maxZoom: ZOOM_MAX,  // country view → street view
      // ── SMOOTH ZOOM CONFIG ──
      // zoomSnap: 0 = fractional zoom = smooth continuous zoom on touchpad/wheel
      // SVG renderer (default) = polygons scale via CSS transform during zoom = GPU-free
      // Backend accepts float zoom via int(float(zoom))
      zoomSnap: 0,
      zoomDelta: 1,                // button clicks still jump whole levels
      wheelPxPerZoomLevel: 10,     // responsive to touchpad
      wheelDebounceTime: 5,       // low debounce = immediate response
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    })
    const tileCfg = TILES[tile as keyof typeof TILES]
    tileRef.current = tileLayerFor(tileCfg).addTo(map)
    if (tileCfg.overlay) {
      overlayRef.current = L.tileLayer(tileCfg.overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }

    map.attributionControl.addAttribution('Terrain &copy; ESA WorldCover 2021, AWS Terrain Tiles')
    hexRef.current  = L.layerGroup().addTo(map)
    gridRef.current = L.layerGroup().addTo(map)
    mapRef.current  = map

    // Force Leaflet to recalculate container size (React mount timing issue)
    setTimeout(() => map.invalidateSize(), 200)

    // ── VIEWPORT + ZOOM — simple debounce, no layer hiding ──
    // Leaflet's SVG renderer uses CSS transform to scale layers during zoom.
    // This is GPU-accelerated and looks smooth — we don't need to hide anything.
    // We just debounce the expensive stuff (API calls + grid recalc).
    ;(map as any)._isZooming = false
    let stabilizeTimer: ReturnType<typeof setTimeout> | null = null

    const fireViewportUpdate = () => {
      try {
        const c = map.getCenter()
        const b = map.getBounds()
        const r = Math.min(map.distance(c, b.getNorthEast()) / 1000, 25)
        const z = Math.round(map.getZoom())
        setZoom(z); setCenter([c.lat, c.lng])
        storeSetCenter([c.lat, c.lng], z)
        onViewportChange(c.lat, c.lng, r)
      } catch (_) {}
    }

    const scheduleStabilize = () => {
      if (stabilizeTimer) clearTimeout(stabilizeTimer)
      stabilizeTimer = setTimeout(() => {
        ;(map as any)._isZooming = false
        fireViewportUpdate()
        map.fire('td:zoomStabilized')
      }, 300)
    }

    // moveend: debounced viewport update (only when NOT zooming)
    const onMove = () => {
      if ((map as any)._isZooming) return
      clearTimeout(vpTimer.current)
      vpTimer.current = setTimeout(fireViewportUpdate, 400)
    }
    map.on('moveend', onMove)

    // Zoom: set flag, cancel pending, schedule stabilize after 300ms of inactivity
    map.on('zoomstart', () => {
      ;(map as any)._isZooming = true
      clearTimeout(vpTimer.current)
      if (stabilizeTimer) clearTimeout(stabilizeTimer)
    })
    map.on('zoom', () => {
      // Continuously fired during zoom — keep resetting the stabilize timer
      if (stabilizeTimer) clearTimeout(stabilizeTimer)
    })
    map.on('zoomend', scheduleStabilize)

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
          const nCol = !isOwned ? '#0CC5FF' : nt.owner_id === useStore.getState().player?.id ? '#00FF87' : '#FF4D5E'
          hoverLayer.addLayer(L.polygon(nb as L.LatLngTuple[], {
            fillColor: nCol,
            fillOpacity: isOwned ? 0.06 : 0.03,
            color: nCol,
            weight: 0.8, opacity: isOwned ? 0.35 : 0.22,
            interactive: false,
          }))
        })

        // Main hex under cursor — bright highlight
        const owned = useStore.getState().territories[hx]
        const isMine = !!owned?.owner_id && owned.owner_id === useStore.getState().player?.id
        const col = !owned?.owner_id ? '#00FF87' : isMine ? '#7CFFC4' : '#FF4D5E'
        const boundary = cellToBoundary(hx).map((p: number[]) => [p[0], p[1]])
        hoverPoly = L.polygon(boundary as L.LatLngTuple[], {
          fillColor: col, fillOpacity: 0.16,
          color: col, weight: 2, opacity: 0.95, interactive: false,
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
      if (target?.closest('.territory-panel, .claim-modal, .attack-panel, .poi-panel, .hx-coin')) return   // a coin is a bonus, not a hex

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
          territory_type: '', type: '',   // terrain comes from the server (HexCard asks codex/territory)
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

        // If picking favorite mode → save pin and return
        if (useStore.getState().pickingFavorite) {
          window.dispatchEvent(new CustomEvent('hexod:pick-favorite', {
            detail: { lat: geo.lat, lon: geo.lng, name: (terr as any).poi_name || (terr as any).place_name || `Hex ${hx.slice(-6)}` }
          }))
          selectedLayer.clearLayers()
          return
        }

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
    tileRef.current = tileLayerFor(cfg).addTo(map)
    overlayRef.current?.remove()
    overlayRef.current = null
    if (cfg.overlay) {
      overlayRef.current = L.tileLayer(cfg.overlay, { maxZoom: 19, opacity: 0.8 }).addTo(map)
    }

  }, [tile])

  // ── Draw hexes ────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = hexRef.current; if (!layer) return
    const map = mapRef.current
    // Don't clear during zoom — Leaflet scales layers via CSS transform, no re-render needed
    if (map && (map as any)._isZooming) return
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
          setSelectedTerritoryState(enriched)   // enemy hex: the card's ATTACK button opens AttackPanel
        }
      })
      if (poly) layer.addLayer(poly)

      // POI icon marker at hex center — visible on map for special territories
      const ta = t as any
      if ((ta.poi_name || ta.is_landmark) && (ta.center_lat || ta.lat)) {
        const ringCol = POI_RARITY_COLOR[ta.rarity] || POI_CAT_COLORS[ta.poi_category] || '#6366f1'
        const iconKey = ta.poi_icon || POI_ICON_ALIAS[ta.poi_category] || iconIdFor(ta.poi_category || ta.territory_type || 'landmark')
        // Static iconBank SVG (trusted, not player-controlled)
        const svg = getIcon(String(iconKey).toLowerCase()).replace('<svg ', '<svg width="100%" height="100%" ')
        const icon = L.divIcon({
          html: `<div style="
            width:26px;height:26px;border-radius:50%;
            background:#0b1626;border:2px solid ${ringCol};
            display:flex;align-items:center;justify-content:center;overflow:hidden;
            box-shadow:0 0 10px ${ringCol}88,0 2px 6px rgba(0,0,0,0.6);
          "><div style="width:34px;height:34px;flex-shrink:0">${svg}</div></div>`,
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        const marker = L.marker([ta.center_lat || ta.lat, ta.center_lon || ta.lon], {
          icon, zIndexOffset: 400, interactive: false,
        })
        layer.addLayer(marker)
      }
    })
  }, [territories, player?.id])

  // ── Draw H3 grid overlay — visible at mid-zoom only, hidden at max zoom ──
  useEffect(() => {
    const grid = gridRef.current
    const map = mapRef.current
    if (!grid || !map) return

    let drawTimer: ReturnType<typeof setTimeout> | null = null

    const drawGrid = () => {
      if ((map as any)._isZooming) return
      grid.clearLayers()
      const z = map.getZoom()
      // Grid visible only in mid-zoom range. Hidden when fully zoomed in (16+)
      // so the player sees the map clearly, and hidden when zoomed out (<14)
      // so we don't draw thousands of hexes.
      if (z < 14 || z >= 16) return

      const b = map.getBounds()
      const hexes = getVisibleHexes({
        south: b.getSouth(), west: b.getWest(),
        north: b.getNorth(), east: b.getEast(),
      }, 8)

      if (hexes.length > 400) return

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
      drawTimer = setTimeout(drawGrid, 200)
    }

    debouncedDraw()
    map.on('moveend', debouncedDraw)
    map.on('td:zoomStabilized', debouncedDraw)
    return () => {
      if (drawTimer) clearTimeout(drawTimer)
      map.off('moveend', debouncedDraw)
      map.off('td:zoomStabilized', debouncedDraw)
    }
  }, [territories])

  const doZoom     = useCallback((d: number) => mapRef.current?.setZoom((mapRef.current.getZoom()) + d), [])
  const navigateTo = useCallback((lat: number, lon: number, z: number) => mapRef.current?.setView([lat, lon], z), [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} className={`hx-map--${tile}`} style={{ width: '100%', height: '100%' }} />



      {/* Global styles */}
      <style>{`
        .td-tooltip{background:linear-gradient(180deg,rgba(14,26,44,0.97),rgba(6,12,24,0.97))!important;border:1px solid rgba(255,255,255,0.14)!important;border-radius:12px!important;color:#e2e8f0!important;padding:9px 12px!important;box-shadow:0 10px 30px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06)!important;font-family:'Orbitron',system-ui,sans-serif!important;font-size:10px!important;letter-spacing:0.5px!important;}
        .td-tooltip::before{display:none!important;}
        .leaflet-container{cursor:crosshair;background:${tile === 'light' || tile === 'topo' ? '#d6dee8' : '#060e1a'};}
        .leaflet-attribution-flag{display:none!important;}
        .td-kingdom-badge{overflow:visible;}
        .td-kingdom-pill{transition:transform .15s ease;}
        .td-kingdom-pill:hover{transform:translate(-50%,-50%) scale(1.06)!important;}
        .td-mapctl-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:rgba(255,255,255,0.7);cursor:pointer;transition:background .15s,color .15s;}
        .td-mapctl-btn:hover{background:rgba(255,255,255,0.07);color:#fff;}
        .td-mapctl-btn:active{background:rgba(255,255,255,0.12);}
        .td-mapctl-btn[aria-expanded="true"]{color:#0CC5FF;background:rgba(12,197,255,0.12);}
        .td-mapstyle-opt{display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;color:rgba(255,255,255,0.65);font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;transition:border-color .15s,background .15s,transform .15s;}
        .td-mapstyle-opt:hover{border-color:rgba(255,255,255,0.22);background:rgba(255,255,255,0.06);transform:translateY(-1px);}
        .td-mapstyle-opt[aria-pressed="true"]{border-color:#0CC5FF;color:#fff;box-shadow:0 0 0 1px #0CC5FF55,0 0 14px rgba(12,197,255,0.25);}
        .td-zoom-range{-webkit-appearance:none;appearance:none;flex:1;height:4px;border-radius:999px;background:rgba(255,255,255,0.12);outline:none;cursor:pointer;}
        .td-zoom-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#0CC5FF;border:2px solid #fff;box-shadow:0 0 8px rgba(12,197,255,0.6);}
        .td-zoom-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#0CC5FF;border:2px solid #fff;}
      `}</style>

      {/* Map controls — right edge: compact stack (style menu + zoom) */}
      <MapControls
        tile={tile as string}
        onTile={k => setTile(k as keyof typeof TILES)}
        zoom={zoom}
        onZoom={z => mapRef.current?.setZoom(z)}
      />

      {/* Favorite pins — bottom left */}
      {showOverlay && <MapOverlayLayer map={mapRef.current} />}
      <FavoritePinsPanel onNavigate={navigateTo} currentLat={center[0]} currentLon={center[1]} currentZoom={zoom} />

      {/* Territory Panel */}
      <AnimatePresence>
        {selectedHex && selectedTerritory && (
          <HexCard
            key={selectedTerritory.h3_index || selectedHex}
            territory={selectedTerritory}
            onClose={() => { setSelectedHex(null); setSelectedTerritoryState(null); selectedLayerRef.current?.clearLayers() }}
            onAttack={() => { const t = selectedTerritory; setSelectedHex(null); setSelectedTerritoryState(null); setAttackTarget(t) }}
          />
        )}
      </AnimatePresence>

      {/* Attack modal (direct hex-click on enemy territory) */}
      <AnimatePresence>
        {attackTarget && <AttackPanel target={attackTarget} onClose={() => setAttackTarget(null)} />}
      </AnimatePresence>

      <KingdomBorderLayer map={mapRef.current} zoom={zoom} onKingdomClick={setSelectedKingdom} />
      <PoiOverviewLayer map={mapRef.current} zoom={zoom} center={center} />
      <ResourceIconLayer map={mapRef.current} zoom={zoom} center={center} />
      <CoinPickupLayer map={mapRef.current} zoom={zoom} center={center} />
      <ExplorationLayer map={mapRef.current} />
      <AttackAnimationLayer map={mapRef.current} />
      <BuildingsOverlayLayer map={mapRef.current} zoom={zoom} playerId={player?.id} />
      <TutorialArrow map={mapRef.current} />

      {/* Kingdom detail overlay — owned vs enemy */}
      {selectedKingdom && (() => {
        const tStore = useStore.getState().territories
        const isOwn = selectedKingdom.isOwn ?? selectedKingdom.is_main
        const enrichedTerritories = (selectedKingdom.h3_indexes || []).map((h: string, i: number) => {
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
            poi_icon: t?.poi_icon,
          }
        })

        // OWN kingdom → new 3-tab hub (Gallery / Customize / Kingdom)
        if (isOwn) {
          return (
            <OwnedTerritoryHub
              kingdom={{
                ...selectedKingdom,
                territories: enrichedTerritories,
              }}
              onClose={() => setSelectedKingdom(null)}
            />
          )
        }

        // ENEMY kingdom → existing detail overlay (spy/attack/diplomacy)
        return (
          <KingdomDetailOverlay
            kingdom={{
              ...selectedKingdom,
              territories: enrichedTerritories,
              total_defense: (selectedKingdom.h3_indexes || []).reduce((s: number, h: string) => s + ((tStore[h] as any)?.defense_points || 100), 0),
              total_attack: (selectedKingdom.h3_indexes || []).length * 50,
            }}
            isOwn={false}
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
      style={{ width:36, height:36, borderRadius:8, background: h ? 'rgba(0,153,204,0.12)' : 'rgba(13,27,42,0.92)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', color:'#e2e8f0', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      {children}
    </button>
  )
}
/** Compact, collapsible map control: style picker popover + zoom buttons. */
function MapControls({ tile, onTile, zoom, onZoom }: {
  tile: string; onTile: (k: string) => void; zoom: number; onZoom: (z: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const glass: React.CSSProperties = {
    background: 'linear-gradient(180deg, rgba(13,27,42,0.95), rgba(10,22,40,0.95))',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    boxShadow: '0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
  }

  return (
    <div ref={rootRef} style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', zIndex: 500 }}>
      <div style={{ ...glass, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
        <button className="td-mapctl-btn" aria-label="Map style" aria-expanded={open} title="Map style"
          onClick={() => setOpen(o => !o)}>
          <Layers size={18} />
        </button>
        <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <button className="td-mapctl-btn" aria-label="Zoom in" title="Zoom in" onClick={() => onZoom(Math.min(19, zoom + 1))}>
          <Plus size={17} />
        </button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#0CC5FF', lineHeight: '14px', userSelect: 'none' }}
          aria-label={`Zoom level ${zoom}`}>{zoom}</div>
        <button className="td-mapctl-btn" aria-label="Zoom out" title="Zoom out" onClick={() => onZoom(Math.max(3, zoom - 1))}>
          <Minus size={17} />
        </button>
      </div>

      {open && (
        <div className="hx-rise" role="dialog" aria-label="Map style" style={{
          ...glass, position: 'absolute', right: 52, top: 0, width: 212, padding: 12,
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
            MAP STYLE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.entries(TILES) as [string, { label: string }][]).map(([key, cfg]) => {
              const active = tile === key
              return (
                <button key={key} className="td-mapstyle-opt" aria-pressed={active} onClick={() => onTile(key)}>
                  <span style={{ position: 'relative', display: 'block', height: 34, borderRadius: 6, background: TILE_SWATCH[key], border: '1px solid rgba(255,255,255,0.1)' }}>
                    {active && (
                      <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#0CC5FF', color: '#06101e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span style={{ textAlign: 'left' }}>{cfg.label}</span>
                </button>
              )
            })}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' }}>ZOOM</span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: '#0CC5FF' }}>{zoom}</span>
          </div>
          <input type="range" className="td-zoom-range" min={3} max={19} step={1} value={zoom}
            aria-label="Zoom level" onChange={e => onZoom(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
