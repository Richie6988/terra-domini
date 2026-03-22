/**
 * ClaimModal — 4 ways to claim a territory
 * FREE    : first zone — gift
 * BUY     : from system (HEX Coin) OR from owner (offer)
 * PUZZLE  : solve a math challenge — free but takes brain
 * ATTACK  : military takeover — progress bar based on rank
 */
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'
import type { TerritoryLight } from '../../types'

const CLAIM_COST = 50

// CDC §2.3 — coûts d'attaque par rareté cible
const ATTACK_COST: Record<string, { time_h: number; recaptcha: number; min_hex: number }> = {
  common:    { time_h: 1,   recaptcha: 10,  min_hex: 0   },
  uncommon:  { time_h: 4,   recaptcha: 20,  min_hex: 0   },
  rare:      { time_h: 24,  recaptcha: 50,  min_hex: 5   },
  epic:      { time_h: 72,  recaptcha: 75,  min_hex: 10  },
  legendary: { time_h: 240, recaptcha: 100, min_hex: 20  },
  mythic:    { time_h: 720, recaptcha: 500, min_hex: 100 },
}

type Method = 'free' | 'buy' | 'puzzle' | 'attack'
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

interface Props {
  territory: TerritoryLight
  isFree: boolean
  onClose: () => void
  onClaimed: () => void
}

export function ClaimModal({ territory, isFree, onClose, onClaimed }: Props) {
  const player = usePlayer()
  const qc     = useQueryClient()
  const t      = territory as any

  const isEnemy  = !!t.owner_id
  const tdc      = parseFloat(String(player?.tdc_in_game ?? 0))
  const canAfford = tdc >= CLAIM_COST
  const rank     = player?.commander_rank ?? 1

  const defaultMethod: Method = isFree ? 'free' : isEnemy ? 'buy' : 'puzzle'
  const [method, setMethod]       = useState<Method>(defaultMethod)
  const [puzzle, setPuzzle]       = useState<Puzzle>(makePuzzle)
  const [answer, setAnswer]       = useState('')
  const [puzzleSolved, setSolved] = useState(false)
  const [claimed, setClaimed]     = useState(false)
  const [offer, setOffer]         = useState(200)
  const [attacking, setAttacking] = useState(false)
  const [attackProgress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const claimMut = useMutation({
    mutationFn: (data: Record<string, any>) =>
      api.post('/territories/claim/', { h3_index: t.h3_index, ...data }),
    onSuccess: () => {
      setClaimed(true)
      qc.invalidateQueries({ queryKey: ['player'] })
      toast.success(`🎉 ${t.poi_name || t.place_name || 'Zone'} claimed!`)
      setTimeout(() => { onClaimed(); onClose() }, 2000)
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Claim failed'),
  })

  const offerMut = useMutation({
    mutationFn: () => api.post('/territories/buy-offer/', { h3_index: t.h3_index, offer_tdc: offer }),
    onSuccess: () => { toast.success('Offer sent! 💸'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })

  useEffect(() => {
    if (method === 'puzzle') {
      setSolved(parseInt(answer) === puzzle.a && answer !== '')
    }
  }, [answer, puzzle.a, method])

  useEffect(() => {
    if (method === 'puzzle') setTimeout(() => inputRef.current?.focus(), 100)
  }, [method])

  type AttackType = 'assault' | 'infiltration' | 'blockade'
  const [attackType, setAttackType] = useState<AttackType>('assault')
  const [attackResult, setAttackResult] = useState<any | null>(null)

  const ATTACK_TYPES: { id: AttackType; icon: string; label: string; desc: string; color: string; counter: string }[] = [
    { id:'assault',      icon:'⚔️', label:'Assaut',       color:'#EF4444',
      desc:'ATK brute vs DEF physique. Conquiert le territoire.',
      counter:'Countered par: Fortification + Résistance prolongée' },
    { id:'infiltration', icon:'🔓', label:'Infiltration',  color:'#8B5CF6',
      desc:'Données vs Stabilité. Neutralise les défenses 6h sans conquérir.',
      counter:'Countered par: Tour de contrôle + Cyberguerre' },
    { id:'blockade',     icon:'🚢', label:'Blocus',        color:'#F59E0B',
      desc:'Influence vs Influence. Réduit production adverse -50% pendant 24h.',
      counter:'Countered par: Routes commerciales + Résistance prolongée' },
  ]

  const attackMut = useMutation({
    mutationFn: () => api.post('/territories/attack/', {
      h3_index: t.h3_index,
      attack_type: attackType,
    }),
    onSuccess: (res) => {
      setAttackResult(res.data)
      const r = res.data
      if (r.territory_captured) {
        setClaimed(true)
        qc.invalidateQueries({ queryKey: ['player'] })
        qc.invalidateQueries({ queryKey: ['my-territories-overlay'] })
        toast.success(`⚔️ ${name} conquis !`)
        // Déclencher animation attaque victoire
        window.dispatchEvent(new CustomEvent('hexod:attack', {
          detail: { sourceH3: '', targetH3: t.h3_index, duration: 0, result: 'victory' }
        }))
        setTimeout(() => { onClaimed(); onClose() }, 3000)
      } else if (r.victory) {
        toast.success(`✅ ${r.report?.title || 'Succès'}`)
        qc.invalidateQueries({ queryKey: ['player'] })
        setTimeout(() => onClose(), 3500)
      } else {
        toast.error(r.report?.title || 'Échec')
        window.dispatchEvent(new CustomEvent('hexod:attack', {
          detail: { sourceH3: '', targetH3: t.h3_index, duration: 0, result: 'defeat' }
        }))
        setAttacking(false)
        setProgress(0)
      }
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error || 'Attaque échouée'
      toast.error(msg)
      setAttacking(false)
      setProgress(0)
    },
  })

  const startAttack = () => {
    setAttacking(true)
    setProgress(0)
    setAttackResult(null)
    const duration = Math.max(2000, 8000 - rank * 60)
    const interval = 50
    const step = (interval / duration) * 100
    // Déclencher animation pendant l'attaque
    window.dispatchEvent(new CustomEvent('hexod:attack', {
      detail: { sourceH3: '', targetH3: t.h3_index, duration, result: 'pending' }
    }))
    const timer = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearInterval(timer)
          attackMut.mutate()
          return 100
        }
        return p + step
      })
    }, interval)
  }

  const tabs: { id: Method; label: string; disabled?: boolean }[] = [
    ...(isFree ? [{ id: 'free' as Method, label: '🎁 Free' }] : []),
    { id: 'buy', label: isEnemy ? '💸 Buy/Offer' : '🪙 Buy' },
    { id: 'puzzle', label: '🧩 Puzzle' },
    { id: 'attack', label: '⚔️ Attack' },
  ]

  const name = t.poi_name || t.place_name || 'Zone'
  const rarity = t.rarity || 'common'
  const RARITY_COLOR: Record<string, string> = {
    common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
    epic:'#8B5CF6', legendary:'#FFB800', mythic:'#FF006E',
  }
  const rc = RARITY_COLOR[rarity] || '#9CA3AF'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1400, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:350, damping:32 }}
        style={{ width:'100%', maxWidth:440, background:'#090910', borderRadius:'20px 20px 0 0', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>
                {t.poi_emoji || (isEnemy ? '🔴' : '⬡')} {name}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${rc}22`, color:rc, fontWeight:600 }}>{rarity}</span>
                {t.is_shiny && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'#FFB80022', color:'#FFB800', fontWeight:600 }}>✨ shiny</span>}
                {isEnemy && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#F87171', fontWeight:600 }}>👤 {t.owner_username}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#9CA3AF', cursor:'pointer', width:30, height:30, fontSize:14 }}>✕</button>
          </div>

          {/* Resources mini row */}
          <div style={{ display:'flex', gap:12, marginTop:10, fontSize:11, color:'#6B7280' }}>
            {(t.resource_credits||10) > 0 && <span>💰 +{t.resource_credits||10}/jour</span>}
            {(t.resource_energy||0) > 0  && <span>⚡ +{t.resource_energy}/jour</span>}
            {(t.resource_food||0) > 0    && <span>🌾 +{t.resource_food}/jour</span>}
            {t.poi_floor_price           && <span style={{ color:rc }}>NFT floor {t.poi_floor_price} HEX</span>}
          </div>
        </div>

        {/* Method tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => !tb.disabled && setMethod(tb.id)}
              disabled={tb.disabled}
              style={{ flex:1, padding:'10px 4px', border:'none', cursor: tb.disabled ? 'not-allowed' : 'pointer',
                background: method===tb.id ? 'rgba(0,255,135,0.08)' : 'transparent',
                borderBottom:`2px solid ${method===tb.id ? '#00FF87' : 'transparent'}`,
                color: method===tb.id ? '#00FF87' : tb.disabled ? '#2D3748' : '#6B7280',
                fontSize:11, fontWeight: method===tb.id ? 700 : 400 }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding:'20px 20px 32px', minHeight:200 }}>
          <AnimatePresence mode="wait">

            {/* FREE */}
            {method==='free' && !claimed && (
              <motion.div key="free" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}>
                <div style={{ textAlign:'center', marginBottom:20 }}>
                  <div style={{ fontSize:44, marginBottom:8 }}>🎁</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#00FF87' }}>Your first territory is FREE!</div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:6, lineHeight:1.6 }}>Welcome to Hexod. Claim this zone to start your empire.</div>
                  <div style={{ marginTop:10, padding:'8px 16px', background:'rgba(0,255,135,0.06)', borderRadius:8, fontSize:12, color:'#00FF87' }}>🎁 +100 HEX Coin bonus!</div>
                </div>
                <button onClick={() => claimMut.mutate({ method:'free' })} disabled={claimMut.isPending}
                  style={{ width:'100%', padding:14, background:'rgba(0,255,135,0.15)', border:'1px solid rgba(0,255,135,0.4)', borderRadius:12, color:'#00FF87', fontSize:15, fontWeight:800, cursor:'pointer' }}>
                  {claimMut.isPending ? '…' : '🚀 Claim for Free'}
                </button>
              </motion.div>
            )}

            {/* BUY */}
            {method==='buy' && !claimed && (
              <motion.div key="buy" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}>
                {isEnemy ? (
                  <>
                    <div style={{ fontSize:13, color:'#6B7280', marginBottom:14 }}>
                      Send a HEX Coin offer to <strong style={{ color:'#F87171' }}>{t.owner_username}</strong>. They can accept or decline.
                    </div>
                    <div style={{ display:'flex', gap:10, marginBottom:14, fontSize:12 }}>
                      <div style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 12px' }}>
                        <div style={{ color:'#4B5563', fontSize:10 }}>Your balance</div>
                        <div style={{ color:'#FFB800', fontWeight:700, fontFamily:'monospace' }}>{tdc.toFixed(0)} 🪙</div>
                      </div>
                      {t.poi_floor_price && (
                        <div style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 12px' }}>
                          <div style={{ color:'#4B5563', fontSize:10 }}>NFT floor</div>
                          <div style={{ color:rc, fontWeight:700, fontFamily:'monospace' }}>{t.poi_floor_price} HEX</div>
                        </div>
                      )}
                    </div>
                    <input type="number" value={offer} min={1} onChange={e => setOffer(parseInt(e.target.value)||1)}
                      style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:16, fontFamily:'monospace', fontWeight:700, boxSizing:'border-box', marginBottom:12 }} />
                    <button onClick={() => offerMut.mutate()} disabled={offerMut.isPending}
                      style={{ width:'100%', padding:13, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:12, color:'#60A5FA', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      {offerMut.isPending ? '…' : `💸 Send offer of ${offer} HEX Coin`}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ textAlign:'center', marginBottom:20 }}>
                      <div style={{ fontSize:40, marginBottom:8 }}>🪙</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#FFB800' }}>Instant Claim</div>
                      <div style={{ fontSize:12, color:'#6B7280', marginTop:6 }}>No puzzle. Pay HEX Coin and it's yours.</div>
                      <div style={{ display:'flex', justifyContent:'center', gap:24, marginTop:14 }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#4B5563' }}>Cost</div>
                          <div style={{ fontSize:20, fontWeight:700, color:'#EF4444', fontFamily:'monospace' }}>−{CLAIM_COST} 🪙</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#4B5563' }}>Balance</div>
                          <div style={{ fontSize:20, fontWeight:700, color:'#FFB800', fontFamily:'monospace' }}>{tdc.toFixed(0)} 🪙</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#4B5563' }}>After</div>
                          <div style={{ fontSize:20, fontWeight:700, color:'#9CA3AF', fontFamily:'monospace' }}>{(tdc-CLAIM_COST).toFixed(0)} 🪙</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => claimMut.mutate({ method:'buy' })} disabled={!canAfford || claimMut.isPending}
                      style={{ width:'100%', padding:14, background: canAfford ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${canAfford ? 'rgba(255,184,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius:12, color: canAfford ? '#FFB800' : '#4B5563', fontSize:15, fontWeight:800, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                      {claimMut.isPending ? '…' : canAfford ? `🪙 Buy for ${CLAIM_COST} HEX Coin` : `Need ${CLAIM_COST - tdc} more HEX Coin`}
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* PUZZLE */}
            {method==='puzzle' && !claimed && (
              <motion.div key="puzzle" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}>
                <div style={{ textAlign:'center', marginBottom:16 }}>
                  <div style={{ fontSize:12, color:'#6B7280', marginBottom:10 }}>Solve to claim — free but takes a brain 🧠</div>
                  <div style={{ fontSize:34, fontWeight:800, color:'#fff', fontFamily:'monospace', background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'14px 24px', border:'1px solid rgba(255,255,255,0.08)', letterSpacing:'0.1em' }}>
                    {puzzle.q} = ?
                  </div>
                </div>
                <div style={{ position:'relative', marginBottom:12 }}>
                  <input ref={inputRef} type="number" value={answer} onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && puzzleSolved && claimMut.mutate({ method:'puzzle', answer })}
                    placeholder="Your answer…"
                    style={{ width:'100%', background:`rgba(${puzzleSolved?'0,255,135':'255,255,255'},0.06)`, border:`1px solid ${puzzleSolved?'#00FF87':'rgba(255,255,255,0.12)'}`, borderRadius:12, padding:'12px 16px', color:'#fff', fontSize:20, fontFamily:'monospace', outline:'none', textAlign:'center', boxSizing:'border-box', transition:'border-color 0.2s' }} />
                  {puzzleSolved && <motion.span initial={{ scale:0 }} animate={{ scale:1 }} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:20 }}>✅</motion.span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setPuzzle(makePuzzle()); setAnswer(''); setSolved(false) }}
                    style={{ padding:'12px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#6B7280', cursor:'pointer', fontSize:13 }}>🔄</button>
                  <button onClick={() => claimMut.mutate({ method:'puzzle', answer })} disabled={!puzzleSolved || claimMut.isPending}
                    style={{ flex:1, padding:12, background: puzzleSolved ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${puzzleSolved?'rgba(0,255,135,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:10, color: puzzleSolved ? '#00FF87' : '#4B5563', cursor: puzzleSolved ? 'pointer' : 'not-allowed', fontSize:14, fontWeight:700 }}>
                    {claimMut.isPending ? '…' : puzzleSolved ? '⚔️ Claim Zone' : 'Solve to unlock'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ATTACK */}
            {method==='attack' && !claimed && (
              <motion.div key="attack" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}>
                <div style={{ textAlign:'center', marginBottom:16 }}>
                  <div style={{ fontSize:40, marginBottom:6 }}>⚔️</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#EF4444' }}>Military Takeover</div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:6, lineHeight:1.6 }}>
                    Deploy your forces. Higher rank = faster conquest.
                    {isEnemy && <><br/><span style={{ color:'#F87171' }}>⚠️ Owned by {t.owner_username} — harder to take</span></>}
                  </div>

                  {/* CDC coûts par rareté */}
                  {(() => {
                    const cost = ATTACK_COST[rarity] || ATTACK_COST.common
                    return (
                      <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:12, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, padding:'3px 8px', borderRadius:4, background:'rgba(239,68,68,0.1)', color:'#F87171', border:'1px solid rgba(239,68,68,0.2)' }}>
                          ⏱ {cost.time_h}h mobilisation
                        </span>
                        {cost.min_hex > 0 && (
                          <span style={{ fontSize:10, padding:'3px 8px', borderRadius:4, background:'rgba(245,158,11,0.1)', color:'#FCD34D', border:'1px solid rgba(245,158,11,0.2)' }}>
                            💎 min {cost.min_hex} HEX
                          </span>
                        )}
                        <span style={{ fontSize:10, padding:'3px 8px', borderRadius:4, background:'rgba(139,92,246,0.1)', color:'#C4B5FD', border:'1px solid rgba(139,92,246,0.2)' }}>
                          🎖️ Rank {rank} · ~{Math.max(2, Math.round((8000 - rank*60)/1000))}s
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {/* Sélecteur type d'attaque */}
                {!attacking && !attackResult && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:'#4B5563', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Type d'attaque</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {ATTACK_TYPES.map(at => (
                        <button key={at.id} onClick={() => setAttackType(at.id)} style={{
                          padding:'9px 12px', borderRadius:10, cursor:'pointer', textAlign:'left',
                          background: attackType===at.id ? `${at.color}18` : 'rgba(255,255,255,0.03)',
                          border: `1.5px solid ${attackType===at.id ? at.color+'55' : 'rgba(255,255,255,0.07)'}`,
                          transition:'all 0.15s',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:18 }}>{at.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:700, color: attackType===at.id ? at.color : '#9CA3AF' }}>{at.label}</div>
                              <div style={{ fontSize:10, color:'#4B5563', marginTop:2 }}>{at.desc}</div>
                            </div>
                            {attackType===at.id && <span style={{ color:at.color, fontSize:16 }}>●</span>}
                          </div>
                          {attackType===at.id && (
                            <div style={{ marginTop:5, fontSize:9, color:'#374151', fontStyle:'italic' }}>{at.counter}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rapport de bataille */}
                {attackResult?.report && (
                  <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                    style={{ padding:'12px 14px', borderRadius:10, marginBottom:12,
                      background: attackResult.victory ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.07)',
                      border: `1px solid ${attackResult.victory ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                    <div style={{ fontSize:14, fontWeight:800, color: attackResult.victory ? '#10B981' : '#F87171', marginBottom:6 }}>
                      {attackResult.report.title}
                    </div>
                    <div style={{ fontSize:11, color:'#6B7280', marginBottom:4 }}>{attackResult.report.detail}</div>
                    <div style={{ fontSize:11, color: attackResult.victory ? '#10B981' : '#9CA3AF', marginBottom:4 }}>{attackResult.report.loot}</div>
                    <div style={{ fontSize:10, color:'#4B5563', fontStyle:'italic', padding:'6px 8px',
                      background:'rgba(255,255,255,0.03)', borderRadius:6, borderLeft:'2px solid #374151' }}>
                      💡 {attackResult.report.tip}
                    </div>
                  </motion.div>
                )}

                {!attacking ? (
                  <button onClick={startAttack} style={{
                    width:'100%', padding:14,
                    background: `${(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).color}18`,
                    border: `1px solid ${(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).color}44`,
                    borderRadius:12,
                    color: (ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).color,
                    fontSize:14, fontWeight:800, cursor:'pointer',
                  }}>
                    {(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).icon} Lancer {(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).label}
                  </button>
                ) : (
                  <div>
                    <div style={{ marginBottom:8, display:'flex', justifyContent:'space-between', fontSize:12, color:'#9CA3AF' }}>
                      <span>{(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).icon} {attackType === 'assault' ? 'Troupes en mouvement…' : attackType === 'infiltration' ? 'Infiltration en cours…' : 'Blocus en place…'}</span>
                      <span style={{ fontFamily:'monospace', color:'#EF4444' }}>{Math.round(attackProgress)}%</span>
                    </div>
                    <div style={{ height:10, background:'rgba(255,255,255,0.08)', borderRadius:5, overflow:'hidden', marginBottom:14 }}>
                      <motion.div
                        style={{ height:'100%', background:`linear-gradient(90deg,${(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).color},${(ATTACK_TYPES.find(a=>a.id===attackType)||ATTACK_TYPES[0]).color}cc)`, borderRadius:5 }}
                        animate={{ width:`${attackProgress}%` }} transition={{ duration:0.1 }}
                      />
                    </div>
                    <div style={{ fontSize:11, color:'#6B7280', textAlign:'center' }}>
                      {attackProgress < 30 ? '🔍 Reconnaissance…' : attackProgress < 60 ? '💥 Engagement…' : attackProgress < 90 ? '🔥 Phase critique…' : '📡 Résolution…'}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* SUCCESS */}
            {claimed && (
              <motion.div key="claimed" initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
                style={{ textAlign:'center', padding:'10px 0' }}>
                <motion.div animate={{ rotate:[0,-10,10,-10,10,0] }} transition={{ duration:0.6 }}
                  style={{ fontSize:52, marginBottom:10 }}>🎉</motion.div>
                <div style={{ fontSize:18, fontWeight:800, color:'#00FF87' }}>Territory Claimed!</div>
                <div style={{ fontSize:13, color:'#6B7280', marginTop:6 }}>{name} is now yours</div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
