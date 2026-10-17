/**
 * NewsTicker — 28px fixed top banner with horizontal scroll.
 * Matches prototype news-banner exactly.
 * Data from GET /api/news/ticker/ — no fake fallback (empty bar if the API fails).
 */
import { useState, useEffect } from 'react'
import { api } from '../../services/api'

interface NewsItem {
  id: string
  type: string
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

export function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [currentTag, setCurrentTag] = useState<NewsItem['type']>('update')

  useEffect(() => {
    api.get('/news/ticker/').then(r => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? []
      // Backend sends {type, title, text}; older payloads used description
      setItems(data.map((d: any, i: number) => ({
        id: String(d.id ?? i), type: d.type || 'update', title: d.title || '', description: d.text ?? d.description ?? '',
      })))
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
      background: 'linear-gradient(90deg, rgba(13,27,42,0.95), rgba(10,22,40,0.95), rgba(13,27,42,0.95))',
      zIndex: 900,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      borderBottom: '1px solid rgba(12,197,255,0.15)',
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
        color: '#e2e8f0',
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {(currentTag || '').toUpperCase()}
      </div>

      {/* Scrolling items */}
      <div style={{
        display: 'flex',
        animation: `news-scroll ${items.length * 60}s linear infinite`,
        whiteSpace: 'nowrap',
      }}>
        {doubled.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{
            flexShrink: 0,
            padding: '0 40px',
            fontSize: 9,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.4)',
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
            <strong style={{ color: '#e2e8f0', fontWeight: 700 }}>{item.title}</strong>
            <span>{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
