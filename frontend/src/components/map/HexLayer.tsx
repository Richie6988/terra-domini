/**
 * HexLayer — Territory polygons.
 *
 * Visual rules (GDD Hexod):
 *   FREE POI   → rarity color fill (strong) + pulse animation = looks selected/special
 *   OWNED own  → green fill + rarity border (shows kingdom tier/rarity)
 *   OWNED POI  → green fill + rarity border thick + pulse
 *   ENEMY      → blue/red depending on rarity
 *   FREE std   → invisible (only shown on hover)
 */
import { rarityLabel } from '../../services/balance'
import L from 'leaflet'
import * as h3 from 'h3-js'
import type { TerritoryLight } from '../../types'
import { escapeHtml as esc } from '../../services/escapeHtml'
import { hexPerDay } from '../../services/balance'

/** Hostile territory colour (owned by another player) */
const ENEMY_COLOR = '#FF4D5E'

const RARITY_COLOR: Record<string, string> = {
  common:'#cbd5e1', uncommon:'#fbbf24', rare:'#10b981',
  epic:'#67e8f9', legendary:'#67e8f9', mythic:'#67e8f9',
}

/** Compute hex boundary from H3 index (client-side fallback) */
export function getHexBoundary(h3Index: string): [number, number][] {
  try {
    const boundary = h3.cellToBoundary(h3Index)
    // h3-js returns [lat, lng] pairs — Leaflet needs same format
    return boundary.map(([lat, lng]) => [lat, lng] as [number, number])
  } catch {
    return []
  }
}

/** Generate grid of H3 cells covering the full viewport rectangle */
export function getVisibleHexes(bounds: { south: number; west: number; north: number; east: number }, resolution: number): string[] {
  try {
    const { south, west, north, east } = bounds
    // Create viewport polygon (closed ring)
    const poly: [number, number][] = [
      [south, west], [south, east], [north, east], [north, west]
    ]
    return h3.polygonToCells(poly, resolution)
  } catch {
    return []
  }
}

/** Create a subtle grid overlay hex polygon (unclaimed area) */
export function makeGridHex(h3Index: string, map: L.Map): L.Polygon | null {
  const pts = getHexBoundary(h3Index)
  if (pts.length === 0) return null

  return L.polygon(pts as L.LatLngTuple[], {
    fillColor: '#0099cc',
    fillOpacity: 0.03,
    color: 'rgba(0,153,204,0.18)',
    weight: 1,
    interactive: false,
  })
}

export function injectGlowFilter() {
  if (document.getElementById('td-svg-filters')) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = 'td-svg-filters'
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  svg.innerHTML = `<defs>
    <filter id="gf-green"x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-gold"x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-blue"x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-purple" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-mythic" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`
  document.body.appendChild(svg)
}

export function injectHexAnimations() {
  if (document.getElementById('td-hex-anim')) return
  const s = document.createElement('style')
  s.id = 'td-hex-anim'
  s.textContent = `
    /* FREE POI — rarity glow. Only legendary/mythic animate (CSS only, few hexes) */
    .td-poi-free-mythic     { animation: poiMythic 2.4s ease-in-out infinite; }
    .td-poi-free-legendary  { animation: poiLegend 3s ease-in-out infinite; }
    .td-poi-free-epic       { filter: drop-shadow(0 0 8px #8B5CF6aa); }
    .td-poi-free-rare       { filter: drop-shadow(0 0 6px #3B82F699); }
    .td-poi-free-uncommon   { filter: drop-shadow(0 0 4px #10B98166); }

    @keyframes poiMythic {
      0%,100% { filter: drop-shadow(0 0 6px #EC4899aa); }
      50%     { filter: drop-shadow(0 0 16px #EC4899ee); }
    }
    @keyframes poiLegend {
      0%,100% { filter: drop-shadow(0 0 6px #F59E0B99); }
      50%     { filter: drop-shadow(0 0 14px #F59E0Bdd); }
    }

    /* OWNED — green fill (no per-hex border, see KingdomBorderLayer), rarity glow on POIs */
    .td-own-mythic     { filter: drop-shadow(0 0 7px #EC4899bb); }
    .td-own-legendary  { filter: drop-shadow(0 0 7px #F59E0Bbb); }
    .td-own-epic       { filter: drop-shadow(0 0 6px #8B5CF6aa); }
    .td-own-rare       { filter: drop-shadow(0 0 5px #3B82F699); }

    .td-hex-tower    { animation: poiLegend 2.4s ease-in-out infinite; }

    /* DEF vulnerability window — blinking red (Alex spec) */
    @keyframes vulnPulse {
      0%,100% { filter: drop-shadow(0 0 3px #EF444488); opacity: 0.85; }
      50%     { filter: drop-shadow(0 0 10px #EF4444cc); opacity: 1; }
    }
    .td-hex-vulnerable { animation: vulnPulse 1.2s ease-in-out infinite !important; }
    @media (prefers-reduced-motion: reduce) {
      .td-poi-free-mythic, .td-poi-free-legendary, .td-hex-tower, .td-hex-vulnerable { animation: none !important; }
    }
  `
  document.body.appendChild(s)
}

export interface HexConfig {
  territory: TerritoryLight
  playerId?: string
  onClick: (t: TerritoryLight) => void
  catFilter?: string[]
  rarFilter?: string[]
}

export function makeHexPolygon({ territory: t, playerId, onClick, catFilter, rarFilter }: HexConfig): L.Polygon | null {
  // Compute boundaries: prefer API data, fallback to client-side H3
  let pts: L.LatLngTuple[]
  if (t.boundary_points?.length) {
    pts = (t.boundary_points as [number,number][]).map(p => [p[0],p[1]] as L.LatLngTuple)
  } else if (t.h3_index) {
    const computed = getHexBoundary(t.h3_index)
    if (computed.length === 0) return null
    pts = computed as L.LatLngTuple[]
  } else {
    return null
  }
  const ta = t as any

  const isOwn   = t.owner_id === playerId
  const isEnemy = !!t.owner_id && !isOwn
  const hasPOI  = !!(ta.poi_name || ta.is_landmark)
  const rarity  = ta.rarity || 'common'
  const rc      = RARITY_COLOR[rarity] || '#9CA3AF'
  const customBorder = ta.border_color

  // Fenêtre de vulnérabilité DEF (Alex spec) — visible pour tout le monde
  const isVulnerable = !!(ta.infiltration_window_until &&
    new Date(ta.infiltration_window_until) > new Date())
  const infiltrationCount = ta.infiltration_count || 0

  // Apply POI filters — only affects FREE POI hexes highlight visibility
  // Owned / enemy hexes always shown regardless of filter
  const activeCats = catFilter && catFilter.length ? catFilter : ['all']
  const activeRars = rarFilter && rarFilter.length ? rarFilter : ['all']
  const catMatch = activeCats.includes('all') || activeCats.includes(ta.poi_category || '')
  const rarMatch = activeRars.includes('all') || activeRars.includes(rarity)
  // If POI doesn't match filter: treat as invisible standard hex (but keep interaction)
  const poiVisible = hasPOI && catMatch && rarMatch

  let fill: string, fillOp: number, stroke: string, weight: number, dash: string, cls: string

  if (ta.is_control_tower) {
    fill='#FFB800'; fillOp=0.30; stroke='#FFD24A'; weight=2; dash=''; cls='td-hex-tower'

  } else if (isOwn) {
    // OWN territory: fill only, NO per-hex border
    // The KingdomBorderLayer draws the unified outer border
    fill = ta.fill_color || '#00FF87'   // kingdom colour chosen by the player (customize, scope=kingdom)
    stroke = 'transparent'
    dash = ''

    if (ta.fill_color) {
      fillOp = 0.38; weight = 0; cls = 'td-hex-own-custom'
    } else if (poiVisible) {
      fillOp = 0.30; weight = 0
      cls = rarity === 'mythic'? 'td-own-mythic'
          : rarity === 'legendary' ? 'td-own-legendary'
          : rarity === 'epic'? 'td-own-epic'
          : rarity === 'rare'? 'td-own-rare'
          : 'td-hex-own-std'
    } else {
      fillOp = 0.22; weight = 0; cls = 'td-hex-own-std'
    }

  } else if (isEnemy) {
    // ENEMY: hostile red outline = ownership, fill = rarity value when it is a POI
    fill = poiVisible ? rc : ENEMY_COLOR
    fillOp = poiVisible ? 0.26 : 0.14
    stroke = ENEMY_COLOR
    weight = poiVisible ? 2.2 : 1.6
    dash = ''; cls = 'td-hex-enemy'

  } else if (poiVisible) {
    // FREE POI visible — rarity colour, graded intensity
    fill = rc
    fillOp = rarity==='mythic' ? 0.42 : rarity==='legendary' ? 0.38 : rarity==='epic' ? 0.32 : rarity==='rare' ? 0.26 : rarity==='uncommon' ? 0.18 : 0.12
    stroke = rc; weight = 2; dash = ''
    cls = `td-poi-free-${rarity}`

  } else {
    // Free standard OR filtered-out POI — invisible
    fill='#fff'; fillOp=0.0; stroke='#fff'; weight=0; dash=''; cls=''
  }

  // Override stroke/fill si territoire vulnérable (fenêtre post-infiltration)
  if (isVulnerable && isEnemy) {
    stroke = '#FF2D2D'
    weight = Math.max(weight, 2.6)
    dash   = '6 3'
    cls    = cls + ' td-hex-vulnerable'
  }

  const poly = L.polygon(pts, {
    fillColor:fill, fillOpacity:fillOp,
    color:stroke, weight:weight,
    opacity:0.9, dashArray:dash||undefined,
    className:cls, interactive:true,
  })

  // Tooltip
  // Server value (map-view): plain 100 (+10 in a kingdom) + the tokens on the hex
  const income = Math.round((ta as any).hex_per_day ?? hexPerDay(ta.rarity, ta.is_shiny))
  const nTok = (ta as any).token_count || 0
  const stateLabel = ta.is_control_tower ? 'Control tower'
    : isOwn ? (hasPOI ? `Your territory · ${esc(rarityLabel(rarity))}` : 'Your territory')
    : isEnemy ? esc(ta.owner_username)
    : hasPOI ? `${esc(rarityLabel(rarity))} — Unclaimed`
    : 'Unclaimed'

  const stateColor = ta.is_control_tower ? '#FFD24A' : isOwn ? '#00FF87' : isEnemy ? ENEMY_COLOR : hasPOI ? rc : '#94A3B8'
  const vulnHtml = isVulnerable
    ? `<div style="margin-top:6px;padding:5px 7px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35)">
         <div style="color:#F87171;font-size:10px;font-weight:800;letter-spacing:0.5px">DEFENSES WEAKENED${infiltrationCount >= 3 ? ' (DEF 15%)' : ' (DEF 50%)'}</div>
         <div style="color:rgba(255,255,255,0.6);font-size:10px;margin-top:1px">Infiltration${infiltrationCount >= 3 ? ' ×3' : ''} — assault window open</div>
       </div>`
    : ''

  poly.bindTooltip(`
    <div style="line-height:1.45;font-family:system-ui,sans-serif;min-width:170px;letter-spacing:0">
      <div style="font-family:'Orbitron',sans-serif;font-weight:800;color:#fff;font-size:12px;letter-spacing:0.5px">${esc(ta.custom_name || ta.poi_name || ta.place_name || 'Zone ' + t.h3_index.slice(0,6))}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:3px;color:${stateColor};font-size:11px;font-weight:700">
        <span style="width:7px;height:7px;border-radius:2px;transform:rotate(45deg);background:${stateColor};box-shadow:0 0 6px ${stateColor}"></span>${stateLabel}
      </div>
      ${hasPOI ? `<div style="color:${rc};font-size:10px;font-weight:700;margin-top:2px;text-transform:uppercase;letter-spacing:1px">${esc(ta.poi_category)}</div>` : ''}
      <div style="margin-top:4px;color:#34D399;font-size:11px;font-family:'Share Tech Mono',monospace">+${income.toLocaleString()} HEX/day${nTok ? ` · ${nTok} token${nTok > 1 ? 's' : ''}` : ''}</div>
      ${vulnHtml}
    </div>
  `, { className:'td-tooltip', direction:'top', sticky:true })

  // POI hex at a high zoom: hovering clears its fill so the place itself shows through (owner 2026-10-25)
  if (hasPOI) {
    poly.on('mouseover', () => { const m = (poly as any)._map; if (m && m.getZoom() >= 14) poly.setStyle({ fillOpacity: 0 }) })
    poly.on('mouseout', () => poly.setStyle({ fillOpacity: fillOp }))
  }
  poly.on('click', () => onClick(t))
  return poly
}
