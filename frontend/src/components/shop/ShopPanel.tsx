/**
 * ShopPanel — Boutique complète Hexod
 *
 * Catégories : Militaire · Boucliers · Ressources · Construction · Cosmétiques · Boosters
 * Achats one-click avec déduction HEX Coin
 * Affichage des boosts actifs (timer)
 * Ouverture de booster → BoosterOpenAnimation
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore, useTDCBalance, usePlayer } from '../../store'
import { useKingdomStore } from '../../store/kingdomStore'
import { BoosterOpenAnimation } from './BoosterOpenAnimation'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'

const RARITY_COLOR: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

const CATS = [
  { id:'boosters',  label:'🎁 Boosters',  color:'#cc8800' },
  { id:'attack',    label:'⚔ Attack',     color:'#dc2626' },
  { id:'defense',   label:'🛡 Defense',    color:'#3b82f6' },
  { id:'resources', label:'⛏ Resources',  color:'#cc8800' },
  { id:'chance',    label:'🍀 Chance',     color:'#22c55e' },
  { id:'influence', label:'📢 Influence',  color:'#a855f7' },
  { id:'customize', label:'🎨 Customize',  color:'#ec4899' },
]

// ═══ SHOP CATALOG — ported from main_prototype.html ═══
const BOOSTERS = [
  { id:'booster_standard',  name:'STANDARD BOOSTER', icon:'📦', price:200,  color:'#0099cc',
    desc:'7 Standard Territories\n2 Rare Tokens\n1 Random Bonus', code:'booster_pack' },
  { id:'booster_rare',      name:'RARE BOOSTER',     icon:'💜', price:500,  color:'#8b5cf6',
    desc:'5 Standard Territories\n3 Rare Tokens\n1 Epic Token\n1 Premium Bonus', code:'booster_pack' },
  { id:'booster_legendary', name:'LEGENDARY BOOSTER', icon:'👑', price:1500, color:'#cc8800',
    desc:'3 Standard Territories\n3 Rare Tokens\n2 Epic Tokens\n1 Legendary Token\n1 Exclusive Bonus', code:'booster_pack' },
]

const SHOP_ITEMS: Record<string, Array<{id:string; name:string; desc:string; price:number; icon:string; code:string}>> = {
  attack: [
    { id:'a1', name:'2X TERRITORY MINT SPEED',  desc:'Double your territory minting speed for 24 hours',         price:150, icon:'⚔', code:'atk_multiplier' },
    { id:'a2', name:'DISTANT TERRITORY UNLOCK', desc:'Mint territories outside your adjacent zone (1 use)',       price:300, icon:'🎯', code:'build_instant_once' },
    { id:'a3', name:'2X ARMY POWER',            desc:'Double army strength in all combats for 24 hours',          price:250, icon:'💪', code:'double_attack' },
    { id:'a4', name:'BLITZ MODE',               desc:'Instant deployment — skip all training time for 12h',       price:400, icon:'⚡', code:'build_speed' },
  ],
  defense: [
    { id:'d1', name:'72H KINGDOM SHIELD',       desc:'Full protection from attacks on one kingdom',              price:500, icon:'🛡', code:'shield' },
    { id:'d2', name:'2X DEFENSE RATING',        desc:'Double all defense values for 48 hours',                   price:350, icon:'🏰', code:'def_multiplier' },
    { id:'d3', name:'ANTI-NUCLEAR SHIELD',      desc:'Protect against nuclear strikes for 7 days',               price:800, icon:'☢', code:'nuke_strike' },
    { id:'d4', name:'INFLUENCE RESISTANCE',     desc:'Block influence attacks for 72 hours',                     price:200, icon:'🧠', code:'stealth_once' },
  ],
  resources: [
    { id:'r1', name:'2X EXTRACTION RATE',       desc:'Double all resource extraction for 24 hours',              price:200, icon:'⛏', code:'production_multiplier' },
    { id:'r2', name:'ENERGY EFFICIENCY',        desc:'-50% energy consumption for 48 hours',                     price:180, icon:'⚡', code:'build_cost_reduction' },
    { id:'r3', name:'RARE DROP BONUS',          desc:'+50% chance for rare resource drops (24h)',                 price:350, icon:'💎', code:'hex_bonus' },
    { id:'r4', name:'TRADE ADVANTAGE',          desc:'-10% fees on all marketplace trades for 72h',              price:250, icon:'📈', code:'build_cost_reduction' },
  ],
  chance: [
    { id:'c1', name:'+CARD RARITY',             desc:'Increase card rarity probability by 25% for 24h',          price:300, icon:'🎴', code:'hex_bonus' },
    { id:'c2', name:'+EVENT MINT PROB',          desc:'Better odds in all event card draws for 24h',              price:250, icon:'📡', code:'hex_bonus' },
    { id:'c3', name:'SAFARI HINTS (2H)',         desc:'Extra clues and thermal overlay during safaris',           price:100, icon:'🔮', code:'hex_bonus' },
    { id:'c4', name:'LUCK BOOSTER',             desc:'+15% chance rating across all activities (48h)',            price:400, icon:'🍀', code:'hex_bonus' },
  ],
  influence: [
    { id:'i1', name:'GLOBAL MESSAGE',           desc:'Send 1 message visible to all online players',             price:50,  icon:'📢', code:'stealth_once' },
    { id:'i2', name:'EXTENDED VISION',          desc:'See +5 hex further for territory conquest (24h)',           price:200, icon:'🔭', code:'hex_bonus' },
    { id:'i3', name:'BRAG MODE',                desc:'Display double empire size — access reserved areas (24h)', price:350, icon:'🎭', code:'hex_bonus' },
    { id:'i4', name:'RESERVED ACCESS',          desc:'Enter elite zones for advanced tokens and events',         price:600, icon:'👑', code:'hex_bonus' },
  ],
  customize: [
    { id:'x1', name:'AVATAR SKINS',             desc:'Premium avatar frames, effects, and animations',           price:250, icon:'🖼', code:'custom_flag' },
    { id:'x2', name:'FLAG & EMBLEM',            desc:'Custom kingdom flag and player emblem',                     price:150, icon:'🏴', code:'custom_flag' },
    { id:'x3', name:'KINGDOM COLORS',           desc:'Custom hex colors on the global map',                      price:200, icon:'🎨', code:'border_color' },
    { id:'x4', name:'MEDIA EMBEDDING',          desc:'Embed images/video on your hex territories',               price:300, icon:'📷', code:'custom_flag' },
    { id:'x5', name:'LIVE STREAM SPACE',        desc:'Create a live streaming zone on your territory',            price:500, icon:'📺', code:'custom_flag' },
  ],
}

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
  const [cat, setCat] = useState('boosters')
  const [boosterResult, setBoosterResult] = useState<any>(null)
  const qc = useQueryClient()
  const balance = useTDCBalance()
  const player  = usePlayer()
  const activeKingdom = useKingdomStore(s => s.getActiveKingdom())

  const { data: activeBoosts = [] } = useQuery<any[]>({
    queryKey: ['active-boosts'],
    queryFn: () => api.get('/shop/active-boosts/').then(r => r.data).catch(() => []),
    staleTime: 30000,
  })

  const handleBuy = (itemName: string, itemCode: string, price: number) => {
    const bal = toNum(balance)
    if (bal < price) { toast.error(`Not enough HEX (need ${price}, have ${Math.floor(bal)})`); return }
    api.post('/shop/purchase/', { item_code: itemCode, quantity: 1 })
      .then(res => {
        if (res.data?.booster) {
          setBoosterResult({ cards: res.data.booster.cards, itemName })
        } else {
          toast.success(`✅ ${itemName} purchased!`)
        }
        qc.invalidateQueries({ queryKey: ['player'] })
        qc.invalidateQueries({ queryKey: ['active-boosts'] })
      })
      .catch((e: any) => toast.error(e?.response?.data?.error || 'Purchase failed'))
  }

  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <>
      <GlassPanel title="SHOP" onClose={onClose} accent="#cc8800">
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
              <CrystalIcon size="sm" />{activeKingdom.dailyHex}/d
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

        {/* Category quick-nav — scrolls to section */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:8, marginBottom:12, position:'sticky', top:0, zIndex:1, background:'rgba(235,242,250,0.95)', backdropFilter:'blur(8px)' }}>
          {CATS.map(c => (
            <button key={c.id} onClick={() => document.getElementById(`shop-${c.id}`)?.scrollIntoView({ behavior:'smooth', block:'start' })} style={{
              padding:'6px 10px', borderRadius:20, cursor:'pointer', whiteSpace:'nowrap',
              fontSize:7, fontWeight:500, letterSpacing:1,
              background:'rgba(255,255,255,0.5)',
              border:`1px solid rgba(0,60,100,0.1)`,
              color:c.color, flexShrink:0,
              fontFamily:"'Orbitron', system-ui, sans-serif",
            }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Active boosts */}
        {activeBoosts.length > 0 && (
          <div style={{ padding:'8px 10px', marginBottom:12, borderRadius:6,
            background:'rgba(0,136,74,0.06)', border:'1px solid rgba(0,136,74,0.15)' }}>
            <div style={{ fontSize:7, color:'rgba(26,42,58,0.45)', letterSpacing:2, marginBottom:6, fontWeight:700, fontFamily:"'Orbitron', system-ui, sans-serif" }}>ACTIVE BOOSTS</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {activeBoosts.slice(0,5).map((b:any) => (
                <ActiveBoostBadge key={b.id} boost={b} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ BOOSTERS SECTION ═══ */}
        <div id="shop-boosters" style={{ marginBottom:20 }}>
          <div style={{ fontSize:8, fontWeight:700, letterSpacing:2, color:'#cc8800', marginBottom:10, fontFamily:"'Orbitron', system-ui, sans-serif" }}>
            🎁 BOOSTER PACKS — 10 ITEMS EACH
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:8 }}>
            {BOOSTERS.map(b => (
              <button key={b.id} onClick={() => handleBuy(b.name, b.code, b.price)} style={{
                padding:14, borderRadius:10, cursor:'pointer', textAlign:'center',
                background:`linear-gradient(135deg, ${b.color}12, ${b.color}05)`,
                border:`2px solid ${b.color}40`, transition:'all 0.25s ease',
              }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{b.icon}</div>
                <div style={{ fontSize:9, fontWeight:900, color:b.color, marginBottom:4, fontFamily:"'Orbitron', system-ui, sans-serif", letterSpacing:1 }}>{b.name}</div>
                <div style={{ fontSize:7, color:'rgba(26,42,58,0.45)', lineHeight:1.6, fontFamily:'system-ui', marginBottom:8, whiteSpace:'pre-line' }}>{b.desc}</div>
                <div style={{ fontSize:14, fontWeight:900, color:b.color, fontFamily:"'Share Tech Mono', monospace" }}>{b.price} ◆</div>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ ALL ITEM CATEGORIES — one-pager ═══ */}
        {CATS.filter(c => c.id !== 'boosters').map(c => (
          SHOP_ITEMS[c.id] && (
            <div key={c.id} id={`shop-${c.id}`} style={{ marginBottom:20 }}>
              <div style={{ fontSize:8, fontWeight:700, letterSpacing:2, color:c.color, marginBottom:10, fontFamily:"'Orbitron', system-ui, sans-serif" }}>
                {c.label.toUpperCase()}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {SHOP_ITEMS[cat].map(item => (
              <div key={item.id} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'12px 14px', borderRadius:8,
                background:'rgba(255,255,255,0.5)', border:'1px solid rgba(0,60,100,0.1)',
                transition:'all 0.25s ease',
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:9, fontWeight:900, color:'#1a2a3a', letterSpacing:1, fontFamily:"'Orbitron', system-ui, sans-serif" }}>
                    {item.icon} {item.name}
                  </div>
                  <div style={{ fontSize:8, color:'rgba(26,42,58,0.45)', marginTop:3, lineHeight:1.4, textTransform:'none', fontFamily:'system-ui' }}>
                    {item.desc}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:900, color:'#0099cc', fontFamily:"'Share Tech Mono', monospace" }}>
                    {item.price} ◆
                  </div>
                  <button onClick={() => handleBuy(item.name, item.code, item.price)} style={{
                    padding:'6px 14px', borderRadius:16, cursor:'pointer',
                    background: toNum(balance) >= item.price ? (CATS.find(c=>c.id===cat)?.color || '#0099cc') : 'rgba(0,60,100,0.08)',
                    color: toNum(balance) >= item.price ? '#fff' : 'rgba(26,42,58,0.3)',
                    border:'none', fontSize:8, fontWeight:700, letterSpacing:1,
                    fontFamily:"'Orbitron', system-ui, sans-serif",
                    opacity: toNum(balance) >= item.price ? 1 : 0.5,
                  }}>
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
            </div>
          )
        ))}

        {/* Buy HEX CTA */}
        <div style={{ marginTop:16, padding:'14px 16px', borderRadius:8,
          background:'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))',
          border:'1px solid rgba(204,136,0,0.3)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <div style={{ fontSize:9, fontWeight:900, color:'#cc8800', fontFamily:"'Orbitron', system-ui, sans-serif", letterSpacing:1, display:'flex', alignItems:'center', gap:6 }}>
              <CrystalIcon size="sm" /> BUY CRYSTALS WITH HEX
            </div>
            <div style={{ fontSize:7, color:'rgba(26,42,58,0.4)', marginTop:2, textTransform:'none', fontFamily:'system-ui' }}>
              In-game currency — earned from bonuses or purchased with HEX crypto
            </div>
          </div>
          <button onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }} style={{
            padding:'8px 14px', borderRadius:16, cursor:'pointer',
            background:'#cc8800', color:'#fff', border:'none',
            fontSize:8, fontWeight:700, letterSpacing:1,
            fontFamily:"'Orbitron', system-ui, sans-serif",
          }}>Buy HEX →</button>
        </div>
      </GlassPanel>

      {/* Booster open animation */}
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
