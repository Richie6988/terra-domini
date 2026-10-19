/**
 * RadarWidget — the safari radar (owner 2026-10-19: "use the radar to find a territory somewhere in the world where an
 * animal or a flower token is"). Real data only (the old widget drew random blips).
 *
 * World hunt running (GET /api/safari/active/, mode 'world'): SCAN pings from the map centre (POST /safari/scan/) →
 * direction arrow + distance band (freezing → cold → warm → hot → burning → here). Within capture range: CATCH
 * (POST /safari/probe/ {lat, lon}) → the creature's token goes into the album.
 * No hunt: a small radar button that opens the Safari panel.
 */
import { rarityLabel } from '../../services/balance'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { IconSVG } from './iconBank'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'
import { BAND } from '../hud/DailyHuntPanel'

const CAT_ICON: Record<string, string> = { animal: 'lion', fossil: 'dinosaur', insect: 'butterfly', vegetal: 'orchid', mushroom: 'fungus', microOrganism: 'microscope', fantasy: 'dragon' }
const MONO = "'Share Tech Mono', monospace"

export function RadarWidget() {
  const qc = useQueryClient()
  const isAuth = useStore(s => s.isAuthenticated)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data } = useQuery({ queryKey: ['safari-active'], queryFn: () => api.get('/safari/active/').then(r => r.data), enabled: isAuth, staleTime: 15000 })
  const t = data?.target
  const hunt = t && t.mode === 'world' && t.status === 'active' ? t : null
  const scans = (hunt?.probes || []).filter((p: any) => p.band)        // radar pings (taps on hexes have no band)
  const last = scans[scans.length - 1]
  const band = last ? BAND[last.band] : null

  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener('hx:radar-open', on)
    return () => window.removeEventListener('hx:radar-open', on)
  }, [])

  const scan = async () => {
    const [lat, lon] = useStore.getState().mapCenter
    setBusy(true)
    try {
      const { data: r } = await api.post('/safari/scan/', { lat, lon })
      qc.setQueryData(['safari-active'], (o: any) => ({ ...o, target: r.fled ? null : r.target }))
      if (r.fled) { playSound('flee'); toast.error(`${r.target?.creature_name || 'It'} fled — out of scans.`) }
      else playSound(r.band === 'here' ? 'bonus' : 'probe')
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Scan failed') }
    setBusy(false)
  }
  // Last step: the striped zone is on the map — zoom on it and tap the hex hiding the creature (SafariZoneLayer)
  const showZone = () => {
    if (last) window.dispatchEvent(new CustomEvent('terra:flyto', { detail: { lat: last.lat, lon: last.lon, zoom: 14 } }))
    setOpen(false)
  }

  if (!isAuth) return null

  // Idle: small radar button → Safari panel
  if (!hunt || !open) {
    return (
      <button onClick={() => hunt ? setOpen(true) : useStore.getState().setActivePanel('hunt' as any)} className="hx-radar-btn"
        aria-label={hunt ? 'Open the safari radar' : 'Start a safari hunt'}
        style={{ position: 'fixed', right: 16, bottom: 110, zIndex: 900, width: 76, height: 76, borderRadius: '50%', cursor: 'pointer',
          background: 'radial-gradient(circle, rgba(8,30,40,0.92) 55%, rgba(8,30,40,0.7))', border: `2px solid ${band?.color || '#22d3ee'}`,
          boxShadow: `0 0 18px ${(band?.color || '#22d3ee')}66`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: '#fff' }}>
        <span className="hx-radar-sweep" />
        <IconSVG id={hunt ? CAT_ICON[hunt.creature_category] || 'lion' : 'safari_radar'} size={28} />
        <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 1, fontFamily: 'var(--font-heading)', color: band?.color || '#a5f3fc' }}>
          {hunt ? (band ? band.label : `${hunt.tries_left}/${hunt.scans_max ?? hunt.tries_left} SCANS`) : 'SAFARI'}</span>
      </button>
    )
  }

  // Open: the radar dial
  const ang = (last?.bearing ?? 0) - 90
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 110, zIndex: 900, width: 250, padding: 12, borderRadius: 18,
      background: 'linear-gradient(180deg, rgba(10,24,40,0.96), rgba(6,14,26,0.96))', border: `2px solid ${band?.color || '#22d3ee'}`,
      boxShadow: '0 12px 30px rgba(0,0,0,0.5)', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <IconSVG id={CAT_ICON[hunt.creature_category] || 'lion'} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, fontFamily: 'var(--font-heading)' }}>??? · {rarityLabel(hunt.rarity)}</div>
          <div style={{ fontSize: 10, color: '#fde68a', textTransform: 'none', lineHeight: 1.3 }}>{hunt.hint}</div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Minimise the radar" className="hx-chip" style={{ cursor: 'pointer' }}>—</button>
      </div>
      <svg viewBox="-60 -60 120 120" style={{ width: '100%', display: 'block' }} aria-label="Radar">
        <circle r="56" fill="#04121c" stroke="#164e63" strokeWidth="1.5" />
        {[18, 36].map(r => <circle key={r} r={r} fill="none" stroke="#164e63" strokeWidth="1" />)}
        <line x1="-56" y1="0" x2="56" y2="0" stroke="#164e63" strokeWidth="0.8" /><line x1="0" y1="-56" x2="0" y2="56" stroke="#164e63" strokeWidth="0.8" />
        <text x="0" y="-47" textAnchor="middle" fontSize="7" fill="#67e8f9" fontWeight="900">N</text>
        <g className="hx-radar-dial-sweep"><path d="M0 0 L0 -56 A56 56 0 0 1 28 -48.5 Z" fill="rgba(34,211,238,0.18)" /></g>
        {last && last.band !== 'here' && (
          <g transform={`rotate(${ang + 90})`}>
            <line x1="0" y1="0" x2="0" y2="-44" stroke={band?.color} strokeWidth="4" strokeLinecap="round" />
            <path d="M0 -54 L-7 -40 L7 -40 Z" fill={band?.color} />
          </g>
        )}
        {last?.band === 'here' && <circle r="12" fill={band?.color} opacity="0.9" />}
        <circle r="3" fill="#e2e8f0" />
      </svg>
      <div style={{ textAlign: 'center', margin: '6px 0 8px' }}>
        {last
          ? <><div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: band?.color }}>{band?.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 13 }}>{last.km.toLocaleString()} km {last.band !== 'here' ? `· ${Math.round(last.bearing)}°` : ''}</div></>
          : <div style={{ fontSize: 11, color: 'var(--hx-text-2)', textTransform: 'none' }}>Move the map, then scan from its centre.</div>}
      </div>
      {last?.band === 'here'
        ? <button onClick={showZone} className="btn-game btn-game-green" style={{ width: '100%', fontSize: 13, minHeight: 44 }}>SHOW THE ZONE · TAP THE RIGHT HEX</button>
        : <button onClick={scan} disabled={busy} className="btn-game btn-game-gold" style={{ width: '100%', fontSize: 13, minHeight: 44 }}>
            {busy ? 'SCANNING…' : `SCAN FROM MAP CENTRE · ${hunt.tries_left}/${hunt.scans_max ?? hunt.tries_left}`}</button>}
    </div>
  )
}
