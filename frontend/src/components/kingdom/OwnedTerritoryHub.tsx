/**
 * OwnedTerritoryHub — Primary interaction surface for OWNED territories & kingdoms.
 *
 * Replaces the old "click owned hex → open Token3D directly" flow with a
 * proper hub offering 3 tabs:
 *   1. GALLERY     — all tokens owned in this kingdom (with 3D viewer on tap)
 *   2. CUSTOMIZE   — name, fill color, border color, embed image URL, diaporama
 *   3. KINGDOM     — full stats (was only accessible through the Token3D overlay)
 *
 * Token 3D is preserved but now REACHED INSIDE the Gallery tab (tap a card
 * → opens Token3D), so it's still a featured experience — just no longer
 * the landing screen.
 */
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { Token3DViewer } from '../shared/Token3DViewer'
import { TokenHexPreview } from '../shared/TokenHexPreview'
import { api } from '../../services/api'
import { usePlayer } from '../../store'

interface Kingdom {
  cluster_id?: string
  id?: string
  h3_indexes?: string[]
  size?: number
  tier?: number
  is_main?: boolean
  tdc_per_24h?: number
  centroid_lat?: number
  centroid_lon?: number
  owner_username?: string
  [k: string]: any
}

interface TokenInfo {
  h3_index: string
  name: string
  rarity: string
  biome: string
  poi_category?: string
  poi_icon?: string
  income_per_day: number
  defense_points: number
  is_capital?: boolean
}

interface Props {
  kingdom: Kingdom
  initialTab?: 'gallery' | 'customize' | 'kingdom'
  onClose: () => void
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

const TIER_COLOR: Record<number, string> = {
  1: '#94a3b8', 2: '#22c55e', 3: '#3b82f6', 4: '#8b5cf6', 5: '#f59e0b', 6: '#ef4444',
}

const TABS: Array<{ id: 'gallery' | 'customize' | 'kingdom'; label: string; iconId: string }> = [
  { id: 'gallery',   label: 'GALLERY',   iconId: 'medal' },
  { id: 'customize', label: 'CUSTOMIZE', iconId: 'palette' },
  { id: 'kingdom',   label: 'KINGDOM',   iconId: 'crown' },
]

// ════════════════════════════════════════════════════════════════
// Customization hook (localStorage-backed)
// ════════════════════════════════════════════════════════════════
function useKingdomCustomization(kingdomId: string) {
  const key = `hx_kingdom_${kingdomId}`
  const load = (): { name?: string; fillColor?: string; borderColor?: string; imageUrl?: string } => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
  }
  const [cust, setCust] = useState(load)
  const save = (next: typeof cust) => {
    setCust(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
  }
  return [cust, save] as const
}

// ════════════════════════════════════════════════════════════════
// GALLERY TAB — grid of owned tokens, tap → Token3D
// ════════════════════════════════════════════════════════════════
function GalleryTab({ kingdom, tokens, onToken3D }: {
  kingdom: Kingdom
  tokens: TokenInfo[]
  onToken3D: (token: TokenInfo) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(121,80,242,0.06)',
        border: '1px solid rgba(121,80,242,0.15)',
        fontSize: 8, color: 'rgba(255,255,255,0.55)',
        letterSpacing: 1, fontFamily: "'Orbitron', sans-serif",
      }}>
        {tokens.length} TOKEN{tokens.length !== 1 ? 'S' : ''} IN THIS KINGDOM · TAP TO VIEW IN 3D
      </div>

      {tokens.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40,
          color: 'rgba(255,255,255,0.3)',
          fontSize: 9, letterSpacing: 2,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          NO TOKENS YET
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 10,
        }}>
          {tokens.map((token, i) => {
            const color = RARITY_COLORS[(token.rarity || 'common').toLowerCase()] || '#94a3b8'
            return (
              <button
                key={`${token.h3_index}-${i}`}
                onClick={() => onToken3D(token)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                  background: `${color}08`,
                  border: `1px solid ${color}25`,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <TokenHexPreview
                  iconId={token.poi_icon || token.poi_category?.toLowerCase() || token.biome || 'city'}
                  rarity={(token.rarity || 'common').toLowerCase()}
                  catColor={color}
                  size={56}
                  shiny={(token.rarity || '').toLowerCase() === 'mythic'}
                />
                <div style={{
                  fontSize: 7, fontWeight: 700, color: '#e2e8f0',
                  fontFamily: "'Orbitron', sans-serif",
                  textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: 80,
                }}>
                  {(token.name || 'ZONE').toUpperCase().slice(0, 10)}
                </div>
                {token.is_capital && (
                  <div style={{
                    fontSize: 6, color: '#fbbf24',
                    fontFamily: "'Share Tech Mono', monospace",
                    letterSpacing: 1,
                  }}>CAPITAL</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CUSTOMIZE TAB — name, colors, embed, diaporama
// ════════════════════════════════════════════════════════════════
function CustomizeTab({ kingdom, tokens }: { kingdom: Kingdom; tokens: TokenInfo[] }) {
  const kId = kingdom.cluster_id || kingdom.id || 'kingdom'
  const [cust, setCust] = useKingdomCustomization(kId)
  const [name, setName] = useState(cust.name || 'My Kingdom')
  const [fillColor, setFillColor] = useState(cust.fillColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [borderColor, setBorderColor] = useState(cust.borderColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [imageUrl, setImageUrl] = useState(cust.imageUrl || '')
  const [saving, setSaving] = useState(false)

  const minTerritoriesForEmbed = 3
  const embedUnlocked = (kingdom.size || tokens.length) >= minTerritoriesForEmbed

  const handleSave = async () => {
    setSaving(true)
    // Local save (immediate feedback)
    setCust({ name, fillColor, borderColor, imageUrl })

    // Remote save (best-effort — backend supports per-territory customization)
    if (tokens.length > 0 && tokens[0].h3_index) {
      try {
        await api.post('/territories/customize/', {
          h3_index: tokens[0].h3_index,
          display_name: name,
          border_color: borderColor,
          fill_color: fillColor,
          embed_type: imageUrl ? 'image' : 'none',
          embed_url: imageUrl,
          embed_title: name,
        })
      } catch (err: any) {
        // Non-blocking: local save already done. Only warn if it's a tier lock.
        const msg = err?.response?.data?.error
        if (msg && /requires/.test(msg)) {
          toast(msg, { icon: 'i' })
        }
      }
    }
    toast.success(`${name} saved!`)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Name */}
      <div>
        <div style={{
          fontSize: 7, color: 'rgba(255,255,255,0.45)',
          letterSpacing: 2, marginBottom: 6,
          fontFamily: "'Orbitron', sans-serif",
        }}>KINGDOM NAME</div>
        <input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 30))}
          placeholder="Name your empire..."
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)',
            color: '#e2e8f0', fontSize: 12,
            fontFamily: "'Share Tech Mono', monospace",
            boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.45)',
            letterSpacing: 2, marginBottom: 6,
            fontFamily: "'Orbitron', sans-serif",
          }}>FILL COLOR</div>
          <input
            type="color"
            value={fillColor}
            onChange={e => setFillColor(e.target.value)}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', cursor: 'pointer',
            }}
          />
        </div>
        <div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.45)',
            letterSpacing: 2, marginBottom: 6,
            fontFamily: "'Orbitron', sans-serif",
          }}>BORDER COLOR</div>
          <input
            type="color"
            value={borderColor}
            onChange={e => setBorderColor(e.target.value)}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* Embed image */}
      <div>
        <div style={{
          fontSize: 7, color: embedUnlocked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)',
          letterSpacing: 2, marginBottom: 6,
          fontFamily: "'Orbitron', sans-serif",
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          EMBED IMAGE URL
          {!embedUnlocked && (
            <span style={{
              fontSize: 6, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            }}>
              UNLOCK AT {minTerritoriesForEmbed} TERRITORIES
            </span>
          )}
        </div>
        <input
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          disabled={!embedUnlocked}
          placeholder="https://..."
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)',
            color: embedUnlocked ? '#e2e8f0' : 'rgba(255,255,255,0.3)',
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            boxSizing: 'border-box', outline: 'none',
            opacity: embedUnlocked ? 1 : 0.5,
          }}
        />
        {imageUrl && embedUnlocked && (
          <img
            src={imageUrl}
            alt=""
            style={{
              width: '100%', maxHeight: 120, objectFit: 'cover',
              borderRadius: 8, marginTop: 8,
              border: `1px solid ${borderColor}40`,
            }}
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
      </div>

      {/* Live preview — diaporama */}
      <div>
        <div style={{
          fontSize: 7, color: 'rgba(255,255,255,0.45)',
          letterSpacing: 2, marginBottom: 6,
          fontFamily: "'Orbitron', sans-serif",
        }}>LIVE PREVIEW</div>
        <div style={{
          padding: 14, borderRadius: 10,
          background: imageUrl
            ? `linear-gradient(135deg, ${fillColor}20, ${fillColor}08), url(${imageUrl}) center/cover`
            : `linear-gradient(135deg, ${fillColor}20, ${fillColor}08)`,
          border: `2px solid ${borderColor}`,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 900, color: '#e2e8f0',
            letterSpacing: 2, fontFamily: "'Orbitron', sans-serif",
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}>
            {(name || 'KINGDOM').toUpperCase()}
          </div>
          <div style={{
            fontSize: 8, color: 'rgba(255,255,255,0.6)',
            marginTop: 4, letterSpacing: 1,
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {tokens.length} TERRITORIES · TIER {kingdom.tier || 1}
          </div>
        </div>
      </div>

      {/* Token strip */}
      {tokens.length > 0 && (
        <div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.45)',
            letterSpacing: 2, marginBottom: 6,
            fontFamily: "'Orbitron', sans-serif",
          }}>TERRITORIES IN KINGDOM</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {tokens.slice(0, 20).map((t, i) => (
              <div key={i} style={{
                minWidth: 60, height: 60, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${fillColor}25, ${fillColor}08)`,
                border: `2px solid ${borderColor}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 700, color: '#e2e8f0',
                fontFamily: "'Orbitron', sans-serif",
                textAlign: 'center', padding: 4,
              }}>
                {(t.name || 'Z').slice(0, 6).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-game btn-game-gold"
        style={{ width: '100%', fontSize: 10, letterSpacing: 2, marginTop: 4 }}
      >
        {saving ? 'SAVING…' : 'SAVE CUSTOMIZATION'}
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// KINGDOM TAB — full stats (was the Token3D overlay content)
// ════════════════════════════════════════════════════════════════
function KingdomTab({ kingdom, tokens }: { kingdom: Kingdom; tokens: TokenInfo[] }) {
  const totalIncome = tokens.reduce((s, t) => s + (t.income_per_day || 0), 0)
  const totalDefense = tokens.reduce((s, t) => s + (t.defense_points || 0), 0)
  const tier = kingdom.tier || 1
  const tierColor = TIER_COLOR[Math.min(tier, 6)]

  // Rarity distribution
  const rarityCount: Record<string, number> = {}
  tokens.forEach(t => {
    const r = (t.rarity || 'common').toLowerCase()
    rarityCount[r] = (rarityCount[r] || 0) + 1
  })

  const biomeCount: Record<string, number> = {}
  tokens.forEach(t => {
    const b = (t.biome || 'rural').toLowerCase()
    biomeCount[b] = (biomeCount[b] || 0) + 1
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hero */}
      <div style={{
        padding: 14, borderRadius: 10,
        background: `linear-gradient(135deg, ${tierColor}15, ${tierColor}05)`,
        border: `1px solid ${tierColor}30`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 7, color: tierColor, letterSpacing: 3, fontWeight: 900,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          TIER {tier} KINGDOM
        </div>
        <div style={{
          fontSize: 26, fontWeight: 900, color: '#e2e8f0',
          fontFamily: "'Share Tech Mono', monospace",
          marginTop: 4, letterSpacing: 1,
        }}>
          {kingdom.size || tokens.length}
        </div>
        <div style={{
          fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          TERRITORIES
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={statCard('#f59e0b')}>
          <div style={statLabel}>HEX / 24H</div>
          <div style={statValue('#f59e0b')}>
            <IconSVG id="hex_coin" size={12} /> {Math.round(kingdom.tdc_per_24h || totalIncome / 288 * 24)}
          </div>
        </div>
        <div style={statCard('#3b82f6')}>
          <div style={statLabel}>DEFENSE</div>
          <div style={statValue('#3b82f6')}>
            <IconSVG id="shield" size={12} /> {totalDefense.toLocaleString()}
          </div>
        </div>
        <div style={statCard('#22c55e')}>
          <div style={statLabel}>INCOME / DAY</div>
          <div style={statValue('#22c55e')}>
            +{totalIncome.toLocaleString()}
          </div>
        </div>
        <div style={statCard('#7950f2')}>
          <div style={statLabel}>TIER</div>
          <div style={statValue('#7950f2')}>{tier}/6</div>
        </div>
      </div>

      {/* Rarity breakdown */}
      {Object.keys(rarityCount).length > 0 && (
        <div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.45)',
            letterSpacing: 2, marginBottom: 8,
            fontFamily: "'Orbitron', sans-serif",
          }}>RARITY BREAKDOWN</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(rarityCount).map(([r, n]) => (
              <div key={r} style={{
                padding: '4px 10px', borderRadius: 6,
                background: `${RARITY_COLORS[r] || '#94a3b8'}15`,
                border: `1px solid ${RARITY_COLORS[r] || '#94a3b8'}35`,
                color: RARITY_COLORS[r] || '#94a3b8',
                fontSize: 8, fontWeight: 700, letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
              }}>
                {r.toUpperCase()} × {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biome distribution */}
      {Object.keys(biomeCount).length > 0 && (
        <div>
          <div style={{
            fontSize: 7, color: 'rgba(255,255,255,0.45)',
            letterSpacing: 2, marginBottom: 8,
            fontFamily: "'Orbitron', sans-serif",
          }}>BIOME DISTRIBUTION</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(biomeCount).map(([b, n]) => (
              <div key={b} style={{
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 8, fontWeight: 700, letterSpacing: 1,
                fontFamily: "'Orbitron', sans-serif",
              }}>
                {b.toUpperCase()} × {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      {kingdom.centroid_lat !== undefined && kingdom.centroid_lon !== undefined && (
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 7, color: 'rgba(255,255,255,0.5)',
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1,
        }}>
          {kingdom.centroid_lat.toFixed(4)}, {kingdom.centroid_lon.toFixed(4)}
        </div>
      )}
    </div>
  )
}

const statCard = (color: string) => ({
  padding: '10px 12px', borderRadius: 10,
  background: `linear-gradient(135deg, ${color}10, ${color}04)`,
  border: `1px solid ${color}25`,
})

const statLabel: React.CSSProperties = {
  fontSize: 7, color: 'rgba(255,255,255,0.45)',
  letterSpacing: 2, marginBottom: 4,
  fontFamily: "'Orbitron', sans-serif",
}

const statValue = (color: string): React.CSSProperties => ({
  fontSize: 14, fontWeight: 900, color,
  fontFamily: "'Share Tech Mono', monospace",
  display: 'flex', alignItems: 'center', gap: 4,
})

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function OwnedTerritoryHub({ kingdom, initialTab = 'gallery', onClose }: Props) {
  const [tab, setTab] = useState<'gallery' | 'customize' | 'kingdom'>(initialTab)
  const [token3D, setToken3D] = useState<TokenInfo | null>(null)
  const player = usePlayer()

  // If we only have partial kingdom info, fetch full territories
  const { data: mineData } = useQuery({
    queryKey: ['my-territories-detail', player?.id],
    queryFn: () => api.get('/territories-geo/mine/').then(r => r.data),
    staleTime: 30000,
    enabled: !!player,
  })

  // Enrich kingdom.territories with detailed info
  const tokens = useMemo<TokenInfo[]>(() => {
    const h3List = kingdom.h3_indexes || kingdom.territories || []
    const allMine: any[] = mineData?.territories || []
    const byH3 = new Map(allMine.map(t => [t.h3_index, t]))

    return h3List.map((h3: any, i: number) => {
      const source = typeof h3 === 'string' ? byH3.get(h3) : h3
      const h3Index = typeof h3 === 'string' ? h3 : (h3.h3_index || '')
      return {
        h3_index: h3Index,
        name: source?.poi_name || source?.place_name || source?.custom_name || source?.name || h3Index.slice(0, 12),
        rarity: source?.rarity || 'common',
        biome: source?.territory_type || source?.biome || 'rural',
        poi_category: source?.poi_category,
        poi_icon: source?.poi_icon,
        income_per_day: Math.round((source?.resource_credits || source?.tdc_per_day || 10) * 288),
        defense_points: source?.defense_points || 100,
        is_capital: i === 0,
      }
    })
  }, [kingdom, mineData])

  const kingdomName = kingdom.owner_username
    ? `${kingdom.owner_username}'s Kingdom`
    : (kingdom.is_main ? 'Main Kingdom' : 'Kingdom')

  const accentColor = TIER_COLOR[Math.min(kingdom.tier || 1, 6)]

  return (
    <>
      <GlassPanel
        title={kingdomName.toUpperCase()}
        onClose={onClose}
        accent={accentColor}
        width={480}
      >
        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 14,
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 20, cursor: 'pointer',
                fontSize: 8, fontWeight: tab === t.id ? 800 : 500, letterSpacing: 1,
                background: tab === t.id ? `${accentColor}15` : 'rgba(255,255,255,0.04)',
                color: tab === t.id ? accentColor : 'rgba(255,255,255,0.4)',
                border: `1px solid ${tab === t.id ? `${accentColor}40` : 'rgba(255,255,255,0.08)'}`,
                fontFamily: "'Orbitron', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 0.2s',
              }}
            >
              <IconSVG id={t.iconId} size={11} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'gallery'   && <GalleryTab kingdom={kingdom} tokens={tokens} onToken3D={setToken3D} />}
            {tab === 'customize' && <CustomizeTab kingdom={kingdom} tokens={tokens} />}
            {tab === 'kingdom'   && <KingdomTab kingdom={kingdom} tokens={tokens} />}
          </motion.div>
        </AnimatePresence>
      </GlassPanel>

      {/* Token 3D viewer — opened from Gallery tab */}
      {token3D && createPortal(
        <Token3DViewer
          visible={true}
          onClose={() => setToken3D(null)}
          tokenName={(token3D.name || 'TERRITORY').toUpperCase()}
          category={(token3D.poi_category || token3D.biome || 'TERRITORY').toUpperCase()}
          catColor={RARITY_COLORS[(token3D.rarity || 'common').toLowerCase()] || '#94a3b8'}
          iconId={token3D.poi_icon || token3D.poi_category?.toLowerCase() || token3D.biome || 'city'}
          tier={
            (token3D.rarity || '').toLowerCase() === 'mythic' ? 'EMERALD' :
            (token3D.rarity || '').toLowerCase() === 'legendary' ? 'GOLD' :
            (token3D.rarity || '').toLowerCase() === 'epic' ? 'SILVER' : 'BRONZE'
          }
          serial={1}
          maxSupply={10000}
          edition="GENESIS"
          biome={(token3D.biome || 'rural').toUpperCase()}
          power={token3D.defense_points || 50}
          rarity={
            (token3D.rarity || '').toLowerCase() === 'mythic' ? 99 :
            (token3D.rarity || '').toLowerCase() === 'legendary' ? 95 :
            (token3D.rarity || '').toLowerCase() === 'epic' ? 85 :
            (token3D.rarity || '').toLowerCase() === 'rare' ? 70 :
            (token3D.rarity || '').toLowerCase() === 'uncommon' ? 50 : 30
          }
        />,
        document.body
      )}
    </>
  )
}
