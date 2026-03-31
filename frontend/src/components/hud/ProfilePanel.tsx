/**
 * ProfilePanel — Empire Overview + Commander Profile + Kingdoms.
 * This is the MAIN player dashboard. Shows total empire, all kingdoms,
 * customization options, and aggregate stats.
 */
import { useState } from 'react'
import { usePlayer, useStore } from '../../store'
import { useKingdomStore } from '../../store/kingdomStore'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }
type Tab = 'empire' | 'kingdoms' | 'commander' | 'stats'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'empire',    label: 'EMPIRE',    icon: '🏛' },
  { id: 'kingdoms',  label: 'KINGDOMS',  icon: '👑' },
  { id: 'commander', label: 'COMMANDER', icon: '⚙' },
  { id: 'stats',     label: 'STATS',     icon: '📊' },
]

const AVATARS = ['🦅','🐉','🦁','🐺','🦊','🦉','🐍','🦈','🦌','🏴‍☠️','⚔','🛡','👑','💎','🔥','⚡']

function Stat({ label, value, color = '#0099cc' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '12px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.08)', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "'Share Tech Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.45)', letterSpacing: 2, marginTop: 3, fontFamily: "'Orbitron', sans-serif" }}>{label}</div>
    </div>
  )
}

export function ProfilePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('empire')
  const player = usePlayer()
  const { kingdoms } = useKingdomStore()
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState(player?.display_name || player?.username || '')
  const [avatar, setAvatar] = useState((player as any)?.avatar_url || '🦅')

  const totalTerr = kingdoms.reduce((s, k) => s + k.territories.length, 0)
  const totalIncome = kingdoms.reduce((s, k) => s + (k.dailyHex || 0), 0)

  const handleSaveName = async () => {
    try {
      await api.patch('/players/me/', { display_name: newName })
      useStore.getState().updatePlayer({ display_name: newName } as any)
      toast.success('Name updated!'); setEditName(false)
    } catch { toast.error('Failed') }
  }

  const handleAvatar = async (a: string) => {
    setAvatar(a)
    try { await api.patch('/players/me/', { avatar_url: a }); useStore.getState().updatePlayer({ avatar_url: a } as any) } catch {}
  }

  const SKILL_COLORS: Record<string, string> = { attack:'#dc2626', defense:'#3b82f6', economy:'#cc8800', influence:'#22c55e', technology:'#8b5cf6', extraction:'#f59e0b' }

  return (
    <GlassPanel title="EMPIRE" onClose={onClose} accent="#0099cc">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(0,153,204,0.1)' : 'transparent',
            borderBottom: tab === t.id ? '2px solid #0099cc' : '2px solid transparent',
            color: tab === t.id ? '#0099cc' : 'rgba(26,42,58,0.4)',
            fontSize: 8, fontWeight: 700, letterSpacing: 2, fontFamily: "'Orbitron', sans-serif",
            borderRadius: '8px 8px 0 0', transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 14, display: 'block', marginBottom: 2 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ═══ EMPIRE ═══ */}
      {tab === 'empire' && (<div>
        {/* Commander card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,153,204,0.04), rgba(121,80,242,0.04))', border: '1px solid rgba(0,60,100,0.08)', marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #0099cc18, #7950f218)', border: '2px solid rgba(0,153,204,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2a3a', fontFamily: "'Orbitron', sans-serif", letterSpacing: 3 }}>{player?.display_name || player?.username || 'COMMANDER'}</div>
            <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginTop: 3 }}>LEVEL {(player as any)?.level || 1} · SEASON 1</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <CrystalIcon size="sm" />
              <span style={{ fontSize: 17, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono'" }}>{((player as any)?.tdc_in_game || 100).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.25)', letterSpacing: 1, marginTop: 2 }}>HEX COINS</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
          <Stat label="TERRITORIES" value={totalTerr} />
          <Stat label="KINGDOMS" value={kingdoms.length} color="#cc8800" />
          <Stat label="INCOME/DAY" value={`${totalIncome}◆`} color="#22c55e" />
          <Stat label="POWER" value={kingdoms.reduce((s, k) => s + (k.militaryPower || 0), 0)} color="#dc2626" />
        </div>

        {/* Kingdoms */}
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>YOUR KINGDOMS</div>
        {kingdoms.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', borderRadius: 14, background: 'rgba(0,60,100,0.02)', border: '1px dashed rgba(0,60,100,0.1)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🏰</div>
            <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', fontWeight: 600 }}>No kingdoms yet — claim your first territory!</div>
          </div>
        ) : kingdoms.map(k => (
          <div key={k.id} onClick={() => setTab('kingdoms')} style={{ padding: 14, borderRadius: 12, marginBottom: 8, cursor: 'pointer', background: `linear-gradient(135deg, ${k.color}08, rgba(255,255,255,0.3))`, border: `1px solid ${k.color}25`, transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#1a2a3a', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>{k.name}</span>
              <span style={{ padding: '2px 8px', borderRadius: 8, background: `${k.color}12`, color: k.color, fontSize: 8, fontWeight: 700 }}>{k.territories.length} HEX</span>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Object.entries(k.skills || {}).slice(0, 6).map(([skill, lvl]: [string, any]) => (
                <div key={skill} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(0,60,100,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((lvl || 0) * 14, 100)}%`, height: '100%', borderRadius: 2, background: SKILL_COLORS[skill] || '#999' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>)}

      {/* ═══ KINGDOMS ═══ */}
      {tab === 'kingdoms' && (<div>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 10, fontFamily: "'Orbitron', sans-serif" }}>KINGDOM MANAGEMENT</div>
        {kingdoms.map(k => (
          <div key={k.id} style={{ padding: 16, borderRadius: 14, marginBottom: 12, background: 'rgba(255,255,255,0.3)', border: `1px solid ${k.color}20` }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#1a2a3a', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif", marginBottom: 12 }}>{k.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['attack','defense','economy','influence','technology','extraction'] as const).map(skill => {
                const lvl = k.skills?.[skill] || 0
                return (
                  <div key={skill} style={{ padding: '6px 8px', borderRadius: 8, background: `${SKILL_COLORS[skill]}06`, border: `1px solid ${SKILL_COLORS[skill]}12` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 7, color: SKILL_COLORS[skill], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{skill}</span>
                      <span style={{ fontSize: 10, fontWeight: 900, color: SKILL_COLORS[skill], fontFamily: "'Share Tech Mono'" }}>Lv.{lvl}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.04)', marginTop: 4 }}>
                      <div style={{ width: `${Math.min(lvl * 14, 100)}%`, height: '100%', borderRadius: 2, background: SKILL_COLORS[skill] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {kingdoms.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'rgba(26,42,58,0.4)', fontSize: 11 }}>Claim territories to create your first kingdom.</div>}
      </div>)}

      {/* ═══ COMMANDER ═══ */}
      {tab === 'commander' && (<div>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>COMMANDER NAME</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} disabled={!editName} maxLength={32} style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, background: editName ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
            border: editName ? '1px solid rgba(0,153,204,0.3)' : '1px solid rgba(0,60,100,0.08)', color: '#1a2a3a', fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
          }} />
          {editName
            ? <button onClick={handleSaveName} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #0099cc, #0077aa)', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>SAVE</button>
            : <button onClick={() => setEditName(true)} style={{ padding: '10px 16px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(0,60,100,0.12)', background: 'rgba(255,255,255,0.5)', color: 'rgba(26,42,58,0.5)', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>EDIT</button>
          }
        </div>

        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>AVATAR</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 18 }}>
          {AVATARS.map(a => (
            <button key={a} onClick={() => handleAvatar(a)} style={{
              aspectRatio: '1', borderRadius: 12, border: avatar === a ? '2px solid #0099cc' : '1px solid rgba(0,60,100,0.06)', cursor: 'pointer',
              background: avatar === a ? 'linear-gradient(135deg, #0099cc18, #7950f218)' : 'rgba(255,255,255,0.3)',
              fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: avatar === a ? '0 0 10px rgba(0,153,204,0.2)' : 'none', transition: 'all 0.15s',
            }}>{a}</button>
          ))}
        </div>

        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>ACCOUNT</div>
        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(0,60,100,0.06)', fontSize: 11, color: 'rgba(26,42,58,0.5)', lineHeight: 2 }}>
          Email: <strong style={{ color: '#1a2a3a' }}>{player?.email}</strong><br/>
          Username: <strong style={{ color: '#1a2a3a' }}>{player?.username}</strong><br/>
          Joined: <strong style={{ color: '#1a2a3a' }}>{player?.date_joined ? new Date(player.date_joined).toLocaleDateString() : '—'}</strong>
        </div>
      </div>)}

      {/* ═══ STATS ═══ */}
      {tab === 'stats' && (<div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <Stat label="TERRITORIES" value={totalTerr} />
          <Stat label="KINGDOMS" value={kingdoms.length} color="#cc8800" />
          <Stat label="INCOME/DAY" value={`${totalIncome}◆`} color="#22c55e" />
          <Stat label="BATTLES WON" value={(player as any)?.battles_won || 0} color="#dc2626" />
          <Stat label="BATTLES LOST" value={(player as any)?.battles_lost || 0} color="#64748b" />
          <Stat label="INFLUENCE" value={(player as any)?.influence_points || 0} color="#8b5cf6" />
          <Stat label="SAFARIS" value={(player as any)?.safaris_completed || 0} color="#f97316" />
          <Stat label="EVENTS WON" value={(player as any)?.events_won || 0} color="#3b82f6" />
          <Stat label="STREAK" value={(player as any)?.login_streak || 0} color="#cc8800" />
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.35)', letterSpacing: 2, marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>ACHIEVEMENTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { icon: '🏴', label: 'First Claim', done: totalTerr > 0 },
            { icon: '👑', label: 'Kingdom', done: kingdoms.length > 0 },
            { icon: '⚔', label: 'First Battle', done: ((player as any)?.battles_won || 0) > 0 },
            { icon: '🦖', label: 'Safari', done: ((player as any)?.safaris_completed || 0) > 0 },
            { icon: '💰', label: '1000 HEX', done: ((player as any)?.tdc_in_game || 0) >= 1000 },
            { icon: '🏛', label: '10 Territories', done: totalTerr >= 10 },
            { icon: '🤝', label: 'Alliance', done: !!(player as any)?.alliance_id },
            { icon: '🔥', label: '7-Day Streak', done: ((player as any)?.login_streak || 0) >= 7 },
          ].map(a => (
            <div key={a.label} style={{ padding: '10px 6px', borderRadius: 10, textAlign: 'center', background: a.done ? 'rgba(34,197,94,0.04)' : 'rgba(0,0,0,0.01)', border: a.done ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(0,60,100,0.04)', opacity: a.done ? 1 : 0.35 }}>
              <div style={{ fontSize: 20, marginBottom: 3 }}>{a.icon}</div>
              <div style={{ fontSize: 6, color: a.done ? '#22c55e' : 'rgba(26,42,58,0.3)', fontWeight: 700, letterSpacing: 1 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>)}
    </GlassPanel>
  )
}
