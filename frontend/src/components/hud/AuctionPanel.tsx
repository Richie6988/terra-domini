/**
 * AuctionPanel — 10 auctions a day on random rare+ place cards nobody owns (GET /api/auctions/).
 * Bids are real and escrowed in HEX (POST /api/auctions/<id>/bid/): an outbid player is refunded at once,
 * a bid in the last 2 minutes extends the auction, the winner gets the territory and its card.
 */
import { openShop } from '../shop/openShop'
import { rarityLabel } from '../../services/balance'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { TokenFace2D } from '../shared/TokenFace2D'
import { Token3DViewer, RARITY_TIER } from '../shared/Token3DViewer'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import { Clock, ChevronLeft } from 'lucide-react'
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
  h3: string
  imageSrc: string
  minBid: number
  youLead: boolean
  bids: { player: string; amount: number; at: string }[]
  status: string
  hexPerDay: number
  country: string
}

interface ChatMsg {
  user: string
  text: string
  time: string
  isBid?: boolean
  isReaction?: boolean
}

const RARITY_COLORS: Record<string, string> = {
  rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'ENDED'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}H ${m}M ${s}S`
}

export function AuctionPanel({ onClose }: Props) {
  const qc = useQueryClient()
  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ['auctions'],
    queryFn: () => api.get('/auctions/').then(r => (r.data?.auctions || []).map((l: any) => ({
      id: l.id, tokenName: l.name, tokenIcon: l.category || 'monument', rarity: l.rarity, category: l.category || 'PLACE',
      catColor: RARITY_COLORS[l.rarity] || '#3b82f6', currentBid: l.current_bid, bidCount: l.bid_count,
      topBidder: l.top_bidder || '—', endsAt: l.ends_at, edition: 'DAILY AUCTION', serial: 1, maxSupply: 1,
      h3: l.h3_index, imageSrc: l.image_url || l.satellite_url || '', minBid: l.min_bid, youLead: l.you_lead, bids: l.bids || [],
      status: l.status, hexPerDay: l.hex_per_day, country: l.country_code || '',
    }))),
    refetchInterval: 15000,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = auctions.find(a => a.id === selectedId) || null
  const setSelected = (a: Auction | null) => setSelectedId(a?.id || null)
  const [bidding, setBidding] = useState(false)
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

  const handleBid = useCallback(async () => {
    if (!selected) return
    const amt = parseInt(bidAmount) || selected.minBid
    setBidding(true)
    try {
      const r = await api.post(`/auctions/${selected.id}/bid/`, { amount: amt })
      toast.success(r.data?.message || `You lead with ${amt.toLocaleString()} HEX`)
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'bid', amount: amt }))
      setBidAmount('')
      ;['auctions', 'player', 'wallet', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    } catch (e: any) {
      const d = e?.response?.data
      toast.error(d?.error || 'Bid failed')
      if (d?.shop) { onClose(); openShop('hex') }
    } finally { setBidding(false) }
  }, [bidAmount, selected, qc, onClose])

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
            <span className="hx-chip">10 RARE CARDS A DAY</span>
            <span className="hx-chip">HEX ESCROW · OUTBID = REFUNDED</span>
          </div>

          {auctions.length === 0 && (
            <div className="hx-empty" style={{ padding: '40px 20px' }}>
              <div style={{ filter: 'drop-shadow(0 0 16px rgba(245,158,11,0.35))' }}><IconSVG id="auction_gavel" size={64} /></div>
              <div className="hx-empty__title">NO ACTIVE AUCTIONS</div>
              <div style={{ maxWidth: 380, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                10 rare place cards go under the hammer every day. Come back after midnight (UTC) for the next batch.
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
                <TokenFace2D tokenName={a.tokenName} category={a.category} iconId={a.tokenIcon} imageSrc={a.imageSrc} rarity={a.rarity}
                  tier={RARITY_TIER[a.rarity] || 'SILVER'} hexPerDay={a.hexPerDay} country={a.country} edition="AUCTION" size={72} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tokenName}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="hx-chip hx-chip--accent">{rarityLabel(a.rarity)}</span>
                    <span className="hx-chip">{a.edition}</span>
                  </div>
                  <div style={{ fontSize: 10, color: a.youLead ? '#22c55e' : 'var(--hx-text-3)', marginTop: 6 }}>
                    {a.status === 'won' ? `SOLD TO ${a.topBidder}` : a.youLead ? 'YOU LEAD' : `${a.bidCount} BIDS · TOP ${a.topBidder}`}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--hx-text-3)' }}>{a.currentBid ? 'CURRENT BID' : 'STARTS AT'}</div>
                  <div style={{ fontSize: 20, color: '#fbbf24', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconSVG id="hex_coin" size={16} />{(a.currentBid || a.minBid).toLocaleString()}
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
              <TokenFace2D tokenName={selected.tokenName} category={selected.category} iconId={selected.tokenIcon} imageSrc={selected.imageSrc}
                rarity={selected.rarity} tier={RARITY_TIER[selected.rarity] || 'SILVER'} hexPerDay={selected.hexPerDay} country={selected.country}
                edition="AUCTION" size={116} style={{ margin: '0 auto' }} />
              <div style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0', marginTop: 6, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                {selected.tokenName}
              </div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 4 }}>
                <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: RARITY_COLORS[selected.rarity] + '15', color: RARITY_COLORS[selected.rarity] }}>
                  {rarityLabel(selected.rarity)}
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
                  placeholder={`Min: ${selected.minBid.toLocaleString()}`}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12, fontWeight: 700, color: '#e2e8f0', outline: 'none',
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                />
                <button onClick={handleBid} disabled={bidding || selected.youLead || selected.status !== 'live' || countdowns[selected.id] === 'ENDED'}
                  className="btn-game btn-game-gold" style={{ padding: '10px 14px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconSVG id="hex_coin" size={14} />{bidding ? '...' : selected.youLead ? 'YOU LEAD' : `BID ${(parseInt(bidAmount) || selected.minBid).toLocaleString()}`}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 6, fontFamily: 'system-ui, sans-serif', textTransform: 'none', letterSpacing: 0 }}>
                Your bid is held in HEX; if someone outbids you, it comes straight back. The winner owns this place and its card
                (+{selected.hexPerDay.toLocaleString()} HEX/day). A bid in the last 2 minutes adds 2 minutes.
              </div>
              {selected.bids.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {selected.bids.slice(0, 5).map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: i === 0 ? '#fbbf24' : 'var(--hx-text-3)' }}>
                      <span>{b.player}</span><span style={{ fontFamily: "'Share Tech Mono', monospace" }}>{b.amount.toLocaleString()} HEX</span>
                    </div>
                  ))}
                </div>
              )}
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
          rarityKey={selected.rarity}
          imageSrc={selected.imageSrc}
          h3Index={selected.h3}
          edition={selected.edition}
        />,
        document.body
      )}
    </GlassPanel>
  )
}
