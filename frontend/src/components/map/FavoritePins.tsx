/**
 * FavoritePins — save/load favorite map locations as pins.
 * Stored in localStorage. Shown as custom Leaflet markers on the map.
 */
import { useState, useEffect } from 'react'
import { MapPin, Star, Trash2, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

export interface FavoritePin {
  id: string
  name: string
  lat: number
  lon: number
  emoji: string
  zoom: number
  createdAt: string
}

const STORAGE_KEY = 'td_favorite_pins'
const PIN_EMOJIS = ['📍', '⭐', '🏠', '🏰', '💎', '🎯', '🔥', '👑', '🌍', '⚔️']

export function useFavoritePins() {
  const [pins, setPins] = useState<FavoritePin[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch { return [] }
  })

  const save = (newPins: FavoritePin[]) => {
    setPins(newPins)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPins))
  }

  const addPin = (lat: number, lon: number, zoom: number, name?: string) => {
    const pin: FavoritePin = {
      id: `pin_${Date.now()}`,
      name: name || `Pin ${pins.length + 1}`,
      lat, lon, zoom,
      emoji: PIN_EMOJIS[pins.length % PIN_EMOJIS.length],
      createdAt: new Date().toISOString(),
    }
    save([...pins, pin])
    toast.success(`📍 ${pin.name} saved!`)
    return pin
  }

  const removePin = (id: string) => {
    save(pins.filter(p => p.id !== id))
  }

  const renamePin = (id: string, name: string) => {
    save(pins.map(p => p.id === id ? { ...p, name } : p))
  }

  const updateEmoji = (id: string, emoji: string) => {
    save(pins.map(p => p.id === id ? { ...p, emoji } : p))
  }

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

  return (
    <div style={{ position: 'absolute', bottom: 90, left: 12, zIndex: 500 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'rgba(255,184,0,0.2)' : 'rgba(235,242,250,0.92)',
          border: `1px solid ${open ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.12)'}`,
          cursor: 'pointer', color: open ? '#FFB800' : '#9CA3AF',
        }}
        title="Favorite locations"
      >
        <Star size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'absolute', bottom: 44, left: 0, width: 240,
              background: 'rgba(10,10,20,0.96)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#FFB800' }}>⭐ Saved Locations</span>
              <button
                onClick={() => addPin(currentLat, currentLon, currentZoom)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)', borderRadius: 6, color: '#FFB800', cursor: 'pointer', fontSize: 11 }}
              >
                <Plus size={11} /> Save here
              </button>
            </div>

            {/* Pin list */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {pins.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#4B5563', fontSize: 12 }}>
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
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px', color: '#fff', fontSize: 12, width: '100%', outline: 'none' }}
                      />
                    ) : (
                      <div onDoubleClick={() => { setEditingId(pin.id); setEditName(pin.name) }}
                        style={{ fontSize: 12, color: '#fff', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title="Double-click to rename">
                        {pin.name}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#4B5563', fontFamily: 'monospace' }}>
                      {pin.lat.toFixed(3)}, {pin.lon.toFixed(3)}
                    </div>
                  </div>
                  <button onClick={() => onNavigate(pin.lat, pin.lon, pin.zoom)}
                    style={{ padding: '4px 8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, color: '#60A5FA', cursor: 'pointer', fontSize: 11 }}>
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
