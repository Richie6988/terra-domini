/** Mirror of backend economy/balance.py — keep in sync. HEX produced per day, collected via the harvest stock. */
export const HEX_PER_DAY: Record<string, number> = {
  common: 150, uncommon: 400, rare: 1000, epic: 2500, legendary: 2500, mythic: 2500,   // Silver > plain hex (100); legendary / mythic = Diamond
}
// 4 rarities only (owner 2026-10-20): Silver 50 % · Gold 30 % · Emerald 15 % · Diamond 5 % — the name is the metal of
// the token frame. Keys stay common / uncommon / rare / epic in the code and the API; old legendary / mythic = Diamond.
export const RARITY_LABEL: Record<string, string> = {
  common: 'Silver', uncommon: 'Gold', rare: 'Emerald', epic: 'Diamond', legendary: 'Diamond', mythic: 'Diamond',
}
export const rarityLabel = (r?: string | null) => (RARITY_LABEL[(r || 'common').toLowerCase()] || r || '').toUpperCase()
export const STORAGE_CAP_HOURS = 8
// A plain hex (no token) pays PLAIN_HEX_PER_DAY, +KINGDOM_BONUS inside a kingdom; each token on it adds HEX_PER_DAY[rarity]
export const PLAIN_HEX_PER_DAY = 100
export const KINGDOM_BONUS = 10
export const hexPerDay = (_rarity?: string, _shiny?: boolean) => PLAIN_HEX_PER_DAY   // fallback before /codex/territory/ answers

// Fixed peg (economy/balance.py): 1 € = 1000 HEX = 1 HEX Coin
export const HEX_PER_EUR = 1000
export const HEX_PER_COIN = 1000
