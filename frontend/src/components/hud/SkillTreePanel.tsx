/**
 * SkillTreePanel — GDD Section 6 — Arbre de compétences Hexod
 * 5 branches: Attaque · Défense · Économie · Rayonnement · Technologie
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

const BRANCH_CONFIG = {
  attack:    { label:'⚔️ Attaque',     color:'#EF4444', bg:'#1a0505' },
  defense:   { label:'🛡️ Défense',     color:'#3B82F6', bg:'#03081a' },
  economy:   { label:'💰 Économie',    color:'#F59E0B', bg:'#150a00' },
  influence: { label:'🌐 Rayonnement', color:'#10B981', bg:'#041509' },
  tech:      { label:'🔬 Technologies',color:'#8B5CF6', bg:'#07030f' },
}

interface SkillNode {
  id: number; branch: string; name: string; effect: string
  cost_json: string[]; position: number; icon: string; unlocked: boolean
}

export function SkillTreePanel({ onClose }: { onClose: () => void }) {
  const [branch, setBranch] = useState<string>('attack')
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => api.get('/progression/skills/').then(r => r.data),
  })

  const unlock = useMutation({
    mutationFn: (id: number) => api.post(`/progression/skills/${id}/unlock/`),
    onSuccess: (_, id) => {
      toast.success('Compétence débloquée !')
      qc.invalidateQueries({ queryKey: ['skill-tree'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const tree: Record<string, SkillNode[]> = data?.tree || {}
  const cfg = BRANCH_CONFIG[branch as keyof typeof BRANCH_CONFIG]
  const skills = tree[branch] || []

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      style={{
        position: 'fixed', bottom: 65, left: 0, right: 0, zIndex: 850,
        background: 'rgba(4,4,12,0.99)', backdropFilter: 'blur(18px)',
        borderTop: `2px solid ${cfg.color}44`,
        borderRadius: '16px 16px 0 0',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: `linear-gradient(90deg, ${cfg.color}18, transparent)`,
        flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2a3a' }}>🔬 Arbre de Compétences</div>
          <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginTop: 2 }}>
            {data?.unlocked_count || 0} compétences débloquées
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(0,60,100,0.1)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: 'rgba(26,42,58,0.6)', cursor: 'pointer', width: 32, height: 32, fontSize: 16 }}>✕</button>
      </div>

      {/* Branch tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)',
        overflow: 'auto', flexShrink: 0 }}>
        {Object.entries(BRANCH_CONFIG).map(([id, bc]) => (
          <button key={id} onClick={() => setBranch(id)} style={{
            flex: '0 0 auto', padding: '10px 14px', border: 'none', cursor: 'pointer',
            background: branch === id ? `${bc.color}18` : 'transparent',
            borderBottom: `2px solid ${branch === id ? bc.color : 'transparent'}`,
            color: branch === id ? bc.color : '#4B5563',
            fontSize: 11, fontWeight: branch === id ? 700 : 400,
            whiteSpace: 'nowrap',
          }}>{bc.label}</button>
        ))}
      </div>

      {/* Skill nodes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {skills.map((s, i) => (
            <SkillCard key={s.id} skill={s} color={cfg.color}
              onUnlock={() => unlock.mutate(s.id)}
              isUnlocking={unlock.isPending} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function SkillCard({ skill: s, color, onUnlock, isUnlocking }:{
  skill: SkillNode; color: string; onUnlock: () => void; isUnlocking: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      style={{
        background: s.unlocked ? `${color}12` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${s.unlocked ? color + '44' : 'rgba(0,60,100,0.1)'}`,
        borderRadius: 12, overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start',
        cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: s.unlocked ? color + '22' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${s.unlocked ? color + '55' : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {s.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700,
            color: s.unlocked ? '#fff' : '#9CA3AF' }}>{s.name}</div>
          <div style={{ fontSize: 11, color: s.unlocked ? color : '#6B7280', marginTop: 2 }}>
            {s.effect}
          </div>
        </div>

        {/* Status */}
        <div style={{ flexShrink: 0 }}>
          {s.unlocked
            ? <span style={{ fontSize: 18 }}>✅</span>
            : <span style={{ fontSize: 12, color: 'rgba(26,42,58,0.25)' }}>🔒</span>
          }
        </div>
      </div>

      {/* Expanded: costs + unlock */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coût de débloquage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {s.cost_json.map(c => (
                  <span key={c} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.1)',
                    color: 'rgba(26,42,58,0.6)' }}>{c}</span>
                ))}
              </div>
              {!s.unlocked && (
                <button onClick={e => { e.stopPropagation(); onUnlock() }}
                  disabled={isUnlocking}
                  style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 8,
                    background: `linear-gradient(135deg, ${color}cc, ${color})`,
                    color: '#000', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  {isUnlocking ? '…' : `Débloquer — ${s.name}`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
