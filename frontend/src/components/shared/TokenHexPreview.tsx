/**
 * TokenHexPreview — back-compat wrapper around TokenFace2D.
 *
 * Old API: (iconId, rarity, catColor, size, name, shiny, onClick)
 * Maps rarity → tier, passes everything through to TokenFace2D which
 * renders the gold-standard front face flat on a canvas.
 */
import { TokenFace2D } from './TokenFace2D'
import type { TierKey } from './hexodTokenFace'

const RARITY_TO_TIER: Record<string, TierKey> = {
  common: 'BRONZE',
  uncommon: 'BRONZE',
  rare: 'SILVER',
  epic: 'SILVER',
  legendary: 'GOLD',
  mythic: 'EMERALD',
}

interface Props {
  iconId: string
  rarity?: string
  catColor?: string
  size?: number
  name?: string
  shiny?: boolean
  onClick?: () => void
  biome?: string
  serial?: number
  maxSupply?: number
  imageSrc?: string
}

export function TokenHexPreview({
  iconId,
  rarity = 'common',
  catColor = '#0099cc',
  size = 64,
  name,
  shiny,
  onClick,
  biome,
  serial = 1,
  maxSupply = 1000,
  imageSrc,
}: Props) {
  return (
    <TokenFace2D
      tier={RARITY_TO_TIER[rarity.toLowerCase()] || 'BRONZE'}
      category={(iconId || 'TERRITORY').toUpperCase().replace(/_/g, ' ')}
      catColor={catColor}
      biome={(biome || iconId || 'RURAL').toUpperCase().replace(/_/g, ' ')}
      tokenName={name || 'HEXOD TERRITORY'}
      serial={serial}
      maxSupply={maxSupply}
      iconId={iconId}
      imageSrc={imageSrc}
      size={size}
      onClick={onClick}
      style={shiny ? { filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' } : undefined}
    />
  )
}
