/**
 * ProfilePanel — Player profile management.
 * 3 tabs: Commander (live stats from /players/me/profile-stats/ + profile editor), Achievements, Preferences (sound, map).
 */
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MiniIcon, StatusDot } from '../shared/MiniIcons'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import { EmojiIcon, emojiToIcon } from '../shared/emojiIcons'
import { Check, AlertTriangle, LogOut, Trash2, Trophy, Flame, Pencil, Swords, Shield, Crown, Sparkles } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'

interface Props { onClose: () => void }
type Tab = 'commander' | 'achievements' | 'preferences'

const TABS: { id: Tab; label: string }[] = [
  { id: 'commander', label: 'COMMANDER' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
  { id: 'preferences', label: 'PREFERENCES' },
]
const AVATARS = ['eagle','dragon','lion','wolf','fox','bear','bat','shark','snake','scorpion','octopus','squid','crab','bee','butterfly','horse','deer','elephant','rhino','bison','crocodile','trex','whale','bug']
const AVATAR_COLORS = ['#0099cc','#cc8800','#dc2626','#22c55e','#8b5cf6','#f59e0b','#ec4899','#3b82f6','#6366f1','#14b8a6','#f97316','#64748b']
const sBox: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))', border: '2px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing:0.5, color: 'rgba(226,232,240,0.6)', fontFamily: 'var(--font-heading)', marginBottom: 8 }
const inputSt: React.CSSProperties = { width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: 10, fontSize: 13, background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.16)', color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' as const }
/** avatar_emoji may be an iconBank id or a legacy emoji (e.g. backend default) — always resolve to an icon id */
const avatarId = (a: string) => /^[a-z_0-9]+$/i.test(a || '') ? a : (emojiToIcon(a || '') || 'medal')

function CommanderTab() {
  const player = usePlayer()
  const [name, setName] = useState(player?.display_name || '')
  const [avatar, setAvatar] = useState((player as any)?.avatar_emoji || 'eagle')
  const [avatarBg, setAvatarBg] = useState((player as any)?.avatar_color || '#0099cc')
  const [email, setEmail] = useState(player?.email || '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const { data: st } = useQuery({ queryKey: ['profile-stats'], queryFn: () => api.get('/players/me/profile-stats/').then(r => r.data), staleTime: 30000 })
  const save = useCallback(async () => {
    setSaving(true)
    try {
      await api.patch('/players/update-profile/', { display_name: name, avatar_emoji: avatar, avatar_color: avatarBg, email })
      // Update store so HUD reflects changes immediately
      useStore.getState().updatePlayer({ display_name: name, avatar_emoji: avatar, avatar_color: avatarBg, email } as any)
      toast.success('Profile updated!')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }, [name, avatar, avatarBg, email])
  if (!player) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Commander card */}
      <div style={{ ...sBox, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 140% at 0% 0%, ${avatarBg}33, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))`,
        border: `2px solid ${avatarBg}55` }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, ${avatarBg}, ${avatarBg}88 70%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '3px solid rgba(255,255,255,0.18)',
          boxShadow: `0 0 0 4px rgba(0,0,0,0.3), 0 6px 0 rgba(0,0,0,0.35)`,
        }}><IconSVG id={avatarId(avatar)} size={60} /></div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing:0.5 }}>{name || player.display_name || player.username}</div>
          <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.55)', marginTop: 3, textTransform: 'none', fontFamily: "'Share Tech Mono', monospace" }}>@{player.username}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {st && <span className="hx-chip" style={{ color: '#fde68a' }}><Trophy size={12} /> #{st.rank.position} OF {st.rank.players}</span>}
            {st && <span className="hx-chip" style={{ color: '#fb923c' }}><Flame size={12} /> {st.streak.current} DAY STREAK</span>}
            {st?.joined && <span className="hx-chip">SINCE {new Date(st.joined).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}</span>}
          </div>
        </div>
      </div>

      {st && <ProfileStats st={st} />}

      <button onClick={() => setEditing(e => !e)} className="btn-game btn-game-glass"
              style={{ width: '100%', minHeight: 42, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Pencil size={13} /> {editing ? 'CLOSE EDITOR' : 'EDIT NAME, AVATAR, EMAIL'}
      </button>

      {editing && <>
      {/* Display name */}
      <div style={sBox}>
        <div style={lbl}>DISPLAY NAME</div>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder={player.username} aria-label="Display name" className="hx-input" style={inputSt} />
      </div>

      {/* Email (editable) */}
      <div style={sBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={lbl}>EMAIL</div>
          <span className="hx-chip" style={{ color: (player as any).email_verified ? '#4ade80' : '#fbbf24', marginBottom: 8 }}>
            {(player as any).email_verified ? <Check size={11} /> : <AlertTriangle size={11} />}
            {(player as any).email_verified ? 'VERIFIED' : 'NOT VERIFIED'}
          </span>
        </div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" className="hx-input" style={inputSt} />
      </div>

      {/* Avatar picker — visual icons */}
      <div style={sBox}>
        <div style={lbl}>AVATAR</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))', gap: 8 }}>
          {AVATARS.map(a => (
            <button key={a} onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`} aria-pressed={avatar === a} style={{
              position: 'relative', height: 56, borderRadius: 12, cursor: 'pointer',
              background: avatar === a ? `linear-gradient(160deg, ${avatarBg}40, ${avatarBg}14)` : 'rgba(255,255,255,0.03)',
              border: avatar === a ? `2px solid ${avatarBg}` : '2px solid rgba(255,255,255,0.08)',
              boxShadow: avatar === a ? '0 4px 0 rgba(0,0,0,0.35)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              <IconSVG id={a} size={44} />
              {avatar === a && <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: '2px solid #0d1b2a' }}><Check size={10} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
      </div>

      {/* Avatar background color */}
      <div style={sBox}>
        <div style={lbl}>AVATAR COLOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => setAvatarBg(c)} aria-label={`Avatar color ${c}`} aria-pressed={avatarBg === c} style={{
              width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
              background: c, border: avatarBg === c ? '3px solid #e2e8f0' : '2px solid rgba(255,255,255,0.08)',
              boxShadow: avatarBg === c ? '0 4px 0 rgba(0,0,0,0.35)' : `0 2px 6px ${c}30`,
              transform: avatarBg === c ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.15s',
            }} />
          ))}
        </div>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving} className="btn-game btn-game-blue" style={{
        width: '100%', fontSize: 12, letterSpacing:0.5, minHeight: 46,
        opacity: saving ? 0.6 : 1,
      }}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</button>
      </>}

      {/* Admin Panel — staff only */}
      {(player as any)?.is_staff && (
        <button onClick={() => { window.location.href = '/gm' }} className="btn-game btn-game-gold" style={{
          width: '100%', fontSize: 11, letterSpacing:0.5, minHeight: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <IconSVG id="crown" size={12} /> ADMIN PANEL (GM)
        </button>
      )}

      {/* Logout + Delete */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => { useStore.getState().logout(); window.location.href = '/login' }} className="btn-game btn-game-glass" style={{
          flex: '1 1 140px', minHeight: 42, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><LogOut size={14} /> LOGOUT</button>
        {/* No backend for account deletion yet — disabled with SOON chip (RULE 1) */}
        <button disabled aria-disabled="true" title="Coming soon" style={{
          flex: '1 1 140px', minHeight: 42, borderRadius: 12, cursor: 'not-allowed', opacity: 0.6,
          background: 'rgba(220,38,38,0.05)', border: '2px solid rgba(220,38,38,0.25)',
          color: '#f87171', fontSize: 11, fontWeight: 700, letterSpacing:0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><Trash2 size={14} /> DELETE ACCOUNT <span className="hx-chip" style={{ padding: '2px 6px' }}>SOON</span></button>
      </div>
    </div>
  )
}

/** Every number comes from GET /api/players/me/profile-stats/ (live game data). */
function ProfileStats({ st }: { st: any }) {
  const mono = "'Share Tech Mono', monospace"
  const r = st.record
  const fights = r.attacks_won + r.attacks_lost + r.defenses_won + r.defenses_lost
  const winPct = fights ? Math.round(((r.attacks_won + r.defenses_won) / fights) * 100) : null
  const go = (panel: any) => useStore.getState().setActivePanel(panel)
  const Tile = ({ icon, label, value, sub, color, onClick }: any) => (
    <button onClick={onClick} className="hx-card" style={{ textAlign: 'left', cursor: onClick ? 'pointer' : 'default', padding: 12, display: 'flex', flexDirection: 'column', gap: 4, color: 'inherit' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, letterSpacing: 1.5, fontWeight: 700, color }}>{icon}{label}</span>
      <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--hx-text-3)', textTransform: 'none', letterSpacing: 0 }}>{sub}</span>
    </button>
  )
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Tile icon={<Crown size={12} />} label="EMPIRE" color="#fbbf24" value={st.empire.territories}
              sub={`${st.empire.kingdoms} kingdoms · biggest ${st.empire.largest_kingdom} hexes`} onClick={() => go('empire')} />
        <Tile icon={<IconSVG id="hex_coin" size={12} />} label="INCOME" color="#fde68a" value={Math.round(st.empire.hex_per_day).toLocaleString()}
              sub="HEX per day" onClick={() => go('empire')} />
        <Tile icon={<Swords size={12} />} label="ARMY" color="#f87171" value={st.army.units}
              sub={`ATK ${st.army.attack} · DEF ${st.army.defense}`} onClick={() => go('combat')} />
        <Tile icon={<Sparkles size={12} />} label="COLLECTION" color="#c084fc" value={st.collection.landmarks + st.collection.event_tokens}
              sub={`${st.collection.landmarks} landmarks · ${st.collection.event_tokens} event tokens`} onClick={() => go('codex')} />
      </div>

      <div style={sBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={lbl}>BATTLE RECORD</div>
          {winPct != null && <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: winPct >= 50 ? '#4ade80' : '#f87171' }}>{winPct}% WINS</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
          {[['ATTACKS WON', r.attacks_won, '#4ade80'], ['ATTACKS LOST', r.attacks_lost, '#f87171'],
            ['DEFENSES HELD', r.defenses_won, '#60a5fa'], ['HEXES LOST', r.defenses_lost, '#fb923c']].map(([l, v, c]: any) => (
            <div key={l}><div style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--hx-text-3)', fontWeight: 700 }}>{l}</div></div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--hx-text-3)', marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
          {r.territories_captured} territories conquered · {r.units_lost} units lost in battle
        </div>
        {st.recent_battles.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {st.recent_battles.map((b: any) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '6px 8px', borderRadius: 8,
                                     background: b.won ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)' }}>
              {b.role === 'attack' ? <Swords size={13} color="#f87171" /> : <Shield size={13} color="#60a5fa" />}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'none', letterSpacing: 0 }}>
                {b.role === 'attack' ? 'Attacked' : 'Defended'} {b.place} <span style={{ color: 'var(--hx-text-3)' }}>vs {b.opponent}</span></span>
              <b style={{ color: b.won ? '#4ade80' : '#f87171', fontSize: 10 }}>{b.won ? (b.captured ? 'CAPTURED' : 'WON') : 'LOST'}</b>
            </div>
          ))}
        </div>}
      </div>
    </>
  )
}

const CC: Record<string,string> = { territory:'#0099cc',combat:'#dc2626',economy:'#8b5cf6',social:'#22c55e',exploration:'#f59e0b',streak:'#cc8800',tdc:'#3b82f6',secret:'#475569' }

function AchievementsTab() {
  const [cf, setCf] = useState('ALL')
  const isStaff = !!(usePlayer() as any)?.is_staff
  const { data: achData, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get('/progression/achievements/').then(r => r.data).catch(() => null),
    staleTime: 60000,
  })

  const achievements = achData?.achievements || []
  const cats: string[] = ['ALL', ...Array.from(new Set<string>(achievements.map((a: any) => String(a.category || '').toUpperCase()).filter(Boolean) as string[]))]
  const filtered = cf === 'ALL' ? achievements : achievements.filter((a: any) => (a.category || "").toUpperCase() === cf)
  const unlocked = achData?.unlocked_count || 0
  const total = achData?.total_count || achievements.length

  if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} className="hx-skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
  if (!achievements.length) return (
    <div className="hx-empty">
      <IconSVG id="trophy" size={52} />
      <div className="hx-empty__title">NO ACHIEVEMENTS YET</div>
      <div style={{ fontSize: 11, textTransform: 'none', fontFamily: 'system-ui', letterSpacing: 0 }}>Badges will appear here as you conquer, trade and explore.</div>
      {isStaff && <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)', textTransform: 'none', fontFamily: "'Share Tech Mono', monospace" }}>GM: python manage.py seed_achievements</div>}
    </div>
  )

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <div style={{ ...sBox, textAlign:'center' }}><div style={{ fontSize:28,fontWeight:900,color:'#fbbf24',fontFamily:"'Share Tech Mono',monospace" }}>{unlocked}/{total}</div><div style={lbl}>BADGES UNLOCKED</div><div className="hx-progress" style={{ ['--accent' as any]:'#fbbf24' }}><div className="hx-progress__fill" style={{ width:`${total ? (unlocked/total)*100 : 0}%` }} /></div></div>
      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>{cats.map((c: string)=>(
        <button key={c} onClick={()=>setCf(c)} style={{ padding:'6px 12px',minHeight:32,borderRadius:999,cursor:'pointer',fontSize: 11,fontWeight:700,letterSpacing:0.5,fontFamily:'var(--font-heading)',background:cf===c?`${CC[(c || '').toLowerCase()]||'#0099cc'}15`:'rgba(255,255,255,0.03)',border:`2px solid ${cf===c?`${CC[(c || '').toLowerCase()]||'#0099cc'}30`:'rgba(255,255,255,0.05)'}`,color:cf===c?(CC[(c || '').toLowerCase()]||'#0099cc'):'rgba(255,255,255,0.5)' }}>{c}</button>
      ))}</div>
      {filtered.map((b: any) => { const done = b.unlocked; const catCol = CC[b.category] || '#6b7280'; return (
        <div key={b.id} style={{ display:'flex',gap:10,padding:'10px 12px',borderRadius:10,background:done?'rgba(204,136,0,0.04)':'rgba(255,255,255,0.03)',border:`2px solid ${done?'rgba(204,136,0,0.15)':'rgba(255,255,255,0.05)'}`,opacity:done?1:0.6 }}>
          <span style={{ filter:done?'':'grayscale(1)' }}><EmojiIcon emoji={b.icon} size={34} /></span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12,fontWeight:700,color:'#e2e8f0' }}>{b.name}</div>
            <div style={{ fontSize: 11,color:catCol,fontWeight:700,letterSpacing:0.5,marginTop:2 }}>{(b.category || "").toUpperCase()}</div>
            <div style={{ fontSize:11,color:'rgba(226,232,240,0.6)',marginTop:3,textTransform:'none',fontFamily:'system-ui',letterSpacing:0 }}>{b.description}</div>
          </div>
          <div style={{ textAlign:'right',flexShrink:0 }}><div style={{ display:'flex',alignItems:'center',gap:2 }}><IconSVG id="hex_coin" size={12} /><span style={{ fontSize:11,fontWeight:900,color:done?'#cc8800':'rgba(255,255,255,0.2)',fontFamily:"'Share Tech Mono',monospace" }}>{b.reward_tdc}</span></div>{done&&<div style={{ fontSize: 11,color:'#4ade80',fontWeight:700,marginTop:4,display:'flex',alignItems:'center',gap:3 }}><Check size={11} /> UNLOCKED</div>}</div>
        </div>
      )})}
    </div>
  )
}

function PreferencesTab() {
  const sound = useStore(s => s.masterSound)
  const setSound = useStore(s => s.setMasterSound)
  const music = useStore(s => s.musicEnabled)
  const setMusic = useStore(s => s.setMusicEnabled)
  const sfx = useStore(s => s.sfxEnabled)
  const setSfx = useStore(s => s.setSfxEnabled)
  const mapTheme = useStore(s => s.mapTheme)
  const setMapTheme = useStore(s => s.setMapTheme)

  const Tog=({l,v,f}:{l:string,v:boolean,f:(b:boolean)=>void})=>(
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0' }}>
      <span style={{ fontSize:11,color:'#e2e8f0',fontWeight:600 }}>{l}</span>
      <button onClick={()=>f(!v)} role="switch" aria-checked={v} aria-label={l} style={{ width:40,height:22,borderRadius:11,cursor:'pointer',border:'none',background:v?'#0099cc':'rgba(255,255,255,0.08)',padding:2,display:'flex',alignItems:'center',transition:'background 0.2s' }}>
        <div style={{ width:18,height:18,borderRadius:'50%',background:'#fff',transform:v?'translateX(18px)':'translateX(0)',transition:'transform 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}/>
      </button>
    </div>
  )
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={sBox}><div style={lbl}>SOUND</div><Tog l="Master sound" v={sound} f={setSound}/><Tog l="Music" v={music} f={setMusic}/><Tog l="Sound effects" v={sfx} f={setSfx}/></div>
      <div style={sBox}><div style={lbl}>MAP THEME</div><div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>{[{id:'game',n:'GAME'},{id:'satellite',n:'SATELLITE'}].map(t=>(
        <button key={t.id} onClick={()=>setMapTheme(t.id as any)} style={{ flex:'1 1 45%',padding:'10px 8px',minHeight:42,borderRadius:10,cursor:'pointer',fontSize: 11,fontWeight:700,letterSpacing:0.5,fontFamily:'var(--font-heading)',background:mapTheme===t.id?'rgba(0,153,204,0.15)':'rgba(255,255,255,0.04)',border:`2px solid ${mapTheme===t.id?'#0099cc':'rgba(255,255,255,0.08)'}`,color:mapTheme===t.id?'#0099cc':'rgba(255,255,255,0.65)' }}>{t.n}</button>
      ))}</div></div>
    </div>
  )
}

export function ProfilePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('commander')
  return (
    <GlassPanel title="PROFILE" onClose={onClose} accent="#0099cc" icon={<IconSVG id="person" size={24} />} subtitle="Commander profile & settings">
      <div className="hx-tabs" role="tablist">
        {TABS.map(t=>(
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab==='commander'&&<CommanderTab/>}
      {tab==='achievements'&&<AchievementsTab/>}
      {tab==='preferences'&&<PreferencesTab/>}
    </GlassPanel>
  )
}
