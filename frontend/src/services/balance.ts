/** Mirror of backend economy/balance.py — keep in sync. HEX produced per day, collected via the harvest stock. */
export const HEX_PER_DAY: Record<string, number> = {
  common: 60, uncommon: 130, rare: 360, epic: 900, legendary: 2400, mythic: 6000,
}
// Rarity names shown to players (owner 2026-10-20: "no common & uncommon: curiosity, wonder, then rare…");
// the keys stay common…mythic everywhere in the code and the API; the token frame metals stay bronze…diamond
export const RARITY_LABEL: Record<string, string> = {
  common: 'Curiosity', uncommon: 'Wonder', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic',
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
