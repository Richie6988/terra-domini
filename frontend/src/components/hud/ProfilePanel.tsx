/**
 * ProfilePanel — Hexod GDD Section 4
 * Point d'entrée unique haut-gauche: profil, inventaire, stats, historique
 * Complet, production-ready.
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Copy, Camera, ChevronRight, TrendingUp, Shield, Zap, Globe, FlaskConical } from 'lucide-react'
import { api } from '../../services/api'
import { SkeletonList } from '../ui/Utils'
import { CampaignWidget } from './CampaignWidget'
import { ResourceBadge } from '../ui/ResourceTooltip'
import { useStore, usePlayer } from '../../store'
import toast from 'react-hot-toast'

/* ── constants ─────────────────────────────────────────────── */
const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

const SPEC = {
  military:   { label:'⚔️ Militaire',    color:'#EF4444', desc:'Expansion rapide + résistance' },
  economic:   { label:'💰 Économique',   color:'#F59E0B', desc:'Domination financière' },
  diplomatic: { label:'🤝 Diplomatique', color:'#3B82F6', desc:'Contrôle sans guerre' },
  scientific: { label:'🔬 Scientifique', color:'#8B5CF6', desc:'Avantage systémique global' },
}

const RARITY_C: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

const TABS = [
  { id:'overview',    label:'Vue d\'ensemble', icon:'📊' },
  { id:'territories', label:'Territoires',     icon:'🗺️' },
  { id:'resources',   label:'Ressources',      icon:'📦' },
  { id:'skills',      label:'Compétences',     icon:'🔬' },
  { id:'missions',    label:'Missions',        icon:'🎯' },
  { id:'campaigns',   label:'Campagnes',       icon:'🗺️' },
  { id:'settings',    label:'Paramètres',      icon:'⚙️' },
]

/* ── ProfilePanel ──────────────────────────────────────────── */
export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('overview')
  const player = usePlayer()
  const logout = useStore(s => s.logout)

  if (!player) return null

  const spec = SPEC[player.spec_path as keyof typeof SPEC] || SPEC.military

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: typeof window !== 'undefined' && window.innerWidth < 480 ? window.innerWidth - 16 : 400,
        zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #07070f 0%, #050510 100%)',
        borderLeft: `2px solid ${spec.color}33`,
        boxShadow: `-8px 0 40px rgba(0,0,0,0.6)`,
      }}
    >
      {/* ── Commander hero ── */}
      <div style={{
        padding: '20px 20px 16px', flexShrink: 0,
        background: `linear-gradient(135deg, ${spec.color}14 0%, transparent 60%)`,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 60, height: 60, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${spec.color}66, ${spec.color}33)`,
            border: `2px solid ${spec.color}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-1px',
          }}>
            {player.avatar_emoji || player.username?.slice(0,2)?.toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
              {player.display_name || player.username}
            </div>
            <div style={{ fontSize: 11, color: spec.color, fontWeight: 700, marginTop: 2 }}>
              {spec.label}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
              Rang {player.commander_rank} · {player.email}
            </div>
          </div>

          <button onClick={() => { logout(); onClose() }} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, padding: '6px 10px', color: '#EF4444',
            cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
          }}>
            <LogOut size={12} /> Déconnexion
          </button>
        </div>

        {/* XP bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 10, color: '#6B7280' }}>
            <span>XP Commandant</span>
            <span style={{ color: spec.color }}>{player.commander_xp ?? 0} XP</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, ((player.commander_xp ?? 0) % 1000) / 10)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ height: '100%', background: `linear-gradient(90deg, ${spec.color}cc, ${spec.color})`, borderRadius: 3 }}
            />
          </div>
          <div style={{ fontSize: 9, color: '#374151', marginTop: 3 }}>
            {1000 - ((player.commander_xp ?? 0) % 1000)} XP jusqu'au rang {(player.commander_rank ?? 1) + 1}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Cristaux', value: toNum(player.tdc_in_game).toFixed(0), icon: '💠', color: spec.color },
            { label: 'Zones', value: player.stats?.territories_owned ?? 0, icon: '🗺️', color: '#3B82F6' },
            { label: 'Victoires', value: player.stats?.battles_won ?? 0, icon: '⚔️', color: '#EF4444' },
            { label: 'Score', value: player.stats?.season_score ?? 0, icon: '🏆', color: '#F59E0B' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 6px', textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ fontSize: 14 }}>{k.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1.2 }}>
                {String(k.value).length > 6 ? String(k.value).slice(0,5)+'…' : k.value}
              </div>
              <div style={{ fontSize: 8, color: '#4B5563', marginTop: 1 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={{
        display: 'flex', overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: '0 0 auto', padding: '9px 12px', border: 'none', cursor: 'pointer',
            background: tab === t.id ? `${spec.color}14` : 'transparent',
            borderBottom: `2px solid ${tab === t.id ? spec.color : 'transparent'}`,
            color: tab === t.id ? spec.color : '#4B5563',
            fontSize: 10, fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            style={{ padding: '16px 18px', paddingBottom: 80 }}
          >
            {tab === 'overview'    && <OverviewTab player={player} spec={spec} />}
            {tab === 'territories' && <TerritoriesTab player={player} onClose={onClose} />}
            {tab === 'resources'   && <ResourcesTab />}
            {tab === 'skills'      && <SkillsTab spec={spec} />}
            {tab === 'missions'    && <MissionsTab />}
            {tab === 'campaigns'   && <CampaignWidget />}
            {tab === 'settings'    && <SettingsTab player={player} spec={spec} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ── Overview Tab ──────────────────────────────────────────── */
function OverviewTab({ player, spec }: any) {
  const { data: live } = useQuery({
    queryKey: ['player-live'],
    queryFn: () => api.get('/players/me/').then(r => r.data),
    refetchInterval: 30000,
  })
  const p = live ? { ...player, stats: { ...(player.stats||{}), ...(live.stats||{}) } } : player
  const stats = p.stats || {}

  const POWER_LAYERS = [
    { label: 'Physique', icon: '⚔️', items: [
      { k: 'territories_owned', label: 'Territoires', color: '#3B82F6' },
      { k: 'battles_won', label: 'Batailles gagnées', color: '#EF4444' },
      { k: 'total_attack_power', label: 'Puissance attaque', color: '#EF4444' },
    ]},
    { label: 'Économique', icon: '💰', items: [
      { k: 'tdc_earned_total', label: 'HEX Coin gagnés total', color: '#F59E0B' },
      { k: 'income_per_tick', label: 'Revenus / tick', color: '#F59E0B' },
      { k: 'cluster_count', label: 'Clusters actifs', color: '#10B981' },
    ]},
    { label: 'Informationnel', icon: '🌐', items: [
      { k: 'influence_score', label: 'Score d\'influence', color: '#8B5CF6' },
      { k: 'season_score', label: 'Score saison', color: '#EC4899' },
      { k: 'alliance_rank', label: 'Rang alliance', color: '#6B7280' },
    ]},
  ]

  return (
    <div>
      {/* Wallet */}
      {p.wallet_address && (
        <div style={{
          padding: '10px 14px', marginBottom: 14,
          background: 'rgba(139,92,246,0.08)', borderRadius: 10,
          border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>💎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 700, marginBottom: 2 }}>Polygon Wallet</div>
            <div style={{ fontSize: 10, color: '#C4B5FD', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.wallet_address}
            </div>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(p.wallet_address); toast.success('Copié!') }}
            style={{ background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer' }}>
            <Copy size={14} />
          </button>
        </div>
      )}

      {/* 3 power layers */}
      {POWER_LAYERS.map(layer => (
        <div key={layer.label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#4B5563', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 7, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{layer.icon}</span> Couche {layer.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {layer.items.map(item => (
              <div key={item.k} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: item.color, fontFamily: 'monospace' }}>
                  {toNum(stats[item.k] ?? p[item.k] ?? 0).toFixed(0)}
                </div>
                <div style={{ fontSize: 9, color: '#4B5563', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Territories Tab ───────────────────────────────────────── */
function TerritoriesTab({ player, onClose }: any) {
  const [filter, setFilter] = useState<string>('all')
  const { data, isLoading } = useQuery({
    queryKey: ['my-territories'],
    queryFn: () => api.get('/territories-geo/mine/').then(r => r.data),
    staleTime: 30000,
  })

  const all: any[] = data?.territories || []
  const rarities = [...new Set(all.map(t => t.rarity || 'common'))]

  const filtered = filter === 'all' ? all
    : filter === 'poi' ? all.filter(t => t.is_landmark || t.poi_name)
    : all.filter(t => (t.rarity || 'common') === filter)

  const totalIncome = all.reduce((s, t) => s + (toNum(t.resource_credits) || 10), 0)
  const poiCount    = all.filter(t => t.is_landmark || t.poi_name).length
  const avgRarity   = all.length > 0
    ? Object.entries({common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5})
        .find(([k]) => k === (all.sort((a,b) =>
          ({mythic:5,legendary:4,epic:3,rare:2,uncommon:1,common:0}[b.rarity]||0) -
          ({mythic:5,legendary:4,epic:3,rare:2,uncommon:1,common:0}[a.rarity]||0))[0]?.rarity))?.[0] || 'common'
    : 'common'

  const teleport = (t: any) => {
    window.dispatchEvent(new CustomEvent('terra:flyto', {
      detail: { lat: t.center_lat, lon: t.center_lon, zoom: 15 }
    }))
    onClose()
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
        <KPI label="Territoires" value={all.length} icon="🗺️" color="#3B82F6" />
        <KPI label="Revenus/jour" value={`+${Math.round(totalIncome)}`} icon="💰" color="#F59E0B" />
        <KPI label="POI" value={poiCount} icon="📍" color="#EC4899" />
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {['all', 'poi', ...rarities].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer', flexShrink: 0,
            background: filter === f ? `${RARITY_C[f] || '#3B82F6'}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${filter === f ? (RARITY_C[f] || '#3B82F6') + '55' : 'rgba(255,255,255,0.07)'}`,
            color: filter === f ? (RARITY_C[f] || '#3B82F6') : '#6B7280', fontWeight: filter === f ? 700 : 400,
          }}>
            {f === 'all' ? `Tous (${all.length})` : f === 'poi' ? `📍 POI (${poiCount})` : `${f} (${all.filter(t => (t.rarity||'common')===f).length})`}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {!isLoading && filtered.length === 0 && <EmptyState icon="🗺️" msg="Aucun territoire" sub="Réclamez votre premier hex sur la carte" />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(t => (
          <TerritoryCard key={t.h3_index} territory={t} onClick={() => teleport(t)} />
        ))}
      </div>
    </div>
  )
}

function TerritoryCard({ territory: t, onClick }: any) {
  const rarity  = t.rarity || 'common'
  const rc      = RARITY_C[rarity] || '#9CA3AF'
  const name    = t.custom_name || t.poi_name || t.place_name || t.h3_index?.slice(0,10)+'…'
  const hasPOI  = !!(t.poi_name || t.is_landmark)
  const income  = toNum(t.resource_credits) || 10

  return (
    <motion.button
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${rc}22`, display: 'flex', alignItems: 'center', gap: 10,
        borderLeft: `3px solid ${t.border_color || rc}`,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{t.custom_emoji || t.poi_emoji || '🏴'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <Chip color={rc}>{rarity}</Chip>
          {hasPOI && <Chip color="#EC4899">📍 POI</Chip>}
          <Chip color="#6B7280">{t.territory_type || 'standard'}</Chip>
          {t.is_shiny && <Chip color="#FCD34D">✨ Shiny</Chip>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: '#F59E0B', fontFamily: 'monospace', fontWeight: 700 }}>+{Math.round(income)}</div>
        <div style={{ fontSize: 8, color: '#374151' }}>HEX Coin/jour</div>
        <div style={{ fontSize: 9, color: '#374151', marginTop: 2 }}>📍</div>
      </div>
    </motion.button>
  )
}

/* ── Resources Tab ─────────────────────────────────────────── */
const RESOURCES = [
  { key:'res_fer',         label:'Fer',           icon:'🪨', cat:'physique', color:'#6B7280' },
  { key:'res_cuivre',      label:'Cuivre',        icon:'🟠', cat:'physique', color:'#6B7280' },
  { key:'res_aluminium',   label:'Aluminium',     icon:'⬜', cat:'physique', color:'#6B7280' },
  { key:'res_acier',       label:'Acier',         icon:'⚙️', cat:'physique', color:'#6B7280' },
  { key:'res_titanium',    label:'Titanium',      icon:'🔷', cat:'physique', color:'#6B7280' },
  { key:'res_petrole',     label:'Pétrole',       icon:'🛢️', cat:'energie',  color:'#F59E0B' },
  { key:'res_gaz',         label:'Gaz naturel',   icon:'💨', cat:'energie',  color:'#F59E0B' },
  { key:'res_charbon',     label:'Charbon',       icon:'⬛', cat:'energie',  color:'#F59E0B' },
  { key:'res_uranium',     label:'Uranium',       icon:'☢️', cat:'energie',  color:'#10B981' },
  { key:'res_silicium',    label:'Silicium',      icon:'💠', cat:'tech',     color:'#8B5CF6' },
  { key:'res_terres_rares',label:'Terres rares',  icon:'💎', cat:'tech',     color:'#8B5CF6' },
  { key:'res_composants',  label:'Composants',    icon:'🔌', cat:'tech',     color:'#8B5CF6' },
  { key:'res_donnees',     label:'Données',       icon:'📊', cat:'info',     color:'#3B82F6' },
  { key:'res_main_oeuvre', label:'Main-d\'œuvre', icon:'👷', cat:'info',     color:'#3B82F6' },
  { key:'res_nourriture',  label:'Nourriture',    icon:'🌾', cat:'vital',    color:'#10B981' },
  { key:'res_eau',         label:'Eau',           icon:'💧', cat:'vital',    color:'#10B981' },
  { key:'res_influence',   label:'Influence',     icon:'🌐', cat:'info',     color:'#3B82F6' },
  { key:'res_stabilite',   label:'Stabilité',     icon:'⚖️', cat:'vital',    color:'#10B981' },
  { key:'res_hex_HEX Coin',label:'HEX Coin',  icon:'💠', cat:'hex',      color:'#EC4899' },
]

const CAT_CONFIG: Record<string, { label:string; color:string }> = {
  physique: { label:'⚙️ Physique',       color:'#6B7280' },
  energie:  { label:'⚡ Énergie',         color:'#F59E0B' },
  tech:     { label:'🔬 Technologie',     color:'#8B5CF6' },
  info:     { label:'📡 Informationnel',  color:'#3B82F6' },
  vital:    { label:'🌱 Vital',           color:'#10B981' },
  hex:      { label:'💠 HEX Coin',    color:'#EC4899' },
}

function ResourcesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-territories-resources'],
    queryFn: async () => {
      const r = await api.get('/territories-geo/mine/')
      const territories = r.data.territories || []
      const totals: Record<string,number> = {}
      RESOURCES.forEach(res => { totals[res.key] = 0 })
      territories.forEach((t: any) => {
        RESOURCES.forEach(res => {
          totals[res.key] += toNum(t[res.key] || 0)
        })
      })
      return { totals, territory_count: territories.length }
    },
    staleTime: 60000,
  })

  const byCategory: Record<string, typeof RESOURCES> = {}
  RESOURCES.forEach(r => { byCategory[r.cat] = [...(byCategory[r.cat]||[]), r] })

  if (isLoading) return <LoadingState />
  const totals = data?.totals || {}

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
        Production cumulée de vos {data?.territory_count || 0} territoires.
        Les ressources alimentent l'arbre de compétences et les constructions.
      </div>

      {Object.entries(byCategory).map(([cat, resources]) => {
        const cc = CAT_CONFIG[cat]
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: cc.color, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>
              {cc.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {resources.map(res => {
                const val = totals[res.key] || 0
                const max = Math.max(...resources.map(r => totals[r.key]||0)) || 1
                return (
                  <div key={res.key} style={{
                    background: val > 0 ? `${res.color}0d` : 'rgba(255,255,255,0.02)',
                    borderRadius: 8, padding: '8px 10px',
                    border: `1px solid ${val > 0 ? res.color + '22' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <ResourceBadge resource={res.key} showValue={false} />
                      <span style={{ fontSize: 10, color: val > 0 ? '#E5E7EB' : '#4B5563', fontWeight: 600 }}>
                        {res.label}
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${(val/max)*100}%`,
                        background: res.color, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: val > 0 ? res.color : '#374151',
                      fontFamily: 'monospace' }}>
                      {res.key === 'res_hex_HEX Coin' ? val.toFixed(2) : Math.round(val)}
                      <span style={{ fontSize: 8, color: '#4B5563', fontWeight: 400 }}>/jour</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Skills Tab ────────────────────────────────────────────── */
const BRANCH_CONFIG = {
  attack:    { label:'⚔️ Attaque',      color:'#EF4444' },
  defense:   { label:'🛡️ Défense',      color:'#3B82F6' },
  economy:   { label:'💰 Économie',     color:'#F59E0B' },
  influence: { label:'🌐 Rayonnement',  color:'#10B981' },
  tech:      { label:'🔬 Technologies', color:'#8B5CF6' },
}

function SkillsTab({ spec }: any) {
  const [branch, setBranch] = useState('attack')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get('/progression/skills/').then(r => r.data),
  })

  const unlock = useMutation({
    mutationFn: (id: number) => api.post(`/progression/skills/${id}/unlock/`),
    onSuccess: () => { toast.success('Compétence débloquée!'); qc.invalidateQueries({ queryKey: ['skill-tree'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Ressources insuffisantes'),
  })

  const tree: Record<string, any[]> = data?.tree || {}
  const cfg = BRANCH_CONFIG[branch as keyof typeof BRANCH_CONFIG]
  const skills = tree[branch] || []
  const unlockedCount = data?.unlocked_count || 0
  const totalSkills = Object.values(tree).reduce((s, v) => s + v.length, 0)

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 5 }}>
          <span>Compétences débloquées</span>
          <span style={{ color: spec.color, fontWeight: 700 }}>{unlockedCount} / {totalSkills}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${totalSkills ? (unlockedCount/totalSkills)*100 : 0}%`,
            background: spec.color, borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Branch tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto' }}>
        {Object.entries(BRANCH_CONFIG).map(([id, bc]) => {
          const branchSkills = tree[id] || []
          const branchUnlocked = branchSkills.filter((s: any) => s.unlocked).length
          return (
            <button key={id} onClick={() => setBranch(id)} style={{
              padding: '6px 10px', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              background: branch === id ? `${bc.color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${branch === id ? bc.color + '55' : 'rgba(255,255,255,0.06)'}`,
              color: branch === id ? bc.color : '#4B5563', fontSize: 10, fontWeight: branch === id ? 700 : 400,
            }}>
              {bc.label.split(' ')[0]}<br/>
              <span style={{ fontSize: 8 }}>{branchUnlocked}/{branchSkills.length}</span>
            </button>
          )
        })}
      </div>

      {/* Skill nodes */}
      <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 10 }}>{cfg.label}</div>

      {skills.length === 0 && <LoadingState />}
      {skills.map((s: any, i: number) => (
        <SkillRow key={s.id} skill={s} color={cfg.color} index={i}
          onUnlock={() => unlock.mutate(s.id)} />
      ))}
    </div>
  )
}

function SkillRow({ skill: s, color, index, onUnlock }: any) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      marginBottom: 6, borderRadius: 10, overflow: 'hidden',
      background: s.unlocked ? `${color}0e` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${s.unlocked ? color + '33' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '11px 13px', display: 'flex', gap: 10,
        alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: s.unlocked ? `${color}22` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${s.unlocked ? color+'44' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {s.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.unlocked ? '#fff' : '#9CA3AF' }}>{s.name}</div>
          <div style={{ fontSize: 10, color: s.unlocked ? color : '#6B7280', marginTop: 1 }}>{s.effect}</div>
        </div>
        <span style={{ fontSize: s.unlocked ? 16 : 12, color: s.unlocked ? color : '#374151' }}>
          {s.unlocked ? '✅' : open ? '🔓' : '🔒'}
        </span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 13px 12px' }}>
              <div style={{ fontSize: 9, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Ressources requises
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {s.cost_json.map((c: string) => (
                  <span key={c} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                    color: '#9CA3AF' }}>{c}</span>
                ))}
              </div>
              {!s.unlocked && (
                <button onClick={e => { e.stopPropagation(); onUnlock() }} style={{
                  width: '100%', padding: '9px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${color}cc, ${color})`,
                  color: '#000', fontSize: 12, fontWeight: 800,
                }}>Débloquer</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Missions Tab ──────────────────────────────────────────── */
function MissionsTab() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
  })

  const claim = useMutation({
    mutationFn: (id: number) => api.post(`/progression/${id}/claim-mission/`),
    onSuccess: () => { toast.success('Récompense réclamée!'); qc.invalidateQueries({ queryKey: ['daily-missions'] }) },
  })

  const missions: any[] = data?.missions || []
  const completed = missions.filter(m => m.completed && !m.claimed).length
  const totalReward = missions.reduce((s, m) => s + (!m.claimed ? m.reward_tdc : 0), 0)

  return (
    <div>
      {data?.all_complete && (
        <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 700 }}>Toutes les missions complétées!</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>Revenez demain pour de nouvelles missions</div>
        </div>
      )}

      {completed > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#F59E0B' }}>
            {completed} récompense{completed > 1 ? 's' : ''} disponible{completed > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 700 }}>+{totalReward} HEX Coin</span>
        </div>
      )}

      {missions.length === 0 ? <LoadingState /> : missions.map((m: any) => (
        <MissionRow key={m.id} mission={m} onClaim={() => claim.mutate(m.id)} />
      ))}
    </div>
  )
}

function MissionRow({ mission: m, onClaim }: any) {
  const pct = Math.min(100, (m.current_count / m.target_count) * 100)
  return (
    <div style={{
      padding: '12px 13px', marginBottom: 8, borderRadius: 10, opacity: m.is_claimed ? 0.45 : 1,
      background: m.completed ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${m.completed ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{m.icon ?? '🎯'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{m.title}</span>
            <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: 'monospace', fontWeight: 700 }}>+{m.reward_tdc} HEX Coin</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 4 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ height: '100%', background: m.completed ? '#10B981' : '#3B82F6', borderRadius: 2 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#6B7280' }}>{m.current_count}/{m.target_count}</span>
            {m.completed && !m.is_claimed && (
              <button onClick={onClaim} style={{ fontSize: 10, padding: '3px 10px',
                background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: 5, color: '#10B981', cursor: 'pointer', fontWeight: 700 }}>
                Réclamer
              </button>
            )}
            {m.is_claimed && <span style={{ fontSize: 10, color: '#10B981' }}>✓ Réclamée</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Settings Tab ──────────────────────────────────────────── */
function SettingsTab({ player, spec }: any) {
  const qc = useQueryClient()
  const [username, setUsername] = useState(player.display_name || player.username || '')
  const [emoji, setEmoji] = useState(player.avatar_emoji || '🎖️')
  const [path, setPath] = useState(player.spec_path || 'military')
  const [saving, setSaving] = useState(false)

  const EMOJIS = ['🎖️','⚔️','🛡️','👑','🔬','💰','🌐','🏴','🎯','🔥','❄️','⚡','💎','🧠','🤝']
  const PATHS: [string, string, string][] = [
    ['military',   '⚔️ Militaire',    'Attaque +15%, défense +10%'],
    ['economic',   '💰 Économique',   'Revenus +20%, HEX Coin +15%'],
    ['diplomatic', '🤝 Diplomatique', 'Influence +25%, coûts attaque -10%'],
    ['scientific', '🔬 Scientifique', 'Recherche x2, déblocages accélérés'],
  ]

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/players/update-profile/', {
        display_name: username, avatar_emoji: emoji, spec_path: path,
      })
      toast.success('Profil mis à jour!')
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['player-live'] })
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* Display name */}
      <Section label="Nom d'affichage">
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Votre nom…"
          style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#fff',
            fontSize: 14, boxSizing: 'border-box' }} />
      </Section>

      {/* Avatar emoji */}
      <Section label="Avatar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{
              width: 40, height: 40, fontSize: 20, borderRadius: 9, cursor: 'pointer',
              background: emoji === e ? `${spec.color}22` : 'rgba(255,255,255,0.05)',
              border: `2px solid ${emoji === e ? spec.color : 'transparent'}`,
            }}>{e}</button>
          ))}
        </div>
      </Section>

      {/* Spec path */}
      <Section label="Voie stratégique">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PATHS.map(([id, label, desc]) => {
            const pathColor = id === 'military' ? '#EF4444' : id === 'economic' ? '#F59E0B'
              : id === 'diplomatic' ? '#3B82F6' : '#8B5CF6'
            return (
              <button key={id} onClick={() => setPath(id)} style={{
                padding: '10px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                background: path === id ? `${pathColor}14` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${path === id ? pathColor + '55' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: path === id ? pathColor : '#9CA3AF' }}>{label}</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{desc}</div>
              </button>
            )
          })}
        </div>
      </Section>

      <button onClick={save} disabled={saving} style={{
        width: '100%', padding: '13px', border: 'none', borderRadius: 10, cursor: 'pointer',
        background: saving ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${spec.color}cc, ${spec.color})`,
        color: '#000', fontSize: 14, fontWeight: 900,
      }}>{saving ? 'Sauvegarde…' : '💾 Sauvegarder'}</button>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */
function Section({ label, children }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, color: '#4B5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
function Chip({ children, color }: any) {
  return (
    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
      background: `${color}18`, color, border: `1px solid ${color}33`, fontWeight: 600 }}>
      {children}
    </span>
  )
}
function KPI({ label, value, icon, color }: any) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '10px 8px', textAlign: 'center',
      border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 14 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 8, color: '#4B5563', marginTop: 1 }}>{label}</div>
    </div>
  )
}
function LoadingState() {
  return <SkeletonList count={4} />
}
function EmptyState({ icon, msg, sub }: any) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4B5563' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>{msg}</div>
      <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
