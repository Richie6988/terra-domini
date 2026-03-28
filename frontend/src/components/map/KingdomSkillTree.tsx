/**
 * KingdomSkillTree — Arbre de compétences lié à un Royaume
 * Hexod GDD: skills per kingdom (cluster), not global.
 * Main kingdom = full tree. Isolated territory = tree starts at 0.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

const BRANCH_CFG = {
  attack:    { label:'⚔️ Attaque',      color:'#EF4444', desc:'Expansion et combat' },
  defense:   { label:'🛡️ Défense',      color:'#3B82F6', desc:'Protection du royaume' },
  economy:   { label:'💰 Économie',     color:'#F59E0B', desc:'Production et échanges' },
  influence: { label:'🌐 Rayonnement',  color:'#10B981', desc:'Contrôle indirect' },
  tech:      { label:'🔬 Technologies', color:'#8B5CF6', desc:'Avantage systémique' },
} as const

const RESOURCE_ICONS: Record<string,string> = {
  'Pétrole':'🛢️','Acier':'⚙️','Main d\'œuvre':'👷','Données':'📊',
  'Composants électroniques':'🔌','HEX (HEX Coin)':'💠','Influence politique':'🌐',
  'Terres rares':'💎','Silicium':'💠','Fer':'🪨','Uranium':'☢️',
  'Charbon':'⬛','Titanium':'🔷','Nourriture':'🌾','Eau':'💧',
  'Stabilité':'⚖️','Aluminium':'⬜','Cuivre':'🟠','Gaz naturel':'💨',
}

interface Props {
  clusterId: string
  onClose: () => void
}

export function KingdomSkillTree({ clusterId, onClose }: Props) {
  const [branch, setBranch] = useState<string>('attack')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['kingdom-skills', clusterId],
    queryFn: () => api.get(`/territories-geo/kingdom-skill-tree/?cluster_id=${clusterId}`).then(r => r.data),
    staleTime: 15000,
  })

  const unlock = useMutation({
    mutationFn: (skillId: number) => api.post('/territories-geo/kingdom-unlock-skill/', {
      cluster_id: clusterId, skill_id: skillId,
    }),
    onSuccess: (_, id) => {
      toast.success('⚔️ Compétence débloquée!')
      qc.invalidateQueries({ queryKey: ['kingdom-skills', clusterId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Ressources insuffisantes'),
  })

  const tree: Record<string, any[]>  = data?.tree    || {}
  const kingdom: Record<string, any> = data?.kingdom || {}
  const unlocked: number             = data?.unlocked_count || 0
  const totalSkills = Object.values(tree).reduce((s, v) => s + v.length, 0)
  const cfg = BRANCH_CFG[branch as keyof typeof BRANCH_CFG]
  const skills = tree[branch] || []
  const resources = kingdom?.resources || {}

  const isMain      = kingdom?.is_main
  const isIsolated  = (kingdom?.size || 0) <= 1
  const kingdomColor = isMain ? '#F59E0B' : isIsolated ? '#6B7280' : '#10B981'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)',
        padding: '16px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        background: 'linear-gradient(180deg, rgba(235,242,250,0.97), rgba(220,230,242,0.97))',
        border: `2px solid ${kingdomColor}44`,
        borderRadius: 18, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 60px ${kingdomColor}18`,
      }}>
        {/* Kingdom header */}
        <div style={{
          padding: '16px 18px 12px',
          background: `linear-gradient(135deg, ${kingdomColor}18, transparent)`,
          borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>
                  {isMain ? '👑' : isIsolated ? '🏴' : '🏰'}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                    {isMain ? 'Royaume Principal' : isIsolated ? 'Territoire Isolé' : 'Royaume Secondaire'}
                  </div>
                  <div style={{ fontSize: 10, color: kingdomColor, fontWeight: 700 }}>
                    {kingdom?.size || 0} territoire{(kingdom?.size||0) > 1 ? 's' : ''} connecté{(kingdom?.size||0) > 1 ? 's' : ''}
                    {(kingdom?.poi_count||0) > 0 && ` · ${kingdom.poi_count} POI`}
                    {` · Tier ${kingdom?.tier || 0}`}
                  </div>
                </div>
              </div>

              {isIsolated && (
                <div style={{
                  padding: '8px 12px', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
                  fontSize: 11, color: '#F87171', lineHeight: 1.5, marginTop: 6,
                }}>
                  ⚠️ Ce territoire est <strong>isolé</strong> — l'arbre des compétences repart à zéro.
                  Connectez-le à votre royaume principal pour partager les compétences.
                </div>
              )}
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#9CA3AF', cursor: 'pointer',
              width: 32, height: 32, fontSize: 18, flexShrink: 0,
            }}>✕</button>
          </div>

          {/* Kingdom resources */}
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries({
              'fer': ['🪨', resources.fer],
              'petrole': ['🛢️', resources.petrole],
              'silicium': ['💠', resources.silicium],
              'donnees': ['📊', resources.donnees],
              'acier': ['⚙️', resources.acier],
              'uranium': ['☢️', resources.uranium],
              'hex_HEX Coin': ['💎', resources.hex_HEX Coin],
              'influence': ['🌐', resources.influence],
            }).filter(([, [, v]]) => (v as number) > 0).map(([k, [icon, val]]) => (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ fontSize: 12 }}>{icon as string}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', fontWeight: 700 }}>
                  {Math.round(val as number)}
                </span>
              </div>
            ))}
          </div>

          {/* Skill progress bar */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginBottom: 4 }}>
              <span>Compétences de ce royaume</span>
              <span style={{ color: kingdomColor, fontWeight: 700 }}>{unlocked} / {totalSkills}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${totalSkills ? (unlocked/totalSkills)*100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', background: kingdomColor, borderRadius: 2 }}
              />
            </div>
          </div>
        </div>

        {/* Branch tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflowX: 'auto',
        }}>
          {Object.entries(BRANCH_CFG).map(([id, bc]) => {
            const branchSkills = tree[id] || []
            const branchUnlocked = branchSkills.filter((s: any) => s.unlocked).length
            return (
              <button key={id} onClick={() => setBranch(id)} style={{
                flex: '0 0 auto', padding: '9px 14px', border: 'none', cursor: 'pointer',
                background: branch === id ? `${bc.color}18` : 'transparent',
                borderBottom: `2px solid ${branch === id ? bc.color : 'transparent'}`,
                color: branch === id ? bc.color : '#4B5563',
                fontSize: 10, fontWeight: branch === id ? 800 : 400, whiteSpace: 'nowrap',
              }}>
                {bc.label.split(' ')[0]}
                <br />
                <span style={{ fontSize: 8 }}>{branchUnlocked}/{branchSkills.length}</span>
              </button>
            )
          })}
        </div>

        {/* Branch header */}
        <div style={{
          padding: '10px 18px 6px', flexShrink: 0,
          background: `linear-gradient(90deg, ${cfg.color}0e, transparent)`,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{cfg.desc}</div>
        </div>

        {/* Skill tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 20 }}>
          {isLoading && <LoadingSpinner />}
          {!isLoading && skills.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#4B5563' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontSize: 13 }}>Aucune compétence disponible</div>
            </div>
          )}

          {/* Visual tree — connected nodes */}
          <div style={{ position: 'relative' }}>
            {skills.map((s: any, i: number) => (
              <div key={s.id} style={{ position: 'relative' }}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    position: 'absolute', left: 27, top: -8, width: 2, height: 16,
                    background: s.unlocked ? cfg.color : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s',
                  }} />
                )}

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 14px', marginBottom: 8, borderRadius: 12,
                    background: s.unlocked ? `${cfg.color}0f` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${s.unlocked ? cfg.color + '44' : 'rgba(255,255,255,0.07)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Node icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: s.unlocked ? `${cfg.color}22` : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${s.unlocked ? cfg.color : 'rgba(255,255,255,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, position: 'relative',
                  }}>
                    {s.icon}
                    {s.unlocked && (
                      <div style={{
                        position: 'absolute', bottom: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: cfg.color, fontSize: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✓</div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: s.unlocked ? '#fff' : '#9CA3AF', marginBottom: 3 }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: s.unlocked ? cfg.color : '#6B7280', marginBottom: 6 }}>
                      {s.effect}
                    </div>

                    {/* Resource costs */}
                    {!s.unlocked && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {s.cost_json.map((c: string) => (
                          <span key={c} style={{
                            fontSize: 9, padding: '2px 7px', borderRadius: 5,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                            color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            {RESOURCE_ICONS[c] && <span>{RESOURCE_ICONS[c]}</span>}
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {!s.unlocked && !isIsolated && (
                      <button
                        onClick={() => unlock.mutate(s.id)}
                        disabled={unlock.isPending}
                        style={{
                          padding: '7px 14px', border: 'none', borderRadius: 8,
                          background: `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color})`,
                          color: '#000', fontSize: 11, fontWeight: 900, cursor: 'pointer',
                          opacity: unlock.isPending ? 0.6 : 1,
                        }}
                      >
                        {unlock.isPending ? '…' : 'Débloquer'}
                      </button>
                    )}

                    {!s.unlocked && isIsolated && (
                      <div style={{ fontSize: 10, color: '#374151', fontStyle: 'italic' }}>
                        🔗 Connectez ce territoire à votre royaume pour débloquer
                      </div>
                    )}
                  </div>

                  {/* Level badge */}
                  {s.unlocked && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: cfg.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#000',
                    }}>
                      {s.level || 1}
                    </div>
                  )}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#8B5CF6', borderRadius: '50%' }}
      />
    </div>
  )
}
