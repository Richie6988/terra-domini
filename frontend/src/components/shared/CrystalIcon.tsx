/**
 * CrystalIcon — the ONLY crystal currency icon used in the app.
 * SVG diamond #7950f2. Import from shared/CrystalIcon everywhere.
 */
const sizes = { sm: 12, md: 16, lg: 22, xl: 28 } as const

interface CrystalIconProps {
  size?: keyof typeof sizes
  className?: string
}

export function CrystalIcon({ size = 'md', className }: CrystalIconProps) {
  const px = sizes[size]
  return (
    <svg
      viewBox="0 0 256 256"
      width={px}
      height={px}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M128 20L70 110L128 230L186 110L128 20Z" fill="#7950f2" />
      <path d="M128 20L100 120L128 230" stroke="white" strokeWidth="2" opacity="0.3" fill="none" />
    </svg>
  )
}
