/**
 * MapOverlayLayer — Sublayer animé Leaflet affichant en temps réel :
 * troupes en mouvement, trades, guerres, ressources, news, messages joueurs.
 * Chaque event a une icône 2D animée + ligne de trajectoire SVG.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useLeafletLayer } from '../ui/Utils'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { escapeHtml as esc } from '../../services/escapeHtml'

type OverlayEvent = {
  id: number
  type: string
  player?: string
  from?: { lat: number; lon: number }
  to?:   { lat: number; lon: number }
  title: string
  body?: string
  icon: string
  payload: Record<string, unknown>
  expires_at?: string
}

const TYPE_CONFIG: Record<string, { color: string; size: number; pulse: boolean; trail: string }> = {
  troop_move:      { color: '#EF4444', size: 32, pulse: false, trail: 'rgba(239,68,68,0.4)' },
  attack_wave:     { color: '#FF6B00', size: 36, pulse: true,  trail: 'rgba(255,107,0,0.5)' },
  trade_convoy:    { color: '#10B981', size: 28, pulse: false, trail: 'rgba(16,185,129,0.3)' },
  resource_drop:   { color: '#FFB800', size: 30, pulse: true,  trail: '' },
  news_pin:        { color: '#8B5CF6', size: 26, pulse: false, trail: '' },
  player_msg:      { color: '#06B6D4', size: 24, pulse: false, trail: '' },
  war_declaration: { color: '#DC2626', size: 40, pulse: true,  trail: 'rgba(220,38,38,0.6)' },
  alliance_rally:  { color: '#F59E0B', size: 34, pulse: true,  trail: 'rgba(245,158,11,0.4)' },
  tower_siege:     { color: '#FFD700', size: 38, pulse: true,  trail: 'rgba(255,215,0,0.5)' },
  airdrop:         { color: '#00FF87', size: 30, pulse: true,  trail: '' },
}

// Inline SVG glyphs per event type (RULE 4 — the API `icon` field may contain emoji, never render it)
const P = (d: string) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const TYPE_GLYPH: Record<string, string> = {
  troop_move:      P('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  attack_wave:     P('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/>'),
  trade_convoy:    P('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
  resource_drop:   P('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>'),
  news_pin:        P('<path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V9h4"/><path d="M12 8h6M12 12h6M12 16h4"/>'),
  player_msg:      P('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  war_declaration: P('<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>'),
  alliance_rally:  P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  tower_siege:     P('<path d="M6 21V8l3-2V3h6v3l3 2v13"/><path d="M10 21v-5h4v5"/>'),
  airdrop:         P('<path d="M4 10a8 8 0 0 1 16 0z"/><path d="M4 10l8 7 8-7"/><rect x="9" y="17" width="6" height="5" rx="1"/>'),
}
const DEFAULT_GLYPH = P('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>')

function makeIcon(emoji: string, type: string): L.DivIcon {
  const cfg = TYPE_CONFIG[type] || { color: '#fff', size: 28, pulse: false }
  const pulse = cfg.pulse
    ? `@keyframes op-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.8}}animation:op-pulse 1.5s ease-in-out infinite;`
    : ''
  return L.divIcon({
    html: `<div style="
      width:${cfg.size}px;height:${cfg.size}px;
      background:${cfg.color}22;
      border:2px solid ${cfg.color};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:${cfg.color};background-color:rgba(8,16,30,0.85);
      box-shadow:0 0 12px ${cfg.color}66, 0 0 4px ${cfg.color};
      ${pulse}
    "><div style="width:${Math.round(cfg.size * 0.5)}px;height:${Math.round(cfg.size * 0.5)}px">${TYPE_GLYPH[type] || DEFAULT_GLYPH}</div></div>`,
    className: '',
    iconSize: [cfg.size, cfg.size],
    iconAnchor: [cfg.size / 2, cfg.size / 2],
  })
}

interface Props { map: L.Map | null }

export function MapOverlayLayer({ map }: Props) {
  const _layerFromHook = useLeafletLayer(map)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const linesRef = useRef<L.LayerGroup | null>(null)

  const { data: events = [] } = useQuery<OverlayEvent[]>({
    queryKey: ['overlay-events'],
    queryFn: () => api.get('/territories-geo/overlay/').then(r => r.data ?? []),
    refetchInterval: 8000,
  })

  useEffect(() => {
    if (!map || !(map as any)._loaded) return
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
      linesRef.current = L.layerGroup().addTo(map)
    }
    return () => {
      layerRef.current?.clearLayers()
      linesRef.current?.clearLayers()
    }
  }, [map])

  useEffect(() => {
    const layer = layerRef.current
    const lines = linesRef.current
    if (!layer || !lines || !map || !(map as any)._loaded) return

    layer.clearLayers()
    lines.clearLayers()

    events.forEach(ev => {
      const cfg = TYPE_CONFIG[ev.type] || { color: '#fff', trail: '' }

      // Movement trail line
      if (ev.from && ev.to && cfg.trail) {
        const line = L.polyline(
          [[ev.from.lat, ev.from.lon], [ev.to.lat, ev.to.lon]],
          { color: cfg.color, weight: 2, opacity: 0.5, dashArray: '6 4' }
        )
        lines.addLayer(line)
      }

      // Marker at origin (or center if no movement)
      const lat = ev.from?.lat ?? ev.to?.lat
      const lon = ev.from?.lon ?? ev.to?.lon
      if (!lat || !lon) return

      const marker = L.marker([lat, lon], { icon: makeIcon(ev.icon, ev.type) })
      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif;font-size:12px;color:#e2e8f0;padding:2px">
          <div style="font-family:'Orbitron',sans-serif;font-weight:800;font-size:13px;letter-spacing:0.5px;margin-bottom:4px;color:${cfg.color}">${esc(ev.title)}</div>
          ${ev.player ? `<div style="color:rgba(255,255,255,0.55);font-size:10px">by ${esc(ev.player)}</div>` : ''}
          ${ev.body ? `<div style="color:rgba(255,255,255,0.75);margin-top:6px;line-height:1.45">${esc(ev.body)}</div>` : ''}
        </div>
      `, { className: 'td-overlay-popup' })

      layer.addLayer(marker)
    })
  }, [events, map])

  return null
}
