/**
 * Token3DViewer — React wrapper around hexodToken3D module.
 *
 * The actual rendering (Three.js, canvas drawing, animations) lives in
 * ./hexodToken3D.ts which is a faithful port of Richard's gold standard
 * read_only_templates/token_3Dviewer_admin_overlay.html.
 *
 * This wrapper just mounts the viewer into a div, handles close/escape,
 * and calls .update() when props change.
 */
import { useEffect, useRef, useState } from 'react'
import { createTokenViewer, type TokenViewerProps, type TierKey, TIERS } from './hexodToken3D'
import { getIcon } from './iconBank'
import { api } from '../../services/api'
import { iconFor } from './poiIcons'
import { RES_ICON } from './resourceIcons'
import { rarityLabel } from '../../services/balance'

const RARITY_COLOR: Record<string, string> = { common: '#cbd5e1', uncommon: '#fbbf24', rare: '#10b981', epic: '#67e8f9', legendary: '#67e8f9', mythic: '#67e8f9' }
const PANEL_W = 380

export const TERRAIN_ICON: Record<string, string> = { lake: 'water_drop', ice: 'glacier', farmland: 'wheat', grassland: 'sprout', wetland: 'leaf', water: 'ocean', arctic: 'tundra' }

// Game rarity → metal of the token (rare is no longer bronze like a common)
export const RARITY_TIER: Record<string, TierKey> = {
  common: 'SILVER', uncommon: 'GOLD', rare: 'EMERALD', epic: 'DIAMOND', legendary: 'DIAMOND', mythic: 'DIAMOND',
}
const label = (v?: string, d = '') => (v || d).replace(/_/g, ' ').toUpperCase()

export { TIERS }

export interface Token3DProps {
  visible: boolean
  onClose: () => void
  tokenName?: string
  category?: string
  catColor?: string
  iconId?: string
  tier?: TierKey
  serial?: number
  maxSupply?: number
  edition?: string
  biome?: string
  description?: string
  imageSrc?: string
  owner?: string
  date?: string
  infoPanel?: React.ReactNode
  /** H3 cell: the back of the token prints this territory's real data (GET /api/codex/territory/<h3>/) */
  h3Index?: string
  /** Game rarity ('common'…'mythic'): picks the metal tier when `tier` is not given */
  rarityKey?: string
  /** Face data when there is no territory to fetch (album pieces: creatures, biomes, events…) */
  face?: { country?: string; terrain?: string; tokenNo?: string; hexPerDay?: number; region?: string }
  /** @deprecated — kept for back-compat, unused */
  power?: number
  /** @deprecated — kept for back-compat, unused */
  rarity?: number
  /** @deprecated — kept for back-compat, unused */
  isShiny?: boolean
}

export function Token3DViewer(props: Token3DProps) {
  const {
    visible, onClose,
    tokenName, category, catColor, iconId,
    tier, serial, maxSupply, edition, biome,
    description, imageSrc, owner, date,
    infoPanel, h3Index, rarityKey, face,
  } = props
  const tierKey: TierKey = tier || RARITY_TIER[rarityKey || ''] || 'SILVER'

  const containerRef = useRef<HTMLDivElement>(null)
  // Height of the info sheet: the 3D stage stops above it so the sheet never hides the token
  const infoRef = useRef<HTMLDivElement>(null)
  const [infoH, setInfoH] = useState(0)
  const viewerRef = useRef<ReturnType<typeof createTokenViewer> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [credit, setCredit] = useState<{ text: string; wiki: string } | null>(null)   // picture author + license (CC BY-SA)
  // Reading panel (owner 2026-10-20: "name and description written in the panel, easier to read than on the small shiny token")
  const [info, setInfo] = useState<{ desc?: string; rarity?: string; country?: string; hexPerDay?: number; when?: string; region?: string }>({})
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // Stable fallback image — generated once, doesn't change on re-render

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!visible || !containerRef.current) return
    const iconSvg = iconId ? iconFor(iconId) : ''
    const initialProps: TokenViewerProps = {
      tier: tierKey,
      rarity: rarityKey || '', cellId: h3Index || '',
      category: label(category, 'TERRITORY'),
      catColor: catColor || '#39FF14',
      biome: (biome || 'RURAL').toUpperCase(),
      tokenName: (tokenName || 'HEXOD TERRITORY').toUpperCase(),
      description,
      edition: edition || 'GENESIS',
      serial: serial || 1,
      maxSupply: maxSupply || 1000,
      owner: owner || 'VAULT_HOLDER',
      date: date || '',
      iconSvg,
      imageSrc: imageSrc || '',   // no random stock photo: the face draws a designed plate until the real picture exists
      ...(face || {}),
    }
    viewerRef.current = createTokenViewer(containerRef.current, initialProps)
    setMounted(true)
    return () => {
      viewerRef.current?.dispose()
      viewerRef.current = null
      setMounted(false)
    }
  }, [visible])

  useEffect(() => {
    if (!viewerRef.current || !mounted) return
    viewerRef.current.update({
      tier: tierKey,
      category: label(category, 'TERRITORY'),
      catColor: catColor || '#39FF14',
      biome: (biome || 'RURAL').toUpperCase(),
      tokenName: (tokenName || 'HEXOD TERRITORY').toUpperCase(),
      description,
      serial: serial || 1,
      maxSupply: maxSupply || 1000,
      iconSvg: iconId ? iconFor(iconId) : '',
      imageSrc: imageSrc || '',   // no random stock photo: the face draws a designed plate until the real picture exists
    })
  }, [mounted, tierKey, category, catColor, biome, tokenName, description, serial, maxSupply, iconId, imageSrc])

  // Back of the token = real territory deed
  useEffect(() => {
    if (!mounted || !h3Index) return
    let alive = true
    api.get(`/codex/territory/${h3Index}/`).then(({ data: d }) => {
      if (!alive || !viewerRef.current) return
      // Front texts from the DB (the card's own words), then the deed on the back
      // History tokens: the date leads ("11 Sep 2001 — ...")
      const when = d.event_date ? new Date(d.event_date.length === 4 ? `${d.event_date}-01-01` : d.event_date)
        .toLocaleDateString('en-GB', d.event_date.length === 4 ? { year: 'numeric' } : d.event_date.length === 7 ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' }) : ''
      const front = [when, d.description || d.title].filter(Boolean).join(' — ') || d.fun_fact
      setCredit(d.image_url && d.image_credit ? { text: d.image_credit, wiki: d.wiki_url || '' } : null)
      if (front) viewerRef.current.update({ description: front.length > 240 ? front.slice(0, 237).replace(/\s+\S*$/, '') + '…' : front })
      setInfo({ desc: d.description || d.title || d.fun_fact || '', rarity: d.rarity, country: d.country_code || '', hexPerDay: d.hex_per_day,
                when, region: d.region?.name || '' })
      // Picture: the token's Wikipedia photo, else the real satellite view of its hex (never a stock photo)
      if (d.image_url || d.satellite_url) viewerRef.current.update({ imageSrc: d.image_url || d.satellite_url })
      viewerRef.current.update({
        // Pictos that make this token unique: category · terrain · its first resource
        pictos: [iconFor(d.poi_category || iconId || ''), getIcon(TERRAIN_ICON[d.terrain] || d.terrain || 'globe'),
                 d.resources?.[0] ? getIcon(RES_ICON[d.resources[0].id] || 'box') : ''].filter(Boolean),
        rarity: d.rarity, hexPerDay: d.hex_per_day, region: d.region?.name || '', country: d.country_code || '',
        terrain: d.terrain || '', tokenNo: d.token_id ? String(d.token_id) : '', cellId: d.h3_index,
        edition: d.edition_label || 'GENESIS', date: d.issued_at || '',
      })
      viewerRef.current.update({ back: {
        h3Index: d.h3_index, lat: d.lat, lon: d.lon, rarity: d.rarity, owner: d.owner, capturedAt: d.captured_at,
        hexPerDay: d.hex_per_day, region: d.region?.name ?? null, continent: d.region?.continent ?? null,
        resources: (d.resources || []).map((r: any) => ({ name: r.name, bonusPct: r.bonus_pct })),
        // a resource deposit shows its unique number among that resource's tokens as "#n" (owner 2026-10-25)
        tokenId: d.token_id ?? null, minted: !!d.minted, edition: d.card_number || d.edition || 1,
      } })
    }).catch(() => {})
    return () => { alive = false }
  }, [mounted, h3Index])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible])

  useEffect(() => {
    const el = infoRef.current
    if (!visible || !el || typeof ResizeObserver === 'undefined') { setInfoH(el?.offsetHeight || 0); return }
    const ro = new ResizeObserver(() => setInfoH(el.offsetHeight))
    ro.observe(el)
    setInfoH(el.offsetHeight)
    return () => ro.disconnect()
  }, [visible, wide])

  if (!visible) return null

  return (
    <div
      onMouseDown={e => {
        // Close if clicking the dark background (not the token)
        // The canvas container is position:absolute, so clicks on the dark
        // corners/edges hit this div
        if (e.target === e.currentTarget) onCloseRef.current()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        // Opaque studio backdrop: soft spotlight behind the token, deep vignette at the edges,
        // and the game underneath blurred so the token is the only thing that reads.
        background: 'radial-gradient(ellipse 60% 55% at 50% 46%, rgba(34,46,74,0.97) 0%, rgba(10,15,28,0.985) 55%, rgba(0,0,0,0.995) 100%)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Click-to-close zones: top, bottom, left, right edges */}
      {['top','bottom','left','right'].map(side => (
        <div key={side} onClick={() => onCloseRef.current()} style={{
          position: 'absolute', zIndex: 3, cursor: 'pointer',
          ...(side === 'top'    ? { top: 0, left: 0, right: 0, height: 60 } :
              side === 'bottom' ? { bottom: 0, left: 0, right: 0, height: 80 } :
              side === 'left'   ? { top: 60, bottom: 80, left: 0, width: '15%' } :
                                  { top: 60, bottom: 80, right: 0, width: '15%' }),
        }} />
      ))}

      <button
        onClick={() => onCloseRef.current()}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.6)', fontSize: 28, cursor: 'pointer',
          width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
      >×</button>

      <div
        ref={containerRef}
        // Wide screens (owner 2026-10-20): the reading panel as a left column (1/3), the 3D token on the right 2/3. Narrow: the panel is a bottom sheet and
        // the stage stops above it (hexodToken3D refits on resize)
        style={{ position: 'absolute', top: 0, zIndex: 1,
          ...(wide ? { left: '33.333%', right: 0, bottom: 0 } : { left: 0, right: 0, bottom: infoH ? infoH + 24 : 0 }) }}
      />

      <div style={{
        position: 'absolute', zIndex: 4, pointerEvents: 'none', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
        color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, textAlign: 'center',
        ...(wide ? { bottom: 18, left: '33.333%', right: 0 } : { top: 18, left: 0, right: 0 }),
      }}>Drag to rotate</div>

      <div ref={infoRef} className="hx-card" onMouseDown={e => e.stopPropagation()} style={{
        position: 'absolute', zIndex: 5, pointerEvents: 'auto', overflowY: 'auto', borderRadius: 18,
        display: 'flex', flexDirection: 'column', gap: 10, padding: 18, textTransform: 'none', letterSpacing: 0,
        background: 'rgba(8,14,28,0.92)', borderColor: `${RARITY_COLOR[info.rarity || rarityKey || ''] || '#94a3b8'}66`,
        ...(wide ? { top: 24, left: 24, bottom: 24, width: 'calc(33.333% - 36px)', minWidth: PANEL_W - 60, justifyContent: 'center' }
                 : { left: 12, right: 12, bottom: 12, maxHeight: '46vh' }),
      }}>
        {(() => {
          const rk = info.rarity || rarityKey || ''
          const col = RARITY_COLOR[rk] || '#cbd5e1'
          return (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {rk && <span style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${col}`, color: col, fontSize: 11, fontWeight: 900,
                letterSpacing: 1.5, fontFamily: "'Orbitron', sans-serif" }}>{rarityLabel(rk)}</span>}
              {category && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hx-text-2)', letterSpacing: 1 }}>{label(category)}</span>}
              {(info.country || face?.country) && <span style={{ fontSize: 11, color: 'var(--hx-text-3)' }}>· {info.country || face?.country}</span>}
            </div>
            <div style={{ fontFamily: "'Lilita One', sans-serif", fontSize: wide ? 30 : 24, lineHeight: 1.1, color: '#fff' }}>{tokenName || 'HEXOD TERRITORY'}</div>
            {(info.when || info.region) && <div style={{ fontSize: 12, color: 'var(--hx-text-3)' }}>{[info.when, info.region].filter(Boolean).join(' · ')}</div>}
            {(info.hexPerDay || face?.hexPerDay) ? (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 16, color: '#fde68a' }}>
                HEX {Math.round(info.hexPerDay || face?.hexPerDay || 0).toLocaleString()} <span style={{ fontSize: 11, color: 'var(--hx-text-3)' }}>per day while you hold its hex</span>
              </div>) : null}
            {(info.desc || description) && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--hx-text-1)' }}>{info.desc || description}</p>}
            {credit && <a href={credit.wiki || undefined} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--hx-text-3)', textDecoration: 'none' }}>
              Photo: {credit.text} · Wikipedia</a>}
            {infoPanel && <div className="hx-t3d-extra" style={{ marginTop: 4 }}>
              <style>{'.hx-t3d-extra > .hx-card { width: auto !important; max-width: 100% !important; background: transparent; border: none; box-shadow: none; padding: 0; }'}</style>
              {infoPanel}</div>}
          </>)
        })()}
      </div>
    </div>
  )
}
