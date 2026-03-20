/**
 * GeoNewsLayer — live geopolitical/seismic events on the map.
 * Fetches /api/pois/news/ every 5 minutes.
 * Shows earthquakes, conflicts, disasters as animated markers.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'

type QuakeEvent = { title: string; lat: number; lon: number; magnitude: number; threat: string; time: string }
type ConflictEvent = { title: string; url: string; source: string; date: string }

function makeQuakeIcon(mag: number, threat: string): L.DivIcon {
  const color = threat === 'high' ? '#EF4444' : threat === 'medium' ? '#F59E0B' : '#10B981'
  const size = mag >= 7 ? 36 : mag >= 6 ? 28 : 22
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${size*0.4}px;animation:tdPulse 1.5s infinite;box-shadow:0 0 ${size}px ${color}66">🌊</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  })
}

interface Props {
  map: L.Map | null
  visible: boolean
}

export function GeoNewsLayer({ map, visible }: Props) {
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['geo-news'],
    queryFn: () => api.get('/pois/news/').then(r => r.data).catch(() => ({ earthquakes: [], conflicts: [] })),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 4 * 60 * 1000,
  })

  const earthquakes: QuakeEvent[] = data?.earthquakes ?? []
  const conflicts: ConflictEvent[] = data?.conflicts ?? []
  const total = earthquakes.length + conflicts.length

  useEffect(() => {
    if (!map) return
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove(); layerRef.current = null }
  }, [map])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!visible) return

    earthquakes.forEach(q => {
      const marker = L.marker([q.lat, q.lon], { icon: makeQuakeIcon(q.magnitude, q.threat) })
      marker.bindTooltip(`
        <div style="background:#08080F;color:#fff;padding:8px 12px;border-radius:10px;border:1px solid rgba(239,68,68,0.4);font-size:11px;min-width:180px">
          <div style="font-weight:700;color:#EF4444">🌊 M${q.magnitude} Earthquake</div>
          <div style="color:#9CA3AF;margin-top:3px">${q.title.replace(/^M[\d.]+ Earthquake: /,'')}</div>
          <div style="color:#4B5563;font-size:10px;margin-top:3px">${new Date(q.time).toLocaleString()}</div>
        </div>
      `, { className: 'td-resource-tooltip', direction: 'top', sticky: true })
      layer.addLayer(marker)
    })
  }, [earthquakes, visible])

  return (
    <>
      {/* News badge */}
      {visible && total > 0 && (
        <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 900 }}>
          <button onClick={() => setShowPanel(v => !v)}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 20, padding: '6px 16px', color: '#EF4444', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'tdPulse 1s infinite' }} />
            {earthquakes.length > 0 && `🌊 ${earthquakes.length} seismic`}
            {conflicts.length > 0 && ` · ⚔️ ${conflicts.length} conflicts`}
            {' '} live
          </button>
        </div>
      )}

      {/* News panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'fixed', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, width: 380, maxHeight: 480, background: '#08080F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📡 Live World Events</div>
                <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}</div>
              </div>
              <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 400 }}>
              {earthquakes.length > 0 && (
                <div style={{ padding: '10px 16px' }}>
                  <div style={{ fontSize: 10, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>🌊 Seismic Activity</div>
                  {earthquakes.map((q, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{q.title.replace(/^M[\d.]+ Earthquake: /,'').slice(0,45)}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: q.threat === 'high' ? '#EF4444' : '#F59E0B', fontFamily: 'monospace', flexShrink: 0 }}>M{q.magnitude}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{new Date(q.time).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {conflicts.length > 0 && (
                <div style={{ padding: '10px 16px' }}>
                  <div style={{ fontSize: 10, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>⚔️ Geopolitical Events</div>
                  {conflicts.map((c, i) => (
                    <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none' }}>
                      <div style={{ fontSize: 12, color: '#E5E7EB', lineHeight: 1.4 }}>{c.title.slice(0,80)}</div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{c.source}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
