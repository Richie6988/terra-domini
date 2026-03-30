/**
 * HexCoinIcon — HEX Coin (◆) currency icon.
 * The ONLY currency icon used in the app.
 * Based on Richard's hex_coin SVG from icon bank.
 */
const sizes = { sm: 12, md: 16, lg: 22, xl: 28 } as const

interface HexCoinIconProps {
  size?: keyof typeof sizes
  className?: string
}

export function HexCoinIcon({ size = 'md', className }: HexCoinIconProps) {
  const px = sizes[size]
  return (
    <svg
      viewBox="0 0 256 256"
      width={px}
      height={px}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M128 30L60 70V186L128 226L196 186V70Z" fill="#6d28d9" />
      <path d="M128 30L60 70V186L128 226" fill="#7c3aed" />
      <path d="M128 55L80 82V174L128 201L176 174V82Z" fill="none" stroke="#c4b5fd" strokeWidth="3" />
      <path d="M128 90L100 128L128 166L156 128Z" fill="#e9d5ff" opacity="0.85" />
      <path d="M128 90L100 128L128 166" fill="#ddd6fe" opacity="0.95" />
      <text x="128" y="142" textAnchor="middle" fill="#4c1d95" fontSize="42" fontWeight="900" fontFamily="monospace">◆</text>
    </svg>
  )
}

/** @deprecated Use HexCoinIcon instead */
export const CrystalIcon = HexCoinIcon
