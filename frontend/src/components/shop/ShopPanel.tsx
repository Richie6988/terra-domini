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
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'
import { Clock } from 'lucide-react'

const SHOP_ACCENT = '#fbbf24'

const RARITY_COLOR: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

const CATS = [
  { id:'boosters',  label:'Boosters',  iconId:'gift',        color:'#cc8800' },
  { id:'attack',    label:'Attack',    iconId:'swords',      color:'#dc2626' },
  { id:'defense',   label:'Defense',   iconId:'ui_shield',   color:'#3b82f6' },
  { id:'resources', label:'Resources', iconId:'pickaxe',     color:'#cc8800' },
  { id:'chance',    label:'Chance',    iconId:'clover',      color:'#22c55e' },
  { id:'influence', label:'Influence', iconId:'megaphone',   color:'#a855f7' },
  { id:'customize', label:'Customize', iconId:'palette',     color:'#ec4899' },
]

// ═══ SHOP CATALOG — ported from main_prototype.html ═══
const BOOSTERS = [
  { id:'booster_standard',  name:'STANDARD BOOSTER', icon:'box', price:200,  color:'#0099cc',
    desc:'7 Standard Territories\n2 Rare Tokens\n1 Random Bonus', code:'booster_standard' },
  { id:'booster_rare',      name:'RARE BOOSTER',     icon:'heart_purple', price:500,  color:'#8b5cf6',
    desc:'5 Standard Territories\n3 Rare Tokens\n1 Epic Token\n1 Premium Bonus', code:'booster_rare' },
  { id:'booster_legendary', name:'LEGENDARY BOOSTER', icon:'crown', price:1500, color:'#cc8800',
    desc:'3 Standard Territories\n3 Rare Tokens\n2 Epic Tokens\n1 Legendary Token\n1 Exclusive Bonus', code:'booster_legendary' },
]

const SHOP_ITEMS: Record<string, Array<{id:string; name:string; desc:string; price:number; icon:string; code:string}>> = {
  attack: [
    { id:'a1', name:'2X TERRITORY MINT SPEED',  desc:'Double your territory minting speed for 24 hours',         price:150, icon:'swords', code:'atk_2x_army' },
    { id:'a2', name:'DISTANT TERRITORY UNLOCK', desc:'Mint territories outside your adjacent zone (1 use)',       price:300, icon:'target', code:'atk_distant' },
    { id:'a3', name:'2X ARMY POWER',            desc:'Double army strength in all combats for 24 hours',          price:250, icon:'muscle', code:'atk_2x_army' },
    { id:'a4', name:'BLITZ MODE',               desc:'Instant deployment — skip all training time for 12h',       price:400, icon:'lightning', code:'atk_blitz' },
  ],
  defense: [
    { id:'d1', name:'72H KINGDOM SHIELD',       desc:'Full protection from attacks on one kingdom',              price:500, icon:'ui_shield', code:'def_shield_72h' },
    { id:'d2', name:'2X DEFENSE RATING',        desc:'Double all defense values for 48 hours',                   price:350, icon:'castle', code:'def_2x_defense' },
    { id:'d3', name:'ANTI-NUCLEAR SHIELD',      desc:'Protect against nuclear strikes for 7 days',               price:800, icon:'nuclear', code:'def_anti_nuke' },
    { id:'d4', name:'INFLUENCE RESISTANCE',     desc:'Block influence attacks for 72 hours',                     price:200, icon:'brain', code:'def_influence_resist' },
  ],
  resources: [
    { id:'r1', name:'2X EXTRACTION RATE',       desc:'Double all resource extraction for 24 hours',              price:200, icon:'pickaxe', code:'eco_2x_extraction' },
    { id:'r2', name:'ENERGY EFFICIENCY',        desc:'-50% energy consumption for 48 hours',                     price:180, icon:'lightning', code:'eco_energy' },
    { id:'r3', name:'RARE DROP BONUS',          desc:'+50% chance for rare resource drops (24h)',                 price:350, icon:'gem', code:'eco_rare_drop' },
    { id:'r4', name:'TRADE ADVANTAGE',          desc:'-10% fees on all marketplace trades for 72h',              price:250, icon:'chart_up', code:'eco_trade_advantage' },
  ],
  chance: [
    { id:'c1', name:'+CARD RARITY',             desc:'Increase card rarity probability by 25% for 24h',          price:300, icon:'cards', code:'col_rarity' },
    { id:'c2', name:'+EVENT MINT PROB',          desc:'Better odds in all event card draws for 24h',              price:250, icon:'safari_radar', code:'col_luck' },
    { id:'c3', name:'SAFARI HINTS (2H)',         desc:'Extra clues and thermal overlay during safaris',           price:100, icon:'crystal_ball', code:'col_safari_hints' },
    { id:'c4', name:'LUCK BOOSTER',             desc:'+15% chance rating across all activities (48h)',            price:400, icon:'clover', code:'col_luck' },
  ],
  influence: [
    { id:'i1', name:'GLOBAL MESSAGE',           desc:'Send 1 message visible to all online players',             price:50,  icon:'megaphone', code:'soc_global_msg' },
    { id:'i2', name:'EXTENDED VISION',          desc:'See +5 hex further for territory conquest (24h)',           price:200, icon:'observatory', code:'soc_extended_vision' },
    { id:'i3', name:'BRAG MODE',                desc:'Display double empire size — access reserved areas (24h)', price:350, icon:'theater', code:'soc_brag' },
    { id:'i4', name:'RESERVED ACCESS',          desc:'Enter elite zones for advanced tokens and events',         price:600, icon:'crown', code:'soc_vip' },
  ],
  customize: [
    { id:'x1', name:'AVATAR SKINS',             desc:'Premium avatar frames, effects, and animations',           price:250, icon:'picture', code:'custom_flag' },
    { id:'x2', name:'FLAG & EMBLEM',            desc:'Custom kingdom flag and player emblem',                     price:150, icon:'flag_black', code:'custom_flag' },
    { id:'x3', name:'KINGDOM COLORS',           desc:'Custom hex colors on the global map',                      price:200, icon:'palette', code:'border_color' },
    { id:'x4', name:'MEDIA EMBEDDING',          desc:'Embed images/video on your hex territories',               price:300, icon:'camera', code:'custom_flag' },
    { id:'x5', name:'LIVE STREAM SPACE',        desc:'Create a live streaming zone on your territory',            price:500, icon:'tv', code:'custom_flag' },
  ],
}

const EFFECT_LABEL: Record<string,string> = {
  atk_2x_army:       'ATK x2',
  atk_blitz:         'Blitz Mode',
  atk_distant:       'Distant Strike',
  atk_mint_speed:    'Mint Speed x2',
  def_shield_72h:    'Shield 72H',
  def_2x_defense:    'DEF x2',
  def_anti_nuke:     'Anti-Nuke',
  def_influence_resist: 'Influence Shield',
  eco_2x_extraction: 'Extraction x2',
  eco_energy:        'Energy Efficiency',
  eco_rare_drop:     'Rare Drop Boost',
  eco_trade_advantage: 'Trade Advantage',
  col_luck:          'Luck +15',
  col_rarity:        'Rarity Boost',
  col_safari_1h:     'Continuous Safari',
  col_safari_hints:  'Safari Hints',
  soc_global_msg:    'Global Message',
  soc_extended_vision: 'Extended Vision',
  soc_brag:          'Brag Mode',
  soc_vip:           'VIP Access',
  hex_bonus:         'HEX Bonus',
  booster_standard:  'Standard Booster',
  booster_rare:      'Rare Booster',
  booster_legendary: 'Legendary Booster',
  custom_flag:       'Custom Flag',
  border_color:      'Kingdom Colors',
}

function formatDuration(sec: number): string {
  if (!sec) return 'Permanent'
  if (sec < 3600) return `${Math.round(sec/60)}min`
  if (sec < 86400) return `${Math.round(sec/3600)}h`
  return `${Math.round(sec/86400)}d`
}

interface Props { onClose: () => void }

export function ShopPanel({ onClose }: Props) {
  const [cat, setCat] = useState('boosters')
  const [boosterResult, setBoosterResult] = useState<any>(null)
  const qc = useQueryClient()
  const balance = useTDCBalance()
  const player  = usePlayer()
  const activeKingdom = useKingdomStore(s => s.getActiveKingdom())

  // Fetch wallet directly — don't trust stale Zustand store or WS timing
  const { data: walletData } = useQuery<any>({
    queryKey: ['wallet-me'],
    queryFn: () => api.get('/wallet/me/').then(r => r.data),
    refetchInterval: 15000,
    staleTime: 10000,
  })

  // Priority order: fresh API > Zustand store > player field > 0
  const hexBalance = parseFloat(String(
    walletData?.in_game ?? walletData?.tdc_in_game ??
    balance?.in_game ??
    player?.tdc_in_game ?? 0
  )) || 0

  const { data: activeBoosts = [] } = useQuery<any[]>({
    queryKey: ['active-boosts'],
    queryFn: () => api.get('/shop/active-boosts/').then(r => r.data).catch(() => []),
    staleTime: 30000,
  })

  const handleBuy = (itemName: string, itemCode: string, price: number) => {
    const bal = hexBalance
    if (bal < price) { toast.error(`Not enough HEX (need ${price}, have ${Math.floor(bal)})`); return }
    api.post('/shop/purchase/', { item_code: itemCode, quantity: 1 })
      .then(res => {
        if (res.data?.booster) {
          setBoosterResult({ cards: res.data.booster.cards, itemName })
        } else {
          toast.success(`${itemName} purchased!`)
        }
        qc.invalidateQueries({ queryKey: ['player'] })
        qc.invalidateQueries({ queryKey: ['wallet-me'] })
        qc.invalidateQueries({ queryKey: ['active-boosts'] })
      })
      .catch((e: any) => toast.error(e?.response?.data?.error || 'Purchase failed'))
  }

  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <>
      <GlassPanel title="SHOP" onClose={onClose} accent={SHOP_ACCENT} icon={<IconSVG id="cart" size={24} />} subtitle="Boosters, boosts & cosmetics">
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
            }}><IconSVG id="castle" size={18} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:activeKingdom.color, letterSpacing:2, fontFamily:"'Orbitron', system-ui, sans-serif" }}>
                {(activeKingdom.name || '').toUpperCase()}
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', letterSpacing:1, marginTop:2 }}>
                BOOSTS APPLY TO THIS KINGDOM
              </div>
            </div>
            <div style={{
              fontSize:12, color:'#F59E0B', fontWeight:700, fontFamily:"'Share Tech Mono', monospace",
              display:'flex', alignItems:'center', gap:3,
            }}>
              <IconSVG id="hex_coin" size={12} />{activeKingdom.dailyHex}/d
            </div>
          </div>
        )}

        {/* Balance display */}
        <div className="hx-card hx-card--accent" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:12, padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <IconSVG id="hex_coin" size={36} />
            <div className="hx-stat">
              <span className="hx-stat__label">HEX BALANCE</span>
              <span className="hx-stat__value hx-stat__value--accent" style={{ fontSize:26 }}>{Math.floor(hexBalance).toLocaleString()}</span>
            </div>
          </div>
          <button className="btn-game btn-game-glass" style={{ fontSize:10, padding:'10px 14px', flexShrink:0 }}
            onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }}>GET HEX</button>
        </div>

        {/* Category quick-nav — scrolls to section */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'4px 0 10px', marginBottom:12, position:'sticky', top:-16, zIndex:2, background:'#0b1828', scrollbarWidth:'none' }}>
          {CATS.map(c => (
            <button key={c.id} className="hx-chip" onClick={() => document.getElementById(`shop-${c.id}`)?.scrollIntoView({ behavior:'smooth', block:'start' })} style={{
              cursor:'pointer', flexShrink:0, minHeight:34, padding:'6px 12px', fontSize:10, color:c.color,
              borderColor:`${c.color}40`, background:`${c.color}12`,
            }}>
              <IconSVG id={c.iconId} size={16} />
              {c.label}
            </button>
          ))}
        </div>

        {/* Active boosts */}
        {activeBoosts.length > 0 && (
          <div className="hx-card" style={{ marginBottom:14, ['--accent' as any]:'#22c55e', borderColor:'rgba(34,197,94,0.3)' }}>
            <div className="hx-section-title" style={{ marginTop:0 }}>ACTIVE BOOSTS</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {activeBoosts.slice(0,5).map((b:any) => (
                <ActiveBoostBadge key={b.id} boost={b} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ BOOSTERS SECTION ═══ */}
        <style>{`
          .shop-packs { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
          .shop-pack { position:relative; overflow:hidden; border-radius:14px; padding:16px 14px 14px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;
            transition:transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s; }
          .shop-pack:hover { transform:translateY(-3px); }
          .shop-pack__body { display:flex; flex-direction:column; align-items:center; gap:8px; flex:1; width:100%; }
          .shop-row { display:flex; align-items:center; gap:12px; }
          @media (max-width:640px) {
            .shop-packs { grid-template-columns:1fr; }
            .shop-pack { flex-direction:row; text-align:left; align-items:center; }
            .shop-pack__body { align-items:flex-start; }
            .shop-row__desc { display:none; }
          }
        `}</style>
        <div id="shop-boosters" style={{ marginBottom:22, ['--accent' as any]: SHOP_ACCENT }}>
          <div className="hx-section-title">
            <IconSVG id="gift" size={16} /> BOOSTER PACKS
          </div>
          <div className="shop-packs">
            {BOOSTERS.map((b, i) => {
              const canAfford = hexBalance >= b.price
              return (
                <div key={b.id} className="shop-pack hx-rise" style={{
                  animationDelay:`${i*60}ms`,
                  background:`radial-gradient(120% 80% at 50% 0%, ${b.color}38 0%, ${b.color}0d 45%, rgba(255,255,255,0.02) 100%)`,
                  border:`1.5px solid ${b.color}66`,
                  boxShadow:`0 0 24px ${b.color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}>
                  <div style={{ position:'relative', width:76, height:76, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ position:'absolute', inset:0, clipPath:'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                      background:`linear-gradient(160deg, ${b.color}, ${b.color}33)`, opacity:0.9 }} />
                    <div style={{ position:'absolute', inset:3, clipPath:'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)', background:'#0b1828' }} />
                    <div style={{ position:'relative', filter:`drop-shadow(0 0 10px ${b.color})` }}><IconSVG id={b.icon} size={44} /></div>
                  </div>
                  <div className="shop-pack__body">
                    <div style={{ fontSize:12, fontWeight:900, color:b.color, fontFamily:"'Orbitron', system-ui, sans-serif", letterSpacing:1.5, textShadow:`0 0 12px ${b.color}66` }}>{b.name}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:11, color:'rgba(226,232,240,0.7)', fontFamily:'system-ui', textTransform:'none', letterSpacing:0 }}>
                      {b.desc.split('\n').map(line => (
                        <span key={line} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:5, height:5, borderRadius:1, background:b.color, transform:'rotate(45deg)', flexShrink:0 }} />{line}
                        </span>
                      ))}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:'auto', paddingTop:4 }}>
                      <IconSVG id="hex_coin" size={18} />
                      <span style={{ fontSize:20, fontWeight:900, color:'#fde68a', fontFamily:"'Share Tech Mono', monospace" }}>{b.price.toLocaleString()}</span>
                    </div>
                    <button onClick={() => handleBuy(b.name, b.code, b.price)}
                      className={canAfford ? 'btn-game btn-game-gold' : 'btn-game btn-game-glass'}
                      style={{ width:'100%', minHeight:40, fontSize:11, opacity: canAfford ? 1 : 0.6 }}>
                      {canAfford ? 'OPEN PACK' : 'NOT ENOUGH HEX'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ ALL ITEM CATEGORIES — one-pager ═══ */}
        {CATS.filter(c => c.id !== 'boosters').map(c => (
          SHOP_ITEMS[c.id] && (
            <div key={c.id} id={`shop-${c.id}`} style={{ marginBottom:22, ['--accent' as any]: c.color, scrollMarginTop:56 }}>
              <div className="hx-section-title">
                <IconSVG id={c.iconId} size={16} /> {c.label.toUpperCase()}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {SHOP_ITEMS[c.id].map((item, i) => {
              const canAfford = hexBalance >= item.price
              return (
              <div key={item.id} className="hx-card shop-row hx-rise" style={{ animationDelay:`${i*40}ms`, padding:'10px 12px' }}>
                <div style={{ width:46, height:46, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background:`linear-gradient(160deg, ${c.color}30, ${c.color}0a)`, border:`1px solid ${c.color}40` }}>
                  <IconSVG id={item.icon} size={32} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:900, color:'#e2e8f0', letterSpacing:1, fontFamily:"'Orbitron', system-ui, sans-serif", lineHeight:1.3 }}>
                    {item.name}
                  </div>
                  <div className="shop-row__desc" style={{ fontSize:11, color:'rgba(226,232,240,0.6)', marginTop:4, lineHeight:1.4, textTransform:'none', fontFamily:'system-ui', letterSpacing:0 }}>
                    {item.desc}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:15, fontWeight:900, color:'#fde68a', fontFamily:"'Share Tech Mono', monospace" }}>
                    <IconSVG id="hex_coin" size={16} />{item.price}
                  </div>
                  <button onClick={() => handleBuy(item.name, item.code, item.price)}
                    className={canAfford ? 'btn-game btn-game-gold' : 'btn-game btn-game-glass'}
                    aria-label={`Buy ${item.name}`}
                    style={{ fontSize:10, padding:'8px 16px', minHeight:36, opacity: canAfford ? 1 : 0.55 }}>
                    BUY
                  </button>
                </div>
              </div>
            )})}
          </div>
            </div>
          )
        ))}

        {/* Buy HEX CTA */}
        <div className="hx-card hx-card--accent" style={{ marginTop:8, ['--accent' as any]:'#a855f7',
          display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:'1 1 220px' }}>
            <IconSVG id="ui_wallet" size={34} />
            <div>
              <div style={{ fontSize:11, fontWeight:900, color:'#d8b4fe', fontFamily:"'Orbitron', system-ui, sans-serif", letterSpacing:1 }}>NEED MORE HEX?</div>
              <div style={{ fontSize:11, color:'rgba(226,232,240,0.6)', marginTop:3, textTransform:'none', fontFamily:'system-ui', letterSpacing:0 }}>
                Earn HEX from territories and events, or top up from your wallet.
              </div>
            </div>
          </div>
          <button className="btn-game btn-game-purple" onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }} style={{ fontSize:10 }}>
            OPEN WALLET
          </button>
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
      padding:'5px 10px', borderRadius:20, fontSize:10, fontWeight:700,
      background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.35)',
      color:'#4ade80', display:'flex', alignItems:'center', gap:5,
      letterSpacing:1, fontFamily:"'Orbitron', system-ui, sans-serif",
    }}>
      {label}
      {mins != null && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:2, display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={11} /> {mins < 60 ? `${mins}min` : `${Math.ceil(mins/60)}h`}</span>}
    </div>
  )
}
