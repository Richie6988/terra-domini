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
import { IconSVG } from '../shared/iconBank'

const ACC = '#0CC5FF'
/** Dark-theme rarity colours (claude.md §9) */
const RAR: Record<string, string> = { common:'#94a3b8', uncommon:'#22c55e', rare:'#3b82f6', epic:'#8b5cf6', legendary:'#f59e0b', mythic:'#ef4444' }
const RES_NAME: Record<string, [string, string]> = {
  petrole: ['Oil', 'res_petrole'], fer: ['Iron', 'res_fer'], donnees: ['Data', 'res_donnees'], influence: ['Influence', 'res_influence'],
  uranium: ['Uranium', 'res_uranium'], terrares: ['Rare earths', 'res_terres_rares'], terres_rares: ['Rare earths', 'res_terres_rares'],
  silicium: ['Silicon', 'res_silicium'], nourriture: ['Food', 'res_nourriture'], eau: ['Water', 'res_eau'], or: ['Gold', 'res_or'],
  lithium: ['Lithium', 'res_lithium'], gaz: ['Gas', 'res_gaz'], acier: ['Steel', 'res_acier'], charbon: ['Coal', 'res_charbon'],
}

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
        tdc_earned: e.daily_income, rank: e.rank, commander_rank: e.commander_rank,
      }))
    })),
    staleTime: 60000,
  })

  const rarityDist: Record<string,number> = meta?.rarity_distribution || {}
  const biomeDist: Record<string,number>  = meta?.biome_distribution   || {}
  const totalTerr: number = Object.values(rarityDist).reduce((a,b) => a+b, 0) || 1
  const topPlayers = leaderboard?.top_players || []

  return (
    <GlassPanel title="WORLD META" onClose={onClose} accent={ACC} icon={<IconSVG id="grid_globe" size={24} />} subtitle="World statistics · refreshed every 2 min">
      {/* KPI tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:14 }}>
        {[
          { label:'TERRITORIES CLAIMED', value: meta?.global_stats?.owned_count ?? (meta ? totalTerr : undefined), icon:'castle' },
          { label:'ACTIVE PLAYERS', value: meta?.global_stats?.active_players, icon:'people' },
          { label:'BATTLES (24H)', value: meta?.global_stats?.battles_24h, icon:'swords' },
          { label:'HEX EMITTED (24H)', value: meta?.global_stats?.hex_emitted_24h, icon:'hex_coin' },
        ].map((k, i) => (
          <div key={k.label} className="hx-card hx-rise" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', animationDelay:`${i*50}ms` }}>
            <IconSVG id={k.icon} size={32} />
            <div className="hx-stat">
              <span className="hx-stat__label">{k.label}</span>
              {isLoading ? <span className="hx-skeleton" style={{ height:20, width:60 }} /> :
                <span className="hx-stat__value hx-stat__value--accent" style={{ fontSize:22 }}>{k.value != null ? Number(k.value).toLocaleString() : '—'}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="hx-tabs" role="tablist">
        {[
          { id:'overview',   label:'OVERVIEW' },
          { id:'resources',  label:'RESOURCES' },
          { id:'players',    label:'PLAYERS' },
          { id:'hotspots',   label:'HOTSPOTS' },
        ].map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab===t.id} onClick={() => setTab(t.id as any)}>{t.label}</button>
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
                  <Section label="Rarity distribution">
                    {Object.entries(rarityDist)
                      .sort(([,a],[,b]) => b - a)
                      .map(([rarity, count]) => {
                        const pct = (count / totalTerr) * 100
                        const color = RAR[rarity] || RARITY_COLOR[rarity] || '#94a3b8'
                        return (
                          <div key={rarity} style={{ marginBottom:10 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                              <span style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color, fontWeight:700, letterSpacing:0.5 }}>
                                <span style={{ width:8, height:8, borderRadius:2, transform:'rotate(45deg)', background:color, boxShadow:`0 4px 0 rgba(0,0,0,0.35)` }} />
                                {(rarity || '').toUpperCase()}
                              </span>
                              <span style={{ fontSize:12, color:'rgba(226,232,240,0.7)', fontFamily:"'Share Tech Mono', monospace" }}>
                                {count.toLocaleString()} <span style={{ color:'rgba(226,232,240,0.45)' }}>· {pct.toFixed(1)}%</span>
                              </span>
                            </div>
                            <div className="hx-progress" style={{ height:8 }}>
                              <motion.div
                                initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.6,ease:'easeOut'}}
                                style={{ position:'absolute', inset:'0 auto 0 0', background:`linear-gradient(90deg, ${color}99, ${color})`, borderRadius:999, boxShadow:`0 4px 0 rgba(0,0,0,0.35)` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </Section>

                  {/* Biome distribution */}
                  <Section label="Biome distribution">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {Object.entries(biomeDist)
                        .sort(([,a],[,b]) => b - a)
                        .map(([biome, count]) => (
                          <div key={biome} className="hx-card" style={{ padding:'10px 12px', borderLeft:`3px solid ${BIOME_COLOR[biome] || '#86efac'}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:6 }}>
                              <span style={{ fontSize:11, fontWeight:700, letterSpacing:0.5, color: BIOME_COLOR[biome] || '#86efac' }}>{(biome || '').toUpperCase()}</span>
                              <span style={{ fontSize:16, color:'#e2e8f0', fontFamily:"'Share Tech Mono', monospace" }}>{count.toLocaleString()}</span>
                            </div>
                            <div className="hx-progress" style={{ marginTop:8, ['--accent' as any]: BIOME_COLOR[biome] || '#86efac' }}>
                              <div className="hx-progress__fill" style={{ width:`${(count / totalTerr) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </Section>

                </>
              )}

              {/* ── RESOURCES (surplus/déficit) ───────────────────────────── */}
              {tab === 'resources' && (
                <Section label="Resource supply vs demand">
                  {(meta?.resource_balance || []).map((r: any) => {
                    const supply = Number(r.supply) || 0, demand = Number(r.demand) || 0
                    const ratio = demand > 0 ? supply / demand : (supply > 0 ? Infinity : null)
                    const color = ratio == null ? '#94a3b8' : ratio > 1.3 ? '#22c55e' : ratio < 0.7 ? '#ef4444' : '#f59e0b'
                    const label = ratio == null ? 'No activity' : ratio > 1.3 ? 'Surplus' : ratio < 0.7 ? 'Deficit' : 'Balanced'
                    const [name, icon] = RES_NAME[r.resource] || [String(r.resource || '').replace(/_/g, ' '), `res_${r.resource}`]
                    return (
                      <div key={r.resource} className="hx-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', marginBottom:8 }}>
                        <IconSVG id={icon} size={32} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0', letterSpacing:0.5 }}>{name.toUpperCase()}</div>
                          <div style={{ fontSize: 11, color:'rgba(226,232,240,0.55)', marginTop:3, fontFamily:"'Share Tech Mono', monospace" }}>
                            SUPPLY {supply.toLocaleString()} · DEMAND {demand.toLocaleString()}
                          </div>
                        </div>
                        <span className="hx-chip" style={{ color, borderColor:`${color}66`, background:`${color}18` }}>
                          {label.toUpperCase()}{ratio != null && isFinite(ratio) ? ` ×${ratio.toFixed(2)}` : ''}
                        </span>
                      </div>
                    )
                  })}
                  {!(meta?.resource_balance?.length) && (
                    <EmptyState msg="Collecting data…" />
                  )}
                </Section>
              )}

              {/* ── PLAYERS ───────────────────────────────────────────────── */}
              {tab === 'players' && (
                <>
                  <Section label="Top 10 commanders">
                    {topPlayers.slice(0,10).map((p: any, i: number) => (
                      <div key={p.username || i} className="hx-card hx-rise" style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 12px', marginBottom:6, animationDelay:`${i*40}ms`,
                        borderColor: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i]+'55' : undefined,
                      }}>
                        <div style={{
                          width:32, height:32, borderRadius:'50%', flexShrink:0, fontFamily:"'Share Tech Mono', monospace",
                          border: i < 3 ? `3px solid ${['#FFD700','#C0C0C0','#CD7F32'][i]}` : '1px solid rgba(255,255,255,0.12)',
                          background: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i]+'33' : 'rgba(255,255,255,0.06)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:14, fontWeight:800, color: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : 'rgba(226,232,240,0.7)',
                        }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.username}</div>
                          <div style={{ fontSize: 11, color:'rgba(226,232,240,0.55)', marginTop:3, fontFamily:"'Share Tech Mono', monospace" }}>
                            {p.territories ?? 0} TERRITORIES{p.commander_rank != null ? ` · RANK ${p.commander_rank}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, fontWeight:700, color:'#fde68a', fontFamily:"'Share Tech Mono', monospace" }}>
                            <IconSVG id="hex_coin" size={14} />{Number(p.tdc_earned || 0).toFixed(0)}
                          </div>
                          <div style={{ fontSize: 11, color:'rgba(226,232,240,0.45)', marginTop:2 }}>PER DAY</div>
                        </div>
                      </div>
                    ))}
                    {!topPlayers.length && <EmptyState msg="No ranked players yet." />}
                  </Section>
                </>
              )}

              {/* ── HOTSPOTS ──────────────────────────────────────────────── */}
              {tab === 'hotspots' && (
                <Section label="Most contested zones (24h)">
                  {(meta?.contested_zones || []).map((z: any, i: number) => (
                    <div key={z.h3_index} style={{
                      display:'flex', gap:10, padding:'9px 12px', marginBottom:6,
                      background:'rgba(239,68,68,0.06)', borderRadius:8,
                      border:'2px solid rgba(239,68,68,0.15)',
                    }}>
                      <div style={{ width:20, height:20, borderRadius:4, background:'rgba(239,68,68,0.15)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:800, color:'#EF4444', flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0' }}>
                          {z.poi_name || z.h3_index?.slice(0,12)}
                        </div>
                        <div style={{ fontSize: 11, color:'rgba(255,255,255,0.35)' }}>
                          {z.rarity} · {z.battle_count} battles · {z.owner_changes} ownership changes
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:'#EF4444', fontFamily:'monospace', flexShrink:0 }}>
                        {z.battle_count}
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
      <div className="hx-section-title">{label.toUpperCase()}</div>
      {children}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="hx-empty"><IconSVG id="grid_globe" size={40} /><div className="hx-empty__title" style={{ fontSize:11 }}>{msg.toUpperCase()}</div></div>
}
