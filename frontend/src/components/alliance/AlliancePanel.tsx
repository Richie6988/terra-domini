/**
 * AlliancePanel — alliance management, diplomacy, members.
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Shield, Sword, TrendingUp, Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { allianceApi, api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { useAllianceChat } from '../../hooks/useAllianceChat'
import type { Alliance, AllianceMember } from '../../types'
import { EmojiIcon } from '../shared/emojiIcons'

const textInput: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
}


const TIER_COLORS: Record<string, string> = {
  squad: '#3B82F6', guild: '#8B5CF6', federation: '#F59E0B'
}
const ROLE_ICONS: Record<string, string> = {
  leader: 'crown', officer: 'medal', veteran: 'medal', member: 'swords', recruit: 'sprout'
}

// ── Shared helpers ──
function MiniTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ padding: '2px 8px', borderRadius: 10, background: `${color}15`, color, fontSize: 8, fontWeight: 700, border: `1px solid ${color}30` }}>{children}</span>
}
function StatBox({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#8B5CF6', marginBottom: 4 }}>{icon}<span style={{ fontSize: 16, fontWeight: 900 }}>{value}</span></div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' as const }}>{label}</div>
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>{text}</div>
}
const primaryBtn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1 }
const dangerBtn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 11, fontWeight: 700, letterSpacing: 1 }
const labelStyle: React.CSSProperties = { fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const }


function AlliancePanelTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '8px 6px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
          background: active === t ? 'rgba(139,92,246,0.15)' : 'transparent',
          borderBottom: active === t ? '2px solid #8B5CF6' : '2px solid transparent',
          color: active === t ? '#C084FC' : '#6B7280', fontSize: 12, fontWeight: active === t ? 600 : 400,
          textTransform: 'capitalize',
        }}>{t}</button>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 6px', fontWeight: 500 }}>
      {children}
    </div>
  )
}

export function AlliancePanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer()
  const qc = useQueryClient()
  const alliance = player?.alliance
  const { messages: chatMessages, connected: chatConnected, sendMessage } = useAllianceChat(alliance?.id)
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<'overview' | 'members' | 'diplomacy' | 'create' | 'search' | 'trade'>('overview')
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
    onSuccess: (data: any) => {
      toast.success(`Alliance [${data?.tag || 'NEW'}] created!`)
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['alliance-members'] })
      qc.invalidateQueries({ queryKey: ['alliance-search'] })
      // Force immediate player refetch so tabs switch to Overview
      api.get('/players/me/').then(r => useStore.setState({ player: r.data })).catch(() => {})
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Failed to create alliance'
      toast.error(msg)
    },
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
      <AlliancePanelTabBar
        tabs={alliance
          ? ['overview', 'members', 'diplomacy', 'trade']
          : ['create', 'search', 'trade']}
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
                fontSize: 20, fontWeight: 700, color: '#e2e8f0',
              }}>[{alliance.tag}]</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, color: '#e2e8f0' }}>{alliance.name}</div>
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

            {/* Alliance bonuses */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 14 }}>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>ALLIANCE BONUSES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '+10% DEF', icon: 'ui_shield', active: true },
                  { label: '+5 Influence', icon: 'theater', active: true },
                  { label: 'Shared Radar', icon: 'safari_radar', active: (allianceInfo?.member_count || 0) >= 10 },
                  { label: 'War Bonus', icon: 'swords', active: (allianceInfo?.member_count || 0) >= 20 },
                ].map(b => (
                  <span key={b.label} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 8, fontWeight: 600,
                    background: b.active ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
                    color: b.active ? '#8b5cf6' : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${b.active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  }}><EmojiIcon emoji={b.icon} size={16} /> {b.label}</span>
                ))}
              </div>
            </div>

            {/* Alliance chat — real WebSocket */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif" }}>ALLIANCE CHAT</div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: chatConnected ? '#22c55e' : '#dc2626' }} title={chatConnected ? 'Connected' : 'Disconnected'} />
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {chatMessages.length === 0 && (
                  <div style={{ padding: 10, fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>No messages yet. Say hello!</div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ padding: '4px 8px', borderRadius: 6, background: m.type === 'system' ? 'rgba(139,92,246,0.04)' : 'rgba(255,255,255,0.03)', fontSize: 9 }}>
                    {m.type === 'system' ? (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{m.text}</span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 700, color: m.role === 'leader' ? '#cc8800' : '#8b5cf6' }}>{m.user}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>{m.text || m.emoji}</span>
                        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 7, marginLeft: 4 }}>{m.time}</span>
                      </>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput('') } }}
                  placeholder={chatConnected ? 'Type a message...' : 'Connecting...'}
                  disabled={!chatConnected}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, background: 'rgba(255,255,255,0.02)', outline: 'none', color: '#e2e8f0' }} />
                <button onClick={() => { if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput('') } }}
                  disabled={!chatConnected || !chatInput.trim()}
                  style={{ padding: '6px 12px', borderRadius: 6, background: chatConnected ? '#8b5cf6' : '#94a3b8', border: 'none', color: '#fff', fontSize: 8, fontWeight: 700, cursor: 'pointer' }}>SEND</button>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              {[
                { label: 'ASK FOR HELP', icon: '🆘', color: '#dc2626' },
                { label: 'SHARE RESOURCES', icon: 'box', color: '#22c55e' },
                { label: 'TRADE TERRITORY', icon: 'arrow_cycle', color: '#cc8800' },
                { label: 'COORDINATE ATTACK', icon: 'swords', color: '#8b5cf6' },
              ].map(a => (
                <button key={a.label} onClick={() => toast.success(`${a.label} — coming soon!`)} style={{
                  padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 7, fontWeight: 700,
                  background: `${a.color}06`, border: `1px solid ${a.color}15`,
                  color: a.color, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif",
                }}><EmojiIcon emoji={a.icon} size={16} /> {a.label}</button>
              ))}
            </div>

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
                <span style={{ fontSize: 18, width: 28 }}>{ROLE_ICONS[m.role] ?? ''}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{m.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    Rank {m.commander_rank} • {m.territories_owned} territories
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'capitalize' }}>{m.role}</span>
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
                  borderColor: proposeState === s ? '#6B7280' : 'rgba(255,255,255,0.08)',
                }}>
                  <EmojiIcon emoji={s === 'war' ? 'swords' : s === 'alliance' ? 'handshake' : s === 'nap' ? 'dove' : s === 'trade' ? 'money_bag' : 'gear'} size={10} /> {s}
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
              className="btn-game btn-game-purple"
              style={{ width: '100%', padding: '14px', fontSize: 11, letterSpacing: 2, marginTop: 8 }}
            >
              {createMut.isPending ? 'CREATING...' : 'CREATE ALLIANCE'}
            </button>
            {(!createForm.tag || !createForm.name) && (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center', letterSpacing: 1 }}>
                Fill in tag (2-6 chars) and name to continue
              </div>
            )}
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
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                  [{a.tag}]
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{a.member_count} members • {a.tier}</div>
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

        {/* ── TRADE ─────────────────────────────────────────────────── */}
        {tab === 'trade' && (
          <div style={{
            textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)',
            fontSize: 8, letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            ALLIANCE TRADE
            <br /><br />
            COMING SOON — EXCHANGE RESOURCES WITH YOUR ALLIES
          </div>
        )}
      </div>
    </PanelShell>
  )
}


/**
 * CombatPanel — active battles, battle log, unit management.
 */

// ─── Shared Panel Shell ───────────────────────────────────────────────────────
function PanelShell({
  title, icon, children, onClose,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <GlassPanel title={title} onClose={onClose} accent="#3b82f6">
      {children}
    </GlassPanel>
  )
}
