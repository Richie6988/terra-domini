/**
 * TerritoryPanel — smart territory sheet.
 * - Unclaimed: claim CTA + POI info if present
 * - Mine: customization + revenue + branding
 * - Enemy: owner info + attack + buy offer
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, TrendingUp, Settings, Sword, ShoppingBag } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useStore, usePlayer } from '../../store'
import { api } from '../../services/api'
import type { TerritoryLight } from '../../types'

const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
  epic: '#8B5CF6', legendary: '#FFB800', mythic: '#FF006E',
}
const RARITY_BG: Record<string, string> = {
  common: '#9CA3AF22', uncommon: '#10B98122', rare: '#3B82F622',
  epic: '#8B5CF622', legendary: '#FFB80022', mythic: '#FF006E22',
}

interface Props { territory: TerritoryLight; onClose: () => void }

export function TerritoryPanel({ territory, onClose }: Props) {
  const player = usePlayer()
  const t = territory as any
  const isOwned  = t.owner_id && t.owner_id === player?.id
  const isEnemy  = t.owner_id && t.owner_id !== player?.id
  const isFree   = !t.owner_id

  const hasPOI   = !!t.poi_name
  const rarity   = t.rarity || (hasPOI ? 'uncommon' : 'common')
  const rarityColor = RARITY_COLOR[rarity] || '#9CA3AF'
  const rarityBg    = RARITY_BG[rarity]    || '#9CA3AF22'

  const name = t.custom_name || t.poi_name || t.place_name || t.landmark_name
    || (t.h3_index || '').slice(0, 10) + '…'

  const borderColor = isOwned ? (t.border_color || '#00FF87')
    : isEnemy ? '#EF4444' : '#ffffff33'

  const [tab, setTab] = useState<'info' | 'customize' | 'revenue' | 'attack' | 'buy'>(
    isOwned ? 'info' : isFree ? 'info' : 'info'
  )

  const tabs = isOwned
    ? [{ id:'info', label:'🗺️ Info' }, { id:'revenue', label:'💰 Revenue' }, { id:'customize', label:'🎨 Style' }]
    : isEnemy
    ? [{ id:'info', label:'🗺️ Info' }, { id:'attack', label:'⚔️ Attack' }, { id:'buy', label:'💸 Buy' }]
    : [{ id:'info', label:'🗺️ Info' }]

  return (
    <motion.div
      initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="territory-panel"
      style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
        zIndex: 1000, background: 'rgba(6,6,14,0.97)',
        backdropFilter: 'blur(16px)',
        borderLeft: `2px solid ${borderColor}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Territory name */}
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isOwned && (t.custom_emoji || '🏴')} {name}
            </div>
            {/* Rarity + POI badges */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <Pill bg={rarityBg} color={rarityColor}>{rarity}</Pill>
              {t.is_shiny && <Pill bg="#FFB80022" color="#FFB800">✨ shiny</Pill>}
              {hasPOI && <Pill bg={rarityBg} color={rarityColor}>{t.poi_emoji || '📍'} {t.poi_category}</Pill>}
              {t.nft_version > 1 && <Pill bg="#8B5CF622" color="#8B5CF6">v{t.nft_version}</Pill>}
              {t.token_id && <Pill bg="#4B556322" color="#6B7280">#{t.token_id}</Pill>}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#9CA3AF', cursor: 'pointer',
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><X size={15} /></button>
        </div>

        {/* Owner row */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {isOwned ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.border_color || '#00FF87' }} />
              <span style={{ fontSize: 12, color: '#10B981', fontWeight: 500 }}>Your territory</span>
            </div>
          ) : isEnemy ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#EF4444' }}>
                {(t.owner_username || '?').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#F87171', fontWeight: 600 }}>{t.owner_username}</div>
                {t.owner_color && <div style={{ fontSize: 10, color: '#6B7280' }}>{t.owner_emoji || '🏴'} {t.territory_type}</div>}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#4B5563' }}>⬜ Unclaimed</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id as any)} style={{
              flex: 1, padding: '8px 0', fontSize: 11, fontWeight: tab===tb.id ? 600 : 400,
              color: tab===tb.id ? '#fff' : '#6B7280', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab===tb.id ? rarityColor : 'transparent'}`, cursor: 'pointer',
            }}>{tb.label}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {tab === 'info' && <InfoTab territory={t} isFree={isFree} isOwned={isOwned} player={player} hasPOI={hasPOI} rarityColor={rarityColor} />}
        {tab === 'revenue'   && isOwned && <RevenueTab territory={t} rarityColor={rarityColor} />}
        {tab === 'customize' && isOwned && <CustomizeTab territory={t} />}
        {tab === 'attack'    && isEnemy && <AttackTab territory={t} />}
        {tab === 'buy'       && isEnemy && <BuyTab territory={t} player={player} />}
      </div>
    </motion.div>
  )
}

// ── Info (all states) ─────────────────────────────────────────────────────────
function InfoTab({ territory: t, isFree, isOwned, player, hasPOI, rarityColor }: any) {
  const [loading, setLoading] = useState(false)
  const store = useStore()

  const claim = async () => {
    setLoading(true)
    try {
      await api.post('/territories/claim/', { h3_index: t.h3_index })
      toast.success('Territory claimed! 🏴')
      store.setSelectedTerritory?.({ ...t, owner_id: player?.id, owner_username: player?.username })
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Claim failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* POI highlight */}
      {hasPOI && (
        <div style={{
          marginBottom: 14, padding: '12px 14px',
          background: `${RARITY_BG[t.rarity] || '#9CA3AF22'}`,
          border: `1px solid ${RARITY_COLOR[t.rarity] || '#9CA3AF'}44`,
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>{t.poi_emoji || '🏛️'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.poi_name}</div>
              <div style={{ fontSize: 11, color: RARITY_COLOR[t.rarity] || '#9CA3AF' }}>{t.poi_category} · {t.rarity}</div>
            </div>
          </div>
          {t.poi_description && <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginBottom: t.poi_fun_fact ? 6 : 0 }}>{t.poi_description}</div>}
          {t.poi_fun_fact && <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>💡 {t.poi_fun_fact}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {t.poi_floor_price && <Stat label="Floor" value={`${t.poi_floor_price} TDI`} />}
            {t.poi_visitors && <Stat label="Visitors/yr" value={`${(t.poi_visitors/1e6).toFixed(1)}M`} />}
            {t.poi_geo_score && <Stat label="Geo score" value={t.poi_geo_score} />}
          </div>
          {t.poi_wiki_url && (
            <img src={t.poi_wiki_url} alt={t.poi_name}
              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginTop: 8 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display='none' }}
            />
          )}
        </div>
      )}

      {/* Production */}
      <Section label="Production / 5min">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[['💰', 'Credits', t.resource_credits||10], ['⚡', 'Energy', t.resource_energy||5],
            ['🌾', 'Food', t.resource_food||5], ['⚙️', 'Mats', t.resource_materials||3]]
            .map(([icon, label, val]) => (
            <div key={label as string} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 16 }}>{icon}</div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>+{val}/tick</div>
              <div style={{ fontSize: 10, color: '#4B5563' }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Claim CTA */}
      {isFree && player && (
        <button onClick={claim} disabled={loading} style={{
          width: '100%', padding: 14, marginTop: 8,
          background: `linear-gradient(135deg, ${rarityColor}cc, ${rarityColor})`,
          border: 'none', borderRadius: 10, color: '#000',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>{loading ? 'Claiming…' : hasPOI ? `🏴 Claim ${t.poi_name}` : '🏴 Claim this territory'}</button>
      )}
    </div>
  )
}

// ── Revenue ───────────────────────────────────────────────────────────────────
function RevenueTab({ territory: t, rarityColor }: any) {
  const tdc24h = (t.resource_credits || 10) * 288
  return (
    <div>
      <Section label="Daily income">
        <BigStat icon="🪙" value={`${tdc24h.toFixed(0)} TDC`} label="estimated / 24h" color="#FFB800" />
        {t.poi_floor_price && <BigStat icon="💎" value={`${t.poi_floor_price} TDI`} label="NFT floor price" color={rarityColor} />}
      </Section>
      <Section label="NFT">
        <KV label="Version" value={`v${t.nft_version || 1}`} />
        <KV label="Edition" value={t.edition || 'genesis'} />
        {t.is_shiny && <KV label="Shiny" value="✨ 1/64 chance" color="#FFB800" />}
        {t.is_historically_significant && <KV label="Historic" value={t.historical_event_tag || '⚡ Significant'} color="#FF006E" />}
        {(!t.mint_cooldown_until || new Date(t.mint_cooldown_until) < new Date()) ? (
          <button style={{ width:'100%', marginTop:8, padding:10, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:8, color:'#A78BFA', fontSize:12, cursor:'pointer', fontWeight:600 }}>
            💎 Mint NFT v{(t.nft_version||1)+1}
          </button>
        ) : (
          <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(245,158,11,0.1)', borderRadius:8, fontSize:11, color:'#F59E0B' }}>
            🔒 Cooldown until {new Date(t.mint_cooldown_until).toLocaleDateString()}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Customize ─────────────────────────────────────────────────────────────────
function CustomizeTab({ territory: t }: any) {
  const qc = useQueryClient()
  const [name, setName]   = useState(t.custom_name || '')
  const [emoji, setEmoji] = useState(t.custom_emoji || '🏴')
  const [color, setColor] = useState(t.border_color || '#00FF87')
  const [saving, setSaving] = useState(false)

  const EMOJIS = ['🏴','⚔️','🏰','💎','🌟','🔥','❄️','🌊','⛰️','🌿','🏛️','🎯','👑','🛡️','⚡']
  const COLORS = ['#00FF87','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4','#FFB800']

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/territories-geo/customize/', { h3_index: t.h3_index, custom_name: name, custom_emoji: emoji, border_color: color })
      toast.success('Saved! 💾')
      qc.invalidateQueries({ queryKey: ['territories'] })
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <Section label="Name">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Custom name…"
          style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' }} />
      </Section>
      <Section label="Flag emoji">
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{ width:34, height:34, fontSize:18, borderRadius:8, cursor:'pointer', background: emoji===e ? 'rgba(0,255,135,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${emoji===e ? '#00FF87' : 'transparent'}` }}>{e}</button>
          ))}
        </div>
      </Section>
      <Section label="Border color">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer', border:`3px solid ${color===c ? '#fff' : 'transparent'}`, boxSizing:'border-box' }} />
          ))}
        </div>
      </Section>
      <button onClick={save} disabled={saving} style={{ width:'100%', padding:12, marginTop:8, background: saving ? 'rgba(16,185,129,0.3)' : '#059669', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
        {saving ? 'Saving…' : '💾 Save'}
      </button>
    </div>
  )
}

// ── Attack ────────────────────────────────────────────────────────────────────
function AttackTab({ territory: t }: any) {
  const [type, setType] = useState<'conquest'|'raid'|'surprise'>('conquest')
  const [loading, setLoading] = useState(false)

  const launch = async () => {
    setLoading(true)
    try {
      await api.post('/combat/attack/', { target_h3: t.h3_index, battle_type: type, units: {} })
      toast.success('⚔️ Attack launched!')
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Attack failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <Section label="Target">
        <KV label="Owner" value={t.owner_username} />
        <KV label="Defense" value={`${(t.defense_points||100).toFixed(0)} pts`} />
        <KV label="Territory" value={t.territory_type || 'rural'} />
      </Section>
      <Section label="Attack type">
        {(['conquest','raid','surprise'] as const).map(tp => (
          <button key={tp} onClick={() => setType(tp)} style={{
            width:'100%', textAlign:'left', padding:'10px 12px', marginBottom:6,
            background: type===tp ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border:`1px solid ${type===tp ? '#EF4444' : 'rgba(255,255,255,0.07)'}`,
            borderRadius:8, cursor:'pointer',
          }}>
            <div style={{ fontSize:13, fontWeight: type===tp ? 600 : 400, color: type===tp ? '#fff' : '#9CA3AF' }}>
              {tp==='conquest'?'⚔️ Conquest':tp==='raid'?'💨 Raid':'⚡ Surprise'}
            </div>
            <div style={{ fontSize:10, color:'#6B7280', marginTop:2 }}>
              {tp==='conquest'?'Capture on win':tp==='raid'?'Steal resources':'Half timer, +30% ATK'}
            </div>
          </button>
        ))}
      </Section>
      <button onClick={launch} disabled={loading} style={{ width:'100%', padding:12, background:'#DC2626', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
        {loading ? 'Launching…' : `⚔️ ${type}`}
      </button>
    </div>
  )
}

// ── Buy offer ─────────────────────────────────────────────────────────────────
function BuyTab({ territory: t, player }: any) {
  const [offer, setOffer] = useState(100)
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      await api.post('/territories/buy-offer/', { h3_index: t.h3_index, offer_tdc: offer })
      toast.success('Offer sent! 💸')
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed') }
    finally { setSending(false) }
  }

  const floor = t.poi_floor_price ? t.poi_floor_price * 100 : 500

  return (
    <div>
      <Section label="Buy this territory">
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          Send a TDC offer to {t.owner_username}. They can accept or decline.
        </div>
        <KV label="Your balance" value={`${parseFloat(player?.tdc_in_game||0).toFixed(0)} TDC`} />
        <KV label="Suggested floor" value={`${floor} TDC`} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Your offer (TDC)</div>
          <input type="number" value={offer} min={1} onChange={e => setOffer(parseInt(e.target.value)||1)}
            style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#fff', fontSize:15, fontWeight:600, fontFamily:'monospace', boxSizing:'border-box' }} />
        </div>
      </Section>
      <button onClick={send} disabled={sending} style={{ width:'100%', padding:12, marginTop:8, background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.4)', borderRadius:10, color:'#60A5FA', fontSize:14, fontWeight:700, cursor:'pointer' }}>
        {sending ? 'Sending…' : `💸 Offer ${offer} TDC`}
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Pill({ children, bg, color }: any) {
  return <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:bg, color, fontWeight:500 }}>{children}</span>
}
function Section({ label, children }: any) {
  return <div style={{ marginBottom:16 }}><div style={{ fontSize:10, color:'#4B5563', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{label}</div>{children}</div>
}
function KV({ label, value, color }: any) {
  return <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12 }}><span style={{ color:'#6B7280' }}>{label}</span><span style={{ color: color||'#E5E7EB', fontWeight:500 }}>{value}</span></div>
}
function BigStat({ icon, value, label, color }: any) {
  return <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'rgba(255,255,255,0.04)', borderRadius:8, marginBottom:6 }}><span style={{ fontSize:22 }}>{icon}</span><div><div style={{ fontSize:16, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div><div style={{ fontSize:10, color:'#6B7280' }}>{label}</div></div></div>
}
function Stat({ label, value }: any) {
  return <div style={{ fontSize:10, color:'#6B7280' }}>{label}: <span style={{ color:'#E5E7EB', fontWeight:600 }}>{value}</span></div>
}
