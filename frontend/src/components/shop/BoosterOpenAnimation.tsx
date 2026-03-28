/**
 * BoosterOpenAnimation — ouverture de booster pack satisfaisante
 *
 * Flow :
 *   1. Pack fermé au centre (scale 0 → 1, glow pulsant)
 *   2. Tap → shake + burst de lumière
 *   3. Cartes s'envolent et se retournent une par une
 *   4. Chaque carte atterrit avec un reveal recto/verso + son rarity glow
 *   5. Bouton "Continuer" final
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const RARITY_COLOR: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}
const RARITY_LABEL: Record<string,string> = {
  common:'Common', uncommon:'Uncommon', rare:'Rare',
  epic:'Epic', legendary:'Legendary', mythic:'Mythic',
}
const BIOME_ICON: Record<string,string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'⚙️', landmark:'🏛️',
}

interface Card {
  h3_index: string
  poi_name?: string
  rarity: string
  biome?: string
  territory_type?: string
  is_shiny?: boolean
}

interface Props {
  cards: Card[]
  packName?: string
  onClose: () => void
}

type Phase = 'pack' | 'opening' | 'reveal' | 'done'

export function BoosterOpenAnimation({ cards, packName, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('pack')
  const [revealed, setRevealed] = useState<number>(-1)   // index dernière carte révélée
  const [flipped,  setFlipped]  = useState<number[]>([]) // cartes retournées

  const openPack = () => {
    setPhase('opening')
    setTimeout(() => setPhase('reveal'), 700)
  }

  // Auto-reveal des cartes une par une
  useEffect(() => {
    if (phase !== 'reveal') return
    const revealNext = (i: number) => {
      if (i >= cards.length) { setPhase('done'); return }
      setTimeout(() => {
        setRevealed(i)
        setTimeout(() => {
          setFlipped(f => [...f, i])
          revealNext(i + 1)
        }, 600)
      }, i === 0 ? 200 : 400)
    }
    revealNext(0)
  }, [phase, cards.length])

  // Meilleure carte pour le highlight final
  const RANK: Record<string,number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }
  const bestCard = cards.reduce((a, b) =>
    (RANK[b.rarity]||0) > (RANK[a.rarity]||0) ? b : a, cards[0])
  const bestColor = bestCard ? RARITY_COLOR[bestCard.rarity] : '#10B981'

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(2,2,12,0.97)',
        backdropFilter:'blur(20px)',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:20,
      }}
    >
      {/* Phase 1 : Pack fermé */}
      <AnimatePresence mode="wait">
        {phase === 'pack' && (
          <motion.div
            key="pack"
            initial={{ scale:0, rotate:-15 }}
            animate={{ scale:1, rotate:0 }}
            exit={{ scale:0, opacity:0, rotate:15 }}
            transition={{ type:'spring', stiffness:300, damping:22 }}
            onClick={openPack}
            style={{ cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}
          >
            {/* Titre */}
            <div style={{ fontSize:13, color:'rgba(26,42,58,0.6)', textAlign:'center', marginBottom:8 }}>
              {packName || 'Booster Pack'}
            </div>

            {/* Pack visual */}
            <motion.div
              animate={{ boxShadow: ['0 0 20px #F59E0B44', '0 0 50px #F59E0Baa', '0 0 20px #F59E0B44'] }}
              transition={{ duration:1.5, repeat:Infinity }}
              style={{
                width:160, height:220, borderRadius:16,
                background:'linear-gradient(135deg, #1a1200, #3d2800)',
                border:'2px solid #F59E0B88',
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:12,
              }}
            >
              <div style={{ fontSize:56 }}>🎁</div>
              <div style={{ fontSize:13, color:'#F59E0B', fontWeight:800 }}>HEXOD</div>
              <div style={{ fontSize:9, color:'rgba(26,42,58,0.45)', textAlign:'center', padding:'0 12px' }}>
                {cards.length} cartes à l'intérieur
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              animate={{ opacity:[0.6,1,0.6] }} transition={{ duration:1.2, repeat:Infinity }}
              style={{ fontSize:13, color:'#F59E0B', fontWeight:700 }}
            >
              Tapez pour ouvrir !
            </motion.div>
          </motion.div>
        )}

        {/* Phase 2 : Opening burst */}
        {phase === 'opening' && (
          <motion.div
            key="burst"
            initial={{ scale:1 }}
            animate={{ scale:[1, 1.2, 0], opacity:[1,1,0] }}
            transition={{ duration:0.6 }}
            style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}
          >
            {/* Rayons */}
            {Array.from({length:12}).map((_,i) => (
              <motion.div
                key={i}
                initial={{ opacity:1, scale:0.5 }}
                animate={{ opacity:0, scale:3 }}
                transition={{ duration:0.6, delay:i*0.02 }}
                style={{
                  position:'absolute',
                  width:4, height:40,
                  background:'linear-gradient(to top, #F59E0B, transparent)',
                  transformOrigin:'bottom center',
                  transform:`rotate(${i*30}deg) translateY(-60px)`,
                  borderRadius:2,
                }}
              />
            ))}
            <div style={{ fontSize:80 }}>✨</div>
          </motion.div>
        )}

        {/* Phase 3 + 4 : Reveal des cartes */}
        {(phase === 'reveal' || phase === 'done') && (
          <motion.div
            key="cards"
            initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ width:'100%', maxWidth:500, display:'flex', flexDirection:'column', gap:12 }}
          >
            <div style={{ fontSize:12, color:'rgba(26,42,58,0.45)', textAlign:'center', marginBottom:4 }}>
              {phase === 'done' ? '✨ Cartes obtenues !' : 'Révélation en cours…'}
            </div>

            {/* Grille de cartes */}
            <div style={{
              display:'grid',
              gridTemplateColumns: cards.length <= 3 ? `repeat(${cards.length}, 1fr)` : 'repeat(3, 1fr)',
              gap:10,
            }}>
              {cards.map((card, i) => (
                <CardReveal
                  key={i}
                  card={card}
                  index={i}
                  revealed={i <= revealed}
                  flipped={flipped.includes(i)}
                />
              ))}
            </div>

            {/* Bouton continuer */}
            <AnimatePresence>
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity:0, y:20 }}
                  animate={{ opacity:1, y:0 }}
                  transition={{ delay:0.4 }}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginTop:12 }}
                >
                  {/* Meilleure carte highlight */}
                  {bestCard && RANK[bestCard.rarity] >= 3 && (
                    <motion.div
                      animate={{ opacity:[0.7,1,0.7] }} transition={{ duration:1.5, repeat:Infinity }}
                      style={{
                        fontSize:12, fontWeight:800, color:bestColor,
                        textShadow:`0 0 12px ${bestColor}`,
                        textAlign:'center',
                      }}
                    >
                      ✦ {RARITY_LABEL[bestCard.rarity].toUpperCase()} obtenu : {bestCard.poi_name || bestCard.h3_index?.slice(0,12)} ✦
                    </motion.div>
                  )}

                  <button onClick={onClose} style={{
                    padding:'14px 40px', borderRadius:12,
                    background:`${bestColor}22`,
                    border:`1px solid ${bestColor}55`,
                    color:bestColor, fontSize:14, fontWeight:800,
                    cursor:'pointer',
                    boxShadow:`0 0 20px ${bestColor}33`,
                  }}>
                    Continuer →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Carte individuelle avec flip ───────────────────────────────────────────
function CardReveal({ card, index, revealed, flipped }: {
  card: Card; index: number; revealed: boolean; flipped: boolean
}) {
  const rc = RARITY_COLOR[card.rarity] || '#9CA3AF'
  const biomeIcon = BIOME_ICON[card.biome || card.territory_type || ''] || '🌍'
  const RANK: Record<string,number> = { common:0, uncommon:1, rare:2, epic:3, legendary:4, mythic:5 }
  const isHighRarity = (RANK[card.rarity] || 0) >= 3

  return (
    <motion.div
      initial={{ y:60, opacity:0, scale:0.7 }}
      animate={revealed ? { y:0, opacity:1, scale:1 } : { y:60, opacity:0, scale:0.7 }}
      transition={{ type:'spring', stiffness:280, damping:22, delay: index * 0.05 }}
      style={{
        perspective:800,
        height: 160,
      }}
    >
      <motion.div
        animate={{ rotateY: flipped ? 0 : 180 }}
        transition={{ duration:0.55, ease:[0.4,0,0.2,1] }}
        style={{
          width:'100%', height:'100%',
          position:'relative', transformStyle:'preserve-3d',
        }}
      >
        {/* Dos de la carte */}
        <div style={{
          position:'absolute', inset:0, backfaceVisibility:'hidden',
          transform:'rotateY(180deg)',
          borderRadius:12, background:'rgba(235,242,250,0.97)',
          border:'2px solid #1a1a2e',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{ fontSize:36, opacity:0.3 }}>⬡</div>
        </div>

        {/* Face de la carte */}
        <div style={{
          position:'absolute', inset:0, backfaceVisibility:'hidden',
          borderRadius:12,
          background:`linear-gradient(135deg, ${rc}18, #020205)`,
          border:`2px solid ${rc}55`,
          padding:'10px 8px',
          display:'flex', flexDirection:'column', gap:4,
          boxShadow: isHighRarity ? `0 0 20px ${rc}44, 0 0 40px ${rc}22` : `0 4px 12px rgba(0,0,0,0.5)`,
        }}>
          {/* Rarity strip top */}
          <div style={{ height:3, borderRadius:2, background:rc, marginBottom:2, opacity:0.8 }}/>

          {/* Biome icon */}
          <div style={{ fontSize:28, textAlign:'center', lineHeight:1 }}>{biomeIcon}</div>

          {/* Shiny */}
          {card.is_shiny && (
            <div style={{ fontSize:9, textAlign:'center', color:'#FCD34D', fontWeight:800 }}>★ SHINY</div>
          )}

          {/* Name */}
          <div style={{
            fontSize:9, fontWeight:800, color:'#1a2a3a', textAlign:'center',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            lineHeight:1.3,
          }}>
            {card.poi_name || card.h3_index?.slice(0,12) || 'Territoire'}
          </div>

          {/* Rarity badge */}
          <div style={{
            marginTop:'auto', textAlign:'center',
            fontSize:9, fontWeight:900, color:rc,
            textTransform:'uppercase', letterSpacing:'0.05em',
          }}>
            {RARITY_LABEL[card.rarity]}
          </div>

          {/* Glow animation pour legendary/mythic */}
          {isHighRarity && (
            <motion.div
              animate={{ opacity:[0.3,0.7,0.3] }}
              transition={{ duration:1.5, repeat:Infinity }}
              style={{
                position:'absolute', inset:0, borderRadius:12,
                background:`radial-gradient(circle at 50% 40%, ${rc}22 0%, transparent 70%)`,
                pointerEvents:'none',
              }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
