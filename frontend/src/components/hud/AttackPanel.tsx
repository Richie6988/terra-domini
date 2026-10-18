/**
 * AttackPanel — launch an attack on an enemy hex.
 * Real data only: your garrison from /api/combat/my-army/, the target's defense, terrain bonus and timer from
 * /api/combat/preview/. The win chance is computed from the exact server formula
 * (attack power x U(0.9,1.1) vs defense power x U(0.9,1.1), see combat/engine.resolve_battle).
 * Battles resolve server-side after the timer; the result lands in Military > History and the session nudges.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { StaminaBar } from './StaminaBar'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'
import { Clock, Minus, Plus, ArrowRight, Info, Swords } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import type { TerritoryLight } from '../../types'
import { playSound } from '../../hooks/useSound'

const ATTACK_TYPES = [
  { id: 'conquest', label: 'Conquest', iconId: 'swords', color: '#EF4444', desc: 'Full strength. Win and the hex becomes yours.' },
  { id: 'surprise', label: 'Surprise', iconId: 'moon',   color: '#8B5CF6', desc: 'Resolves twice as fast (less time for them to reinforce), but your troops fight at 85%. Captures on win.' },
]

const UNIT_META: Record<string, { name: string; icon: string }> = {
  infantry: { name: 'Infantry', icon: 'swords' }, cavalry: { name: 'Cavalry', icon: 'horse' },
  artillery: { name: 'Artillery', icon: 'bomb' }, aerial: { name: 'Aerial', icon: 'plane' },
  naval: { name: 'Naval', icon: 'ship' }, spy: { name: 'Spy', icon: 'spy' },
}

interface Preview {
  can_attack: boolean; reason: string; owner: string | null
  defense_power: number; defense_points: number; max_defense_points: number
  atk_per_unit: Record<string, number>; timer_seconds: Record<string, number>
  surprise_atk_mult: number; roll_spread: number
}

/** P(A*x > D*y) with x, y ~ U(1-s, 1+s) — same rolls as the server. */
function winChance(A: number, D: number, s: number): number {
  if (A <= 0) return 0
  if (D <= 0) return 1
  const N = 80; let wins = 0
  for (let i = 0; i < N; i++) {
    const x = 1 - s + (2 * s) * (i + 0.5) / N
    for (let j = 0; j < N; j++) {
      const y = 1 - s + (2 * s) * (j + 0.5) / N
      if (A * x > D * y) wins++
    }
  }
  return wins / (N * N)
}

function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

interface Props {
  target: TerritoryLight
  onClose: () => void
}

export function AttackPanel({ target, onClose }: Props) {
  const qc = useQueryClient()
  const setActivePanel = useStore(s => s.setActivePanel)
  const [atkType, setAtkType] = useState('conquest')
  const [units, setUnits] = useState<Record<string, number>>({})
  const [launched, setLaunched] = useState<{ msg: string; ends: string; sent: number; prob: number } | null>(null)
  const initDone = useRef(false)

  const { data: army, isLoading: armyLoading } = useQuery<any>({
    queryKey: ['my-army'],
    queryFn: () => api.get('/combat/my-army/').then(r => r.data),
    staleTime: 10000,
  })
  const { data: pv, isLoading: pvLoading } = useQuery<Preview>({
    queryKey: ['combat-preview', target.h3_index],
    queryFn: () => api.get(`/combat/preview/?target_h3=${target.h3_index}`).then(r => r.data),
    staleTime: 5000,
  })

  const owned: Record<string, number> = useMemo(() => {
    const o: Record<string, number> = {}
    Object.entries(army?.units || {}).forEach(([k, u]: [string, any]) => { if ((u?.owned || 0) > 0) o[k] = u.owned })
    return o
  }, [army])
  const ownedTypes = Object.keys(owned)
  const totalOwned = ownedTypes.reduce((a, k) => a + owned[k], 0)

  // Default: send everything you have (players can trim it down)
  useEffect(() => { if (army && !initDone.current) { initDone.current = true; setUnits({ ...owned }) } }, [army]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeConf = ATTACK_TYPES.find(t => t.id === atkType)!
  const totalUnits = Object.values(units).reduce((a, b) => a + (b || 0), 0)
  const atkPower = pv ? Object.entries(units).reduce((a, [k, n]) => a + (pv.atk_per_unit[k] || 0) * (n || 0), 0)
    * (atkType === 'surprise' ? pv.surprise_atk_mult : 1) : 0
  const prob = pv ? winChance(atkPower, pv.defense_power, pv.roll_spread) : 0
  const probColor = prob >= 0.65 ? '#22c55e' : prob >= 0.35 ? '#F59E0B' : '#EF4444'
  const timer = pv?.timer_seconds?.[atkType] ?? 0
  // Smallest infantry count that wins at least 90% of the time — the actionable hint when odds are bad
  const infAtk = pv?.atk_per_unit?.infantry || 0
  const needInf = pv && infAtk > 0 ? Math.ceil((pv.defense_power * 1.1 / 0.9) / (infAtk * (atkType === 'surprise' ? pv.surprise_atk_mult : 1))) : 0

  const attackMut = useMutation({
    mutationFn: () => api.post('/combat/attack/', {
      target_h3: target.h3_index,
      attack_type: atkType,
      units: Object.fromEntries(Object.entries(units).filter(([, n]) => n > 0)),
    }),
    onSuccess: (res) => {
      playSound('battle')
      setLaunched({ msg: res.data?.message || 'Attack launched!', ends: res.data?.ends_at, sent: totalUnits, prob })
      qc.invalidateQueries({ queryKey: ['battles-active'] })
      qc.invalidateQueries({ queryKey: ['my-army'] })
      qc.invalidateQueries({ queryKey: ['loop-status'] })
    },
    onError: (e: any) => {
      const data = e.response?.data
      if (e.response?.status === 429 && data?.next_slot_label) toast.error(`No attack slots left — next in ${data.next_slot_label}`, { duration: 5000 })
      else toast.error(data?.error || 'Attack failed')
    },
  })

  const blocked = pv && !pv.can_attack
  const step = (k: string, d: number) => setUnits(p => ({ ...p, [k]: Math.min(owned[k] || 0, Math.max(0, (p[k] || 0) + d)) }))

  // Portal to <body>: rendered from GameMap, the panel otherwise sits under the HUD's stacking context on phones
  return createPortal(
    <GlassPanel title="ATTACK" onClose={onClose} accent="#dc2626" width={560}
      icon={<IconSVG id="target" size={24} />} subtitle={target.place_name || 'Enemy zone'}>
      {/* Target info */}
      <div className="hx-card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconSVG id="flag_red" size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.place_name || 'ENEMY ZONE'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="hx-chip">OWNER <span style={{ color: '#e2e8f0' }}>{pv?.owner ?? target.owner_username ?? 'Unknown'}</span></span>
            <span className="hx-chip" style={{ color: '#93c5fd' }}><IconSVG id="ui_shield" size={12} /> DEFENSE {pv ? Math.round(pv.defense_power) : '…'}</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!launched && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {blocked && (
              <div className="hx-card" style={{ marginBottom: 14, borderColor: '#f59e0b', color: '#fde68a', fontSize: 12 }}>
                You can't attack this hex right now: {pv!.reason}.
              </div>
            )}

            {/* Attack type */}
            <div className="hx-section-title">ATTACK TYPE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8, marginBottom: 18 }}>
              {ATTACK_TYPES.map(t => (
                <button key={t.id} onClick={() => setAtkType(t.id)} aria-pressed={atkType === t.id}
                  className="hx-card hx-card--interactive"
                  style={{ ['--accent' as any]: t.color, padding: 12, borderColor: atkType === t.id ? t.color : undefined, background: atkType === t.id ? `linear-gradient(180deg, ${t.color}40, ${t.color}14)` : undefined, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <IconSVG id={t.iconId} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#fff' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.4, fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}>{t.desc}</div>
                    <span className="hx-chip" style={{ marginTop: 8, color: t.color }}><Clock size={11} /> {pv ? `Resolves in ${fmtDur(pv.timer_seconds[t.id] || 0)}` : '…'}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Units — only what you actually own */}
            <div className="hx-section-title">DEPLOY FORCES</div>
            {armyLoading && <div className="hx-skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 8 }} />}
            {!armyLoading && totalOwned === 0 && (
              <div className="hx-empty" style={{ marginBottom: 12 }}>
                <Swords size={32} color="#f87171" />
                <div className="hx-empty__title">NO TROOPS READY</div>
                <div>Recruit units in Military, wait for training, then collect them.</div>
                <button className="btn-game btn-game-red" onClick={() => { onClose(); setActivePanel('combat') }} style={{ marginTop: 6 }}>OPEN MILITARY</button>
              </div>
            )}
            {ownedTypes.map(k => (
              <div key={k} className="hx-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px' }}>
                <IconSVG id={UNIT_META[k]?.icon || 'swords'} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: '#e2e8f0' }}>{UNIT_META[k]?.name || k}</div>
                  <div style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>{owned[k]} available · {pv ? `${pv.atk_per_unit[k] ?? 0} atk each` : ''}</div>
                </div>
                <button onClick={() => step(k, -1)} aria-label={`Remove 1 ${k}`} className="hx-icon-btn"><Minus size={16} /></button>
                <span style={{ minWidth: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#e2e8f0', fontSize: 18 }}>{units[k] || 0}</span>
                <button onClick={() => step(k, +1)} aria-label={`Add 1 ${k}`} className="hx-icon-btn" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)' }}><Plus size={16} /></button>
              </div>
            ))}

            {/* Win chance — exact server formula */}
            {totalOwned > 0 && (
              <div className="hx-card" style={{ marginTop: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'var(--hx-text-2)' }}>WIN CHANCE</div>
                    <div style={{ fontSize: 11, color: 'var(--hx-text-3)', marginTop: 4 }}>Your attack {Math.round(atkPower)} vs defense {pv ? Math.round(pv.defense_power) : '…'}</div>
                  </div>
                  <span style={{ fontSize: 28, color: probColor, fontFamily: 'var(--font-mono)' }}>{pvLoading ? '…' : `${Math.round(prob * 100)}%`}</span>
                </div>
                <div className="hx-progress" style={{ ['--accent' as any]: probColor }}>
                  <div className="hx-progress__fill" style={{ width: `${prob * 100}%` }} />
                </div>
                {prob < 0.9 && needInf > 0 && (
                  <div style={{ fontSize: 11, color: '#fde68a', marginTop: 8 }}>About {needInf} infantry would make this a sure win.</div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 10, fontSize: 11, lineHeight: 1.4, color: 'var(--hx-text-3)', fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  Each side rolls ±10%. The defender can reinforce before the timer ends. Survivors come back to your army; losers lose 30–60% of the units sent.
                </div>
              </div>
            )}

            <button onClick={() => attackMut.mutate()} disabled={attackMut.isPending || totalUnits === 0 || !!blocked}
              className="btn-game btn-game-red"
              style={{ width: '100%', padding: '15px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <IconSVG id={typeConf.iconId} size={20} />
              {attackMut.isPending ? 'Launching…' : `LAUNCH ${typeConf.label.toUpperCase()} · ${totalUnits} UNITS`}
            </button>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
              <StaminaBar />
            </div>
          </motion.div>
        )}

        {launched && (
          <motion.div key="result" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', paddingTop: 20 }}>
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }} style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <IconSVG id="swords" size={84} />
            </motion.div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, letterSpacing: 0.5, color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.5)', marginBottom: 8 }}>ATTACK LAUNCHED</div>
            <div style={{ fontSize: 13, color: 'var(--hx-text-2)', marginBottom: 6, lineHeight: 1.5 }}>
              {launched.sent} units marching on {target.place_name || 'the enemy hex'}.
            </div>
            <div className="hx-chip" style={{ color: '#fbbf24', fontSize: 12, marginBottom: 16 }}>
              <Clock size={12} /> Result {launched.ends ? `at ${new Date(launched.ends).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `in ${fmtDur(timer)}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--hx-text-3)', marginBottom: 20, lineHeight: 1.5 }}>
              Your win chance was {Math.round(launched.prob * 100)}%. You'll get a notice when it resolves; the outcome is kept in Military &gt; History.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onClose(); setActivePanel('combat') }}
                className="btn-game btn-game-glass" style={{ flex: 1 }}>MILITARY</button>
              <button onClick={onClose}
                className="btn-game btn-game-green" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                BACK TO MAP <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>,
    document.body,
  )
}
