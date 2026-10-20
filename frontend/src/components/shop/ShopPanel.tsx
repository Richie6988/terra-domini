/**
 * ShopPanel — Boutique complète Hexod
 *
 * Compact layout (owner 2026-10-19): balance bar → booster packs → active boosts → boosts grid (category filter)
 * → GET HEX packs at the very bottom. openShop('hex') (shop/openShop.ts) lands straight on the packs.
 * Achats one-click avec déduction HEX Coin · Ouverture de booster → BoosterOpenAnimation
 */
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useTDCBalance, usePlayer } from '../../store'
import { useKingdomStore } from '../../store/kingdomStore'
import { BoosterOpenAnimation } from './BoosterOpenAnimation'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'
import { IconSVG } from '../shared/iconBank'
import { Clock } from 'lucide-react'
import { playSound } from '../../hooks/useSound'
import { takeShopFocus } from './openShop'

const SHOP_ACCENT = '#fbbf24'

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
    desc:'3 cards: boosts & HEX\nSmall POI chance', code:'booster_standard' },
  { id:'booster_rare',      name:'EMERALD BOOSTER',     icon:'heart_purple', price:500,  color:'#8b5cf6',
    desc:'4 cards · more HEX\nBetter POI chance', code:'booster_rare' },
  { id:'booster_legendary', name:'DIAMOND BOOSTER', icon:'crown', price:1200, color:'#cc8800',
    desc:'5 cards · 1 POI guaranteed\nBig HEX, rare places', code:'booster_legendary' },
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
  booster_rare:      'Emerald Booster',
  booster_legendary: 'Diamond Booster',
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
  const [cat, setCat] = useState('all')
  const toHex = () => document.getElementById('shop-hexcoins')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  useEffect(() => { if (takeShopFocus() === 'hex') setTimeout(toHex, 350) }, [])
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
    if (bal < price) { toast.error(`Not enough HEX (need ${price.toLocaleString()}, have ${Math.floor(bal).toLocaleString()})`); toHex(); return }
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


  return (
    <>
      <GlassPanel title="SHOP" onClose={onClose} accent={SHOP_ACCENT} icon={<IconSVG id="cart" size={24} />} subtitle="Packs, boosts and HEX">
        <style>{`
          .shp-sec { display:flex; align-items:center; gap:8px; margin:16px 0 8px; font:900 11px var(--font-heading); letter-spacing:1.5px; color:rgba(226,232,240,.75); }
          .shp-sec::after { content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(255,255,255,.14), transparent); }
          .shp-packs { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
          .shp-pack { position:relative; border-radius:14px; padding:10px 8px; display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center;
            background:linear-gradient(180deg, var(--c-a), rgba(255,255,255,.02)); border:1.5px solid var(--c-b); }
          .shp-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
          .shp-item { border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:6px; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.08); }
          .shp-item__desc { font-size:10.5px; line-height:1.35; color:rgba(226,232,240,.62); text-transform:none; letter-spacing:0;
            display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; min-height:42px; }
          .shp-buy { display:flex; align-items:center; justify-content:center; gap:4px; width:100%; min-height:32px; font-size:12px; }
          .shp-chips { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
          @media (min-width: 560px) { .shp-grid { grid-template-columns:repeat(3, minmax(0,1fr)); } }
        `}</style>

        {/* Balance bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14,
          background:'linear-gradient(135deg, rgba(251,191,36,.22), rgba(251,191,36,.05))', border:'1.5px solid rgba(251,191,36,.45)' }}>
          <IconSVG id="hex_coin" size={30} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, letterSpacing:1.5, color:'rgba(255,255,255,.6)', fontWeight:800 }}>HEX BALANCE</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:22, fontWeight:900, color:'#fde68a', lineHeight:1.1 }}>{Math.floor(hexBalance).toLocaleString()}</div>
          </div>
          {activeKingdom && <span className="hx-chip" title="Boosts apply to this kingdom" style={{ color: activeKingdom.color, maxWidth: 120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <IconSVG id="castle" size={12} />{activeKingdom.name}</span>}
          <button className="btn-game btn-game-gold" style={{ fontSize:11, padding:'9px 12px', flexShrink:0 }} onClick={toHex}>GET HEX</button>
        </div>

        {/* Booster packs */}
        <div id="shop-boosters" className="shp-sec"><IconSVG id="gift" size={14} /> BOOSTER PACKS
          <span className="hx-chip" title="Packs with random content can't be bought with purchased HEX" style={{ fontSize:9 }}>EARNED HEX</span></div>
        <div className="shp-packs">
          {BOOSTERS.map(b0 => {
            const b = { ...b0, price: priceOf(b0.code, b0.price) }
            const ok = hexBalance >= b.price
            return (
              <div key={b.id} className="shp-pack" style={{ ['--c-a' as any]: `${b.color}33`, ['--c-b' as any]: `${b.color}88` }}>
                <IconSVG id={b.icon} size={38} />
                <div style={{ fontSize:10.5, fontWeight:900, color:b.color, fontFamily:'var(--font-heading)', letterSpacing:0.3, lineHeight:1.15 }}>{b.name.replace(' BOOSTER', '')}</div>
                <div style={{ fontSize:10, color:'rgba(226,232,240,.65)', textTransform:'none', letterSpacing:0, lineHeight:1.3, minHeight:26 }}>{b.desc.split('\n')[0]}</div>
                <button onClick={() => handleBuy(b.name, b.code, b.price)} className={`btn-game ${ok ? 'btn-game-gold' : 'btn-game-glass'} shp-buy`} style={{ opacity: ok ? 1 : 0.6 }}>
                  <IconSVG id="hex_coin" size={13} />{b.price.toLocaleString()}</button>
              </div>
            )
          })}
        </div>

        {/* Active boosts */}
        {activeBoosts.length > 0 && (<>
          <div className="shp-sec"><Clock size={13} /> ACTIVE</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {activeBoosts.slice(0, 6).map((b: any) => <ActiveBoostBadge key={b.id} boost={b} />)}
          </div>
        </>)}

        {/* Boosts — one grid, filtered by category */}
        <div className="shp-sec"><IconSVG id="lightning" size={14} /> BOOSTS</div>
        <div className="shp-chips">
          {[{ id:'all', label:'All', iconId:'star', color:'#e2e8f0' }, ...CATS.filter(c => c.id !== 'boosters')].map(c => (
            <button key={c.id} className="hx-chip" onClick={() => setCat(c.id)} aria-pressed={cat === c.id} style={{ cursor:'pointer', flexShrink:0,
              color: c.color, borderColor: cat === c.id ? c.color : `${c.color}33`, background: cat === c.id ? `${c.color}22` : 'transparent' }}>
              <IconSVG id={c.iconId} size={13} />{c.label}</button>
          ))}
        </div>
        {catLoading && <div className="hx-skeleton" style={{ height: 120, borderRadius: 12, marginTop: 8 }} />}
        <div className="shp-grid" style={{ marginTop: 8 }}>
          {catalog.filter((it: any) => it.implemented && it.category !== 'boosters' && CATS.some(c => c.id === it.category) && (cat === 'all' || it.category === cat))   // only what the game honours
            .sort((a: any, b: any) => Number(!!b.implemented) - Number(!!a.implemented) || a.price_tdc - b.price_tdc)
            .map((item: any) => {
              const c = CATS.find(x => x.id === item.category) || CATS[1]
              const price = Number(item.price_tdc) || 0
              const ok = hexBalance >= price
              const live = !!item.implemented
              return (
                <div key={item.code} className="shp-item" style={{ opacity: live ? 1 : 0.5, borderColor: `${c.color}33` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:34, height:34, borderRadius:10, flexShrink:0, display:'grid', placeItems:'center', background:`${c.color}22` }}>
                      <IconSVG id={CODE_ICON[item.code] || c.iconId} size={24} /></span>
                    <span style={{ fontSize:10.5, fontWeight:900, color:'#f1f5f9', fontFamily:'var(--font-heading)', letterSpacing:0.3, lineHeight:1.2 }}>
                      {String(item.name || item.code).toUpperCase()}</span>
                  </div>
                  <div className="shp-item__desc">{honestDesc(item)}</div>
                  {live
                    ? <button onClick={() => handleBuy(item.name, item.code, price)} aria-label={`Buy ${item.name}`}
                        className={`btn-game ${ok ? 'btn-game-gold' : 'btn-game-glass'} shp-buy`} style={{ opacity: ok ? 1 : 0.6 }}>
                        <IconSVG id="hex_coin" size={13} />{price.toLocaleString()}</button>
                    : <span className="hx-chip" style={{ justifyContent:'center' }} title="This effect is not in the game yet">SOON</span>}
                </div>
              )
            })}
        </div>

        {/* GET HEX — at the very bottom; openShop('hex') lands here */}
        <HexPacks />
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
    <div id="shop-hexcoins" style={{ scrollMarginTop: 12 }}>
      <div className="shp-sec"><IconSVG id="hex_coin" size={14} /> GET HEX
        <span className="hx-chip" style={{ fontSize: 9 }}>1 € = 1,000 HEX</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
        {data.packs.map((p: any, i: number) => {
          const best = i === 2
          return (
            <button key={p.id} disabled={!!busy} onClick={() => buy(p.id)} style={{ position: 'relative', cursor: 'pointer', border: 'none', padding: 0, borderRadius: 16,
              background: best ? 'linear-gradient(160deg, #fde68a, #f59e0b)' : 'linear-gradient(160deg, rgba(253,230,138,.55), rgba(245,158,11,.25))',
              boxShadow: best ? '0 0 18px rgba(245,158,11,.55)' : 'none', color: 'inherit' }}>
              <div style={{ margin: 1.5, borderRadius: 15, padding: '14px 8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'radial-gradient(circle at 50% 18%, rgba(251,191,36,.28), rgba(11,22,38,.96) 62%)' }}>
                {best && <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', padding: '2px 8px', borderRadius: 999,
                  background: '#f59e0b', color: '#1a0a00', font: "900 9px 'Nunito', sans-serif", letterSpacing: 1, whiteSpace: 'nowrap' }}>BEST VALUE</span>}
                <IconSVG id="hex_coin" size={28 + Math.min(i, 4) * 4} />
                <span style={{ font: "20px 'Lilita One', sans-serif", color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,.45)', lineHeight: 1 }}>{p.total.toLocaleString()}</span>
                <span style={{ fontSize: 9.5, fontWeight: 900, color: p.bonus ? '#86efac' : 'rgba(226,232,240,.5)', letterSpacing: 0.5, minHeight: 12 }}>
                  {p.bonus ? `+${p.bonus.toLocaleString()} BONUS` : 'HEX'}</span>
                <span style={{ marginTop: 4, width: '100%', padding: '7px 0', borderRadius: 10, background: 'linear-gradient(180deg,#fbbf24,#d97706)',
                  color: '#1a0a00', font: "900 14px 'Nunito', sans-serif", boxShadow: '0 3px 0 rgba(0,0,0,.35)' }}>{busy === p.id ? '…' : `${p.eur} €`}</span>
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--hx-text-3)', marginTop: 8, textTransform: 'none', letterSpacing: 0, lineHeight: 1.4 }}>
        {data.card_payments
          ? 'Secure card payment by Stripe, credited as soon as it is confirmed. Bought HEX buy territories, forces and boosts — not random packs, not cash-out.'
          : data.payments_status === 'no_library'
            ? 'Card payments are not set up on this server yet (payment library missing — admin: pip install -r backend/requirements.txt, then restart).'
            : 'Card payments are not set up on this server yet (admin: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.prod, then restart).'}
      </div>
    </div>
  )
}
