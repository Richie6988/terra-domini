// ─── Player ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  username: string
  display_name: string
  email: string
  avatar_url: string
  commander_rank: number
  commander_xp: number
  spec_path: 'military' | 'economic' | 'diplomatic' | 'scientific'
  tdc_in_game: number
  total_tdc_purchased: number
  total_tdc_earned_ads: number
  wallet_address: string
  is_protected: boolean
  shield_until: string | null
  beginner_protection_until: string | null
  is_online: boolean
  last_active: string
  stats: PlayerStats
  alliance: AllianceSummary | null
  active_boosts: ActiveBoost[]
  preferred_language: string
  date_joined: string
}

export interface PlayerStats {
  territories_owned: number
  territories_captured: number
  battles_won: number
  battles_lost: number
  season_score: number
  season_rank: number
}

export interface AllianceSummary {
  id: string
  tag: string
  name: string
  role: 'leader' | 'officer' | 'veteran' | 'member' | 'recruit'
  tier: 'squad' | 'guild' | 'federation'
}

// ─── Territory ───────────────────────────────────────────────────────────────

export type TerritoryType = 'urban' | 'rural' | 'industrial' | 'coastal' | 'landmark' | 'mountain' | 'forest' | 'water'

export type DefenseTier = 1 | 2 | 3 | 4 | 5

export interface TerritoryLight {
  h3_index: string
  h3?: string  // alias kept for backward compat
  owner_id: string | null
  owner_username: string | null
  alliance_id: string | null
  alliance_tag: string | null
  territory_type: string
  type?: string  // alias
  defense_tier: number
  defense_points: number
  is_control_tower: boolean
  is_landmark: boolean
  landmark_name: string | null
  place_name: string | null
  ad_slot_enabled: boolean
  center_lat: number
  center_lon: number
  boundary_points?: [number, number][]
  resource_food: number
  resource_energy: number
  resource_credits: number
  resource_materials: number
  resource_intel: number
  food_per_tick?: number  // alias
}

export interface TerritoryDetail extends TerritoryLight {
  h3_resolution: number
  country_code: string
  region_name: string
  place_name: string
  elevation_meters: number
  population_density: number
  owner: PlayerPublic | null
  alliance_tag: string | null
  captured_at: string | null
  max_defense_points: number
  fortification_level: number
  stockpile: ResourceMap
  stockpile_capacity: number
  production_rates: ResourceMap
  is_capital: boolean
  is_landmark: boolean
  landmark_name: string
  landmark_bonus: Partial<ResourceMap>
  terrain_attack_modifier: number
  terrain_defense_modifier: number
  current_battle_id: string | null
  buildings: Building[]
  can_be_attacked: boolean
  recent_history: OwnershipEvent[]
  daily_viewer_count: number
}

export interface ResourceMap {
  energy: number
  food: number
  credits: number
  culture: number
  materials: number
  intel: number
}

export interface Building {
  id: string
  building_type: string
  level: number
  is_operational: boolean
  under_construction: boolean
  construction_ends_at: string | null
  effects: Record<string, unknown>
}

export interface OwnershipEvent {
  change_type: 'claimed' | 'conquered' | 'abandoned'
  new_owner: string | null
  previous_owner: string | null
  timestamp: string
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export type UnitType = 'infantry' | 'cavalry' | 'artillery' | 'air' | 'naval'
export type UnitMap = Partial<Record<UnitType, number>>

export interface Battle {
  id: string
  territory_h3: string
  territory_name: string
  defender_username: string | null
  battle_type: 'conquest' | 'raid' | 'siege' | 'surprise'
  status: 'preparing' | 'active' | 'resolving' | 'completed' | 'cancelled'
  started_at: string
  resolves_at: string
  completed_at: string | null
  winner: 'attacker' | 'defender' | ''
  territory_captured: boolean
  attacker_casualties: UnitMap
  defender_casualties: UnitMap
  resources_looted: Partial<ResourceMap>
  combat_log: CombatLogEntry[]
  participants: BattleParticipant[]
  time_remaining_seconds: number
}

export interface BattleParticipant {
  id: string
  username: string
  side: 'attacker' | 'defender'
  units_deployed: UnitMap
  units_survived: UnitMap
  units_lost: UnitMap
  xp_earned: number
  is_commander: boolean
}

export interface CombatLogEntry {
  event: string
  [key: string]: unknown
}

// ─── Economy / Shop ──────────────────────────────────────────────────────────

export interface ShopItem {
  id: string
  code: string
  name: string
  description: string
  category: 'shield' | 'military' | 'construction' | 'cosmetic' | 'battle_pass' | 'alliance' | 'resource_pack'
  price_tdc: number
  price_eur: number | null
  price_eur_display: string | null
  effect_type: string
  effect_value: number
  effect_duration_seconds: number
  max_per_day: number
  hard_cap_pct: number
  is_available: boolean
  icon_url: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface ActiveBoost {
  type: string
  value: number
  expires_at: string
}

export interface TDCBalance {
  in_game: number
  wallet: number
  wallet_in_game: number
  tdc_eur_rate: number
}

export interface TDCTransaction {
  id: string
  type: string
  amount: number
  item_code: string
  territory: string
  status: string
  date: string
}

// ─── Alliance ────────────────────────────────────────────────────────────────

export interface Alliance {
  id: string
  tag: string
  name: string
  description: string
  tier: 'squad' | 'guild' | 'federation'
  banner_color: string
  banner_symbol: string
  leader_username: string
  member_count: number
  territory_count: number
  war_score: number
  season_score: number
  is_recruiting: boolean
  min_rank_to_join: number
}

export interface AllianceMember {
  id: string
  username: string
  display_name: string
  commander_rank: number
  role: string
  territories_owned: number
  battles_fought_for_alliance: number
  joined_at: string
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface ControlTowerEvent {
  id: string
  territory_h3: string
  territory_name: string
  status: 'scheduled' | 'active' | 'completed'
  starts_at: string
  ends_at: string
  time_until_start: number
  min_participants: number
  reward_bonus: Record<string, number>
}

// ─── WebSocket ───────────────────────────────────────────────────────────────

export type WSMessage =
  | { type: 'connected'; player_id: string; server_time: string }
  | { type: 'territory_state'; territories: TerritoryLight[]; viewport: Viewport }
  | { type: 'territory_update'; territory: TerritoryLight }
  | { type: 'territory_detail'; territory: TerritoryDetail }
  | { type: 'battle_event'; battle: Battle }
  | { type: 'battle_resolved'; battle_id: string; territory_h3: string; winner: string; your_side: string; territory_captured: boolean; resources_looted: Partial<ResourceMap> }
  | { type: 'notification'; notification: GameNotification }
  | { type: 'tdc_update'; balance: { in_game: number; purchased: number } }
  | { type: 'attack_incoming'; territory_h3: string; attacker: string; resolves_at: string }
  | { type: 'pong' }

export interface Viewport {
  lat: number
  lon: number
  radius_km: number
}

export interface GameNotification {
  type: string
  title: string
  message: string
  territory_h3?: string
  battle_id?: string
  timestamp?: string
}

export interface PlayerPublic {
  id: string
  username: string
  display_name: string
  avatar_url: string
  commander_rank: number
  spec_path: string
  territories_owned: number
  season_score: number
  alliance_tag: string | null
  is_online: boolean
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginResponse extends AuthTokens {
  player: Player
}
