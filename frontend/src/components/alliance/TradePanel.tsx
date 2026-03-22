/**
 * TradePanel — RISK-style resource trading.
 * Trade HEX Coin, territories, units with allies or open market.
 * Inspired by Catan trading + RISK territory cards.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { usePlayer } from '../../store'
import toast from 'react-hot-toast'

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0

const TRADE_PRESETS = [
  { id: 'tdc_for_units', label: '💰 → ⚔️', desc: 'HEX Coin for units', offer: { tdc: 100 }, request: { units: { infantry: 3 } } },
  { id: 'units_for_tdc', label: '⚔️ → 💰', desc: 'Units for HEX Coin', offer: { units: { infantry: 5 } }, request: { tdc: 150 } },
  { id: 'tdc_transfer',  label: '💸 Transfer', desc: 'Send HEX Coin to ally', offer: { tdc: 0 }, request: {} },
]

interface TradeOffer {
  id: string
  from_username: string
  offer_tdc: number
  offer_units: Record<string, number>
  request_tdc: number
  request_units: Record<string, number>
  message: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  expires_at: string
}

export function TradePanel() {
  const player = usePlayer()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'market' | 'send'>('market')
  const [offerTdc, setOfferTdc] = useState(0)
  const [requestTdc, setRequestTdc] = useState(0)
  const [targetUser, setTargetUser] = useState('')
  const [message, setMessage] = useState('')

  const { data: offers } = useQuery({
    queryKey: ['trade-offers'],
    queryFn: () => api.get('/social/trades/').then(r => r.data?.results ?? []).catch(() => []),
    refetchInterval: 15000,
  })

  const sendMut = useMutation({
    mutationFn: () => api.post('/social/trades/', {
      target_username: targetUser,
      offer_tdc: offerTdc,
      request_tdc: requestTdc,
      message,
    }),
    onSuccess: () => {
      toast.success('Trade offer sent!')
      setOfferTdc(0); setRequestTdc(0); setTargetUser(''); setMessage('')
      qc.invalidateQueries({ queryKey: ['trade-offers'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Trade failed'),
  })

  const acceptMut = useMutation({
    mutationFn: (id: string) => api.post(`/social/trades/${id}/accept/`),
    onSuccess: () => { toast.success('Trade accepted! 🤝'); qc.invalidateQueries({ queryKey: ['trade-offers', 'player'] }) },
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.post(`/social/trades/${id}/reject/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trade-offers'] }),
  })

  const balance = toNum(player?.tdc_in_game)

  return (
    <div>
      {/* Mode tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'rgba(255,255,255,0.04)', borderRadius:8, padding:4 }}>
        {[{id:'market',label:'📋 Open Offers'},{id:'send',label:'📤 Send Offer'}].map(t=>(
          <button key={t.id} onClick={()=>setMode(t.id as any)} style={{ flex:1, padding:'7px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, background:mode===t.id?'rgba(255,255,255,0.1)':'transparent', color:mode===t.id?'#fff':'#6B7280' }}>{t.label}</button>
        ))}
      </div>

      {/* SEND OFFER */}
      {mode === 'send' && (
        <div>
          <div style={{ fontSize:11, color:'#6B7280', marginBottom:12 }}>Your balance: <span style={{color:'#F59E0B',fontWeight:600}}>{balance.toFixed(0)} HEX Coin</span></div>
          
          <Field label="To player (username)">
            <input value={targetUser} onChange={e=>setTargetUser(e.target.value)} placeholder="ally_username"
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <Field label="You offer (HEX Coin)">
              <AmountInput value={offerTdc} onChange={setOfferTdc} max={balance} color="#EF4444" />
            </Field>
            <Field label="You request (HEX Coin)">
              <AmountInput value={requestTdc} onChange={setRequestTdc} color="#10B981" />
            </Field>
          </div>

          <Field label="Message (optional)">
            <input value={message} onChange={e=>setMessage(e.target.value.slice(0,80))} placeholder="Trade proposal…"
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </Field>

          {/* Quick presets */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:6 }}>Quick presets</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[50, 100, 200, 500].map(amt => (
                <button key={amt} onClick={()=>setOfferTdc(amt)}
                  style={{ padding:'4px 10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                  {amt} HEX Coin
                </button>
              ))}
            </div>
          </div>

          <button onClick={()=>sendMut.mutate()} disabled={sendMut.isPending||!targetUser||offerTdc<0}
            style={{ width:'100%', padding:'12px', background:'rgba(0,255,135,0.15)', border:'1px solid rgba(0,255,135,0.3)', borderRadius:10, color:'#00FF87', fontSize:14, fontWeight:600, cursor:'pointer', opacity:sendMut.isPending?0.7:1 }}>
            {sendMut.isPending ? 'Sending…' : '📤 Send Trade Offer'}
          </button>
        </div>
      )}

      {/* MARKET */}
      {mode === 'market' && (
        <div>
          {(!offers || offers.length === 0) ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#4B5563' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🤝</div>
              <div style={{ fontSize:13 }}>No trade offers</div>
              <div style={{ fontSize:11, marginTop:4 }}>Send offers to allies to start trading</div>
            </div>
          ) : offers.map((o: TradeOffer) => (
            <div key={o.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:600, color:'#fff' }}>From {o.from_username}</span>
                <span style={{ fontSize:10, color: o.status==='pending'?'#F59E0B':'#6B7280', fontFamily:'monospace' }}>{o.status.toUpperCase()}</span>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:8, fontSize:12 }}>
                <div><span style={{color:'#EF4444'}}>Offers:</span> <span style={{color:'#fff',fontWeight:600}}>{o.offer_tdc} HEX Coin</span></div>
                <div><span style={{color:'#10B981'}}>Wants:</span> <span style={{color:'#fff',fontWeight:600}}>{o.request_tdc} HEX Coin</span></div>
              </div>
              {o.message && <div style={{ fontSize:11, color:'#6B7280', marginBottom:8, fontStyle:'italic' }}>"{o.message}"</div>}
              {o.status === 'pending' && (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>acceptMut.mutate(o.id)} style={{ flex:1, padding:'7px', background:'rgba(0,255,135,0.12)', border:'1px solid rgba(0,255,135,0.25)', borderRadius:8, color:'#00FF87', cursor:'pointer', fontSize:12, fontWeight:600 }}>✓ Accept</button>
                  <button onClick={()=>rejectMut.mutate(o.id)} style={{ padding:'7px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, color:'#EF4444', cursor:'pointer', fontSize:12 }}>✗</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:11, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function AmountInput({ value, onChange, max, color='#fff' }: { value:number; onChange:(n:number)=>void; max?:number; color?:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <button onClick={()=>onChange(Math.max(0,value-50))} style={{ width:28,height:28,borderRadius:6,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',cursor:'pointer',fontSize:14 }}>−</button>
      <input type="number" value={value} min={0} max={max} onChange={e=>onChange(Math.max(0,parseInt(e.target.value)||0))}
        style={{ flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'7px',color,fontSize:14,fontFamily:'monospace',fontWeight:700,outline:'none',textAlign:'center' }} />
      <button onClick={()=>onChange(value+50)} style={{ width:28,height:28,borderRadius:6,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',cursor:'pointer',fontSize:14 }}>+</button>
    </div>
  )
}
