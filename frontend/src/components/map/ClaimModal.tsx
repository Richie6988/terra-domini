/**
 * ClaimModal — 3 méthodes pour revendiquer une zone.
 * FREE   : première zone — onboarding gift avec animation
 * PUZZLE : défi math adaptatif — prouve que t'es humain
 * BUY    : 50 TDC — skip immédiat
 *
 * Affiche les ressources, revenus et tier de défense de la zone.
 */
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'
import type { TerritoryLight } from '../../types'

const CLAIM_COST = 50

type Puzzle = { q: string; a: number }

function makePuzzle(): Puzzle {
  const ops = ['+', '-', '×'] as const
  const op  = ops[Math.floor(Math.random() * ops.length)]
  const a   = Math.floor(Math.random() * 20) + 1
  const b   = Math.floor(Math.random() * 20) + 1
  switch (op) {
    case '+': return { q: `${a} + ${b}`, a: a + b }
    case '-': return { q: `${Math.max(a,b)} − ${Math.min(a,b)}`, a: Math.max(a,b) - Math.min(a,b) }
    case '×': return { q: `${a % 10 + 1} × ${b % 10 + 1}`, a: (a % 10 + 1) * (b % 10 + 1) }
  }
}

function ResourceRow({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{emoji} {label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>+{value}/tick</span>
    </div>
  )
}

function MethodTab({ id, label, active, disabled, onClick }:
  { id: string; label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '10px 4px', border: 'none',
      background: active ? 'rgba(0,255,135,0.1)' : 'transparent',
      borderBottom: `2px solid ${active ? '#00FF87' : 'transparent'}`,
      color: active ? '#00FF87' : disabled ? '#374151' : '#9CA3AF',
      cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
    }}>{label}</button>
  )
}

interface Props {
  territory: TerritoryLight
  isFree: boolean
  onClose: () => void
  onClaimed: () => void
}

export function ClaimModal({ territory, isFree, onClose, onClaimed }: Props) {
  const player = usePlayer()
  const qc     = useQueryClient()

  const [method, setMethod]         = useState<'free' | 'puzzle' | 'buy'>(isFree ? 'free' : 'puzzle')
  const [puzzle, setPuzzle]         = useState<Puzzle>(makePuzzle)
  const [answer, setAnswer]         = useState('')
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [claimed, setClaimed]       = useState(false)
  const inputRef                    = useRef<HTMLInputElement>(null)

  const tdc = parseFloat(String(player?.tdc_in_game ?? 0))
  const canAfford = tdc >= CLAIM_COST

  const claimMut = useMutation({
    mutationFn: (data: { method: string; answer?: string }) =>
      api.post('/territories/claim/', { h3_index: territory.h3_index, ...data }),
    onSuccess: (res) => {
      const data = res.data
      setClaimed(true)
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['territory-income'] })
      qc.invalidateQueries({ queryKey: ['clusters'] })
      toast.success(`🎉 ${territory.place_name || 'Zone'} claimed!`)
      setTimeout(() => { onClaimed(); onClose() }, 2000)
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || 'Claim failed'
      toast.error(msg)
    },
  })

  // Check puzzle answer in real-time
  useEffect(() => {
    if (method === 'puzzle') {
      const num = parseInt(answer)
      if (!isNaN(num) && num === puzzle.a) {
        setPuzzleSolved(true)
      } else {
        setPuzzleSolved(false)
      }
    }
  }, [answer, puzzle.a, method])

  // Focus input when puzzle tab opens
  useEffect(() => {
    if (method === 'puzzle') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [method])

  const t = territory

  // Compute zone richness rating
  const totalResources = (t.food_per_tick ?? 0) + (t.resource_energy ?? 0) +
    (t.resource_credits ?? 0) + (t.resource_materials ?? 0) + (t.resource_intel ?? 0)
  const richness = totalResources > 80 ? 'Rich' : totalResources > 40 ? 'Average' : 'Poor'
  const richnessColor = richness === 'Rich' ? '#00FF87' : richness === 'Average' ? '#FFB800' : '#6B7280'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        style={{ width: '100%', maxWidth: 420, background: '#0A0A14', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>

        {/* Zone info header */}
        <div style={{ padding: '18px 20px 12px', background: 'linear-gradient(180deg, rgba(0,255,135,0.06) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>
                {t.is_control_tower ? '🗼 ' : '⬡ '}{t.place_name || 'Unclaimed Zone'}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 3, fontFamily: 'monospace' }}>
                {t.h3_index?.slice(0, 14)}…
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: richnessColor, fontWeight: 700, background: `${richnessColor}15`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${richnessColor}40` }}>
                {richness === 'Rich' ? '💎' : richness === 'Average' ? '🟡' : '⬜'} {richness}
              </div>
              {t.defense_tier > 0 && (
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>🛡️ Def tier {t.defense_tier}</div>
              )}
            </div>
          </div>

          {/* Resources */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ResourceRow emoji="🌾" label="Food"      value={t.resource_food ?? 0}       color="#10B981" />
            <ResourceRow emoji="⚡" label="Energy"    value={t.resource_energy ?? 0}    color="#F59E0B" />
            <ResourceRow emoji="💰" label="Credits"   value={t.resource_credits ?? 0}   color="#FFB800" />
            <ResourceRow emoji="⚙️"  label="Materials" value={t.resource_materials ?? 0} color="#6B7280" />
            <ResourceRow emoji="🕵️" label="Intel"     value={t.resource_intel ?? 0}     color="#8B5CF6" />
            {totalResources === 0 && (
              <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center' }}>Surveying resources…</div>
            )}
          </div>

          {t.is_control_tower && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 8, fontSize: 12, color: '#FFB800', fontWeight: 600 }}>
              🗼 Control Tower — Grants +25% income to your cluster. High-value target!
            </div>
          )}
        </div>

        {/* Method tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {isFree && <MethodTab id="free" label="🎁 Free"      active={method === 'free'}   onClick={() => setMethod('free')} />}
          <MethodTab id="puzzle" label="🧩 Puzzle"   active={method === 'puzzle'} onClick={() => setMethod('puzzle')} />
          <MethodTab id="buy"    label={`🪙 Buy (${CLAIM_COST})`} active={method === 'buy'} disabled={!canAfford} onClick={() => canAfford && setMethod('buy')} />
        </div>

        {/* Content by method */}
        <div style={{ padding: '20px 20px 28px' }}>
          <AnimatePresence mode="wait">

            {/* FREE */}
            {method === 'free' && !claimed && (
              <motion.div key="free" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#00FF87' }}>Your first zone is FREE!</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
                    Welcome to Terra Domini. Claim this zone to start your empire and earn your first resources.
                  </div>
                  <div style={{ marginTop: 12, padding: '8px 16px', background: 'rgba(0,255,135,0.06)', borderRadius: 8, fontSize: 12, color: '#00FF87' }}>
                    🎁 +100 TDC bonus on first claim!
                  </div>
                </div>
                <button onClick={() => claimMut.mutate({ method: 'free' })} disabled={claimMut.isPending}
                  style={{ width: '100%', padding: '14px', background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.4)', borderRadius: 12, color: '#00FF87', fontSize: 15, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em' }}>
                  {claimMut.isPending ? '…' : '🚀 Claim Territory'}
                </button>
              </motion.div>
            )}

            {/* PUZZLE */}
            {method === 'puzzle' && !claimed && (
              <motion.div key="puzzle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>Solve to prove your worth, commander</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 24px', border: '1px solid rgba(255,255,255,0.08)', letterSpacing: '0.1em' }}>
                    {puzzle.q} = ?
                  </div>
                </div>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <input ref={inputRef} type="number" value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && puzzleSolved && claimMut.mutate({ method: 'puzzle', answer })}
                    placeholder="Your answer…"
                    style={{ width: '100%', background: `rgba(${puzzleSolved ? '0,255,135' : '255,255,255'},0.06)`, border: `1px solid ${puzzleSolved ? '#00FF87' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 20, fontFamily: 'monospace', outline: 'none', textAlign: 'center', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
                  {puzzleSolved && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 22 }}>✅</motion.div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setPuzzle(makePuzzle()); setAnswer(''); setPuzzleSolved(false) }}
                    style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>
                    🔄 New
                  </button>
                  <button onClick={() => claimMut.mutate({ method: 'puzzle', answer })}
                    disabled={!puzzleSolved || claimMut.isPending}
                    style={{ flex: 1, padding: '12px', background: puzzleSolved ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${puzzleSolved ? 'rgba(0,255,135,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, color: puzzleSolved ? '#00FF87' : '#4B5563', cursor: puzzleSolved ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, transition: 'all 0.2s' }}>
                    {claimMut.isPending ? '…' : puzzleSolved ? '⚔️ Claim Zone' : 'Solve the puzzle'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* BUY */}
            {method === 'buy' && !claimed && (
              <motion.div key="buy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🪙</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#FFB800' }}>Instant Claim</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>No puzzle required. Spend TDC to claim immediately.</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4B5563' }}>Cost</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444', fontFamily: 'monospace' }}>−{CLAIM_COST} 🪙</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4B5563' }}>Your balance</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: tdc >= CLAIM_COST ? '#FFB800' : '#EF4444', fontFamily: 'monospace' }}>{tdc.toFixed(0)} 🪙</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4B5563' }}>After</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#9CA3AF', fontFamily: 'monospace' }}>{(tdc - CLAIM_COST).toFixed(0)} 🪙</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => claimMut.mutate({ method: 'buy' })}
                  disabled={!canAfford || claimMut.isPending}
                  style={{ width: '100%', padding: '14px', background: canAfford ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${canAfford ? 'rgba(255,184,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, color: canAfford ? '#FFB800' : '#4B5563', fontSize: 15, fontWeight: 800, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                  {claimMut.isPending ? '…' : canAfford ? `🪙 Buy for ${CLAIM_COST} TDC` : `Need ${CLAIM_COST} TDC (${(CLAIM_COST - tdc).toFixed(0)} short)`}
                </button>
              </motion.div>
            )}

            {/* SUCCESS */}
            {claimed && (
              <motion.div key="claimed" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ textAlign: 'center', padding: '10px 0' }}>
                <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 0.6 }}
                  style={{ fontSize: 56, marginBottom: 10 }}>🎉</motion.div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#00FF87' }}>Territory Claimed!</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>{territory.place_name || 'Zone'} is now yours</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
