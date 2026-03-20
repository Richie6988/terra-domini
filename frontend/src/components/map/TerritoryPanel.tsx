/**
 * TerritoryPanel — slides in from right on territory click.
 * Unclaimed : claim CTA
 * Mine      : my brand, colors, customize + revenue
 * Enemy     : owner profile + attack/buy
 * POI       : special card with rarity/bonus
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
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#FFB800', mythic:'#FF006E',
}
const RARITY_GLOW: Record<string, string> = {
  legendary:'0 0 20px #FFB80088', mythic:'0 0 24px #FF006E88',
  epic:'0 0 14px #8B5CF688', rare:'0 0 10px #3B82F688',
  uncommon:'', common:'',
}
const BIOME_EMOJI: Record<string, string> = {
  grassland:'🌿',forest:'🌲',mountain:'⛰️',coastal:'🌊',
  desert:'🏜️',tundra:'❄️',urban:'🏙️',industrial:'🏭',rural:'🌾',
}

interface Props { territory: TerritoryLight; onClose: () => void; onRequestClaim: () => void }

export function TerritoryPanel({ territory, onClose, onRequestClaim }: Props) {
  const player = usePlayer()
  const t = territory as any

  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isUnclaimed = !t.owner_id

  const rarity  = t.rarity || 'common'
  const biome   = t.biome || 'rural'
  const hasPOI  = !!(t.poi_name || t.landmark_name || t.is_landmark)
  const poiName = t.poi_name || t.landmark_name || ''
  const version = t.nft_version || 1
  const isShiny = !!t.is_shiny

  // Name: custom > POI > place > h3
  const displayName = t.custom_name || poiName || t.place_name
    || (t.h3_index || '').slice(0,10) + '…'

  // Border color: custom > rarity > default
  const borderColor = t.border_color || RARITY_COLOR[rarity] || '#10B981'

  const [tab, setTab] = useState<'info'|'customize'|'revenue'|'attack'|'buy'>(
    isOwned ? 'info' : isEnemy ? 'attack' : 'info'
  )

  const tabs = isOwned
    ? [{ id:'info', label:'🏴 Info' }, { id:'revenue', label:'💰 Revenue' }, { id:'customize', label:'🎨 Customize' }]
    : isEnemy
    ? [{ id:'info', label:'ℹ️ Info' }, { id:'attack', label:'⚔️ Attack' }, { id:'buy', label:'💸 Buy' }]
    : [{ id:'info', label:'ℹ️ Info' }]

  return (
    <motion.div
      initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
      transition={{ type:'spring', stiffness:300, damping:30 }}
      className="territory-panel"
      style={{
        position:'absolute', right:0, top:0, bottom:0, width:360,
        zIndex:1000, display:'flex', flexDirection:'column',
        background:'rgba(8,8,18,0.97)', backdropFilter:'blur(16px)',
        borderLeft:`2px solid ${borderColor}44`,
        boxShadow: RARITY_GLOW[rarity] || 'none',
      }}
    >
      {/* Header */}
      <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            {/* POI badge */}
            {hasPOI && (
              <div style={{ fontSize:10, color: RARITY_COLOR[rarity], letterSpacing:'0.1em',
                textTransform:'uppercase', marginBottom:4, fontWeight:600 }}>
                {isShiny ? '✨ Shiny ' : ''}{rarity} POI
              </div>
            )}
            <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:6 }}>
              {t.custom_emoji && <span style={{ marginRight:6 }}>{t.custom_emoji}</span>}
              {displayName}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Pill color={RARITY_COLOR[rarity]}>{rarity}</Pill>
              <Pill color="#6B7280">{BIOME_EMOJI[biome]} {biome}</Pill>
              {version > 1 && <Pill color="#8B5CF6">v{version}</Pill>}
              {isShiny && <Pill color="#FFB800">✨ shiny</Pill>}
              {hasPOI && <Pill color={RARITY_COLOR[rarity]}>📍 POI</Pill>}
              {t.is_control_tower && <Pill color="#8B5CF6">🗼 Tower</Pill>}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:6, color:'#9CA3AF', cursor:'pointer',
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
          }}><X size={16}/></button>
        </div>

        {/* Owner row */}
        <div style={{ marginTop:10, fontSize:13 }}>
          {isOwned ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background:`linear-gradient(135deg, ${borderColor}, ${borderColor}88)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, color:'#000',
              }}>{player?.username?.slice(0,2)?.toUpperCase()}</div>
              <span style={{ color:'#10B981', fontWeight:600 }}>🏴 {player?.display_name || player?.username}</span>
              <span style={{ color:'#374151', fontSize:11 }}>yours</span>
            </div>
          ) : isEnemy ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#F87171' }}>
                {(t.owner_username||'?').slice(0,2).toUpperCase()}
              </div>
              <span style={{ color:'#F87171', fontWeight:600 }}>👤 {t.owner_username}</span>
              {t.alliance_tag && <Pill color="#6B7280">[{t.alliance_tag}]</Pill>}
            </div>
          ) : (
            <span style={{ color:'#6B7280' }}>⬜ Unclaimed</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id as any)} style={{
              flex:1, padding:'9px 0', fontSize:11, fontWeight: tab===tb.id ? 600 : 400,
              color: tab===tb.id ? '#fff' : '#6B7280', background:'transparent', border:'none',
              borderBottom:`2px solid ${tab===tb.id ? borderColor : 'transparent'}`, cursor:'pointer',
            }}>{tb.label}</button>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {tab==='info'     && <InfoTab t={t} isOwned={isOwned} isUnclaimed={isUnclaimed} player={player} hasPOI={hasPOI} poiName={poiName} borderColor={borderColor} onClose={onClose} onRequestClaim={onRequestClaim} />}
        {tab==='revenue'  && isOwned && <RevenueTab t={t} />}
        {tab==='customize'&& isOwned && <CustomizeTab t={t} borderColor={borderColor} />}
        {tab==='attack'   && isEnemy && <AttackTab t={t} />}
        {tab==='buy'      && isEnemy && <BuyTab t={t} player={player} />}
      </div>
    </motion.div>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────
function InfoTab({ t, isOwned, isUnclaimed, player, hasPOI, poiName, borderColor, onClose, onRequestClaim }: any) {
  const store = useStore()

  return (
    <div>
      {/* POI special card */}
      {hasPOI && (
        <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:10,
          background:'rgba(255,184,0,0.06)', border:`1px solid ${t.rarity_color || '#FFB800'}44` }}>
          <div style={{ fontSize:12, fontWeight:700, color: t.rarity_color || '#FFB800', marginBottom:4 }}>
            📍 {poiName}
          </div>
          {t.description && <div style={{ fontSize:12, color:'#9CA3AF', lineHeight:1.5 }}>{t.description}</div>}
          {t.fun_fact && <div style={{ fontSize:11, color:'#6B7280', marginTop:6, fontStyle:'italic' }}>💡 {t.fun_fact}</div>}
          {t.wiki_url && (
            <a href={t.wiki_url} target="_blank" rel="noreferrer"
              style={{ fontSize:11, color:'#3B82F6', marginTop:4, display:'block' }}>
              📖 Learn more →
            </a>
          )}
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            {t.bonus_pct > 0 && <Pill color="#10B981">+{t.bonus_pct}% bonus</Pill>}
            {t.tdc_per_24h > 0 && <Pill color="#FFB800">+{t.tdc_per_24h} TDC/day</Pill>}
            {t.visitors_per_year > 0 && <Pill color="#6B7280">{(t.visitors_per_year/1e6).toFixed(1)}M visitors/yr</Pill>}
          </div>
        </div>
      )}

      {/* Production */}
      <Section label="Production / 5min">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {[
            { icon:'💰', label:'Credits', val: t.resource_credits || t.food_per_tick || 10 },
            { icon:'⚡', label:'Energy',  val: t.resource_energy  || 5 },
            { icon:'🌾', label:'Food',    val: t.resource_food    || 5 },
            { icon:'⚙️', label:'Mats',    val: t.resource_materials || 3 },
          ].map(r => (
            <div key={r.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
              <div style={{ fontSize:16, marginBottom:2 }}>{r.icon}</div>
              <div style={{ fontSize:12, color:'#10B981', fontWeight:600 }}>+{r.val}/tick</div>
              <div style={{ fontSize:10, color:'#4B5563' }}>{r.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Location">
        <KV label="Coordinates" value={`${(t.center_lat||0).toFixed(4)}, ${(t.center_lon||0).toFixed(4)}`} />
        {t.country_code && <KV label="Country" value={t.country_code.toUpperCase()} />}
        <KV label="H3 index" value={(t.h3_index||'').slice(0,14)+'…'} />
      </Section>

            {isUnclaimed && player && (
        <button onClick={onRequestClaim} style={{
          width:'100%', padding:14, marginTop:8,
          background:'linear-gradient(135deg,#059669,#10B981)',
          border:'none', borderRadius:10, color:'#fff',
          fontSize:14, fontWeight:700, cursor:'pointer',
        }}>{hasPOI ? `🏴 Claim ${poiName}` : '🏴 Claim this territory'}</button>
      )}
    </div>
  )
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab({ t }: any) {
  const { data } = useQuery({
    queryKey: ['terr-revenue', t.h3_index],
    queryFn: () => api.get(`/territories/${t.h3_index}/detail/`).then(r => r.data).catch(() => null),
    staleTime: 30000,
  })
  const d = data || t
  return (
    <div>
      <Section label="Daily income">
        <BigStat icon="🪙" value={`${(d.tdc_per_day || 100).toFixed(1)} TDC`} label="est. / 24h" color="#FFB800" />
        {(d.ad_revenue_today||0) > 0 && <BigStat icon="📢" value={`${d.ad_revenue_today.toFixed(1)} TDC`} label="ad revenue today" color="#F59E0B"/>}
      </Section>
      <Section label="NFT">
        <KV label="Version" value={`v${d.nft_version||1}`}/>
        <KV label="Edition" value={d.edition||'genesis'}/>
        {d.is_historically_significant && <KV label="Event" value={d.historical_event_tag||'Historic'} color="#FF006E"/>}
        {d.mint_cooldown_until && new Date(d.mint_cooldown_until)>new Date()
          ? <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(245,158,11,0.1)', borderRadius:8, fontSize:11, color:'#F59E0B' }}>
              🔒 Mint locked until {new Date(d.mint_cooldown_until).toLocaleDateString()}
            </div>
          : <button style={{ width:'100%', marginTop:8, padding:10, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:8, color:'#A78BFA', fontSize:12, cursor:'pointer', fontWeight:600 }}>
              💎 Mint NFT v{(d.nft_version||1)+1}
            </button>
        }
      </Section>
    </div>
  )
}

// ─── Customize Tab ────────────────────────────────────────────────────────────
function CustomizeTab({ t, borderColor }: any) {
  const qc = useQueryClient()
  const [name, setName] = useState(t.custom_name || '')
  const [emoji, setEmoji] = useState(t.custom_emoji || '🏴')
  const [color, setColor] = useState(borderColor || '#10B981')
  const [saving, setSaving] = useState(false)

  const EMOJIS = ['🏴','⚔️','🏰','💎','🌟','🔥','❄️','🌊','⛰️','🌿','🏛️','🎯','👑','🛡️','⚡']
  const COLORS = ['#10B981','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4','#FFB800']

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/territories-geo/customize/', {
        h3_index: t.h3_index, custom_name: name, custom_emoji: emoji, border_color: color,
      })
      toast.success('Saved! 💾')
      qc.invalidateQueries({ queryKey: ['territories'] })
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <Section label="Name">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Custom territory name…"
          style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' }}
        />
      </Section>
      <Section label="Flag emoji">
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width:36, height:36, fontSize:18, borderRadius:8, cursor:'pointer',
              background: emoji===e ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
              border:`1px solid ${emoji===e ? '#10B981' : 'transparent'}`,
            }}>{e}</button>
          ))}
        </div>
      </Section>
      <Section label="Border color">
        <div style={{ display:'flex', gap:8 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer',
              border:`3px solid ${color===c ? '#fff' : 'transparent'}`, boxSizing:'border-box',
            }}/>
          ))}
        </div>
      </Section>
      <button onClick={save} disabled={saving} style={{
        width:'100%', padding:12, marginTop:8,
        background: saving ? 'rgba(16,185,129,0.3)' : '#059669',
        border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
      }}>{saving ? 'Saving…' : '💾 Save'}</button>
    </div>
  )
}

// ─── Attack Tab ───────────────────────────────────────────────────────────────
function AttackTab({ t }: any) {
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
      <Section label="Owner stats">
        <KV label="Commander" value={t.owner_username || '?'} />
        {t.alliance_tag && <KV label="Alliance" value={`[${t.alliance_tag}]`} />}
        <KV label="Defense" value={`${(t.defense_points||100).toFixed(0)} pts`} />
        <KV label="Tier" value={`T${t.defense_tier||1}`} />
      </Section>
      <Section label="Battle type">
        {(['conquest','raid','surprise'] as const).map(bt => (
          <button key={bt} onClick={() => setType(bt)} style={{
            width:'100%', textAlign:'left', padding:'10px 12px', marginBottom:6,
            background: type===bt ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border:`1px solid ${type===bt ? '#EF4444' : 'rgba(255,255,255,0.07)'}`,
            borderRadius:8, cursor:'pointer', color: type===bt ? '#fff' : '#9CA3AF',
          }}>
            <div style={{ fontSize:13, fontWeight: type===bt ? 600 : 400 }}>
              {bt==='conquest'?'⚔️ Conquest':bt==='raid'?'💨 Raid':'⚡ Surprise'}
            </div>
            <div style={{ fontSize:10, color:'#6B7280', marginTop:2 }}>
              {bt==='conquest'?'Capture on win':bt==='raid'?'Steal resources, no capture':'Half timer, +30% ATK'}
            </div>
          </button>
        ))}
      </Section>
      <button onClick={launch} disabled={loading} style={{
        width:'100%', padding:12, background:'#DC2626', border:'none',
        borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
      }}>{loading ? 'Launching…' : `⚔️ Launch ${type}`}</button>
    </div>
  )
}

// ─── Buy Tab ──────────────────────────────────────────────────────────────────
function BuyTab({ t, player }: any) {
  const [offer, setOffer] = useState(500)
  const [loading, setLoading] = useState(false)
  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))

  const send = async () => {
    setLoading(true)
    try {
      await api.post('/territories/buy-offer/', { h3_index: t.h3_index, offer_tdc: offer })
      toast.success('💸 Offer sent!')
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Offer failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ padding:'12px 14px', background:'rgba(255,255,255,0.04)', borderRadius:10, marginBottom:16, fontSize:12, color:'#9CA3AF', lineHeight:1.6 }}>
        Send a TDC offer to <span style={{ color:'#fff', fontWeight:600 }}>{t.owner_username}</span>. They can accept or decline. Accepted offers transfer the territory instantly.
      </div>
      <Section label="Your offer">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="number" min={1} value={offer} onChange={e => setOffer(parseInt(e.target.value)||0)}
            style={{ flex:1, padding:'9px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#fff', fontSize:14 }}
          />
          <span style={{ color:'#FFB800', fontSize:13 }}>TDC</span>
        </div>
        <div style={{ fontSize:11, color:'#374151', marginTop:4 }}>
          Your balance: {tdc.toFixed(0)} TDC
        </div>
      </Section>
      <button onClick={send} disabled={loading || offer > tdc} style={{
        width:'100%', padding:12, background: offer > tdc ? 'rgba(255,255,255,0.1)' : '#D97706',
        border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor: offer > tdc ? 'not-allowed' : 'pointer',
      }}>{loading ? 'Sending…' : `💸 Offer ${offer} TDC`}</button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${color}22`, color, border:`1px solid ${color}44`, fontWeight:500 }}>{children}</span>
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:10, color:'#4B5563', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}
function KV({ label, value, color }: { label:string; value:string; color?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12 }}>
      <span style={{ color:'#6B7280' }}>{label}</span>
      <span style={{ color: color||'#E5E7EB', fontWeight:500 }}>{value}</span>
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
