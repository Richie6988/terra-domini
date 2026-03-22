/**
 * TerritoryCustomizer — Modal pour personnaliser une zone possédée.
 * Déblocages basés sur la taille du cluster contigu.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import type { TerritoryLight } from '../../types'

const EMBED_TYPES = [
  { id: 'none',       label: 'None',            emoji: '—',  tier: 0 },
  { id: 'image',      label: 'Image',           emoji: '🖼️', tier: 1 },
  { id: 'video',      label: 'Video',           emoji: '🎬', tier: 2 },
  { id: 'livestream', label: 'Live Stream',     emoji: '📡', tier: 3 },
  { id: 'chat',       label: 'Private Chat',    emoji: '💬', tier: 4 },
  { id: 'metaverse',  label: '3D Metaverse',   emoji: '🌐', tier: 5 },
  { id: 'ad_slot',    label: 'Ad Slot',         emoji: '📺', tier: 6 },
]

const TIER_MIN_ZONES = [1, 3, 6, 10, 15, 25, 50]

export function TerritoryCustomizer({ territory, onClose }: { territory: TerritoryLight; onClose: () => void }) {
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [flagEmoji,   setFlagEmoji]   = useState('')
  const [borderColor, setBorderColor] = useState('#00FF87')
  const [embedType,   setEmbedType]   = useState('none')
  const [embedUrl,    setEmbedUrl]    = useState('')

  const { data: clusterInfo } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get('/territories-geo/clusters/').then(r => r.data),
  })

  const myCluster    = (clusterInfo?.clusters ?? [])[0]
  const currentTier  = myCluster?.tier ?? 0
  const clusterSize  = myCluster?.size ?? 1

  const saveMut = useMutation({
    mutationFn: () => api.post('/territories-geo/customize/', {
      h3_index: territory.h3_index,
      display_name: displayName,
      flag_emoji: flagEmoji,
      border_color: borderColor,
      embed_type: embedType,
      embed_url: embedUrl,
    }),
    onSuccess: () => { toast.success('Territory updated!'); qc.invalidateQueries({ queryKey: ['territories'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        style={{ width: '100%', maxWidth: 440, background: '#0A0A14', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 18, marginRight: 10 }}>🎨</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', flex: 1 }}>Customize Territory</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#6B7280' }}>Cluster: {clusterSize} zones · Tier {currentTier}</span>
            <span style={{ fontSize: 11, color: '#FFB800' }}>{myCluster?.tdc_per_24h?.toFixed(1) ?? 0} HEX Coin/day</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {TIER_MIN_ZONES.map((min, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: clusterSize >= min ? '#00FF87' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          {myCluster?.next_unlock && (
            <div style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>
              Next: {myCluster.next_unlock[0]} zones → {myCluster.next_unlock[1]}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Display name</div>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={territory.place_name || 'Zone name…'}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Flag</div>
              <input value={flagEmoji} onChange={e => setFlagEmoji(e.target.value)} placeholder="🏴" maxLength={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 6px', color: '#fff', fontSize: 20, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ opacity: currentTier >= 1 ? 1 : 0.4, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
              Border Color {currentTier < 1 && <span style={{ color: '#EF4444' }}>🔒 need 3 zones</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['#00FF87', '#6382FF', '#FFB800', '#EF4444', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981'].map(c => (
                <button key={c} disabled={currentTier < 1} onClick={() => setBorderColor(c)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: borderColor === c ? '3px solid #fff' : '3px solid transparent', cursor: currentTier >= 1 ? 'pointer' : 'default' }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Zone Embed</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
              {EMBED_TYPES.map(e => {
                const locked = currentTier < e.tier
                return (
                  <button key={e.id} disabled={locked} onClick={() => setEmbedType(e.id)}
                    style={{ padding: '8px 4px', borderRadius: 8, border: `1px solid ${embedType === e.id ? '#00FF87' : 'rgba(255,255,255,0.08)'}`, background: embedType === e.id ? 'rgba(0,255,135,0.1)' : 'transparent', cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.35 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 16 }}>{e.emoji}</span>
                    <span style={{ fontSize: 9, color: embedType === e.id ? '#00FF87' : '#6B7280', textAlign: 'center' }}>{e.label}</span>
                    {locked && <span style={{ fontSize: 8, color: '#EF4444' }}>{TIER_MIN_ZONES[e.tier]}z</span>}
                  </button>
                )
              })}
            </div>
            {embedType !== 'none' && (
              <input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            style={{ width: '100%', padding: 13, background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.35)', borderRadius: 12, color: '#00FF87', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saveMut.isPending ? 'Saving…' : '✓ Save'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
