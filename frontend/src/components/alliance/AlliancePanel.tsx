/**
 * AlliancePanel — alliance management, diplomacy, members.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Shield, Sword, TrendingUp, Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { allianceApi } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import type { Alliance, AllianceMember } from '../../types'

const TIER_COLORS: Record<string, string> = {
  squad: '#3B82F6', guild: '#8B5CF6', federation: '#F59E0B'
}
const ROLE_ICONS: Record<string, string> = {
  leader: '👑', officer: '⭐', veteran: '🎖️', member: '⚔️', recruit: '🌱'
}

export function AlliancePanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer()
  const qc = useQueryClient()
  const alliance = player?.alliance

  const [tab, setTab] = useState<'overview' | 'members' | 'diplomacy' | 'create' | 'search'>('overview')
  const [createForm, setCreateForm] = useState({ tag: '', name: '', description: '', banner_color: '#10B981' })
  const [searchQ, setSearchQ] = useState('')
  const [proposeState, setProposeState] = useState('')
  const [proposeTarget, setProposeTarget] = useState('')

  const { data: membersData } = useQuery({
    queryKey: ['alliance-members', alliance?.id],
    queryFn: () => allianceApi.members(alliance!.id),
    enabled: !!alliance?.id && tab === 'members',
  })

  const { data: searchResults } = useQuery({
    queryKey: ['alliance-search', searchQ],
    queryFn: () => allianceApi.search(searchQ),
    enabled: searchQ.length >= 2 && tab === 'search',
  })

  const createMut = useMutation({
    mutationFn: allianceApi.create,
    onSuccess: () => { toast.success('Alliance created! 🏰'); qc.invalidateQueries({ queryKey: ['player'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })

  const leaveMut = useMutation({
    mutationFn: allianceApi.leave,
    onSuccess: () => { toast.success('Left alliance'); qc.invalidateQueries({ queryKey: ['player'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })

  const joinMut = useMutation({
    mutationFn: (id: string) => allianceApi.join(id),
    onSuccess: () => { toast.success('Joined alliance!'); qc.invalidateQueries({ queryKey: ['player'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })

  const proposeMut = useMutation({
    mutationFn: () => allianceApi.propose(proposeTarget, proposeState),
    onSuccess: () => toast.success(`Diplomatic proposal sent`),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  })

  const members: AllianceMember[] = membersData?.members ?? []
  const allianceInfo: Alliance | null = membersData?.alliance ?? null

  return (
    <PanelShell title="Alliance & Diplomacy" icon={<Users size={18} color="#8B5CF6" />} onClose={onClose}>
      {/* Tabs */}
      <TabBar
        tabs={alliance
          ? ['overview', 'members', 'diplomacy']
          : ['create', 'search']}
        active={tab}
        onChange={setTab as any}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab === 'overview' && alliance && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: alliance.banner_color ?? '#10B981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>[{alliance.tag}]</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, color: '#fff' }}>{alliance.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <MiniTag color={TIER_COLORS[alliance.tier] ?? '#6B7280'}>{alliance.tier}</MiniTag>
                  <MiniTag color="#6B7280">{player?.alliance?.role ?? 'member'}</MiniTag>
                </div>
              </div>
            </div>

            {allianceInfo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                <StatBox label="Members" value={allianceInfo.member_count} icon={<Users size={13} />} />
                <StatBox label="Territories" value={allianceInfo.territory_count} icon={<Shield size={13} />} />
                <StatBox label="War Score" value={allianceInfo.war_score.toLocaleString()} icon={<Sword size={13} />} />
              </div>
            )}

            <button
              onClick={() => leaveMut.mutate()}
              disabled={leaveMut.isPending}
              style={{ ...dangerBtn, width: '100%', marginTop: 8 }}
            >
              Leave Alliance
            </button>
          </div>
        )}

        {/* ── MEMBERS ───────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div>
            {members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: 18, width: 28 }}>{ROLE_ICONS[m.role] ?? '⚔️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#E5E7EB', fontWeight: 500 }}>{m.username}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    Rank {m.commander_rank} • {m.territories_owned} territories
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#4B5563', textTransform: 'capitalize' }}>{m.role}</span>
              </div>
            ))}
            {members.length === 0 && <Empty text="No members data" />}
          </div>
        )}

        {/* ── DIPLOMACY ─────────────────────────────────────────────────── */}
        {tab === 'diplomacy' && (
          <div>
            <SectionLabel>Propose diplomatic state</SectionLabel>
            <input
              value={proposeTarget} onChange={e => setProposeTarget(e.target.value)}
              placeholder="Target alliance tag (e.g. IRON)"
              style={textInput}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['war', 'ceasefire', 'nap', 'trade', 'alliance'] as const).map(s => (
                <button key={s} onClick={() => setProposeState(s)} style={{
                  padding: '5px 11px', borderRadius: 6, fontSize: 12, border: '1px solid',
                  cursor: 'pointer',
                  background: proposeState === s ? '#4B5563' : 'rgba(255,255,255,0.04)',
                  color: s === 'war' ? '#EF4444' : s === 'alliance' ? '#10B981' : '#E5E7EB',
                  borderColor: proposeState === s ? '#6B7280' : 'rgba(255,255,255,0.07)',
                }}>
                  {s === 'war' ? '⚔️' : s === 'alliance' ? '🤝' : s === 'nap' ? '🕊️' : s === 'trade' ? '💰' : '⏸️'} {s}
                </button>
              ))}
            </div>
            <button onClick={() => proposeMut.mutate()} disabled={!proposeTarget || !proposeState} style={primaryBtn}>
              Send Proposal
            </button>
          </div>
        )}

        {/* ── CREATE ────────────────────────────────────────────────────── */}
        {tab === 'create' && (
          <div>
            <SectionLabel>New alliance</SectionLabel>
            {[
              { key: 'tag', label: 'Tag (2-6 chars)', placeholder: 'TERRA' },
              { key: 'name', label: 'Name', placeholder: 'Terra Dominators' },
              { key: 'description', label: 'Description', placeholder: 'Our mission…' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  value={createForm[f.key as keyof typeof createForm]}
                  onChange={e => setCreateForm(p => ({ ...p, [f.key]: f.key === 'tag' ? e.target.value.toUpperCase() : e.target.value }))}
                  placeholder={f.placeholder}
                  maxLength={f.key === 'tag' ? 6 : 200}
                  style={textInput}
                />
              </div>
            ))}
            <label style={labelStyle}>Banner Color</label>
            <input
              type="color" value={createForm.banner_color}
              onChange={e => setCreateForm(p => ({ ...p, banner_color: e.target.value }))}
              style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 16 }}
            />
            <button
              onClick={() => createMut.mutate(createForm)}
              disabled={!createForm.tag || !createForm.name || createMut.isPending}
              style={primaryBtn}
            >
              {createMut.isPending ? 'Creating…' : '🏰 Create Alliance'}
            </button>
          </div>
        )}

        {/* ── SEARCH ────────────────────────────────────────────────────── */}
        {tab === 'search' && (
          <div>
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search alliances…" style={{ ...textInput, marginBottom: 16 }}
            />
            {(searchResults as Alliance[] ?? []).map((a: Alliance) => (
              <div key={a.id} style={{
                padding: '12px', background: 'rgba(255,255,255,0.04)',
                borderRadius: 10, marginBottom: 8,
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  [{a.tag}]
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#E5E7EB' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{a.member_count} members • {a.tier}</div>
                </div>
                {a.is_recruiting && (
                  <button onClick={() => joinMut.mutate(a.id)} style={{ ...primaryBtn, width: 'auto', padding: '6px 14px', fontSize: 12, marginTop: 0 }}>
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  )
}


/**
 * CombatPanel — active battles, battle log, unit management.
 */
import { useActiveBattles } from '../../store'
import type { Battle } from '../../types'

export function CombatPanel({ onClose }: { onClose: () => void }) {
  const battles = useActiveBattles()
  const player = usePlayer()

  return (
    <PanelShell title="Combat Operations" icon={<Sword size={18} color="#EF4444" />} onClose={onClose}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {battles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563' }}>
            <Sword size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>No active battles</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click enemy territory to attack</div>
          </div>
        ) : (
          battles.map(battle => <BattleCard key={battle.id} battle={battle} playerId={player?.id ?? ''} />)
        )}
      </div>
    </PanelShell>
  )
}

function BattleCard({ battle, playerId }: { battle: Battle; playerId: string }) {
  const myParticipation = battle.participants.find(p => p.username === playerId)
  const mySide = myParticipation?.side ?? 'attacker'
  const timeLeft = battle.time_remaining_seconds

  const h = Math.floor(timeLeft / 3600)
  const m = Math.floor((timeLeft % 3600) / 60)
  const s = timeLeft % 60
  const timer = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`

  return (
    <div style={{
      padding: 14, marginBottom: 10,
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#FCA5A5' }}>
          ⚔️ {battle.battle_type.charAt(0).toUpperCase() + battle.battle_type.slice(1)}
        </span>
        <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{timer}</span>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>
        Territory: <span style={{ color: '#E5E7EB' }}>{battle.territory_h3.slice(0, 12)}…</span>
      </div>
      {battle.defender_username && (
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>
          Defender: <span style={{ color: '#F87171' }}>{battle.defender_username}</span>
        </div>
      )}
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>
        Participants: {battle.participants.length} • Your side: <span style={{ color: mySide === 'attacker' ? '#EF4444' : '#10B981' }}>{mySide}</span>
      </div>
      {/* Progress bar */}
      <div style={{ marginTop: 10, height: 3, background: 'rgba(239,68,68,0.2)', borderRadius: 2 }}>
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: timeLeft, ease: 'linear' }}
          style={{ height: '100%', background: '#EF4444', borderRadius: 2 }}
        />
      </div>
    </div>
  )
}


// ─── Shared sub-components ────────────────────────────────────────────────────

function PanelShell({ title, icon, children, onClose }: { title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: -380 }} animate={{ x: 0 }} exit={{ x: -380 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 360,
        zIndex: 1000, background: 'rgba(10,10,20,0.95)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 500, color: '#fff' }}>
          {icon}{title}
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#9CA3AF', fontSize: 16 }}>×</button>
      </div>
      {children}
    </motion.div>
  )
}

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '9px 0', fontSize: 12,
          color: active === t ? '#fff' : '#6B7280',
          background: 'transparent', border: 'none',
          borderBottom: `2px solid ${active === t ? '#8B5CF6' : 'transparent'}`,
          cursor: 'pointer', fontWeight: active === t ? 500 : 400, textTransform: 'capitalize',
        }}>{t}</button>
      ))}
    </div>
  )
}

function StatBox({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>{icon}{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{value}</div>
    </div>
  )
}

function MiniTag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}44`, fontWeight: 500 }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: '#4B5563', padding: '32px 0', fontSize: 13 }}>{text}</div>
}

const textInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px', marginBottom: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', fontSize: 13, boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 5, marginTop: 4,
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 12, background: '#7C3AED',
  border: 'none', borderRadius: 8, color: '#fff',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 4,
}
const dangerBtn: React.CSSProperties = {
  padding: '10px', background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#FCA5A5',
  fontSize: 13, cursor: 'pointer',
}
