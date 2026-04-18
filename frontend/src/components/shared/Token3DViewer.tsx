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
import { randomBiomeImage } from './hexodTokenFace'
import { getIcon } from './iconBank'

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
    infoPanel,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ReturnType<typeof createTokenViewer> | null>(null)
  const [mounted, setMounted] = useState(false)
  // Stable fallback image — generated once, doesn't change on re-render
  const fallbackImg = useRef(randomBiomeImage(biome))

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!visible || !containerRef.current) return
    const iconSvg = iconId ? getIcon(iconId) : ''
    const initialProps: TokenViewerProps = {
      tier: tier || 'BRONZE',
      category: (category || 'TERRITORY').toUpperCase(),
      catColor: catColor || '#39FF14',
      biome: (biome || 'RURAL').toUpperCase(),
      tokenName: (tokenName || 'HEXOD TERRITORY').toUpperCase(),
      description,
      edition: edition || 'GENESIS',
      serial: serial || 1,
      maxSupply: maxSupply || 1000,
      owner: owner || 'VAULT_HOLDER',
      date: date || new Date().toISOString().slice(0, 10),
      iconSvg,
      imageSrc: imageSrc || fallbackImg.current,
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
      tier: tier || 'BRONZE',
      category: (category || 'TERRITORY').toUpperCase(),
      catColor: catColor || '#39FF14',
      biome: (biome || 'RURAL').toUpperCase(),
      tokenName: (tokenName || 'HEXOD TERRITORY').toUpperCase(),
      description,
      serial: serial || 1,
      maxSupply: maxSupply || 1000,
      iconSvg: iconId ? getIcon(iconId) : '',
      imageSrc: imageSrc || fallbackImg.current,
    })
  }, [mounted, tier, category, catColor, biome, tokenName, description, serial, maxSupply, iconId, imageSrc])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible])

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
        background: 'radial-gradient(ellipse at center, rgba(5,10,20,0.95), rgba(0,0,0,0.98))',
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
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}
      />

      {infoPanel && (
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          zIndex: 5, pointerEvents: 'auto',
        }}>
          {infoPanel}
        </div>
      )}
    </div>
  )
}
