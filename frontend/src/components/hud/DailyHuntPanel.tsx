/**
 * DailyHuntPanel — Safari (2026-10-18 redesign, desk-friendly: no GPS walking).
 *
 * A real species from the HEXOD master DB (animals, dinosaurs/fossils, insects, plants, fungi, microbes)
 * hides in one of the 19 real hexes around one of your territories. You have 4 scans: each miss tells
 * how many rings away it is. Find it → HEX + its card goes into your album (Codex > Creatures).
 * 5 hunts a day. Server is the referee: the hidden hex is never sent to the client.
 *
 * API: GET /safari/active/ · POST /safari/spawn/ · POST /safari/probe/ {h3} · POST /safari/abandon/
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'

interface Props { onClose: () => void }

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444',
}
const CAT: Record<string, { label: string; icon: string }> = {
  animal: { label: 'Animal', icon: 'lion' }, fossil: { label: 'Dinosaur & fossil', icon: 'dinosaur' },
  insect: { label: 'Insect', icon: 'butterfly' }, vegetal: { label: 'Plant', icon: 'orchid' },
  mushroom: { label: 'Fungus', icon: 'fungus' }, microOrganism: { label: 'Microbe', icon: 'microscope' },
}
// Ring distance → colour of a missed scan (1 = right next to it)
const RING_COLOR = ['#22c55e', '#ef4444', '#f97316', '#38bdf8', '#64748b']
const RING_LABEL = ['FOUND', 'VERY HOT', 'WARM', 'COLD', 'FREEZING']

interface Target {
  creature_name: string; creature_category: string; creature_description: string; creature_wiki_url: string
  rarity: string; hex_reward: number; status: string; tries_left: number
  probes: { h3: string; ring: number }[]; grid: { h3: string; i: number; j: number }[]; center_h3: string; target_h3?: string
}

function HuntGrid({ t, onProbe, busy }: { t: Target; onProbe: (h3: string) => void; busy: boolean }) {
  const D = 46                     // centre-to-centre distance
  const r = D / Math.sqrt(3) - 1.5 // pointy-top hex radius
  const pos = (i: number, j: number) => [(i - j / 2) * D, j * D * Math.sqrt(3) / 2]
  const pts = t.grid.map(g => pos(g.i, g.j))
  const minX = Math.min(...pts.map(p => p[0])) - r - 4, maxX = Math.max(...pts.map(p => p[0])) + r + 4
  const minY = Math.min(...pts.map(p => p[1])) - r - 4, maxY = Math.max(...pts.map(p => p[1])) + r + 4
  const probed = new Map(t.probes.map(p => [p.h3, p.ring]))
  const done = t.status !== 'active'
  const hexPath = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => {
    const a = Math.PI / 180 * (60 * k - 90)
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} style={{ width: '100%', maxWidth: 360, display: 'block', margin: '0 auto', touchAction: 'manipulation' }}
      role="grid" aria-label="Hunting ground: tap a hex to scan it">
      {t.grid.map((g, k) => {
        const [x, y] = pts[k]
        const ring = probed.get(g.h3)
        const isTarget = done && t.target_h3 === g.h3
        const isHome = g.h3 === t.center_h3
        const fill = isTarget ? '#22c55e' : ring !== undefined ? RING_COLOR[Math.min(ring, 4)] : isHome ? '#1e3a5f' : '#16304f'
        const clickable = !done && ring === undefined && !busy
        return (
          <g key={g.h3} onClick={() => clickable && onProbe(g.h3)} style={{ cursor: clickable ? 'pointer' : 'default' }}
            role="gridcell" aria-label={ring !== undefined ? RING_LABEL[Math.min(ring, 4)] : 'Unscanned hex'}>
            <polygon points={hexPath(x, y)} fill={fill} stroke={isTarget ? '#bbf7d0' : '#0b1626'} strokeWidth={3}
              style={{ filter: clickable ? 'drop-shadow(0 2px 0 rgba(0,0,0,0.5))' : undefined }} />
            {isHome && ring === undefined && !isTarget && <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="#93c5fd" fontWeight={900}>YOU</text>}
            {ring !== undefined && ring > 0 && <text x={x} y={y + 5} textAnchor="middle" fontSize={15} fill="#fff" fontWeight={900}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{ring}</text>}
            {isTarget && <foreignObject x={x - 14} y={y - 14} width={28} height={28}><IconSVG id={CAT[t.creature_category]?.icon || 'animal'} size={28} /></foreignObject>}
          </g>
        )
      })}
    </svg>
  )
}

export function DailyHuntPanel({ onClose }: Props) {
  const qc = useQueryClient()
  const center = useStore(s => s.mapCenter)
  const [last, setLast] = useState<Target | null>(null)   // finished hunt (captured / fled), kept for the reveal

  const { data, isLoading } = useQuery({
    queryKey: ['safari-active'],
    queryFn: () => api.get('/safari/active/').then(r => r.data),
  })
  const active: Target | null = data?.target || null
  const t = active || last

  const spawn = useMutation({
    mutationFn: () => api.post('/safari/spawn/', { lat: center?.[0], lon: center?.[1] }).then(r => r.data),
    onSuccess: d => { setLast(null); toast.success(d.message); qc.setQueryData(['safari-active'], { target: d.target }) },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'No tracks found'),
  })
  const probe = useMutation({
    mutationFn: (h3: string) => api.post('/safari/probe/', { h3 }).then(r => r.data),
    onSuccess: d => {
      if (d.result === 'miss') { qc.setQueryData(['safari-active'], { target: d.target }); return }
      setLast(d.target); qc.setQueryData(['safari-active'], { target: null })
      if (d.result === 'captured') {
        toast.success(d.message, { duration: 5000 })
        ;['loop-status', 'codex-cards', 'player'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      } else toast.error(d.message)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Scan failed'),
  })

  const col = t ? RARITY_COLORS[t.rarity] || '#94a3b8' : '#f97316'
  const cat = t ? CAT[t.creature_category] : undefined
  const captured = t?.status === 'captured'
  const revealed = !!t && t.status !== 'active'

  return (
    <GlassPanel title="SAFARI" onClose={onClose} accent="#f97316" width={480}
      icon={<IconSVG id="safari_radar" size={24} />} subtitle="Find real creatures near your land · 5 hunts a day">
      {isLoading && <div className="hx-skeleton" style={{ height: 260, borderRadius: 16 }} />}

      {!isLoading && !t && (
        <div style={{ textAlign: 'center' }}>
          <div className="hx-card hx-card--accent" style={{ marginBottom: 14, textTransform: 'none', letterSpacing: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              {Object.values(CAT).map(c => <IconSVG key={c.icon} id={c.icon} size={30} />)}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff' }}>4,401 REAL SPECIES TO COLLECT</div>
            <div style={{ fontSize: 13, color: 'var(--hx-text-2)', marginTop: 6, lineHeight: 1.45 }}>
              Animals, dinosaurs, insects, plants, fungi and microbes. One hides around your territory:
              scan the hexes — each miss says how many rings away it is. 4 scans to find it.
            </div>
          </div>
          <button onClick={() => spawn.mutate()} disabled={spawn.isPending} className="btn-game btn-game-gold" style={{ width: '100%', fontSize: 15, minHeight: 52 }}>
            {spawn.isPending ? 'LOOKING FOR TRACKS…' : 'START A HUNT'}
          </button>
        </div>
      )}

      {t && (
        <motion.div key={t.center_h3 + t.status} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, borderColor: col,
            background: `linear-gradient(160deg, ${col}30, transparent 70%)` }}>
            <span style={{ width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${col}2a`, border: `3px solid ${col}`, flexShrink: 0 }}>
              <IconSVG id={cat?.icon || 'animal'} size={34} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>
                {revealed ? t.creature_name : '???'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{t.rarity.toUpperCase()} · {(cat?.label || 'Creature').toUpperCase()}</div>
            </div>
            <div className="hx-stat" style={{ alignItems: 'flex-end' }}>
              <span className="hx-stat__label">REWARD</span>
              <span className="hx-stat__value" style={{ color: '#fbbf24' }}>{t.hex_reward}</span>
            </div>
          </div>

          <HuntGrid t={t} onProbe={h => probe.mutate(h)} busy={probe.isPending} />

          {!revealed && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 }}>
              <span className="hx-chip">{t.tries_left} SCAN{t.tries_left > 1 ? 'S' : ''} LEFT</span>
              <span style={{ fontSize: 12, color: 'var(--hx-text-2)', textTransform: 'none' }}>Numbers = rings away from it</span>
            </div>
          )}

          {revealed && (
            <div className="hx-card" style={{ marginTop: 12, textTransform: 'none', letterSpacing: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: captured ? '#86efac' : '#fca5a5', marginBottom: 6 }}>
                {captured ? 'NEW CARD IN YOUR ALBUM' : 'IT GOT AWAY — HERE IT WAS'}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.45, margin: 0 }}>{t.creature_description}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn-game btn-game-gold" onClick={() => spawn.mutate()} disabled={spawn.isPending}>NEW HUNT</button>
                {captured && <button className="btn-game btn-game-blue" onClick={() => useStore.getState().setActivePanel('codex' as any)}>OPEN ALBUM</button>}
                {t.creature_wiki_url && <a className="btn-game btn-game-glass" href={t.creature_wiki_url} target="_blank" rel="noreferrer">WIKIPEDIA</a>}
              </div>
            </div>
          )}
          {!revealed && (
            <button className="btn-game btn-game-glass" style={{ width: '100%', marginTop: 12, minHeight: 40, fontSize: 12 }}
              onClick={() => api.post('/safari/abandon/').then(() => qc.setQueryData(['safari-active'], { target: null }))}>LET IT GO</button>
          )}
        </motion.div>
      )}
    </GlassPanel>
  )
}
