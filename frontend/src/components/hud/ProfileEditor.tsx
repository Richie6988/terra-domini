/**
 * ProfileEditor — inline profile customization modal.
 * Avatar (emoji picker or upload), display name, bio, spec path.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

const SPEC_PATHS = [
  { id: 'tactician',   emoji: '⚔️',  label: 'Tactician',   desc: 'Combat +20%' },
  { id: 'merchant',    emoji: '💰',  label: 'Merchant',    desc: 'HEX Coin income +25%' },
  { id: 'diplomat',    emoji: '🤝',  label: 'Diplomat',    desc: 'Alliance bonus +30%' },
  { id: 'engineer',    emoji: '⚙️',  label: 'Engineer',    desc: 'Build speed +40%' },
  { id: 'spymaster',   emoji: '🕵️',  label: 'Spymaster',  desc: 'Intel ×2' },
  { id: 'warlord',     emoji: '🏹',  label: 'Warlord',    desc: 'Territory cap +50%' },
]

const AVATAR_EMOJIS = ['🦅', '🐉', '🦁', '🐺', '🦊', '🐻', '🦈', '🦂', '🦉', '🐯', '🦇', '🦋', '🌑', '⚡', '🔥', '❄️', '🌊', '🌪️', '💀', '👑', '⚜️', '🎯', '🗡️', '🛡️', '🌍', '🚀']

export function ProfileEditor({ onClose }: { onClose: () => void }) {
  const player = useStore(s => s.player)
  const updatePlayer = useStore(s => s.updatePlayer)
  const qc = useQueryClient()

  const [displayName, setDisplayName] = useState(player?.display_name || player?.username || '')
  const [bio, setBio] = useState((player as any)?.bio || '')
  const [specPath, setSpecPath] = useState(player?.spec_path || 'tactician')
  const [avatar, setAvatar] = useState((player as any)?.avatar_emoji || '🦅')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const saveMut = useMutation({
    mutationFn: () => api.patch('/players/me/', {
      display_name: displayName,
      bio,
      spec_path: specPath,
      avatar_emoji: avatar,
    }),
    onSuccess: (res) => {
      updatePlayer(res.data)
      toast.success('Profile updated!')
      qc.invalidateQueries({ queryKey: ['player'] })
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  if (!player) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,42,58,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{ width: 420, maxWidth: '95vw', background: 'linear-gradient(180deg, rgba(235,242,250,0.97), rgba(220,230,242,0.97))', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,60,100,0.1)', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#1a2a3a', flex: 1 }}>Edit Profile</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(26,42,58,0.35)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} style={{
              width: 72, height: 72, borderRadius: '50%', fontSize: 36,
              background: 'rgba(255,255,255,0.5)', border: '2px solid rgba(0,136,74,0.4)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.2s',
            }}>
              {avatar}
            </button>
            <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.35)', marginTop: 4 }}>Tap to change avatar</div>
            {showAvatarPicker && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 10,
                background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: 10,
              }}>
                {AVATAR_EMOJIS.map(e => (
                  <button key={e} onClick={() => { setAvatar(e); setShowAvatarPicker(false) }}
                    style={{
                      width: 36, height: 36, borderRadius: 8, fontSize: 20, cursor: 'pointer',
                      background: avatar === e ? 'rgba(0,136,74,0.2)' : 'transparent',
                      border: avatar === e ? '1px solid rgba(0,136,74,0.5)' : '1px solid transparent',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Display Name
            </label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30}
              style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#1a2a3a', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="Your display name..." />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Bio <span style={{ color: 'rgba(26,42,58,0.25)' }}>({(bio || '').length}/80)</span>
            </label>
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 80))} rows={2}
              style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#1a2a3a', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              placeholder="Short bio... (80 chars)" />
          </div>

          {/* Spec path */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Specialization
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SPEC_PATHS.map(s => (
                <button key={s.id} onClick={() => setSpecPath(s.id)} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  background: specPath === s.id ? 'rgba(0,136,74,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${specPath === s.id ? 'rgba(0,136,74,0.4)' : 'rgba(0,60,100,0.1)'}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: specPath === s.id ? '#00884a' : '#fff' }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', marginTop: 1 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            style={{ width: '100%', padding: '13px', background: '#00884a', border: 'none', borderRadius: 10, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saveMut.isPending ? 0.7 : 1 }}
          >
            {saveMut.isPending ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
