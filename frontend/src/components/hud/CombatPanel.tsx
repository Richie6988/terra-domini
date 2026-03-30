/**
 * CombatPanel — Military Command Center.
 * 5-tab structure from main_prototype.html:
 *   ⚔ Recruit — Purchase units (6 types, crystal cost)
 *   🏋 Train — Training queue with progress bars
 *   📍 Deploy — Assign units to kingdoms
 *   🔥 War Room — Active battles, threats, distant warfare
 *   📊 History — Battle log, stats
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer, useStore } from '../../store'
import { useKingdomStore } from '../../store/kingdomStore'
import { GlassPanel } from '../shared/GlassPanel'
import { CrystalIcon } from '../shared/CrystalIcon'
import toast from 'react-hot-toast'

// ── Unit types (from prototype) ──
const UNITS = [
  { key: 'infantry',  icon: '⚔', name: 'INFANTRY',  cost: 5,   atk: 10, def: 8,  color: '#64748b', owned: 1240 },
  { key: 'naval',     icon: '🚢', name: 'NAVAL',     cost: 15,  atk: 35, def: 30, color: '#3b82f6', owned: 480 },
  { key: 'aerial',    icon: '✈',  name: 'AERIAL',    cost: 25,  atk: 45, def: 15, color: '#8b5cf6', owned: 320 },
  { key: 'engineer',  icon: '🔧', name: 'ENGINEER',  cost: 20,  atk: 8,  def: 20, color: '#f59e0b', owned: 120 },
  { key: 'medic',     icon: '+',  name: 'MEDIC',     cost: 30,  atk: 2,  def: 5,  color: '#10b981', owned: 85 },
  { key: 'spy',       icon: '👁', name: 'SPY',       cost: 100, atk: 15, def: 3,  color: '#ec4899', owned: 24 },
]

// ── Training queue items ──
const TRAIN_QUEUE = [
  { unit: 'infantry', batch: 50, done: 42, timeLeft: '02:14:30', active: true },
  { unit: 'naval', batch: 10, done: 0, cost: '500 Wood + 200 Steel + 1000 Energy', active: false },
  { unit: 'aerial', batch: 5, done: 0, cost: '300 Steel + 50 Uranium + 2000 Energy', active: false },
  { unit: 'spy', batch: 1, done: 0, cost: '100 Steel + 20 Uranium + 5000 Energy', active: false },
]

// ── Mock battle history ──
const BATTLE_HISTORY = [
  { result: 'WIN',  enemy: 'DARK_OVERLORD', hex: '+12', time: '2h ago' },
  { result: 'LOSS', enemy: 'NEXUS_LORD',    hex: '-3',  time: '5h ago' },
  { result: 'WIN',  enemy: 'ICE_PHANTOM',   hex: '+8',  time: '1d ago' },
  { result: 'WIN',  enemy: 'SAND_WRAITH',   hex: '+5',  time: '2d ago' },
  { result: 'LOSS', enemy: 'EMPEROR_VEX',   hex: '-15', time: '3d ago' },
]

const TABS = [
  { id: 'recruit', label: '⚔ RECRUIT' },
  { id: 'train',   label: '🏋 TRAIN' },
  { id: 'deploy',  label: '📍 DEPLOY' },
  { id: 'warroom', label: '🔥 WAR ROOM' },
  { id: 'history', label: '📊 HISTORY' },
]

interface Props { onClose: () => void }

export function CombatPanel({ onClose }: Props) {
  const [tab, setTab] = useState('recruit')
  const [recruitQty, setRecruitQty] = useState<Record<string, number>>({})
  const player = usePlayer()
  const setActivePanel = useStore(s => s.setActivePanel)
  const kingdoms = useKingdomStore(s => s.kingdoms)
  const activeKingdom = useKingdomStore(s => s.getActiveKingdom())

  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))

  return (
    <GlassPanel title="MILITARY COMMAND" onClose={onClose} accent="#dc2626" width={420}>
      {/* Kingdom attack branch status */}
      {activeKingdom && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)',
        }}>
          <span style={{ fontSize: 14 }}>⚔️</span>
          <div style={{ flex: 1, fontSize: 7, fontWeight: 700, color: '#dc2626', letterSpacing: 2, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
            {activeKingdom.name.toUpperCase()} — MILITARY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CrystalIcon size="sm" />
            <span style={{ fontSize: 10, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace" }}>{tdc.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* 5 Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 8px', borderRadius: 20, cursor: 'pointer',
            fontSize: 7, fontWeight: tab === t.id ? 700 : 500, letterSpacing: 1,
            background: tab === t.id ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.5)',
            color: tab === t.id ? '#dc2626' : 'rgba(26,42,58,0.45)',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            border: `1px solid ${tab === t.id ? 'rgba(220,38,38,0.3)' : 'rgba(0,60,100,0.1)'}`,
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ RECRUIT TAB ═══ */}
      {tab === 'recruit' && (
        <div>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 10 }}>
            PURCHASE UNITS (CRYSTALS REQUIRED)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {UNITS.map(u => {
              const qty = recruitQty[u.key] || 0
              return (
                <div key={u.key} style={{
                  padding: 12, borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.1)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = u.color; e.currentTarget.style.transform = 'scale(1.03)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,60,100,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 40, height: 40, margin: '0 auto 6px',
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: '#fff',
                  }}>{u.icon}</div>
                  <div style={{ fontSize: 8, fontWeight: 900, color: '#1a2a3a', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>{u.name}</div>
                  <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 3, fontFamily: "'Share Tech Mono', monospace" }}>
                    {u.cost} <CrystalIcon size="sm" /> each
                  </div>
                  <div style={{ fontSize: 8, color: '#00884a', marginTop: 2, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>
                    {u.owned.toLocaleString()} owned
                  </div>
                  {/* Quantity selector */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 }}>
                    <button onClick={e => { e.stopPropagation(); setRecruitQty(q => ({ ...q, [u.key]: Math.max(0, (q[u.key] || 0) - 10) })) }}
                      style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(0,60,100,0.1)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, color: '#1a2a3a' }}>−</button>
                    <span style={{ fontSize: 10, fontWeight: 900, minWidth: 24, textAlign: 'center', fontFamily: "'Share Tech Mono', monospace" }}>{qty}</span>
                    <button onClick={e => { e.stopPropagation(); setRecruitQty(q => ({ ...q, [u.key]: (q[u.key] || 0) + 10 })) }}
                      style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(0,60,100,0.1)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, color: '#1a2a3a' }}>+</button>
                  </div>
                  {qty > 0 && (
                    <button onClick={() => { toast.success(`Recruited ${qty} ${u.name}`); setRecruitQty(q => ({ ...q, [u.key]: 0 })) }}
                      style={{ marginTop: 4, padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', background: u.color, color: '#fff', fontSize: 7, fontWeight: 700, letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                      BUY {qty} — {qty * u.cost} ◆
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ TRAIN TAB ═══ */}
      {tab === 'train' && (
        <div>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 10 }}>
            TRAINING QUEUE (RESOURCES REQUIRED)
          </div>
          {TRAIN_QUEUE.map((t, i) => {
            const unit = UNITS.find(u => u.key === t.unit)
            return (
              <div key={i} style={{
                padding: '10px 14px', marginBottom: 8, borderRadius: 8,
                background: 'rgba(255,255,255,0.5)',
                border: `1px solid ${t.active ? 'rgba(204,136,0,0.3)' : 'rgba(0,60,100,0.1)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#1a2a3a', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                    {unit?.icon} {unit?.name} BATCH ({t.batch})
                  </div>
                  {t.active ? (
                    <>
                      <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>Training... {t.done}/{t.batch} complete</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,60,100,0.06)', marginTop: 4, width: 180, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(t.done / t.batch) * 100}%`, background: '#cc8800', borderRadius: 2 }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>Cost: {t.cost}</div>
                  )}
                </div>
                {t.active ? (
                  <div style={{ fontSize: 9, color: '#cc8800', fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{t.timeLeft}</div>
                ) : (
                  <button onClick={() => toast.success(`Training started: ${t.batch} ${unit?.name}`)} style={{
                    padding: '6px 14px', borderRadius: 16, border: '1px solid rgba(0,153,204,0.3)', background: 'rgba(0,153,204,0.08)',
                    color: '#0099cc', fontSize: 8, fontWeight: 700, cursor: 'pointer', fontFamily: "'Orbitron', system-ui, sans-serif",
                  }}>Train</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ DEPLOY TAB ═══ */}
      {tab === 'deploy' && (
        <div>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 10 }}>
            ASSIGN UNITS TO KINGDOMS
          </div>
          {kingdoms.length > 0 ? kingdoms.map(k => (
            <div key={k.id} style={{
              padding: '12px 14px', marginBottom: 8, borderRadius: 8,
              background: 'rgba(255,255,255,0.5)', border: `1px solid ${k.id === activeKingdom?.id ? `${k.color}40` : 'rgba(0,60,100,0.1)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#1a2a3a', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                  {k.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 2, fontFamily: "'Share Tech Mono', monospace" }}>
                  {k.territories.length} territories • {Math.floor(Math.random() * 500 + 100)} troops
                </div>
              </div>
              <button onClick={() => toast.success(`Managing troops for ${k.name}`)} style={{
                padding: '6px 14px', borderRadius: 16, border: '1px solid rgba(0,153,204,0.3)', background: 'rgba(0,153,204,0.08)',
                color: '#0099cc', fontSize: 8, fontWeight: 700, cursor: 'pointer', fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>Manage</button>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 30, color: 'rgba(26,42,58,0.3)', fontSize: 8, fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 2 }}>
              CREATE A KINGDOM FIRST
            </div>
          )}
          {/* Unassigned reserves */}
          <div style={{
            marginTop: 8, padding: 10, borderRadius: 8,
            background: 'rgba(0,60,100,0.03)', border: '1px solid rgba(0,60,100,0.08)',
            fontSize: 8, color: 'rgba(26,42,58,0.4)',
          }}>
            <div style={{ fontWeight: 700, letterSpacing: 2, marginBottom: 4, fontFamily: "'Orbitron', system-ui, sans-serif" }}>UNASSIGNED RESERVES</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8 }}>
              {UNITS.map(u => `${Math.floor(u.owned * 0.1)} ${u.name}`).join(' • ')}
            </div>
          </div>
        </div>
      )}

      {/* ═══ WAR ROOM TAB ═══ */}
      {tab === 'warroom' && (
        <div>
          {/* Active wars */}
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: '#dc2626', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8 }}>
            🔴 ACTIVE WARS
          </div>
          <div style={{
            padding: 14, marginBottom: 12, borderRadius: 8,
            background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#dc2626', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>⚠ EASTERN SHORES UNDER ATTACK</div>
                <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 3 }}>Attacker: NEXUS_LORD (LVL 97) • 42,100 Power</div>
              </div>
              <span style={{
                background: '#dc2626', color: '#fff', padding: '3px 8px', fontSize: 7, borderRadius: 4, fontWeight: 700,
                fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
                animation: 'pulse 1s infinite',
              }}>ACTIVE</span>
            </div>
            {/* Battle progress bar */}
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(220,38,38,0.15)', marginTop: 8, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: '62%', background: '#0099cc', borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 7, fontFamily: "'Share Tech Mono', monospace" }}>
              <span style={{ color: '#0099cc', fontWeight: 700 }}>YOUR DEFENSE: 62%</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>ENEMY: 38%</span>
            </div>
            <button onClick={() => toast.success('Sending reinforcements!')} style={{
              width: '100%', marginTop: 8, padding: '8px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: '#dc2626', color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 2,
              fontFamily: "'Orbitron', system-ui, sans-serif",
            }}>🚨 SEND REINFORCEMENTS</button>
          </div>

          {/* Nearby threats */}
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8 }}>
            📡 NEARBY THREATS
          </div>
          <div style={{
            padding: '10px 12px', marginBottom: 6, borderRadius: 8,
            background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(204,136,0,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#cc8800' }}>⚠ SUSPICIOUS ACTIVITY</div>
              <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>IRON_DUKE amassing troops near border</div>
            </div>
            <span style={{ fontSize: 7, color: '#cc8800', fontWeight: 700, fontFamily: "'Orbitron', system-ui, sans-serif" }}>RECON</span>
          </div>
          <div style={{
            padding: '10px 12px', marginBottom: 12, borderRadius: 8,
            background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.1)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900 }}>STORM_BLADE</div>
              <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', marginTop: 2 }}>Moved 500 troops SE — likely targeting CRYSTAL_QUEEN</div>
            </div>
            <span style={{ fontSize: 7, color: 'rgba(26,42,58,0.35)', fontWeight: 700, fontFamily: "'Orbitron', system-ui, sans-serif" }}>INTEL</span>
          </div>

          {/* Suggested targets */}
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8 }}>
            ⚔ SUGGESTED TARGETS (NEAR YOUR LEVEL)
          </div>
          {[
            { name: 'IRON_DUKE', lvl: 41, hex: 1980, power: 35200 },
            { name: 'STORM_BLADE', lvl: 38, hex: 1850, power: 31400 },
          ].map(t => (
            <div key={t.name} style={{
              padding: '10px 14px', marginBottom: 6, borderRadius: 8,
              background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>{t.name}</div>
                <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>LVL {t.lvl} • {t.hex.toLocaleString()} HEX • {t.power.toLocaleString()} Power</div>
              </div>
              <button onClick={() => toast.success(`Battle initiated vs ${t.name}!`)} style={{
                padding: '6px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: '#dc2626', color: '#fff', fontSize: 8, fontWeight: 700,
                fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
              }}>Attack</button>
            </div>
          ))}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && (
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
            {[
              { label: 'BATTLES', value: '18', color: '#1a2a3a' },
              { label: 'VICTORIES', value: '12', color: '#00884a' },
              { label: 'DEFEATS', value: '6', color: '#dc2626' },
              { label: 'NET HEX', value: '+47', color: '#00884a' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.08)',
              }}>
                <div style={{ fontSize: 5, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Battle log */}
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)', fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8 }}>
            WAR HISTORY — LAST 30 DAYS
          </div>
          {BATTLE_HISTORY.map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 4,
              background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.08)', borderRadius: 6,
            }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 7, fontWeight: 900, letterSpacing: 1,
                background: b.result === 'WIN' ? 'rgba(0,136,74,0.12)' : 'rgba(220,38,38,0.12)',
                color: b.result === 'WIN' ? '#00884a' : '#dc2626',
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>{b.result}</span>
              <span style={{ flex: 1, fontSize: 9, fontWeight: 700, fontFamily: "'Orbitron', system-ui, sans-serif" }}>vs {b.enemy}</span>
              <span style={{ fontSize: 9, color: b.hex.startsWith('+') ? '#00884a' : '#dc2626', fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{b.hex} HEX</span>
              <span style={{ fontSize: 7, color: 'rgba(26,42,58,0.3)' }}>{b.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-panel CTAs */}
      <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('shop'), 100) }} style={{
          flex: 1, padding: '8px', borderRadius: 16, cursor: 'pointer',
          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
          color: '#cc8800', fontSize: 7, fontWeight: 700, letterSpacing: 1,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>🛒 MILITARY SHOP</button>
        <button onClick={() => { onClose(); setTimeout(() => setActivePanel('kingdom'), 100) }} style={{
          flex: 1, padding: '8px', borderRadius: 16, cursor: 'pointer',
          background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.2)',
          color: '#0099cc', fontSize: 7, fontWeight: 700, letterSpacing: 1,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>👑 KINGDOM</button>
      </div>
    </GlassPanel>
  )
}
