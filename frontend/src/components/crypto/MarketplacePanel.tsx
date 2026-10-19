/**
 * MarketplacePanel — Hexod NFT Marketplace MVP
 *
 * Tabs:
 *    Explorer  — toutes les annonces actives (filtres rareté/biome/prix)
 *    Mes NFTs  — mes territoires mintés, mettre en vente
 *    My Sales— mes annonces actives + historique vendu
 *
 * CDC §3.5 :
 *   - Royalties 5% → trésorerie Hexod
 *   - Vendeur reçoit 95%
 *   - Paiement HEX Coin (tdc_in_game) pour V0
 */
import { rarityLabel } from '../../services/balance'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { TokenHexPreview } from '../shared/TokenHexPreview'
import toast from 'react-hot-toast'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'

const RARITY_C: Record<string, string> = {
  common: '#cd7f32', uncommon: '#cbd5e1', rare: '#fbbf24',
  epic: '#10b981', legendary: '#67e8f9', mythic: '#ec4899',
}
const toF = (v: unknown, d = 0) => parseFloat(String(v ?? 0)).toFixed(d)

/* ── Helpers ─────────────────────────────────────────────── */
function RarityBadge({ rarity, shiny }: { rarity: string; shiny?: boolean }) {
  const c = RARITY_C[rarity] || '#9CA3AF'
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${c}1c`, color: c, border: `2px solid ${c}55`, fontWeight: 700, letterSpacing:0.5 }}>
      {shiny ? <EmojiIcon emoji='sparkles' size={11} /> : null}{rarityLabel(rarity)}
    </span>
  )
}

function PriceTag({ price }: { price: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 800, color: '#fde68a', fontFamily: "'Share Tech Mono', monospace" }}>
      <IconSVG id="hex_coin" size={16} />{(price || 0).toLocaleString()}
    </span>
  )
}

/* ── ListingCard ─────────────────────────────────────────── */
function ListingCard({ listing, onBuy, isMine }: { listing: any; onBuy?: () => void; isMine?: boolean }) {
  const rc = RARITY_C[listing.rarity] || '#9CA3AF'
  const name = listing.poi_name || listing.h3_index?.slice(0, 12) + '…'
  return (
    <div style={{
      background: `linear-gradient(90deg, ${rc}14, rgba(255,255,255,0.03) 45%)`, borderRadius: 12, padding: '12px 14px',
      border: `2px solid ${rc}33`, borderLeft: `4px solid ${rc}`,
      display: 'flex', gap: 12, alignItems: 'center',
    }} className="hx-rise">
      {/* Hex token preview */}
      <TokenHexPreview
        iconId={listing.poi_category || listing.biome || 'city'}
        rarity={listing.rarity}
        catColor={rc}
        size={52}
        shiny={listing.is_shiny}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <RarityBadge rarity={listing.rarity} shiny={listing.is_shiny} />
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>{listing.biome}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          By {listing.seller_username}
          {listing.status === 'sold' && <span style={{ color: '#10B981', marginLeft: 6 }}>SOLD</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <PriceTag price={listing.price_hex_coin} />
        {onBuy && !isMine && listing.status === 'active' && (
          <button onClick={onBuy} className="btn-game btn-game-gold" style={{ display: 'block', marginTop: 8, marginLeft: 'auto', padding: '8px 16px', fontSize: 11, minHeight: 36 }}>BUY</button>
        )}
      </div>
    </div>
  )
}

/* ── Explorer Tab ─────────────────────────────────────────── */
function ExplorerTab({ onSell }: { onSell?: () => void }) {
  const [rarity, setRarity] = useState('')
  const [sort,   setSort]   = useState('recent')
  const [shiny,  setShiny]  = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-listings', rarity, sort, shiny],
    queryFn: () => {
      const params = new URLSearchParams({ sort, limit: '50' })
      if (rarity) params.set('rarity', rarity)
      if (shiny)  params.set('shiny', '1')
      return api.get(`/marketplace/listings/?${params}`).then(r => r.data)
    },
    staleTime: 15000,
  })

  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: () => api.get('/marketplace/stats/').then(r => r.data),
    staleTime: 30000,
  })

  const buyMut = useMutation({
    mutationFn: (listing_id: string) => api.post('/marketplace/buy/', { listing_id }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Territory acquired!')
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] })
      qc.invalidateQueries({ queryKey: ['player'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Purchase failed'),
  })

  const listings: any[] = data?.listings || []

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'LISTINGS', value: (stats.active_listings || 0).toLocaleString(), color: '#60a5fa', icon: 'price_tag' },
            { label: 'SOLD', value: (stats.total_sold || 0).toLocaleString(), color: '#4ade80', icon: 'handshake' },
            { label: 'VOLUME', value: (stats.total_volume_hex_coin || 0).toLocaleString(), color: '#fbbf24', icon: 'hex_coin' },
            { label: 'AVG PRICE', value: Math.round(stats.avg_list_price || 0).toLocaleString(), color: '#c4b5fd', icon: 'chart_up' },
          ].map(s => (
            <div key={s.label} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
              <IconSVG id={s.icon} size={30} />
              <div className="hx-stat">
                <span className="hx-stat__label">{s.label}</span>
                <span className="hx-stat__value" style={{ fontSize: 20, color: s.color }}>{s.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(r => {
          const c = RARITY_C[r] || '#f59e0b'
          const on = rarity === r
          return (
            <button key={r} onClick={() => setRarity(r)} className="hx-chip" aria-pressed={on} style={{
              cursor: 'pointer', minHeight: 32, padding: '5px 12px', fontSize: 11,
              background: on ? `${c}26` : undefined, borderColor: on ? `${c}88` : undefined, color: on ? c : 'rgba(226,232,240,0.7)',
            }}>
              {r && <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 4px 0 rgba(0,0,0,0.35)` }} />}
              {(r || 'All').toUpperCase()}
            </button>
          )
        })}
        <button onClick={() => setShiny(s => !s)} className="hx-chip" aria-pressed={shiny} style={{
          cursor: 'pointer', minHeight: 32, padding: '5px 12px', fontSize: 11,
          background: shiny ? 'rgba(252,211,77,0.18)' : undefined, borderColor: shiny ? 'rgba(252,211,77,0.6)' : undefined,
          color: shiny ? '#FCD34D' : 'rgba(226,232,240,0.7)',
        }}><IconSVG id="sparkles" size={14} /> SHINY</button>

        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort listings" style={{
          marginLeft: 'auto', background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.16)', colorScheme: 'dark',
          borderRadius: 10, color: '#e2e8f0', fontSize: 11, padding: '7px 10px', cursor: 'pointer', minHeight: 34,
        }}>
          <option value="recent">Recent</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="rarity">Rarity</option>
        </select>
      </div>

      {isLoading && <Spinner />}
      {!isLoading && listings.length === 0 && (
        <Empty icon="price_tag" msg="NO LISTINGS YET" sub="Be the first to list a territory" cta={onSell ? { label: 'LIST A TERRITORY', onClick: onSell } : undefined} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {listings.map(l => (
          <ListingCard key={l.id} listing={l} onBuy={() => buyMut.mutate(l.id)} />
        ))}
      </div>
    </div>
  )
}

/* ── My NFTs Tab ──────────────────────────────────────────── */
function MyNFTsTab() {
  const [listingH3,    setListingH3]    = useState<string | null>(null)
  const [listingPrice, setListingPrice] = useState(100)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-territories-nft'],
    queryFn: () => api.get('/territories-geo/mine/').then(r => r.data),
    staleTime: 30000,
  })

  const listMut = useMutation({
    mutationFn: ({ h3_index, price }: { h3_index: string; price: number }) =>
      api.post('/marketplace/list/', { h3_index, price_hex_coin: price }),
    onSuccess: (res) => {
      toast.success(`Listed · you will receive ${res.data.seller_receives} HEX Coin`)
      setListingH3(null)
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] })
      qc.invalidateQueries({ queryKey: ['marketplace-mine'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  })

  const territories: any[] = data?.territories || []

  return (
    <div>
      {isLoading && <Spinner />}
      {!isLoading && territories.length === 0 && (
        <Empty icon="castle" msg="NO TERRITORIES" sub="Claim your first hex on the map to list it here" />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {territories.map(t => {
          const rc = RARITY_C[t.rarity || 'common'] || '#9CA3AF'
          const name = t.custom_name || t.poi_name || t.h3_index?.slice(0, 12) + '…'
          const isListing = listingH3 === t.h3_index

          return (
            <div key={t.h3_index} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px',
              border: `2px solid ${rc}22`, borderLeft: `4px solid ${rc}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isListing ? 10 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <RarityBadge rarity={t.rarity || 'common'} shiny={t.is_shiny} />
                    {t.token_id && (
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(0,136,74,0.1)', color: '#00884a' }}>
                        NFT #{String(t.token_id).slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setListingH3(isListing ? null : t.h3_index)}
                  className={isListing ? 'btn-game btn-game-glass' : 'btn-game btn-game-gold'}
                  style={{ padding: '8px 16px', fontSize: 11, minHeight: 36, flexShrink: 0 }}
                >
                  {isListing ? 'CANCEL' : 'SELL'}
                </button>
              </div>

              <AnimatePresence>
                {isListing && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: 6 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
                        Listing price (HEX) · you receive <span style={{ color: '#10B981', fontWeight: 700 }}>
                          {(listingPrice * 0.95).toFixed(0)} HEX Coin
                        </span> (95% after 5% royalties)
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number" min={1} value={listingPrice}
                          onChange={e => setListingPrice(Math.max(1, parseInt(e.target.value) || 1))}
                          className="hx-input" aria-label="Listing price in HEX"
                          style={{ flex: 1, fontSize: 15, fontWeight: 700 }}
                        />
                        <button
                          onClick={() => listMut.mutate({ h3_index: t.h3_index, price: listingPrice })}
                          disabled={listMut.isPending}
                          className="btn-game btn-game-green"
                          style={{ padding: '9px 18px', fontSize: 11 }}
                        >
                          {listMut.isPending ? '…' : 'LIST'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── My Sales Tab ─────────────────────────────────────────── */
function MySalesTab({ onSell }: { onSell?: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-mine'],
    queryFn: () => api.get('/marketplace/listings/mine/').then(r => r.data),
    staleTime: 20000,
  })

  const delistMut = useMutation({
    mutationFn: (listing_id: string) => api.post('/marketplace/delist/', { listing_id }),
    onSuccess: () => {
      toast.success('Listing removed')
      qc.invalidateQueries({ queryKey: ['marketplace-mine'] })
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  })

  const active: any[] = data?.active || []
  const sold:   any[] = data?.sold   || []

  if (isLoading) return <Spinner />

  return (
    <div>
      {/* Résumé gains */}
      {(data?.total_earned || 0) > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)',
          border: '2px solid rgba(16,185,129,0.2)', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing:0.5 }}>Total earned (after royalties)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
            {parseFloat(data.total_earned).toFixed(0)} 
          </div>
        </div>
      )}

      {/* Annonces actives */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="hx-section-title">
            For sale ({active.length})
          </div>
          {active.map(l => (
            <div key={l.id} style={{ marginBottom: 8 }}>
              <ListingCard listing={l} isMine />
              <button onClick={() => delistMut.mutate(l.id)} className="btn-game btn-game-glass" style={{
                width: '100%', marginTop: 6, fontSize: 11, color: '#fca5a5', minHeight: 36,
              }}>
                DELIST
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sold */}
      {sold.length > 0 && (
        <div>
          <div className="hx-section-title">
            Sold ({sold.length})
          </div>
          {sold.map(l => <ListingCard key={l.id} listing={l} isMine />)}
        </div>
      )}

      {active.length === 0 && sold.length === 0 && (
        <Empty icon="money_bag" msg="NO SALES YET" sub="List a territory from the My NFTs tab" cta={onSell ? { label: 'GO TO MY NFTS', onClick: onSell } : undefined} />
      )}
    </div>
  )
}

/* ── Event tokens: only 10 numbered editions per event (GET/POST /api/event-cards/…) ── */
function EventTokensTab() {
  const qc = useQueryClient()
  const [prices, setPrices] = useState<Record<string, string>>({})
  const { data, isLoading } = useQuery({ queryKey: ['event-cards-market'], queryFn: () => api.get('/event-cards/market/').then(r => r.data), staleTime: 15000 })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['event-cards-market'] }); qc.invalidateQueries({ queryKey: ['player'] }) }
  const act = async (url: string, body?: any, ok?: string) => {
    try {
      const { data: r } = await api.post(url, body)
      if (r.balance != null) { const st = useStore.getState(); st.setBalance({ ...(st.balance || {}), in_game: r.balance } as any) }
      if (ok) toast.success(ok)
      refresh()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed') }
  }
  if (isLoading) return <Spinner />
  const row = (c: any, right: React.ReactNode) => {
    const rc = RARITY_C[c.rarity] || '#9CA3AF'
    return (
      <div key={c.id} className="hx-rise" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12,
        background: `linear-gradient(90deg, ${rc}14, rgba(255,255,255,0.03) 45%)`, border: `2px solid ${rc}33`, borderLeft: `4px solid ${rc}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden', position: 'relative', background: `${rc}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {c.image_url ? <img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconSVG id={c.kind || 'news'} size={30} />}
          <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: 900,
                         background: 'rgba(0,0,0,0.7)', color: '#fde68a', fontFamily: "'Share Tech Mono', monospace" }}>{c.serial}/{c.max_supply}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.headline}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <RarityBadge rarity={c.rarity} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{c.event_date} · {c.location}{c.seller && !c.mine ? ` · by ${c.seller}` : ''}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>{right}</div>
      </div>
    )
  }
  const listings = (data?.listings || []).filter((c: any) => !c.mine)
  const mine = data?.mine || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--hx-text-3)', marginBottom: 2 }}>Only 10 numbered tokens exist per real event. Win them in Events (hold the hex or get lucky in the draw), trade them here.</div>
      {listings.length === 0 && <Empty icon="news" msg="NO EVENT TOKEN ON SALE" sub="Be the first: win one in Events, then list it here." />}
      {listings.map((c: any) => row(c, <>
        <PriceTag price={c.price} />
        <button onClick={() => act(`/event-cards/${c.id}/buy/`, undefined, `Token ${c.serial}/${c.max_supply} is yours`)} className="btn-game btn-game-gold"
                style={{ display: 'block', marginTop: 8, marginLeft: 'auto', padding: '8px 16px', fontSize: 11 }}>BUY</button>
      </>))}
      {mine.length > 0 && <div style={{ fontSize: 9, letterSpacing: 1.5, fontWeight: 700, color: 'var(--hx-text-3)', marginTop: 10 }}>MY EVENT TOKENS</div>}
      {mine.map((c: any) => row(c, c.price
        ? <><PriceTag price={c.price} /><button onClick={() => act(`/event-cards/${c.id}/delist/`)} className="hx-chip" style={{ display: 'block', marginTop: 6, marginLeft: 'auto', cursor: 'pointer' }}>WITHDRAW</button></>
        : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" min={100} placeholder="Price" value={prices[c.id] || ''} onChange={e => setPrices(p => ({ ...p, [c.id]: e.target.value }))}
                   style={{ width: 90, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--hx-line)', background: 'rgba(0,0,0,0.3)', color: '#fde68a', fontFamily: "'Share Tech Mono', monospace" }} />
            <button onClick={() => act(`/event-cards/${c.id}/sell/`, { price: Number(prices[c.id]) }, 'Listed')} disabled={!prices[c.id]}
                    className="btn-game btn-game-green" style={{ padding: '8px 12px', fontSize: 10 }}>SELL</button>
          </div>))}
    </div>
  )
}

/* ── Main Panel ───────────────────────────────────────────── */
const TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'events', label: 'Event tokens' },
  { id: 'my-nfts', label: 'My NFTs' },
  { id: 'my-sales', label: 'My Sales' },
]

export function MarketplacePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('explore')
  const player = usePlayer()
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <GlassPanel title="MARKETPLACE" onClose={onClose} accent="#f59e0b" icon={<IconSVG id="auction_gavel" size={24} />} subtitle="Trade territory NFTs · 5% royalties">
      {/* Balance */}
      {player && (
        <div className="hx-card hx-card--accent" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
          <IconSVG id="hex_coin" size={28} />
          <div className="hx-stat">
            <span className="hx-stat__label">YOUR BALANCE</span>
            <span className="hx-stat__value hx-stat__value--accent" style={{ fontSize:22 }}>
              {Math.floor(parseFloat(String(player.tdc_in_game || 0)) || 0).toLocaleString()}
            </span>
          </div>
          <span className="hx-chip" style={{ marginLeft:'auto' }}>5% ROYALTIES · SEASON 1</span>
        </div>
      )}

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            style={{ paddingBottom: 40 }}>
            {tab === 'explore'&& <ExplorerTab onSell={() => setTab('my-nfts')} />}
            {tab === 'events' && <EventTokensTab />}
            {tab === 'my-nfts'&& <MyNFTsTab />}
            {tab === 'my-sales' && <MySalesTab onSell={() => setTab('my-nfts')} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Cross-panel CTA ── */}
      <div style={{ marginTop: 16, display:'flex', gap:8 }}>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }} className="btn-game btn-game-glass"
          style={{ flex:1, minHeight:42, fontSize: 11, color:'#d8b4fe', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <IconSVG id="ui_wallet" size={18} /> WALLET
        </button>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }} className="btn-game btn-game-glass"
          style={{ flex:1, minHeight:42, fontSize: 11, color:'#fde68a', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <IconSVG id="cart" size={18} /> BOOSTERS
        </button>
      </div>
    </GlassPanel>
  )
}

/* ── Utils ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true">
      {[0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 76, borderRadius: 12 }} />)}
    </div>
  )
}
function Empty({ icon, msg, sub, cta }: { icon: string; msg: string; sub: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="hx-empty">
      {icon && <IconSVG id={icon} size={48} />}
      <div className="hx-empty__title">{msg}</div>
      <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.55)', textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>{sub}</div>
      {cta && <button onClick={cta.onClick} className="btn-game btn-game-gold" style={{ marginTop: 4, fontSize: 11 }}>{cta.label}</button>}
    </div>
  )
}
