/**
 * MiniIcons — Small inline SVG icons replacing ALL emojis in the UI.
 * RULE 4: Zero emoji. Only original SVG designs.
 * Usage: <MiniIcon id="crown" size={14} color="#cc8800" />
 */

const paths: Record<string, string> = {
  // Identity & Profile
  crown:     'M3 14h18l-2.5-7-3.5 3-3-5-3 5-3.5-3z M5 14v2h14v-2',
  shield:    'M12 2L4 6v5c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6z',
  user:      'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.52 1.08V21a2 2 0 01-4 0v-.09A1.65 1.65 0 007.6 19.4l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 003.92 14H3.84a2 2 0 010-4h.09A1.65 1.65 0 005.6 7.6l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 0010 3.84V3.76a2 2 0 014 0v.09a1.65 1.65 0 001.82.33h.06a2 2 0 012.83 2.83',
  logout:    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  trash:     'M3 6h18 M8 6V4h8v2 M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6',

  // Military
  sword:     'M14.5 3.5l6 6-10 10-6-6z M3 21l4-4 M18 6l-1-1',
  target:    'M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a5 5 0 100 10 5 5 0 000-10zm0 3a2 2 0 100 4 2 2 0 000-4z',
  anchor:    'M12 2a3 3 0 00-3 3c0 1.3.8 2.4 2 2.8V22 M12 8v14 M5 12H2a10 10 0 0020 0h-3',
  plane:     'M12 2L4 8h5v6H4l8 8 8-8h-5V8h5z',
  wrench:    'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l4-4-3-3z M3 21l8.7-8.7',
  medic:     'M12 2a10 10 0 100 20 10 10 0 000-20z M8 12h8 M12 8v8',
  spy:       'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7z M12 12a3 3 0 100-6 3 3 0 000 6z',

  // Kingdom & Territory
  castle:    'M4 21V9l2-2V4h2v2h2V4h2v2h2V4h2v2h2V4h2v3l2 2v12z M9 21v-5h6v5',
  empire:    'M12 2l-9 6v8l9 6 9-6V8z M12 8l-5 3v5l5 3 5-3v-5z',
  flag:      'M5 3v18 M5 3h12l-3 4 3 4H5',
  map:       'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z',
  pin:       'M12 2a7 7 0 00-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 00-7-7z M12 12a3 3 0 100-6 3 3 0 000 6z',

  // Collection & Items
  gem:       'M6 3h12l4 6-10 12L2 9z M2 9h20',
  star:      'M12 2l3 6.3H22l-5.3 4 2 6.7L12 15l-6.7 4 2-6.7L2 8.3h7z',
  fire:      'M12 2c-4 5-6 8-6 12a6 6 0 0012 0c0-4-2-7-6-12z',
  book:      'M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4z M8 4v16',
  trophy:    'M6 9V2h12v7a6 6 0 01-12 0z M9 21h6 M12 15v6 M2 2h4 M18 2h4',

  // Resources
  bolt:      'M13 2L3 14h8l-1 8 10-12h-8z',
  drop:      'M12 2c-4 5-7 9-7 13a7 7 0 0014 0c0-4-3-8-7-13z',
  grain:     'M12 22V2 M5 8c3 1 5 3 7 6 M19 8c-3 1-5 3-7 6 M5 14c3 0 5 1 7 3 M19 14c-3 0-5 1-7 3',
  pickaxe:   'M14 10l7-7-3-3-7 7z M3 21l8-8',
  oil:       'M8 2h8v4l-2 2v12a2 2 0 01-4 0V8L8 6z',
  signal:    'M12 20a1 1 0 100-2 1 1 0 000 2z M8 16a5 5 0 018 0 M4 12a9 9 0 0118 0',

  // Navigation
  globe:     'M12 2a10 10 0 100 20 10 10 0 000-20z M2 12h20 M12 2a15 15 0 014 10 15 15 0 01-4 10 M12 2a15 15 0 00-4 10 15 15 0 004 10',
  compass:   'M12 2a10 10 0 100 20 10 10 0 000-20z M16.2 7.8l-2.7 6.7-6.7 2.7 2.7-6.7z',
  chart:     'M3 20V8l4 4 4-8 4 6 4-2v12z',
  ladder:    'M8 2v20 M16 2v20 M8 6h8 M8 10h8 M8 14h8 M8 18h8',

  // Status indicators
  check:     'M5 12l5 5L20 7',
  cross:     'M6 6l12 12 M18 6L6 18',
  alert:     'M12 2L2 22h20z M12 9v5 M12 17h.01',
  info:      'M12 2a10 10 0 100 20 10 10 0 000-20z M12 16v-4 M12 8h.01',
  lock:      'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4',

  // Game modes
  radar:     'M12 2a10 10 0 100 20 10 10 0 000-20z M12 6a6 6 0 100 12 6 6 0 000-12z M12 12l4-4',
  auction:   'M14.5 3.5l6 6-8 8-6-6z M3 21l4-4',
  shop:      'M6 2l-2 6h16l-2-6z M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8',
  scroll:    'M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2z M8 8h8 M8 12h8 M8 16h4',
}

export function MiniIcon({ id, size = 16, color = 'currentColor', style }: {
  id: string; size?: number; color?: string; style?: React.CSSProperties
}) {
  const d = paths[id]
  if (!d) return <span style={{ width: size, height: size, display: 'inline-block', ...style }} />
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  )
}

/** Colored dot indicator (replaces emoji checkmarks, warnings, etc.) */
export function StatusDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}
