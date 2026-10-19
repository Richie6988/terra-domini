/** POI category → iconBank icon (shared by the token, the map overview and the codex). */
import { getIcon } from './iconBank'

// POI categories without a dedicated icon → closest icon (instead of the '?' fallback)
export const ICON_ALIAS: Record<string, string> = {
  capital_city: 'city', financial_hub: 'money_bag', stock_exchange: 'chart_up', trade_node: 'port', mega_port: 'port',
  ancient_ruins: 'history', world_heritage: 'monument', religious_site: 'cult', royal_palace: 'castle',
  nature_sanctuary: 'forest', ancient_forest: 'forest', mountain_peak: 'mountain', cave_system: 'cave',
  coral_reef: 'ocean', oil_field: 'oil_barrel', gas_reserve: 'flame', gold_mine: 'mine', diamond_mine: 'diamond_blue',
  copper_mine: 'mine', iron_ore: 'mine', coal_mine: 'mine', uranium_mine: 'nuclear', lithium_deposit: 'battery',
  rare_earth: 'crystal', nuclear_plant: 'nuclear', space_center: 'rocket', military_base: 'war', naval_base: 'ship',
  missile_site: 'bomb', intelligence_hq: 'intelligence', international_org: 'diplomacy', tech_giant: 'tech',
  control_tower: 'tower', ancient_wonder: 'wonder', sports_arena: 'sport', freshwater: 'water_drop',
  mega_dam: 'infrastructure', agri_megafarm: 'farm', research_station: 'science', particle_collider: 'science',
  internet_cable: 'tech', data_center: 'tech', casino_resort: 'treasure', offshore_haven: 'money_bag',
  secret_facility: 'conspiracy', oligarch_asset: 'treasure', media_hq: 'news', alliance_hq: 'diplomacy',
  anomaly: 'mystery',
  // Living species tokens (layer 3 of the fixed map table)
  species_animal: 'lion', species_vegetal: 'orchid', species_mushroom: 'fungus', species_microorganism: 'microscope',
  species_fossil: 'dinosaur', species_insect: 'butterfly', species_marine: 'whale', species_bird: 'eagle',
}
/** Icon id for a POI category (falls back to the category itself) */
export const iconIdFor = (id?: string) => { const k = (id || '').toLowerCase(); return ICON_ALIAS[k] || k || 'city' }
export const iconFor = (id?: string) => getIcon(iconIdFor(id))
