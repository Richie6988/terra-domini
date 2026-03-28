/**
 * Social System
 * Mandated by: Social Agent (Zhang Wei, Priya, Yasmine personas)
 *
 * Features:
 * - Friend system (add, online status, quick invite)
 * - Share card generator (territory captures, rank ups, daily earnings)
 * - Public player profile page
 * - Creator referral program dashboard
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Share2, Users, Copy, Check, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import type { PlayerPublic } from '../../types'

// ─── Friend System ────────────────────────────────────────────────────────────

interface Friend {
  id: string
  username: string
  display_name: string
  avatar_url: string
  commander_rank: number
  territories_owned: number
  is_online: boolean
  alliance_tag: string | null
  friendship_id: string
  since: string
}

interface FriendRequest {
  id: string
  from_player: PlayerPublic
  created_at: string
}

export function FriendPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search' | 'invite'>('friends')
  const [searchQ, setSearchQ] = useState('')
  const [copied, setCopied] = useState(false)
  const player = usePlayer()
  const qc = useQueryClient()

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/social/friends/').then(r => r.data.friends),
  })

  const { data: requests = [] } = useQuery<FriendRequest[]>({
    queryKey: ['friend-requests'],
    queryFn: () => api.get('/social/friend-requests/').then(r => r.data.requests),
    refetchInterval: 30000,
  })

  const { data: searchResults = [] } = useQuery<PlayerPublic[]>({
    queryKey: ['player-search', searchQ],
    queryFn: () => api.get(`/players/search/?q=${encodeURIComponent(searchQ)}`).then(r => r.data.results ?? []),
    enabled: searchQ.length >= 2,
  })

  const sendRequestMut = useMutation({
    mutationFn: (userId: string) => api.post('/social/friend-request/', { target_player_id: userId }),
    onSuccess: () => { toast.success('Friend request sent!'); qc.invalidateQueries({ queryKey: ['player-search'] }) },
    onError: () => toast.error('Already friends or request pending'),
  })

  const acceptMut = useMutation({
    mutationFn: (requestId: string) => api.post(`/social/friend-request/${requestId}/accept/`),
    onSuccess: () => { toast.success('Friend added! 🎉'); qc.invalidateQueries({ queryKey: ['friends', 'friend-requests'] }) },
  })

  const declineMut = useMutation({
    mutationFn: (requestId: string) => api.post(`/social/friend-request/${requestId}/decline/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
  })

  const inviteLink = `https://terradomini.io/join?ref=${player?.id}`

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const onlineFriends = friends.filter(f => f.is_online)
  const offlineFriends = friends.filter(f => !f.is_online)

  return (
    <motion.div
      initial={{ x: -360 }} animate={{ x: 0 }} exit={{ x: -360 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 340, zIndex: 1200,
        background: 'rgba(8,8,16,0.98)', backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color="#8B5CF6" />
            <span style={{ fontSize: 16, fontWeight: 500, color: '#1a2a3a' }}>Friends</span>
            {requests.length > 0 && (
              <span style={{
                background: '#EF4444', color: '#1a2a3a', fontSize: 10, fontWeight: 700,
                borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{requests.length}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(26,42,58,0.45)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {(['friends', 'requests', 'search', 'invite'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '6px 4px', fontSize: 10,
              background: tab === t ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 4, color: tab === t ? '#C084FC' : '#6B7280',
              cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.05em',
              textTransform: 'capitalize',
              position: 'relative',
            }}>
              {t}
              {t === 'requests' && requests.length > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#EF4444', borderRadius: '50%',
                  width: 12, height: 12, fontSize: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a2a3a',
                }}>{requests.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div>
            {onlineFriends.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'rgba(16,185,129,0.7)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>
                  🟢 ONLINE ({onlineFriends.length})
                </div>
                {onlineFriends.map(f => <FriendRow key={f.id} friend={f} />)}
                <div style={{ marginBottom: 16 }} />
              </>
            )}
            {offlineFriends.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>
                  ⚫ OFFLINE ({offlineFriends.length})
                </div>
                {offlineFriends.map(f => <FriendRow key={f.id} friend={f} />)}
              </>
            )}
            {friends.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>No friends yet</div>
                <div style={{ fontSize: 12 }}>Search players or share your invite link to grow your network.</div>
              </div>
            )}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                No pending requests
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} style={{
                  padding: '12px', marginBottom: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(139,92,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: '#C084FC', fontWeight: 600,
                    }}>
                      {(req.from_player?.username ?? '??').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2a3a' }}>{req.from_player.username}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Rank {req.from_player.commander_rank}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => acceptMut.mutate(req.id)} style={{
                      flex: 1, padding: '7px', background: '#059669', border: 'none',
                      borderRadius: 6, color: '#1a2a3a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Accept</button>
                    <button onClick={() => declineMut.mutate(req.id)} style={{
                      padding: '7px 12px', background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6,
                      color: '#EF4444', fontSize: 12, cursor: 'pointer',
                    }}>Decline</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div>
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search by username…"
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#1a2a3a', fontSize: 13, boxSizing: 'border-box',
              }}
            />
            {searchResults.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#00884a', fontWeight: 600, flexShrink: 0,
                }}>
                  {(p.username ?? '??').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#E5E7EB', fontWeight: 500 }}>{p.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)' }}>Rank {p.commander_rank} · {p.territories_owned} zones</div>
                </div>
                <button onClick={() => sendRequestMut.mutate(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', background: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                  color: '#C084FC', fontSize: 12, cursor: 'pointer',
                }}>
                  <UserPlus size={12} /> Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* INVITE TAB */}
        {tab === 'invite' && (
          <div>
            <div style={{
              padding: '20px', background: 'rgba(0,255,135,0.06)',
              border: '1px solid rgba(0,255,135,0.15)', borderRadius: 10, marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a', marginBottom: 8 }}>
                🎁 Referral Program
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 16 }}>
                Earn <strong style={{ color: '#00884a' }}>5% HEX Coin commission</strong> on every purchase by players you invite — for 90 days. There's no limit.
              </div>
              <div style={{
                padding: '10px 12px', background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                fontFamily: 'monospace', fontSize: 11, color: '#00884a',
                marginBottom: 10, wordBreak: 'break-all',
              }}>
                {inviteLink}
              </div>
              <button onClick={copyInvite} style={{
                width: '100%', padding: '10px', background: copied ? '#059669' : '#00FF87',
                border: 'none', borderRadius: 8, color: '#000',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Invite Link</>}
              </button>
            </div>
            <ReferralStats />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function FriendRow({ friend }: { friend: Friend }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: friend.is_online ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${friend.is_online ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: friend.is_online ? '#00FF87' : '#6B7280', fontWeight: 600,
        }}>
          {(friend.username ?? '??').slice(0, 2).toUpperCase()}
        </div>
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 9, height: 9, borderRadius: '50%',
          background: friend.is_online ? '#10B981' : '#374151',
          border: '1.5px solid rgba(8,8,16,0.98)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#E5E7EB', fontWeight: 500 }}>
          {friend.username}
          {friend.alliance_tag && <span style={{ fontSize: 10, color: '#8B5CF6', marginLeft: 6 }}>[{friend.alliance_tag}]</span>}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)' }}>Rank {friend.commander_rank} · {friend.territories_owned} zones</div>
      </div>
    </div>
  )
}

function ReferralStats() {
  const { data } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => api.get('/social/referral-stats/').then(r => r.data),
  })

  if (!data) return null

  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
        YOUR REFERRAL STATS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Players Invited', value: data.total_referrals ?? 0, color: '#8B5CF6' },
          { label: 'Active (30d)', value: data.active_referrals ?? 0, color: '#10B981' },
          { label: 'HEX Coin Earned', value: `${(data.total_commission_tdc ?? 0).toFixed(0)} HEX Coin`, color: '#FFB800' },
          { label: 'This Month', value: `${(data.this_month_tdc ?? 0).toFixed(0)} HEX Coin`, color: '#00884a' },
        ].map(stat => (
          <div key={stat.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 600, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Share Card Generator ─────────────────────────────────────────────────────

interface ShareCardProps {
  type: 'capture' | 'rank_up' | 'alliance_victory' | 'ad_revenue'
  data: {
    territory_name?: string
    from_player?: string
    new_rank?: number
    alliance_tag?: string
    tdc_earned?: number
    territory_count?: number
  }
  onClose: () => void
}

export function ShareCard({ type, data, onClose }: ShareCardProps) {
  const player = usePlayer()
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const cardConfigs = {
    capture: {
      emoji: '⚔️', color: '#EF4444',
      headline: `I just captured ${data.territory_name || 'a territory'}!`,
      sub: data.from_player ? `Taken from ${data.from_player}` : 'Expanded my empire',
      shareText: `⚔️ I just captured ${data.territory_name} in Hexod! Come fight me: terradomini.io`,
    },
    rank_up: {
      emoji: '🏆', color: '#FFB800',
      headline: `Commander Rank ${data.new_rank}!`,
      sub: 'Leveled up on Hexod',
      shareText: `🏆 I just reached Commander Rank ${data.new_rank} in Hexod! terradomini.io`,
    },
    alliance_victory: {
      emoji: '🏰', color: '#8B5CF6',
      headline: `[${data.alliance_tag}] won the Control Tower!`,
      sub: 'Alliance warfare victory',
      shareText: `🏰 My alliance [${data.alliance_tag}] just won a Control Tower battle in Hexod! terradomini.io`,
    },
    ad_revenue: {
      emoji: '🪙', color: '#FFB800',
      headline: `+${data.tdc_earned?.toFixed(0)} HEX Coin from ads today!`,
      sub: 'My territories earned real crypto',
      shareText: `🪙 My territories earned ${data.tdc_earned?.toFixed(0)} HEX Coin (≈€${((data.tdc_earned ?? 0) / 100).toFixed(2)}) from brand ads today in Hexod! terradomini.io`,
    },
  }

  const config = cardConfigs[type]

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hexod', text: config.shareText, url: 'https://terradomini.io' })
      } catch {}
    } else {
      navigator.clipboard.writeText(config.shareText)
      setCopied(true)
      toast.success('Share text copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(8px)',
        padding: 24,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* The Card itself — designed to be screenshot-worthy */}
        <div ref={cardRef} style={{
          borderRadius: 16, overflow: 'hidden',
          background: `radial-gradient(ellipse at 50% 0%, ${config.color}20 0%, rgba(5,5,8,1) 70%)`,
          border: `1px solid ${config.color}30`,
          marginBottom: 12,
        }}>
          {/* Hex pattern background */}
          <div style={{
            padding: '32px 28px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.04,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='42' viewBox='0 0 48 42' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='24,1 45,13 45,37 24,49 3,37 3,13' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: '48px 42px',
            }} />

            <div style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{config.emoji}</div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28, letterSpacing: '1px', color: '#1a2a3a', lineHeight: 1.1, marginBottom: 8,
              }}>
                {config.headline}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
                {config.sub}
              </div>

              {/* Player card */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${config.color}30`, border: `1px solid ${config.color}60`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: config.color, fontWeight: 700,
                }}>
                  {player?.username?.slice(0, 2)?.toUpperCase() ?? '??'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>{player?.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    Rank {player?.commander_rank} · {data.territory_count ?? player?.stats?.territories_owned ?? 0} zones
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, fontFamily: 'monospace', fontSize: 11, color: `${config.color}60`, letterSpacing: '0.1em' }}>
                TERRADOMINI.IO · CLAIM THE EARTH
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleShare} style={{
            flex: 1, padding: '13px',
            background: config.color, border: 'none', borderRadius: 10,
            color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Share2 size={16} />
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={onClose} style={{
            padding: '13px 20px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            color: 'rgba(26,42,58,0.6)', fontSize: 14, cursor: 'pointer',
          }}>
            Later
          </button>
        </div>
      </div>
    </motion.div>
  )
}
