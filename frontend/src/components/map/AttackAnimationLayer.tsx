/**
 * AttackAnimationLayer — animations Leaflet lors d'une attaque.
 *
 * Triggered par l'event global 'hexod:attack' dispatché depuis ConquestActions
 * après lancement d'une attaque.
 *
 * Visuels :
 *   1. Flèche rouge animée source → cible (SVG Leaflet polyline + dasharray)
 *   2. Hex cible pulse rouge intense pendant la durée de l'attaque
 *   3. Explosion SVG sur la cible à la résolution (victoire/défaite)
 *   4. Particules flottantes rouge/orange
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useLeafletLayer } from '../ui/Utils'
import { cellToBoundary, cellToLatLng } from 'h3-js'

interface AttackEvent {
  sourceH3:  string
  targetH3:  string
  duration:  number  // ms
  result?:   'victory' | 'defeat' | 'pending'
}

interface Props { map: L.Map | null }

// Injecte les keyframes CSS pour les animations
function injectAttackStyles() {
  if (document.getElementById('td-attack-styles')) return
  const s = document.createElement('style')
  s.id = 'td-attack-styles'
  s.textContent = `
    @keyframes attackArrow {
      0%   { stroke-dashoffset: 200; opacity: 0.3; }
      50%  { opacity: 1; }
      100% { stroke-dashoffset: 0; opacity: 0.8; }
    }
    @keyframes attackPulse {
      0%,100% { filter: drop-shadow(0 0 8px #EF4444cc); }
      50%     { filter: drop-shadow(0 0 28px #EF4444ff) drop-shadow(0 0 56px #EF444488); }
    }
    @keyframes victoryBurst {
      0%   { transform: scale(0); opacity: 1; }
      60%  { transform: scale(1.4); opacity: 0.9; }
      100% { transform: scale(2); opacity: 0; }
    }
    @keyframes defeatCrumble {
      0%   { transform: scale(1); opacity: 1; }
      40%  { transform: scale(0.95) rotate(-2deg); }
      100% { transform: scale(0.7); opacity: 0; }
    }
    @keyframes floatUp {
      0%   { transform: translateY(0); opacity: 1; }
      100% { transform: translateY(-40px); opacity: 0; }
    }
    .td-attack-arrow { animation: attackArrow 0.8s ease-out forwards; }
    .td-attack-target { animation: attackPulse 0.6s ease-in-out infinite; }
  `
  document.head.appendChild(s)
}

export function AttackAnimationLayer({ map }: Props) {
  const _layerFromHook = useLeafletLayer(map)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    injectAttackStyles()
  }, [])

  useEffect(() => {
    if (!map) return
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map)

    const handleAttack = (e: Event) => {
      const { sourceH3, targetH3, duration, result } = (e as CustomEvent<AttackEvent>).detail
      const layer = layerRef.current!

      // Coords
      let srcLatLng: [number, number] | null = null
      let tgtLatLng: [number, number] | null = null
      let tgtBoundary: [number, number][] = []
      try {
        const src = cellToLatLng(sourceH3)
        const tgt = cellToLatLng(targetH3)
        srcLatLng = [src[0], src[1]]
        tgtLatLng = [tgt[0], tgt[1]]
        tgtBoundary = cellToBoundary(targetH3) as [number, number][]
      } catch { return }

      // ── 1. Flèche animée source → cible ─────────────────────────────────
      const arrow = L.polyline([srcLatLng, tgtLatLng], {
        color: '#EF4444',
        weight: 3,
        opacity: 0.9,
        dashArray: '12 6',
        className: 'td-attack-arrow',
      })
      layer.addLayer(arrow)

      // Tête de flèche au milieu de la trajectory
      const midLat = (srcLatLng[0] + tgtLatLng[0]) / 2
      const midLon = (srcLatLng[1] + tgtLatLng[1]) / 2
      const arrowHead = L.divIcon({
        html: `<div style="
          font-size:20px;
          animation: floatUp 1s ease-out 0.3s forwards;
          transform-origin: center;
          filter: drop-shadow(0 0 6px #EF4444);
        "></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      const arrowMarker = L.marker([midLat, midLon], { icon: arrowHead })
      layer.addLayer(arrowMarker)

      // ── 2. Hex cible — pulse rouge ───────────────────────────────────────
      const targetPoly = L.polygon(tgtBoundary, {
        fillColor: '#EF4444',
        fillOpacity: 0.35,
        color: '#EF4444',
        weight: 4,
        className: 'td-attack-target',
      })
      layer.addLayer(targetPoly)

      // Labels flottants sur la cible (dégâts simulés)
      const floatingLabels = ['ATTAQUE', 'IMPACT', 'SIÈGE']
      floatingLabels.forEach((label, i) => {
        const offset = (i - 1) * 0.001
        const floatIcon = L.divIcon({
          html: `<div style="
            color: #EF4444; font-size: 11px; font-weight: 900;
            font-family: 'Arial Black', Arial;
            text-shadow: 0 0 8px #EF4444, 0 2px 4px rgba(0,0,0,0.8);
            animation: floatUp 1.2s ease-out ${i * 0.3}s forwards;
            white-space: nowrap; pointer-events: none;
          ">${label}</div>`,
          className: '',
          iconSize: [100, 20],
          iconAnchor: [50, 10],
        })
        const m = L.marker(
          [tgtLatLng![0] + offset, tgtLatLng![1] + offset * 0.5],
          { icon: floatIcon, interactive: false }
        )
        layer.addLayer(m)
        setTimeout(() => layer.removeLayer(m), 1200 + i * 300)
      })

      // ── 3. Résolution à la fin de l'attaque ──────────────────────────────
      setTimeout(() => {
        // Supprimer flèche + pulse
        layer.removeLayer(arrow)
        layer.removeLayer(arrowMarker)
        layer.removeLayer(targetPoly)

        if (result === 'victory' || result === 'defeat') {
          _playResolutionAnim(layer, tgtLatLng!, tgtBoundary, result)
        }
      }, duration)
    }

    window.addEventListener('hexod:attack', handleAttack)
    return () => window.removeEventListener('hexod:attack', handleAttack)
  }, [map])

  useEffect(() => () => { layerRef.current?.remove() }, [])
  return null
}

function _playResolutionAnim(
  layer: L.LayerGroup,
  center: [number, number],
  boundary: [number, number][],
  result: 'victory' | 'defeat'
) {
  const isVictory = result === 'victory'
  const color = isVictory ? '#00FF87' : '#6B7280'
  const emoji = isVictory ? '' : '×'
  const label = isVictory ? 'VICTOIRE !' : 'DÉFAITE'

  // Flash hex résultat
  const resultPoly = L.polygon(boundary, {
    fillColor: color,
    fillOpacity: 0.5,
    color,
    weight: 5,
    className: '',
  })
  layer.addLayer(resultPoly)

  // Icône résultat
  const resultIcon = L.divIcon({
    html: `<div style="
      font-size: 36px;
      animation: victoryBurst 1s ease-out forwards;
      transform-origin: center;
      filter: drop-shadow(0 0 12px ${color});
    ">${emoji}</div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
  const resultMarker = L.marker(center, { icon: resultIcon })
  layer.addLayer(resultMarker)

  // Label résultat flottant
  const labelIcon = L.divIcon({
    html: `<div style="
      color: ${color}; font-size: 16px; font-weight: 900;
      font-family: 'Arial Black', Arial;
      text-shadow: 0 0 12px ${color}, 0 2px 4px rgba(0,0,0,0.9);
      animation: floatUp 1.5s ease-out 0.3s forwards;
      white-space: nowrap; pointer-events: none;
    ">${label}</div>`,
    className: '',
    iconSize: [120, 24],
    iconAnchor: [60, 12],
  })
  const labelMarker = L.marker([center[0] + 0.0005, center[1]], { icon: labelIcon, interactive: false })
  layer.addLayer(labelMarker)

  // Nettoyage
  setTimeout(() => {
    layer.removeLayer(resultPoly)
    layer.removeLayer(resultMarker)
    layer.removeLayer(labelMarker)
  }, 2000)
}

// Helper pour déclencher l'animation depuis ConquestActions
export function triggerAttackAnimation(
  sourceH3: string,
  targetH3: string,
  duration: number,
  result?: 'victory' | 'defeat'
) {
  window.dispatchEvent(new CustomEvent('hexod:attack', {
    detail: { sourceH3, targetH3, duration, result } as any,
  }))
}
