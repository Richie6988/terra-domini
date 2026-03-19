/**
 * ProfilePanel — player stats, achievements, daily missions, streaks, settings.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X, LogOut, Copy, Edit2 } from 'lucide-react'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import toast from 'react-hot-toast'
import { ProfileEditor } from './ProfileEditor'

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

function StatCard({ label, value, color = '#fff' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

function MissionCard({ mission }: { mission: any }) {
  const qc = useQueryClient()
  const pct = Math.min(100, Math.round((mission.current_count / mission.target_count) * 100))
  const claimMut = useMutation({
    mutationFn: () => api.post(`/progression/${mission.id}/claim-mission/`),
    onSuccess: () => { toast.success(`+${mission.reward_tdc} TDC!`); qc.invalidateQueries({ queryKey: ['daily-missions'] }) },
  })
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, opacity: mission.is_claimed ? 0.5 : 1 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{mission.icon ?? '🎯'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{mission.title}</div>
            <div style={{ fontSize: 11, color: '#F59E0B', fontFamily: 'monospace' }}>+{mission.reward_tdc} TDC</div>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: mission.completed ? '#10B981' : '#3B82F6', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{mission.current_count}/{mission.target_count}</div>
            {mission.completed && !mission.claimed && (
              <button onClick={() => claimMut.mutate()} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4, color: '#10B981', cursor: 'pointer', fontWeight: 600 }}>
                Claim
              </button>
            )}
            {mission.claimed && <span style={{ fontSize: 10, color: '#10B981' }}>✓ Claimed</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsTab({ player }: { player: any }) {
  const stats = player.stats ?? {}
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatCard label="Commander Rank" value={player.commander_rank ?? 1} color="#F59E0B" />
        <StatCard label="TDC Balance" value={`${toNum(player.tdc_in_game).toFixed(0)}`} color="#8B5CF6" />
        <StatCard label="Territories" value={stats.territories_owned ?? 0} color="#3B82F6" />
        <StatCard label="Battles Won" value={stats.battles_won ?? 0} color="#10B981" />
        <StatCard label="Season Score" value={stats.season_score ?? 0} color="#EC4899" />
        <StatCard label="TDC Earned" value={`${toNum(stats.tdc_earned_total).toFixed(0)}`} color="#F59E0B" />
      </div>

      {/* XP progress */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>XP Progress</span>
          <span style={{ fontSize: 12, color: '#F59E0B', fontFamily: 'monospace' }}>{player.commander_xp ?? 0} XP</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${Math.min(100, ((player.commander_xp ?? 0) % 1000) / 10)}%`, background: 'linear-gradient(90deg, #F59E0B, #EF4444)', borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>Rank {player.commander_rank} · {1000 - ((player.commander_xp ?? 0) % 1000)} XP to next rank</div>
      </div>

      {/* Wallet */}
      {player.wallet_address && (
        <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize: 11, color: '#8B5CF6', marginBottom: 4 }}>Polygon Wallet</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#C4B5FD', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {player.wallet_address}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(player.wallet_address); toast.success('Copied!') }}
              style={{ background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer', padding: 2 }}>
              <Copy size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MissionsTab() {
  const { data } = useQuery({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/progression/daily-missions/').then(r => r.data),
    staleTime: 30000,
  })
  const missions = data?.missions ?? []
  return (
    <div>
      {data?.all_complete && (
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>🎉 All missions complete!</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>Come back tomorrow for new missions</div>
        </div>
      )}
      {missions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563', fontSize: 13 }}>Loading missions…</div>
      ) : (
        missions.map((m: any) => <MissionCard key={m.id} mission={m} />)
      )}
    </div>
  )
}

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'stats' | 'missions'>('stats')
  const player = usePlayer()
  const logout = useStore(s => s.logout)
  const [showEditor, setShowEditor] = useState(false)

  if (!player) return null

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: '#0A0A14', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 20, marginRight: 10 }}>🛡️</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', flex: 1 }}>Profile</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Player hero */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {player.username.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{player.display_name || player.username}</div>
              <button onClick={() => setShowEditor(true)} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', padding: 2 }}><Edit2 size={13} /></button>
            </div>
            <div style={{ fontSize: 12, color: '#10B981' }}>Rank {player.commander_rank} · {player.spec_path || 'Commander'}</div>
            <div style={{ fontSize: 11, color: '#4B5563' }}>{player.email}</div>
          </div>
          <button onClick={() => { logout(); onClose() }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 10px', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <LogOut size={13} /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 20px', background: 'rgba(255,255,255,0.02)' }}>
          {[{ id: 'stats', label: 'Stats' }, { id: 'missions', label: 'Daily Missions' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{
              flex: 1, padding: '7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t.id ? '#fff' : '#6B7280',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {showEditor && <ProfileEditor onClose={() => setShowEditor(false)} />}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'stats' && <StatsTab player={player} />}
        {tab === 'missions' && <MissionsTab />}
      </div>
    </motion.div>
  )
}
