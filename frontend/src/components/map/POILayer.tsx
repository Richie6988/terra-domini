/**
 * POILayer — renders World Points of Interest on the game map.
 * Shows: strategic chokepoints, conflict zones, live events (Hormuz crisis).
 * Includes: animated news ticker + detail pop-up panel.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import type L from 'leaflet'

// ─── Types ────────────────────────────────────────────────────────────────────

interface POI {
  id: string
  slug: string
  name: string
  category: string
  threat: 'none' | 'low' | 'medium' | 'high' | 'critical'
  lat: number
  lon: number
  radius_km: number
  icon: string
  color: string
  pulse: boolean
  featured: boolean
  effects_summary: string
  live: boolean
}

interface POIDetail extends POI {
  full_description: string
  real_world_data: Record<string, unknown>
  effects: Record<string, unknown>
  news_updates: Array<{
    headline: string
    body: string
    url: string
    impact: Record<string, unknown>
    published: string
  }>
  controlling_alliance: { id: string; tag: string } | null
  stabilize_progress: number
  exploit_progress: number
}

interface NewsItem {
  poi_name: string
  poi_icon: string
  poi_color: string
  poi_category: string
  poi_threat: string
  headline: string
  body: string
  url: string
  published: string
  poi_lat: number
  poi_lon: number
}

// ─── Threat colors ────────────────────────────────────────────────────────────

const THREAT_CONFIG = {
  critical: { color: '#FF3B30', bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.4)',  label: '🔴 CRITICAL' },
  high:     { color: '#FF6B35', bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.35)', label: '🟠 HIGH' },
  medium:   { color: '#FFB800', bg: 'rgba(255,184,0,0.10)',  border: 'rgba(255,184,0,0.35)',  label: '🟡 MEDIUM' },
  low:      { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', label: '🔵 LOW' },
  none:     { color: '#6B7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)', label: '⚪ STABLE' },
}

const CATEGORY_LABELS: Record<string, string> = {
  chokepoint: '🚢 Chokepoint', capital: '🏛️ Capital', landmark: '🏛️ Landmark',
  port: '⚓ Port', military_base: '🪖 Military', energy: '⚡ Energy',
  conflict_zone: '⚔️ Conflict Zone', diplomatic: '🕊️ Diplomatic',
  disaster: '🌪️ Disaster', election: '🗳️ Election', economic: '📉 Economic',
  cultural: '🎭 Cultural', space: '🚀 Space', control_tower: '🗼 Tower',
  trade_route: '💱 Trade Route',
}

// ─── News Ticker ──────────────────────────────────────────────────────────────

export function POINewsTicker() {
  const { data } = useQuery({
    queryKey: ['poi-featured'],
    queryFn: () => api.get('/pois/featured/').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: newsData } = useQuery({
    queryKey: ['poi-news'],
    queryFn: () => api.get('/pois/news-feed/').then(r => r.data),
    refetchInterval: 120000,
  })

  const featured: POI[] = data?.featured ?? []
  const news: NewsItem[] = newsData?.news ?? []

  if (featured.length === 0 && news.length === 0) return null

  // Build ticker items from featured POIs
  const tickerItems = [
    ...featured.map(p => ({ text: `${p.icon} ${p.name.toUpperCase()} — ${p.effects_summary}`, color: p.color, threat: p.threat })),
    ...(news ?? []).slice(0, 5).map(n => ({ text: `${n.poi_icon} ${n.headline}`, color: n.poi_color, threat: n.poi_threat })),
  ]

  if (tickerItems.length === 0) return null

  return (
    <div style={{
      position: 'absolute', bottom: 72, left: 0, right: 360, zIndex: 800,
      overflow: 'hidden', height: 36,
      background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,59,48,0.3)',
    }}>
      {/* Breaking indicator */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2,
        display: 'flex', alignItems: 'center',
        padding: '0 12px',
        background: '#FF3B30',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        fontWeight: 700, color: '#fff', letterSpacing: '0.15em',
        whiteSpace: 'nowrap',
      }}>
        ⚡ LIVE
      </div>

      <div style={{
        position: 'absolute', left: 56, right: 0, top: 0, bottom: 0, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', height: '100%',
          animation: `tickerScroll ${tickerItems.length * 8}s linear infinite`,
          whiteSpace: 'nowrap',
        }}>
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
              color: item.threat === 'critical' ? '#FF3B30' : item.threat === 'high' ? '#FF9500' : '#E8E8F0',
              paddingRight: 60, letterSpacing: '0.04em',
            }}>
              {item.text}
              <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 30 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ─── POI Map Markers (injected into Leaflet) ──────────────────────────────────

interface POILayerProps {
  leafletMap: L.Map | null
  onPOIClick: (poi: POI) => void
}

export function POIMapLayer({ leafletMap, onPOIClick }: POILayerProps) {
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  const { data } = useQuery({
    queryKey: ['poi-map'],
    queryFn: () => api.get('/pois/map/').then(r => r.data),
    refetchInterval: 300000, // 5 min
  })

  const pois: POI[] = data?.pois ?? []

  useEffect(() => {
    if (!leafletMap) return
    // Dynamic import to avoid SSR issues
    import('leaflet').then(L => {
      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()

      pois.forEach(poi => {
        const tc = THREAT_CONFIG[poi.threat] ?? THREAT_CONFIG.none

        // Custom icon HTML
        const iconHtml = `
          <div style="
            position: relative;
            display: flex; align-items: center; justify-content: center;
            width: 36px; height: 36px;
          ">
            ${poi.pulse ? `<div style="
              position: absolute; inset: 0; border-radius: 50%;
              background: ${tc.color}; opacity: 0.3;
              animation: poiPulse 1.5s ease-in-out infinite;
            "></div>` : ''}
            <div style="
              width: 32px; height: 32px; border-radius: 50%;
              background: ${tc.bg};
              border: 2px solid ${tc.color};
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; cursor: pointer;
              box-shadow: 0 0 ${poi.threat === 'critical' ? '12px' : '4px'} ${tc.color}60;
              backdrop-filter: blur(4px);
              transition: transform 0.15s;
            ">
              ${poi.icon}
            </div>
          </div>
        `

        const icon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const marker = L.marker([poi.lat, poi.lon], { icon })
          .on('click', () => onPOIClick(poi))
          .addTo(leafletMap)

        // Radius circle for high threat POIs
        if (poi.threat === 'critical' || poi.threat === 'high') {
          L.circle([poi.lat, poi.lon], {
            radius: poi.radius_km * 1000,
            color: tc.color,
            weight: 1,
            fill: true,
            fillColor: tc.color,
            fillOpacity: 0.04,
            dashArray: '4 6',
          }).addTo(leafletMap)
        }

        markersRef.current.set(poi.id, marker)
      })
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
    }
  }, [leafletMap, pois])

  // Inject pulse animation CSS
  return (
    <style>{`
      @keyframes poiPulse {
        0%, 100% { transform: scale(1); opacity: 0.3; }
        50% { transform: scale(1.8); opacity: 0; }
      }
    `}</style>
  )
}

// ─── POI Detail Panel ─────────────────────────────────────────────────────────

export function POIDetailPanel({ poiId, onClose }: { poiId: string; onClose: () => void }) {
  const [missionType, setMissionType] = useState<'intel' | 'stabilize' | 'exploit' | null>(null)
  const [units, setUnits] = useState(10)
  const [missionResult, setMissionResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: poi, isLoading } = useQuery<POIDetail>({
    queryKey: ['poi-detail', poiId],
    queryFn: () => api.get(`/pois/${poiId}/detail/`).then(r => r.data),
  })

  const sendMission = async () => {
    if (!missionType || !poi) return
    setLoading(true)
    try {
      const res = await api.post(`/pois/${poi.id}/interact/`, { action: missionType, units })
      setMissionResult(res.data.outcome)
    } catch {
      setMissionResult('Mission failed — insufficient resources.')
    } finally { setLoading(false) }
  }

  if (isLoading || !poi) {
    return (
      <motion.div initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
        style={panelStyle}>
        <div style={{ padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading POI data…</div>
      </motion.div>
    )
  }

  const tc = THREAT_CONFIG[poi.threat as keyof typeof THREAT_CONFIG] ?? THREAT_CONFIG.none
  const mults: Record<string, number> = (poi.effects as any)?.resource_multipliers ?? {}

  return (
    <motion.div initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={panelStyle}
    >
      {/* Header */}
      <div style={{
        padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: tc.bg, borderLeft: `3px solid ${tc.color}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28 }}>{poi.icon}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginTop: 8, lineHeight: 1.3 }}>{poi.name}</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ ...tagStyle, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
            {tc.label}
          </span>
          <span style={{ ...tagStyle, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {CATEGORY_LABELS[poi.category] ?? poi.category}
          </span>
          {poi.live && (
            <span style={{ ...tagStyle, background: 'rgba(255,59,48,0.15)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.3)' }}>
              🔴 LIVE EVENT
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>
          {poi.full_description}
        </p>

        {/* Real-world data */}
        {Object.keys(poi.real_world_data).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>📊 Real-World Data</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(poi.real_world_data ?? {}).slice(0, 6).map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 11 }}>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div style={{ color: '#E5E7EB', fontFamily: 'monospace', fontWeight: 500 }}>
                    {typeof v === 'boolean' ? (v ? '✅ Yes' : '❌ No') : String(v).slice(0, 30)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game effects */}
        {Object.keys(mults).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>⚙️ Active Game Effects (in {poi.radius_km}km radius)</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(mults).map(([resource, mult]) => {
                const pct = Math.round((mult - 1) * 100)
                const isNeg = pct < 0
                return (
                  <div key={resource} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: isNeg ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                    borderRadius: 4, fontSize: 12,
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{resource}</span>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 700,
                      color: isNeg ? '#EF4444' : '#10B981',
                    }}>
                      {pct > 0 ? '+' : ''}{pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* News updates */}
        {poi.news_updates.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>📰 Intel Updates</SectionLabel>
            {(poi.news_updates ?? []).slice(0, 5).map((n, i) => (
              <div key={i} style={{
                padding: '10px 12px', marginBottom: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#E5E7EB', marginBottom: 4 }}>{n.headline}</div>
                {n.body && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{n.body}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                    {new Date(n.published).toLocaleDateString()}
                  </span>
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: '#3B82F6', textDecoration: 'none' }}>
                      Source →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mission launcher */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>🎯 Send a Mission</SectionLabel>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {([
              { type: 'intel', label: '🔍 Intel', desc: 'Gather info' },
              { type: 'stabilize', label: '🛡️ Stabilize', desc: 'Reduce effects' },
              { type: 'exploit', label: '💰 Exploit', desc: 'Earn TDC' },
            ] as const).map(m => (
              <button key={m.type} onClick={() => setMissionType(m.type)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 6, border: '1px solid',
                cursor: 'pointer', fontSize: 11, textAlign: 'center',
                background: missionType === m.type ? 'rgba(0,255,135,0.12)' : 'rgba(255,255,255,0.04)',
                borderColor: missionType === m.type ? 'rgba(0,255,135,0.5)' : 'rgba(255,255,255,0.08)',
                color: missionType === m.type ? '#00FF87' : 'rgba(255,255,255,0.6)',
              }}>
                <div style={{ fontWeight: 500 }}>{m.label}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {missionType && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={1} max={1000} value={units}
                onChange={e => setUnits(parseInt(e.target.value) || 1)}
                style={{ width: 80, padding: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, textAlign: 'center' }}
              />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>intel units</span>
              <button onClick={sendMission} disabled={loading} style={{
                flex: 1, padding: '9px', background: '#059669', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                {loading ? 'Deploying…' : 'Send Mission'}
              </button>
            </div>
          )}

          {missionResult && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.2)', borderRadius: 6, fontSize: 12, color: '#6EE7B7' }}>
              {missionResult}
            </div>
          )}
        </div>

        {/* Alliance control */}
        {poi.controlling_alliance && (
          <div style={{ padding: '10px 12px', background: 'rgba(123,47,255,0.1)', border: '1px solid rgba(123,47,255,0.3)', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#C084FC' }}>🏰 Controlled by [{poi.controlling_alliance.tag}]</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── POI Manager (top-level component to wire everything) ─────────────────────

export function POIManager({ leafletMap }: { leafletMap: L.Map | null }) {
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null)

  const handlePOIClick = useCallback((poi: POI) => {
    setSelectedPOI(poi)
  }, [])

  return (
    <>
      <POIMapLayer leafletMap={leafletMap} onPOIClick={handlePOIClick} />
      <POINewsTicker />

      <AnimatePresence>
        {selectedPOI && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 1100 }}>
            <POIDetailPanel
              poiId={selectedPOI.id}
              onClose={() => setSelectedPOI(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
  background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(12px)',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}
const tagStyle: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
  letterSpacing: '0.05em',
}




function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>
      {children}
    </div>
  )
}
