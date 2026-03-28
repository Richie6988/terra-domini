/**
 * RadarFilterPanel — HEXOD M04 Radar Filter Panel.
 * Slide-out panel from left edge (380px), glassmorphism.
 * 10 categories, 4-column icon grid, toggle active/inactive.
 * Matches read_only_templates/rare_territory_display_filter_panel exactly.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { CATEGORIES, TOTAL_ICONS } from './radarIconData'

// ── Trigger button (left edge, 48px strip) ──
export function RadarTrigger({ onClick, scanning }: { onClick: () => void; scanning: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed',
        left: 0, top: 0, width: 48, height: '100%',
        zIndex: 100,
        cursor: 'pointer',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.4s ease',
      }}
    >
      <svg
        viewBox="0 0 28 28"
        style={{
          width: 28, height: 28, marginLeft: 8,
          opacity: scanning ? 1 : 0.6,
          animation: scanning ? 'scanning-glow 1.5s infinite' : 'pulse-icon 2.5s infinite',
          transition: 'all 0.3s ease',
        }}
      >
        <circle cx="12" cy="12" r="8" fill="none"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="2.5" />
        <line x1="18" y1="18" x2="24" y2="24"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="3" strokeLinecap="round" />
        <circle cx="9" cy="9" r="2" fill="rgba(255,255,255,0.4)" />
        <circle cx="12" cy="8" r="3" fill="none"
          stroke={scanning ? '#00ff55' : '#0088bb'} strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  )
}

// ── Main Filter Panel ──
interface Props {
  open: boolean
  onClose: () => void
  onFilterChange?: (activeIds: Set<string>) => void
}

export function RadarFilterPanel({ open, onClose, onFilterChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  const toggleIcon = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onFilterChange?.(next)
      return next
    })
  }, [onFilterChange])

  const selectAll = () => {
    const all = new Set<string>()
    Object.values(CATEGORIES).forEach(c => c.icons.forEach(i => all.add(i.id)))
    setSelected(all)
    onFilterChange?.(all)
  }

  const clearAll = () => {
    setSelected(new Set())
    onFilterChange?.(new Set())
  }

  const toggleCategory = (catKey: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(catKey)) next.delete(catKey)
      else next.add(catKey)
      return next
    })
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 100)
    return () => document.removeEventListener('click', handler)
  }, [open, onClose])

  const isScanning = selected.size > 0

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: 0, top: 0,
        width: 380, height: '100%',
        background: 'linear-gradient(180deg, rgba(235, 242, 250, 0.95) 0%, rgba(220, 230, 242, 0.95) 100%)',
        backdropFilter: 'blur(30px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.2)',
        borderRight: '1px solid rgba(0,80,120,0.15)',
        zIndex: 1000,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '8px 0 30px rgba(0,0,0,0.15), inset -1px 0 0 rgba(255,255,255,0.8)',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '24px 22px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 100%)',
        borderBottom: '1px solid rgba(0,80,120,0.1)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 18,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, letterSpacing: 3,
            color: '#0077aa',
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            <span style={{ color: '#0099cc', animation: 'pulse-icon 2s infinite' }}>◆</span>
            POI RADAR FILTERS
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(26, 42, 58, 0.45)',
              cursor: 'pointer', fontSize: 16,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}
          >
            ✕
          </button>
        </div>

        {/* Control buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'SELECT ALL', action: selectAll },
            { label: 'RESET ALL', action: clearAll },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.75)',
                border: 'none',
                color: '#0077aa',
                padding: '9px 14px',
                fontFamily: "'Orbitron', system-ui, sans-serif",
                fontSize: 8, fontWeight: 500, letterSpacing: 1,
                cursor: 'pointer',
                borderRadius: 20,
                boxShadow: '0 2px 8px rgba(0,50,80,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
                transition: 'all 0.25s ease',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable categories ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '18px 20px',
      }}>
        {Object.entries(CATEGORIES).map(([catKey, cat]) => {
          const isCollapsed = collapsed.has(catKey)
          return (
            <div key={catKey} style={{ marginBottom: 22 }}>
              {/* Category header */}
              <div
                onClick={() => toggleCategory(catKey)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.5)',
                  borderLeft: `3px solid ${cat.color}`,
                  borderRadius: '0 6px 6px 0',
                  marginBottom: isCollapsed ? 0 : 14,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{
                  fontSize: 10, letterSpacing: 3, fontWeight: 600,
                  color: cat.color,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                }}>
                  {cat.name.toUpperCase()}
                  <span style={{ fontSize: 8, opacity: 0.6, fontWeight: 400 }}>
                    [{cat.icons.length}]
                  </span>
                </div>
                <span style={{
                  fontSize: 9, opacity: 0.5,
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                  color: '#1a2a3a',
                }}>
                  ▼
                </span>
              </div>

              {/* Icon grid */}
              {!isCollapsed && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}>
                  {cat.icons.map(icon => {
                    const isSelected = selected.has(icon.id)
                    return (
                      <div
                        key={icon.id}
                        onClick={() => toggleIcon(icon.id)}
                        style={{
                          aspectRatio: '1',
                          background: isSelected
                            ? 'rgba(255, 255, 255, 0.9)'
                            : 'rgba(255, 255, 255, 0.6)',
                          border: `1px solid ${isSelected ? cat.color : 'rgba(0, 60, 100, 0.1)'}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isSelected
                            ? `0 2px 15px ${cat.color}66, inset 0 0 20px ${cat.color}22`
                            : 'none',
                        }}
                      >
                        {/* Icon placeholder — circular with category color */}
                        <div style={{
                          width: 38, height: 38,
                          borderRadius: '50%',
                          background: cat.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          color: 'white',
                          fontWeight: 700,
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          filter: isSelected
                            ? `drop-shadow(0 0 8px ${cat.color})`
                            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                          fontFamily: "'Share Tech Mono', monospace",
                        }}>
                          {icon.name.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Selected indicator dot */}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 5, right: 5,
                            width: 8, height: 8,
                            background: cat.color,
                            borderRadius: '50%',
                            boxShadow: `0 0 8px ${cat.color}`,
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Footer status ── */}
      <div style={{
        padding: '14px 22px',
        borderTop: '1px solid rgba(0,80,120,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: "'Orbitron', system-ui, sans-serif",
        fontSize: 9, fontWeight: 500, letterSpacing: 2,
      }}>
        <div style={{
          color: isScanning ? '#00884a' : '#996600',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.3s',
        }}>
          <span style={{
            width: 6, height: 6,
            background: isScanning ? '#00aa44' : '#cc8800',
            borderRadius: '50%',
            boxShadow: isScanning ? '0 0 8px #00aa44' : 'none',
            animation: 'pulse-icon 2s infinite',
          }} />
          {isScanning ? 'SCANNING' : 'STANDBY'}
        </div>
        <div style={{ color: '#0077aa', fontWeight: 600, fontSize: 11 }}>
          {selected.size} / {TOTAL_ICONS} LOCATED
        </div>
      </div>
    </div>
  )
}
