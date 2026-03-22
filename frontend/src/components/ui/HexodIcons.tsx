/**
 * HexodIcons — SVG icon system
 *
 * 🎨 Aria design spec:
 *   - Stroke-based, 1.5px, round linecap/linejoin
 *   - Fond transparent, couleur via currentColor
 *   - Taille de base : 20×20 viewBox
 *   - Style : cyberpunk géopolitique, formes géométriques nettes
 *   - Pas d'emojis dans l'UI — SVG uniquement
 */

import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  color?: string
  style?: CSSProperties
  className?: string
}

const base = (size: number, color: string, style?: CSSProperties, className?: string) => ({
  width: size, height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
  className,
})

// ── Hex hexagone ─────────────────────────────────────────────────────────────
export function IconHex({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="10,2 17.3,6 17.3,14 10,18 2.7,14 2.7,6" />
    </svg>
  )
}

// ── Épée attaque ─────────────────────────────────────────────────────────────
export function IconSword({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <line x1="3" y1="17" x2="12" y2="8" />
      <path d="M12 8 L17 3 L17 5 L19 3" />
      <path d="M17 3 L15 3 L17 5" fill={color} stroke="none" />
      <line x1="3" y1="17" x2="5" y2="15" />
      <line x1="7" y1="13" x2="5" y2="15" />
    </svg>
  )
}

// ── Bouclier défense ──────────────────────────────────────────────────────────
export function IconShield({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <path d="M10 2 L17 5 L17 10 C17 14.5 10 18 10 18 C10 18 3 14.5 3 10 L3 5 Z" />
      <polyline points="7,10 9,12 13,8" />
    </svg>
  )
}

// ── Ressources / économie ─────────────────────────────────────────────────────
export function IconCoin({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6 L10 7 M10 13 L10 14" />
      <path d="M8 8.5 C8 7.5 12 7.5 12 9 C12 10.5 8 10.5 8 12 C8 13.5 12 13.5 12 12.5" />
    </svg>
  )
}

// ── Alliance / alliance ───────────────────────────────────────────────────────
export function IconAlliance({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="13" cy="7" r="3" />
      <path d="M2 17 C2 14 4.5 12 7 12 C8.2 12 9.2 12.4 10 13 C10.8 12.4 11.8 12 13 12 C15.5 12 18 14 18 17" />
    </svg>
  )
}

// ── Classement ───────────────────────────────────────────────────────────────
export function IconTrophy({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <path d="M6 3 L14 3 L14 10 C14 13.3 12.2 15 10 15 C7.8 15 6 13.3 6 10 Z" />
      <path d="M14 5 L17 5 L17 8 C17 10 15.5 11 14 11" />
      <path d="M6 5 L3 5 L3 8 C3 10 4.5 11 6 11" />
      <line x1="10" y1="15" x2="10" y2="17" />
      <line x1="7" y1="17" x2="13" y2="17" />
    </svg>
  )
}

// ── Profil / commandant ───────────────────────────────────────────────────────
export function IconProfile({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="7" r="3.5" />
      <path d="M3 18 C3 14.5 6 12 10 12 C14 12 17 14.5 17 18" />
    </svg>
  )
}

// ── Commerce ─────────────────────────────────────────────────────────────────
export function IconTrade({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <line x1="3" y1="7" x2="17" y2="7" />
      <polyline points="13,3 17,7 13,11" />
      <line x1="17" y1="13" x2="3" y2="13" />
      <polyline points="7,9 3,13 7,17" />
    </svg>
  )
}

// ── Cryptomonnaie / blockchain ────────────────────────────────────────────────
export function IconCrypto({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="10,2 17.3,6 17.3,14 10,18 2.7,14 2.7,6" />
      <polygon points="10,5.5 14.3,8 14.3,12.5 10,15 5.7,12.5 5.7,8" opacity="0.5" />
      <line x1="10" y1="2" x2="10" y2="5.5" />
      <line x1="10" y1="15" x2="10" y2="18" />
    </svg>
  )
}

// ── Événements ────────────────────────────────────────────────────────────────
export function IconEvents({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="10,2 12.4,7.5 18.5,8.2 14,12.5 15.2,18.5 10,15.5 4.8,18.5 6,12.5 1.5,8.2 7.6,7.5" />
    </svg>
  )
}

// ── Combat ────────────────────────────────────────────────────────────────────
export function IconCombat({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <line x1="4" y1="16" x2="13" y2="7" />
      <path d="M13 7 L16 4 M14 4 L16 4 L16 6" />
      <line x1="4" y1="16" x2="6" y2="14" />
      <line x1="8" y1="12" x2="6" y2="14" />
      <line x1="9" y1="4" x2="16" y2="11" />
      <path d="M9 4 L6 3 M16 11 L17 14" />
    </svg>
  )
}

// ── Missions / objectif ───────────────────────────────────────────────────────
export function IconMissions({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" r="1.5" fill={color} stroke="none" />
      <line x1="10" y1="3" x2="10" y2="1" />
      <line x1="17" y1="10" x2="19" y2="10" />
    </svg>
  )
}

// ── Referral / inviter ────────────────────────────────────────────────────────
export function IconReferral({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="6" r="2.5" />
      <circle cx="4" cy="14" r="2.5" />
      <circle cx="16" cy="14" r="2.5" />
      <line x1="10" y1="8.5" x2="4" y2="11.5" />
      <line x1="10" y1="8.5" x2="16" y2="11.5" />
    </svg>
  )
}

// ── Wallet ────────────────────────────────────────────────────────────────────
export function IconWallet({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <rect x="2" y="5" width="16" height="12" rx="2" />
      <path d="M2 9 L18 9" />
      <circle cx="14.5" cy="13" r="1.5" fill={color} stroke="none" />
    </svg>
  )
}

// ── Territoire / carte ────────────────────────────────────────────────────────
export function IconMap({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="2,4 8,2 12,4 18,2 18,16 12,18 8,16 2,18" />
      <line x1="8" y1="2" x2="8" y2="16" />
      <line x1="12" y1="4" x2="12" y2="18" />
    </svg>
  )
}

// ── Flamme / streak ───────────────────────────────────────────────────────────
export function IconFlame({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <path d="M10 18 C6 18 3 15 3 11.5 C3 9 4.5 7.5 5 5.5 C6 7 6.5 8 7 9 C7.5 6 8 3 10 2 C10 4 10.5 5.5 12 7 C13.5 5.5 13 3.5 12.5 2.5 C15 4.5 17 7.5 17 11.5 C17 15 14 18 10 18 Z" />
    </svg>
  )
}

// ── Bell / notifications ──────────────────────────────────────────────────────
export function IconBell({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <path d="M10 2 C7 2 5 4.5 5 7.5 L5 13 L3 14.5 L17 14.5 L15 13 L15 7.5 C15 4.5 13 2 10 2 Z" />
      <path d="M8.5 14.5 C8.5 15.8 9.2 17 10 17 C10.8 17 11.5 15.8 11.5 14.5" />
    </svg>
  )
}

// ── Settings / engrenage ──────────────────────────────────────────────────────
export function IconSettings({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2 L10 4 M10 16 L10 18 M2 10 L4 10 M16 10 L18 10 M4.2 4.2 L5.6 5.6 M14.4 14.4 L15.8 15.8 M15.8 4.2 L14.4 5.6 M5.6 14.4 L4.2 15.8" />
    </svg>
  )
}

// ── Bâtiment / construire ─────────────────────────────────────────────────────
export function IconBuild({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <rect x="3" y="10" width="14" height="8" rx="1" />
      <path d="M1 10 L10 3 L19 10" />
      <rect x="8" y="13" width="4" height="5" />
    </svg>
  )
}

// ── Recherche / science ───────────────────────────────────────────────────────
export function IconResearch({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="8.5" cy="8.5" r="5" />
      <line x1="12.5" y1="12.5" x2="18" y2="18" strokeWidth="2" />
      <line x1="8.5" y1="5.5" x2="8.5" y2="11.5" />
      <line x1="5.5" y1="8.5" x2="11.5" y2="8.5" />
    </svg>
  )
}

// ── Stratégie / globe ─────────────────────────────────────────────────────────
export function IconStrategy({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <circle cx="10" cy="10" r="8" />
      <ellipse cx="10" cy="10" rx="4" ry="8" />
      <line x1="2" y1="10" x2="18" y2="10" />
      <line x1="3.5" y1="6" x2="16.5" y2="6" />
      <line x1="3.5" y1="14" x2="16.5" y2="14" />
    </svg>
  )
}

// ── Logs / historique ─────────────────────────────────────────────────────────
export function IconLogs({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <line x1="7" y1="7" x2="13" y2="7" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="11" y2="13" />
    </svg>
  )
}

// ── Close / X ─────────────────────────────────────────────────────────────────
export function IconClose({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  )
}

// ── Wifi / connexion ──────────────────────────────────────────────────────────
export function IconWifi({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <path d="M2 8 C5.5 4 14.5 4 18 8" />
      <path d="M4.5 11 C6.5 9 13.5 9 15.5 11" />
      <path d="M7.5 14 C8.5 13 11.5 13 12.5 14" />
      <circle cx="10" cy="17" r="1" fill={color} stroke="none" />
    </svg>
  )
}

// ── WifiOff ───────────────────────────────────────────────────────────────────
export function IconWifiOff({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <line x1="2" y1="2" x2="18" y2="18" />
      <path d="M8.5 5.5 C9 5.3 9.5 5.2 10 5.2 C12.5 5.2 14.8 6.2 16.5 8" />
      <path d="M4.5 11 C5.2 10.2 6.2 9.6 7.3 9.2" />
      <path d="M10.5 13.2 C11.3 13.1 12 13.4 12.5 14" />
      <circle cx="10" cy="17" r="1" fill={color} stroke="none" />
    </svg>
  )
}

// ── NFT / token ───────────────────────────────────────────────────────────────
export function IconNFT({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="10,2 17.3,6 17.3,14 10,18 2.7,14 2.7,6" />
      <text x="10" y="13" textAnchor="middle" fontSize="7" fill={color} stroke="none"
        style={{ fontFamily: 'monospace', fontWeight: 700 }}>NFT</text>
    </svg>
  )
}

// ── Cadenas / lock ────────────────────────────────────────────────────────────
export function IconLock({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9 L7 6 C7 4 8.3 3 10 3 C11.7 3 13 4 13 6 L13 9" />
    </svg>
  )
}

// ── Cristaux HEX ──────────────────────────────────────────────────────────────
export function IconCrystal({ size=20, color='currentColor', style, className }: IconProps) {
  return (
    <svg {...base(size, color, style, className)}>
      <polygon points="10,2 14,6 14,14 10,18 6,14 6,6" />
      <line x1="6" y1="6" x2="14" y2="14" />
      <line x1="14" y1="6" x2="6" y2="14" />
    </svg>
  )
}
