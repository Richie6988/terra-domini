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
import { playSound } from '../../hooks/useSound'

const SHOP_ACCENT = '#fbbf24'

const RARITY_COLOR: Record<string,string> = {
  common:'#cd7f32', uncommon:'#cbd5e1', rare:'#fbbf24',
  epic:'#10b981', legendary:'#67e8f9', mythic:'#ec4899',
}

const CATS = [
  { id:'boosters',   label:'Boosters', iconId:'gift',      color:'#cc8800' },
  { id:'attack',     label:'Attack',   iconId:'swords',    color:'#dc2626' },
  { id:'defense',    label:'Defense',  iconId:'ui_shield', color:'#3b82f6' },
  { id:'economy',    label:'Economy',  iconId:'pickaxe',   color:'#cc8800' },
  { id:'collection', label:'Chance',   iconId:'clover',    color:'#22c55e' },
  { id:'social',     label:'Social',   iconId:'megaphone', color:'#a855f7' },
]

// ═══ SHOP CATALOG — ported from main_prototype.html ═══
const BOOSTERS = [
  { id:'booster_standard',  name:'STANDARD BOOSTER', icon:'box', price:200,  color:'#0099cc',
    desc:'3 free territories\nCommon to Rare\nSmall Epic/Legendary chance', code:'booster_standard' },
  { id:'booster_rare',      name:'RARE BOOSTER',     icon:'heart_purple', price:500,  color:'#8b5cf6',
    desc:'4 free territories\n1 Rare or better guaranteed', code:'booster_rare' },
  { id:'booster_legendary', name:'LEGENDARY BOOSTER', icon:'crown', price:1200, color:'#cc8800',
    desc:'5 free territories\n1 Legendary guaranteed', code:'booster_legendary' },
]

// Icons per server item code (catalog = /api/shop/catalog/, seeded by `manage.py seed_shop`)
const CODE_ICON: Record<string,string> = {
  atk_2x_army:'muscle', atk_blitz:'lightning', atk_distant:'target', atk_mint_speed:'swords',
  def_shield_72h:'ui_shield', def_2x_defense:'castle', def_anti_nuke:'nuclear', def_influence_resist:'brain',
  eco_2x_extraction:'pickaxe', eco_energy:'lightning', eco_rare_drop:'gem', eco_trade_advantage:'chart_up',
  col_rarity:'cards', col_luck:'clover', col_safari_hints:'crystal_ball', col_safari_1h:'safari_radar',
  soc_global_msg:'megaphone', soc_extended_vision:'observatory', soc_brag:'theater', soc_vip:'crown',
}

const MAX_MILITARY_BOOST_PCT = 25 // mirrors GAME.MAX_MILITARY_BOOST_PCT (combat.engine.active_boost_pct)

/** What the item really does — derived from its server effect, never a marketing line the game doesn't honour. */
function honestDesc(item: any): string {
  const dur = formatDuration(item.effect_duration_seconds || 0)
  if (item.effect_type === 'atk_multiplier' || item.effect_type === 'def_multiplier') {
    const pct = Math.min((Number(item.effect_value) - 1) * 100, MAX_MILITARY_BOOST_PCT)
    return `+${pct}% ${item.effect_type === 'atk_multiplier' ? 'attack in battles you launch' : 'defense on all your territories'} for ${dur}.`
  }
  if (item.effect_type === 'shield') return `Nobody can attack your territories for up to ${dur} (max 12h of shield per day).`
  return item.description || ''
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

  const { data: catalog = [], isLoading: catLoading } = useQuery<any[]>({
    queryKey: ['shop-catalog'],
    queryFn: () => api.get('/shop/catalog/').then(r => r.data),
    staleTime: 60000,
  })
  const priceOf = (code: string, fallback: number) => Number(catalog.find((i: any) => i.code === code)?.price_tdc ?? fallback)

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
          playSound('booster')
          setBoosterResult({ cards: res.data.booster.cards, itemName })
        } else {
          playSound('purchase')
          toast.success(res.data?.message && res.data.message !== 'Purchase complete!' ? res.data.message : `${itemName} purchased!`, { duration: 5000 })
        }
        qc.invalidateQueries({ queryKey: ['player'] })
        qc.invalidateQueries({ queryKey: ['wallet-me'] })
        qc.invalidateQueries({ queryKey: ['active-boosts'] })
        if (res.data?.booster) ['kingdoms', 'loop-status', 'my-territories', 'territories-mine'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
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
            border:`2px solid ${activeKingdom.color}15`,
          }}>
            <div style={{
              width:24, height:24, borderRadius:'50%',
              background:`linear-gradient(135deg, ${activeKingdom.color}, ${activeKingdom.color}aa)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, boxShadow:`0 4px 0 rgba(0,0,0,0.35)`,
            }}><IconSVG id="castle" size={18} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize: 11, fontWeight:800, color:activeKingdom.color, letterSpacing:0.5, fontFamily:'var(--font-heading)' }}>
                {(activeKingdom.name || '').toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color:'rgba(255,255,255,0.5)', letterSpacing:0.5, marginTop:2 }}>
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
              <span className="hx-stat__label" style={{ color:'#fff', textShadow:'0 1px 0 rgba(0,0,0,0.45)' }}>HEX BALANCE</span>
              <span className="hx-stat__value" style={{ fontSize:26, color:'#fff', textShadow:'0 2px 0 rgba(0,0,0,0.45)' }}>{Math.floor(hexBalance).toLocaleString()}</span>
            </div>
          </div>
          <button className="btn-game btn-game-glass" style={{ fontSize: 11, padding:'10px 14px', flexShrink:0 }}
            onClick={() => document.getElementById('shop-hexcoins')?.scrollIntoView({ behavior:'smooth', block:'start' })}>GET HEX</button>
        </div>

        {/* ═══ BUY HEX — real money, straight in the shop (1 € = 1000 HEX = 1 HEX Coin) ═══ */}
        <HexPacks />

        {/* Category quick-nav — scrolls to section */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'4px 0 10px', marginBottom:12, position:'sticky', top:-16, zIndex:2, background:'#0b1828', scrollbarWidth:'none' }}>
          {CATS.map(c => (
            <button key={c.id} className="hx-chip" onClick={() => document.getElementById(`shop-${c.id}`)?.scrollIntoView({ behavior:'smooth', block:'start' })} style={{
              cursor:'pointer', flexShrink:0, minHeight:34, padding:'6px 12px', fontSize: 11, color:c.color,
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
            <span className="hx-chip hx-chip--accent" title="Packs with random content can't be bought with purchased HEX">EARNED HEX ONLY</span>
          </div>
          <div className="shop-packs">
            {BOOSTERS.map((b0, i) => {
              const b = { ...b0, price: priceOf(b0.code, b0.price) }
              const canAfford = hexBalance >= b.price
              return (
                <div key={b.id} className="shop-pack hx-rise" style={{
                  animationDelay:`${i*60}ms`,
                  background:`radial-gradient(120% 80% at 50% 0%, ${b.color}38 0%, ${b.color}0d 45%, rgba(255,255,255,0.02) 100%)`,
                  border:`3px solid ${b.color}66`,
                  boxShadow:`0 4px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}>
                  <div style={{ position:'relative', width:76, height:76, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ position:'absolute', inset:0, clipPath:'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                      background:`linear-gradient(160deg, ${b.color}, ${b.color}33)`, opacity:0.9 }} />
                    <div style={{ position:'absolute', inset:3, clipPath:'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)', background:'#0b1828' }} />
                    <div style={{ position:'relative', filter:`drop-shadow(0 3px 0 rgba(0,0,0,0.45))` }}><IconSVG id={b.icon} size={44} /></div>
                  </div>
                  <div className="shop-pack__body">
                    <div style={{ fontSize:12, fontWeight:900, color:b.color, fontFamily:'var(--font-heading)', letterSpacing:0.5, textShadow:'0 2px 0 rgba(0,0,0,0.45)' }}>{b.name}</div>
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

        {/* ═══ ALL ITEM CATEGORIES — from the server catalog ═══ */}
        {catLoading && [0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 66, borderRadius: 12, marginBottom: 8 }} />)}
        {CATS.filter(c => c.id !== 'boosters').map(c => {
          const items = catalog.filter((it: any) => it.category === c.id)
            .sort((a: any, b: any) => Number(!!b.implemented) - Number(!!a.implemented) || a.price_tdc - b.price_tdc)
          if (!items.length) return null
          return (
            <div key={c.id} id={`shop-${c.id}`} style={{ marginBottom:22, ['--accent' as any]: c.color, scrollMarginTop:56 }}>
              <div className="hx-section-title">
                <IconSVG id={c.iconId} size={16} /> {c.label.toUpperCase()}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {items.map((item: any, i: number) => {
              const price = Number(item.price_tdc) || 0
              const canAfford = hexBalance >= price
              const live = !!item.implemented
              return (
              <div key={item.code} className="hx-card shop-row hx-rise" style={{ animationDelay:`${i*40}ms`, padding:'10px 12px', opacity: live ? 1 : 0.6 }}>
                <div style={{ width:46, height:46, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background:`linear-gradient(160deg, ${c.color}30, ${c.color}0a)`, border:`2px solid ${c.color}40` }}>
                  <IconSVG id={CODE_ICON[item.code] || c.iconId} size={32} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:900, color:'#e2e8f0', letterSpacing:0.5, fontFamily:'var(--font-heading)', lineHeight:1.3 }}>
                    {String(item.name || item.code).toUpperCase()}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(226,232,240,0.7)', marginTop:4, lineHeight:1.4, textTransform:'none', fontFamily:'var(--font-body)', letterSpacing:0 }}>
                    {honestDesc(item)}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                  {live ? (<>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:15, fontWeight:900, color:'#fde68a', fontFamily:'var(--font-mono)' }}>
                      <IconSVG id="hex_coin" size={16} />{price.toLocaleString()}
                    </div>
                    <button onClick={() => handleBuy(item.name, item.code, price)}
                      className={canAfford ? 'btn-game btn-game-gold' : 'btn-game btn-game-glass'}
                      aria-label={`Buy ${item.name}`}
                      style={{ fontSize: 11, padding:'8px 16px', minHeight:36, opacity: canAfford ? 1 : 0.55 }}>
                      BUY
                    </button>
                  </>) : (
                    <span className="hx-chip" title="This effect is not in the game yet, so it can't be bought">SOON</span>
                  )}
                </div>
              </div>
            )})}
          </div>
            </div>
          )
        })}

        {/* Buy HEX CTA */}
        <div className="hx-card hx-card--accent" style={{ marginTop:8, ['--accent' as any]:'#a855f7',
          display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:'1 1 220px' }}>
            <IconSVG id="ui_wallet" size={34} />
            <div>
              <div style={{ fontSize:11, fontWeight:900, color:'#d8b4fe', fontFamily:'var(--font-heading)', letterSpacing:0.5 }}>NEED MORE HEX?</div>
              <div style={{ fontSize:11, color:'rgba(226,232,240,0.6)', marginTop:3, textTransform:'none', fontFamily:'system-ui', letterSpacing:0 }}>
                Earn HEX from territories and events, or top up from your wallet.
              </div>
            </div>
          </div>
          <button className="btn-game btn-game-purple" onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }} style={{ fontSize: 11 }}>
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
      padding:'5px 10px', borderRadius:20, fontSize: 11, fontWeight:700,
      background:'rgba(34,197,94,0.12)', border:'2px solid rgba(34,197,94,0.35)',
      color:'#4ade80', display:'flex', alignItems:'center', gap:5,
      letterSpacing:0.5, fontFamily:'var(--font-heading)',
    }}>
      {label}
      {mins != null && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:2, display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={11} /> {mins < 60 ? `${mins}min` : `${Math.ceil(mins/60)}h`}</span>}
    </div>
  )
}


/** HEX packs for real money (Stripe Checkout). The HEX Coin (crypto) side is handled in the background. */
function HexPacks() {
  const { data } = useQuery<any>({
    queryKey: ['hex-packs'],
    queryFn: () => api.get('/shop/hex-packs/').then(r => r.data),
    staleTime: 60000,
  })
  const [busy, setBusy] = useState<string | null>(null)
  if (!data) return null
  const buy = (packId: string) => {
    setBusy(packId)
    api.post('/shop/hex-checkout/', { pack_id: packId })
      .then(r => { window.location.href = r.data.url })
      .catch((e: any) => { toast.error(e?.response?.data?.error || 'Payment unavailable'); setBusy(null) })
  }
  return (
    <div id="shop-hexcoins" style={{ marginBottom: 22, ['--accent' as any]: '#f5a623' }}>
      <div className="hx-section-title">
        <IconSVG id="hex_coin" size={16} /> BUY HEX
        <span className="hx-chip hx-chip--accent">1 € = 1,000 HEX = 1 HEX COIN</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        {data.packs.map((p: any, i: number) => (
          <div key={p.id} className="hx-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, textAlign: 'center',
            borderColor: i === 2 ? '#f5a623' : undefined, background: i === 2 ? 'linear-gradient(160deg, rgba(245,166,35,0.25), transparent 70%)' : undefined }}>
            {i === 2 && <span className="hx-chip hx-chip--accent" style={{ fontSize: 10 }}>BEST VALUE</span>}
            <IconSVG id="hex_coin" size={30 + i * 4} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>{p.total.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: p.bonus ? '#86efac' : 'var(--hx-text-3)', fontWeight: 800 }}>{p.bonus ? `+${p.bonus.toLocaleString()} BONUS` : 'HEX'}</span>
            <button className="btn-game btn-game-gold" disabled={!!busy} onClick={() => buy(p.id)}
              style={{ width: '100%', minHeight: 40, fontSize: 14 }}>{busy === p.id ? '…' : `${p.eur} €`}</button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--hx-text-3)', marginTop: 8, textTransform: 'none' }}>
        {data.card_payments
          ? 'Secure card payment by Stripe. HEX are credited as soon as the payment is confirmed. Bought HEX buy territories, troops and boosts (not random packs, not cash-out).'
          : data.payments_status === 'no_library'
            ? 'Card payments are not set up on this server yet (payment library missing — admin: pip install -r backend/requirements.txt, then restart).'
            : 'Card payments are not set up on this server yet (admin: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.prod, then restart).'}
      </div>
    </div>
  )
}
