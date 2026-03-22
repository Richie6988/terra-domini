/**
 * HexLayer — H3 territory polygons.
 * POI hexes ARE the territory — highlighted strongly by rarity.
 * No icons. The polygon fill + glow = the visual identity.
 */
import L from 'leaflet'
import type { TerritoryLight } from '../../types'

const RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

export function injectGlowFilter() {
  if (document.getElementById('td-svg-filters')) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = 'td-svg-filters'
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  svg.innerHTML = `<defs>
    <filter id="gf-green"    x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-gold"     x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-blue"     x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-purple"   x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-mythic"   x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`
  document.body.appendChild(svg)
}

export function injectHexAnimations() {
  if (document.getElementById('td-hex-anim')) return
  const s = document.createElement('style')
  s.id = 'td-hex-anim'
  s.textContent = `
    /* POI hexes pulse — the polygon itself glows */
    .td-poi-mythic    { animation: hexMythic 2s ease-in-out infinite; }
    .td-poi-legendary { animation: hexLegend 2.5s ease-in-out infinite; }
    .td-poi-epic      { animation: hexEpic 3s ease-in-out infinite; }
    .td-poi-rare      { filter: drop-shadow(0 0 6px #3B82F6aa) !important; }
    .td-poi-uncommon  { filter: drop-shadow(0 0 4px #10B98188) !important; }

    @keyframes hexMythic {
      0%,100% { filter: drop-shadow(0 0 8px #EC4899cc) drop-shadow(0 0 2px #EC4899ff); }
      50%     { filter: drop-shadow(0 0 22px #EC4899ff) drop-shadow(0 0 44px #EC489966); }
    }
    @keyframes hexLegend {
      0%,100% { filter: drop-shadow(0 0 7px #F59E0Bbb) drop-shadow(0 0 2px #F59E0Bff); }
      50%     { filter: drop-shadow(0 0 18px #F59E0Bff) drop-shadow(0 0 36px #F59E0B55); }
    }
    @keyframes hexEpic {
      0%,100% { filter: drop-shadow(0 0 5px #8B5CF6aa); }
      50%     { filter: drop-shadow(0 0 14px #8B5CF6ff) drop-shadow(0 0 28px #8B5CF644); }
    }

    .td-hex-own     { filter: drop-shadow(0 0 6px rgba(0,255,135,0.9)); }
    .td-hex-tower   { filter: drop-shadow(0 0 8px rgba(255,184,0,0.9)); animation: hexLegend 2s ease-in-out infinite; }
    .td-hex-enemy   { filter: drop-shadow(0 0 4px rgba(99,145,255,0.7)); }
  `
  document.body.appendChild(s)
}

export interface HexConfig {
  territory: TerritoryLight
  playerId?: string
  onClick: (t: TerritoryLight) => void
}

export function makeHexPolygon({ territory: t, playerId, onClick }: HexConfig): L.Polygon | null {
  if (!t.boundary_points?.length) return null
  const pts = (t.boundary_points as [number,number][]).map(p => [p[0],p[1]] as L.LatLngTuple)
  const ta = t as any

  const isOwn   = t.owner_id === playerId
  const isEnemy = !!t.owner_id && !isOwn
  const hasPOI  = !!(ta.poi_name || ta.is_landmark)
  const rarity  = ta.rarity || 'common'
  const rc      = RARITY_COLOR[rarity] || '#9CA3AF'

  let fill: string, fillOp: number, stroke: string, weight: number, dash: string, cls: string

  if (ta.is_control_tower) {
    fill='#FFB800'; fillOp=0.45; stroke='#FFD700'; weight=2.5; dash='6,3'; cls='td-hex-tower'

  } else if (isOwn) {
    const oc = ta.border_color || '#00FF87'
    fill=oc; stroke=oc; weight=2.5; dash=''; cls='td-hex-own'
    fillOp = hasPOI ? 0.40 : 0.35
    if (hasPOI) { fill=rc; stroke=rc; weight=3; cls=`td-hex-own td-poi-${rarity}` }

  } else if (isEnemy) {
    fill='#4B8BF5'; fillOp=0.25; stroke='#60A5FA'; weight=1.5; dash=''; cls='td-hex-enemy'
    if (hasPOI) { fill=rc; fillOp=0.25; stroke=rc; weight=2; cls=`td-hex-enemy td-poi-${rarity}` }

  } else if (hasPOI) {
    // FREE POI hex — looks like "mouseover/selected" state — unmistakably highlighted
    fill = rc
    fillOp = rarity==='mythic' ? 0.62 : rarity==='legendary' ? 0.54 : rarity==='epic' ? 0.44 : rarity==='rare' ? 0.34 : rarity==='uncommon' ? 0.24 : 0.16
    stroke = rc; weight = 4; dash = ''
    cls = `td-poi-${rarity}`

  } else {
    // Standard free hex — invisible (shown only on hover)
    fill='#fff'; fillOp=0.0; stroke='#fff'; weight=0; dash=''; cls='td-hex-free'
  }

  const poly = L.polygon(pts, {
    fillColor: fill, fillOpacity: fillOp,
    color: stroke, weight: weight,
    opacity: 0.9, dashArray: dash || undefined,
    className: cls,
    interactive: true,
  })

  // Tooltip
  const badge = ta.is_control_tower ? '🗼 Tour'
    : isOwn   ? '✅ Votre territoire'
    : isEnemy ? `👤 ${ta.owner_username}`
    : hasPOI  ? `⬡ ${rarity.toUpperCase()}`
    : '⬜ Libre'

  const income = Math.round((ta.resource_credits || ta.food_per_tick || 10) * 288)

  poly.bindTooltip(`
    <div style="font-size:11px;line-height:1.7;font-family:system-ui;min-width:160px">
      <div style="font-weight:900;color:#fff;font-size:13px">
        ${ta.custom_name || ta.poi_name || ta.place_name || 'Zone ' + t.h3_index.slice(0,6)}
      </div>
      <div style="color:${hasPOI ? rc : '#9CA3AF'}">${badge}</div>
      ${hasPOI ? `<div style="color:${rc};font-size:10px;font-weight:700">${ta.poi_category||''}</div>` : ''}
      <div style="color:#10B981;font-size:10px">+${income} HEX Coin/jour</div>
      <div style="color:#374151;font-size:9px;margin-top:2px">${t.h3_index.slice(0,14)}…</div>
    </div>
  `, { className:'td-tooltip', direction:'top', sticky:true })

  poly.on('click', () => onClick(t))
  return poly
}
