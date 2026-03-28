/**
 * TerritoryPanel — panneau contextuel territoire.
 * Hexod GDD: mine/ennemi/libre + onglets info/personnaliser/revenus/attaquer/acheter
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import toast from 'react-hot-toast'
import type { TerritoryLight } from '../../types'

const RC: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}
const BIO: Record<string,string> = {
  urban:'🏙️', rural:'🌾', forest:'🌲', mountain:'⛰️',
  coastal:'🌊', desert:'🏜️', tundra:'❄️', industrial:'🏭',
  landmark:'🏛️', grassland:'🌿',
}

interface Props { territory: TerritoryLight; onClose:()=>void; onRequestClaim:()=>void }

export function TerritoryPanel({ territory, onClose, onRequestClaim }: Props) {
  const player  = usePlayer()
  const t       = territory as any
  const isOwned = t.owner_id === player?.id
  const isEnemy = !!t.owner_id && !isOwned
  const isFree  = !t.owner_id

  const rarity = t.rarity || 'common'
  const rc     = RC[rarity] || '#9CA3AF'
  const hasPOI = !!(t.poi_name || t.is_landmark)
  const name   = t.custom_name || t.poi_name || t.place_name || t.h3_index?.slice(0,10)+'…'
  const border = t.border_color || rc

  const tabs = isOwned
    ? [{id:'info',label:'ℹ️ Info'},{id:'resources',label:'📦 Res.'},{id:'revenue',label:'💰 Rev.'},{id:'customize',label:'🎨 Style'}]
    : isEnemy
    ? [{id:'info',label:'ℹ️ Info'},{id:'attack',label:'⚔️ Attaque'},{id:'buy',label:'💸 Acheter'}]
    : [{id:'info',label:'ℹ️ Info'}]

  const [tab, setTab] = useState(isOwned ? 'info' : isEnemy ? 'attack' : 'info')

  return (
    <motion.div
      initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
      transition={{ type:'spring', stiffness:280, damping:28 }}
      className="territory-panel"
      style={{
        position:'absolute', right:0, top:0, bottom:0, width:360,
        zIndex:1000, display:'flex', flexDirection:'column',
        background:'linear-gradient(180deg, rgba(235,242,250,0.97) 0%, rgba(220,230,242,0.97) 100%)',
        borderLeft:`2px solid ${border}44`,
        boxShadow:`-6px 0 30px rgba(0,0,0,0.5), inset 0 0 0 1px ${border}11`,
      }}
    >
      {/* Header */}
      <div style={{ padding:'16px 18px 12px', flexShrink:0,
        background:`linear-gradient(135deg, ${border}14 0%, transparent 60%)`,
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            {/* Rarity + type chips */}
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
              <Chip color={rc}>{rarity}</Chip>
              <Chip color="#6B7280">{BIO[t.territory_type||'rural']} {t.territory_type||'rural'}</Chip>
              {hasPOI && <Chip color={rc}>📍 POI</Chip>}
              {t.is_shiny && <Chip color="#FCD34D">✨ Shiny</Chip>}
              {t.nft_version > 1 && <Chip color="#8B5CF6">v{t.nft_version}</Chip>}
              {t.is_control_tower && <Chip color="#8B5CF6">🗼 Tour</Chip>}
            </div>

            <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.2, marginBottom:6 }}>
              {t.custom_emoji && <span style={{ marginRight:6 }}>{t.custom_emoji}</span>}
              {name}
            </div>

            {/* Owner row */}
            {isOwned && (
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', fontSize:9, fontWeight:800,
                  background:`linear-gradient(135deg,${border},${border}88)`, display:'flex',
                  alignItems:'center', justifyContent:'center', color:'#000' }}>
                  {player?.username?.slice(0,2)?.toUpperCase()}
                </div>
                <span style={{ fontSize:11, color:'#10B981', fontWeight:700 }}>
                  {player?.display_name || player?.username}
                </span>
                <span style={{ fontSize:10, color:'#374151' }}>· votre zone</span>
              </div>
            )}
            {isEnemy && (
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(239,68,68,0.2)',
                  border:'1px solid rgba(239,68,68,0.4)', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:9, fontWeight:800, color:'#F87171' }}>
                  {(t.owner_username||'?').slice(0,2).toUpperCase()}
                </div>
                <span style={{ fontSize:11, color:'#F87171', fontWeight:700 }}>{t.owner_username}</span>
                {t.alliance_tag && <Chip color="#6B7280">[{t.alliance_tag}]</Chip>}
              </div>
            )}
            {isFree && <span style={{ fontSize:11, color:'#4B5563' }}>⬜ Zone libre</span>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#9CA3AF',
            cursor:'pointer', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex:1, padding:'8px 0', fontSize:10, fontWeight:tab===tb.id ? 700 : 400,
            color:tab===tb.id ? '#fff' : '#6B7280', background:'transparent', border:'none',
            borderBottom:`2px solid ${tab===tb.id ? border : 'transparent'}`, cursor:'pointer',
          }}>{tb.label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }} transition={{ duration:0.12 }}
            style={{ padding:'14px 18px', paddingBottom:80 }}
          >
            {tab==='info'      && <InfoTab t={t} isFree={isFree} isOwned={isOwned} player={player} hasPOI={hasPOI} rc={rc} onRequestClaim={onRequestClaim} />}
            {tab==='resources' && isOwned && <ResourcesTab t={t} />}
            {tab==='revenue'   && isOwned && <RevenueTab t={t} rc={rc} />}
            {tab==='customize' && isOwned && <CustomizeTab t={t} border={border} />}
            {tab==='attack'    && isEnemy && <AttackTab t={t} />}
            {tab==='buy'       && isEnemy && <BuyTab t={t} player={player} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ── Info ──────────────────────────────────────────────────── */
function InfoTab({ t, isFree, isOwned, player, hasPOI, rc, onRequestClaim }: any) {
  return (
    <div>
      {/* POI block */}
      {hasPOI && (
        <div style={{ marginBottom:14, padding:'12px 13px', borderRadius:10,
          background:`${rc}0d`, border:`1px solid ${rc}33` }}>
          {false && t.poi_wiki_url && (
            <img src={t.poi_wiki_url} alt={t.poi_name}
              style={{ width:'100%', height:100, objectFit:'cover', borderRadius:7, marginBottom:8 }}
              onError={e => { (e.target as HTMLImageElement).style.display='none' }}
            />
          )}
          <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:4 }}>
            {t.poi_emoji || '📍'} {t.poi_name}
          </div>
          {t.poi_category && (
            <div style={{ fontSize:9, color:rc, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
              {t.poi_category}
            </div>
          )}
          {t.poi_description && (
            <div style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.55, marginBottom:6 }}>
              {t.poi_description.slice(0,120)}{t.poi_description.length>120?'…':''}
            </div>
          )}
          {t.poi_fun_fact && (
            <div style={{ fontSize:10, color:'#6B7280', fontStyle:'italic', marginBottom:6 }}>
              💡 {t.poi_fun_fact.slice(0,80)}
            </div>
          )}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {t.poi_floor_price && <MiniStat label="Floor NFT" val={`${t.poi_floor_price} HEX`} color={rc} />}
            {t.poi_visitors && <MiniStat label="Visiteurs" val={`${(t.poi_visitors/1e6).toFixed(1)}M/an`} color="#10B981" />}
            {t.poi_geo_score && <MiniStat label="Géo score" val={t.poi_geo_score} color="#3B82F6" />}
          </div>
        </div>
      )}

      {/* Production */}
      <Sec label="Production / cycle">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
          {[
            {icon:'💠',label:'Cristaux',val:t.resource_credits||t.food_per_tick||10,c:'#F59E0B'},
            {icon:'⚡',label:'Énergie',  val:t.resource_energy||5,c:'#3B82F6'},
            {icon:'🌾',label:'Nourriture',val:t.resource_food||5,c:'#10B981'},
            {icon:'⚙️',label:'Matériaux',val:t.resource_materials||3,c:'#6B7280'},
            {icon:'📊',label:'Données',  val:t.resource_intel||2,c:'#8B5CF6'},
            {icon:'🛡️',label:'Défense',  val:t.defense_tier||1,c:'#EF4444'},
          ].map(r => (
            <div key={r.label} style={{ background:'rgba(255,255,255,0.04)', borderRadius:7, padding:'7px 8px', textAlign:'center' }}>
              <div style={{ fontSize:13 }}>{r.icon}</div>
              <div style={{ fontSize:11, fontWeight:800, color:r.c, fontFamily:'monospace' }}>+{r.val}</div>
              <div style={{ fontSize:8, color:'#4B5563', marginTop:1 }}>{r.label}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* Localisation */}
      <Sec label="Localisation">
        <KV label="H3 index" val={(t.h3_index||'').slice(0,16)+'…'} />
        <KV label="Coordonnées" val={`${(t.center_lat||0).toFixed(4)}, ${(t.center_lon||0).toFixed(4)}`} />
        {t.country_code && <KV label="Pays" val={t.country_code.toUpperCase()} />}
        {t.is_connected && <KV label="Cluster" val="✅ Connecté (+bonus)" color="#10B981" />}
      </Sec>

      {isFree && player && (
        <button onClick={onRequestClaim} style={{
          width:'100%', padding:'13px', border:'none', borderRadius:10, cursor:'pointer',
          background:`linear-gradient(135deg, ${rc}cc, ${rc})`,
          color: ['legendary','mythic','epic'].includes(t.rarity||'common') ? '#000':'#fff',
          fontSize:14, fontWeight:900,
        }}>
          🏴 {hasPOI ? `Revendiquer ${(t.poi_name||'').slice(0,20)}` : 'Revendiquer ce territoire'}
        </button>
      )}
    </div>
  )
}

/* ── Resources breakdown ───────────────────────────────────── */
const HEXOD_RES = [
  {key:'res_fer',label:'Fer',icon:'🪨'},{key:'res_petrole',label:'Pétrole',icon:'🛢️'},
  {key:'res_silicium',label:'Silicium',icon:'💠'},{key:'res_donnees',label:'Données',icon:'📊'},
  {key:'res_uranium',label:'Uranium',icon:'☢️'},{key:'res_hex_HEX Coin',label:'HEX Coin',icon:'💎'},
  {key:'res_influence',label:'Influence',icon:'🌐'},{key:'res_stabilite',label:'Stabilité',icon:'⚖️'},
]

function ResourcesTab({ t }: any) {
  return (
    <div>
      <Sec label="Ressources produites par ce territoire">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {HEXOD_RES.map(r => {
            const val = parseFloat(t[r.key]||0)
            return (
              <div key={r.key} style={{
                background: val > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                borderRadius:8, padding:'8px 10px',
                border:`1px solid ${val > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                opacity: val > 0 ? 1 : 0.4,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <span style={{ fontSize:14 }}>{r.icon}</span>
                  <span style={{ fontSize:10, color:'#9CA3AF' }}>{r.label}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:800, color: val > 0 ? '#F59E0B' : '#374151', fontFamily:'monospace' }}>
                  {val > 0 ? `+${val.toFixed(r.key==='res_hex_HEX Coin'?3:1)}/jour` : '—'}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop:10, fontSize:10, color:'#374151', lineHeight:1.5 }}>
          Les ressources de ce territoire alimentent votre stockpile global.
          Débloquez des compétences pour augmenter la production.
        </div>
      </Sec>
    </div>
  )
}

/* ── Revenue ───────────────────────────────────────────────── */
function RevenueTab({ t, rc }: any) {
  const income24h = (parseFloat(t.resource_credits||t.food_per_tick||10)) * 288
  return (
    <div>
      <Sec label="Revenus estimés">
        <BigStat icon="💠" val={`${income24h.toFixed(0)} HEX Coin`} label="estimé / 24h" color="#F59E0B" />
        {t.poi_floor_price && <BigStat icon="💎" val={`${t.poi_floor_price} HEX`} label="Floor NFT" color={rc} />}
        {t.ad_revenue_today > 0 && <BigStat icon="📢" val={`${t.ad_revenue_today} HEX Coin`} label="Revenus pub aujourd'hui" color="#F59E0B" />}
      </Sec>
      <Sec label="NFT">
        <KV label="Version" val={`Édition v${t.nft_version||1}`} />
        <KV label="Token" val={t.token_id ? `#${t.token_id}` : 'Non minté'} />
        {t.is_shiny && <KV label="Shiny" val="✨ 1/64 — Rarissime" color="#FCD34D" />}
        {(!t.mint_cooldown_until || new Date(t.mint_cooldown_until) < new Date()) ? (
          <button style={{ width:'100%', marginTop:10, padding:'10px',
            background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)',
            borderRadius:8, color:'#A78BFA', fontSize:12, cursor:'pointer', fontWeight:700 }}>
            💎 Minter NFT v{(t.nft_version||1)+1}
          </button>
        ) : (
          <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(245,158,11,0.1)',
            borderRadius:8, fontSize:11, color:'#F59E0B' }}>
            🔒 Mint bloqué jusqu'au {new Date(t.mint_cooldown_until).toLocaleDateString('fr-FR')}
          </div>
        )}
      </Sec>
    </div>
  )
}

/* ── Customize ─────────────────────────────────────────────── */
function CustomizeTab({ t, border }: any) {
  const qc = useQueryClient()
  const [name,  setName ] = useState(t.custom_name || '')
  const [emoji, setEmoji] = useState(t.custom_emoji || '🏴')
  const [color, setColor] = useState(border || '#10B981')
  const [fill,  setFill ] = useState(t.fill_color || '#10B98122')
  const [saving, setSaving] = useState(false)

  const EMOJIS = ['🏴','⚔️','🏰','💎','🌟','🔥','❄️','🌊','⛰️','🌿','🏛️','🎯','👑','🛡️','⚡',
                  '🔬','💰','🌐','🤝','🚀','🛸','🏟️','🗿','🎭','🎪']
  const COLORS = [
    '#10B981','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899',
    '#06B6D4','#F97316','#84CC16','#FBBF24','#A855F7','#14B8A6',
  ]

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/territories-geo/customize/', {
        h3_index: t.h3_index, custom_name: name,
        flag_emoji: emoji, border_color: color, fill_color: fill,
      })
      toast.success('Style sauvegardé! 🎨')
      qc.invalidateQueries({ queryKey: ['my-territories'] })
    } catch { toast.error('Échec de la sauvegarde') }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* Preview */}
      <div style={{ marginBottom:14, padding:'12px', borderRadius:10,
        background: `${color}14`, border:`2px solid ${color}44`, textAlign:'center' }}>
        <span style={{ fontSize:28, marginRight:8 }}>{emoji}</span>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{name || t.poi_name || t.place_name || 'Mon territoire'}</span>
        <div style={{ fontSize:10, color, marginTop:3, textTransform:'uppercase', letterSpacing:'0.1em' }}>
          Aperçu du style
        </div>
      </div>

      <Sec label="Nom personnalisé">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t.poi_name || t.place_name || 'Nom de votre territoire…'}
          style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', borderRadius:9, color:'#fff',
            fontSize:14, boxSizing:'border-box' }} />
      </Sec>

      <Sec label="Drapeau">
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width:38, height:38, fontSize:18, borderRadius:8, cursor:'pointer',
              background: emoji===e ? `${color}22` : 'rgba(255,255,255,0.05)',
              border:`2px solid ${emoji===e ? color : 'transparent'}`,
              transition:'all 0.15s',
            }}>{e}</button>
          ))}
        </div>
      </Sec>

      <Sec label="Couleur de bordure">
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width:30, height:30, borderRadius:'50%', background:c, cursor:'pointer',
              border:`3px solid ${color===c ? '#fff' : 'transparent'}`,
              boxSizing:'border-box', boxShadow: color===c ? `0 0 0 1px ${c}` : 'none',
              transition:'all 0.15s',
            }} />
          ))}
        </div>
      </Sec>

      <button onClick={save} disabled={saving} style={{
        width:'100%', padding:'13px', border:'none', borderRadius:10, cursor:'pointer',
        background: saving ? 'rgba(16,185,129,0.3)' : `linear-gradient(135deg, ${color}cc, ${color})`,
        color:'#000', fontSize:14, fontWeight:900, marginTop:4,
      }}>{saving ? 'Sauvegarde…' : '💾 Appliquer le style'}</button>
    </div>
  )
}

/* ── Attack ────────────────────────────────────────────────── */
function AttackTab({ t }: any) {
  const [type, setType] = useState<'conquest'|'raid'|'surprise'>('conquest')
  const [loading, setLoading] = useState(false)

  const TYPES: [string,string,string,string][] = [
    ['conquest','⚔️ Conquête','Capture si victoire','#EF4444'],
    ['raid','💨 Raid','Vol de ressources, pas de capture','#F59E0B'],
    ['surprise','⚡ Frappe surprise','Timer ÷2, ATK +30%','#8B5CF6'],
  ]

  const launch = async () => {
    setLoading(true)
    try {
      await api.post('/combat/attack/', { target_h3: t.h3_index, battle_type: type, units: {} })
      toast.success('⚔️ Attaque lancée!')
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Attaque échouée') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <Sec label="Informations défenseur">
        <KV label="Commandant"  val={t.owner_username || '?'} />
        {t.alliance_tag && <KV label="Alliance" val={`[${t.alliance_tag}]`} />}
        <KV label="Points de défense" val={`${(t.defense_points||100).toFixed(0)} pts`} />
        <KV label="Tier défense"      val={`Tier ${t.defense_tier||1}`} />
        {t.fortification_level > 0 && <KV label="Fortifications" val={`Niveau ${t.fortification_level}`} color="#EF4444" />}
      </Sec>

      <Sec label="Type d'attaque">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {TYPES.map(([id,label,desc,c]) => (
            <button key={id} onClick={() => setType(id as any)} style={{
              padding:'10px 12px', borderRadius:9, cursor:'pointer', textAlign:'left',
              background: type===id ? `${c}14` : 'rgba(255,255,255,0.04)',
              border:`1px solid ${type===id ? c+'55' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div style={{ fontSize:12, fontWeight:700, color: type===id ? c : '#9CA3AF' }}>{label}</div>
              <div style={{ fontSize:10, color:'#6B7280', marginTop:2 }}>{desc}</div>
            </button>
          ))}
        </div>
      </Sec>

      <button onClick={launch} disabled={loading} style={{
        width:'100%', padding:'13px', background:'#DC2626', border:'none',
        borderRadius:10, color:'#fff', fontSize:14, fontWeight:900, cursor:'pointer',
      }}>{loading ? 'Lancement…' : '⚔️ Lancer l\'attaque'}</button>
    </div>
  )
}

/* ── Buy ───────────────────────────────────────────────────── */
function BuyTab({ t, player }: any) {
  const [offer, setOffer] = useState(t.poi_floor_price ? Math.round(t.poi_floor_price * 50) : 500)
  const [loading, setLoading] = useState(false)
  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))
  const floor = t.poi_floor_price ? t.poi_floor_price * 50 : 500

  const send = async () => {
    setLoading(true)
    try {
      await api.post('/territories/buy-offer/', { h3_index: t.h3_index, offer_tdc: offer })
      toast.success('💸 Offre envoyée!')
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Échec') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ padding:'12px 13px', background:'rgba(59,130,246,0.08)',
        borderRadius:10, border:'1px solid rgba(59,130,246,0.2)', marginBottom:14,
        fontSize:12, color:'#9CA3AF', lineHeight:1.6 }}>
        Envoyez une offre en HEX Coin à <strong style={{ color:'#fff' }}>{t.owner_username}</strong>.
        Ils peuvent accepter ou refuser. Un accord transfère le territoire instantanément.
      </div>

      <Sec label="Votre offre">
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          {[floor, floor*1.5, floor*2].map(v => (
            <button key={v} onClick={() => setOffer(Math.round(v))} style={{
              flex:1, padding:'7px', fontSize:10, borderRadius:7, cursor:'pointer',
              background: Math.abs(offer-v)<1 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
              border:`1px solid ${Math.abs(offer-v)<1 ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: Math.abs(offer-v)<1 ? '#60A5FA' : '#6B7280', fontWeight: 700,
            }}>
              {Math.round(v)}
            </button>
          ))}
        </div>
        <input type="number" min={1} value={offer} onChange={e => setOffer(parseInt(e.target.value)||0)}
          style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', borderRadius:9, color:'#fff',
            fontSize:16, fontFamily:'monospace', fontWeight:800, boxSizing:'border-box' }} />
        <div style={{ fontSize:10, color:'#374151', marginTop:4 }}>
          Votre balance: {tdc.toFixed(0)} HEX Coin ·
          Plancher suggéré: {Math.round(floor)} HEX Coin
        </div>
      </Sec>

      <button onClick={send} disabled={loading || offer > tdc} style={{
        width:'100%', padding:'13px', border:'none', borderRadius:10, cursor:'pointer',
        background: offer > tdc ? 'rgba(255,255,255,0.08)' : '#D97706',
        color: offer > tdc ? '#4B5563' : '#fff', fontSize:14, fontWeight:900,
      }}>
        {loading ? 'Envoi…' : offer > tdc ? 'Solde insuffisant' : `💸 Proposer ${offer} HEX Coin`}
      </button>
    </div>
  )
}

/* ── Shared helpers ────────────────────────────────────────── */
function Chip({ children, color }: any) {
  return <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:`${color}18`,
    color, border:`1px solid ${color}33`, fontWeight:600 }}>{children}</span>
}
function Sec({ label, children }: any) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:9, color:'#4B5563', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}
function KV({ label, val, color }: any) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0',
      borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:11 }}>
      <span style={{ color:'#6B7280' }}>{label}</span>
      <span style={{ color: color||'#E5E7EB', fontWeight:600 }}>{val}</span>
    </div>
  )
}
function BigStat({ icon, val, label, color }: any) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
      background:'rgba(255,255,255,0.04)', borderRadius:8, marginBottom:7 }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color, fontFamily:'monospace' }}>{val}</div>
        <div style={{ fontSize:10, color:'#6B7280' }}>{label}</div>
      </div>
    </div>
  )
}
function MiniStat({ label, val, color }: any) {
  return (
    <div style={{ background:`${color}14`, borderRadius:6, padding:'4px 8px', border:`1px solid ${color}22` }}>
      <div style={{ fontSize:8, color:'#6B7280' }}>{label}</div>
      <div style={{ fontSize:10, fontWeight:700, color }}>{val}</div>
    </div>
  )
}
