/**
 * AuctionPanel — Rare token auctions (eBay-style).
 * Third daily game mode: rare++ edition unique tokens.
 * Live bidding + chat + countdown timer + snipe protection.
 * Currency: HEX Coin.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { TokenHexPreview } from '../shared/TokenHexPreview'
import { Token3DViewer } from '../shared/Token3DViewer'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import { Clock, ChevronLeft, Lock } from 'lucide-react'
import { ICON_BANK } from '../shared/iconBank'
import { useStore } from '../../store'

interface Props { onClose: () => void }

interface Auction {
  id: string
  tokenName: string
  tokenIcon: string
  rarity: 'epic' | 'legendary' | 'mythic'
  category: string
  catColor: string
  currentBid: number
  bidCount: number
  topBidder: string
  endsAt: string // ISO
  edition: string
  serial: number
  maxSupply: number
}

interface ChatMsg {
  user: string
  text: string
  time: string
  isBid?: boolean
  isReaction?: boolean
}

const RARITY_COLORS: Record<string, string> = {
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

// Mock auctions
const MOCK_AUCTIONS: Auction[] = [
  {
    id: 'auc1', tokenName: 'CRIMSON DRAGON', tokenIcon: 'volcano', rarity: 'mythic',
    category: 'FANTASTIC', catColor: '#8b5cf6', currentBid: 12500, bidCount: 47,
    topBidder: 'NEXUS_LORD', endsAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    edition: 'UNIQUE', serial: 1, maxSupply: 1,
  },
  {
    id: 'auc2', tokenName: 'GOLDEN TEMPLE', tokenIcon: 'temple', rarity: 'legendary',
    category: 'PLACES', catColor: '#3b82f6', currentBid: 4200, bidCount: 23,
    topBidder: 'JADE_EMPRESS', endsAt: new Date(Date.now() + 5 * 3600000).toISOString(),
    edition: 'LIMITED', serial: 3, maxSupply: 10,
  },
  {
    id: 'auc3', tokenName: 'ANCIENT FOSSIL', tokenIcon: 'mountain', rarity: 'epic',
    category: 'NATURE', catColor: '#22c55e', currentBid: 1800, bidCount: 12,
    topBidder: 'STORM_KING', endsAt: new Date(Date.now() + 12 * 3600000).toISOString(),
    edition: 'RARE', serial: 7, maxSupply: 50,
  },
]

const MOCK_CHAT: ChatMsg[] = [
  { user: 'NEXUS_LORD', text: 'BID: 12,500 HEX', time: '2min ago', isBid: true },
  { user: 'JADE_EMPRESS', text: 'Nice try ', time: '3min ago' },
  { user: 'STORM_KING', text: 'BID: 11,000 HEX', time: '5min ago', isBid: true },
  { user: 'COMMANDER', text: 'This dragon is mine!', time: '8min ago' },
  { user: 'NEXUS_LORD', text: 'BID: 10,500 HEX', time: '12min ago', isBid: true },
]

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'ENDED'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}H ${m}M ${s}S`
}

export function AuctionPanel({ onClose }: Props) {
  const { data: auctionData } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => api.get('/marketplace/listings/?type=auction').then(r => {
      const listings = r.data?.results || r.data?.listings || []
      // Map marketplace listings to auction format
      return listings.filter((l: any) => l.auction_end).map((l: any) => ({
        id: l.id, tokenName: l.territory_name || 'Unknown Token',
        tokenIcon: l.icon_id || 'mystery', rarity: l.rarity || 'rare',
        category: l.category || 'PLACES', catColor: '#3b82f6',
        currentBid: l.current_bid || l.price || 0, bidCount: l.bid_count || 0,
        topBidder: l.top_bidder || '---', endsAt: l.auction_end,
        edition: l.edition || 'STANDARD', serial: l.serial || 1, maxSupply: l.max_supply || 1,
      }))
    }).catch(() => []),
    staleTime: 15000,
  })

  const [auctions, setAuctions] = useState<Auction[]>([])
  useEffect(() => {
    if (auctionData && auctionData.length > 0) setAuctions(auctionData)
  }, [auctionData])

  const [selected, setSelected] = useState<Auction | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [chatMsg, setChatMsg] = useState('')
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [show3D, setShow3D] = useState(false)
  const [countdowns, setCountdowns] = useState<Record<string, string>>({})
  const [wsConnected, setWsConnected] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // WebSocket connection for selected auction
  useEffect(() => {
    if (!selected) {
      wsRef.current?.close()
      wsRef.current = null
      setWsConnected(false)
      return
    }

    // Connect to auction WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const token = (window as any).__HEXOD_TOKEN__ || localStorage.getItem('hx_access') || ''
    const url = `${proto}://${window.location.host}/ws/auction/${selected.id}/?token=${token}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        setChat([{ user: 'SYSTEM', text: 'Connected to auction chat', time: 'now' }])
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'chat') {
            setChat(prev => [{ user: data.user, text: data.text, time: data.time }, ...prev])
          } else if (data.type === 'bid') {
            setChat(prev => [{
              user: data.user, text: `BID: ${data.amount.toLocaleString()} HEX`, time: data.time, isBid: true,
            }, ...prev])
          } else if (data.type === 'system') {
            setChat(prev => [{ user: 'SYSTEM', text: data.text, time: '' }, ...prev])
          } else if (data.type === 'emoji') {
            setChat(prev => [{ user: data.user, text: data.emoji, time: '', isReaction: true }, ...prev])
          }
        } catch {}
      }

      ws.onclose = () => setWsConnected(false)
      ws.onerror = () => {
        setWsConnected(false)
        // No fake messages: tell the player the live room is unreachable
        setChat([{ user: 'SYSTEM', text: 'Live chat unavailable. Messages stay on this device.', time: '' }])
      }
    } catch {
      setChat([{ user: 'SYSTEM', text: 'Live chat unavailable. Messages stay on this device.', time: '' }])
    }

    return () => { wsRef.current?.close(); wsRef.current = null }
  }, [selected?.id])

  // Update countdowns every second
  useEffect(() => {
    const update = () => {
      const cd: Record<string, string> = {}
      for (const a of auctions) cd[a.id] = formatCountdown(a.endsAt)
      setCountdowns(cd)
    }
    update()
    const i = setInterval(update, 1000)
    return () => clearInterval(i)
  }, [auctions])

  const handleBid = useCallback(() => {
    const amt = parseInt(bidAmount)
    if (!selected || !amt || amt <= selected.currentBid) {
      toast.error(`Bid must exceed ${selected?.currentBid.toLocaleString()} HEX`)
      return
    }
    // Update auction state locally (mock — real would go through WebSocket/API)
    setAuctions(prev => prev.map(a => a.id === selected.id ? {
      ...a, currentBid: amt, totalBids: a.bidCount + 1,
    } : a))
    setSelected(prev => prev ? { ...prev, currentBid: amt, totalBids: prev.bidCount + 1 } : null)
    setChat(prev => [{
      user: 'YOU', text: `BID: ${amt.toLocaleString()} HEX`, time: 'now', isBid: true,
    }, ...prev])
    toast.success(`Bid placed: ${amt.toLocaleString()} HEX`)
    setBidAmount('')
  }, [bidAmount, selected])

  const handleChat = useCallback(() => {
    if (!chatMsg.trim()) return
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat', text: chatMsg.trim() }))
    } else {
      setChat(prev => [{ user: 'YOU', text: chatMsg, time: 'now' }, ...prev])
    }
    setChatMsg('')
  }, [chatMsg])

  const sendEmoji = useCallback((emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'emoji', emoji }))
    } else {
      setChat(prev => [{ user: 'YOU', text: emoji, time: 'now', isReaction: true }, ...prev])
    }
  }, [])

  return (
    <GlassPanel title="AUCTIONS" onClose={onClose} accent="#f59e0b"
      icon={<IconSVG id="auction_gavel" size={24} />} subtitle="Rare+ unique editions · timed bidding">
      {!selected ? (
        /* ═══ AUCTION LIST ═══ */
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="hx-chip hx-chip--accent">{auctions.length} ACTIVE</span>
            <span className="hx-chip">RARE+ EDITIONS ONLY</span>
          </div>

          {auctions.length === 0 && (
            <div className="hx-empty" style={{ padding: '40px 20px' }}>
              <div style={{ filter: 'drop-shadow(0 0 16px rgba(245,158,11,0.35))' }}><IconSVG id="auction_gavel" size={64} /></div>
              <div className="hx-empty__title">NO ACTIVE AUCTIONS</div>
              <div style={{ maxWidth: 380, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                Rare, epic and legendary tokens appear here when a player lists them with an auction timer.
                Fixed-price listings live in the marketplace.
              </div>
              <button className="btn-game btn-game-gold" style={{ marginTop: 6 }}
                onClick={() => { onClose(); setTimeout(() => useStore.getState().setActivePanel('marketplace'), 100) }}>
                OPEN MARKETPLACE
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auctions.map((a, i) => {
              const rc = RARITY_COLORS[a.rarity] || '#3b82f6'
              const ended = countdowns[a.id] === 'ENDED'
              return (
              <motion.button
                key={a.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelected(a)}
                className="hx-card hx-card--interactive hx-rise"
                style={{
                  animationDelay: `${i * 40}ms`, ['--accent' as any]: rc,
                  display: 'flex', alignItems: 'center', gap: 14, borderColor: `${rc}55`,
                  textAlign: 'left', width: '100%', color: '#e2e8f0',
                }}
              >
                <TokenHexPreview iconId={a.tokenIcon} rarity={a.rarity || 'rare'} catColor={a.catColor || '#f59e0b'} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tokenName}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="hx-chip hx-chip--accent">{(a.rarity || '').toUpperCase()}</span>
                    <span className="hx-chip">{a.edition}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 6 }}>{a.bidCount} BIDS · TOP {a.topBidder}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)' }}>CURRENT BID</div>
                  <div style={{ fontSize: 20, color: '#fbbf24', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconSVG id="hex_coin" size={16} />{a.currentBid.toLocaleString()}
                  </div>
                  <span className="hx-chip" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: ended ? '#f87171' : '#38bdf8' }}>
                    <Clock size={11} /> {countdowns[a.id] || '...'}
                  </span>
                </div>
              </motion.button>
            )})}
          </div>
        </div>
      ) : (
        /* ═══ AUCTION DETAIL ═══ */
        <div>
          {/* Back button */}
          <button onClick={() => setSelected(null)} className="btn-game btn-game-glass" style={{
            padding: '8px 14px', marginBottom: 12, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}><ChevronLeft size={14} /> AUCTIONS</button>

          {/* Token + Bid area — side by side */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {/* Token card */}
            <div style={{
              flex: '0 0 140px', textAlign: 'center', padding: 12, borderRadius: 12,
              background: `linear-gradient(135deg, ${selected.catColor}10, transparent)`,
              border: `1.5px solid ${RARITY_COLORS[selected.rarity]}30`,
              cursor: 'pointer',
            }} onClick={() => setShow3D(true)}>
              <TokenHexPreview iconId={selected.tokenIcon} rarity={selected.rarity || 'rare'} catColor={selected.catColor || '#cc8800'} size={64} />
              <div style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0', marginTop: 6, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                {selected.tokenName}
              </div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 4 }}>
                <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: RARITY_COLORS[selected.rarity] + '15', color: RARITY_COLORS[selected.rarity] }}>
                  {(selected.rarity || "").toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{selected.edition}</span>
              </div>
              <div style={{ fontSize: 9, color: '#0099cc', marginTop: 4 }}>◆ TAP FOR 3D VIEW</div>
            </div>

            {/* Bid panel */}
            <div style={{ flex: '1 1 260px' }}>
              {/* Countdown */}
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 10, textAlign: 'center',
                background: countdowns[selected.id] === 'ENDED' ? 'rgba(220,38,38,0.08)' : 'rgba(0,153,204,0.06)',
                border: `1px solid ${countdowns[selected.id] === 'ENDED' ? 'rgba(220,38,38,0.2)' : 'rgba(0,153,204,0.15)'}`,
              }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                  AUCTION ENDS IN
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
                  color: countdowns[selected.id] === 'ENDED' ? '#dc2626' : '#0099cc',
                }}>
                  {countdowns[selected.id] || '...'}
                </div>
              </div>

              {/* Current bid */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                background: 'rgba(204,136,0,0.06)', border: '1px solid rgba(204,136,0,0.15)',
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', system-ui, sans-serif" }}>CURRENT BID</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconSVG id="hex_coin" size={16} />{selected.currentBid.toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', system-ui, sans-serif" }}>TOP BIDDER</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{selected.topBidder}</div>
                </div>
              </div>

              {/* Place bid */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number" value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder={`Min: ${(selected.currentBid + 100).toLocaleString()}`}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12, fontWeight: 700, color: '#e2e8f0', outline: 'none',
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                />
                {/* Bids are not persisted server-side yet (WS only broadcasts) — no fake success */}
                <button onClick={handleBid} disabled aria-disabled="true" className="btn-game btn-game-gold" style={{
                  padding: '10px 14px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Lock size={13} /> BID <span className="hx-chip" style={{ padding: '1px 6px' }}>SOON</span>
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 6, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                Bidding is not live yet: bids are not recorded on the server.
              </div>
            </div>
          </div>

          {/* Live chat */}
          <div style={{
            borderRadius: 10, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
              fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)',
              fontFamily: "'Orbitron', system-ui, sans-serif",
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>LIVE CHAT · {selected.bidCount} PARTICIPANTS</span>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: wsConnected ? '#22c55e' : '#f59e0b',
                display: 'inline-block',
              }} title={wsConnected ? 'Connected' : 'Local mode'} />
            </div>

            <div style={{ maxHeight: 150, overflowY: 'auto', padding: '8px 12px' }}>
              {chat.map((msg, i) => (
                <div key={i} style={{
                  padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 900,
                    color: msg.user === 'YOU' ? '#0099cc' : msg.user === 'SYSTEM' ? '#22c55e' : msg.isBid ? '#cc8800' : 'rgba(255,255,255,0.45)',
                    fontFamily: "'Orbitron', system-ui, sans-serif", flexShrink: 0,
                  }}>{msg.user}</span>
                  <span style={{
                    fontSize: 9, color: msg.isBid ? '#cc8800' : 'rgba(255,255,255,0.4)',
                    fontWeight: msg.isBid ? 700 : 400, flex: 1,
                  }}>{msg.isReaction && ICON_BANK[msg.text] ? <IconSVG id={msg.text} size={18} /> : msg.text}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{msg.time}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Emoji bar + chat input */}
            <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              {['flame', 'trophy', 'gem', 'hex_coin', 'swords', 'face_laugh', 'skull', 'heart_purple'].map(em => (
                <button key={em} aria-label={`React ${em}`} onClick={() => sendEmoji(em)} style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8,
                  opacity: 0.7, transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                ><IconSVG id={em} size={20} /></button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.02)' }}>
              <input
                value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder={wsConnected ? "Type a message..." : "Chat (local mode)..."}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 9, color: '#e2e8f0', outline: 'none',
                }}
              />
              <button onClick={handleChat} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.2)',
                color: '#0099cc', fontSize: 9, fontWeight: 700,
              }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Viewer via portal — outside panel DOM tree */}
      {show3D && selected && createPortal(
        <Token3DViewer
          visible={true}
          onClose={() => setShow3D(false)}
          tokenName={selected.tokenName}
          category={selected.category}
          catColor={selected.catColor}
          iconId={selected.tokenIcon}
          tier={selected.rarity === 'mythic' ? 'EMERALD' : selected.rarity === 'legendary' ? 'GOLD' : 'SILVER'}
          serial={selected.serial}
          maxSupply={selected.maxSupply}
          edition={selected.edition}
        />,
        document.body
      )}
    </GlassPanel>
  )
}
