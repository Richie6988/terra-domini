/** Mirror of backend economy/balance.py — keep in sync. HEX produced per day, collected via the harvest stock. */
export const HEX_PER_DAY: Record<string, number> = {
  common: 60, uncommon: 110, rare: 220, epic: 500, legendary: 1200, mythic: 3000,
}
export const STORAGE_CAP_HOURS = 8
export const hexPerDay = (rarity?: string, shiny?: boolean) =>
  Math.round((HEX_PER_DAY[(rarity || 'common').toLowerCase()] ?? 60) * (shiny ? 1.5 : 1))

// Fixed peg (economy/balance.py): 1 € = 1000 HEX = 1 HEX Coin
export const HEX_PER_EUR = 1000
export const HEX_PER_COIN = 1000
