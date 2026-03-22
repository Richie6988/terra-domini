/**
 * ShopPanel — Boutique complète Hexod
 *
 * Catégories : Militaire · Boucliers · Ressources · Construction · Cosmétiques · Boosters
 * Achats one-click avec déduction HEX Coin
 * Affichage des boosts actifs (timer)
 * Ouverture de booster → BoosterOpenAnimation
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore, useTDCBalance, usePlayer } from '../../store'
import { SkeletonList } from '../ui/Utils'
import { BoosterOpenAnimation } from './BoosterOpenAnimation'
import toast from 'react-hot-toast'

const RARITY_COLOR: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

const CATS = [
  { id:'all',          label:'Tout',          icon:'🏪' },
  { id:'military',     label:'Militaire',     icon:'⚔️' },
  { id:'shield',       label:'Boucliers',     icon:'🛡️' },
  { id:'resource_pack',label:'Ressources',    icon:'⚡' },
  { id:'construction', label:'Construction',  icon:'🔨' },
  { id:'cosmetic',     label:'Cosmétiques',   icon:'✨' },
]

const EFFECT_LABEL: Record<string,string> = {
  double_attack:       '⚔️⚔️ Double attaque',
  atk_multiplier:      '⚔️ ATK boost',
  def_multiplier:      '🛡️ DEF boost',
  production_multiplier:'⚡ Production boost',
  shield:              '🛡️ Bouclier',
  hex_bonus:           '💰 HEX Coin bonus',
  build_instant_once:  '⚡ Build instantané',
  build_speed:         '🔨 Construction rapide',
  build_cost_reduction:'💸 Réduction coûts',
  border_color:        '🎨 Bordure custom',
  custom_flag:         '🚩 Drapeau custom',
  booster_pack:        '🎁 Booster pack',
  stealth_once:        '👁️ Attaque furtive',
  nuke_strike:         '☢️ Frappe nucléaire',
}

function formatDuration(sec: number): string {
  if (!sec) return 'Permanent'
  if (sec < 3600) return `${Math.round(sec/60)}min`
  if (sec < 86400) return `${Math.round(sec/3600)}h`
  return `${Math.round(sec/86400)}j`
}

interface Props { onClose: () => void }

export function ShopPanel({ onClose }: Props) {
  const [cat, setCat] = useState('all')
  const [boosterResult, setBoosterResult] = useState<any>(null)
  const qc = useQueryClient()
  const balance = useTDCBalance()
  const player  = usePlayer()

  const { data: catalog = [], isLoading } = useQuery<any[]>({
    queryKey: ['shop-catalog'],
    queryFn: () => api.get('/shop/catalog/').then(r => r.data),
    staleTime: 300000,
  })

  const { data: activeBoosts = [] } = useQuery<any[]>({
    queryKey: ['active-boosts'],
    queryFn: () => api.get('/shop/active-boosts/').then(r => r.data).catch(() => []),
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const buyMut = useMutation({
    mutationFn: (vars: { item_code: string; quantity: number }) =>
      api.post('/shop/purchase/', vars),
    onSuccess: (res, vars) => {
      const item = catalog.find((i:any) => i.code === vars.item_code)
      if (res.data.booster) {
        // Animation d'ouverture de booster
        setBoosterResult({ cards: res.data.booster.cards, itemName: item?.name })
      } else {
        toast.success(`✅ ${item?.name || 'Article'} acheté !`)
      }
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['active-boosts'] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || 'Achat échoué'
      toast.error(msg)
    },
  })

  const items = catalog.filter((i:any) => cat === 'all' || i.category === cat)
  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0

  return (
    <>
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type:'spring', stiffness:280, damping:28 }}
        style={{
          position:'fixed', top:0, right:0, bottom:0,
          width: Math.min(420, window.innerWidth - 8),
          background:'linear-gradient(180deg,#08080f 0%,#050510 100%)',
          border:'1px solid rgba(255,255,255,0.08)',
          zIndex:1300, display:'flex', flexDirection:'column',
          boxShadow:'-8px 0 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ padding:'16px 18px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>🏪 Boutique</div>
              <div style={{ fontSize:10, color:'#4B5563', marginTop:2 }}>Boosters · Bonus · Cosmétiques</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#F59E0B', fontFamily:'monospace' }}>
                  {toNum(balance).toFixed(0)} 💎
                </div>
                <div style={{ fontSize:9, color:'#4B5563' }}>HEX Coin disponibles</div>
              </div>
              <button onClick={onClose} style={{ background:'none',border:'none',color:'#4B5563',cursor:'pointer',fontSize:20 }}>×</button>
            </div>
          </div>

          {/* Catégories */}
          <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:2 }}>
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                padding:'5px 10px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap',
                fontSize:10, fontWeight: cat===c.id ? 700 : 400,
                background: cat===c.id ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)',
                border:`1px solid ${cat===c.id ? 'rgba(0,255,135,0.35)' : 'rgba(255,255,255,0.07)'}`,
                color: cat===c.id ? '#00FF87' : '#6B7280', flexShrink:0,
              }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Boosts actifs */}
        {activeBoosts.length > 0 && (
          <div style={{ padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.05)',
            background:'rgba(0,255,135,0.03)', flexShrink:0 }}>
            <div style={{ fontSize:9, color:'#4B5563', textTransform:'uppercase', marginBottom:6 }}>Boosts actifs</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {activeBoosts.slice(0,5).map((b:any) => (
                <ActiveBoostBadge key={b.id} boost={b} />
              ))}
            </div>
          </div>
        )}

        {/* Grille items */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
          {isLoading ? <SkeletonList count={6} /> : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {items.map((item:any) => (
                <ShopItemCard
                  key={item.id || item.code}
                  item={item}
                  balance={toNum(balance)}
                  onBuy={() => buyMut.mutate({ item_code: item.code, quantity: 1 })}
                  buying={buyMut.isPending && buyMut.variables?.item_code === item.code}
                />
              ))}
              {items.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'#374151', fontSize:12 }}>
                  Aucun article dans cette catégorie
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Animation ouverture booster */}
      <AnimatePresence>
        {boosterResult && (
          <BoosterOpenAnimation
            cards={boosterResult.cards}
            packName={boosterResult.itemName}
            onClose={() => setBoosterResult(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Carte item boutique ────────────────────────────────────────────────────
function ShopItemCard({ item, balance, onBuy, buying }: {
  item: any; balance: number; onBuy: () => void; buying: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const rc = RARITY_COLOR[item.rarity] || '#9CA3AF'
  const canAfford = balance >= parseFloat(item.price_tdc)
  const isBooster = item.effect_type === 'booster_pack'
  const duration  = formatDuration(item.effect_duration_seconds || 0)
  const effectLabel = EFFECT_LABEL[item.effect_type] || item.effect_type

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={{ scale: 0.97 }}
      style={{
        background: hovered ? `${rc}12` : 'rgba(255,255,255,0.03)',
        border:`1.5px solid ${hovered ? rc+'55' : 'rgba(255,255,255,0.07)'}`,
        borderRadius:12, padding:'12px 10px',
        display:'flex', flexDirection:'column', gap:6,
        cursor:'pointer', transition:'all 0.15s',
        position:'relative', overflow:'hidden',
      }}
    >
      {/* Rarity glow top */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, transparent, ${rc}, transparent)`,
        opacity: hovered ? 1 : 0.4, transition:'opacity 0.15s',
      }}/>

      {/* Icon */}
      <div style={{ fontSize:28, textAlign:'center', lineHeight:1 }}>
        {item.icon_url && item.icon_url.length <= 4 ? item.icon_url : '🎁'}
      </div>

      {/* Name + rarity */}
      <div>
        <div style={{ fontSize:11, fontWeight:800, color:'#fff', textAlign:'center', lineHeight:1.3 }}>
          {item.name}
        </div>
        <div style={{ fontSize:9, color:rc, textAlign:'center', marginTop:2, fontWeight:700 }}>
          {item.rarity}
        </div>
      </div>

      {/* Effect */}
      <div style={{ fontSize:9, color:'#6B7280', textAlign:'center', lineHeight:1.4 }}>
        {effectLabel}
        {item.effect_duration_seconds > 0 && (
          <span style={{ color:'#374151', marginLeft:4 }}>· {duration}</span>
        )}
      </div>

      {/* Description (au hover) */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }}
            style={{ fontSize:9, color:'#4B5563', textAlign:'center', overflow:'hidden', lineHeight:1.5 }}
          >
            {item.description}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prix + bouton */}
      <div style={{ marginTop:'auto' }}>
        <div style={{ textAlign:'center', marginBottom:6 }}>
          <span style={{ fontSize:13, fontWeight:900, color:'#F59E0B', fontFamily:'monospace' }}>
            {parseFloat(item.price_tdc).toFixed(0)}
          </span>
          <span style={{ fontSize:10, color:'#6B7280', marginLeft:3 }}>💎</span>
        </div>

        <button
          onClick={e => { e.stopPropagation(); if (canAfford && !buying) onBuy() }}
          disabled={!canAfford || buying}
          style={{
            width:'100%', padding:'7px 0', borderRadius:8,
            background: buying ? 'rgba(255,255,255,0.05)'
              : canAfford ? (isBooster ? `${rc}22` : 'rgba(0,255,135,0.15)')
              : 'rgba(255,255,255,0.04)',
            border: canAfford
              ? `1px solid ${isBooster ? rc+'44' : 'rgba(0,255,135,0.3)'}`
              : '1px solid rgba(255,255,255,0.06)',
            color: buying ? '#374151' : canAfford ? (isBooster ? rc : '#00FF87') : '#374151',
            fontSize:11, fontWeight:700, cursor: canAfford && !buying ? 'pointer' : 'not-allowed',
            transition:'all 0.15s',
          }}
        >
          {buying ? '⏳' : !canAfford ? '💎 Insuffisant' : isBooster ? '🎁 Ouvrir' : '⚡ Acheter'}
        </button>
      </div>

      {/* Badge max_per_day */}
      {item.max_per_day > 0 && (
        <div style={{
          position:'absolute', top:6, right:6,
          background:'rgba(0,0,0,0.6)', borderRadius:10,
          fontSize:8, color:'#4B5563', padding:'1px 5px',
        }}>{item.max_per_day}/j</div>
      )}
    </motion.div>
  )
}

// ── Boost actif badge ─────────────────────────────────────────────────────
function ActiveBoostBadge({ boost }: { boost: any }) {
  const [, setTick] = useState(0)
  // Force re-render toutes les 30s pour le countdown
  // (pas de useEffect ici pour rester léger)
  const remaining = boost.expires_at
    ? Math.max(0, new Date(boost.expires_at).getTime() - Date.now())
    : null
  const label = EFFECT_LABEL[boost.boost_type] || boost.boost_type
  const mins  = remaining ? Math.ceil(remaining / 60000) : null

  return (
    <div style={{
      padding:'4px 8px', borderRadius:20, fontSize:9, fontWeight:700,
      background:'rgba(0,255,135,0.1)', border:'1px solid rgba(0,255,135,0.25)',
      color:'#00FF87', display:'flex', alignItems:'center', gap:4,
    }}>
      {label}
      {mins != null && <span style={{ color:'#4B5563', marginLeft:2 }}>· {mins < 60 ? `${mins}min` : `${Math.ceil(mins/60)}h`}</span>}
    </div>
  )
}
