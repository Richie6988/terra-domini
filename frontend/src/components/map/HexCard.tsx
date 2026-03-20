/**
 * HexCard — central animated card that appears when clicking a hex.
 * Collectible card style: rarity border glow, shiny shimmer, POI image.
 * Replaces TerritoryPanel slide-in for the primary interaction.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { usePlayer, useStore } from '../../store'
import type { TerritoryLight } from '../../types'

const RARITY_COLOR: Record<string, string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#FFB800', mythic:'#FF006E',
}
const RARITY_BG: Record<string, string> = {
  common:'rgba(156,163,175,0.08)', uncommon:'rgba(16,185,129,0.08)',
  rare:'rgba(59,130,246,0.08)', epic:'rgba(139,92,246,0.1)',
  legendary:'rgba(255,184,0,0.1)', mythic:'rgba(255,0,110,0.12)',
}
const RARITY_GLOW: Record<string, string> = {
  common:'none', uncommon:'none',
  rare:'0 0 20px rgba(59,130,246,0.3)',
  epic:'0 0 24px rgba(139,92,246,0.4)',
  legendary:'0 0 32px rgba(255,184,0,0.5)',
  mythic:'0 0 40px rgba(255,0,110,0.6)',
}
const RARITY_LABEL: Record<string, string> = {
  common:'Common', uncommon:'Uncommon', rare:'Rare',
  epic:'Epic', legendary:'Legendary', mythic:'Mythic ✦',
}

interface Props {
  territory: any
  onClose: () => void
  onRequestClaim: () => void
}

export function HexCard({ territory: t, onClose, onRequestClaim }: Props) {
  const player  = usePlayer()
  const store   = useStore()
  const [shimmer, setShimmer] = useState(false)

  const rarity  = t.rarity || 'common'
  const isShiny = !!t.is_shiny
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id

  const rc = RARITY_COLOR[rarity] || '#9CA3AF'
  const bg = RARITY_BG[rarity]   || 'rgba(156,163,175,0.08)'
  const glow = RARITY_GLOW[rarity] || 'none'

  const name = t.custom_name || t.poi_name || t.landmark_name || t.place_name
    || (t.h3_index || '').slice(0, 12) + '…'

  // Shiny shimmer effect — cycles every 3s
  useEffect(() => {
    if (!isShiny) return
    const id = setInterval(() => {
      setShimmer(true)
      setTimeout(() => setShimmer(false), 800)
    }, 3000)
    return () => clearInterval(id)
  }, [isShiny])

  const cardVariants = {
    hidden: { scale: 0.7, opacity: 0, rotateY: -15 },
    visible: { scale: 1, opacity: 1, rotateY: 0,
      transition: { type: 'spring', stiffness: 300, damping: 22 } },
    exit: { scale: 0.8, opacity: 0, rotateY: 15,
      transition: { duration: 0.2 } },
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        variants={cardVariants}
        initial="hidden" animate="visible" exit="exit"
        style={{
          width: '100%', maxWidth: 340,
          background: `linear-gradient(145deg, #0c0c18, #080810)`,
          border: `2px solid ${rc}`,
          borderRadius: 20,
          boxShadow: glow,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Shiny shimmer overlay */}
        {isShiny && (
          <motion.div
            animate={shimmer ? { x: ['−100%', '200%'] } : { x: '-100%' }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Rarity band top */}
        <div style={{
          background: `linear-gradient(90deg, ${rc}33, ${rc}11)`,
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: rc,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{RARITY_LABEL[rarity]}</span>
            {isShiny && <span style={{ fontSize: 12, color: '#FFB800' }}>✨ Shiny</span>}
            {t.nft_version > 1 && <span style={{ fontSize: 10, color: '#8B5CF6' }}>v{t.nft_version}</span>}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            borderRadius: 6, color: '#9CA3AF', cursor: 'pointer',
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={14} /></button>
        </div>

        {/* POI Image */}
        {(t.poi_wiki_url || t.wiki_url) && (
          <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
            <img
              src={t.poi_wiki_url || t.wiki_url}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(transparent 50%, rgba(8,8,16,0.9) 100%)',
            }} />
          </div>
        )}

        {/* Card body */}
        <div style={{ padding: '16px 18px' }}>
          {/* Hex emoji + name */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>
              {t.custom_emoji || t.poi_emoji || (hasPOI ? '📍' : isOwned ? '🏴' : '⬡')}
            </span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{name}</div>
              <div style={{ fontSize: 11, color: '#4B5563', fontFamily: 'monospace', marginTop: 2 }}>
                {(t.h3_index || '').slice(0, 16)}
              </div>
            </div>
          </div>

          {/* POI description */}
          {t.poi_description && (
            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 10,
              padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              {t.poi_description}
            </div>
          )}
          {t.poi_fun_fact && (
            <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginBottom: 10 }}>
              💡 {t.poi_fun_fact}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
            <StatBadge label="Income" value={`+${t.resource_credits || t.food_per_tick || 10}/tick`} color="#FFB800" />
            {t.poi_floor_price && <StatBadge label="Floor" value={`${t.poi_floor_price} TDI`} color={rc} />}
            {t.poi_visitors && <StatBadge label="Visitors" value={`${(t.poi_visitors/1e6).toFixed(1)}M`} color="#10B981" />}
            {!t.poi_floor_price && <StatBadge label="Defense" value={`${t.defense_tier || 1}★`} color="#6B7280" />}
            {!t.poi_visitors && <StatBadge label="Type" value={t.territory_type || 'rural'} color="#6B7280" />}
          </div>

          {/* Owner info */}
          {isOwned && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              background: `${t.border_color || '#00FF87'}15`,
              border: `1px solid ${t.border_color || '#00FF87'}40`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{t.custom_emoji || '🏴'}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.border_color || '#00FF87' }}>Your territory</div>
                {t.custom_name && <div style={{ fontSize: 10, color: '#6B7280' }}>{t.custom_name}</div>}
              </div>
            </div>
          )}
          {isEnemy && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#EF4444' }}>
                {(t.owner_username || '?').slice(0,2).toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: '#F87171', fontWeight: 600 }}>{t.owner_username}</div>
            </div>
          )}

          {/* Actions */}
          {isFree && player && (
            <button onClick={onRequestClaim} style={{
              width: '100%', padding: '12px 0',
              background: `linear-gradient(135deg, ${rc}cc, ${rc})`,
              border: 'none', borderRadius: 10, color: '#000',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}>
              {hasPOI ? `🏴 Claim ${t.poi_name || name}` : '🏴 Claim territory'}
            </button>
          )}
          {isEnemy && (
            <button onClick={onRequestClaim} style={{
              width: '100%', padding: '12px 0',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 10, color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              ⚔️ Attack / 💸 Buy
            </button>
          )}
          {isOwned && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onRequestClaim} style={{
                flex: 1, padding: '10px 0',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, color: '#10B981', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>💰 Revenue</button>
              <button style={{
                flex: 1, padding: '10px 0',
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 10, color: '#8B5CF6', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>🎨 Style</button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: '#4B5563', marginTop: 2 }}>{label}</div>
    </div>
  )
}
