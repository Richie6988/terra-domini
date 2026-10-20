/**
 * MapCategoryFilter — left column button (below HARVEST, above the saved places) opening the token category filter
 * (owner 2026-10-20): every category with its icon (poiIcons cat_ set), tap to hide / show it on the map; it replaced
 * the places / resources / species bar. MAP INFO toggles the AR layer (biome, coordinates, scale, compass).
 * store.hiddenCats is read by GameMap (hex icons) and PoiOverviewLayer (zoomed-out markers).
 */
import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useStore } from '../../store'
import { IconSVG } from '../shared/iconBank'
import { TOKEN_CATEGORIES, iconIdFor } from '../shared/poiIcons'

const FAMILIES: [string, string[]][] = [
  ['PLACES', ['capital_city', 'country', 'world_heritage', 'ancient_ruins', 'ancient_wonder', 'religious_site', 'royal_palace', 'museum', 'history_event', 'news_event', 'sports_arena']],
  ['NATURE', ['mountain_peak', 'volcano', 'canyon', 'waterfall', 'glacier', 'cave_system', 'coral_reef', 'ancient_forest', 'nature_sanctuary', 'island', 'desert']],
  ['RESOURCES', ['oil_field', 'gas_reserve', 'gold_mine', 'diamond_mine', 'rare_earth', 'lithium_deposit', 'uranium_mine', 'coal_mine', 'iron_ore', 'copper_mine', 'freshwater', 'fertile_land', 'agri_megafarm', 'seed_vault']],
  ['STRATEGIC', ['military_base', 'naval_base', 'missile_site', 'intelligence_hq', 'chokepoint', 'alliance_hq', 'control_tower']],
  ['ECONOMY & TECH', ['financial_hub', 'stock_exchange', 'trade_node', 'mega_port', 'offshore_haven', 'oligarch_asset', 'casino_resort', 'international_org', 'tech_giant', 'media_hq',
    'nuclear_plant', 'space_center', 'data_center', 'semiconductor', 'internet_cable', 'ix_point', 'mega_dam', 'water_treatment', 'desalination', 'steel_mill', 'pharma_hq', 'research_station', 'particle_collider', 'observatory', 'infrastructure']],
  ['MYSTERY', ['conspiracy', 'secret_facility', 'anomaly']],
  ['SPECIES', TOKEN_CATEGORIES.filter(c => c.startsWith('species_'))],
]
const nice = (c: string) => c.replace(/^species_/, '').replace(/_/g, ' ')

export function MapCategoryFilter() {
  const [open, setOpen] = useState(false)
  const hidden = useStore(s => s.hiddenCats)
  const setHidden = useStore(s => s.setHiddenCats)
  const mapInfo = useStore(s => s.mapInfo)
  const toggleMapInfo = useStore(s => s.toggleMapInfo)
  const toggle = (c: string) => setHidden(hidden.includes(c) ? hidden.filter(x => x !== c) : [...hidden, c])
  const setFamily = (cats: string[], show: boolean) =>
    setHidden(show ? hidden.filter(x => !cats.includes(x)) : [...new Set([...hidden, ...cats])])
  return (
    <div className="hx-catfilter">
      <button className="hx-catfilter__btn" onClick={() => setOpen(o => !o)} aria-label="Filter token categories"
        style={hidden.length ? { borderColor: '#fde68a', color: '#fde68a' } : undefined}>
        <SlidersHorizontal size={17} />
        <span>FILTER</span>
        {hidden.length > 0 && <span className="hx-catfilter__count">{TOKEN_CATEGORIES.length - hidden.length}</span>}
      </button>
      {open && (
        <div className="hx-catfilter__panel hx-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="hx-section-title" style={{ margin: 0 }}>TOKEN CATEGORIES</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="hx-chip" onClick={toggleMapInfo} style={mapInfo ? { color: '#fde68a', borderColor: '#fde68a' } : undefined}>MAP INFO</button>
              <button className="hx-chip" onClick={() => setHidden([])}>ALL</button>
              <button className="hx-chip" onClick={() => setHidden([...TOKEN_CATEGORIES])}>NONE</button>
            </span>
          </div>
          {FAMILIES.map(([fam, cats]) => {
            const allOn = cats.every(c => !hidden.includes(c))
            return (
              <div key={fam} style={{ marginBottom: 8 }}>
                <button onClick={() => setFamily(cats, !allOn)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  font: "800 10px var(--font-body)", letterSpacing: 1.5, color: allOn ? 'var(--hx-text-2)' : 'var(--hx-text-3)', marginBottom: 4 }}>
                  {fam} {allOn ? '· HIDE ALL' : '· SHOW ALL'}</button>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
                  {cats.map(c => {
                    const on = !hidden.includes(c)
                    return (
                      <button key={c} onClick={() => toggle(c)} title={nice(c)} className="hx-catfilter__cat" style={{ opacity: on ? 1 : 0.35 }}>
                        <IconSVG id={iconIdFor(c)} size={28} />
                        <span>{nice(c)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
