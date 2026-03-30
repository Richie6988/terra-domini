/**
 * DockIcons — SVG icons for HEXOD command dock.
 * Each icon: 24×24 viewBox, stroke-based, matches Orbitron/tactical aesthetic.
 */

export function DockIcon({ id, color = 'currentColor', size = 20 }: { id: string; color?: string; size?: number }) {
  const s = { width: size, height: size, display: 'block' }
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

  switch (id) {
    case 'combat':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M5 12l4-8 2 4h2l2-4 4 8"/><path {...p} d="M7 16h10"/><path {...p} d="M9 20h6"/><circle {...p} cx="12" cy="6" r="2" fill={color} opacity="0.3"/></svg>
    case 'events':
      return <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path {...p} d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5"/></svg>
    case 'kingdom':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M3 18h18l-2-8-4 3-3-5-3 5-4-3z"/><path {...p} d="M5 18v2h14v-2"/><circle {...p} cx="12" cy="6" r="1.5" fill={color} opacity="0.4"/></svg>
    case 'hunt':
      return <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="9"/><circle {...p} cx="12" cy="12" r="5"/><circle {...p} cx="12" cy="12" r="1" fill={color}/><path {...p} d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
    case 'codex':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M4 4h16v16H4z" rx="1"/><path {...p} d="M8 4v16"/><path {...p} d="M11 8h6M11 12h6M11 16h4" opacity="0.5"/></svg>
    case 'auction':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M14.5 3.5l6 6-8 8-6-6z"/><path {...p} d="M3 21l4-4"/><path {...p} d="M18 18h3v3" opacity="0.5"/></svg>
    case 'tasks':
      return <svg viewBox="0 0 24 24" style={s}><rect {...p} x="4" y="3" width="16" height="18" rx="2"/><path {...p} d="M8 8h8M8 12h8M8 16h5"/><path {...p} d="M9 3v-1h6v1" opacity="0.5"/></svg>
    case 'shop':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M6 2l-2 6h16l-2-6H6z"/><path {...p} d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8"/><path {...p} d="M12 12v4" opacity="0.5"/><circle {...p} cx="12" cy="12" r="1" fill={color} opacity="0.3"/></svg>
    case 'trade':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M3 20V8l4 4 4-8 4 6 4-2v12z" fill={color} opacity="0.1"/><path {...p} d="M3 20V8l4 4 4-8 4 6 4-2v12"/></svg>
    case 'marketplace':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 2L3 7v2h18V7L12 2z"/><path {...p} d="M5 9v10h14V9"/><path {...p} d="M9 13h6v6H9z" opacity="0.5"/></svg>
    case 'alliance':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 3l-8 5v8l8 5 8-5V8L12 3z"/><path {...p} d="M12 8v8" opacity="0.5"/><path {...p} d="M7 10.5l5 3 5-3" opacity="0.5"/></svg>
    case 'ladder':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M8 21V10l-4 4"/><path {...p} d="M12 21V6" fill="none"/><path {...p} d="M16 21V3l4 4"/><circle {...p} cx="16" cy="3" r="2" fill={color} opacity="0.3"/></svg>
    case 'profile':
      return <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="8" r="4"/><path {...p} d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
    case 'crypto':
      return <svg viewBox="0 0 24 24" style={s}><path {...p} d="M12 2L6 7l6 5 6-5L12 2z" fill={color} opacity="0.15"/><path {...p} d="M12 12l-6-5v7l6 5 6-5V7l-6 5z"/><path {...p} d="M6 14l6 5 6-5" opacity="0.5"/></svg>
    default:
      return <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="8"/></svg>
  }
}
