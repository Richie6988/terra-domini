/**
 * Design Tokens — Hexod Design System (Aria-approved)
 * Source unique de vérité pour couleurs, espacement, typographie.
 */
export const COLOR = {
  bg: '#080810', bgCard: '#07070f', bgPanel: '#050510',
  bgSurface: 'rgba(255,255,255,0.04)',
  textPrimary: '#E5E7EB', textSecondary: '#9CA3AF',
  textMuted: '#6B7280', textDim: '#374151',
  accent: '#00FF87', accentDim: 'rgba(0,255,135,0.15)',
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
  danger: '#EF4444', warning: '#F59E0B', success: '#10B981', info: '#3B82F6',
  border: 'rgba(255,255,255,0.08)', borderHover: 'rgba(255,255,255,0.15)',
} as const

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
