/**
 * HexodBottomBar — GDD Section 4 bottom interface
 * Actions: Attaquer · Construire · Recherche · Commerce · Alliances · Carte stratégique · Logs
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, usePlayer } from '../../store'
import { SkillTreePanel } from './SkillTreePanel'
import { ResourcesPanel } from './ResourcesPanel'
import {
  IconCombat, IconBuild, IconResearch, IconTrade,
  IconAlliance, IconStrategy, IconLogs,
} from '../ui/HexodIcons'

const ACTIONS = [
  { id:'attack',    icon:<IconCombat size={20} />,   label:'Attaquer',   color:'#EF4444' },
  { id:'build',     icon:<IconBuild size={20} />,    label:'Construire',  color:'#F59E0B' },
  { id:'research',  icon:<IconResearch size={20} />, label:'Recherche',   color:'#8B5CF6' },
  { id:'trade',     icon:<IconTrade size={20} />,    label:'Commerce',    color:'#10B981' },
  { id:'alliances', icon:<IconAlliance size={20} />, label:'Alliances',   color:'#3B82F6' },
  { id:'strategy',  icon:<IconStrategy size={20} />, label:'Stratégie',   color:'#6B7280' },
  { id:'logs',      icon:<IconLogs size={20} />,     label:'Logs',        color:'#4B5563' },
] as const

export function HexodBottomBar() {
  const player = usePlayer()
  const [active, setActive] = useState<string|null>(null)
  const setActivePanel = useStore(s => s.setActivePanel)

  if (!player) return null

  const toggle = (id: string) => {
    if (active === id) { setActive(null); return }
    setActive(id)
    // Wire to existing panels
    if (id === 'attack') setActivePanel('combat')
    else if (id === 'alliances') setActivePanel('alliance')
    else if (id === 'trade') setActivePanel('trade')
    else if (id === 'logs') setActivePanel('events')
  }

  return (
    <>
      {/* Panel overlays */}
      <AnimatePresence>
        {active === 'research' && <SkillTreePanel onClose={() => setActive(null)} />}
        {active === 'build' && <BuildPanel onClose={() => setActive(null)} />}
        {active === 'strategy' && <StrategyPanel onClose={() => setActive(null)} />}
      </AnimatePresence>

      {/* Bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 800,
        background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 8px' }}>
          {ACTIONS.map(a => (
            <button key={a.id} onClick={() => toggle(a.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
              background: active === a.id ? `${a.color}22` : 'transparent',
              border: `1px solid ${active === a.id ? a.color + '66' : 'transparent'}`,
              color: active === a.id ? a.color : '#6B7280',
              flex: 1, maxWidth: 64,
              transition: 'all 0.15s',
            }}>
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', color: active===a.id ? a.color : '#6B7280' }}>{a.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active === a.id ? 700 : 400, lineHeight: 1 }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Build Panel ── */
function BuildPanel({ onClose }: { onClose: () => void }) {
  const BUILDINGS = [
    { name:'Fortification', desc:'Défense +30%', cost:'500 Fer, 200 Acier', icon:'🏰', time:'6h' },
    { name:'Mine',          desc:'Ressources +40%', cost:'300 Charbon, 100 Silicium', icon:'⛏️', time:'8h' },
    { name:'Tour de contrôle', desc:'Cluster +25%', cost:'400 Acier, 200 Titanium', icon:'🗼', time:'12h' },
    { name:'Centre de données', desc:'Intel +50%', cost:'300 Silicium, 200 Composants', icon:'🖥️', time:'10h' },
    { name:'Raffinerie',    desc:'Pétrole x2', cost:'400 Pétrole, 200 Acier', icon:'🏭', time:'16h' },
    { name:'Port spatial',  desc:'Déblocage tech', cost:'500 Titanium, 300 Données', icon:'🚀', time:'24h' },
  ]

  return (
    <SlidePanel title="🏗️ Construire" color="#F59E0B" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 2px' }}>
        {BUILDINGS.map(b => (
          <button key={b.name} style={{
            padding: '10px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'left', color: '#fff',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{b.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{b.name}</div>
            <div style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>{b.desc}</div>
            <div style={{ fontSize: 9, color: '#6B7280', marginTop: 3 }}>{b.cost}</div>
            <div style={{ fontSize: 9, color: '#F59E0B', marginTop: 2 }}>⏱ {b.time}</div>
          </button>
        ))}
      </div>
    </SlidePanel>
  )
}

/* ── Strategy Panel ── */
function StrategyPanel({ onClose }: { onClose: () => void }) {
  const LAYERS = [
    { name:'Ressources', icon:'⛏️', desc:'Zones de production' },
    { name:'Conflits actifs', icon:'⚔️', desc:'Batailles en cours' },
    { name:'Alliances', icon:'🤝', desc:'Blocs territoriaux' },
    { name:'Influence', icon:'🌐', desc:'Zones de contrôle indirect' },
    { name:'POI', icon:'📍', desc:'Points d\'intérêt stratégiques' },
  ]

  return (
    <SlidePanel title="🗺️ Carte stratégique" color="#6B7280" onClose={onClose}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        Activez les couches d'information sur la carte
      </div>
      {LAYERS.map(l => (
        <div key={l.name} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', marginBottom: 6,
          background: 'rgba(255,255,255,0.04)', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 20 }}>{l.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{l.name}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{l.desc}</div>
          </div>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }} />
        </div>
      ))}
    </SlidePanel>
  )
}

/* ── Shared slide panel ── */
function SlidePanel({ title, color, children, onClose }: {
  title: string; color: string; children: React.ReactNode; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{
        position: 'fixed', bottom: 65, left: 8, right: 8, zIndex: 850,
        background: 'rgba(6,6,16,0.98)', backdropFilter: 'blur(16px)',
        border: `1px solid ${color}33`, borderRadius: 16,
        maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: `1px solid ${color}22`,
        background: `linear-gradient(90deg, ${color}18, transparent)` }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          color: '#6B7280', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{children}</div>
    </motion.div>
  )
}
