/**
 * MetaDashboard — tableau de bord méta mondial (Alex spec)
 *
 * Accessible via bouton "Méta" dans GameHUD.
 * Stats globales : distribution raretés, biomes en surplus/déficit,
 * top joueurs, top alliances, territoires les plus contestés.
 * Permet à Alex d'adapter sa stratégie en fonction du méta courant.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { RARITY_COLOR, BIOME_COLOR } from '../../styles/tokens'
import { GlassPanel } from '../shared/GlassPanel'
import { SkeletonPanel } from '../ui/Utils'
import { EmojiIcon } from '../shared/emojiIcons'

interface Props { onClose: () => void }

export function MetaDashboard({ onClose }: Props) {
  const [tab, setTab] = useState<'overview'|'resources'|'players'|'hotspots'>('overview')

  const { data: meta, isLoading } = useQuery({
    queryKey: ['meta-dashboard'],
    queryFn: () => api.get('/territories-geo/meta/').then(r => r.data),
    staleTime: 60000,
    refetchInterval: 120000,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard-meta'],
    queryFn: () => api.get('/territories-geo/ladder/?scope=global').then(r => ({
      top_players: (r.data?.entries || []).slice(0,10).map((e: any) => ({
        username: e.username, territories: e.territories,
        tdc_earned: e.daily_income, rank: e.rank,
      }))
    })),
    staleTime: 60000,
  })

  const rarityDist: Record<string,number> = meta?.rarity_distribution || {}
  const biomeDist: Record<string,number>  = meta?.biome_distribution   || {}
  const totalTerr: number = Object.values(rarityDist).reduce((a,b) => a+b, 0) || 1
  const topPlayers = leaderboard?.top_players || []

  return (
    <GlassPanel title="WORLD META" onClose={onClose} accent="#64748b">
      {/* Stats bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12,
        padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:8,
        border:'1px solid rgba(255,255,255,0.08)', fontFamily:"'Share Tech Mono', monospace" }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>{totalTerr.toLocaleString()} TERRITORIES</span>
        <span style={{ fontSize:8, color:'#00884a', letterSpacing:1 }}>◆ LIVE</span>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[
          { id:'overview',   label:'OVERVIEW' },
          { id:'resources',  label:'RESOURCES' },
          { id:'players',    label:'PLAYERS' },
          { id:'hotspots',   label:'HOTSPOTS' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex:1, padding:'6px 4px', fontSize:7, fontWeight:tab===t.id?700:500, letterSpacing:1,
            background: tab===t.id ? 'rgba(100,116,139,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${tab===t.id ? 'rgba(100,116,139,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius:20, cursor:'pointer',
            color: tab===t.id ? '#64748b' : 'rgba(255,255,255,0.4)',
            fontFamily:"'Orbitron', system-ui, sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div>
        {isLoading ? <SkeletonPanel /> : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.1}}>

              {/* ── OVERVIEW ─────────────────────────────────────────────── */}
              {tab === 'overview' && (
                <>
                  {/* Rareté distribution */}
                  <Section label="Distribution des raretés">
                    {Object.entries(rarityDist)
                      .sort(([,a],[,b]) => b - a)
                      .map(([rarity, count]) => {
                        const pct = (count / totalTerr) * 100
                        const color = RARITY_COLOR[rarity] || '#9CA3AF'
                        return (
                          <div key={rarity} style={{ marginBottom:8 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:11, color, fontWeight:600 }}>{rarity}</span>
                              <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontFamily:'monospace' }}>
                                {count.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div style={{ height:6, background:'rgba(255,255,255,0.04)', borderRadius:3 }}>
                              <motion.div
                                initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.6,ease:'easeOut'}}
                                style={{ height:'100%', background:color, borderRadius:3 }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </Section>

                  {/* Biome distribution */}
                  <Section label="Répartition des biomes">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {Object.entries(biomeDist)
                        .sort(([,a],[,b]) => b - a)
                        .map(([biome, count]) => (
                          <div key={biome} style={{
                            padding:'8px 10px', borderRadius:8,
                            background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize:12, fontWeight:700, color: BIOME_COLOR[biome] || '#9CA3AF' }}>
                              {biome}
                            </div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', fontFamily:'monospace' }}>
                              {count.toLocaleString()}
                            </div>
                          </div>
                        ))}
                    </div>
                  </Section>

                  {/* Global stats */}
                  {meta?.global_stats && (
                    <Section label="Statistiques globales">
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        {[
                          ['Joueurs actifs', meta.global_stats.active_players?.toLocaleString()],
                          ['Territories claimed', meta.global_stats.owned_count?.toLocaleString()],
                          ['Battles (24h)',  meta.global_stats.battles_24h?.toLocaleString()],
                          ['HEX émis (24h)',   meta.global_stats.hex_emitted_24h?.toLocaleString()],
                        ].map(([label, value]) => (
                          <div key={label as string} style={{
                            padding:'8px 10px', background:'rgba(255,255,255,0.04)',
                            borderRadius:8, border:'1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize:11, color:'#00884a', fontWeight:700 }}>{value || '—'}</div>
                            <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* ── RESOURCES (surplus/déficit) ───────────────────────────── */}
              {tab === 'resources' && (
                <Section label="Surplus et déficits de ressources">
                  {(meta?.resource_balance || []).map((r: any) => {
                    const pct = Math.min(1, r.supply / Math.max(r.demand, 1))
                    const color = pct > 1.3 ? '#10B981' : pct < 0.7 ? '#EF4444' : '#F59E0B'
                    const label = pct > 1.3 ? 'Surplus' : pct < 0.7 ? 'Déficit' : 'Équilibré'
                    return (
                      <div key={r.resource} style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'8px 10px', marginBottom:6,
                        background:'rgba(255,255,255,0.04)', borderRadius:8,
                        border:`1px solid ${color}22`,
                      }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0' }}>{r.resource}</div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>
                            Offre {r.supply?.toLocaleString()} · Demande {r.demand?.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color }}>{label}</div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontFamily:'monospace' }}>
                            ×{pct.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {!(meta?.resource_balance?.length) && (
                    <EmptyState msg="Données en cours de collecte…" />
                  )}
                </Section>
              )}

              {/* ── PLAYERS ───────────────────────────────────────────────── */}
              {tab === 'players' && (
                <>
                  <Section label="Top 10 joueurs">
                    {topPlayers.slice(0,10).map((p: any, i: number) => (
                      <div key={p.id} style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'8px 10px', marginBottom:5,
                        background:'rgba(255,255,255,0.04)', borderRadius:8,
                      }}>
                        <div style={{
                          width:24, height:24, borderRadius:'50%', flexShrink:0,
                          background: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i]+'33' : 'rgba(255,255,255,0.06)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:800, color: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : '#6B7280',
                        }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>{p.username}</div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>
                            {p.territories_owned} zones · rang {p.commander_rank}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#F59E0B', fontFamily:'monospace' }}>
                            {(p.total_tdc || 0).toFixed(0)} <EmojiIcon emoji="" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {!topPlayers.length && <EmptyState msg="Classement en cours de chargement…" />}
                  </Section>
                </>
              )}

              {/* ── HOTSPOTS ──────────────────────────────────────────────── */}
              {tab === 'hotspots' && (
                <Section label="Zones les plus contestées (24h)">
                  {(meta?.contested_zones || []).map((z: any, i: number) => (
                    <div key={z.h3_index} style={{
                      display:'flex', gap:10, padding:'9px 12px', marginBottom:6,
                      background:'rgba(239,68,68,0.06)', borderRadius:8,
                      border:'1px solid rgba(239,68,68,0.15)',
                    }}>
                      <div style={{ width:20, height:20, borderRadius:4, background:'rgba(239,68,68,0.15)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:800, color:'#EF4444', flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0' }}>
                          {z.poi_name || z.h3_index?.slice(0,12)}
                        </div>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>
                          {z.rarity} · {z.battle_count} batailles · {z.owner_changes} changements de main
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:'#EF4444', fontFamily:'monospace', flexShrink:0 }}>
                        <EmojiIcon emoji="" /> {z.battle_count}
                      </div>
                    </div>
                  ))}
                  {!(meta?.contested_zones?.length) && (
                    <EmptyState msg="No heavily contested zones in the last 24h." />
                  )}
                </Section>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </GlassPanel>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10,
        display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }}/>
        {label}
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }}/>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ padding:'16px', textAlign:'center', color:'rgba(26,42,58,0.25)', fontSize:12 }}>{msg}</div>
}
