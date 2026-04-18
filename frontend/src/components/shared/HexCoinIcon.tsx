/**
 * HexCoinIcon — HEX Coin currency icon.
 * Gold/amber hexagonal design. The ONLY currency icon in HEXOD.
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
      {/* Outer hex — dark gold */}
      <path d="M128 20L50 65V191L128 236L206 191V65Z" fill="#b8860b" />
      {/* Inner hex — bright gold */}
      <path d="M128 20L50 65V191L128 236" fill="#cc9900" />
      <path d="M128 45L72 78V178L128 211L184 178V78Z" fill="#daa520" />
      <path d="M128 45L72 78V178L128 211" fill="#e6b422" />
      {/* Center diamond */}
      <path d="M128 85L98 128L128 171L158 128Z" fill="#fff8dc" opacity="0.9" />
      <path d="M128 85L98 128L128 171" fill="#ffefd5" opacity="0.95" />
      {/* Inner hex outline */}
      <path d="M128 60L85 85V171L128 196L171 171V85Z" fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.6" />
      {/* H letter */}
      <text x="128" y="140" textAnchor="middle" fill="#8B6914" fontSize="38" fontWeight="900" fontFamily="Orbitron, monospace">H</text>
    </svg>
  )
}

/** @deprecated Use HexCoinIcon instead */
export const IconSVG = HexCoinIcon
