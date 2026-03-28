/**
 * NewsTicker — 28px fixed top banner with horizontal scroll.
 * Matches prototype news-banner exactly.
 * Data from GET /api/news/ticker/ (falls back to mock data).
 */
import { useState, useEffect } from 'react'
import { api } from '../../services/api'

interface NewsItem {
  id: string
  type: 'update' | 'event' | 'season' | 'maintenance' | 'community'
  title: string
  description: string
}

const TAG_COLORS: Record<string, string> = {
  update: '#0099cc',
  event: '#dc2626',
  season: '#a855f7',
  maintenance: '#cc8800',
  community: '#22c55e',
}

const DOT_COLORS: Record<string, string> = {
  update: '#0099cc',
  event: '#dc2626',
  season: '#a855f7',
  maintenance: '#cc8800',
  community: '#22c55e',
}

const MOCK_NEWS: NewsItem[] = [
  { id: '1', type: 'update',      title: 'HEXOD v0.8',        description: 'New radar filter system deployed' },
  { id: '2', type: 'event',       title: 'LIVE EVENT',         description: 'Volcanic eruption — Legendary token at stake' },
  { id: '3', type: 'season',      title: 'SEASON 1',           description: 'Territorial conquest begins — claim your kingdom' },
  { id: '4', type: 'maintenance', title: 'MAINTENANCE',        description: 'Server optimization — 02:00 UTC' },
  { id: '5', type: 'community',   title: 'MILESTONE',          description: '10,000 territories claimed worldwide' },
]

export function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>(MOCK_NEWS)
  const [currentTag, setCurrentTag] = useState<NewsItem['type']>('update')

  useEffect(() => {
    api.get('/news/ticker/').then(r => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? []
      if (data.length > 0) setItems(data)
    }).catch(() => {})
  }, [])

  // Rotate tag label
  useEffect(() => {
    if (items.length === 0) return
    let idx = 0
    const id = setInterval(() => {
      idx = (idx + 1) % items.length
      setCurrentTag(items[idx].type)
    }, 5000)
    return () => clearInterval(id)
  }, [items])

  // Duplicate items for seamless scroll
  const doubled = [...items, ...items]

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 28,
      background: 'linear-gradient(90deg, #0f172a, #1e293b, #0f172a)',
      zIndex: 150, // above map overlay
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      borderBottom: '1px solid rgba(0,153,204,0.2)',
    }}>
      {/* Tag badge */}
      <div style={{
        flexShrink: 0,
        padding: '0 12px',
        fontSize: 8,
        fontWeight: 900,
        letterSpacing: 2,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: TAG_COLORS[currentTag] || TAG_COLORS.update,
        color: 'white',
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {currentTag.toUpperCase()}
      </div>

      {/* Scrolling items */}
      <div style={{
        display: 'flex',
        animation: `news-scroll ${items.length * 8}s linear infinite`,
        whiteSpace: 'nowrap',
      }}>
        {doubled.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{
            flexShrink: 0,
            padding: '0 40px',
            fontSize: 9,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: DOT_COLORS[item.type] || '#0099cc',
              flexShrink: 0,
            }} />
            <strong style={{ color: 'white', fontWeight: 700 }}>{item.title}</strong>
            <span>{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
