/**
 * MissionsDailyWidget
 *
 * Bouton fixe sur la carte (bas-gauche) :
 *   - Badge rouge si missions complétées non réclamées
 *   - Popup : missions du jour + onglet Referral
 *
 * CDC : daily missions + login streak + lien d'invitation
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'

import { SkeletonList } from '../ui/Utils'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

/* ── helpers ─────────────────────────────────────────────── */
const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

function ProgressBar({ pct, color = '#10B981' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(0,60,100,0.1)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 2 }}
      />
    </div>
  )
}

/* ── Missions Tab ─────────────────────────────────────────── */
function MissionsTab() {
  const qc = useQueryClient()
  const player = usePlayer()

  const { data, isLoading } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const { data: streakData } = useQuery({
    queryKey: ['login-streak'],
    queryFn: () => api.get('/progression/login-streak/').then(r => r.data).catch(() => null),
    staleTime: 300000,
  })

  const claimMut = useMutation({
    mutationFn: (id: string) => api.post(`/progression/${id}/claim-mission/`),
    onSuccess: (res) => {
      toast.success(`+${res.data.tdc_earned} 💎 réclamés !`)
      qc.invalidateQueries({ queryKey: ['daily-missions'] })
      qc.invalidateQueries({ queryKey: ['player'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur'),
  })

  const missions: any[] = data?.missions || []
  const allComplete = data?.all_complete
  const totalAvail  = data?.total_tdc_available || 0
  const streak      = streakData?.current_streak || player?.stats?.current_streak || 0

  if (isLoading) return <SkeletonList count={3} />

  return (
    <div>
      {/* Streak banner */}
      {streak > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>Streak {streak} jour{streak > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)' }}>Continuez ! Bonus ×{(1 + streak * 0.05).toFixed(2)} demain</div>
          </div>
        </div>
      )}

      {/* Missions complètes non réclamées */}
      {totalAvail > 0 && (
        <div style={{ padding: '8px 14px', marginBottom: 12, background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#10B981' }}>Récompenses disponibles</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>+{totalAvail} 💎</span>
        </div>
      )}

      {/* Toutes complètes */}
      {allComplete && (
        <div style={{ textAlign: 'center', padding: '10px', marginBottom: 12,
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>Toutes les missions du jour complétées !</div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', marginTop: 2 }}>Revenez demain pour de nouvelles missions</div>
        </div>
      )}

      {/* Liste missions */}
      {missions.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(26,42,58,0.35)', fontSize: 12 }}>
          Aucune mission aujourd'hui — revenez demain !
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missions.map((m: any) => {
          const pct = Math.min(100, (m.current / m.target) * 100)
          const canClaim = m.completed && !m.claimed
          return (
            <div key={m.id} style={{
              padding: '11px 13px', borderRadius: 11,
              background: m.completed ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${m.completed ? 'rgba(16,185,129,0.2)' : 'rgba(0,60,100,0.1)'}`,
              opacity: m.claimed ? 0.45 : 1,
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{m.icon || '🎯'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#1a2a3a', fontWeight: 600, lineHeight: 1.3 }}>{m.title}</span>
                    <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: 'monospace', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                      +{m.reward_tdc} 💎
                    </span>
                  </div>
                  <ProgressBar pct={pct} color={m.completed ? '#10B981' : '#3B82F6'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)' }}>{m.current}/{m.target}</span>
                    {canClaim && (
                      <button onClick={() => claimMut.mutate(m.id)} style={{
                        fontSize: 10, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                        background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#10B981',
                      }}>
                        Réclamer
                      </button>
                    )}
                    {m.claimed && <span style={{ fontSize: 10, color: '#10B981' }}>✓ Réclamée</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Referral Tab ─────────────────────────────────────────── */
function ReferralTab() {
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-referral'],
    queryFn: () => api.get('/social/my-referral/').then(r => r.data),
    staleTime: 60000,
  })

  const copyLink = () => {
    if (!data?.invite_url) return
    navigator.clipboard.writeText(data.invite_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Lien copié !')
  }

  const shareLink = () => {
    if (!data?.invite_url) return
    if (navigator.share) {
      navigator.share({
        title: 'Rejoins Hexod !',
        text: '⬡ Rejoins-moi sur Hexod — le jeu de stratégie géopolitique sur carte du monde réel. Tu reçois +50 💎 à l\'inscription !',
        url: data.invite_url,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  if (isLoading) return (
    <div style={{ padding: '28px', textAlign: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: 22, height: 22, border: '2px solid rgba(0,60,100,0.1)', borderTopColor: '#8B5CF6',
          borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )

  const referrals: any[] = data?.referrals || []

  return (
    <div>
      {/* Explication */}
      <div style={{ padding: '12px 14px', marginBottom: 14, background: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', marginBottom: 6 }}>
          🎁 Invitez des amis — gagnez des cristaux
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.6)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#10B981', fontWeight: 700 }}>+50 💎</span> pour votre ami à l'inscription
          </div>
          <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.6)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#F59E0B', fontWeight: 700 }}>5%</span> de commission sur ses achats (90 jours)
          </div>
        </div>
      </div>

      {/* Lien + boutons */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Votre lien d'invitation
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
          <div style={{
            flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
            fontSize: 11, color: 'rgba(26,42,58,0.45)', fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data?.invite_url || '…'}
          </div>
          <button onClick={copyLink} style={{
            padding: '9px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(0,60,100,0.1)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: copied ? '#10B981' : '#9CA3AF', transition: 'all 0.2s',
          }}>
            {copied ? '✓ Copié' : '📋'}
          </button>
        </div>
        <button onClick={shareLink} style={{
          width: '100%', marginTop: 8, padding: '10px', borderRadius: 9, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))',
          border: '1px solid rgba(139,92,246,0.35)', color: '#C4B5FD', fontSize: 12, fontWeight: 700,
        }}>
          📤 Partager l'invitation
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Filleuls total', value: data?.total_referrals || 0, icon: '👥', color: '#8B5CF6' },
          { label: 'Commissions', value: `${toNum(data?.total_commission_tdc).toFixed(0)} 💎`, icon: '💰', color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 9, padding: '10px 12px',
            border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 14 }}>{s.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: 'monospace', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Liste filleuls */}
      {referrals.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Vos filleuls ({referrals.length})
          </div>
          {referrals.map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: 8, marginBottom: 5,
              background: r.is_active ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${r.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
              <div>
                <span style={{ fontSize: 12, color: '#1a2a3a', fontWeight: 600 }}>{r.username}</span>
                <span style={{ fontSize: 9, color: r.is_active ? '#10B981' : '#6B7280', marginLeft: 8 }}>
                  {r.is_active ? '● Actif' : '○ Inactif'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#F59E0B', fontFamily: 'monospace' }}>
                +{toNum(r.tdc_earned).toFixed(0)} 💎
              </span>
            </div>
          ))}
        </div>
      )}

      {referrals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(26,42,58,0.25)', fontSize: 11 }}>
          Aucun filleul pour l'instant — partagez votre lien !
        </div>
      )}
    </div>
  )
}

/* ── Widget principal ─────────────────────────────────────── */
export function MissionsDailyWidget() {
  const [open, setOpen] = useState(false)
  const [tab, setTab]   = useState<'missions' | 'referral'>('missions')

  // Badge : missions complétées non réclamées
  const { data } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
    refetchInterval: open ? 30000 : 120000,
  })

  const claimable = (data?.missions || []).filter((m: any) => m.completed && !m.claimed).length

  return (
    <>
      {/* Bouton flottant bas-gauche */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', left: 12, bottom: 72, zIndex: 850,
          width: 52, height: 52, borderRadius: 14, cursor: 'pointer',
          background: open ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.88)',
          border: `1px solid ${open ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, backdropFilter: 'blur(8px)', transition: 'all 0.2s',
          boxShadow: claimable > 0 ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>🎯</span>
        <span style={{ fontSize: 8, color: open ? '#10B981' : '#6B7280', fontWeight: 700 }}>Missions</span>
        {claimable > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#10B981', borderRadius: '50%', width: 16, height: 16,
            fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 900,
          }}>{claimable}</span>
        )}
      </button>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -16, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{
              position: 'fixed', left: 70, bottom: 72, zIndex: 860,
              width: 320, maxHeight: '70vh',
              background: 'linear-gradient(180deg, #07070f 0%, #050510 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2a3a' }}>
                {tab === 'missions' ? '🎯 Missions du jour' : '🎁 Inviter des amis'}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none',
                color: 'rgba(26,42,58,0.35)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              {[
                { id: 'missions' as const, label: '🎯 Missions' },
                { id: 'referral' as const, label: '🎁 Inviter' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 11,
                  background: tab === t.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                  borderBottom: `2px solid ${tab === t.id ? (t.id === 'missions' ? '#10B981' : '#8B5CF6') : 'transparent'}`,
                  color: tab === t.id ? '#fff' : '#4B5563', fontWeight: tab === t.id ? 700 : 400,
                }}>
                  {t.label}
                  {t.id === 'missions' && claimable > 0 && (
                    <span style={{ marginLeft: 5, background: '#10B981', borderRadius: 10,
                      padding: '0 5px', fontSize: 9, color: '#000', fontWeight: 900 }}>
                      {claimable}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 16px' }}>
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                  {tab === 'missions' ? <MissionsTab /> : <ReferralTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
