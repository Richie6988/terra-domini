/**
 * ResourcesPanel — GDD Section 5 — 19 ressources Hexod
 * Shown in top-left player profile area
 */
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

const RESOURCES = [
  { key:'res_fer',         label:'Fer',           icon:'🪨', cat:'physique' },
  { key:'res_cuivre',      label:'Cuivre',        icon:'🔶', cat:'physique' },
  { key:'res_aluminium',   label:'Aluminium',     icon:'⬜', cat:'physique' },
  { key:'res_acier',       label:'Acier',         icon:'⚙️',  cat:'physique' },
  { key:'res_titanium',    label:'Titanium',      icon:'🔷', cat:'physique' },
  { key:'res_petrole',     label:'Pétrole',       icon:'🛢️',  cat:'energie'  },
  { key:'res_gaz',         label:'Gaz naturel',   icon:'💨', cat:'energie'  },
  { key:'res_charbon',     label:'Charbon',       icon:'⬛', cat:'energie'  },
  { key:'res_uranium',     label:'Uranium',       icon:'☢️',  cat:'energie'  },
  { key:'res_silicium',    label:'Silicium',      icon:'💠', cat:'tech'     },
  { key:'res_terres_rares',label:'Terres rares',  icon:'💎', cat:'tech'     },
  { key:'res_composants',  label:'Composants',    icon:'🔌', cat:'tech'     },
  { key:'res_donnees',     label:'Données',       icon:'📊', cat:'info'     },
  { key:'res_main_oeuvre', label:'Main d\'œuvre', icon:'👷', cat:'info'     },
  { key:'res_nourriture',  label:'Nourriture',    icon:'🌾', cat:'vital'    },
  { key:'res_eau',         label:'Eau',           icon:'💧', cat:'vital'    },
  { key:'res_influence',   label:'Influence',     icon:'🌐', cat:'info'     },
  { key:'res_stabilite',   label:'Stabilité',     icon:'⚖️',  cat:'info'     },
  { key:'res_hex_cristaux',label:'Cristaux HEX',  icon:'💠', cat:'hex'      },
]

const CAT_COLOR: Record<string,string> = {
  physique:'#6B7280', energie:'#F59E0B', tech:'#8B5CF6',
  info:'#3B82F6', vital:'#10B981', hex:'#EC4899',
}

export function ResourcesPanel({ onClose }: { onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['player-resources'],
    queryFn: () => api.get('/territories-geo/mine/').then(r => {
      const territories = r.data.territories || []
      // Sum resources across all owned territories
      const totals: Record<string,number> = {}
      RESOURCES.forEach(r => { totals[r.key] = 0 })
      territories.forEach((t: any) => {
        RESOURCES.forEach(res => {
          totals[res.key] = (totals[res.key] || 0) + parseFloat(t[res.key] || 0)
        })
      })
      return totals
    }),
    staleTime: 30000,
  })

  const byCategory: Record<string, typeof RESOURCES> = {}
  RESOURCES.forEach(r => {
    byCategory[r.cat] = byCategory[r.cat] || []
    byCategory[r.cat].push(r)
  })

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      style={{
        position: 'fixed', top: 60, left: 8, bottom: 80, width: 220, zIndex: 900,
        background: 'rgba(4,4,12,0.98)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>📦 Ressources</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          color: '#6B7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {Object.entries(byCategory).map(([cat, resources]) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: CAT_COLOR[cat], fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, paddingLeft: 2 }}>
              {cat === 'physique' ? 'Physique' : cat === 'energie' ? 'Énergie' :
               cat === 'tech' ? 'Tech' : cat === 'info' ? 'Informationnel' :
               cat === 'vital' ? 'Vital' : 'Cristaux HEX'}
            </div>
            {resources.map(r => (
              <div key={r.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 7, marginBottom: 2,
                background: 'rgba(255,255,255,0.03)',
              }}>
                <span style={{ fontSize: 14 }}>{r.icon}</span>
                <span style={{ flex: 1, fontSize: 11, color: '#9CA3AF' }}>{r.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                  color: CAT_COLOR[r.cat] }}>
                  {(data?.[r.key] || 0).toFixed(r.key === 'res_hex_cristaux' ? 2 : 0)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
