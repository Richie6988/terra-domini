/**
 * TerritoryPanel — Territory NFT card shown when clicking a hex.
 * Features: mint timer, buy, adjacent bonus, POI data, fusion detection.
 * Closes on map click via 'terra:closeAll' custom event.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

const RARITY_CONFIG = {
  common:    { color: '#9CA3AF', glow: 'none',                          mintSec: 900,    label: 'Common'    },
  uncommon:  { color: '#10B981', glow: '0 0 8px rgba(16,185,129,0.4)',  mintSec: 7200,   label: 'Uncommon'  },
  rare:      { color: '#3B82F6', glow: '0 0 12px rgba(59,130,246,0.5)', mintSec: 43200,  label: 'Rare'      },
  epic:      { color: '#8B5CF6', glow: '0 0 16px rgba(139,92,246,0.6)', mintSec: 172800, label: 'Epic'      },
  legendary: { color: '#FFB800', glow: '0 0 24px rgba(255,184,0,0.7)',  mintSec: 432000, label: 'Legendary' },
  mythic:    { color: '#FF006E', glow: '0 0 32px rgba(255,0,110,0.8)',  mintSec: 1209600,label: 'Mythic'    },
} as const

function fmt(sec: number): string {
  if (sec < 3600)  return `${Math.floor(sec/60)}m`
  if (sec < 86400) return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`
  return `${Math.floor(sec/86400)}d ${Math.floor((sec%86400)/3600)}h`
}

function MintTimer({ endAt }: { endAt: string }) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, (new Date(endAt).getTime() - Date.now()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endAt])
  const pct = Math.max(0, Math.min(100, 100 - (remaining / ((new Date(endAt).getTime() - Date.now() + remaining * 1000) / 1000)) * 100))
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
        <span>⏳ Minting…</span><span>{fmt(remaining)} remaining</span>
      </div>
      <div style={{ height: 6, background: '#1F2937', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)', borderRadius: 3, transition: 'width 1s linear' }}/>
      </div>
    </div>
  )
}

interface TerritoryData {
  id: string; h3_index: string; rarity: string; biome: string
  primary_resource: string; tdc_per_day: number; resource_richness: number
  poi_name?: string; poi_category?: string; poi_emoji?: string
  poi_wiki_url?: string; poi_description?: string; poi_fun_fact?: string
  owner_id?: string; owner_username?: string; is_shiny?: boolean
  floor_price_tdi?: number; mint_difficulty?: number; geopolitical_score?: number
  visitors_per_year?: number; card_gradient?: string; token_id?: number
  edition?: string; mint_end_at?: string; is_minting?: boolean
  adjacent_owned?: number; distance_to_nearest_owned?: number
  cost_tdi?: number; mint_seconds?: number
}

interface Props {
  h3Index: string
  onClose: () => void
}

export function TerritoryPanel({ h3Index, onClose }: Props) {
  const player = usePlayer()
  const qc = useQueryClient()

  // Close on global map click event
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('terra:closeAll', handler)
    return () => window.removeEventListener('terra:closeAll', handler)
  }, [onClose])

  const { data: ter, isLoading } = useQuery<TerritoryData>({
    queryKey: ['territory', h3Index],
    queryFn: () => api.get(`/territories/hex/${h3Index}/`).then(r => r.data),
    retry: false,
  })

  const mintMut = useMutation({
    mutationFn: () => api.post('/territories/mint/', { h3_index: h3Index }),
    onSuccess: () => { toast.success('⏳ Minting started!'); qc.invalidateQueries({ queryKey: ['territory', h3Index] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Mint failed'),
  })

  const buyMut = useMutation({
    mutationFn: () => api.post('/territories/buy/', { h3_index: h3Index }),
    onSuccess: () => { toast.success('🎉 Territory acquired!'); qc.invalidateQueries({ queryKey: ['territory', h3Index] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Purchase failed'),
  })

  if (isLoading) return (
    <PanelWrapper onClose={onClose}>
      <div style={{ color: '#4B5563', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading…</div>
    </PanelWrapper>
  )
  if (!ter) return null

  const cfg = RARITY_CONFIG[ter.rarity as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.common
  const isOwned = ter.owner_id === player?.id
  const isClaimed = !!ter.owner_id
  const hasAdj = (ter.adjacent_owned ?? 0) > 0
  const adjDiscount = ter.adjacent_owned === 0 ? 1.0 : ter.adjacent_owned === 1 ? 0.5 : 0.25
  const mintSecs = Math.round(cfg.mintSec * adjDiscount)
  const buyCost = ter.cost_tdi ?? (cfg.mintSec * adjDiscount * 0.01)

  return (
    <PanelWrapper onClose={onClose} gradient={ter.card_gradient} glow={cfg.glow}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {cfg.label}{ter.is_shiny ? ' ✨' : ''}
            </span>
            {ter.token_id && <span style={{ fontSize: 9, color: '#4B5563' }}>#{ter.token_id}</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {ter.poi_emoji} {ter.poi_name || ter.biome?.replace(/_/g,' ') || 'Territory'}
          </div>
          {ter.poi_description && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, lineHeight: 1.4 }}>{ter.poi_description.slice(0, 80)}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
      </div>

      {/* POI Image */}
      {ter.poi_wiki_url && (
        <div style={{ margin: '6px 0', borderRadius: 8, overflow: 'hidden', height: 100, position: 'relative' }}>
          <img src={ter.poi_wiki_url} alt={ter.poi_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, margin: '8px 0' }}>
        {[
          ['⚡', ter.primary_resource, cfg.color],
          ['💰', `${ter.tdc_per_day?.toFixed(0)} TDC/d`, '#10B981'],
          ['×', ter.resource_richness?.toFixed(1), '#FFB800'],
        ].map(([icon, val, color]) => (
          <div key={String(icon)} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4B5563', textTransform: 'uppercase' }}>{icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: String(color) }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Fun fact */}
      {ter.poi_fun_fact && (
        <div style={{ borderLeft: `2px solid ${cfg.color}`, padding: '4px 8px', margin: '6px 0', background: 'rgba(0,0,0,0.2)', borderRadius: '0 4px 4px 0' }}>
          <div style={{ fontSize: 10, color: '#D97706' }}>💡 {ter.poi_fun_fact.slice(0, 100)}</div>
        </div>
      )}

      {/* Adjacent bonus */}
      {hasAdj && !isClaimed && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '5px 8px', margin: '6px 0', fontSize: 10, color: '#10B981' }}>
          ✓ {ter.adjacent_owned} adjacent owned — {Math.round((1 - adjDiscount) * 100)}% cost reduction
        </div>
      )}

      {/* Mint progress if minting */}
      {ter.is_minting && ter.mint_end_at && <MintTimer endAt={ter.mint_end_at} />}

      {/* Owner badge */}
      {isClaimed && !isOwned && (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: '#EF4444' }}>
          ⚔️ Owned by {ter.owner_username ?? 'another player'}
        </div>
      )}
      {isOwned && (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: '#10B981' }}>
          ✓ Your territory — TDC/day: {ter.tdc_per_day?.toFixed(1)}
        </div>
      )}

      {/* Action buttons */}
      {!isClaimed && !ter.is_minting && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <button onClick={() => mintMut.mutate()} disabled={mintMut.isPending} style={{
            padding: '10px 0', borderRadius: 8, border: `1px solid ${cfg.color}`,
            background: 'rgba(0,0,0,0.4)', color: cfg.color, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}>
            ⏳ MINT<br/>
            <span style={{ fontSize: 9, fontWeight: 400, color: '#9CA3AF' }}>{fmt(mintSecs)}</span>
          </button>
          <button onClick={() => buyMut.mutate()} disabled={buyMut.isPending} style={{
            padding: '10px 0', borderRadius: 8, border: 'none',
            background: `linear-gradient(135deg, ${cfg.color}CC, ${cfg.color}88)`,
            color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 800,
          }}>
            BUY NOW<br/>
            <span style={{ fontSize: 9, fontWeight: 400 }}>{buyCost.toFixed(0)} TDI</span>
          </button>
        </div>
      )}
    </PanelWrapper>
  )
}

function PanelWrapper({ children, onClose, gradient, glow }: {
  children: React.ReactNode; onClose: () => void
  gradient?: string; glow?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        width: 300, maxHeight: '80vh', overflowY: 'auto',
        background: gradient || 'linear-gradient(135deg, #111827, #1F2937)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 14,
        boxShadow: glow || '0 20px 60px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
      {children}
    </motion.div>
  )
}
