/**
 * CampaignWidget — Campagnes narratives J1→J7
 * Affiché dans ProfilePanel onglet "Campagnes"
 * 7 étapes avec déblocages progressifs et récompenses
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../services/api'
import { SkeletonList } from '../ui/Utils'
import toast from 'react-hot-toast'

export function CampaignWidget() {
  const [expanded, setExpanded] = useState<number>(0)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/progression/campaigns/').then(r => r.data),
    staleTime: 30000,
  })

  const checkMut = useMutation({
    mutationFn: () => api.post('/progression/campaigns/check/'),
    onSuccess: (res) => {
      if (res.data.advanced) {
        toast.success(`🎯 ${res.data.reward || 'Étape complétée !'}`, { duration: 4000 })
        qc.invalidateQueries({ queryKey: ['campaigns'] })
        qc.invalidateQueries({ queryKey: ['player'] })
      } else {
        toast('Continue — objectif en cours', { icon: '⏳' })
      }
    },
  })

  const campaigns: any[] = data?.campaigns || []

  if (isLoading) return <SkeletonList count={3} />

  return (
    <div>
      {campaigns.map((camp: any) => (
        <CampaignCard
          key={camp.campaign_id}
          campaign={camp}
          expanded={expanded === camp.campaign_id}
          onToggle={() => setExpanded(e => e === camp.campaign_id ? -1 : camp.campaign_id)}
          onCheck={() => checkMut.mutate()}
          checking={checkMut.isPending}
        />
      ))}
    </div>
  )
}

function CampaignCard({ campaign, expanded, onToggle, onCheck, checking }: any) {
  const pct = campaign.total_steps > 0
    ? (campaign.current_step / campaign.total_steps) * 100 : 0
  const isLocked = !campaign.is_unlocked

  return (
    <div style={{
      marginBottom: 10, borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${campaign.completed ? 'rgba(16,185,129,0.3)' : isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
      opacity: isLocked ? 0.5 : 1,
    }}>
      {/* Header */}
      <button
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
        style={{
          width: '100%', padding: '12px 14px', textAlign: 'left',
          background: campaign.completed ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
          border: 'none', cursor: isLocked ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {campaign.completed ? '✅' : isLocked ? '🔒' : '🗺️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{campaign.name}</div>
          <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{campaign.description}</div>
          {/* Barre de progression */}
          {!isLocked && (
            <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
                style={{ height: '100%', background: campaign.completed ? '#10B981' : '#3B82F6', borderRadius: 2 }}
              />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: campaign.completed ? '#10B981' : '#6B7280', fontWeight: 700 }}>
            {campaign.current_step}/{campaign.total_steps}
          </div>
          {!isLocked && <div style={{ fontSize: 16, color: '#374151', marginTop: 2 }}>{expanded ? '▲' : '▼'}</div>}
        </div>
      </button>

      {/* Étapes détaillées */}
      <AnimatePresence>
        {expanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 14px 12px' }}>
              {(campaign.steps || []).map((step: any, i: number) => {
                const isDone = step.done
                const isCurrent = i === campaign.current_step
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '8px 0',
                    borderBottom: i < campaign.steps.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    opacity: isDone ? 0.5 : 1,
                  }}>
                    {/* Indicateur */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: isDone ? 'rgba(16,185,129,0.2)' : isCurrent ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isDone ? '#10B981' : isCurrent ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isDone ? 14 : 12,
                      color: isDone ? '#10B981' : isCurrent ? '#3B82F6' : '#4B5563',
                      fontWeight: 800,
                    }}>
                      {isDone ? '✓' : step.icon || String(i + 1)}
                    </div>

                    {/* Contenu */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 12, fontWeight: isCurrent ? 800 : 600,
                        color: isDone ? '#6B7280' : isCurrent ? '#fff' : '#9CA3AF',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{step.desc}</div>
                      {isCurrent && (
                        <div style={{
                          marginTop: 5, fontSize: 10, color: '#F59E0B',
                          padding: '4px 8px', background: 'rgba(245,158,11,0.08)',
                          borderRadius: 6, borderLeft: '2px solid #F59E0B',
                        }}>
                          🎁 Récompense : {step.reward_label}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Bouton vérifier progression */}
              {!campaign.completed && (
                <button
                  onClick={onCheck}
                  disabled={checking}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px',
                    background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 9, color: '#60A5FA',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    opacity: checking ? 0.6 : 1,
                  }}
                >
                  {checking ? '⏳ Vérification…' : '🔍 Vérifier ma progression'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
