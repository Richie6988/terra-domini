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
import { useKingdomStore } from '../../store/kingdomStore'
import { SkeletonList } from '../ui/Utils'
import { BoosterOpenAnimation } from './BoosterOpenAnimation'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
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
  const activeKingdom = useKingdomStore(s => s.getActiveKingdom())

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
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <>
      <GlassPanel title="SHOP" onClose={onClose} accent="#cc8800" width={Math.min(420, window.innerWidth - 8)}>
        {/* Kingdom active bonuses banner */}
        {activeKingdom && (
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginBottom:10,
            padding:'8px 12px', borderRadius:8,
            background:`linear-gradient(90deg, ${activeKingdom.color}08, transparent)`,
            border:`1px solid ${activeKingdom.color}15`,
          }}>
            <div style={{
              width:24, height:24, borderRadius:'50%',
              background:`linear-gradient(135deg, ${activeKingdom.color}, ${activeKingdom.color}aa)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, boxShadow:`0 0 8px ${activeKingdom.color}30`,
            }}>🏰</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:7, fontWeight:800, color:activeKingdom.color, letterSpacing:2, fontFamily:"'Orbitron', system-ui, sans-serif" }}>
                {activeKingdom.name.toUpperCase()}
              </div>
              <div style={{ fontSize:6, color:'rgba(26,42,58,0.4)', letterSpacing:1 }}>
                BOOSTS APPLY TO THIS KINGDOM
              </div>
            </div>
            <div style={{
              fontSize:7, color:'#7950f2', fontWeight:700, fontFamily:"'Share Tech Mono', monospace",
              display:'flex', alignItems:'center', gap:3,
            }}>
              <CrystalIcon size="sm" />{activeKingdom.dailyCrystals}/d
            </div>
          </div>
        )}

        {/* Balance display */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12,
          padding:'8px 12px', background:'rgba(255,255,255,0.5)', borderRadius:8,
          border:'1px solid rgba(0,60,100,0.1)' }}>
          <span style={{ fontSize:9, color:'rgba(26,42,58,0.45)', letterSpacing:2, fontWeight:500 }}>BALANCE</span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <CrystalIcon size="lg" />
            <span style={{ fontSize:16, fontWeight:900, color:'#7950f2', fontFamily:"'Share Tech Mono', monospace" }}>
              {toNum(balance).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Catégories — pill tabs */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:8, marginBottom:12 }}>
          {CATS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding:'6px 12px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap',
              fontSize:8, fontWeight: cat===c.id ? 700 : 500, letterSpacing:1,
              background: cat===c.id ? 'rgba(0,153,204,0.12)' : 'rgba(255,255,255,0.5)',
              border:`1px solid ${cat===c.id ? 'rgba(0,153,204,0.35)' : 'rgba(0,60,100,0.1)'}`,
              color: cat===c.id ? '#0099cc' : 'rgba(26,42,58,0.45)', flexShrink:0,
              fontFamily:"'Orbitron', system-ui, sans-serif",
              boxShadow: cat===c.id ? '0 2px 8px rgba(0,153,204,0.15)' : 'none',
              transition:'all 0.25s ease',
            }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Boosts actifs */}
        {activeBoosts.length > 0 && (
          <div style={{ padding:'8px 10px', marginBottom:12, borderRadius:6,
            background:'rgba(0,136,74,0.06)', border:'1px solid rgba(0,136,74,0.15)' }}>
            <div style={{ fontSize:8, color:'rgba(26,42,58,0.45)', letterSpacing:2, marginBottom:6, fontWeight:500 }}>ACTIVE BOOSTS</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {activeBoosts.slice(0,5).map((b:any) => (
                <ActiveBoostBadge key={b.id} boost={b} />
              ))}
            </div>
          </div>
        )}

        {/* Grille items */}
        <div>
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
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'rgba(26,42,58,0.35)', fontSize:10 }}>
                  NO ITEMS IN THIS CATEGORY
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cross-panel CTAs ── */}
        <div style={{ marginTop: 16, display:'flex', flexDirection:'column', gap:8 }}>
          <button
            onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }}
            style={{
              width:'100%', padding:'10px', borderRadius:20,
              background:'linear-gradient(90deg, rgba(121,80,242,0.1), rgba(121,80,242,0.05))',
              border:'1px solid rgba(121,80,242,0.25)',
              color:'#7950f2', fontSize:8, fontWeight:700, letterSpacing:2,
              cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
          >
            <CrystalIcon size="sm" /> BUY CRYSTALS → WALLET
          </button>
          <button
            onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }}
            style={{
              width:'100%', padding:'10px', borderRadius:20,
              background:'linear-gradient(90deg, rgba(204,136,0,0.08), rgba(204,136,0,0.03))',
              border:'1px solid rgba(204,136,0,0.2)',
              color:'#cc8800', fontSize:8, fontWeight:700, letterSpacing:2,
              cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
            }}
          >
            🏪 NFT MARKETPLACE →
          </button>
        </div>
      </GlassPanel>

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
        background: hovered ? `${rc}12` : 'rgba(255,255,255,0.6)',
        border:`1.5px solid ${hovered ? rc+'55' : 'rgba(0,60,100,0.1)'}`,
        borderRadius:8, padding:'12px 10px',
        display:'flex', flexDirection:'column', gap:6,
        cursor:'pointer', transition:'all 0.35s cubic-bezier(0.16,1,0.3,1)',
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
        <div style={{ fontSize:10, fontWeight:700, color:'#1a2a3a', textAlign:'center', lineHeight:1.3, letterSpacing:1 }}>
          {item.name}
        </div>
        <div style={{ fontSize:8, color:rc, textAlign:'center', marginTop:2, fontWeight:700, letterSpacing:1 }}>
          {item.rarity}
        </div>
      </div>

      {/* Effect */}
      <div style={{ fontSize:8, color:'rgba(26,42,58,0.45)', textAlign:'center', lineHeight:1.4, fontFamily:"'Share Tech Mono', monospace" }}>
        {effectLabel}
        {item.effect_duration_seconds > 0 && (
          <span style={{ color:'rgba(26,42,58,0.3)', marginLeft:4 }}>· {duration}</span>
        )}
      </div>

      {/* Description (hover) */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }}
            style={{ fontSize:8, color:'rgba(26,42,58,0.5)', textAlign:'center', overflow:'hidden', lineHeight:1.5 }}
          >
            {item.description}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Price + buy button */}
      <div style={{ marginTop:'auto' }}>
        <div style={{ textAlign:'center', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
          <CrystalIcon size="sm" />
          <span style={{ fontSize:13, fontWeight:900, color:'#7950f2', fontFamily:"'Share Tech Mono', monospace" }}>
            {parseFloat(item.price_tdc).toFixed(0)}
          </span>
        </div>

        <button
          onClick={e => { e.stopPropagation(); if (canAfford && !buying) onBuy() }}
          disabled={!canAfford || buying}
          style={{
            width:'100%', padding:'7px 0', borderRadius:20,
            background: buying ? 'rgba(0,60,100,0.05)'
              : canAfford ? (isBooster ? `${rc}15` : 'rgba(0,153,204,0.1)')
              : 'rgba(0,60,100,0.04)',
            border: canAfford
              ? `1px solid ${isBooster ? rc+'44' : 'rgba(0,153,204,0.3)'}`
              : '1px solid rgba(0,60,100,0.08)',
            color: buying ? 'rgba(26,42,58,0.25)' : canAfford ? (isBooster ? rc : '#0099cc') : 'rgba(26,42,58,0.25)',
            fontSize:8, fontWeight:700, cursor: canAfford && !buying ? 'pointer' : 'not-allowed',
            transition:'all 0.25s ease',
            fontFamily:"'Orbitron', system-ui, sans-serif",
            letterSpacing:1,
          }}
        >
          {buying ? '⏳' : !canAfford ? 'INSUFFICIENT' : isBooster ? 'OPEN BOOSTER' : 'BUY NOW'}
        </button>
      </div>

      {/* Badge max_per_day */}
      {item.max_per_day > 0 && (
        <div style={{
          position:'absolute', top:6, right:6,
          background:'rgba(255,255,255,0.8)', borderRadius:10,
          fontSize:7, color:'rgba(26,42,58,0.45)', padding:'2px 6px',
          border:'1px solid rgba(0,60,100,0.1)',
          fontFamily:"'Share Tech Mono', monospace",
        }}>{item.max_per_day}/D</div>
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
      padding:'4px 8px', borderRadius:20, fontSize:8, fontWeight:700,
      background:'rgba(0,136,74,0.08)', border:'1px solid rgba(0,136,74,0.2)',
      color:'#00884a', display:'flex', alignItems:'center', gap:4,
      letterSpacing:1, fontFamily:"'Orbitron', system-ui, sans-serif",
    }}>
      {label}
      {mins != null && <span style={{ color:'rgba(26,42,58,0.35)', marginLeft:2 }}>· {mins < 60 ? `${mins}min` : `${Math.ceil(mins/60)}h`}</span>}
    </div>
  )
}
