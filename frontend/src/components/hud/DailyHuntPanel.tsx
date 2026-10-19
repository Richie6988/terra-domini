/**
 * DailyHuntPanel — Safari (2026-10-18 redesign, desk-friendly: no GPS walking).
 *
 * A real species from the HEXOD master DB hides on a free hex where it really lives (or, until its sightings are
 * known, within 60 km of your land). Clue + radar (RadarWidget: direction and distance from the map centre), then
 * catch it: its card goes into your album AND its hex becomes yours — a new base far from home (owner 2026-10-19).
 * 5 free hunts a day, then more at a price that climbs with each hunt until tomorrow. Server is the referee: the hidden hex is never sent to the client.
 *
 * API: GET /safari/active/ · POST /safari/spawn/ · POST /safari/scan/ {lat,lon} · POST /safari/probe/ {lat,lon} · POST /safari/abandon/
 */
import { rarityLabel } from '../../services/balance'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'

interface Props { onClose: () => void }

const RARITY_COLORS: Record<string, string> = {
  common: '#cd7f32', uncommon: '#cbd5e1', rare: '#fbbf24', epic: '#10b981', legendary: '#67e8f9', mythic: '#ec4899',
}
const CAT: Record<string, { label: string; icon: string }> = {
  animal: { label: 'Animal', icon: 'lion' }, fossil: { label: 'Dinosaur & fossil', icon: 'dinosaur' },
  insect: { label: 'Insect', icon: 'butterfly' }, vegetal: { label: 'Plant', icon: 'orchid' },
  mushroom: { label: 'Fungus', icon: 'fungus' }, microOrganism: { label: 'Microbe', icon: 'microscope' },
  fantasy: { label: 'Fantastic creature', icon: 'dragon' },
}

interface Target {
  creature_name: string; creature_category: string; creature_description: string; creature_wiki_url: string
  id: string; rarity: string; hex_reward: number; status: string; tries_left: number; scans_max?: number
  probes: { h3?: string; ring?: number; km?: number; band?: string; bearing?: number }[]; grid: { h3: string; i: number; j: number }[]
  center_h3: string; target_h3?: string
  mode?: 'world' | 'local'; hint?: string; clue_lat?: number; clue_lon?: number; capture_km?: number
}
export const BAND: Record<string, { label: string; color: string }> = {
  freezing: { label: 'FREEZING', color: '#64748b' }, cold: { label: 'COLD', color: '#38bdf8' }, warm: { label: 'WARM', color: '#f59e0b' },
  hot: { label: 'HOT', color: '#f97316' }, burning: { label: 'BURNING', color: '#ef4444' }, here: { label: 'IT IS HERE', color: '#22c55e' },
}
/** World hunt: close the panel, fly to the clue's region and open the radar. */
export function openRadarHunt(t: { clue_lat?: number; clue_lon?: number }) {
  useStore.getState().setActivePanel(null)
  if (t.clue_lat != null) window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat: t.clue_lat, lon: t.clue_lon, zoom: 6 } }))
  window.dispatchEvent(new CustomEvent('hx:radar-open'))
}

export function DailyHuntPanel({ onClose }: Props) {
  const qc = useQueryClient()
  const center = useStore(s => s.mapCenter)
  const [last, setLast] = useState<Target | null>(null)   // finished hunt (captured / fled), kept for the reveal

  const { data, isLoading } = useQuery({
    queryKey: ['safari-active'],
    queryFn: () => api.get('/safari/active/').then(r => r.data),
  })
  // A hunt from the old GPS version has no hunting ground: drop it instead of crashing
  const raw = data?.target || null
  const legacy = !!raw && raw.mode !== 'world'   // old honeycomb hunt: replaced by the radar hunt
  useEffect(() => {
    if (legacy) api.post('/safari/abandon/').finally(() => qc.setQueryData(['safari-active'], { target: null }))
  }, [legacy])
  const active: Target | null = legacy ? null : raw
  const t = active || last

  const spawn = useMutation({
    mutationFn: () => api.post('/safari/spawn/', { lat: center?.[0], lon: center?.[1] }).then(r => r.data),
    onSuccess: d => {
      playSound('explore'); setLast(null); toast.success(d.message)
      qc.setQueryData(['safari-active'], { target: d.target, hunts_today: d.hunts_today, free_hunts: d.free_hunts, next_hunt_cost: d.next_hunt_cost })
      if (d.paid) { const st = useStore.getState(); st.setBalance({ ...(st.balance || {}), in_game: Number(st.balance?.in_game || 0) - d.paid } as any) }
      if (d.target?.mode === 'world') openRadarHunt(d.target)    // straight to the radar, in the clue's region
    },
    onError: (e: any) => toast.error(e?.response?.data?.error
      || (e?.response?.status >= 500 ? 'Safari is unavailable on the server (update pending?) — try again later' : 'Could not start a hunt')),
  })
  // 5 free hunts a day, then a price that climbs with each hunt until tomorrow (GET /safari/active/ next_hunt_cost)
  const price: number = data?.next_hunt_cost ?? 0
  const freeLeft = Math.max(0, (data?.free_hunts ?? 5) - (data?.hunts_today ?? 0))
  const huntLabel = (txt: string) => price ? <>{txt} · <IconSVG id="hex_coin" size={14} />{price.toLocaleString()}</> : <>{txt}{freeLeft < 5 ? ` · ${freeLeft} FREE LEFT` : ''}</>
  const col = t ? RARITY_COLORS[t.rarity] || '#94a3b8' : '#f97316'
  const cat = t ? CAT[t.creature_category] : undefined
  const captured = t?.status === 'captured'
  const revealed = !!t && t.status !== 'active'

  return (
    <GlassPanel title="SAFARI" onClose={onClose} accent="#f97316" width={480}
      icon={<IconSVG id="safari_radar" size={24} />} subtitle="Find real creatures where they live · 5 free hunts a day">
      {isLoading && <div className="hx-skeleton" style={{ height: 260, borderRadius: 16 }} />}

      {!isLoading && !t && (
        <div style={{ textAlign: 'center' }}>
          <div className="hx-card hx-card--accent" style={{ marginBottom: 14, textTransform: 'none', letterSpacing: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              {Object.values(CAT).map(c => <IconSVG key={c.icon} id={c.icon} size={30} />)}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff' }}>4,401 REAL SPECIES TO COLLECT</div>
            <div style={{ fontSize: 13, color: 'var(--hx-text-2)', marginTop: 6, lineHeight: 1.45 }}>
              Animals, dinosaurs, insects, plants, fungi and microbes, each where it really lives on Earth — and now and then a fantastic creature.
              You get a clue, then scan with the radar from the map centre: direction and distance, hotter and hotter.
              Close enough? Catch it — its token goes into your album and its hex becomes yours, however far from home:
              a new base to grow another kingdom.
            </div>
          </div>
          <button onClick={() => spawn.mutate()} disabled={spawn.isPending} className="btn-game btn-game-gold" style={{ width: '100%', fontSize: 15, minHeight: 52 }}>
            {spawn.isPending ? 'LOOKING FOR TRACKS…' : huntLabel('START A HUNT')}
          </button>
        </div>
      )}

      {t && (
        <motion.div key={(t.center_h3 || t.id) + t.status} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, borderColor: col,
            background: `linear-gradient(160deg, ${col}30, transparent 70%)` }}>
            <span style={{ width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${col}2a`, border: `3px solid ${col}`, flexShrink: 0 }}>
              <IconSVG id={cat?.icon || 'animal'} size={34} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.45)' }}>
                {revealed ? t.creature_name : '???'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{rarityLabel(t.rarity)} · {(cat?.label || 'Creature').toUpperCase()}</div>
            </div>
            <div className="hx-stat" style={{ alignItems: 'flex-end' }}>
              <span className="hx-stat__label">REWARD</span>
              <span className="hx-stat__value" style={{ color: '#fbbf24' }}>{t.hex_reward}</span>
            </div>
          </div>

          {t.mode === 'world' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="hx-card" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14, color: '#fde68a', fontWeight: 800 }}>{t.hint}</div>
              {(t.probes || []).slice(-5).reverse().map((p, k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--hx-text-2)' }}>
                  <span className="hx-chip" style={{ color: BAND[p.band || 'cold']?.color }}>{BAND[p.band || 'cold']?.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{p.km?.toLocaleString()} km</span>
                </div>
              ))}
              {!revealed && <button className="btn-game btn-game-gold" style={{ width: '100%', minHeight: 48, fontSize: 14 }} onClick={() => openRadarHunt(t)}>
                HUNT WITH THE RADAR · {t.tries_left}/{t.scans_max ?? t.tries_left} SCANS</button>}
            </div>
          ) : null}

          {!revealed && t.mode !== 'world' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 }}>
              <span className="hx-chip">{t.tries_left}/{t.scans_max ?? t.tries_left} SCANS LEFT</span>
              <span style={{ fontSize: 12, color: 'var(--hx-text-2)', textTransform: 'none' }}>Numbers = rings away from it</span>
            </div>
          )}

          {revealed && (
            <div className="hx-card" style={{ marginTop: 12, textTransform: 'none', letterSpacing: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: captured ? '#86efac' : '#fca5a5', marginBottom: 6 }}>
                {captured ? 'NEW CARD IN YOUR ALBUM · ITS HEX IS YOURS' : 'IT GOT AWAY'}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.45, margin: 0 }}>{t.creature_description}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn-game btn-game-gold" onClick={() => spawn.mutate()} disabled={spawn.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{huntLabel('NEW HUNT')}</button>
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
