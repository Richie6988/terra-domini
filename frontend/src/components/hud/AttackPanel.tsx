/**
 * AttackPanel — launch an attack on an enemy hex, in points (combat/forces.py, owner 2026-10-19: "attack and defense
 * are spent 1 for 1 against another player"). GET /api/combat/preview/ gives the attack points of your kingdom
 * nearest to the target and the target kingdom's defense; commit more than that defense and the hex is yours when the
 * timer ends — unless the defender buys more defense before.
 */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { StaminaBar } from './StaminaBar'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { GlassPanel } from '../shared/GlassPanel'
import toast from 'react-hot-toast'
import { Clock, Minus, Plus, ArrowRight, Swords, Shield } from 'lucide-react'
import { IconSVG } from '../shared/iconBank'
import type { TerritoryLight } from '../../types'
import { openBattle } from '../combat/BattleFaceOff'
import { playSound } from '../../hooks/useSound'

const ATTACK_TYPES = [
  { id: 'conquest', label: 'Conquest', iconId: 'swords', color: '#EF4444', desc: 'Normal timer. Win and the hex becomes yours.' },
  { id: 'surprise', label: 'Surprise', iconId: 'moon', color: '#8B5CF6', desc: 'Resolves twice as fast: less time for them to buy defense.' },
]

interface Preview {
  can_attack: boolean; reason: string; owner: string | null
  my_attack: number; source_size: number; target_defense: number; target_size: number
  attack_mult?: number; defense_mult?: number; points_needed?: number
  point_cost: Record<string, number>; timer_seconds: Record<string, number>
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
  const [points, setPoints] = useState(0)
  const [launched, setLaunched] = useState<{ ends: string; sent: number; id?: string } | null>(null)

  const { data: pv, isLoading } = useQuery<Preview>({
    queryKey: ['combat-preview', target.h3_index],
    queryFn: () => api.get(`/combat/preview/?target_h3=${target.h3_index}`).then(r => r.data),
    staleTime: 5000,
  })
  const have = pv?.my_attack || 0
  // armaments × Attack level must beat fortifications × Defense level (server: points_needed)
  const need = pv?.points_needed ?? (pv?.target_defense || 0) + 1
  // Default: just enough to win (or everything you have)
  useEffect(() => { if (pv) setPoints(Math.min(have, need)) }, [pv?.my_attack, pv?.target_defense]) // eslint-disable-line react-hooks/exhaustive-deps
  const wins = points >= need
  const timer = pv?.timer_seconds?.[atkType] ?? 0

  const attackMut = useMutation({
    mutationFn: () => api.post('/combat/attack/', { target_h3: target.h3_index, attack_type: atkType, points }),
    onSuccess: (res) => {
      playSound('battle')
      setLaunched({ ends: res.data?.ends_at, sent: points, id: res.data?.battle_id })
      ;['battles-active', 'my-army', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e: any) => {
      const data = e.response?.data
      if (e.response?.status === 429 && data?.next_slot_label) toast.error(`No attack slots left — next in ${data.next_slot_label}`, { duration: 5000 })
      else toast.error(data?.error || 'Attack failed')
    },
  })

  const blocked = pv && !pv.can_attack
  const step = (d: number) => setPoints(p => Math.max(0, Math.min(have, p + d)))
  const MONO = "'Share Tech Mono', monospace"

  return createPortal(
    <GlassPanel title="ATTACK" onClose={onClose} accent="#dc2626" width={520}
      icon={<IconSVG id="target" size={24} />} subtitle={target.place_name || 'Enemy zone'}>
      <AnimatePresence mode="wait">
        {!launched && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {blocked && (
              <div className="hx-card" style={{ marginBottom: 14, borderColor: '#f59e0b', color: '#fde68a', fontSize: 12 }}>
                You can't attack this hex right now: {pv!.reason}.
              </div>
            )}

            {/* Face to face: your attack vs their defense */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <div className="hx-card" style={{ textAlign: 'center', borderColor: 'rgba(248,113,113,0.5)' }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, fontWeight: 900, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Swords size={12} /> YOUR ATTACK</div>
                <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 900 }}>{isLoading ? '…' : have.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>nearest kingdom{pv?.source_size ? ` · ${pv.source_size} hexes` : ''}{(pv?.attack_mult || 1) > 1 ? ` · Influence x${pv!.attack_mult!.toFixed(1)}` : ''}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: '#fca5a5' }}>VS</span>
              <div className="hx-card" style={{ textAlign: 'center', borderColor: 'rgba(96,165,250,0.5)' }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, fontWeight: 900, color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Shield size={12} /> THEIR DEFENSE</div>
                <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 900 }}>{isLoading ? '…' : (pv?.target_defense || 0).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--hx-text-3)' }}>{pv?.owner || target.owner_username || 'enemy'}{pv?.target_size ? ` · ${pv.target_size} hexes` : ''}{(pv?.defense_mult || 1) > 1 ? ` · Defense x${pv!.defense_mult!.toFixed(1)}` : ''}</div>
              </div>
            </div>

            {/* How many points to send */}
            <div className="hx-section-title">ATTACK POINTS TO SEND</div>
            <div className="hx-card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => step(-10)} aria-label="Fewer points" className="hx-icon-btn"><Minus size={16} /></button>
                <input type="range" min={0} max={Math.max(1, have)} value={points} onChange={e => setPoints(Number(e.target.value))} style={{ flex: 1 }} aria-label="Attack points" />
                <button onClick={() => step(10)} aria-label="More points" className="hx-icon-btn"><Plus size={16} /></button>
                <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 900, minWidth: 64, textAlign: 'right' }}>{points}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="hx-chip" style={{ cursor: 'pointer' }} onClick={() => setPoints(Math.min(have, need))}>JUST ENOUGH · {need}</button>
                <button className="hx-chip" style={{ cursor: 'pointer' }} onClick={() => setPoints(Math.min(have, need * 2))}>SAFE · {need * 2}</button>
                <button className="hx-chip" style={{ cursor: 'pointer' }} onClick={() => setPoints(have)}>ALL · {have}</button>
              </div>
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                color: wins ? '#bbf7d0' : '#fecaca', background: wins ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${wins ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
                {have < need
                  ? `Not enough: ${need} attack points needed against their defense. Buy attack points on your nearest kingdom (Military).`
                  : wins ? `Wins unless they add defense before the timer ends. ${points - need} points to spare.`
                         : `Too few: ${need} needed — ${points} attack points would be absorbed by their defense and lost.`}
              </div>
            </div>

            {/* Attack type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {ATTACK_TYPES.map(t => (
                <button key={t.id} onClick={() => setAtkType(t.id)} aria-pressed={atkType === t.id} className="hx-card hx-card--interactive"
                  style={{ ['--accent' as any]: t.color, padding: 10, borderColor: atkType === t.id ? t.color : undefined, background: atkType === t.id ? `linear-gradient(180deg, ${t.color}40, ${t.color}14)` : undefined, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#fff' }}><IconSVG id={t.iconId} size={20} />{t.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.35, textTransform: 'none', letterSpacing: 0 }}>{t.desc}</div>
                  <span className="hx-chip" style={{ marginTop: 6, color: t.color }}><Clock size={11} /> {pv ? fmtDur(pv.timer_seconds[t.id] || 0) : '…'}</span>
                </button>
              ))}
            </div>

            <button onClick={() => attackMut.mutate()} disabled={attackMut.isPending || points < 1 || !!blocked}
              className="btn-game btn-game-red" style={{ width: '100%', padding: 15, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Swords size={18} /> {attackMut.isPending ? 'LAUNCHING…' : `ATTACK WITH ${points} POINTS`}
            </button>
            <div style={{ marginTop: 10 }}><StaminaBar /></div>
          </motion.div>
        )}

        {launched && (
          <motion.div key="result" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IconSVG id="swords" size={72} /></div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: '#fff', marginBottom: 8 }}>ATTACK LAUNCHED</div>
            <div style={{ fontSize: 13, color: 'var(--hx-text-2)', marginBottom: 10 }}>{launched.sent} attack points on {target.place_name || 'the enemy hex'}.</div>
            <div className="hx-chip" style={{ color: '#fbbf24', fontSize: 12, marginBottom: 16 }}>
              <Clock size={12} /> Result {launched.ends ? `at ${new Date(launched.ends).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `in ${fmtDur(timer)}`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { const id = launched.id; onClose(); if (id) openBattle(id); else setActivePanel('combat') }} className="btn-game btn-game-red" style={{ flex: 1 }}>WAR ROOM</button>
              <button onClick={onClose} className="btn-game btn-game-green" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>BACK TO MAP <ArrowRight size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>,
    document.body,
  )
}
