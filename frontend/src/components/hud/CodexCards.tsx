/**
 * CodexCards — the three card families of the HEXOD master DB (GET /api/codex/cards/):
 * rare landmark cards, biome cards (named regions) and resource cards (daily production + stock).
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../../services/api'
import { IconSVG } from '../shared/iconBank'
import { useStore } from '../../store'
import { TokenFace2D } from '../shared/TokenFace2D'
import { Token3DViewer, RARITY_TIER } from '../shared/Token3DViewer'

export type CardFamily = 'rare' | 'biomes' | 'resources' | 'creatures' | 'history' | 'events'

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}
const RES_ICON: Record<string, string> = {
  oil: 'oil_barrel', gas: 'flame', coal: 'res_charbon', gold: 'res_or', iron: 'res_fer', copper: 'res_composants',
  rareearthelements: 'res_terres_rares', uranium: 'res_uranium', freshwater: 'water_drop', biomass: 'leaf',
  cereals: 'wheat', aquaculture: 'crab', aluminium: 'res_aluminium', diamonds: 'diamond_blue', platinum: 'gem',
  lithium: 'res_lithium', nickel: 'res_acier', phosphates: 'sprout', energy: 'lightning', culturalheritage: 'museum',
  biodiversity: 'butterfly', humancapital: 'people', cobalt: 'res_cobalt', chromium: 'res_acier', manganese: 'rock',
  tin: 'res_acier', zinc: 'res_acier', silver: 'gem', titanium: 'res_titanium', tungsten: 'pickaxe', marble: 'monument',
  sand: 'desert', salt: 'snowflake', strategicposition: 'chokepoint',
}
const CONTINENT_ICON: Record<string, string> = {
  Africa: 'lion', Asia: 'mountain', Europe: 'castle', 'North America': 'bison', 'South America': 'forest',
  Oceania: 'island', Oceans: 'ocean',
}

const CREATURE_FAMILY: Record<string, { label: string; icon: string }> = {
  animal: { label: 'Animals', icon: 'lion' }, fossil: { label: 'Dinosaurs & fossils', icon: 'dinosaur' },
  insect: { label: 'Insects', icon: 'butterfly' }, vegetal: { label: 'Plants', icon: 'orchid' },
  mushroom: { label: 'Fungi', icon: 'fungus' }, microOrganism: { label: 'Microbes', icon: 'microscope' },
}

interface CardsData {
  rare: any[]; biomes: any[]; resources: any[]; creatures: any[]; history: any[]; events: any[]
  creature_families: { id: string; total: number; owned: number }[]
  summary: Record<CardFamily, { owned: number; total: number }>
}

export function useCodexCards() {
  return useQuery<CardsData>({
    queryKey: ['codex-cards'],
    queryFn: () => api.get('/codex/cards/').then(r => r.data),
    staleTime: 30000,
  })
}

const dateLabel = (d?: string) => !d ? '' : d.length === 4 ? d
  : new Date(d.length === 7 ? `${d}-01` : d).toLocaleDateString('en-GB', d.length === 7 ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' })
const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1))

function Card({ owned, accent, icon, title, sub, children, onClick, no }: {
  owned: boolean; accent: string; icon: string; title: string; sub?: string; children?: any; onClick?: () => void; no?: number
}) {
  return (
    <button onClick={onClick} className="hx-card" style={{
      textAlign: 'left', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, cursor: onClick ? 'pointer' : 'default',
      borderColor: owned ? accent : undefined, opacity: owned ? 1 : 0.55, position: 'relative', minHeight: 116,
      background: owned ? `linear-gradient(160deg, ${accent}33, transparent 70%)` : undefined,
    }}>
      {no !== undefined && <span style={{ position: 'absolute', top: 8, right: 10, fontFamily: 'var(--font-heading)', fontSize: 12,
        color: owned ? '#fff' : 'var(--hx-text-3)', textShadow: '0 1px 0 rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {!owned && <Lock size={11} />}#{String(no).padStart(3, '0')}</span>}
      {no === undefined && !owned && <Lock size={13} style={{ position: 'absolute', top: 10, right: 10, color: 'var(--hx-text-3)' }} />}
      <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${accent}2a`, border: `2px solid ${accent}` }}>
        <IconSVG id={icon} size={26} />
      </span>
      <span style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, color: 'var(--hx-text-1)' }}>{title}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--hx-text-3)', lineHeight: 1.25, textTransform: 'none' }}>{sub}</span>}
      {children}
    </button>
  )
}

/** Album piece → token face (every card of the album is a token: 2D in the grid, 3D on click). */
function faceOf(family: CardFamily, c: any) {
  const base = { tokenName: c.name, rarity: c.rarity || 'common', tokenNo: c.no ? String(c.no).padStart(3, '0') : '', imageSrc: c.image_url || c.satellite_url || '' }
  switch (family) {
    case 'rare': return { ...base, category: c.game_category || c.category, iconId: c.category || 'monument', country: c.country_code, terrain: c.terrain }
    case 'history': return { ...base, category: 'HISTORY', iconId: 'history', country: c.country_code, edition: dateLabel(c.event_date) }
    case 'events': return { ...base, category: c.category === 'sport' ? 'SPORT EVENT' : 'WORLD EVENT', iconId: 'trophy', edition: dateLabel(c.event_date) }
    case 'creatures': return { ...base, category: CREATURE_FAMILY[c.category]?.label || 'CREATURE', iconId: CREATURE_FAMILY[c.category]?.icon || 'animal', edition: c.count > 1 ? `x${c.count}` : '' }
    case 'biomes': return { ...base, rarity: c.type === 'ocean' ? 'rare' : 'uncommon', category: `BIOME · ${c.continent}`, iconId: CONTINENT_ICON[c.continent] || 'globe', terrain: c.type }
    default: return { ...base, rarity: c.rarity === 'strategic' || c.rarity === 'unique' ? 'epic' : c.rarity === 'rare' ? 'rare' : 'common',
      category: `RESOURCE · ${c.category || ''}`, iconId: RES_ICON[c.id] || 'box', hexPerDay: c.rate_per_day || undefined }
  }
}

/** One album slot: the token (greyed + locked while not collected) and its number. */
function AlbumToken({ family, c, onOpen }: { family: CardFamily; c: any; onOpen: () => void }) {
  const f = faceOf(family, c)
  return (
    <button onClick={onOpen} title={c.name} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <TokenFace2D {...f} tier={RARITY_TIER[f.rarity] || 'BRONZE'} size={132}
        style={c.owned ? { filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' } : { filter: 'grayscale(1) brightness(0.55)', opacity: 0.8 }} />
      {!c.owned && <Lock size={18} style={{ position: 'absolute', top: 56, color: '#fff', filter: 'drop-shadow(0 1px 2px #000)' }} />}
      <span style={{ fontSize: 10, fontWeight: 800, color: c.owned ? 'var(--hx-text-1)' : 'var(--hx-text-3)', maxWidth: 132,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{String(c.no ?? '').padStart(3, '0')} {c.name}</span>
    </button>
  )
}

export function CodexCards({ family, filter }: { family: CardFamily; filter: string }) {
  const { data, isLoading, isError, refetch } = useCodexCards()
  const [onlyOwned, setOnlyOwned] = useState(false)
  const [open, setOpen] = useState<any>(null)
  const setActivePanel = useStore(s => s.setActivePanel)
  const flyTo = (d: { lat: number; lon: number; zoom: number }) => {
    window.dispatchEvent(new CustomEvent('terra:flyto', { detail: d }))
    setActivePanel(null as any)
  }

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return ((data?.[family] || []) as any[])
      .filter(c => !onlyOwned || c.owned)
      .filter(c => !f || `${c.name} ${c.continent || ''} ${c.category || ''}`.toLowerCase().includes(f))
  }, [data, family, filter, onlyOwned])

  if (isLoading) return <div className="hx-skeleton" style={{ height: 240, borderRadius: 16 }} aria-label="Loading cards" />
  if (isError || !data) return (
    <button className="btn-game btn-game-blue" onClick={() => refetch()} style={{ width: '100%' }}>COULD NOT LOAD CARDS — RETRY</button>
  )

  const s = data.summary[family]
  const label = family === 'rare' ? 'RARE CARDS' : family === 'biomes' ? 'BIOME CARDS' : family === 'creatures' ? 'CREATURE CARDS'
    : family === 'history' ? 'HISTORY CARDS' : family === 'events' ? 'EVENT CARDS' : 'RESOURCE CARDS'
  const explain = family === 'history'
    ? 'Moments that shaped the world, on the spot where they happened. Own the hex to own the card.'
    : family === 'events'
    ? 'Live world events (matches, news on strategic points). Hold the hex when the event ends to win its card.'
    : family === 'creatures'
    ? 'Real species caught in the Safari. Duplicates count up (x2, x3…) for future swaps.'
    : family === 'rare'
    ? 'Famous places of the world (rare to legendary). Own the hex to own the card.'
    : family === 'biomes'
      ? 'Each region of the world is a card. Own one territory there to unlock it and its resources.'
      : 'Your territories produce these every day. They fill your stock with HEX — collect with HARVEST.'
  const totalRate = family === 'resources' ? data.resources.reduce((a, r) => a + (r.rate_per_day || 0), 0) : 0

  return (
    <div>
      <div className="hx-card hx-card--accent" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="hx-section-title" style={{ margin: 0 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--hx-text-2)', marginTop: 4, textTransform: 'none', letterSpacing: 0 }}>{explain}</div>
        </div>
        <div className="hx-stat" style={{ minWidth: 92 }}>
          <span className="hx-stat__label">COLLECTED</span>
          <span className="hx-stat__value">{s.owned}/{s.total}</span>
        </div>
        {family === 'resources' && (
          <div className="hx-stat" style={{ minWidth: 92 }}>
            <span className="hx-stat__label">PER DAY</span>
            <span className="hx-stat__value">{fmt(totalRate)}</span>
          </div>
        )}
      </div>
      {family === 'creatures' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
          {data.creature_families.map(f => (
            <div key={f.id} className="hx-card" style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconSVG id={CREATURE_FAMILY[f.id]?.icon || 'animal'} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{CREATURE_FAMILY[f.id]?.label || f.id}</div>
                <div className="hx-progress" style={{ height: 6, marginTop: 4, ['--accent' as any]: '#22c55e' }}>
                  <span className="hx-progress__fill" style={{ width: `${Math.max(2, (100 * f.owned) / f.total)}%` }} />
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800 }}>{f.owned}/{f.total}</span>
            </div>
          ))}
        </div>
      )}
      {family !== 'creatures' && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 10, color: 'var(--hx-text-2)' }}>
        <input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} /> Show only my cards
      </label>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, justifyItems: 'center' }}>
        {list.slice(0, 120).map(c => <AlbumToken key={c.uid || c.id} family={family} c={c} onOpen={() => setOpen(c)} />)}
      </div>
      {list.length > 120 && <div style={{ fontSize: 12, color: 'var(--hx-text-3)', marginTop: 10 }}>Showing 120 of {list.length} — use the filter.</div>}
      {!list.length && <div style={{ fontSize: 13, color: 'var(--hx-text-3)', padding: 20, textAlign: 'center', textTransform: 'none' }}>
        {family === 'creatures' ? 'No creature yet — start a hunt in the Safari.'
          : family === 'events' ? 'No event card yet — hold a live event hex (Events panel) until it ends.' : 'No card here yet.'}</div>}

      {open && (
        <Token3DViewer visible onClose={() => setOpen(null)} {...(({ rarity, country, terrain, tokenNo, hexPerDay, ...rest }) => ({
            ...rest, rarityKey: rarity, face: { country, terrain, tokenNo, hexPerDay } }))(faceOf(family, open) as any)}
          h3Index={family === 'rare' || family === 'history' ? open.h3_index : undefined}
          infoPanel={
        <div className="hx-card" style={{ width: 'min(560px, calc(100vw - 32px))', borderColor: 'var(--hx-accent, #7950f2)', textTransform: 'none', letterSpacing: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div className="hx-section-title" style={{ margin: 0 }}>{open.name}</div>
            <button className="hx-nudge__x" aria-label="Close card" onClick={() => setOpen(null)}>×</button>
          </div>
          {family === 'creatures' && <p style={{ fontSize: 13, lineHeight: 1.45, margin: '8px 0' }}>{open.description}</p>}
          {(family === 'history' || family === 'events') && <>
            <p style={{ fontSize: 12, color: 'var(--hx-text-2)', margin: '6px 0 0' }}>{dateLabel(open.event_date)}{open.location ? ` · ${open.location}` : ''} · {String(open.rarity).toUpperCase()}</p>
            {open.description && <p style={{ fontSize: 13, lineHeight: 1.45, margin: '8px 0' }}>{open.description}</p>}
          </>}
          {family === 'rare' && <>
            <p style={{ fontSize: 13, lineHeight: 1.45, margin: '8px 0' }}>{open.description}</p>
            {open.fun_fact && <p style={{ fontSize: 12, color: 'var(--hx-text-2)', margin: '0 0 8px' }}>Did you know? {open.fun_fact}</p>}
          </>}
          {family === 'biomes' && <p style={{ fontSize: 13, margin: '8px 0' }}>
            Resources: {open.resources.map((r: any) => r.name).join(', ') || 'none'}.
            {open.owned ? ` You hold ${open.territories} territor${open.territories > 1 ? 'ies' : 'y'} here.` : ' Claim a territory in this region to unlock it.'}
          </p>}
          {family === 'resources' && <p style={{ fontSize: 13, margin: '8px 0' }}>
            Used for: {open.strategic_use}. {open.owned ? `Stock ${fmt(open.amount)} · produced ${fmt(open.total_produced)} so far · +${fmt(open.rate_per_day)}/day.` : 'None of your territories produce it yet.'}
          </p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(open.lat !== undefined || open.center) && (
              <button className="btn-game btn-game-blue" onClick={() => {
                const [lat, lon] = open.center || [open.lat, open.lon]
                setOpen(null); flyTo({ lat, lon, zoom: open.center ? 6 : 14 })
              }}>SHOW ON MAP</button>
            )}
            {open.wiki_url && <a className="btn-game btn-game-gold" href={open.wiki_url} target="_blank" rel="noreferrer">{family === 'events' ? 'SOURCE' : 'WIKIPEDIA'}</a>}
          </div>
        </div>} />
      )}
    </div>
  )
}
