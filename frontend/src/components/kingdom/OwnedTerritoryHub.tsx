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
import { rarityLabel } from '../../services/balance'
import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG, getIcon } from '../shared/iconBank'
import { Token3DViewer, RARITY_TIER, TERRAIN_ICON } from '../shared/Token3DViewer'
import { TokenFace2D } from '../shared/TokenFace2D'
import { iconFor, iconIdFor } from '../shared/poiIcons'
import { RES_ICON } from '../shared/resourceIcons'
import { api } from '../../services/api'
import { useServerKingdomCustom, useSaveKingdomCustom, withLegacy } from './kingdomCustom'
import { usePlayer, useStore } from '../../store'
import { Crown, LayoutGrid, Palette, Lock, MapPin, Swords } from 'lucide-react'
import { KingdomArmyTab } from './KingdomArmyTab'

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
  has_token?: boolean     // a real token (POI, deposit, species) sits on the hex — plain hexes are not in the gallery
}

interface Props {
  kingdom: Kingdom
  initialTab?: Tab
  onClose: () => void
}

const RARITY_COLORS: Record<string, string> = {
  common: '#cd7f32', uncommon: '#cbd5e1', rare: '#fbbf24',
  epic: '#10b981', legendary: '#67e8f9', mythic: '#ec4899',
}

const TIER_COLOR: Record<number, string> = {
  1: '#94a3b8', 2: '#22c55e', 3: '#3b82f6', 4: '#8b5cf6', 5: '#f59e0b', 6: '#ef4444',
}

type Tab = 'gallery' | 'army' | 'customize' | 'kingdom'
const TABS: Array<{ id: Tab; label: string; Icon: typeof Crown }> = [
  { id: 'gallery',   label: 'GALLERY',   Icon: LayoutGrid },
  { id: 'army',      label: 'ARMY',      Icon: Swords },
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
            {rarityLabel(r)} × {counts[r]}
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

/** One gallery slot: the final token face (same as the Codex / the 3D token), data from /codex/territory/<h3>/. */
function GalleryToken({ token, onOpen }: { token: TokenInfo; onOpen: () => void }) {
  const { data: d } = useQuery<any>({ queryKey: ['codex-territory', token.h3_index],
    queryFn: () => api.get(`/codex/territory/${token.h3_index}/`).then(r => r.data), enabled: !!token.h3_index, staleTime: 300000 })
  const rarity = (d?.rarity || token.rarity || 'common').toLowerCase()
  const iconId = token.poi_icon || d?.poi_category || token.poi_category?.toLowerCase() || TERRAIN_ICON[d?.terrain] || d?.terrain || token.biome || 'city'
  const pictos = useMemo(() => d ? [iconFor(d.poi_category || iconId), getIcon(TERRAIN_ICON[d.terrain] || d.terrain || 'globe'),
    d.resources?.[0] ? getIcon(RES_ICON[d.resources[0].id] || 'box') : ''].filter(Boolean) : undefined, [d, iconId])
  return (
    <button onClick={onOpen} aria-label={`Inspect ${token.name || 'token'} in 3D`} title={token.name}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'inherit' }}>
      <TokenFace2D tier={RARITY_TIER[rarity] || 'BRONZE'} rarity={rarity} size={132}
        tokenName={token.name} category={(d?.poi_category || token.poi_category || d?.terrain || token.biome || 'TERRITORY').replace(/_/g, ' ')}
        iconId={iconId} imageSrc={d?.image_url || d?.satellite_url || ''} pictos={pictos}
        hexPerDay={d?.hex_per_day} terrain={d?.terrain} country={d?.country_code} tokenNo={d?.token_id ? String(d.token_id) : ''}
        edition={d?.edition_label || 'GENESIS'} date={d?.issued_at || ''}
        style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }} />
      {token.is_capital && <span className="hx-chip" style={{ position: 'absolute', top: 0, left: 0, padding: '2px 6px', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.5)', background: 'rgba(0,0,0,0.65)' }}><Crown size={10} /> CAPITAL</span>}
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hx-text-1)', maxWidth: 132, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{token.name}</span>
    </button>
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
          <div>Plain territories carry no token: take places, deposits or species next to this kingdom to fill the gallery</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, fontFamily: HEAD, marginTop: -4 }}>TAP A TOKEN TO INSPECT IN 3D</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 10, justifyItems: 'center' }}>
            {sorted.map((token, i) => <GalleryToken key={`${token.h3_index}-${i}`} token={token} onOpen={() => onToken3D(token)} />)}
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
  const server = useServerKingdomCustom(anchor)
  const cust = withLegacy(server)
  const saveKingdom = useSaveKingdomCustom()
  const [name, setName] = useState(cust.name || 'My Kingdom')
  const [fillColor, setFillColor] = useState(cust.fillColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [borderColor, setBorderColor] = useState(cust.borderColor || TIER_COLOR[Math.min(kingdom.tier || 1, 6)])
  const [imageUrl, setImageUrl] = useState(cust.imageUrl || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {   // server data can arrive after the first render
    if (cust.name) setName(cust.name)
    if (cust.fillColor) setFillColor(cust.fillColor)
    if (cust.borderColor) setBorderColor(cust.borderColor)
    if (cust.imageUrl) setImageUrl(cust.imageUrl)
  }, [cust.name, cust.fillColor, cust.borderColor, cust.imageUrl])

  const minTerritoriesForEmbed = 2      // any kingdom (2+ connected hexes) — cluster_views.CLUSTER_TIERS
  const embedUnlocked = (kingdom.size || tokens.length) >= minTerritoriesForEmbed
  const [uploading, setUploading] = useState(false)
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !anchor) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('image', file)
      const { data } = await api.post('/territories-geo/upload-image/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImageUrl(data.url)
      const r = await saveKingdom(anchor, { name, fillColor, borderColor, imageUrl: data.url })
      toast.success(`Picture saved on ${r.applied} territor${r.applied > 1 ? 'ies' : 'y'}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed')
    } finally { setUploading(false) }
  }

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

      {/* Kingdom background: a picture from the computer, drawn over the whole kingdom on the map (and its badge) */}
      <div>
        <div style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
          KINGDOM BACKGROUND · SHOWN ON THE MAP
          {!embedUnlocked && (
            <span className="hx-chip" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.12)' }}>
              <Lock size={10} /> CONNECT {minTerritoriesForEmbed} TERRITORIES
            </span>
          )}
        </div>
        <label
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && embedUnlocked) onPick({ target: { files: [f], value: '' } } as any) }}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, height: 128,
            borderRadius: 14, cursor: embedUnlocked && !uploading ? 'pointer' : 'not-allowed', overflow: 'hidden', opacity: embedUnlocked ? 1 : 0.5,
            border: `2px dashed ${imageUrl ? borderColor : 'rgba(255,255,255,0.25)'}`,
            background: imageUrl ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url('${imageUrl}') center/cover` : 'rgba(0,0,0,0.25)' }}>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!embedUnlocked || uploading} onChange={onPick} style={{ display: 'none' }} />
          <IconSVG id="picture" size={30} />
          <span style={{ font: "13px 'Lilita One', sans-serif", color: '#fff', textShadow: '0 1px 2px #000' }}>
            {uploading ? 'UPLOADING…' : imageUrl ? 'CHANGE THE PICTURE' : 'DROP A PICTURE OR CLICK'}</span>
          <span style={{ fontSize: 10, color: 'rgba(226,232,240,0.75)', textTransform: 'none', letterSpacing: 0 }}>JPG · PNG · WEBP · up to 4 MB</span>
        </label>
        {imageUrl && embedUnlocked && (
          <button className="hx-chip" style={{ cursor: 'pointer', marginTop: 6 }} onClick={async () => {
            setImageUrl('')
            if (anchor) { try { await saveKingdom(anchor, { name, fillColor, borderColor, imageUrl: '' }); toast.success('Background removed') } catch { /* toast below */ } }
          }}>REMOVE THE BACKGROUND</button>
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
/** HEX harvesting of this kingdom, detailed (GET /kingdom/<h3>/overview/ income): zones × 100, kingdom bonus,
 * every token, then the multipliers (Science, starter boost, regions, events). */
function IncomeBreakdown({ h3 }: { h3: string }) {
  const { data } = useQuery<any>({ queryKey: ['kingdom-overview', h3], queryFn: () => api.get(`/kingdom/${h3}/overview/`).then(r => r.data),
    enabled: !!h3, staleTime: 10000 })
  const inc = data?.income
  if (!inc) return <div className="hx-skeleton" style={{ height: 120, borderRadius: 12 }} />
  const row = (label: React.ReactNode, value: React.ReactNode, color = '#e2e8f0') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0', textTransform: 'none', letterSpacing: 0 }}>
      <span style={{ color: 'var(--hx-text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: MONO, color, flexShrink: 0 }}>{value}</span>
    </div>)
  return (
    <div className="hx-card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div className="hx-section-title" style={{ margin: 0 }}>HEX HARVESTING</div>
        <div style={{ fontFamily: MONO, fontSize: 22, color: '#fde68a', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconSVG id="hex_coin" size={16} />{inc.total.toLocaleString()}<span style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>/DAY</span></div>
      </div>
      {row(`${inc.zones} zone${inc.zones > 1 ? 's' : ''} × ${inc.plain_each}`, `+${inc.plain.toLocaleString()}`)}
      {inc.kingdom_bonus > 0 && row(`Kingdom bonus · ${inc.zones} × ${inc.kingdom_bonus_each}`, `+${inc.kingdom_bonus.toLocaleString()}`)}
      {row(`${inc.token_count} token${inc.token_count !== 1 ? 's' : ''}`, `+${inc.tokens_total.toLocaleString()}`, '#fde68a')}
      {inc.tokens.slice(0, 8).map((t: any, i: number) => row(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, paddingLeft: 10 }}>
          <IconSVG id={iconIdFor(t.category)} size={13} />{t.name}
          <span style={{ fontSize: 9, color: RARITY_COLORS[t.rarity] || '#94a3b8' }}>{rarityLabel(t.rarity)}{t.bonus ? ` · +${t.bonus}%` : ''}</span></span>,
        `+${t.hex_per_day.toLocaleString()}`, '#cbd5e1'))}
      {inc.tokens.length > 8 && row(<span style={{ paddingLeft: 10 }}>+{inc.token_count - 8} more</span>, '')}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6 }}>
        {row('Before multipliers', inc.before_multipliers.toLocaleString())}
        {row(`Multipliers${inc.science > 1 ? ` · Science x${inc.science}` : ''}${inc.beginner > 1 ? ` · starter x${inc.beginner}` : ''}`, `x${inc.multiplier}`, '#86efac')}
      </div>
    </div>
  )
}

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
      <IncomeBreakdown h3={kingdom.h3_indexes?.[0] || tokens[0]?.h3_index || ''} />
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
  const [tab, setTab] = useState<Tab>(initialTab)
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
        has_token: !!(source?.poi_name || source?.is_landmark),
      }
    })
  }, [kingdom, mineData])

  const custom = useServerKingdomCustom(kingdom.h3_indexes?.[0] || tokens[0]?.h3_index)
  const kingdomName = custom.name || (kingdom as any).name || (kingdom.owner_username
    ? `${kingdom.owner_username}'s Kingdom`
    : (kingdom.is_main ? 'Main Kingdom' : 'Kingdom'))

  const accentColor = TIER_COLOR[Math.min(kingdom.tier || 1, 6)]

  return (
    <>
      <GlassPanel
        title={kingdomName.toUpperCase()}
        onClose={onClose}
        accent={ACCENT}
        width={520}
        icon={custom.imageUrl
          ? <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'block', background: `#0b1626 url('${custom.imageUrl}') center/cover`, border: `1.5px solid ${ACCENT}` }} />
          : <Crown size={20} />}
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
            {tab === 'gallery'   && <GalleryTab kingdom={kingdom} tokens={tokens.filter(t => t.has_token)} onToken3D={setToken3D} />}
            {tab === 'army'      && <KingdomArmyTab h3={tokens[0]?.h3_index || ''}
                                      onOpenMilitary={() => { onClose(); useStore.getState().setActivePanel('combat') }} />}
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
          h3Index={token3D.h3_index}
          rarityKey={(token3D.rarity || 'common').toLowerCase()}
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
