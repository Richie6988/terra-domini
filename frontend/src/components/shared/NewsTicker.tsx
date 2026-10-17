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
  alert: '#f97316',
  market: '#cc8800',
}

const DOT_COLORS: Record<string, string> = {
  update: '#0099cc',
  event: '#dc2626',
  season: '#a855f7',
  maintenance: '#cc8800',
  community: '#22c55e',
  alert: '#f97316',
  market: '#fbbf24',
}

const TICKER_CSS = `
.hxn-bar:hover .hxn-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .hxn-track { animation-duration: 0s !important; } }
`

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

  const tagColor = TAG_COLORS[currentTag] || TAG_COLORS.update

  return (
    <div className="hxn-bar" role="region" aria-label="News" style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 28,
      background: 'linear-gradient(180deg, rgba(10,22,40,0.97), rgba(6,14,26,0.97))',
      zIndex: 900,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      borderBottom: '1px solid rgba(12,197,255,0.22)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <style>{TICKER_CSS}</style>
      {/* Tag pill */}
      <div style={{
        flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center',
        padding: '0 10px 0 8px', position: 'relative', zIndex: 1,
        background: 'linear-gradient(90deg, rgba(6,14,26,1) 85%, rgba(6,14,26,0))',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 18, padding: '0 10px', borderRadius: 999,
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
          background: `linear-gradient(180deg, ${tagColor}, ${tagColor}cc)`,
          color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          boxShadow: `0 0 12px ${tagColor}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          transition: 'background 0.4s, box-shadow 0.4s',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px #fff' }} />
          {(currentTag || '').toUpperCase()}
        </div>
      </div>

      {/* Scrolling items */}
      <div className="hxn-track" style={{
        display: 'flex',
        animation: `news-scroll ${items.length * 60}s linear infinite`,
        whiteSpace: 'nowrap',
      }}>
        {doubled.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{
            flexShrink: 0,
            padding: '0 32px',
            fontSize: 10,
            fontWeight: 500,
            color: 'rgba(226,232,240,0.68)',
            letterSpacing: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: DOT_COLORS[item.type] || '#0099cc',
              boxShadow: `0 0 8px ${DOT_COLORS[item.type] || '#0099cc'}`,
              flexShrink: 0,
            }} />
            <strong style={{ color: DOT_COLORS[item.type] || '#e2e8f0', fontWeight: 900 }}>{item.title}</strong>
            <span>{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
