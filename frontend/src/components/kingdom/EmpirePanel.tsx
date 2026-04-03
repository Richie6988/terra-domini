/**
 * EmpirePanel — Empire management hub.
 * 3 tabs: Kingdoms list (click→detail overlay), Military, Empire Stats.
 * Opened from dock "Empire" button.
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import toast from 'react-hot-toast'

interface Props { onClose: () => void }
type Tab = 'kingdoms' | 'military' | 'stats'

const TABS: { id: Tab; label: string }[] = [
  { id: 'kingdoms', label: '👑 KINGDOMS' },
  { id: 'military', label: '⚔ MILITARY' },
  { id: 'stats', label: '📊 STATS' },
]

const sBox: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.06)' }
const lbl: React.CSSProperties = { fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.4)', fontFamily: "'Orbitron', sans-serif", marginBottom: 6 }
const statCard = (c: string): React.CSSProperties => ({ padding: '12px 8px', borderRadius: 10, textAlign: 'center', background: `${c}08`, border: `1px solid ${c}20` })

interface Kingdom {
  cluster_id: string; name: string; size: number; is_main: boolean; tier: number;
  tdc_per_24h: number; h3_indexes: string[]; centroid_lat: number; centroid_lon: number; color?: string;
}

const TIER_COLORS = ['#4B5563', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#FF0080']

// ═══ KINGDOMS TAB ═══
function KingdomsTab({ kingdoms, onTeleport }: { kingdoms: Kingdom[]; onTeleport: (lat: number, lon: number) => void }) {
  if (!kingdoms.length) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'rgba(26,42,58,0.3)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏴</div>
      <div style={{ fontSize: 11, fontWeight: 600 }}>No kingdoms yet</div>
      <div style={{ fontSize: 9, marginTop: 4 }}>Claim 2+ adjacent territories to form a kingdom</div>
    </div>
  )
  const sorted = [...kingdoms].sort((a, b) => b.size - a.size)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(k => {
        const col = TIER_COLORS[Math.min(k.tier, 6)]
        return (
          <div key={k.cluster_id} style={{
            display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
            background: k.is_main ? `${col}06` : 'rgba(255,255,255,0.4)',
            border: `1.5px solid ${k.is_main ? `${col}25` : 'rgba(0,60,100,0.06)'}`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
            onClick={() => onTeleport(k.centroid_lat, k.centroid_lon)}
          >
            {/* Kingdom icon */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `linear-gradient(135deg, ${col}, ${col}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, boxShadow: `0 2px 10px ${col}25`, flexShrink: 0,
            }}>{k.is_main ? '👑' : '🏰'}</div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a' }}>{k.name || `Kingdom ${k.cluster_id.slice(0, 6)}`}</span>
                {k.is_main && <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 6, fontWeight: 700, background: `${col}15`, color: col }}>MAIN</span>}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>
                Tier {k.tier} · {k.size} territories
              </div>
              {/* Mini progress bar showing tier */}
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,60,100,0.06)', marginTop: 4, width: 80, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (k.tier / 6) * 100)}%`, height: '100%', background: col, borderRadius: 2 }} />
              </div>
            </div>

            {/* Income */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <CrystalIcon size="sm" />
                <span style={{ fontSize: 13, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>+{Math.round(k.tdc_per_24h)}</span>
              </div>
              <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', marginTop: 1 }}>HEX/DAY</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══ MILITARY TAB ═══
const UNITS = [
  { name: 'Infantry', icon: '🗡', cost: 5, atk: 10, def: 8, color: '#dc2626' },
  { name: 'Naval', icon: '⚓', cost: 15, atk: 35, def: 30, color: '#0099cc' },
  { name: 'Aerial', icon: '✈️', cost: 25, atk: 45, def: 15, color: '#8b5cf6' },
  { name: 'Engineer', icon: '🔧', cost: 20, atk: 8, def: 20, color: '#cc8800' },
  { name: 'Medic', icon: '🏥', cost: 30, atk: 2, def: 5, color: '#22c55e' },
  { name: 'Spy', icon: '🕵️', cost: 100, atk: 15, def: 3, color: '#475569' },
]

function MilitaryTab() {
  // Mock data — in prod comes from backend
  const [counts] = useState<Record<string, number>>({ Infantry: 12, Naval: 2, Aerial: 0, Engineer: 3, Medic: 1, Spy: 0 })
  const totalAtk = UNITS.reduce((s, u) => s + u.atk * (counts[u.name] || 0), 0)
  const totalDef = UNITS.reduce((s, u) => s + u.def * (counts[u.name] || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Power summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={statCard('#dc2626')}><div style={lbl}>TOTAL ATTACK</div><div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', fontFamily: "'Share Tech Mono', monospace" }}>{totalAtk}</div></div>
        <div style={statCard('#3b82f6')}><div style={lbl}>TOTAL DEFENSE</div><div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6', fontFamily: "'Share Tech Mono', monospace" }}>{totalDef}</div></div>
      </div>

      {/* Unit roster */}
      {UNITS.map(u => (
        <div key={u.name} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.4)', border: `1px solid ${u.color}10`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{u.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1a2a3a' }}>{u.name}</div>
            <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.4)' }}>ATK {u.atk} · DEF {u.def} · {u.cost}◆</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: u.color, fontFamily: "'Share Tech Mono', monospace", minWidth: 30, textAlign: 'right' }}>
            ×{counts[u.name] || 0}
          </div>
          <button onClick={() => toast.success(`Recruiting ${u.name}...`)} style={{
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 7, fontWeight: 700,
            background: `${u.color}08`, border: `1px solid ${u.color}20`, color: u.color,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
          }}>+ RECRUIT</button>
        </div>
      ))}
    </div>
  )
}

// ═══ STATS TAB ═══
function StatsTab({ kingdoms }: { kingdoms: Kingdom[] }) {
  const player = usePlayer()
  const s = (player as any)?.stats || {}
  const totalTerr = kingdoms.reduce((sum, k) => sum + k.size, 0)
  const totalIncome = kingdoms.reduce((sum, k) => sum + k.tdc_per_24h, 0)
  const totalKingdoms = kingdoms.length
  const mainKingdom = kingdoms.find(k => k.is_main)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={statCard('#0099cc')}><div style={lbl}>TERRITORIES</div><div style={{ fontSize: 20, fontWeight: 900, color: '#0099cc', fontFamily: "'Share Tech Mono', monospace" }}>{totalTerr}</div></div>
        <div style={statCard('#cc8800')}><div style={lbl}>KINGDOMS</div><div style={{ fontSize: 20, fontWeight: 900, color: '#cc8800', fontFamily: "'Share Tech Mono', monospace" }}>{totalKingdoms}</div></div>
        <div style={statCard('#7950f2')}><div style={lbl}>HEX/DAY</div><div style={{ fontSize: 20, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace" }}>{Math.round(totalIncome)}</div></div>
      </div>

      {/* Empire details */}
      <div style={sBox}>
        <div style={lbl}>EMPIRE OVERVIEW</div>
        {[
          { k: 'Main Kingdom', v: mainKingdom?.name || 'None', c: '#cc8800' },
          { k: 'Largest Kingdom', v: `${(kingdoms[0]?.size || 0)} territories`, c: '#0099cc' },
          { k: 'Battles Won', v: String(s.territories_captured || 0), c: '#dc2626' },
          { k: 'Battles Lost', v: String(s.territories_lost || 0), c: '#6b7280' },
          { k: 'Territories Explored', v: String(s.territories_owned || 0), c: '#22c55e' },
          { k: 'Account Age', v: player?.date_joined ? `${Math.floor((Date.now() - new Date(player.date_joined).getTime()) / 86400000)}d` : '?', c: '#8b5cf6' },
        ].map(row => (
          <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,60,100,0.04)' }}>
            <span style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)' }}>{row.k}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: row.c, fontFamily: "'Share Tech Mono', monospace" }}>{row.v}</span>
          </div>
        ))}
      </div>

      {/* Resource production (placeholder) */}
      <div style={sBox}>
        <div style={lbl}>RESOURCE PRODUCTION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { name: 'Iron', icon: '⛏', val: 120 }, { name: 'Oil', icon: '🛢', val: 85 },
            { name: 'Food', icon: '🌾', val: 200 }, { name: 'Energy', icon: '⚡', val: 95 },
            { name: 'Water', icon: '💧', val: 180 }, { name: 'Gold', icon: '🪙', val: 30 },
            { name: 'Data', icon: '📡', val: 45 }, { name: 'Influence', icon: '🎭', val: 60 },
          ].map(r => (
            <div key={r.name} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'rgba(0,60,100,0.02)' }}>
              <div style={{ fontSize: 16 }}>{r.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1a2a3a', fontFamily: "'Share Tech Mono', monospace" }}>{r.val}</div>
              <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)' }}>{r.name}/d</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══ MAIN ═══
export function EmpirePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('kingdoms')
  const player = usePlayer()

  const { data } = useQuery<{ kingdoms: Kingdom[] }>({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000,
    enabled: !!player,
  })
  const kingdoms = data?.kingdoms ?? []

  const handleTeleport = (lat: number, lon: number) => {
    onClose()
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hexod:flyTo', { detail: { lat, lon, zoom: 14 } }))
    }, 200)
  }

  return (
    <GlassPanel title="EMPIRE" onClose={onClose} accent="#cc8800">
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,60,100,0.08)', marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(204,136,0,0.08)' : 'transparent',
            borderBottom: tab === t.id ? '2px solid #cc8800' : '2px solid transparent',
            color: tab === t.id ? '#cc8800' : 'rgba(26,42,58,0.4)',
            fontSize: 8, fontWeight: 700, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'kingdoms' && <KingdomsTab kingdoms={kingdoms} onTeleport={handleTeleport} />}
      {tab === 'military' && <MilitaryTab />}
      {tab === 'stats' && <StatsTab kingdoms={kingdoms} />}
    </GlassPanel>
  )
}
