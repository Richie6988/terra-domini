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
      font-size:${cfg.size * 0.5}px;
      box-shadow:0 0 12px ${cfg.color}66, 0 0 4px ${cfg.color};
      ${pulse}
    ">${emoji}</div>`,
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
    if (!map || !map._loaded) return
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
    if (!layer || !lines || !map || !map._loaded) return

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
        <div style="min-width:200px;font-family:monospace;font-size:12px;background:#0A0A14;color:#fff;padding:10px;border-radius:8px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${ev.icon} ${ev.title}</div>
          ${ev.player ? `<div style="color:#6B7280;font-size:10px">by ${ev.player}</div>` : ''}
          ${ev.body ? `<div style="color:#9CA3AF;margin-top:6px">${ev.body}</div>` : ''}
        </div>
      `, { className: 'td-overlay-popup' })

      layer.addLayer(marker)
    })
  }, [events, map])

  return null
}
