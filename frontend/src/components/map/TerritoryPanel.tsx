/**
 * TerritoryPanel — slides in from right on territory click.
 * Owned: customization + revenue tracking
 * Unclaimed: claim CTA
 * Enemy: attack panel
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, TrendingUp, Settings, Sword, MapPin, Zap, Shield } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useStore, usePlayer } from '../../store'
import { api } from '../../services/api'
import type { TerritoryLight } from '../../types'

const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#FFB800', mythic: '#FF006E',
}
const BIOME_EMOJI: Record<string, string> = {
  grassland:'🌿', forest:'🌲', mountain:'⛰️', coastal:'🌊',
  desert:'🏜️', tundra:'❄️', urban:'🏙️', industrial:'🏭',
}

interface Props { territory: TerritoryLight; onClose: () => void }

export function TerritoryPanel({ territory, onClose }: Props) {
  const player   = usePlayer()
  const isOwned  = territory.owner_id === player?.id
  const isEnemy  = !!territory.owner_id && !isOwned
  const [tab, setTab] = useState<'overview' | 'customize' | 'revenue' | 'attack'>(
    isOwned ? 'overview' : isEnemy ? 'attack' : 'overview'
  )

  const name = (territory as any).place_name
    || (territory as any).landmark_name
    || (territory.h3_index || '').slice(0, 10) + '…'
  const rarity  = (territory as any).rarity || 'common'
  const biome   = (territory as any).biome || 'grassland'
  const version = (territory as any).nft_version || 1
  const tokenId = (territory as any).token_id

  return (
    <motion.div
      initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="territory-panel"
      style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
        zIndex: 1000, background: 'rgba(8,8,18,0.97)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill color={RARITY_COLOR[rarity]}>{rarity}</Pill>
              <Pill color="#6B7280">{BIOME_EMOJI[biome]} {biome}</Pill>
              {version > 1 && <Pill color="#8B5CF6">v{version}</Pill>}
              {(territory as any).is_shiny && <Pill color="#FFB800">✨ shiny</Pill>}
              {tokenId && <Pill color="#4B5563">NFT #{tokenId}</Pill>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Owner row */}
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {isOwned
            ? <span style={{ color: '#10B981' }}>✓ Your territory</span>
            : territory.owner_id
            ? <span style={{ color: '#F87171' }}>👤 {territory.owner_username}</span>
            : <span style={{ color: '#6B7280' }}>⬜ Unclaimed — click to claim</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {(isOwned
          ? [{ id:'overview', label:'Overview' }, { id:'revenue', label:'💰 Revenue' }, { id:'customize', label:'🎨 Customize' }]
          : isEnemy
          ? [{ id:'overview', label:'Info' }, { id:'attack', label:'⚔️ Attack' }]
          : [{ id:'overview', label:'Info' }]
        ).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '9px 0', fontSize: 11, fontWeight: tab===t.id ? 600 : 400,
            color: tab===t.id ? '#fff' : '#6B7280', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab===t.id ? '#10B981' : 'transparent'}`, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'overview' && <OverviewTab territory={territory} isOwned={isOwned} player={player} />}
        {tab === 'revenue'  && isOwned && <RevenueTab territory={territory} />}
        {tab === 'customize' && isOwned && <CustomizeTab territory={territory} />}
        {tab === 'attack'   && isEnemy && <AttackTab territory={territory} player={player} />}
      </div>
    </motion.div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ territory, isOwned, player }: { territory: TerritoryLight; isOwned: boolean; player: any }) {
  const [loading, setLoading] = useState(false)
  const store = useStore()

  const handleClaim = async () => {
    setLoading(true)
    try {
      await api.post('/territories/claim/', { h3_index: territory.h3_index })
      toast.success('Territory claimed! 🏴')
      store.setSelectedTerritory({ ...territory, owner_id: player?.id, owner_username: player?.username })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Claim failed')
    } finally { setLoading(false) }
  }

  const res = territory as any
  const production = [
    { icon:'💰', label:'Credits', val: res.resource_credits || res.food_per_tick || 10 },
    { icon:'⚡', label:'Energy',  val: res.resource_energy  || 5 },
    { icon:'🌾', label:'Food',    val: res.resource_food    || 5 },
    { icon:'⚙️', label:'Mats',    val: res.resource_materials || 3 },
  ].filter(r => r.val > 0)

  return (
    <div>
      <Section label="Production / 5min">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {production.map(r => (
            <div key={r.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{r.icon}</div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>+{r.val}/tick</div>
              <div style={{ fontSize: 10, color: '#4B5563' }}>{r.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Location">
        <KV label="H3 index" value={(territory.h3_index || '').slice(0, 14) + '…'} />
        <KV label="Coordinates" value={`${(territory.center_lat||0).toFixed(4)}, ${(territory.center_lon||0).toFixed(4)}`} />
        {res.country_code && <KV label="Country" value={res.country_code.toUpperCase()} />}
      </Section>

      {!territory.owner_id && player && (
        <button onClick={handleClaim} disabled={loading} style={{
          width: '100%', padding: 14, marginTop: 8,
          background: 'linear-gradient(135deg, #059669, #10B981)', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{loading ? 'Claiming…' : '🏴 Claim this territory'}</button>
      )}
    </div>
  )
}

// ── Revenue ──────────────────────────────────────────────────────────────────
function RevenueTab({ territory }: { territory: TerritoryLight }) {
  const { data } = useQuery({
    queryKey: ['territory-revenue', territory.h3_index],
    queryFn: () => api.get(`/territories/${territory.h3_index}/detail/`).then(r => r.data).catch(() => null),
    staleTime: 30000,
  })

  const res = (data || territory) as any
  const tdc24h = res.tdc_per_day || res.food_per_tick * 288 || 100
  const adRevenue = res.ad_revenue_today || 0
  const totalEarned = res.total_tdc_earned || 0
  const nftVersion = res.nft_version || 1
  const mintCooldown = res.mint_cooldown_until
  const isHistoric = res.is_historically_significant

  return (
    <div>
      <Section label="Daily income">
        <BigStat icon="🪙" value={`${tdc24h.toFixed(1)} TDC`} label="estimated / 24h" color="#FFB800" />
        {adRevenue > 0 && <BigStat icon="📢" value={`${adRevenue.toFixed(1)} TDC`} label="ad revenue today" color="#F59E0B" />}
        {totalEarned > 0 && <BigStat icon="📈" value={`${totalEarned.toFixed(0)} TDC`} label="total earned all time" color="#10B981" />}
      </Section>

      <Section label="NFT status">
        <KV label="Version" value={`v${nftVersion}`} />
        <KV label="Edition" value={res.edition || 'genesis'} />
        {isHistoric && <KV label="Historical" value={res.historical_event_tag || 'Significant event'} color="#FF006E" />}
        {mintCooldown && new Date(mintCooldown) > new Date()
          ? <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, fontSize: 11, color: '#F59E0B' }}>
              🔒 Mint locked until {new Date(mintCooldown).toLocaleDateString()}
            </div>
          : <button style={{ width:'100%', marginTop: 8, padding: 10, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius: 8, color:'#A78BFA', fontSize: 12, cursor:'pointer', fontWeight: 600 }}>
              💎 Mint NFT v{nftVersion + 1}
            </button>
        }
      </Section>
    </div>
  )
}

// ── Customize ────────────────────────────────────────────────────────────────
function CustomizeTab({ territory }: { territory: TerritoryLight }) {
  const qc = useQueryClient()
  const [name, setName] = useState((territory as any).custom_name || '')
  const [emoji, setEmoji] = useState((territory as any).custom_emoji || '🏴')
  const [color, setColor] = useState((territory as any).border_color || '#10B981')
  const [saving, setSaving] = useState(false)

  const EMOJIS = ['🏴','⚔️','🏰','💎','🌟','🔥','❄️','🌊','⛰️','🌿','🏛️','🎯','👑','🛡️','⚡']
  const COLORS = ['#10B981','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4','#FFB800']

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/territories-geo/customize/', {
        h3_index: territory.h3_index, custom_name: name,
        custom_emoji: emoji, border_color: color,
      })
      toast.success('Saved!')
      qc.invalidateQueries({ queryKey: ['territories'] })
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <Section label="Name">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Custom territory name…"
          style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
        />
      </Section>

      <Section label="Emoji flag">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width: 36, height: 36, fontSize: 18, borderRadius: 8, cursor: 'pointer',
              background: emoji===e ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${emoji===e ? '#10B981' : 'transparent'}`,
            }}>{e}</button>
          ))}
        </div>
      </Section>

      <Section label="Border color">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
              border: `3px solid ${color===c ? '#fff' : 'transparent'}`,
              boxSizing: 'border-box',
            }} />
          ))}
        </div>
      </Section>

      <button onClick={save} disabled={saving} style={{
        width: '100%', padding: 12, marginTop: 8,
        background: saving ? 'rgba(16,185,129,0.3)' : '#059669',
        border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>{saving ? 'Saving…' : '💾 Save customization'}</button>
    </div>
  )
}

// ── Attack ────────────────────────────────────────────────────────────────────
function AttackTab({ territory, player }: { territory: TerritoryLight; player: any }) {
  const [type, setType] = useState<'conquest'|'raid'|'surprise'>('conquest')
  const [loading, setLoading] = useState(false)

  const launch = async () => {
    setLoading(true)
    try {
      await api.post('/combat/attack/', { target_h3: territory.h3_index, battle_type: type, units: {} })
      toast.success('⚔️ Attack launched!')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Attack failed')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <Section label="Target">
        <KV label="Owner" value={territory.owner_username || 'Unknown'} />
        <KV label="Defense" value={`${(territory.defense_points||100).toFixed(0)} pts`} />
      </Section>
      <Section label="Attack type">
        {(['conquest','raid','surprise'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6,
            background: type===t ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${type===t ? '#EF4444' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 8, cursor: 'pointer', color: type===t ? '#fff' : '#9CA3AF',
          }}>
            <div style={{ fontSize: 13, fontWeight: type===t ? 600 : 400 }}>
              {t==='conquest'?'⚔️ Conquest':t==='raid'?'💨 Raid':'⚡ Surprise'}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
              {t==='conquest'?'Capture territory on win':t==='raid'?'Steal resources, no capture':'Half timer, +30% ATK'}
            </div>
          </button>
        ))}
      </Section>
      <button onClick={launch} disabled={loading} style={{
        width:'100%', padding:12, background:'#DC2626', border:'none',
        borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
      }}>{loading ? 'Launching…' : `⚔️ Launch ${type}`}</button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${color}22`, color, border:`1px solid ${color}44`, fontWeight:500 }}>{children}</span>
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize:10, color:'#4B5563', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}
function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12 }}>
      <span style={{ color:'#6B7280' }}>{label}</span>
      <span style={{ color: color || '#E5E7EB', fontWeight:500 }}>{value}</span>
    </div>
  )
}
function BigStat({ icon, value, label, color }: { icon:string; value:string; label:string; color:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(255,255,255,0.04)', borderRadius:8, marginBottom:6 }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <div>
        <div style={{ fontSize:16, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
        <div style={{ fontSize:10, color:'#6B7280' }}>{label}</div>
      </div>
    </div>
  )
}
