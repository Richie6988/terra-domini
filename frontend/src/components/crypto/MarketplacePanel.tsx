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
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#F59E0B', mythic: '#EC4899',
}
const toF = (v: unknown, d = 0) => parseFloat(String(v ?? 0)).toFixed(d)

/* ── Helpers ─────────────────────────────────────────────── */
function RarityBadge({ rarity, shiny }: { rarity: string; shiny?: boolean }) {
  const c = RARITY_C[rarity] || '#9CA3AF'
  return (
    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4,
      background: `${c}18`, color: c, border: `1px solid ${c}33`, fontWeight: 700 }}>
      {shiny ? <><EmojiIcon emoji='sparkles' size={10} /> </> : null}{rarity}
    </span>
  )
}

function PriceTag({ price }: { price: number }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B', fontFamily: 'monospace' }}>
      {price.toLocaleString()} 
    </span>
  )
}

/* ── ListingCard ─────────────────────────────────────────── */
function ListingCard({ listing, onBuy, isMine }: { listing: any; onBuy?: () => void; isMine?: boolean }) {
  const rc = RARITY_C[listing.rarity] || '#9CA3AF'
  const name = listing.poi_name || listing.h3_index?.slice(0, 12) + '…'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px',
      border: `1px solid ${rc}22`,
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
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
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>{listing.biome}</span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          By {listing.seller_username}
          {listing.status === 'sold' && <span style={{ color: '#10B981', marginLeft: 6 }}>SOLD</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <PriceTag price={listing.price_hex_coin} />
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>HEX</div>
        {onBuy && !isMine && listing.status === 'active' && (
          <button onClick={onBuy} style={{
            marginTop: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: `${rc}18`, border: `1px solid ${rc}44`, color: rc,
          }}>Buy</button>
        )}
      </div>
    </div>
  )
}

/* ── Explorer Tab ─────────────────────────────────────────── */
function ExplorerTab() {
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
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Achat échoué'),
  })

  const listings: any[] = data?.listings || []

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Annonces', value: stats.active_listings, color: '#3B82F6' },
            { label: 'Sold', value: stats.total_sold, color: '#10B981' },
            { label: 'Volume', value: `${(stats.total_volume_hex_coin||0).toLocaleString()} `, color: '#F59E0B' },
            { label: 'Prix moy.', value: `${stats.avg_list_price||0} `, color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 80px', background: 'rgba(255,255,255,0.04)',
              borderRadius: 9, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(r => (
          <button key={r} onClick={() => setRarity(r)} style={{
            padding: '4px 9px', borderRadius: 16, fontSize: 9, cursor: 'pointer', flexShrink: 0,
            background: rarity === r ? `${RARITY_C[r]||'#3B82F6'}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${rarity === r ? (RARITY_C[r]||'#3B82F6')+'55' : 'rgba(255,255,255,0.08)'}`,
            color: rarity === r ? (RARITY_C[r]||'#3B82F6') : '#6B7280', fontWeight: rarity === r ? 700 : 400,
          }}>{r || 'Tous'}</button>
        ))}
        <button onClick={() => setShiny(s => !s)} style={{
          padding: '4px 9px', borderRadius: 16, fontSize: 9, cursor: 'pointer', flexShrink: 0,
          background: shiny ? 'rgba(252,211,77,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${shiny ? 'rgba(252,211,77,0.5)' : 'rgba(255,255,255,0.08)'}`,
          color: shiny ? '#FCD34D' : '#6B7280', fontWeight: shiny ? 700 : 400,
        }}><IconSVG id="sparkles" size={10} /> Shiny</button>

        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          marginLeft: 'auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: 'rgba(255,255,255,0.04)', fontSize: 9, padding: '4px 8px', cursor: 'pointer',
        }}>
          <option value="recent">Récents</option>
          <option value="price_asc">Prix ↑</option>
          <option value="price_desc">Prix ↓</option>
          <option value="rarity">Rareté</option>
        </select>
      </div>

      {isLoading && <Spinner />}
      {!isLoading && listings.length === 0 && (
        <Empty icon="" msg="No listings yet" sub="Be the first to list a territory" />
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
      toast.success(`Annonce créée · ${res.data.seller_receives} HEX Coin vous reviendront`)
      setListingH3(null)
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] })
      qc.invalidateQueries({ queryKey: ['marketplace-mine'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur'),
  })

  const territories: any[] = data?.territories || []

  return (
    <div>
      {isLoading && <Spinner />}
      {!isLoading && territories.length === 0 && (
        <Empty icon="" msg="No territories" sub="Claim your first hex" />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {territories.map(t => {
          const rc = RARITY_C[t.rarity || 'common'] || '#9CA3AF'
          const name = t.custom_name || t.poi_name || t.h3_index?.slice(0, 12) + '…'
          const isListing = listingH3 === t.h3_index

          return (
            <div key={t.h3_index} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px',
              border: `1px solid ${rc}22`, borderLeft: `3px solid ${rc}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isListing ? 10 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <RarityBadge rarity={t.rarity || 'common'} shiny={t.is_shiny} />
                    {t.token_id && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(0,136,74,0.1)', color: '#00884a' }}>
                        NFT #{String(t.token_id).slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setListingH3(isListing ? null : t.h3_index)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: isListing ? 'rgba(239,68,68,0.1)' : `${rc}18`,
                    border: `1px solid ${isListing ? 'rgba(239,68,68,0.3)' : rc + '44'}`,
                    color: isListing ? '#F87171' : rc,
                  }}
                >
                  {isListing ? 'Annuler' : 'Vendre'}
                </button>
              </div>

              <AnimatePresence>
                {isListing && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: 6 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                        Listing price (HEX) · you receive <span style={{ color: '#10B981', fontWeight: 700 }}>
                          {(listingPrice * 0.95).toFixed(0)} HEX Coin
                        </span> (95% après royalties 5%)
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number" min={1} value={listingPrice}
                          onChange={e => setListingPrice(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{
                            flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.08)',
                            border: `1px solid ${rc}44`, borderRadius: 8, color: '#e2e8f0', fontSize: 14,
                            fontFamily: 'monospace', fontWeight: 700,
                          }}
                        />
                        <button
                          onClick={() => listMut.mutate({ h3_index: t.h3_index, price: listingPrice })}
                          disabled={listMut.isPending}
                          style={{
                            padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 800,
                            background: `linear-gradient(135deg, ${rc}cc, ${rc})`,
                            border: 'none', color: '#000',
                          }}
                        >
                          {listMut.isPending ? '…' : 'Lister'}
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
function MySalesTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-mine'],
    queryFn: () => api.get('/marketplace/listings/mine/').then(r => r.data),
    staleTime: 20000,
  })

  const delistMut = useMutation({
    mutationFn: (listing_id: string) => api.post('/marketplace/delist/', { listing_id }),
    onSuccess: () => {
      toast.success('Annonce retirée')
      qc.invalidateQueries({ queryKey: ['marketplace-mine'] })
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur'),
  })

  const active: any[] = data?.active || []
  const sold:   any[] = data?.sold   || []

  if (isLoading) return <Spinner />

  return (
    <div>
      {/* Résumé gains */}
      {(data?.total_earned || 0) > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Total gagné (après royalties)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
            {parseFloat(data.total_earned).toFixed(0)} 
          </div>
        </div>
      )}

      {/* Annonces actives */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            For sale ({active.length})
          </div>
          {active.map(l => (
            <div key={l.id} style={{ marginBottom: 8 }}>
              <ListingCard listing={l} isMine />
              <button onClick={() => delistMut.mutate(l.id)} style={{
                width: '100%', marginTop: 4, padding: '6px', borderRadius: 7, cursor: 'pointer',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#F87171', fontSize: 10,
              }}>
                Delist
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sold */}
      {sold.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Sold ({sold.length})
          </div>
          {sold.map(l => <ListingCard key={l.id} listing={l} isMine />)}
        </div>
      )}

      {active.length === 0 && sold.length === 0 && (
        <Empty icon="" msg="No sales yet" sub="List a territory from My NFTs tab" />
      )}
    </div>
  )
}

/* ── Main Panel ───────────────────────────────────────────── */
const TABS = [
  { id: 'explore', label: 'Explorer' },
  { id: 'my-nfts', label: 'Mes NFTs' },
  { id: 'my-sales', label: 'My Sales' },
]

export function MarketplacePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('explore')
  const player = usePlayer()
  const setActivePanel = useStore(s => s.setActivePanel)

  return (
    <GlassPanel title="MARKETPLACE" onClose={onClose} accent="#cc8800">
      {/* Balance */}
      {player && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12,
          padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:8,
          border:'1px solid rgba(255,255,255,0.08)' }}>
          <IconSVG id="hex_coin" size={16} />
          <span style={{ fontSize:13, fontWeight:900, color:'#7950f2', fontFamily:"'Share Tech Mono', monospace" }}>
            {parseFloat(String(player.tdc_in_game || 0)).toFixed(0)}
          </span>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginLeft:4, letterSpacing:1 }}>5% ROYALTIES · SEASON 1</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap:4, marginBottom:14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 20, cursor: 'pointer',
            fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(204,136,0,0.1)' : 'rgba(255,255,255,0.04)',
            color: tab === t.id ? '#cc8800' : 'rgba(255,255,255,0.35)',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            border: `1px solid ${tab === t.id ? 'rgba(204,136,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            style={{ paddingBottom: 40 }}>
            {tab === 'explore'&& <ExplorerTab />}
            {tab === 'my-nfts'&& <MyNFTsTab />}
            {tab === 'my-sales' && <MySalesTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Cross-panel CTA ── */}
      <div style={{ marginTop: 16, display:'flex', gap:8 }}>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('crypto'), 100) }}
          style={{
            flex:1, padding:'10px', borderRadius:20,
            background:'rgba(121,80,242,0.08)', border:'1px solid rgba(121,80,242,0.2)',
            color:'#7950f2', fontSize:7, fontWeight:700, letterSpacing:2,
            cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}
        >
          <IconSVG id="hex_coin" size={12} /> TOP UP → WALLET
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }}
          style={{
            flex:1, padding:'10px', borderRadius:20,
            background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)',
            color:'#cc8800', fontSize:7, fontWeight:700, letterSpacing:2,
            cursor:'pointer', fontFamily:"'Orbitron', system-ui, sans-serif",
          }}
        >
          <IconSVG id="cart" size={10} /> BOOSTERS → SHOP
        </button>
      </div>
    </GlassPanel>
  )
}

/* ── Utils ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: '#F59E0B', borderRadius: '50%' }} />
    </div>
  )
}
function Empty({ icon, msg, sub }: { icon: string; msg: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 20px', color: 'rgba(255,255,255,0.3)' }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{msg}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
