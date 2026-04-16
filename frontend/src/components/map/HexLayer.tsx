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
import L from 'leaflet'
import * as h3 from 'h3-js'
import type { TerritoryLight } from '../../types'
import { EmojiIcon } from '../shared/emojiIcons'

const RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
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
    <filter id="gf-green"  x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-gold"   x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gf-blue"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
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
    /* FREE POI — rarity pulse (what user loves) */
    .td-poi-free-mythic     { animation: poiMythic 2s ease-in-out infinite; }
    .td-poi-free-legendary  { animation: poiLegend 2.5s ease-in-out infinite; }
    .td-poi-free-epic       { animation: poiEpic 3s ease-in-out infinite; }
    .td-poi-free-rare       { filter: drop-shadow(0 0 7px #3B82F6cc) !important; }
    .td-poi-free-uncommon   { filter: drop-shadow(0 0 5px #10B98188) !important; }

    @keyframes poiMythic {
      0%,100% { filter: drop-shadow(0 0 9px #EC4899cc); }
      50%     { filter: drop-shadow(0 0 22px #EC4899ff) drop-shadow(0 0 44px #EC489966); }
    }
    @keyframes poiLegend {
      0%,100% { filter: drop-shadow(0 0 8px #F59E0Bbb); }
      50%     { filter: drop-shadow(0 0 20px #F59E0Bff) drop-shadow(0 0 38px #F59E0B55); }
    }
    @keyframes poiEpic {
      0%,100% { filter: drop-shadow(0 0 6px #8B5CF6aa); }
      50%     { filter: drop-shadow(0 0 15px #8B5CF6ff) drop-shadow(0 0 30px #8B5CF644); }
    }

    /* OWNED — green fill, rarity border pulse */
    .td-own-mythic     { animation: ownMythic 2.5s ease-in-out infinite; }
    .td-own-legendary  { animation: ownLegend 3s ease-in-out infinite; }
    .td-own-epic       { filter: drop-shadow(0 0 6px #8B5CF6cc) !important; }
    .td-own-rare       { filter: drop-shadow(0 0 5px #3B82F6cc) !important; }

    @keyframes ownMythic {
      0%,100% { filter: drop-shadow(0 0 6px #00FF8799) drop-shadow(0 0 4px #EC4899aa); }
      50%     { filter: drop-shadow(0 0 10px #00FF87cc) drop-shadow(0 0 16px #EC4899cc); }
    }
    @keyframes ownLegend {
      0%,100% { filter: drop-shadow(0 0 5px #00FF8788) drop-shadow(0 0 4px #F59E0Baa); }
      50%     { filter: drop-shadow(0 0 9px #00FF87bb) drop-shadow(0 0 14px #F59E0Bcc); }
    }

    .td-hex-own-std  { filter: drop-shadow(0 0 5px rgba(0,255,135,0.8)); }
    .td-hex-enemy    { filter: drop-shadow(0 0 4px rgba(99,145,255,0.6)); }
    .td-hex-tower    { animation: poiLegend 2s ease-in-out infinite; }

    /* Vulnérabilité DEF — rouge clignotant (Alex spec) */
    @keyframes vulnPulse {
      0%,100% { filter: drop-shadow(0 0 4px #EF444488); opacity: 0.85; }
      50%     { filter: drop-shadow(0 0 12px #EF4444cc) drop-shadow(0 0 6px #FF000088); opacity: 1; }
    }
    .td-hex-vulnerable { animation: vulnPulse 1.2s ease-in-out infinite !important; }
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
    fill='#FFB800'; fillOp=0.45; stroke='#FFD700'; weight=2.5; dash=''; cls='td-hex-tower'

  } else if (isOwn) {
    const borderCol = customBorder || (poiVisible ? rc : '#00FF87')
    fill = '#00FF87'
    stroke = borderCol
    dash = ''

    if (poiVisible) {
      fillOp = 0.38; weight = 4
      cls = rarity === 'mythic'    ? 'td-own-mythic'
          : rarity === 'legendary' ? 'td-own-legendary'
          : rarity === 'epic'      ? 'td-own-epic'
          : rarity === 'rare'      ? 'td-own-rare'
          : 'td-hex-own-std'
    } else {
      fillOp = 0.32; weight = 2.5; cls = 'td-hex-own-std'
    }

  } else if (isEnemy) {
    fill = poiVisible ? rc : '#4B8BF5'
    fillOp = poiVisible ? 0.28 : 0.22
    stroke = poiVisible ? rc : '#60A5FA'
    weight = poiVisible ? 2.5 : 1.5
    dash = ''; cls = 'td-hex-enemy'

  } else if (poiVisible) {
    // FREE POI visible — rarity pulse
    fill = rc
    fillOp = rarity==='mythic' ? 0.60 : rarity==='legendary' ? 0.52 : rarity==='epic' ? 0.42 : rarity==='rare' ? 0.32 : rarity==='uncommon' ? 0.22 : 0.14
    stroke = rc; weight = 4; dash = ''
    cls = `td-poi-free-${rarity}`

  } else {
    // Free standard OR filtered-out POI — invisible
    fill='#fff'; fillOp=0.0; stroke='#fff'; weight=0; dash=''; cls=''
  }

  // Override stroke/fill si territoire vulnérable (fenêtre post-infiltration)
  if (isVulnerable && isEnemy) {
    stroke = '#EF4444'
    weight = Math.max(weight, 3)
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
  const income = Math.round((ta.resource_credits || ta.food_per_tick || 10) * 288)
  const stateLabel = ta.is_control_tower ? '<EmojiIcon emoji="🗼" /> Tour de contrôle'
    : isOwn ? (hasPOI ? `✅ Votre territoire · ${rarity}` : '✅ Votre territoire')
    : isEnemy ? `<EmojiIcon emoji="👤" /> ${ta.owner_username}`
    : hasPOI ? `⬡ ${rarity.toUpperCase()} — Libre`
    : '⬜ Libre'

  const vulnHtml = isVulnerable
    ? `<div style="color:#EF4444;font-size:10px;font-weight:800;margin-top:3px">
         🔓 DÉFENSES AFFAIBLIES${infiltrationCount >= 3 ? ' (DEF 15%)' : ' (DEF 50%)'}
         <br/><span style="color:#6B7280;font-weight:400">Infiltration${infiltrationCount >= 3 ? ' ×3' : ''} — Opportunité d'assaut !</span>
       </div>`
    : ''

  poly.bindTooltip(`
    <div style="font-size:11px;line-height:1.7;font-family:system-ui;min-width:160px">
      <div style="font-weight:900;color:#fff;font-size:13px">${ta.custom_name || ta.poi_name || ta.place_name || 'Zone ' + t.h3_index.slice(0,6)}</div>
      <div style="color:${isOwn ? '#00FF87' : hasPOI ? rc : '#9CA3AF'}">${stateLabel}</div>
      ${hasPOI ? `<div style="color:${rc};font-size:10px;font-weight:700">${ta.poi_category||''}</div>` : ''}
      <div style="color:#10B981;font-size:10px">+${income} HEX Coin/jour</div>
      ${vulnHtml}
    </div>
  `, { className:'td-tooltip', direction:'top', sticky:true })

  poly.on('click', () => onClick(t))
  return poly
}
