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
import { useServerKingdomCustom, useSaveKingdomCustom } from './kingdomCustom'
import { usePlayer } from '../../store'
import { Crown, LayoutGrid, Palette, Lock, MapPin } from 'lucide-react'

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

const TABS: Array<{ id: 'gallery' | 'customize' | 'kingdom'; label: string; Icon: typeof Crown }> = [
  { id: 'gallery',   label: 'GALLERY',   Icon: LayoutGrid },
  { id: 'customize', label: 'CUSTOMIZE', Icon: Palette },
  { id: 'kingdom',   label: 'KINGDOM',   Icon: Crown },
]

const ACCENT = '#cc8800'
const HEAD = "'Orbitron', sans-serif"
const MONO = "'Share Tech Mono', monospace"
const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']
const HEX_CLIP = 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)'
const fieldLabel: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 6, fontFamily: HEAD }

/** Segmented bar of rarity counts (real token data) */
function RarityBar({ tokens }: { tokens: TokenInfo[] }) {
  const counts: Record<string, number> = {}
  tokens.forEach(t => { const r = (t.rarity || 'common').toLowerCase(); counts[r] = (counts[r] || 0) + 1 })
  const total = tokens.length || 1
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', gap: 2 }}>
        {RARITY_ORDER.filter(r => counts[r]).map(r => (
          <div key={r} title={`${r} × ${counts[r]}`} style={{ width: `${(counts[r] / total) * 100}%`, background: RARITY_COLORS[r], boxShadow: `0 0 8px ${RARITY_COLORS[r]}80` }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {RARITY_ORDER.filter(r => counts[r]).map(r => (
          <span key={r} className="hx-chip" style={{ color: RARITY_COLORS[r], borderColor: `${RARITY_COLORS[r]}55`, background: `${RARITY_COLORS[r]}14` }}>
            {r.toUpperCase()} × {counts[r]}
          </span>
        ))}
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block', cursor: 'pointer' }}>
      <div style={fieldLabel}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '4px 10px 4px 4px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.16)' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
        <span style={{ fontSize: 12, color: '#e2e8f0', fontFamily: MONO, textTransform: 'uppercase' }}>{value}</span>
      </div>
    </label>
  )
}

// ════════════════════════════════════════════════════════════════
// GALLERY TAB — grid of owned tokens, tap → Token3D
// ════════════════════════════════════════════════════════════════
function GalleryTab({ kingdom, tokens, onToken3D }: {
  kingdom: Kingdom
  tokens: TokenInfo[]
  onToken3D: (token: TokenInfo) => void
}) {
  const rank = (t: TokenInfo) => RARITY_ORDER.indexOf((t.rarity || 'common').toLowerCase())
  const sorted = [...tokens].sort((a, b) => (a.is_capital ? -1 : b.is_capital ? 1 : (rank(a) < 0 ? 9 : rank(a)) - (rank(b) < 0 ? 9 : rank(b))))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Collection summary */}
      <div className="hx-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div className="hx-section-title" style={{ margin: 0 }}>COLLECTION</div>
          <div style={{ fontFamily: MONO, fontSize: 20, color: '#e2e8f0' }}>
            {tokens.length} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: HEAD, letterSpacing: 1 }}>TOKEN{tokens.length !== 1 ? 'S' : ''}</span>
          </div>
        </div>
        {tokens.length > 0 && <RarityBar tokens={tokens} />}
      </div>

      {tokens.length === 0 ? (
        <div className="hx-empty">
          <LayoutGrid size={28} color={ACCENT} />
          <div className="hx-empty__title">NO TOKENS YET</div>
          <div>Claim territories in this kingdom to grow your collection</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, fontFamily: HEAD, marginTop: -4 }}>TAP A TOKEN TO INSPECT IN 3D</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 10 }}>
            {sorted.map((token, i) => {
              const r = (token.rarity || 'common').toLowerCase()
              const color = RARITY_COLORS[r] || '#94a3b8'
              const premium = r === 'legendary' || r === 'mythic'
              return (
                <button
                  key={`${token.h3_index}-${i}`}
                  onClick={() => onToken3D(token)}
                  className="hx-card hx-card--interactive hx-rise"
                  aria-label={`Inspect ${token.name || 'token'} in 3D`}
                  style={{
                    ['--accent' as any]: color,
                    animationDelay: `${i * 40}ms`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '14px 8px 10px', color: 'inherit', font: 'inherit', textAlign: 'center',
                    background: `radial-gradient(circle at 50% 30%, ${color}${premium ? '40' : '24'}, transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`,
                    borderColor: `${color}${premium ? '90' : '50'}`,
                    boxShadow: premium ? `0 0 18px ${color}35, inset 0 1px 0 rgba(255,255,255,0.08)` : undefined,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, boxShadow: `0 0 10px ${color}` }} />
                  {token.is_capital && (
                    <span className="hx-chip" style={{ position: 'absolute', top: 8, left: 6, padding: '2px 6px', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.5)', background: 'rgba(0,0,0,0.55)' }}>
                      <Crown size={10} /> CAPITAL
                    </span>
                  )}
                  <div style={{ marginTop: token.is_capital ? 14 : 0 }}>
                    <TokenHexPreview
                      iconId={token.poi_icon || token.poi_category?.toLowerCase() || token.biome || 'city'}
                      rarity={r}
                      catColor={color}
                      size={72}
                      shiny={r === 'mythic'}
                    />
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#e2e8f0', fontFamily: HEAD, letterSpacing: 0.5,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                  }}>
                    {(token.name || 'ZONE').toUpperCase()}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color, fontFamily: HEAD }}>{r.toUpperCase()}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: MONO }}>
                    <IconSVG id="hex_coin" size={11} /> +{(token.income_per_day || 0).toLocaleString()}/d
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CUSTOMIZE TAB — name, colors, embed, diaporama
// ════════════════════════════════════════════════════════════════
function CustomizeTab({ kingdom, tokens }: { kingdom: Kingdom; tokens: TokenInfo[] }) {
  const anchor: string | undefined = kingdom.h3_indexes?.[0] || tokens[0]?.h3_index
  const cust = useServerKingdomCustom(anchor)
  const saveKingdom = useSaveKingdomCustom()
  const [name, setName] = useState(cust.name || 'My Kingdom')
  const [fillColor, setFillColor] = useState(cust.fillColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [borderColor, setBorderColor] = useState(cust.borderColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [imageUrl, setImageUrl] = useState(cust.imageUrl || '')
  const [saving, setSaving] = useState(false)

  const minTerritoriesForEmbed = 3
  const embedUnlocked = (kingdom.size || tokens.length) >= minTerritoriesForEmbed

  const handleSave = async () => {
    if (!anchor) return
    setSaving(true)
    try {
      const r = await saveKingdom(anchor, { name, fillColor, borderColor, imageUrl: embedUnlocked ? imageUrl : '' })
      toast.success(`${name} saved — ${r.applied} territor${r.applied > 1 ? 'ies' : 'y'} updated on the map`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Name */}
      <div>
        <div style={fieldLabel}>KINGDOM NAME</div>
        <input
          className="hx-input"
          value={name}
          onChange={e => setName(e.target.value.slice(0, 30))}
          placeholder="Name your empire..."
          style={{ fontFamily: MONO, boxSizing: 'border-box' }}
        />
      </div>

      {/* Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ColorField label="FILL COLOR" value={fillColor} onChange={setFillColor} />
        <ColorField label="BORDER COLOR" value={borderColor} onChange={setBorderColor} />
      </div>

      {/* Embed image */}
      <div>
        <div style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
          EMBED IMAGE URL
          {!embedUnlocked && (
            <span className="hx-chip" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.12)' }}>
              <Lock size={10} /> UNLOCK AT {minTerritoriesForEmbed} TERRITORIES
            </span>
          )}
        </div>
        <input
          className="hx-input"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          disabled={!embedUnlocked}
          placeholder="https://..."
          style={{ fontFamily: MONO, boxSizing: 'border-box', opacity: embedUnlocked ? 1 : 0.5 }}
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
        <div style={fieldLabel}>LIVE PREVIEW</div>
        <div style={{
          padding: 16, borderRadius: 12,
          background: imageUrl
            ? `linear-gradient(135deg, ${fillColor}40, rgba(6,14,26,0.8)), url(${imageUrl}) center/cover`
            : `radial-gradient(circle at 50% 0%, ${fillColor}45, transparent 70%), linear-gradient(135deg, ${fillColor}20, ${fillColor}08)`,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 18px ${borderColor}40`,
          textAlign: 'center',
        }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 8px', clipPath: HEX_CLIP, background: `linear-gradient(160deg, ${fillColor}, ${fillColor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Crown size={22} />
          </div>
          <div style={{
            fontSize: 14, fontWeight: 900, color: '#e2e8f0',
            letterSpacing: 2, fontFamily: "'Orbitron', sans-serif",
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}>
            {(name || 'KINGDOM').toUpperCase()}
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.7)',
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
          <div style={fieldLabel}>TERRITORIES IN KINGDOM</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {tokens.slice(0, 20).map((t, i) => (
              <div key={i} style={{ width: 64, height: 64, flexShrink: 0, clipPath: HEX_CLIP, background: borderColor, padding: 2, boxSizing: 'border-box' }}>
                <div style={{
                  width: '100%', height: '100%', clipPath: HEX_CLIP,
                  background: `linear-gradient(160deg, ${fillColor}66, ${fillColor}22), #0d1b2a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#e2e8f0', fontFamily: HEAD, textAlign: 'center',
                }}>
                  {(t.name || 'Z').slice(0, 6).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-game btn-game-gold"
        style={{ width: '100%', minHeight: 46, fontSize: 11, letterSpacing: 2, marginTop: 4 }}
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

  // Backend rule (kingdom_engine.recompute_kingdoms): tier = min(6, size // 3)
  const size = kingdom.size || tokens.length
  const nextAt = tier >= 6 ? null : (tier + 1) * 3
  const tierPct = nextAt ? Math.max(0, Math.min(100, ((size - tier * 3) / 3) * 100)) : 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero */}
      <div className="hx-card" style={{
        padding: 16,
        background: `radial-gradient(circle at 50% 0%, ${tierColor}30, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`,
        borderColor: `${tierColor}55`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10, color: tierColor, letterSpacing: 3, fontWeight: 900,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          TIER {tier} KINGDOM
        </div>
        <div style={{
          fontSize: 34, fontWeight: 900, color: '#e2e8f0',
          fontFamily: "'Share Tech Mono', monospace",
          marginTop: 4, letterSpacing: 1, textShadow: `0 0 18px ${tierColor}80`,
        }}>
          {size}
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 2,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          TERRITORIES
        </div>
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: 1, fontFamily: HEAD, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
            <span>{nextAt ? `NEXT: TIER ${tier + 1}` : 'MAX TIER'}</span>
            <span style={{ fontFamily: MONO, color: tierColor }}>{nextAt ? `${size}/${nextAt} HEXES` : `${size} HEXES`}</span>
          </div>
          <div className="hx-progress" style={{ ['--accent' as any]: tierColor }}>
            <div className="hx-progress__fill" style={{ width: `${tierPct}%` }} />
          </div>
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
        <div className="hx-card">
          <div className="hx-section-title" style={{ marginTop: 0 }}>RARITY BREAKDOWN</div>
          <RarityBar tokens={tokens} />
        </div>
      )}

      {/* Biome distribution */}
      {Object.keys(biomeCount).length > 0 && (
        <div className="hx-card">
          <div className="hx-section-title" style={{ marginTop: 0 }}>BIOME DISTRIBUTION</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(biomeCount).map(([b, n]) => (
              <div key={b} className="hx-chip" style={{ padding: '3px 10px 3px 4px', fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>
                <IconSVG id={b} size={18} />
                {b.toUpperCase()} × {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      {kingdom.centroid_lat !== undefined && kingdom.centroid_lon !== undefined && (
        <div className="hx-card" style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'rgba(255,255,255,0.6)',
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1,
        }}>
          <MapPin size={14} color={ACCENT} />
          {kingdom.centroid_lat.toFixed(4)}, {kingdom.centroid_lon.toFixed(4)}
        </div>
      )}
    </div>
  )
}

const statCard = (color: string): React.CSSProperties => ({
  padding: '12px 14px', borderRadius: 12,
  background: `linear-gradient(160deg, ${color}1c, ${color}06)`,
  border: `1px solid ${color}40`,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
})

const statLabel: React.CSSProperties = {
  fontSize: 9, color: 'rgba(255,255,255,0.45)',
  letterSpacing: 2, marginBottom: 4,
  fontFamily: "'Orbitron', sans-serif",
}

const statValue = (color: string): React.CSSProperties => ({
  fontSize: 20, fontWeight: 900, color,
  fontFamily: "'Share Tech Mono', monospace",
  display: 'flex', alignItems: 'center', gap: 6,
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
        accent={ACCENT}
        width={520}
        icon={<Crown size={20} />}
        subtitle={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accentColor, fontWeight: 700 }}>TIER {kingdom.tier || 1}</span>
            <span>· {kingdom.size || tokens.length} TERRITORIES</span>
          </span>
        }
      >
        {/* Tab bar */}
        <div className="hx-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <t.Icon size={14} /> {t.label}
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
