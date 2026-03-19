/**
 * ClaimModal — territory claiming with 3 paths:
 * 1. FREE — first claim is always free (onboarding reward)
 * 2. WIN — solve a quick math puzzle (Cloudflare-style human verification)  
 * 3. BUY — spend TDC coins
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import toast from 'react-hot-toast'

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

// Simple human verification puzzle (no external API needed)
function generatePuzzle() {
  const ops = [
    { q: `${Math.floor(Math.random()*20+5)} + ${Math.floor(Math.random()*20+5)}`, get a() { const [x,y] = this.q.split(' + ').map(Number); return x+y } },
    { q: `${Math.floor(Math.random()*10+10)} × ${Math.floor(Math.random()*5+2)}`, get a() { const [x,y] = this.q.split(' × ').map(Number); return x*y } },
    { q: `${Math.floor(Math.random()*50+20)} − ${Math.floor(Math.random()*15+5)}`, get a() { const [x,y] = this.q.split(' − ').map(Number); return x-y } },
  ]
  return ops[Math.floor(Math.random()*ops.length)]
}

interface ClaimModalProps {
  territory: { h3_index: string; place_name?: string; center_lat: number; center_lon: number }
  onClose: () => void
  onClaimed: () => void
  isFree: boolean  // true for first-ever claim
}

export function ClaimModal({ territory, onClose, onClaimed, isFree }: ClaimModalProps) {
  const [method, setMethod] = useState<'free' | 'puzzle' | 'buy'>(isFree ? 'free' : 'puzzle')
  const [puzzle] = useState(generatePuzzle)
  const [answer, setAnswer] = useState('')
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [puzzleError, setPuzzleError] = useState(false)
  const player = usePlayer()
  const qc = useQueryClient()

  const CLAIM_COST = 50 // TDC

  const claimMut = useMutation({
    mutationFn: (data: { method: string; answer?: string }) =>
      api.post('/territories/claim/', { h3_index: territory.h3_index, ...data }),
    onSuccess: (res) => {
      toast.success(`🎉 ${territory.place_name || 'Zone'} claimed!`)
      qc.invalidateQueries({ queryKey: ['player'] })
      onClaimed()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Claim failed')
    },
  })

  const checkPuzzle = () => {
    if (parseInt(answer) === puzzle.a) {
      setPuzzleSolved(true)
      setPuzzleError(false)
    } else {
      setPuzzleError(true)
      setAnswer('')
    }
  }

  const balance = toNum(player?.tdc_in_game)
  const canAfford = balance >= CLAIM_COST

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: '100%', maxWidth: 480, background: '#0A0A14', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: 20, paddingBottom: 36 }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />

        {/* Territory info */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⬡</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{territory.place_name || territory.h3_index.slice(0, 10)}</div>
          <div style={{ fontSize: 11, color: '#4B5563', fontFamily: 'monospace', marginTop: 2 }}>
            {territory.center_lat.toFixed(4)}, {territory.center_lon.toFixed(4)}
          </div>
        </div>

        {/* Method tabs */}
        {!isFree && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
            <MethodTab id="puzzle" label="🎮 Win it" active={method === 'puzzle'} onClick={() => setMethod('puzzle')} />
            <MethodTab id="buy" label={`🪙 Buy (${CLAIM_COST} TDC)`} active={method === 'buy'} onClick={() => setMethod('buy')} disabled={!canAfford} />
          </div>
        )}

        {/* FREE METHOD */}
        {method === 'free' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
            <div style={{ fontSize: 14, color: '#00FF87', fontWeight: 600, marginBottom: 6 }}>Your first zone is FREE!</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Welcome to Terra Domini. Claim this zone to start your empire.</div>
            <ClaimBtn onClick={() => claimMut.mutate({ method: 'free' })} loading={claimMut.isPending} label="Claim for Free" color="#00FF87" />
          </div>
        )}

        {/* PUZZLE METHOD */}
        {method === 'puzzle' && !puzzleSolved && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8 }}>Solve to prove you're human and claim this zone</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px', display: 'inline-block', fontFamily: 'monospace', letterSpacing: 2 }}>
                {puzzle.q} = ?
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={answer}
                onChange={e => { setAnswer(e.target.value.replace(/\D/g, '')); setPuzzleError(false) }}
                onKeyDown={e => e.key === 'Enter' && checkPuzzle()}
                placeholder="Your answer..."
                autoFocus
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${puzzleError ? '#EF4444' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 18, fontFamily: 'monospace',
                  outline: 'none', textAlign: 'center',
                }}
              />
              <button onClick={checkPuzzle} style={{ padding: '12px 18px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 10, color: '#60A5FA', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Check →
              </button>
            </div>
            {puzzleError && <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: 8 }}>Wrong answer, try again!</div>}
          </div>
        )}

        {method === 'puzzle' && puzzleSolved && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, color: '#00FF87', marginBottom: 16, fontWeight: 600 }}>Correct! Zone unlocked.</div>
            <ClaimBtn onClick={() => claimMut.mutate({ method: 'puzzle', answer: String(puzzle.a) })} loading={claimMut.isPending} label="Claim Zone" color="#00FF87" />
          </div>
        )}

        {/* BUY METHOD */}
        {method === 'buy' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🪙</div>
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>Buy this zone for <span style={{ color: '#FFB800', fontWeight: 700 }}>{CLAIM_COST} TDC</span></div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Your balance: {balance.toFixed(0)} TDC</div>
            {!canAfford && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>Not enough TDC — open the Shop to buy more</div>}
            <ClaimBtn onClick={() => claimMut.mutate({ method: 'buy' })} loading={claimMut.isPending} disabled={!canAfford} label={`Buy for ${CLAIM_COST} TDC`} color="#FFB800" />
          </div>
        )}

        {/* Cancel */}
        <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: '10px', background: 'transparent', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </motion.div>
    </motion.div>
  )
}

function MethodTab({ id, label, active, onClick, disabled }: { id: string; label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
      color: disabled ? '#374151' : active ? '#fff' : '#6B7280',
      fontSize: 12, fontWeight: active ? 600 : 400,
      opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  )
}

function ClaimBtn({ onClick, loading, disabled, label, color }: { onClick: () => void; loading: boolean; disabled?: boolean; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: '100%', padding: '14px', background: color, border: 'none', borderRadius: 12,
        color: '#000', fontSize: 15, fontWeight: 700, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.7 : 1, transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Claiming…' : label}
    </button>
  )
}
