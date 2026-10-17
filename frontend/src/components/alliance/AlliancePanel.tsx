/**
 * AlliancePanel — alliance management, diplomacy, members.
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Shield, Sword, TrendingUp, Crown, Search, Plus, MessageSquare, Handshake, ArrowLeftRight, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { allianceApi, api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { useAllianceChat } from '../../hooks/useAllianceChat'
import type { Alliance, AllianceMember } from '../../types'
import { EmojiIcon } from '../shared/emojiIcons'
import { IconSVG } from '../shared/iconBank'

const ACC = '#3b82f6'

const textInput: React.CSSProperties = { marginBottom: 12 }

const TIER_COLORS: Record<string, string> = {
  squad: '#3B82F6', guild: '#8B5CF6', federation: '#F59E0B'
}
const ROLE_ICONS: Record<string, string> = {
  leader: 'crown', officer: 'medal', veteran: 'medal', member: 'swords', recruit: 'sprout'
}

// ── Shared helpers ──
function MiniTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="hx-chip" style={{ background: `${color}1c`, color, borderColor: `${color}55`, textTransform: 'uppercase' }}>{children}</span>
}
function StatBox({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="hx-card" style={{ padding: '12px 12px' }}>
      <div className="hx-stat">
        <span className="hx-stat__label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label.toUpperCase()}</span>
        <span className="hx-stat__value hx-stat__value--accent">{value}</span>
      </div>
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="hx-empty"><Users size={32} /><div className="hx-empty__title">{text}</div></div>
}
const primaryBtn: React.CSSProperties = { fontSize: 11, minHeight: 40 }
const dangerBtn: React.CSSProperties = { minHeight: 40, fontSize: 11, color: '#fca5a5' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(226,232,240,0.55)', letterSpacing:0.5, marginBottom: 6, textTransform: 'uppercase' as const }


const TAB_META: Record<string, { label: string; icon: React.ReactNode }> = {
  overview: { label: 'Overview', icon: <Home size={13} /> },
  members: { label: 'Members', icon: <Users size={13} /> },
  diplomacy: { label: 'Diplomacy', icon: <Handshake size={13} /> },
  create: { label: 'Create', icon: <Plus size={13} /> },
  search: { label: 'Search', icon: <Search size={13} /> },
  trade: { label: 'Trade', icon: <ArrowLeftRight size={13} /> },
}

function AlliancePanelTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="hx-tabs" role="tablist">
      {tabs.map(t => (
        <button key={t} role="tab" className="hx-tab" aria-selected={active === t} onClick={() => onChange(t)}>
          {TAB_META[t]?.icon}{TAB_META[t]?.label ?? t}
        </button>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="hx-section-title" style={{ marginTop: 6 }}>{children}</div>
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
    enabled: !!alliance?.id && (tab === 'members' || tab === 'overview'),
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
    <PanelShell title="ALLIANCE" icon={<IconSVG id="handshake" size={24} />} onClose={onClose}
      subtitle={alliance ? `[${alliance.tag}] ${alliance.name}` : 'Join forces with other commanders'}>
      {/* Tabs */}
      <AlliancePanelTabBar
        tabs={alliance
          ? ['overview', 'members', 'diplomacy', 'trade']
          : ['overview', 'create', 'search', 'trade']}
        active={tab}
        onChange={setTab as any}
      />

      <div>

        {/* ── NO ALLIANCE — landing ─────────────────────────────────────── */}
        {tab === 'overview' && !alliance && (
          <div className="hx-empty hx-rise" style={{ padding: '36px 20px', gap: 12 }}>
            <IconSVG id="handshake" size={64} />
            <div className="hx-empty__title" style={{ fontSize: 14 }}>YOU'RE NOT IN AN ALLIANCE</div>
            <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', maxWidth: 360, lineHeight: 1.5, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>
              Team up with other commanders to chat, coordinate and conduct diplomacy together.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              <button className="btn-game btn-game-blue" onClick={() => setTab('create')} style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> CREATE ALLIANCE
              </button>
              <button className="btn-game btn-game-glass" onClick={() => setTab('search')} style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={15} /> FIND AN ALLIANCE
              </button>
            </div>
          </div>
        )}

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab === 'overview' && alliance && (
          <div>
            <div className="hx-card hx-card--accent" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 60, height: 60, flexShrink: 0,
                clipPath: 'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                background: `linear-gradient(160deg, ${alliance.banner_color ?? ACC}, ${alliance.banner_color ?? ACC}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}>{alliance.tag}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#e2e8f0', letterSpacing:0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alliance.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <MiniTag color={TIER_COLORS[alliance.tier] ?? '#6B7280'}>{alliance.tier}</MiniTag>
                  <MiniTag color="#6B7280">{player?.alliance?.role ?? 'member'}</MiniTag>
                </div>
              </div>
            </div>

            {allianceInfo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
                <StatBox label="Members" value={allianceInfo.member_count} icon={<Users size={13} />} />
                <StatBox label="Territories" value={allianceInfo.territory_count} icon={<Shield size={13} />} />
                <StatBox label="War Score" value={(allianceInfo.war_score ?? 0).toLocaleString()} icon={<Sword size={13} />} />
              </div>
            )}

            {/* Alliance bonuses */}
            <div className="hx-card" style={{ marginBottom: 14 }}>
              <div className="hx-section-title" style={{ marginTop: 0 }}>ALLIANCE BONUSES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '+10% DEF', icon: 'ui_shield', active: true },
                  { label: '+5 Influence', icon: 'theater', active: true },
                  { label: 'Shared Radar', icon: 'safari_radar', active: (allianceInfo?.member_count || 0) >= 10 },
                  { label: 'War Bonus', icon: 'swords', active: (allianceInfo?.member_count || 0) >= 20 },
                ].map(b => (
                  <span key={b.label} style={{
                    padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: b.active ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                    color: b.active ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                    border: `2px solid ${b.active ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    filter: b.active ? undefined : 'grayscale(1)',
                  }}><EmojiIcon emoji={b.icon} size={18} /> {b.label}</span>
                ))}
              </div>
            </div>

            {/* Alliance chat — real WebSocket */}
            <div className="hx-card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="hx-section-title" style={{ margin: 0 }}><MessageSquare size={13} /> ALLIANCE CHAT</div>
                <span className="hx-chip" style={{ color: chatConnected ? '#4ade80' : '#f87171' }} title={chatConnected ? 'Connected' : 'Disconnected'}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: chatConnected ? '#22c55e' : '#dc2626' }} />{chatConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {chatMessages.length === 0 && (
                  <div style={{ padding: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>No messages yet. Say hello!</div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ padding: '4px 8px', borderRadius: 6, background: m.type === 'system' ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.04)', fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>
                    {m.type === 'system' ? (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{m.text}</span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 700, color: m.role === 'leader' ? '#fbbf24' : '#93c5fd' }}>{m.user}</span>
                        <span style={{ color: 'rgba(226,232,240,0.8)', marginLeft: 6, fontFamily: 'system-ui' }}>{m.text || m.emoji}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 6 }}>{m.time}</span>
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
                  className="hx-input" aria-label="Chat message" style={{ flex: 1 }} />
                <button onClick={() => { if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput('') } }}
                  disabled={!chatConnected || !chatInput.trim()}
                  className="btn-game btn-game-blue" style={{ fontSize: 11, padding: '8px 14px' }}>SEND</button>
              </div>
            </div>

            {/* Quick actions — no backend yet: disabled with SOON chip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'ASK FOR HELP', icon: 'alarm', color: '#f87171' },
                { label: 'SHARE RESOURCES', icon: 'box', color: '#4ade80' },
                { label: 'TRADE TERRITORY', icon: 'arrow_cycle', color: '#fbbf24' },
                { label: 'COORDINATE ATTACK', icon: 'swords', color: '#93c5fd' },
              ].map(a => (
                <button key={a.label} disabled aria-disabled="true" title="Coming soon" style={{
                  padding: '10px 10px', borderRadius: 10, cursor: 'not-allowed', fontSize: 11, fontWeight: 700, minHeight: 44,
                  background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.08)',
                  color: a.color, letterSpacing:0.5, fontFamily: 'var(--font-heading)', opacity: 0.7,
                  display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                }}>
                  <span style={{ filter: 'grayscale(0.6)' }}><IconSVG id={a.icon} size={22} /></span>
                  <span style={{ flex: 1 }}>{a.label}</span>
                  <span className="hx-chip" style={{ fontSize: 11, padding: '2px 6px' }}>SOON</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => leaveMut.mutate()}
              disabled={leaveMut.isPending}
              className="btn-game btn-game-glass"
              style={{ ...dangerBtn, width: '100%', marginTop: 8 }}
            >
              LEAVE ALLIANCE
            </button>
          </div>
        )}

        {/* ── MEMBERS ───────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div>
            {!membersData && alliance && [0, 1, 2].map(i => <div key={i} className="hx-skeleton" style={{ height: 58, marginBottom: 8, borderRadius: 12 }} />)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m, i) => (
              <div key={m.id} className="hx-card hx-rise" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', animationDelay: `${i * 40}ms` }}>
                <IconSVG id={ROLE_ICONS[m.role] || 'person'} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name || m.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: "'Share Tech Mono', monospace" }}>
                    RANK {m.commander_rank} · {m.territories_owned} TERRITORIES
                  </div>
                </div>
                <MiniTag color={m.role === 'leader' ? '#fbbf24' : m.role === 'officer' ? '#93c5fd' : '#94a3b8'}>{m.role}</MiniTag>
              </div>
            ))}
            </div>
            {membersData && members.length === 0 && <Empty text="NO MEMBERS FOUND" />}
          </div>
        )}

        {/* ── DIPLOMACY ─────────────────────────────────────────────────── */}
        {tab === 'diplomacy' && (
          <div>
            <SectionLabel>Propose diplomatic state</SectionLabel>
            <input
              value={proposeTarget} onChange={e => setProposeTarget(e.target.value)}
              placeholder="Target alliance tag (e.g. IRON)"
              className="hx-input" style={textInput}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {(['war', 'ceasefire', 'nap', 'trade', 'alliance'] as const).map(s => (
                <button key={s} onClick={() => setProposeState(s)} aria-pressed={proposeState === s} style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing:0.5, border: '2px solid', minHeight: 40,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
                  background: proposeState === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                  color: s === 'war' ? '#f87171' : s === 'alliance' ? '#4ade80' : '#e2e8f0',
                  borderColor: proposeState === s ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.1)',
                  boxShadow: proposeState === s ? '0 4px 0 rgba(0,0,0,0.35)' : 'none',
                }}>
                  <EmojiIcon emoji={s === 'war' ? 'swords' : s === 'alliance' ? 'handshake' : s === 'nap' ? 'dove' : s === 'trade' ? 'money_bag' : 'gear'} size={18} /> {s}
                </button>
              ))}
            </div>
            <button onClick={() => proposeMut.mutate()} disabled={!proposeTarget || !proposeState} className="btn-game btn-game-blue" style={{ ...primaryBtn, width: '100%' }}>
              SEND PROPOSAL
            </button>
          </div>
        )}

        {/* ── CREATE ────────────────────────────────────────────────────── */}
        {tab === 'create' && (
          <div className="hx-rise">
            <SectionLabel>New alliance</SectionLabel>
            {/* Live badge preview */}
            <div className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 52, height: 52, flexShrink: 0, clipPath: 'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                background: `linear-gradient(160deg, ${createForm.banner_color}, ${createForm.banner_color}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}>{createForm.tag || 'TAG'}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{createForm.name || 'Your alliance name'}</div>
                <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)', marginTop: 3 }}>PREVIEW</div>
              </div>
            </div>
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
                  className="hx-input" aria-label={f.label} style={textInput}
                />
              </div>
            ))}
            <label style={labelStyle}>Banner Color</label>
            <input
              type="color" value={createForm.banner_color}
              onChange={e => setCreateForm(p => ({ ...p, banner_color: e.target.value }))}
              aria-label="Banner color"
              style={{ width: '100%', height: 44, borderRadius: 10, border: '2px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.3)', padding: 4, cursor: 'pointer', marginBottom: 16 }}
            />
            <button
              onClick={() => createMut.mutate(createForm)}
              disabled={!createForm.tag || !createForm.name || createMut.isPending}
              className="btn-game btn-game-blue"
              style={{ width: '100%', padding: '14px', fontSize: 11, letterSpacing:0.5, marginTop: 8 }}
            >
              {createMut.isPending ? 'CREATING...' : 'CREATE ALLIANCE'}
            </button>
            {(!createForm.tag || !createForm.name) && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 10, textAlign: 'center', letterSpacing:0.5 }}>
                Fill in tag (2-6 chars) and name to continue
              </div>
            )}
          </div>
        )}

        {/* ── SEARCH ────────────────────────────────────────────────────── */}
        {tab === 'search' && (
          <div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(226,232,240,0.5)' }} />
              <input
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search alliances by name…" className="hx-input" aria-label="Search alliances" style={{ paddingLeft: 36 }}
              />
            </div>
            {searchQ.length < 2 && (
              <div className="hx-empty"><Search size={30} /><div className="hx-empty__title">FIND YOUR ALLIANCE</div>
                <div style={{ fontSize: 11, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>Type at least 2 characters</div></div>
            )}
            {searchQ.length >= 2 && Array.isArray(searchResults) && searchResults.length === 0 && (
              <div className="hx-empty"><Users size={30} /><div className="hx-empty__title">NO ALLIANCES FOUND</div></div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(searchResults as Alliance[] ?? []).map((a: Alliance, i: number) => (
              <div key={a.id} className="hx-card hx-card--interactive hx-rise" style={{ display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 40}ms`, cursor: 'default' }}>
                <div style={{
                  width: 46, height: 46, flexShrink: 0, clipPath: 'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
                  background: `linear-gradient(160deg, ${a.banner_color || ACC}, ${a.banner_color || ACC}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}>{a.tag}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <MiniTag color={TIER_COLORS[a.tier] ?? '#94a3b8'}>{a.tier}</MiniTag>
                    <span className="hx-chip"><Users size={11} /> {a.member_count}</span>
                  </div>
                </div>
                {a.is_recruiting ? (
                  <button onClick={() => joinMut.mutate(a.id)} className="btn-game btn-game-green" style={{ fontSize: 11, padding: '8px 16px', flexShrink: 0 }}>
                    JOIN
                  </button>
                ) : <span className="hx-chip">CLOSED</span>}
              </div>
            ))}
            </div>
          </div>
        )}

        {/* ── TRADE ─────────────────────────────────────────────────── */}
        {tab === 'trade' && (
          <div className="hx-empty">
            <IconSVG id="ui_trade" size={52} />
            <div className="hx-empty__title">ALLIANCE TRADE <span className="hx-chip" style={{ marginLeft: 6 }}>SOON</span></div>
            <div style={{ fontSize: 11, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>Exchange resources with your allies.</div>
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
  title, icon, subtitle, children, onClose,
}: {
  title: string
  icon: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <GlassPanel title={title} onClose={onClose} accent={ACC} icon={icon} subtitle={subtitle}>
      {children}
    </GlassPanel>
  )
}
