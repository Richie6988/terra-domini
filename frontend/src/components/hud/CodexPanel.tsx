/**
 * CodexPanel — Token Collection / Codex.
 * Ported from main_prototype.html modal-codex (9 tabs).
 * This IS the collection panel — filters are inside, not separate.
 * 
 * Tabs: Overview | ⭐ Favorites |  Disasters |  Places |  Nature |
 *        Conflict |  Culture |  Science |  Fantastic
 * 
 * Each token: 3D view + marketplace + rarity badge
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { CrystalIcon } from '../shared/CrystalIcon'
import { Token3DViewer } from '../shared/Token3DViewer'
import { TokenHexPreview } from '../shared/TokenHexPreview'
import { CATEGORIES } from '../shared/radarIconData'
import { useStore } from '../../store'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }

// Category tabs matching prototype structure — using iconBank IDs, no emojis
const CODEX_TABS = [
  { id: 'overview',  label: 'Overview',    iconId: 'chart_bar' },
  { id: 'favorites', label: 'Favorites',   iconId: 'medal' },
  { id: 'disaster',  label: 'Disasters',   iconId: 'volcano',     color: '#dc2626' },
  { id: 'places',    label: 'Places',      iconId: 'museum',      color: '#3b82f6' },
  { id: 'nature',    label: 'Nature',      iconId: 'forest',      color: '#22c55e' },
  { id: 'conflict',  label: 'Conflict',    iconId: 'swords',      color: '#f97316' },
  { id: 'culture',   label: 'Culture',     iconId: 'theater',     color: '#ec4899' },
  { id: 'science',   label: 'Science',     iconId: 'microscope',  color: '#0099cc' },
  { id: 'life',      label: 'Life',        iconId: 'animal',      color: '#10b981' },
  { id: 'fantastic', label: 'Fantastic',   iconId: 'dragon',      color: '#8b5cf6' },
]

// Map ALL icon bank categories to codex tabs
const CAT_TAB_MAP: Record<string, string> = {
  // Disasters
  earthquake: 'disaster', volcano: 'disaster', tsunami: 'disaster', nuclear: 'disaster',
  tornado: 'disaster', avalanche: 'disaster', wildfire: 'disaster',
  // Places & Structures
  city: 'places', capitalCity: 'places', museum: 'places', monument: 'places', wonder: 'places',
  cult: 'places', port: 'places', tower: 'places', observatory: 'places', farm: 'places', mine: 'places',
  castle: 'places', temple: 'places', bridge: 'places', house: 'places', bank: 'places',
  construction: 'places', infrastructure: 'places',
  // Nature
  waterfall: 'nature', cave: 'nature', mountain: 'nature', glacier: 'nature', island: 'nature',
  forest: 'nature', ocean: 'nature', desert: 'nature', lake: 'nature', river: 'nature',
  snow_peak: 'nature',
  // Conflict
  chokepoint: 'conflict', weapon: 'conflict', war: 'conflict', conspiracy: 'conflict',
  mystery: 'conflict', piracy: 'conflict', diplomacy: 'conflict',
  battle: 'conflict', military: 'conflict', fort: 'conflict', swords: 'conflict',
  // Culture
  celebs: 'culture', entertainment: 'culture', art: 'culture', sport: 'culture',
  music: 'culture', food: 'culture', history: 'culture',
  festival: 'culture', theater: 'culture', palette: 'culture',
  // Science
  science: 'science', tech: 'science', intelligence: 'science', medicine: 'science',
  space: 'science', lab: 'science', energy: 'science', microscope: 'science',
  rocket: 'science', satellite: 'science', brain: 'science', dna: 'science',
  // Life & Organisms
  vegetal: 'life', microOrganism: 'life', animal: 'life', insect: 'life',
  mushroom: 'life', fossil: 'life', orchid: 'life', fungus: 'life',
  eagle: 'life', whale: 'life', lion: 'life', wolf: 'life', bear: 'life',
  fox: 'life', deer: 'life', shark: 'life', bat: 'life', butterfly: 'life',
  bee: 'life', crab: 'life', octopus: 'life', squid: 'life', scorpion: 'life',
  snake: 'life', horse: 'life', elephant: 'life', rhino: 'life', bison: 'life',
  crocodile: 'life', bug: 'life',
  // Fantastic
  dragon: 'fantastic', phoenix: 'fantastic', alien: 'fantastic',
  mythology: 'fantastic', countries: 'fantastic', sponsored: 'fantastic', gift: 'fantastic',
  dinosaur: 'fantastic', trex: 'fantastic', raptor: 'fantastic', stego: 'fantastic',
  mythic: 'fantastic', creature: 'fantastic', magic: 'fantastic',
  // Misc → overview
  news: 'overview', treasure: 'overview', industry: 'overview',
}

// Real collection from owned territories + store
function useRealCollection() {
  const territories = useStore(s => s.territories)
  const myTerritories = useStore(s => s.myTerritories)

  return useMemo(() => {
    const coll: Record<string, { owned: number; total: number; rarity: string; shiny: boolean }> = {}

    // Initialize all icons from categories
    for (const cat of Object.values(CATEGORIES)) {
      for (const icon of cat.icons) {
        coll[icon.id] = { owned: 0, total: 5 + Math.floor(icon.id.charCodeAt(0) % 15), rarity: 'common', shiny: false }
      }
    }

    // Count real owned territories by category
    const owned = myTerritories ? Array.from(myTerritories) : Object.values(territories).filter((t: any) => t.owner_id)
    for (const t of owned) {
      const ta = t as any
      const cat = ta.poi_category || ta.territory_type || 'urban'
      // Find matching icon
      for (const [, catData] of Object.entries(CATEGORIES)) {
        for (const icon of (catData as any).icons) {
          if (icon.id === cat || icon.id.includes(cat) || cat.includes(icon.id)) {
            coll[icon.id] = {
              ...coll[icon.id],
              owned: (coll[icon.id]?.owned || 0) + 1,
              rarity: ta.rarity || 'common',
              shiny: ta.is_shiny || false,
            }
          }
        }
      }
    }
    return coll
  }, [territories, myTerritories])
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}

export function CodexPanel({ onClose }: Props) {
  const [tab, setTab] = useState('overview')
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [show3D, setShow3D] = useState(false)
  const [filter, setFilter] = useState('')
  const [sellMode, setSellMode] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const setActivePanel = useStore(s => s.setActivePanel)
  const collection = useRealCollection()

  // All tokens flat list
  const allTokens = useMemo(() =>
    Object.entries(CATEGORIES).flatMap(([catKey, cat]) => cat.icons.map(icon => ({
      ...icon, catName: cat.name, catColor: cat.color, catId: catKey,
      codexTab: CAT_TAB_MAP[icon.id] || CAT_TAB_MAP[catKey] || 'places',
      ...collection[icon.id],
    }))),
  [collection])

  // Stats per codex tab
  const tabStats = useMemo(() => {
    const stats: Record<string, { owned: number; total: number }> = {}
    for (const t of allTokens) {
      if (!stats[t.codexTab]) stats[t.codexTab] = { owned: 0, total: 0 }
      stats[t.codexTab].owned += t.owned
      stats[t.codexTab].total += t.total
    }
    return stats
  }, [allTokens])

  const globalOwned = allTokens.reduce((s, t) => s + t.owned, 0)
  const globalTotal = allTokens.reduce((s, t) => s + t.total, 0)
  const globalPct = globalTotal > 0 ? Math.floor((globalOwned / globalTotal) * 100) : 0
  const shinyCount = allTokens.filter(t => t.shiny && t.owned > 0).length

  // Tokens for current tab
  const tabTokens = useMemo(() => {
    let tokens = tab === 'overview' || tab === 'favorites'
      ? allTokens
      : allTokens.filter(t => t.codexTab === tab)
    if (filter) tokens = tokens.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    return tokens
  }, [tab, allTokens, filter])

  const selectedTokenData = selectedToken ? allTokens.find(t => t.id === selectedToken) : null

  return (
    <GlassPanel title="TOKEN CODEX" onClose={onClose} accent="#7950f2">
      {/* Tab row — scrollable */}
      <div style={{
        display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 8, marginBottom: 10,
        scrollbarWidth: 'none',
      }}>
        {CODEX_TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedToken(null) }} style={{
            padding: '6px 10px', borderRadius: 16, cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 7, fontWeight: tab === t.id ? 800 : 500, letterSpacing: 1,
            background: tab === t.id ? (t.color || '#7950f2') + '15' : 'rgba(255,255,255,0.04)',
            color: tab === t.id ? (t.color || '#7950f2') : 'rgba(255,255,255,0.35)',
            border: `1px solid ${tab === t.id ? (t.color || '#7950f2') + '40' : 'rgba(255,255,255,0.08)'}`,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <IconSVG id={t.iconId} size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search filter (inside codex per Richard's design) */}
      <div style={{ marginBottom: 10 }}>
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter tokens..."
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 10, boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 9, color: '#e2e8f0', outline: 'none',
            fontFamily: "'Share Tech Mono', monospace",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ OVERVIEW TAB — shows ALL 57 categories ═══ */}
        {tab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Global progress */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 4, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                TOTAL COLLECTION PROGRESS
              </div>
              <div style={{ fontSize: 28, fontFamily: "'Share Tech Mono', monospace", color: '#F59E0B', fontWeight: 700 }}>
                {globalOwned} <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>/ {globalTotal}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', maxWidth: 280, margin: '8px auto', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${globalPct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #F59E0B, #0CC5FF)' }} />
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{globalPct}% COMPLETE · {shinyCount} SHINY</div>
            </div>

            {/* ALL 57 categories — grouped by category family */}
            {Object.entries(CATEGORIES).map(([groupKey, group]) => (
              <div key={groupKey} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 8, fontWeight: 900, letterSpacing: 2, color: group.color,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  marginBottom: 6, paddingBottom: 4,
                  borderBottom: `1px solid ${group.color}30`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <IconSVG id={group.icons[0]?.id || 'mystery'} size={14} />
                  {group.name.toUpperCase()} ({group.icons.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                  {group.icons.map(icon => {
                    const token = allTokens.find(t => t.id === icon.id)
                    const owned = token?.owned || 0
                    const total = token?.total || 1
                    return (
                      <button key={icon.id} onClick={() => { setSelectedToken(icon.id) }} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                        background: owned > 0 ? `${group.color}10` : 'rgba(255,255,255,0.02)',
                        border: owned > 0 ? `1px solid ${group.color}30` : '1px solid rgba(255,255,255,0.05)',
                        opacity: owned > 0 ? 1 : 0.4,
                        filter: owned > 0 ? 'none' : 'grayscale(0.7)',
                        transition: 'all 0.2s',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: `${icon.cat_color || group.color}20`,
                          border: `2px solid ${icon.cat_color || group.color}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconSVG id={icon.id} size={20} />
                        </div>
                        <div style={{ fontSize: 6, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5, fontFamily: "'Orbitron', sans-serif", textAlign: 'center' }}>
                          {icon.name.toUpperCase().slice(0, 10)}
                        </div>
                        <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>
                          {owned}/{total}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══ FAVORITES TAB ═══ */}
        {tab === 'favorites' && (
          <motion.div key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
              <IconSVG id="medal" size={12} /> YOUR TOP TOKENS
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              {allTokens.filter(t => t.owned > 0).slice(0, 5).map((t, i) => (
                <button key={t.id} onClick={() => { setSelectedToken(t.id); setShow3D(true) }} style={{
                  width: 64, height: 88, borderRadius: 10, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${t.catColor}30, ${t.catColor}10)`,
                  border: `2px solid ${t.catColor}50`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  boxShadow: t.shiny ? `0 0 12px ${t.catColor}40` : 'none',
                }}>
                  <IconSVG id={t.id} size={32} />
                  <div style={{ fontSize: 5, fontWeight: 700, color: t.catColor, letterSpacing: 0.5, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                     #{i + 1}
                  </div>
                </button>
              ))}
            </div>

            {/* 3D Museum placeholder */}
            <div style={{
              padding: 20, borderRadius: 12, textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(10,15,25,0.95), rgba(10,10,18,0.98))',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'relative', overflow: 'hidden', minHeight: 120,
            }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                <IconSVG id="museum" size={14} /> HEXOD MUSEUM — YOUR HALL OF FAME
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                {allTokens.filter(t => t.owned > 0).slice(0, 4).map(t => (
                  <div key={t.id} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', margin: '0 auto 4px',
                      background: `linear-gradient(135deg, ${t.catColor}80, ${t.catColor}40)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 20px ${t.catColor}40`,
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}>
                      <IconSVG id={t.id} size={24} />
                    </div>
                    <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.04)', fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                      {t.name.slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                CLICK TOKEN FOR 3D VIEW
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ CATEGORY TABS (disaster/places/nature/conflict/culture/science/fantastic) ═══ */}
        {CODEX_TABS.filter(t => t.color).map(ct => tab === ct.id && (
          <motion.div key={ct.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Category header with progress */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10, padding: '6px 10px', borderRadius: 8,
              background: ct.color + '08', border: `1px solid ${ct.color}20`,
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: ct.color, letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                <IconSVG id={ct.iconId} size={14} /> {ct.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: ct.color, fontFamily: "'Share Tech Mono', monospace" }}>
                {tabStats[ct.id]?.owned || 0}/{tabStats[ct.id]?.total || 0}
              </div>
            </div>

            {/* Token grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, justifyItems: 'center' }}>
              {tabTokens.map(token => {
                const isOwned = token.owned > 0
                const isSelected = selectedToken === token.id
                return (
                  <div key={token.id} style={{
                    opacity: isOwned ? 1 : 0.25,
                    filter: isOwned ? 'none' : 'grayscale(0.8)',
                    border: isSelected ? `2px solid ${ct.color}` : '2px solid transparent',
                    borderRadius: 10, padding: 2,
                  }}>
                    <TokenHexPreview
                      iconId={token.id}
                      rarity={token.rarity}
                      catColor={ct.color}
                      size={56}
                      shiny={token.shiny && isOwned}
                      onClick={() => setSelectedToken(isSelected ? null : token.id)}
                    />
                    <div style={{
                      fontSize: 6, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.3,
                      fontFamily: "'Orbitron', system-ui, sans-serif",
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textAlign: 'center', maxWidth: 60, margin: '2px auto 0',
                    }}>
                      {token.name.toUpperCase()}
                    </div>
                  </div>
                )
              })}
            </div>

            {tabTokens.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.25)', fontSize: 8, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                NO TOKENS FOUND
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Selected token detail */}
      {selectedTokenData && (
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 10,
            background: selectedTokenData.catColor + '06',
            border: `1px solid ${selectedTokenData.catColor}20`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <IconSVG id={selectedTokenData.id} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                {selectedTokenData.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <span style={{
                  padding: '1px 6px', borderRadius: 8, fontSize: 6, fontWeight: 700,
                  background: RARITY_COLORS[selectedTokenData.rarity] + '15',
                  color: RARITY_COLORS[selectedTokenData.rarity],
                  border: `1px solid ${RARITY_COLORS[selectedTokenData.rarity]}30`,
                }}>
                  {selectedTokenData.rarity.toUpperCase()}
                </span>
                {selectedTokenData.shiny && <span style={{ fontSize: 6, color: '#cc8800' }}><IconSVG id="sparkles" size={8} /> SHINY</span>}
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 900, color: selectedTokenData.catColor, fontFamily: "'Share Tech Mono', monospace" }}>
              {selectedTokenData.owned}/{selectedTokenData.total}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShow3D(true)} style={{
              flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
              background: 'linear-gradient(90deg, #D4AF37, #CD7F32)',
              border: 'none', color: '#fff', fontSize: 7, fontWeight: 900, letterSpacing: 2,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              ◆ VIEW 3D
            </button>
            <button onClick={() => setSellMode(!sellMode)} style={{
              flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
              background: sellMode ? '#22c55e' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
              color: sellMode ? '#fff' : '#22c55e', fontSize: 7, fontWeight: 700, letterSpacing: 1,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              <IconSVG id="hex_coin" size={10} /> {sellMode ? 'CANCEL' : 'SELL'}
            </button>
            <button onClick={() => { onClose(); setTimeout(() => setActivePanel('marketplace'), 100) }} style={{
              flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.3)',
              color: '#0099cc', fontSize: 7, fontWeight: 700, letterSpacing: 1,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>
              <IconSVG id="auction_gavel" size={10} /> MARKET
            </button>
          </div>

          {/* Sell price input */}
          {sellMode && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                placeholder="Price in HEX" min="1" style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)',
                  fontSize: 10, background: 'rgba(34,197,94,0.04)', outline: 'none', color: '#e2e8f0',
                }} />
              <button onClick={async () => {
                if (!sellPrice || isNaN(Number(sellPrice)) || Number(sellPrice) <= 0) { toast.error('Enter a valid price'); return }
                try {
                  await api.post('/marketplace/list/', { token_id: selectedTokenData.id, price_hex_coin: Number(sellPrice) })
                  toast.success(`Listed for ${sellPrice} HEX!`)
                  setSellMode(false); setSellPrice('')
                } catch (e: any) { toast.error(e?.response?.data?.error || 'Listing failed') }
              }} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontSize: 8, fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
              }}>LIST</button>
            </div>
          )}
        </motion.div>
      )}

      {/* Token 3D Viewer */}
      {selectedTokenData && (
        <Token3DViewer
          visible={show3D}
          onClose={() => setShow3D(false)}
          tokenName={selectedTokenData.name.toUpperCase()}
          category={selectedTokenData.catName}
          catColor={selectedTokenData.catColor}
          iconId={selectedTokenData.id}
          tier="GOLD"
          serial={Math.floor(Math.random() * 999) + 1}
          maxSupply={1000}
        />
      )}
    </GlassPanel>
  )
}
