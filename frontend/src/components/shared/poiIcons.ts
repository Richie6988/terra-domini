/** POI category → iconBank icon (shared by the token, the map overview and the codex). */
import { getIcon } from './iconBank'

// Every token category (POICategory in events/unified_poi.py + the species_* families) has its own icon in the
// cat_<category> set of iconBank: one badge style, colour = family (places, nature, resources, strategic, economy,
// tech, mystery, species).
export const TOKEN_CATEGORIES = [
  'mountain_peak', 'volcano', 'canyon', 'waterfall', 'glacier', 'cave_system', 'coral_reef', 'ancient_forest',
  'nature_sanctuary', 'island', 'lake', 'desert',
  'oil_field', 'gas_reserve', 'gold_mine', 'diamond_mine', 'rare_earth', 'lithium_deposit', 'uranium_mine', 'coal_mine',
  'iron_ore', 'copper_mine', 'freshwater', 'fertile_land', 'agri_megafarm', 'seed_vault',
  'military_base', 'naval_base', 'missile_site', 'intelligence_hq', 'chokepoint', 'alliance_hq',
  'financial_hub', 'stock_exchange', 'trade_node', 'mega_port', 'offshore_haven', 'oligarch_asset', 'casino_resort',
  'international_org', 'tech_giant', 'media_hq',
  'nuclear_plant', 'space_center', 'data_center', 'semiconductor', 'internet_cable', 'ix_point', 'control_tower',
  'mega_dam', 'water_treatment', 'desalination', 'steel_mill', 'pharma_hq', 'research_station', 'particle_collider',
  'observatory', 'infrastructure',
  'capital_city', 'country', 'world_heritage', 'ancient_ruins', 'religious_site', 'royal_palace', 'museum',
  'ancient_wonder', 'history_event', 'news_event', 'sports_arena',
  'conspiracy', 'secret_facility', 'anomaly',
  // Living species tokens (layer 3 of the fixed map table)
  'species_animal', 'species_bird', 'species_marine', 'species_fossil', 'species_insect', 'species_vegetal',
  'species_mushroom', 'species_microorganism',
]
// Resource tokens keep the owner's own resource icons (owner 2026-10-20: "my designs were better" — res_* set)
const RESOURCE_ICON: Record<string, string> = {
  oil_field: 'oil_barrel', gas_reserve: 'flame', coal_mine: 'res_charbon', gold_mine: 'res_or', iron_ore: 'res_fer',
  copper_mine: 'res_composants', rare_earth: 'res_terres_rares', uranium_mine: 'res_uranium', lithium_deposit: 'res_lithium',
  diamond_mine: 'diamond_blue', freshwater: 'water_drop', fertile_land: 'wheat', agri_megafarm: 'farm',
}
export const ICON_ALIAS: Record<string, string> = Object.fromEntries(TOKEN_CATEGORIES.map(c => [c, RESOURCE_ICON[c] || `cat_${c}`]))
/** Icon id for a POI category (falls back to the category itself) */
export const iconIdFor = (id?: string) => { const k = (id || '').toLowerCase(); return ICON_ALIAS[k] || k || 'city' }
export const iconFor = (id?: string) => getIcon(iconIdFor(id))

/** Map filter family of a token category: species_* → species, extraction sites → resources, the rest → places. */
const RESOURCE_SITES = new Set(['oil_field', 'gas_reserve', 'coal_mine', 'gold_mine', 'diamond_mine', 'rare_earth', 'iron_ore',
  'copper_mine', 'lithium_deposit', 'uranium_mine'])
export const tokenKind = (cat?: string | null): 'places' | 'resources' | 'species' =>
  (cat || '').startsWith('species_') ? 'species' : RESOURCE_SITES.has(cat || '') ? 'resources' : 'places'
