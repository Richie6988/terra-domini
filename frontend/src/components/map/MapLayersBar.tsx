/**
 * MapLayersBar — top-centre toggles of the map (owner 2026-10-19: "map layers on top"): which token families are drawn
 * (places, resources, species — store.tokenFilter, read by GameMap and PoiOverviewLayer) and the AR info layer
 * (biome, coordinates, scale, compass — store.mapInfo).
 */
import { IconSVG } from '../shared/iconBank'
import { useStore } from '../../store'
import type { TokenKind } from '../../store'

const KINDS: { k: TokenKind; label: string; icon: string; color: string }[] = [
  { k: 'places', label: 'Places', icon: 'monument', color: '#fbbf24' },
  { k: 'resources', label: 'Resources', icon: 'oil_barrel', color: '#f97316' },
  { k: 'species', label: 'Species', icon: 'lion', color: '#4ade80' },
]

export function MapLayersBar() {
  const tf = useStore(s => s.tokenFilter)
  const toggle = useStore(s => s.toggleTokenKind)
  const info = useStore(s => s.mapInfo)
  const toggleInfo = useStore(s => s.toggleMapInfo)
  const chip = (on: boolean, onClick: () => void, icon: string, label: string, color: string) => (
    <button key={label} onClick={onClick} aria-pressed={on} title={`${on ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      className="hxl-chip" style={{ ['--c' as any]: color, opacity: on ? 1 : 0.5 }}>
      <span style={{ display: 'inline-flex', filter: on ? 'none' : 'grayscale(1)' }}><IconSVG id={icon} size={16} /></span>
      <span className="hxl-chip__label">{label}</span>
    </button>
  )
  return (
    <div className="hxl-bar" role="toolbar" aria-label="Map layers">
      <style>{`
        .hxl-bar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: auto; display: flex; gap: 4px; padding: 4px;
          border-radius: 999px; background: rgba(13,27,42,0.92); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 14px rgba(0,0,0,0.45); }
        .hxl-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 8px; border-radius: 999px; cursor: pointer;
          border: 1px solid transparent; background: transparent; color: #fff; font: 11px 'Lilita One', sans-serif; letter-spacing: .5px;
          transition: background .15s, border-color .15s, opacity .15s; }
        .hxl-chip[aria-pressed="true"] { background: color-mix(in srgb, var(--c) 18%, transparent); border-color: color-mix(in srgb, var(--c) 55%, transparent); }
        .hxl-sep { width: 1px; margin: 5px 2px; background: rgba(255,255,255,0.12); }
        @media (max-width: 640px) { .hxl-bar { position: fixed; left: auto; right: 12px; top: 128px; transform: none; flex-direction: column; border-radius: 18px; }
          .hxl-sep { width: auto; height: 1px; margin: 2px 5px; } .hxl-chip__label { display: none; } .hxl-chip { padding: 0 7px; } }
      `}</style>
      {KINDS.map(t => chip(!!tf[t.k], () => toggle(t.k), t.icon, t.label, t.color))}
      <span className="hxl-sep" />
      {chip(info, toggleInfo, 'compass', 'Map info', '#fde68a')}
    </div>
  )
}
