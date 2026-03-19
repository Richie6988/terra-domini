/**
 * HexLayer — draws H3 territory hexagons on Leaflet.
 * Visual style: neon glow, animated pulse for towers, gradient fills.
 * Called from GameMap, replaces inline hex drawing.
 */
import L from 'leaflet'
import type { TerritoryLight } from '../../types'

// Glow-style SVG filter injected once into the DOM
export function injectGlowFilter() {
  if (document.getElementById('td-svg-filters')) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('id', 'td-svg-filters')
  svg.setAttribute('style', 'position:absolute;width:0;height:0')
  svg.innerHTML = `
    <defs>
      <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  `
  document.body.appendChild(svg)
}

export interface HexConfig {
  territory: TerritoryLight
  playerId?: string
  onClick: (t: TerritoryLight) => void
}

export function makeHexPolygon({ territory: t, playerId, onClick }: HexConfig): L.Polygon | null {
  if (!t.boundary_points?.length) return null
  const pts = (t.boundary_points as [number,number][]).map(p => [p[0], p[1]] as L.LatLngTuple)

  const isOwn    = t.owner_id === playerId
  const isTower  = t.is_control_tower
  const isEnemy  = !!t.owner_id && !isOwn
  const isFree   = !t.owner_id

  // Colors + weight per state
  const cfg = isTower  ? { fill: '#FFB800', fillOp: 0.45, stroke: '#FFD700', weight: 2.5, dash: '6,3' }
            : isOwn    ? { fill: '#00FF87', fillOp: 0.40, stroke: '#00FF87', weight: 2.5, dash: '' }
            : isEnemy  ? { fill: '#4B8BF5', fillOp: 0.30, stroke: '#60A5FA', weight: 1.5, dash: '' }
            :             { fill: '#FFFFFF', fillOp: 0.06, stroke: '#FFFFFF', weight: 1,   dash: '3,5' }

  const poly = L.polygon(pts, {
    fillColor: cfg.fill,
    fillOpacity: cfg.fillOp,
    color: cfg.stroke,
    weight: cfg.weight,
    opacity: 0.9,
    dashArray: cfg.dash || undefined,
    className: isTower ? 'td-hex-tower' : isOwn ? 'td-hex-own' : isEnemy ? 'td-hex-enemy' : 'td-hex-free',
  })

  // Rich tooltip
  const badge = isTower ? '🗼 Control Tower' : isOwn ? '🟢 Your territory' : isEnemy ? `👤 ${t.owner_username}` : '⬜ Unclaimed'
  const income = t.food_per_tick ? `<div style="color:#10B981;font-size:10px">+${t.food_per_tick} TDC/tick</div>` : ''
  const chain = (t as any).token_id ? `<div style="color:#8B5CF6;font-size:9px;margin-top:2px">NFT #${(t as any).token_id}</div>` : ''

  poly.bindTooltip(`
    <div style="font-size:11px;line-height:1.6;font-family:monospace;min-width:140px">
      <div style="font-weight:700;color:#fff;font-size:12px">${t.place_name || 'Zone ' + t.h3_index.slice(0,6)}</div>
      <div style="color:#9CA3AF">${badge}</div>
      ${income}${chain}
      <div style="color:#374151;font-size:9px;margin-top:3px">${t.h3_index.slice(0,10)}…</div>
    </div>
  `, { className: 'td-tooltip', direction: 'top', sticky: true })

  poly.on('click', () => onClick(t))

  return poly
}
