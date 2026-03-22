/**
 * HexLayer — H3 territory polygons on Leaflet.
 *
 * Territory types:
 *   owned-own   → green glow
 *   owned-enemy → blue glow
 *   poi-free    → rarity color glow (pulsing for legendary/mythic)
 *   standard    → faint white dashed ghost on hover only
 *
 * POI is NOT a sublayer — it IS the territory identity.
 * A hex with a POI has the POI's rarity/color baked into the polygon itself.
 */
import L from 'leaflet'
import type { TerritoryLight } from '../../types'

const RARITY_COLOR: Record<string, string> = {
  common:   '#9CA3AF',
  uncommon: '#10B981',
  rare:     '#3B82F6',
  epic:     '#8B5CF6',
  legendary:'#F59E0B',
  mythic:   '#EC4899',
}

const RARITY_FILL_OPACITY: Record<string, number> = {
  common:   0.08, uncommon: 0.12, rare: 0.16,
  epic:     0.20, legendary: 0.25, mythic: 0.30,
}

// Inject SVG glow filters once
export function injectGlowFilter() {
  if (document.getElementById('td-svg-filters')) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('id', 'td-svg-filters')
  svg.setAttribute('style', 'position:absolute;width:0;height:0')
  svg.innerHTML = `
    <defs>
      <filter id="glow-green"    x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow-gold"     x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow-blue"     x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow-mythic"   x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow-red"      x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
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
  const pts = (t.boundary_points as [number, number][]).map(p => [p[0], p[1]] as L.LatLngTuple)

  const isOwn   = t.owner_id === playerId
  const isEnemy = !!t.owner_id && !isOwn
  const isFree  = !t.owner_id
  const ta      = t as any

  const rarity  = ta.rarity || 'common'
  const hasPOI  = !!(ta.poi_name || ta.is_landmark)
  const isShiny = !!ta.is_shiny
  const rarityColor = RARITY_COLOR[rarity] || '#9CA3AF'

  // ── Visual config ─────────────────────────────────────────
  let fill: string, fillOp: number, stroke: string, weight: number,
      dash: string, cssClass: string, glowFilter: string

  if (ta.is_control_tower) {
    fill = '#FFB800'; fillOp = 0.45; stroke = '#FFD700'; weight = 2.5
    dash = '6,3'; cssClass = 'td-hex-tower'; glowFilter = 'url(#glow-gold)'

  } else if (isOwn) {
    // Owned: use custom border_color if set, else spec green
    const ownColor = ta.border_color || '#00FF87'
    fill   = ownColor; fillOp = 0.35; stroke = ownColor; weight = 2.5
    dash   = ''; cssClass = 'td-hex-own'; glowFilter = 'url(#glow-green)'

    // POI owned: richer border
    if (hasPOI) {
      fill   = rarityColor; fillOp = RARITY_FILL_OPACITY[rarity] + 0.1
      stroke = rarityColor; weight = 3
      glowFilter = rarity === 'mythic' ? 'url(#glow-mythic)' : 'url(#glow-gold)'
    }

  } else if (isEnemy) {
    fill = '#4B8BF5'; fillOp = 0.25; stroke = '#60A5FA'; weight = 1.5
    dash = ''; cssClass = 'td-hex-enemy'; glowFilter = 'url(#glow-blue)'

    if (hasPOI) {
      fill   = rarityColor; fillOp = RARITY_FILL_OPACITY[rarity]
      stroke = rarityColor; weight = 2
    }

  } else {
    // Free territory
    if (hasPOI) {
      // POI hex = always visible, highlighted like "selected" — the hex IS the POI
      // No logo, no icon — the hex polygon itself is the visual identity
      fill   = rarityColor
      fillOp = rarity === 'mythic' ? 0.45 : rarity === 'legendary' ? 0.38 : rarity === 'epic' ? 0.30 : rarity === 'rare' ? 0.22 : 0.16
      stroke = rarityColor; weight = 3; dash = ''
      cssClass = `td-hex-poi td-hex-poi-${rarity}`
      glowFilter = rarity === 'mythic'    ? 'url(#glow-mythic)'
                 : rarity === 'legendary' ? 'url(#glow-gold)'
                 : rarity === 'epic'      ? 'url(#glow-mythic)'
                 : rarity === 'rare'      ? 'url(#glow-blue)'
                 : 'none'
    } else {
      fill = '#fff'; fillOp = 0.0; stroke = '#fff'; weight = 0
      dash = ''; cssClass = 'td-hex-free'; glowFilter = 'none'
    }
  }

  const poly = L.polygon(pts, {
    fillColor:    fill,
    fillOpacity:  fillOp,
    color:        stroke,
    weight:       weight,
    opacity:      0.85,
    dashArray:    dash || undefined,
    className:    cssClass,
  })

  // ── Tooltip ────────────────────────────────────────────────
  const stateLabel = ta.is_control_tower ? '🗼 Tour de contrôle'
    : isOwn   ? '🟢 Votre territoire'
    : isEnemy ? `👤 ${ta.owner_username}`
    : hasPOI  ? `📍 POI · ${rarity}`
    : '⬜ Libre'

  const poiLine = hasPOI
    ? `<div style="color:${rarityColor};font-size:10px;font-weight:700;margin-top:2px">
         ${ta.poi_emoji || '📍'} ${ta.poi_name}${isShiny ? ' ✨' : ''}
       </div>`
    : ''

  const incomeVal = ta.resource_credits || ta.food_per_tick || 10
  const incomeLine = `<div style="color:#10B981;font-size:10px">+${Math.round(incomeVal)} HEX Coin/jour</div>`
  const nftLine = ta.token_id ? `<div style="color:#8B5CF6;font-size:9px">NFT #${ta.token_id}</div>` : ''

  poly.bindTooltip(`
    <div style="font-size:11px;line-height:1.6;font-family:system-ui,sans-serif;min-width:160px;max-width:220px">
      <div style="font-weight:800;color:#fff;font-size:12px">${ta.custom_name || ta.poi_name || ta.place_name || 'Zone ' + t.h3_index.slice(0,6)}</div>
      <div style="color:#9CA3AF">${stateLabel}</div>
      ${poiLine}
      ${incomeLine}
      ${nftLine}
      <div style="color:#374151;font-size:9px;margin-top:3px">${t.h3_index.slice(0,14)}…</div>
    </div>
  `, { className: 'td-tooltip', direction: 'top', sticky: true })

  poly.on('click', () => onClick(t))

  return poly
}

// ── CSS for animations (injected once) ──────────────────────
export function injectHexAnimations() {
  if (document.getElementById('td-hex-animations')) return
  const style = document.createElement('style')
  style.id = 'td-hex-animations'
  style.textContent = `
    /* POI pulse animations by rarity */
    .td-hex-poi-legendary path,
    .td-hex-poi-legendary {
      animation: hexPulseLegendary 2.5s ease-in-out infinite !important;
    }
    .td-hex-poi-mythic path,
    .td-hex-poi-mythic {
      animation: hexPulseMythic 2s ease-in-out infinite !important;
    }
    .td-hex-poi-epic {
      animation: hexPulseEpic 3s ease-in-out infinite !important;
    }
    .td-hex-tower {
      animation: td-pulse 2s ease-in-out infinite !important;
    }
    @keyframes hexPulseLegendary {
      0%,100% { filter: drop-shadow(0 0 6px #F59E0Baa); opacity: 0.85; }
      50%      { filter: drop-shadow(0 0 14px #F59E0Bff) drop-shadow(0 0 28px #F59E0B55); opacity: 1; }
    }
    @keyframes hexPulseMythic {
      0%,100% { filter: drop-shadow(0 0 8px #EC4899cc); opacity: 0.85; }
      50%      { filter: drop-shadow(0 0 20px #EC4899ff) drop-shadow(0 0 40px #EC489966); opacity: 1; }
    }
    @keyframes hexPulseEpic {
      0%,100% { filter: drop-shadow(0 0 5px #8B5CF6aa); }
      50%      { filter: drop-shadow(0 0 12px #8B5CF6ff); }
    }
    @keyframes td-pulse {
      0%,100% { filter: drop-shadow(0 0 8px rgba(255,184,0,0.9)); }
      50%      { filter: drop-shadow(0 0 16px rgba(255,184,0,1.0)); }
    }
    .td-hex-own     { filter: drop-shadow(0 0 6px rgba(0,255,135,0.8)); }
    .td-hex-enemy   { filter: drop-shadow(0 0 4px rgba(99,145,255,0.6)); }
    .td-hex-poi-rare { filter: drop-shadow(0 0 6px #3B82F6aa); }
  `
  document.body.appendChild(style)
}
