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

// Game rarity → metal of the token (rare is no longer bronze like a common)
export const RARITY_TIER: Record<string, TierKey> = {
  common: 'BRONZE', uncommon: 'BRONZE', rare: 'SILVER', epic: 'GOLD', legendary: 'EMERALD', mythic: 'DIAMOND',
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
  const tierKey: TierKey = tier || RARITY_TIER[rarityKey || ''] || 'BRONZE'

  const containerRef = useRef<HTMLDivElement>(null)
  // Height of the info sheet: the 3D stage stops above it so the sheet never hides the token
  const infoRef = useRef<HTMLDivElement>(null)
  const [infoH, setInfoH] = useState(0)
  const viewerRef = useRef<ReturnType<typeof createTokenViewer> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [credit, setCredit] = useState<{ text: string; wiki: string } | null>(null)   // picture author + license (CC BY-SA)
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
      const front = [when, d.title, d.description].filter(Boolean).join(' — ') || d.fun_fact
      setCredit(d.image_url && d.image_credit ? { text: d.image_credit, wiki: d.wiki_url || '' } : null)
      if (front) viewerRef.current.update({ description: front.length > 240 ? front.slice(0, 237).replace(/\s+\S*$/, '') + '…' : front })
      if (d.image_url) viewerRef.current.update({ imageSrc: d.image_url })   // validated image from the DB beats the stock photo
      viewerRef.current.update({
        rarity: d.rarity, hexPerDay: d.hex_per_day, region: d.region?.name || '', country: d.country_code || '',
        terrain: d.terrain || '', tokenNo: d.token_id ? String(d.token_id) : '', cellId: d.h3_index,
        edition: d.edition_label || 'GENESIS', date: d.issued_at || '',
      })
      viewerRef.current.update({ back: {
        h3Index: d.h3_index, lat: d.lat, lon: d.lon, rarity: d.rarity, owner: d.owner, capturedAt: d.captured_at,
        hexPerDay: d.hex_per_day, region: d.region?.name ?? null, continent: d.region?.continent ?? null,
        resources: (d.resources || []).map((r: any) => ({ name: r.name, perDay: r.per_day })),
        tokenId: d.token_id ?? null, minted: !!d.minted, edition: d.edition || 1,
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
  }, [visible, !!infoPanel])

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
        // With an info sheet the stage ends 12px above it (sheet sits at bottom: 30); hexodToken3D refits on resize
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: infoPanel && infoH ? infoH + 42 : 0, zIndex: 1 }}
      />

      {credit && (
        <a href={credit.wiki || undefined} target="_blank" rel="noreferrer" style={{
          position: 'absolute', top: 18, left: 16, zIndex: 6, maxWidth: '60%', fontFamily: 'var(--font-body)', fontSize: 10,
          color: 'rgba(255,255,255,0.55)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>Photo: {credit.text} · Wikipedia</a>
      )}

      {!infoPanel && (
        <div style={{
          position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', zIndex: 4,
          pointerEvents: 'none', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
          color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5,
        }}>
          Drag to rotate
        </div>
      )}

      {infoPanel && (
        <div ref={infoRef} style={{
          position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          zIndex: 5, pointerEvents: 'auto', paddingBottom: 8,
          // cap the sheet so the token always keeps ~40% of the screen; extra sheet content scrolls
          maxHeight: '52vh', overflowY: 'auto', borderRadius: 18,
        }}>
          {infoPanel}
        </div>
      )}
    </div>
  )
}
