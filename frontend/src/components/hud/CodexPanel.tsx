/**
 * CodexPanel — M14 Token Codex.
 * Grid display of all 48 token categories with collection progress.
 * Uses central SVG icon bank for consistent rendering.
 * Shows: owned count, total available, completion %, rarity breakdown.
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { CrystalIcon } from '../shared/CrystalIcon'
import { Token3DViewer } from '../shared/Token3DViewer'
import { CATEGORIES } from '../shared/radarIconData'

interface Props { onClose: () => void }

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

// Mock collection data — will come from API later
function getMockCollection(): Record<string, { owned: number; total: number; rarities: Record<string, number> }> {
  const collection: Record<string, { owned: number; total: number; rarities: Record<string, number> }> = {}
  for (const cat of CATEGORIES) {
    for (const icon of cat.icons) {
      const total = 5 + Math.floor(Math.random() * 15)
      const owned = Math.floor(Math.random() * total * 0.6)
      collection[icon.id] = {
        owned, total,
        rarities: {
          common: Math.floor(owned * 0.5),
          uncommon: Math.floor(owned * 0.25),
          rare: Math.floor(owned * 0.15),
          epic: Math.floor(owned * 0.07),
          legendary: Math.floor(owned * 0.02),
          mythic: Math.floor(owned * 0.01),
        },
      }
    }
  }
  return collection
}

export function CodexPanel({ onClose }: Props) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [show3D, setShow3D] = useState(false)
  const collection = useMemo(() => getMockCollection(), [])

  // Category stats
  const catStats = useMemo(() => {
    return CATEGORIES.map(cat => {
      let totalOwned = 0, totalAvailable = 0
      for (const icon of cat.icons) {
        const c = collection[icon.id]
        if (c) { totalOwned += c.owned; totalAvailable += c.total }
      }
      return {
        ...cat,
        owned: totalOwned,
        total: totalAvailable,
        pct: totalAvailable > 0 ? Math.floor((totalOwned / totalAvailable) * 100) : 0,
      }
    })
  }, [collection])

  const globalOwned = catStats.reduce((s, c) => s + c.owned, 0)
  const globalTotal = catStats.reduce((s, c) => s + c.total, 0)
  const globalPct = globalTotal > 0 ? Math.floor((globalOwned / globalTotal) * 100) : 0

  const activeCat = selectedCat ? catStats.find(c => c.id === selectedCat) : null

  return (
    <GlassPanel title="CODEX" onClose={onClose} accent="#7950f2" width={440}>
      {/* Global stats */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, marginBottom: 12,
        background: 'linear-gradient(90deg, rgba(121,80,242,0.08), rgba(121,80,242,0.02))',
        border: '1px solid rgba(121,80,242,0.15)',
      }}>
        <div>
          <div style={{
            fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.4)',
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            COLLECTION PROGRESS
          </div>
          <div style={{
            fontSize: 16, fontWeight: 900, color: '#7950f2',
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {globalOwned.toLocaleString()} / {globalTotal.toLocaleString()}
          </div>
        </div>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: `conic-gradient(#7950f2 ${globalPct}%, rgba(0,60,100,0.08) ${globalPct}%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(235,242,250,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 900, color: '#7950f2',
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            {globalPct}%
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedCat ? (
          /* ── Category Grid ── */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{
              fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)',
              fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8,
            }}>
              {CATEGORIES.length} CATEGORIES · {catStats.reduce((s, c) => s + c.icons.length, 0)} TOKEN TYPES
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
            }}>
              {catStats.map(cat => (
                <motion.button
                  key={cat.id}
                  whileHover={{ y: -2, scale: 1.02 }}
                  onClick={() => setSelectedCat(cat.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: `linear-gradient(135deg, ${cat.color}08, transparent)`,
                    border: `1.5px solid ${cat.color}20`,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.25s ease',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconSVG id={cat.icons[0]?.id ?? 'mystery'} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 7, fontWeight: 800, color: cat.color, letterSpacing: 1,
                        fontFamily: "'Orbitron', system-ui, sans-serif",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cat.name.toUpperCase()}
                      </div>
                      <div style={{
                        fontSize: 7, color: 'rgba(26,42,58,0.4)',
                        fontFamily: "'Share Tech Mono', monospace",
                      }}>
                        {cat.icons.length} types · {cat.owned}/{cat.total}
                      </div>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,60,100,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${cat.pct}%`, borderRadius: 2,
                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`,
                    }} />
                  </div>
                  <div style={{
                    fontSize: 6, color: 'rgba(26,42,58,0.35)', textAlign: 'right',
                    fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    {cat.pct}% COMPLETE
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Category Detail ── */
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Back button + category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => { setSelectedCat(null); setSelectedToken(null) }}
                style={{
                  padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
                  background: 'rgba(0,60,100,0.06)', border: '1px solid rgba(0,60,100,0.1)',
                  color: 'rgba(26,42,58,0.45)', fontSize: 8,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                }}
              >
                ← BACK
              </button>
              <div style={{
                fontSize: 9, fontWeight: 900, color: activeCat?.color, letterSpacing: 2,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {activeCat?.name.toUpperCase()}
              </div>
              <div style={{
                marginLeft: 'auto',
                fontSize: 8, fontWeight: 700, color: '#7950f2',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {activeCat?.pct}%
              </div>
            </div>

            {/* Token grid — 4 columns */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            }}>
              {activeCat?.icons.map(icon => {
                const c = collection[icon.id]
                const isOwned = c && c.owned > 0
                const isSelected = selectedToken === icon.id

                return (
                  <motion.button
                    key={icon.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedToken(isSelected ? null : icon.id)}
                    style={{
                      padding: 6, borderRadius: 10, cursor: 'pointer',
                      background: isSelected
                        ? `${activeCat.color}15`
                        : isOwned
                          ? 'rgba(255,255,255,0.5)'
                          : 'rgba(0,60,100,0.03)',
                      border: `1.5px solid ${
                        isSelected ? `${activeCat.color}40`
                        : isOwned ? 'rgba(0,60,100,0.1)'
                        : 'rgba(0,60,100,0.05)'
                      }`,
                      opacity: isOwned ? 1 : 0.35,
                      filter: isOwned ? 'none' : 'grayscale(0.8)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <IconSVG id={icon.id} size={36} />
                    <div style={{
                      fontSize: 5, fontWeight: 700, color: '#1a2a3a',
                      fontFamily: "'Orbitron', system-ui, sans-serif",
                      letterSpacing: 0.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}>
                      {icon.name.toUpperCase()}
                    </div>
                    {c && (
                      <div style={{
                        fontSize: 6, color: 'rgba(26,42,58,0.4)',
                        fontFamily: "'Share Tech Mono', monospace",
                      }}>
                        {c.owned}/{c.total}
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Selected token detail */}
            {selectedToken && collection[selectedToken] && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 12, padding: 12, borderRadius: 10,
                  background: `${activeCat?.color}06`,
                  border: `1px solid ${activeCat?.color}15`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <IconSVG id={selectedToken} size={44} />
                  <div>
                    <div style={{
                      fontSize: 9, fontWeight: 900, color: '#1a2a3a', letterSpacing: 1,
                      fontFamily: "'Orbitron', system-ui, sans-serif",
                    }}>
                      {activeCat?.icons.find(i => i.id === selectedToken)?.name.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 8, color: 'rgba(26,42,58,0.45)',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      {collection[selectedToken].owned} / {collection[selectedToken].total} collected
                    </div>
                  </div>
                </div>

                {/* Rarity breakdown */}
                <div style={{
                  fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.3)',
                  fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6,
                }}>
                  RARITY BREAKDOWN
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {RARITY_ORDER.map(r => {
                    const count = collection[selectedToken].rarities[r] ?? 0
                    return (
                      <div key={r} style={{
                        flex: 1, padding: '4px 2px', borderRadius: 6, textAlign: 'center',
                        background: count > 0 ? `${RARITY_COLORS[r]}10` : 'rgba(0,60,100,0.03)',
                        border: `1px solid ${count > 0 ? `${RARITY_COLORS[r]}20` : 'rgba(0,60,100,0.05)'}`,
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 900,
                          color: count > 0 ? RARITY_COLORS[r] : 'rgba(26,42,58,0.15)',
                          fontFamily: "'Share Tech Mono', monospace",
                        }}>
                          {count}
                        </div>
                        <div style={{
                          fontSize: 5, color: 'rgba(26,42,58,0.3)',
                          fontFamily: "'Orbitron', system-ui, sans-serif",
                          letterSpacing: 0.5,
                        }}>
                          {r.slice(0, 3).toUpperCase()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* VIEW IN 3D button */}
                <button
                  onClick={() => setShow3D(true)}
                  style={{
                    width: '100%', marginTop: 10, padding: '10px', borderRadius: 20,
                    border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(90deg, #D4AF37, #CD7F32)',
                    color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 3,
                    fontFamily: "'Orbitron', system-ui, sans-serif",
                    boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
                  }}
                >
                  ◆ VIEW IN 3D — VAULT PRESTIGE
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token 3D Viewer Modal */}
      <Token3DViewer
        visible={show3D}
        onClose={() => setShow3D(false)}
        tokenName={selectedToken ? activeCat?.icons.find(i => i.id === selectedToken)?.name.toUpperCase() ?? 'TERRITORY' : 'TERRITORY'}
        category={activeCat?.name ?? 'UNKNOWN'}
        catColor={activeCat?.color ?? '#39FF14'}
        tier="GOLD"
        serial={Math.floor(Math.random() * 999) + 1}
        maxSupply={1000}
      />
    </GlassPanel>
  )
}
