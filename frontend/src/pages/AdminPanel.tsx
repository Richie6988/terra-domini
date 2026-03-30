/**
 * AdminPanel — Game Master Dashboard
 * Accessible via /gm (staff only)
 * Stats live · Logs actions · Gestion joueurs · Shop items
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../services/api'
import { usePlayer } from '../store'
import { useNavigate } from 'react-router-dom'

const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0

const RARITY_COLOR: Record<string,string> = {
  common:'#9CA3AF', uncommon:'#10B981', rare:'#3B82F6',
  epic:'#8B5CF6', legendary:'#F59E0B', mythic:'#EC4899',
}

type Tab = 'dashboard' | 'logs' | 'players' | 'economy' | 'shop'

export default function AdminPanel() {
  const [tab, setTab]     = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const player = usePlayer()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Rediriger si pas admin
  if (player && !player.is_staff && !player.is_superuser) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#080810',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#EF4444', fontSize:20, fontWeight:800 }}>
        ⛔ Accès refusé — Admin uniquement
      </div>
    )
  }

  const { data: dash } = useQuery({
    queryKey: ['gm-dashboard'],
    queryFn: () => api.get('/gm/dashboard/').then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['gm-logs'],
    queryFn: () => api.get('/gm/logs/').then(r => r.data),
    refetchInterval: 10000,
    enabled: tab === 'logs',
  })

  const { data: playersData } = useQuery({
    queryKey: ['gm-players', search],
    queryFn: () => api.get(`/gm/players/?search=${search}`).then(r => r.data),
    enabled: tab === 'players',
    staleTime: 30000,
  })

  const { data: shopData } = useQuery({
    queryKey: ['shop-catalog'],
    queryFn: () => api.get('/shop/catalog/').then(r => r.data),
    enabled: tab === 'shop',
  })

  const playerActionMut = useMutation({
    mutationFn: ({ id, action, value }: any) =>
      api.post(`/gm/players/${id}/action/`, { action, value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gm-players'] }),
  })

  const logs: any[] = logsData?.logs || []
  const players: any[] = playersData?.players || []
  const shopItems: any[] = shopData || []

  const stats = dash || {}

  return (
    <div style={{
      minHeight: '100vh', background: '#060610', color: '#E5E7EB',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px', background: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 22 }}>⬡</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0099cc' }}>HEXOD GM</div>
          <div style={{ fontSize: 10, color: '#4B5563' }}>Game Master Dashboard</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/')} style={{
          padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF',
          cursor: 'pointer', fontSize: 12,
        }}>← Retour au jeu</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 24px',
      }}>
        {([
          { id:'dashboard', label:'📊 Dashboard' },
          { id:'logs',      label:'📋 Logs' },
          { id:'players',   label:'👥 Joueurs' },
          { id:'economy',   label:'💰 Économie' },
          { id:'shop',      label:'🏪 Shop' },
        ] as {id:Tab,label:string}[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? '#0099cc' : '#6B7280',
            borderBottom: `2px solid ${tab===t.id ? '#0099cc' : 'transparent'}`,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── DASHBOARD ─────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div>
            {/* Stats cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:24 }}>
              {[
                { label:'Joueurs total',   value: stats.total_players || 0,    icon:'👥', color:'#3B82F6' },
                { label:'En ligne',        value: stats.online_now || 0,        icon:'🟢', color:'#10B981' },
                { label:'Actifs 1h',       value: stats.active_1h || 0,         icon:'⚡', color:'#F59E0B' },
                { label:'Nouveaux/24h',    value: stats.new_today || 0,         icon:'🆕', color:'#8B5CF6' },
                { label:'Territoires',     value: stats.total_territories || 921, icon:'🗺️', color:'#10B981' },
                { label:'Revendiqués',     value: stats.claimed_territories || 0, icon:'🏴', color:'#0099cc' },
                { label:'Batailles actives',value: stats.active_battles || 0,   icon:'⚔️', color:'#EF4444' },
                { label:'TDC en jeu',      value: Math.round(toNum(stats.tdc_in_game)).toLocaleString(), icon:'💎', color:'#F59E0B' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                  padding: '14px 16px', border: `1px solid ${s.color}22`,
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:12,
              border:'1px solid rgba(255,255,255,0.07)', padding:'16px 20px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#9CA3AF', marginBottom:12 }}>Actions rapides</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { label:'Voir les logs', action: () => setTab('logs') },
                  { label:'Gérer joueurs', action: () => setTab('players') },
                  { label:'Admin Django →', action: () => window.open('/admin/', '_blank') },
                ].map(a => (
                  <button key={a.label} onClick={a.action} style={{
                    padding:'8px 16px', borderRadius:8, cursor:'pointer',
                    background:'rgba(0,136,74,0.1)', border:'1px solid rgba(0,136,74,0.25)',
                    color:'#0099cc', fontSize:12, fontWeight:700,
                  }}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS ──────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a2a3a' }}>
                Journal des actions
                <span style={{ fontSize:10, color:'#4B5563', marginLeft:8 }}>
                  {logs.length} entrées · actualisation auto 10s
                </span>
              </div>
              <button onClick={() => qc.invalidateQueries({ queryKey:['gm-logs'] })} style={{
                padding:'6px 14px', borderRadius:8, background:'rgba(0,136,74,0.1)',
                border:'1px solid rgba(0,136,74,0.25)', color:'#0099cc', fontSize:12, cursor:'pointer',
              }}>🔄 Rafraîchir</button>
            </div>

            {logsLoading ? (
              <div style={{ textAlign:'center', padding:'40px', color:'#374151' }}>Chargement…</div>
            ) : (
              <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:12, overflow:'hidden',
                border:'1px solid rgba(255,255,255,0.07)' }}>
                {logs.length === 0 ? (
                  <div style={{ padding:'32px', textAlign:'center', color:'#374151' }}>
                    Aucun log pour l'instant — le jeu commence !
                  </div>
                ) : logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity:0, x:-8 }}
                    animate={{ opacity:1, x:0 }}
                    transition={{ delay: Math.min(i*0.01, 0.3) }}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'10px 16px',
                      borderBottom: i < logs.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    <span style={{ fontSize:16, flexShrink:0 }}>{log.icon || '📌'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, color:'#E5E7EB',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>{log.label}</div>
                      {log.rarity && (
                        <span style={{ fontSize:9, color: RARITY_COLOR[log.rarity] || '#9CA3AF', fontWeight:700 }}>
                          {log.rarity} {log.biome ? `· ${log.biome}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:10, color:'#374151', flexShrink:0, fontFamily:'monospace' }}>
                      {log.at ? new Date(log.at).toLocaleTimeString('fr-FR') : '—'}
                    </div>
                    {/* Badge type */}
                    <div style={{
                      padding:'2px 7px', borderRadius:10, fontSize:9, fontWeight:700, flexShrink:0,
                      background: log.type==='claim' ? 'rgba(16,185,129,0.15)' :
                                  log.type==='battle' ? 'rgba(239,68,68,0.15)' :
                                  log.type==='shop' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
                      color: log.type==='claim' ? '#10B981' :
                             log.type==='battle' ? '#EF4444' :
                             log.type==='shop' ? '#F59E0B' : '#6B7280',
                    }}>{log.type}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── JOUEURS ───────────────────────────────────────────── */}
        {tab === 'players' && (
          <div>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un joueur…"
                style={{
                  flex:1, padding:'10px 14px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:9,
                  color:'#1a2a3a', fontSize:13,
                }}
              />
            </div>

            <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:12,
              border:'1px solid rgba(255,255,255,0.07)', overflow:'hidden' }}>
              {/* En-têtes */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 100px 120px 120px',
                padding:'10px 16px', fontSize:10, color:'#374151', textTransform:'uppercase',
                borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.02)' }}>
                <div>Joueur</div>
                <div>Rang</div>
                <div>Zones</div>
                <div>HEX Coin</div>
                <div>Dernière co.</div>
                <div>Actions</div>
              </div>

              {players.length === 0 && (
                <div style={{ padding:'24px', textAlign:'center', color:'#374151', fontSize:12 }}>
                  {search ? 'Aucun joueur trouvé' : 'Chargement…'}
                </div>
              )}

              {players.map((p: any) => (
                <div key={p.id} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 80px 100px 120px 120px',
                  padding:'10px 16px', alignItems:'center',
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1a2a3a' }}>
                      {p.is_staff && <span style={{ color:'#F59E0B', marginRight:4 }}>★</span>}
                      {p.username}
                    </div>
                    <div style={{ fontSize:10, color:'#4B5563' }}>{p.email}</div>
                  </div>
                  <div style={{ fontSize:12, color:'#9CA3AF' }}>{p.commander_rank}</div>
                  <div style={{ fontSize:12, color:'#10B981', fontWeight:700 }}>{p.territories_owned || 0}</div>
                  <div style={{ fontSize:11, color:'#F59E0B', fontFamily:'monospace' }}>
                    {toNum(p.tdc_in_game).toFixed(0)}
                  </div>
                  <div style={{ fontSize:10, color:'#374151' }}>
                    {p.last_login ? new Date(p.last_login).toLocaleDateString('fr-FR') : '—'}
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button
                      onClick={() => {
                        const amt = prompt(`Donner X HEX à ${p.username}:`)
                        if (amt) playerActionMut.mutate({ id:p.id, action:'grant_tdc', value:parseFloat(amt) })
                      }}
                      title="Donner HEX"
                      style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer',
                        background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)',
                        color:'#F59E0B' }}>+HEX</button>
                    <button
                      onClick={() => { if(confirm(`Bannir ${p.username}?`)) playerActionMut.mutate({ id:p.id, action:'ban' }) }}
                      title="Bannir"
                      style={{ padding:'4px 8px', borderRadius:6, fontSize:10, cursor:'pointer',
                        background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                        color:'#EF4444' }}>Ban</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SHOP ──────────────────────────────────────────────── */}
        {tab === 'shop' && (
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a2a3a', marginBottom:16 }}>
              Catalogue boutique ({shopItems.length} articles)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
              {shopItems.map((item: any) => (
                <div key={item.code} style={{
                  background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'12px 14px',
                  border:`1px solid ${RARITY_COLOR[item.rarity] || '#374151'}33`,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#1a2a3a' }}>{item.name}</div>
                    <div style={{ fontSize:11, color:'#F59E0B', fontFamily:'monospace', fontWeight:700 }}>
                      {parseFloat(item.price_tdc).toFixed(0)} HEX
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:'#6B7280', marginBottom:6 }}>{item.description}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <span style={{ fontSize:9, padding:'2px 6px', borderRadius:10, fontWeight:700,
                      background: `${RARITY_COLOR[item.rarity] || '#374151'}22`,
                      color: RARITY_COLOR[item.rarity] || '#6B7280' }}>
                      {item.rarity}
                    </span>
                    <span style={{ fontSize:9, color:'#374151', padding:'2px 6px',
                      background:'rgba(255,255,255,0.04)', borderRadius:10 }}>
                      {item.effect_type}
                    </span>
                    {item.max_per_day > 0 && (
                      <span style={{ fontSize:9, color:'#374151', padding:'2px 6px',
                        background:'rgba(255,255,255,0.04)', borderRadius:10 }}>
                        max {item.max_per_day}/j
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ÉCONOMIE ──────────────────────────────────────────── */}
        {tab === 'economy' && (
          <EconomyTab />
        )}
      </div>
    </div>
  )
}

function EconomyTab() {
  const { data } = useQuery({
    queryKey: ['gm-economy'],
    queryFn: () => api.get('/gm/economy/').then(r => r.data).catch(() => ({})),
    refetchInterval: 30000,
  })

  const { data: revenue } = useQuery({
    queryKey: ['onchain-revenue'],
    queryFn: () => api.get('/solana/revenue/').then(r => r.data).catch(() => ({})),
  })

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        {/* Économie in-game */}
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:12,
          border:'1px solid rgba(255,255,255,0.07)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#0099cc', marginBottom:12 }}>Économie in-game</div>
          {[
            ['HEX total en circulation', data?.tdc_in_circulation?.toLocaleString() || '—'],
            ['TDC dépensé (shop)', data?.tdc_spent_shop?.toLocaleString() || '—'],
            ['HEX Coin gagné (24h)', data?.tdc_earned_24h?.toLocaleString() || '—'],
            ['Territoires claimed', data?.claimed_count || '—'],
          ].map(([l,v]) => (
            <div key={l as string} style={{ display:'flex', justifyContent:'space-between',
              padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize:12, color:'#6B7280' }}>{l}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#1a2a3a', fontFamily:'monospace' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Revenus on-chain */}
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:12,
          border:'1px solid rgba(245,158,11,0.15)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#F59E0B', marginBottom:12 }}>Revenus on-chain (Solana)</div>
          {[
            ['Volume marketplace 7j', `${revenue?.marketplace_volume_7d || 0} HEX`],
            ['Ventes 7j', revenue?.sales_count_7d || 0],
            ['Fees collectées 7j', `${revenue?.fees_collected_7d || 0} HEX`],
            ['Tokens brûlés total', `${revenue?.tokens_burned_total || 0} HEX`],
            ['Réseau', revenue?.network || 'devnet'],
          ].map(([l,v]) => (
            <div key={l as string} style={{ display:'flex', justifyContent:'space-between',
              padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize:12, color:'#6B7280' }}>{l}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#F59E0B', fontFamily:'monospace' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
