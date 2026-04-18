/**
 * FavoritePins — save/load favorite map locations as pins.
 * Server-side via /api/players/pins/. LocalStorage fallback if not auth'd.
 */
import { useState, useEffect, useCallback } from 'react'
import { MapPin, Star, Trash2, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import { useStore } from '../../store'

export interface FavoritePin {
  id: string | number
  name: string
  lat: number
  lon: number
  emoji: string
  zoom: number
}

const PIN_EMOJIS = ['', '⭐', '', '', '', '', '', '', '', '']

export function useFavoritePins() {
  const [pins, setPins] = useState<FavoritePin[]>([])
  const isAuth = useStore(s => s.isAuthenticated)

  // Load from server
  useEffect(() => {
    if (!isAuth) return
    api.get('/players/pins/').then(r => {
      setPins(Array.isArray(r.data) ? r.data : [])
    }).catch(() => {})
  }, [isAuth])

  const addPin = useCallback(async (lat: number, lon: number, zoom: number, name?: string) => {
    const pinName = name || `Pin ${pins.length + 1}`
    const emoji = PIN_EMOJIS[pins.length % PIN_EMOJIS.length]
    try {
      const r = await api.post('/players/pins/', { name: pinName, emoji, lat, lon, zoom })
      setPins(prev => [...prev, r.data])
      toast.success(`${pinName} saved!`)
      return r.data
    } catch {
      toast.error('Failed to save pin')
    }
  }, [pins.length])

  const removePin = useCallback(async (id: string | number) => {
    try {
      await api.delete(`/players/pins/${id}/`)
      setPins(prev => prev.filter(p => p.id !== id))
    } catch { toast.error('Failed to delete pin') }
  }, [])

  const renamePin = useCallback(async (id: string | number, name: string) => {
    try {
      await api.patch(`/players/pins/${id}/`, { name })
      setPins(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    } catch {}
  }, [])

  const updateEmoji = useCallback(async (id: string | number, emoji: string) => {
    try {
      await api.patch(`/players/pins/${id}/`, { emoji })
      setPins(prev => prev.map(p => p.id === id ? { ...p, emoji } : p))
    } catch {}
  }, [])

  return { pins, addPin, removePin, renamePin, updateEmoji }
}

interface FavoritePanelProps {
  onNavigate: (lat: number, lon: number, zoom: number) => void
  currentLat: number
  currentLon: number
  currentZoom: number
}

export function FavoritePinsPanel({ onNavigate, currentLat, currentLon, currentZoom }: FavoritePanelProps) {
  const { pins, addPin, removePin, renamePin, updateEmoji } = useFavoritePins()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const pickingFavorite = useStore(s => s.pickingFavorite)
  const setPickingFavorite = useStore(s => s.setPickingFavorite)

  // Listen for territory pick events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.lat && detail?.lon) {
        const name = detail.name || `Territory ${pins.length + 1}`
        addPin(detail.lat, detail.lon, 15, name)
        setPickingFavorite(false)
      }
    }
    window.addEventListener('hexod:pick-favorite', handler)
    return () => window.removeEventListener('hexod:pick-favorite', handler)
  }, [addPin, pins.length, setPickingFavorite])

  return (
    <div style={{ position: 'absolute', bottom: 90, left: 12, zIndex: 500 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: pickingFavorite ? 'rgba(245,158,11,0.3)' : open ? 'rgba(204,136,0,0.12)' : 'rgba(13,27,42,0.92)',
          border: `1px solid ${pickingFavorite ? '#F59E0B' : open ? 'rgba(204,136,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
          cursor: 'pointer', color: pickingFavorite ? '#F59E0B' : open ? '#cc8800' : '#6b7280',
          animation: pickingFavorite ? 'pulse-ring 1.5s infinite' : 'none',
        }}
        title={pickingFavorite ? 'Click a territory to save' : 'Favorite locations'}
      >
        <Star size={15} />
      </button>

      {/* Pick mode indicator */}
      {pickingFavorite && (
        <div style={{
          position: 'absolute', bottom: 44, left: 0, width: 200,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
          fontSize: 9, color: '#F59E0B', fontWeight: 700, letterSpacing: 1,
          fontFamily: "'Orbitron', sans-serif",
        }}>
          TAP A TERRITORY TO SAVE IT
          <button onClick={() => setPickingFavorite(false)} style={{
            marginLeft: 8, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 8,
          }}>CANCEL</button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'absolute', bottom: 44, left: 0, width: 260,
              background: 'rgba(13,27,42,0.97)', backdropFilter: 'blur(20px)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#cc8800' }}>⭐ Saved Locations</span>
              <button
                onClick={() => { setPickingFavorite(true); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(204,136,0,0.08)', border: '1px solid rgba(204,136,0,0.2)', borderRadius: 6, color: '#cc8800', cursor: 'pointer', fontSize: 11 }}
              >
                <Plus size={11} /> Save here
              </button>
            </div>

            {/* Pin list */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {pins.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  No saved locations yet.<br />Navigate somewhere and click "Save here"
                </div>
              ) : pins.map(pin => (
                <div key={pin.id} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 16, cursor: 'pointer' }} onClick={() => {
                    const next = PIN_EMOJIS[(PIN_EMOJIS.indexOf(pin.emoji) + 1) % PIN_EMOJIS.length]
                    updateEmoji(pin.id, next)
                  }}>{pin.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingId === pin.id ? (
                      <input
                        autoFocus value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => { renamePin(pin.id, editName || pin.name); setEditingId(null) }}
                        onKeyDown={e => e.key === 'Enter' && (renamePin(pin.id, editName || pin.name), setEditingId(null))}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px', color: '#e2e8f0', fontSize: 12, width: '100%', outline: 'none' }}
                      />
                    ) : (
                      <div onDoubleClick={() => { setEditingId(String(pin.id)); setEditName(pin.name) }}
                        style={{ fontSize: 12, color: '#e2e8f0', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title="Double-click to rename">
                        {pin.name}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                      {pin.lat.toFixed(3)}, {pin.lon.toFixed(3)}
                    </div>
                  </div>
                  <button onClick={() => onNavigate(pin.lat, pin.lon, pin.zoom)}
                    style={{ padding: '4px 8px', background: 'rgba(0,153,204,0.08)', border: '1px solid rgba(0,153,204,0.2)', borderRadius: 6, color: '#0099cc', cursor: 'pointer', fontSize: 11 }}>
                    Go
                  </button>
                  <button onClick={() => removePin(pin.id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 2, opacity: 0.6 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
