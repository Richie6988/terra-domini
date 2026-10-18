/** Mirror of backend economy/balance.py — keep in sync. HEX produced per day, collected via the harvest stock. */
export const HEX_PER_DAY: Record<string, number> = {
  common: 60, uncommon: 130, rare: 360, epic: 900, legendary: 2400, mythic: 6000,
}
export const STORAGE_CAP_HOURS = 8
export const hexPerDay = (rarity?: string, shiny?: boolean) =>
  Math.round((HEX_PER_DAY[(rarity || 'common').toLowerCase()] ?? 60) * (shiny ? 1.5 : 1))

// Fixed peg (economy/balance.py): 1 € = 1000 HEX = 1 HEX Coin
export const HEX_PER_EUR = 1000
export const HEX_PER_COIN = 1000
