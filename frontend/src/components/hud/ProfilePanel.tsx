/**
 * ProfilePanel — Player profile management.
 * 3 tabs: Commander (edit profile), Achievements (badges), Preferences (settings).
 */
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MiniIcon, StatusDot } from '../shared/MiniIcons'
import { usePlayer, useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }
type Tab = 'commander' | 'achievements' | 'preferences'

const TABS: { id: Tab; label: string }[] = [
  { id: 'commander', label: 'COMMANDER' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
  { id: 'preferences', label: 'PREFERENCES' },
]
const AVATARS = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S']
const sBox: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.06)' }
const lbl: React.CSSProperties = { fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.4)', fontFamily: "'Orbitron', sans-serif", marginBottom: 6 }
const inputSt: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 11, background: 'rgba(0,60,100,0.03)', border: '1px solid rgba(0,60,100,0.1)', color: '#1a2a3a', outline: 'none', boxSizing: 'border-box' as const }

function CommanderTab() {
  const player = usePlayer()
  const [name, setName] = useState(player?.display_name || '')
  const [avatar, setAvatar] = useState((player as any)?.avatar_emoji || '🦅')
  const [saving, setSaving] = useState(false)
  const save = useCallback(async () => {
    setSaving(true)
    try { await api.patch('/players/update-profile/', { display_name: name, avatar_emoji: avatar }); toast.success('Profile updated!') }
    catch { toast.error('Failed to save') }
    setSaving(false)
  }, [name, avatar])
  if (!player) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...sBox, display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #0099cc, #cc8800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '3px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>{avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#1a2a3a' }}>{player.display_name || player.username}</div>
          <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.4)' }}>@{player.username}</div>
          <div style={{ fontSize: 9, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace", marginTop: 2 }}>
            ⬡ {(player as any).stats?.territories_owned || 0} territories
          </div>
        </div>
      </div>
      <div style={sBox}><div style={lbl}>DISPLAY NAME</div><input value={name} onChange={e => setName(e.target.value)} maxLength={50} style={inputSt} /></div>
      <div style={sBox}><div style={lbl}>EMAIL</div><div style={{ fontSize: 11, color: 'rgba(26,42,58,0.6)', fontFamily: "'Share Tech Mono', monospace" }}>{player.email} {(player as any).email_verified ? '[V]' : '[!]'}</div></div>
      <div style={sBox}><div style={lbl}>AVATAR</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{AVATARS.map(a => (
        <button key={a} onClick={() => setAvatar(a)} style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18, background: avatar === a ? 'rgba(0,153,204,0.12)' : 'rgba(0,60,100,0.03)', border: `2px solid ${avatar === a ? '#0099cc' : 'rgba(0,60,100,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a}</button>
      ))}</div></div>
      <button onClick={save} disabled={saving} style={{ padding: '12px 20px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #0099cc, #0088bb)', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 2, fontFamily: "'Orbitron', sans-serif", opacity: saving ? 0.6 : 1 }}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => { useStore.getState().logout(); window.location.href = '/login' }} style={{ flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', background: 'rgba(0,60,100,0.04)', border: '1px solid rgba(0,60,100,0.1)', color: 'rgba(26,42,58,0.5)', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>LOGOUT</button>
        <button onClick={() => toast.error('Account deletion coming soon')} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', color: '#dc2626', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>DELETE ACCOUNT</button>
      </div>
    </div>
  )
}

const CC: Record<string,string> = { territory:'#0099cc',combat:'#dc2626',economy:'#8b5cf6',social:'#22c55e',exploration:'#f59e0b',streak:'#cc8800',tdc:'#3b82f6',secret:'#475569' }

function AchievementsTab() {
  const [cf, setCf] = useState('ALL')
  const { data: achData, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get('/progression/achievements/').then(r => r.data).catch(() => null),
    staleTime: 60000,
  })

  const achievements = achData?.achievements || []
  const cats = ['ALL', ...new Set(achievements.map((a: any) => a.category?.toUpperCase()))]
  const filtered = cf === 'ALL' ? achievements : achievements.filter((a: any) => a.category?.toUpperCase() === cf)
  const unlocked = achData?.unlocked_count || 0
  const total = achData?.total_count || achievements.length

  if (isLoading) return <div style={{ textAlign: 'center', padding: 30, color: 'rgba(26,42,58,0.3)', fontSize: 9 }}>Loading achievements...</div>
  if (!achievements.length) return <div style={{ textAlign: 'center', padding: 30, color: 'rgba(26,42,58,0.3)', fontSize: 9 }}>No achievements yet. Seed with: python manage.py seed_achievements</div>

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <div style={{ ...sBox, textAlign:'center' }}><div style={{ fontSize:24,fontWeight:900,color:'#cc8800',fontFamily:"'Share Tech Mono',monospace" }}>{unlocked}/{total}</div><div style={lbl}>BADGES UNLOCKED</div></div>
      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>{cats.map((c: string)=>(
        <button key={c} onClick={()=>setCf(c)} style={{ padding:'4px 10px',borderRadius:8,cursor:'pointer',fontSize:7,fontWeight:700,letterSpacing:1,fontFamily:"'Orbitron',sans-serif",background:cf===c?`${CC[c.toLowerCase()]||'#0099cc'}15`:'rgba(0,60,100,0.03)',border:`1px solid ${cf===c?`${CC[c.toLowerCase()]||'#0099cc'}30`:'rgba(0,60,100,0.06)'}`,color:cf===c?(CC[c.toLowerCase()]||'#0099cc'):'rgba(26,42,58,0.4)' }}>{c}</button>
      ))}</div>
      {filtered.map((b: any) => { const done = b.unlocked; const catCol = CC[b.category] || '#6b7280'; return (
        <div key={b.id} style={{ display:'flex',gap:10,padding:'10px 12px',borderRadius:10,background:done?'rgba(204,136,0,0.04)':'rgba(255,255,255,0.4)',border:`1px solid ${done?'rgba(204,136,0,0.15)':'rgba(0,60,100,0.06)'}`,opacity:done?1:0.6 }}>
          <span style={{ fontSize:22,filter:done?'':'grayscale(1)' }}>{b.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10,fontWeight:700,color:'#1a2a3a' }}>{b.name}</div>
            <div style={{ fontSize:7,color:catCol,fontWeight:600,letterSpacing:1 }}>{b.category?.toUpperCase()}</div>
            <div style={{ fontSize:8,color:'rgba(26,42,58,0.4)',marginTop:2 }}>{b.description}</div>
          </div>
          <div style={{ textAlign:'right',flexShrink:0 }}><div style={{ display:'flex',alignItems:'center',gap:2 }}><CrystalIcon size="sm" /><span style={{ fontSize:11,fontWeight:900,color:done?'#cc8800':'rgba(26,42,58,0.25)',fontFamily:"'Share Tech Mono',monospace" }}>{b.reward_tdc}</span></div>{done&&<div style={{ fontSize:7,color:'#22c55e',fontWeight:700,marginTop:2 }}>✓ UNLOCKED</div>}</div>
        </div>
      )})}
    </div>
  )
}

function PreferencesTab() {
  const [sound,setSound]=useState(true),[music,setMusic]=useState(true),[sfx,setSfx]=useState(true),[notifs,setNotifs]=useState(true),[mapTheme,setMapTheme]=useState('light'),[lang,setLang]=useState('en')
  const Tog=({l,v,f}:{l:string,v:boolean,f:(b:boolean)=>void})=>(
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0' }}>
      <span style={{ fontSize:10,color:'#1a2a3a',fontWeight:600 }}>{l}</span>
      <button onClick={()=>f(!v)} style={{ width:40,height:22,borderRadius:11,cursor:'pointer',border:'none',background:v?'#0099cc':'rgba(0,60,100,0.1)',padding:2,display:'flex',alignItems:'center',transition:'background 0.2s' }}>
        <div style={{ width:18,height:18,borderRadius:'50%',background:'#fff',transform:v?'translateX(18px)':'translateX(0)',transition:'transform 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.15)' }}/>
      </button>
    </div>
  )
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={sBox}><div style={lbl}>SOUND</div><Tog l="Master sound" v={sound} f={setSound}/><Tog l="Music" v={music} f={setMusic}/><Tog l="Sound effects" v={sfx} f={setSfx}/></div>
      <div style={sBox}><div style={lbl}>MAP THEME</div><div style={{ display:'flex',gap:6 }}>{[{id:'light',n:'LIGHT'},{id:'satellite',n:'SAT'},{id:'topo',n:'TOPO'}].map(t=>(
        <button key={t.id} onClick={()=>setMapTheme(t.id)} style={{ flex:1,padding:'10px 8px',borderRadius:8,cursor:'pointer',fontSize:7,fontWeight:700,letterSpacing:1,fontFamily:"'Orbitron',sans-serif",background:mapTheme===t.id?'rgba(0,153,204,0.1)':'rgba(0,60,100,0.03)',border:`2px solid ${mapTheme===t.id?'#0099cc':'rgba(0,60,100,0.06)'}`,color:mapTheme===t.id?'#0099cc':'rgba(26,42,58,0.4)' }}>{t.n}</button>
      ))}</div></div>
      <div style={sBox}><div style={lbl}>NOTIFICATIONS</div><Tog l="Push notifications" v={notifs} f={setNotifs}/></div>
      <div style={sBox}><div style={lbl}>LANGUAGE</div><select value={lang} onChange={e=>setLang(e.target.value)} style={{ ...inputSt, cursor:'pointer' }}><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option></select></div>
    </div>
  )
}

export function ProfilePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('commander')
  return (
    <GlassPanel title="PROFILE" onClose={onClose} accent="#0099cc">
      <div style={{ display:'flex',gap:0,borderBottom:'1px solid rgba(0,60,100,0.08)',marginBottom:14 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,padding:'10px 8px',border:'none',cursor:'pointer',background:tab===t.id?'rgba(0,153,204,0.08)':'transparent',borderBottom:tab===t.id?'2px solid #0099cc':'2px solid transparent',color:tab===t.id?'#0099cc':'rgba(26,42,58,0.4)',fontSize:8,fontWeight:700,letterSpacing:1,fontFamily:"'Orbitron',sans-serif" }}>{t.label}</button>
        ))}
      </div>
      {tab==='commander'&&<CommanderTab/>}
      {tab==='achievements'&&<AchievementsTab/>}
      {tab==='preferences'&&<PreferencesTab/>}
    </GlassPanel>
  )
}
