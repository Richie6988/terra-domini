/**
 * CombatPanel — active battles, attack, military units management.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Shield, Clock, Target, ChevronRight, X } from 'lucide-react'
import { api } from '../../services/api'
import { useActiveBattles } from '../../store'
import toast from 'react-hot-toast'

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

const UNIT_TYPES = [
  { key: 'infantry',   label: 'Infantry',   emoji: '⚔️',  atk: 10, def: 8,  cost: 50  },
  { key: 'cavalry',    label: 'Cavalry',    emoji: '🐎',  atk: 20, def: 10, cost: 120 },
  { key: 'artillery',  label: 'Artillery',  emoji: '💣',  atk: 35, def: 5,  cost: 200 },
  { key: 'naval',      label: 'Naval',      emoji: '⚓',  atk: 25, def: 20, cost: 300 },
]

function BattleCard({ battle }: { battle: any }) {
  const [expanded, setExpanded] = useState(false)
  const resolves = new Date(battle.resolves_at || battle.estimated_end)
  const diff = resolves.getTime() - Date.now()
  const mins = Math.max(0, Math.floor(diff / 60000))
  const hrs  = Math.floor(mins / 60)
  const timeLeft = diff <= 0 ? 'Resolving…' : hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
  const isAttacker = battle.side === 'attacker'
  const statusColor = { preparing: '#F59E0B', active: '#EF4444', in_progress: '#EF4444', resolving: '#8B5CF6', completed: '#10B981' }
  const color = (statusColor as any)[battle.status] ?? '#6B7280'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}
    >
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {isAttacker ? '⚔️' : '🛡️'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
            {isAttacker ? '⚔️ Attacking' : '🛡️ Defending'} {battle.territory_name || battle.territory_h3?.slice(0, 8) + '…'}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {battle.battle_type} · vs {isAttacker ? battle.defender_username : battle.attacker_username}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color, fontWeight: 600 }}>{timeLeft}</div>
          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 1 }}>{battle.status}</div>
        </div>
        <ChevronRight size={14} color="#4B5563" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <Stat label="Win probability" value={`${Math.round(toNum(battle.attacker_win_probability) * (isAttacker ? 1 : -1) * 100 + 50)}%`} />
                <Stat label="Resources at stake" value={`${battle.resources_looted ?? '~150'} TDC`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{value}</div>
    </div>
  )
}

function TrainTab() {
  const [units, setUnits] = useState<Record<string, number>>({})
  const qc = useQueryClient()
  const total = Object.entries(units).reduce((sum, [k, n]) => {
    const u = UNIT_TYPES.find(u => u.key === k)
    return sum + n * (u?.cost ?? 0)
  }, 0)

  const trainMut = useMutation({
    mutationFn: () => {
      // Train each unit type as separate shop purchase
      const promises = Object.entries(units)
        .filter(([_, n]) => n > 0)
        .map(([key, n]) => api.post('/shop/purchase/', { item_code: `unit_${key}`, quantity: n }))
      return Promise.all(promises)
    },
    onSuccess: () => { toast.success('Units trained!'); setUnits({}); qc.invalidateQueries({ queryKey: ['player'] }) },
    onError: () => toast.error('Not enough TDC'),
  })

  return (
    <div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Train units for your territories</div>
      {UNIT_TYPES.map(u => (
        <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 20, width: 28 }}>{u.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{u.label}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>ATK {u.atk} · DEF {u.def} · {u.cost} TDC each</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setUnits(p => ({ ...p, [u.key]: Math.max(0, (p[u.key] ?? 0) - 1) }))}
              style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 16 }}>−</button>
            <span style={{ fontSize: 14, color: '#fff', minWidth: 20, textAlign: 'center' }}>{units[u.key] ?? 0}</span>
            <button onClick={() => setUnits(p => ({ ...p, [u.key]: (p[u.key] ?? 0) + 1 }))}
              style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,255,135,0.1)', border: '1px solid rgba(0,255,135,0.2)', color: '#00FF87', cursor: 'pointer', fontSize: 16 }}>+</button>
          </div>
        </div>
      ))}
      {total > 0 && (
        <button onClick={() => trainMut.mutate()}
          style={{ width: '100%', marginTop: 14, padding: '12px', background: '#00FF87', border: 'none', borderRadius: 10, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Train — {total} TDC
        </button>
      )}
    </div>
  )
}

export function CombatPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'active' | 'train'>('active')
  const activeBattles = useActiveBattles()

  const { data: history } = useQuery({
    queryKey: ['battle-history'],
    queryFn: () => api.get('/battles/history/').then(r => r.data?.results ?? r.data ?? []).catch(() => []),
    staleTime: 60000,
  })

  return (
    <Panel title="Combat" emoji="⚔️" onClose={onClose}>
      <Tabs tabs={[{ id: 'active', label: `Active (${activeBattles.length})` }, { id: 'train', label: 'Train Units' }]}
        active={tab} onChange={t => setTab(t as any)} />

      {tab === 'active' && (
        <div>
          {activeBattles.length === 0 ? (
            <Empty icon="⚔️" text="No active battles" sub="Attack a territory from the map to start" />
          ) : (
            activeBattles.map(b => <BattleCard key={b.id} battle={b} />)
          )}
          {(history ?? []).length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 16, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recent</div>
              {(history ?? []).slice(0, 5).map((b: any) => <BattleCard key={b.id} battle={b} />)}
            </>
          )}
        </div>
      )}
      {tab === 'train' && <TrainTab />}
    </Panel>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Panel({ title, emoji, onClose, children }: { title: string; emoji: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 1000, display: 'flex', flexDirection: 'column',
        background: '#0A0A14', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <span style={{ fontSize: 20, marginRight: 10 }}>{emoji}</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#fff', flex: 1 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>{children}</div>
    </motion.div>
  )
}

function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 4 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
          background: active === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: active === t.id ? '#fff' : '#6B7280',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function Empty({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, color: '#fff', marginBottom: 6 }}>{text}</div>
      <div style={{ fontSize: 12, color: '#4B5563' }}>{sub}</div>
    </div>
  )
}
