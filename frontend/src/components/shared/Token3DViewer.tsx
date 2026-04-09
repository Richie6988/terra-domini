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
      imageSrc: imageSrc || '',
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
      imageSrc: imageSrc || '',
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
      onClick={e => { if (e.target === e.currentTarget) onCloseRef.current() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'radial-gradient(ellipse at center, rgba(5,10,20,0.95), rgba(0,0,0,0.98))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <button
        onClick={() => onCloseRef.current()}
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron', sans-serif",
        }}
      >×</button>

      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
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
