/**
 * Design Tokens — HEXOD Design System (light_tactical)
 * Source unique de vérité. Mirrors prototype CSS variables.
 */
export const COLOR = {
  // Light tactical theme
  bgGlass: 'rgba(235, 242, 250, 0.95)',
  bgSecondary: 'rgba(220, 230, 242, 0.95)',
  bgCard: 'rgba(255, 255, 255, 0.40)',
  bgCellHover: 'rgba(255, 255, 255, 0.90)',
  // Map background
  bgMap: '#1a3d2e',
  bgMapGradient: 'linear-gradient(135deg, #2d5a45, #1a3d2e)',
  // Dark fallback (news ticker, overlays)
  bgDark: '#0f172a',
  bgDarkAlt: '#1e293b',
  // Text
  textPrimary: '#1a2a3a',
  textSecondary: '#0077aa',
  textMuted: 'rgba(26, 42, 58, 0.45)',
  // HUD accents
  hudCyan: '#0099cc',
  hudAmber: '#cc8800',
  hudAmberBright: '#fbbf24',
  // States
  stateStandby: '#996600',
  stateActive: '#00884a',
  stateScanning: '#00ff55',
  stateAlert: '#dc2626',
  // HEX Coin
  hex: '#7950f2',
  // Borders
  borderSubtle: 'rgba(0, 60, 100, 0.15)',
  borderHover: 'rgba(0, 60, 100, 0.3)',
  // Rarity
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
  // Semantic
  danger: '#dc2626', warning: '#F59E0B', success: '#10B981', info: '#3B82F6',
} as const

export const CATEGORY_COLOR: Record<string, string> = {
  natural_disasters: '#f97316',
  places_structures: '#6366f1',
  nature_geography: '#7c3aed',
  knowledge_science: '#2563eb',
  economic_assets: '#64748b',
  culture_society: '#d946ef',
  conflict_intrigue: '#dc2626',
  life_organisms: '#22c55e',
  fantastic: '#a855f7',
  game: '#0ea5e9',
}

export const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
}

export const BIOME_COLOR: Record<string, string> = {
  urban: '#60A5FA', rural: '#6EE7B7', forest: '#34D399',
  mountain: '#A8A29E', coastal: '#38BDF8', desert: '#FCD34D',
  tundra: '#BAE6FD', industrial: '#9CA3AF', landmark: '#C4B5FD',
}

export const PANEL_MOTION = {
  right:  { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: { type: 'spring', stiffness: 280, damping: 28 } },
  bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', stiffness: 350, damping: 32 } },
  left:   { initial: { x: '-16px', opacity: 0, scale: 0.97 }, animate: { x: 0, opacity: 1, scale: 1 }, exit: { x: '-16px', opacity: 0, scale: 0.97 } },
  fade:   { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 } },
} as const
