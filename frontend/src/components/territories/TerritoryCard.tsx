/**
 * TerritoryCard — Pokemon-style NFT card for a territory.
 * Rarity: Common→Uncommon→Rare→Epic→Legendary→Mythic
 * Shiny: rainbow holographic variant (1/512)
 */
import { motion } from 'framer-motion'

export type TerritoryRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface TerritoryCardData {
  h3_index: string
  name: string
  rarity: TerritoryRarity
  is_shiny: boolean
  biome: string
  primary_resource: string
  resource_richness: number
  tdc_per_day: number
  poi_name?: string
  poi_category?: string
  poi_emoji?: string
  poi_wiki_url?: string
  poi_description?: string
  poi_fun_fact?: string
  country_code: string
  owner_username?: string
  owner_wallet?: string
  token_id?: number
  edition: string
  card_gradient: string
  card_border_style: string
  threat_level: string
  conflict_active: boolean
  prestige_points: number
  times_captured: number
  population_density?: number
  primary_language?: string
  primary_religion?: string
}

const RARITY_CONFIG: Record<TerritoryRarity, {
  label: string; color: string; glow: string; border: string; stars: number
}> = {
  common:    { label: 'Common',    color: '#9CA3AF', glow: 'none',                                     border: '1px solid #374151',         stars: 1 },
  uncommon:  { label: 'Uncommon',  color: '#10B981', glow: '0 0 12px rgba(16,185,129,0.4)',             border: '1px solid #065F46',         stars: 2 },
  rare:      { label: 'Rare',      color: '#3B82F6', glow: '0 0 16px rgba(59,130,246,0.5)',             border: '1px solid #1D4ED8',         stars: 3 },
  epic:      { label: 'Epic',      color: '#8B5CF6', glow: '0 0 20px rgba(139,92,246,0.6)',             border: '1px solid #7C3AED',         stars: 4 },
  legendary: { label: 'Legendary', color: '#FFB800', glow: '0 0 30px rgba(255,184,0,0.7)',              border: '2px solid #D97706',         stars: 5 },
  mythic:    { label: 'Mythic',    color: '#FF006E', glow: '0 0 40px rgba(255,0,110,0.8)',              border: '2px solid #FF006E',         stars: 5 },
}

const RESOURCE_EMOJI: Record<string, string> = {
  energy: '⚡', food: '🌾', materials: '⚙️', credits: '💰', intel: '🔍', culture: '🎭'
}

const BIOME_EMOJI: Record<string, string> = {
  tropical_forest: '🌴', savanna: '🦁', desert: '🏜️', temperate_forest: '🌲',
  boreal_forest: '🌲', tundra: '❄️', grassland: '🌾', mediterranean: '🫒',
  mountain: '🏔️', coastal: '🌊', ocean: '🌊', wetland: '🌿', volcanic: '🌋',
}

function StarRow({ count, color }: { count: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 10, color: i <= count ? color : '#374151' }}>★</span>
      ))}
    </div>
  )
}

function ShinyEffect() {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
      background: 'linear-gradient(135deg, transparent 20%, rgba(255,255,255,0.15) 50%, transparent 80%)',
      animation: 'shinySlide 3s ease-in-out infinite',
    }} />
  )
}

interface Props {
  card: TerritoryCardData
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  showDetails?: boolean
}

export function TerritoryCard({ card, size = 'md', onClick, showDetails = false }: Props) {
  const cfg = RARITY_CONFIG[card.rarity] ?? RARITY_CONFIG.common
  const w = size === 'sm' ? 160 : size === 'lg' ? 320 : 220
  const h = Math.round(w * 1.4)

  return (
    <>
      <style>{`
        @keyframes shinySlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes mythicPulse { 0%,100%{box-shadow:${cfg.glow}} 50%{box-shadow:${cfg.glow.replace('0.8','1.2')}} }
        @keyframes legendaryGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.1)} }
      `}</style>

      <motion.div
        whileHover={{ scale: 1.04, rotateY: 5 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        style={{
          width: w, height: h, borderRadius: 16, cursor: onClick ? 'pointer' : 'default',
          background: card.card_gradient || 'linear-gradient(135deg, #1F2937, #374151)',
          border: cfg.border,
          boxShadow: card.is_shiny ? '0 0 40px rgba(255,0,110,0.6), 0 0 80px rgba(131,56,236,0.4)' : cfg.glow,
          position: 'relative', overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          animation: card.rarity === 'mythic' ? 'mythicPulse 2s infinite' : card.rarity === 'legendary' ? 'legendaryGlow 2s infinite' : 'none',
        }}>

        {card.is_shiny && <ShinyEffect />}

        {/* Card header — name + rarity */}
        <div style={{ padding: '10px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: size === 'sm' ? 10 : 13, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.poi_emoji || BIOME_EMOJI[card.biome] || '🌍'} {card.poi_name || card.name}
            </div>
            <div style={{ fontSize: 9, color: cfg.color, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {card.rarity}{card.is_shiny ? ' ✨' : ''}
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#6B7280', textAlign: 'right', flexShrink: 0 }}>
            {card.country_code && <div>{card.country_code}</div>}
            {card.token_id && <div style={{ color: cfg.color }}>#{card.token_id}</div>}
          </div>
        </div>

        {/* Image or biome visual */}
        <div style={{ margin: '0 8px', borderRadius: 10, overflow: 'hidden', height: Math.round(h * 0.38), position: 'relative', background: 'rgba(0,0,0,0.3)' }}>
          {card.poi_wiki_url ? (
            <img src={card.poi_wiki_url} alt={card.poi_name || card.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(h * 0.14) }}>
              {BIOME_EMOJI[card.biome] || '🌍'}
            </div>
          )}

          {/* Live event badge */}
          {card.conflict_active && (
            <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 700, color: '#fff' }}>
              ⚔️ CONFLICT
            </div>
          )}
          {card.threat_level !== 'none' && !card.conflict_active && (
            <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(245,158,11,0.9)', borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 700, color: '#fff' }}>
              ⚠️ {card.threat_level.toUpperCase()}
            </div>
          )}
        </div>

        {/* Stats block */}
        <div style={{ margin: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
            {[
              ['Resource', `${RESOURCE_EMOJI[card.primary_resource] || '💎'} ${card.primary_resource}`, cfg.color],
              ['Richness', `×${card.resource_richness.toFixed(1)}`, '#10B981'],
              ['HEX Coin/day', card.tdc_per_day.toFixed(0), '#FFB800'],
            ].map(([label, val, color]) => (
              <div key={String(label)} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#6B7280', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: size === 'sm' ? 8 : 10, fontWeight: 700, color: color as string }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[
              ['Biome', card.biome.replace(/_/g,' ')],
              ['Battles', String(card.times_captured)],
              ['Prestige', String(card.prestige_points)],
            ].map(([label, val]) => (
              <div key={String(label)} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: '#6B7280', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 8, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* POI fun fact */}
        {card.poi_fun_fact && size !== 'sm' && (
          <div style={{ margin: '0 8px', padding: '4px 6px', background: 'rgba(255,184,0,0.08)', borderRadius: 6, borderLeft: `2px solid ${cfg.color}` }}>
            <div style={{ fontSize: 8, color: '#D97706', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              💡 {card.poi_fun_fact}
            </div>
          </div>
        )}

        {/* Footer — stars + owner + edition */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StarRow count={cfg.stars} color={cfg.color} />
          <div style={{ fontSize: 8, color: '#4B5563' }}>
            {card.owner_username ? `👤 ${card.owner_username}` : '🔓 Unclaimed'}
          </div>
          <div style={{ fontSize: 7, color: '#374151', textTransform: 'uppercase' }}>
            {card.edition}
          </div>
        </div>

        {/* Rarity holographic border effect for legendary+ */}
        {(card.rarity === 'legendary' || card.rarity === 'mythic' || card.is_shiny) && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            border: card.is_shiny ? '2px solid transparent' : '2px solid transparent',
            background: `linear-gradient(${card.card_gradient || '#1F2937'}, ${card.card_gradient || '#1F2937'}) padding-box, ${card.is_shiny ? 'linear-gradient(135deg, #FF006E, #8338EC, #3A86FF, #06FFB4)' : `linear-gradient(135deg, ${cfg.color}, transparent, ${cfg.color})`} border-box`,
          }} />
        )}
      </motion.div>
    </>
  )
}
