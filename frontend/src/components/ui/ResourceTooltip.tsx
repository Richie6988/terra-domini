/**
 * ResourceTooltip — Marie spec
 * Tooltip "à quoi ça sert" pour chaque ressource au premier hover.
 * Icône SVG + couleur + description courte + usage principal.
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EmojiIcon } from '../shared/emojiIcons'

export const RESOURCE_INFO: Record<string, {
  icon: string; color: string; label: string
  desc: string; usedFor: string; biomes: string[]
}> = {
  res_fer:         { icon: 'gear', color: '#A8A29E', label: 'Fer',          desc: 'Minerai de base pour la construction.', usedFor: 'Fortifications, Mines, Builds défensifs', biomes: ['mountain'] },
  res_acier:       { icon: 'bolt', color: '#78716C', label: 'Acier',        desc: 'Fer transformé, plus résistant.', usedFor: 'Bunkers, Réacteurs, Attaque mécanisée', biomes: ['industrial'] },
  res_titanium:    { icon: 'diamond_blue', color: '#93C5FD', label: 'Titanium',     desc: 'Métal rare ultra-résistant.', usedFor: 'Builds haute tech, Skill Bastion imprenable', biomes: ['mountain'] },
  res_petrole:     { icon: 'oil_barrel', color: '#F59E0B', label: 'Pétrole',      desc: 'Énergie fossile stratégique.', usedFor: 'Skill Attaque, Raffineries, Transport', biomes: ['desert'] },
  res_gaz:         { icon: 'wind', color: '#BAE6FD', label: 'Gaz naturel',  desc: 'Énergie propre mais volatile.', usedFor: 'Énergie, Reacteur (combo uranium)', biomes: ['coastal','tundra'] },
  res_uranium:     { icon: 'nuclear', color: '#4ADE80', label: 'Uranium',      desc: 'Énergie nucléaire — ressource rare.', usedFor: 'Réacteur nucléaire × 5 production, Skill Bastion', biomes: ['tundra'] },
  res_charbon:     { icon: '⬛', color: '#57534E', label: 'Charbon',      desc: 'Énergie thermique obsolète mais abondante.', usedFor: 'Énergie de base, Transition industrielle', biomes: ['mountain'] },
  res_silicium:    { icon: 'diamond_blossom', color: '#818CF8', label: 'Silicium',     desc: 'Base de l\'électronique moderne.', usedFor: 'Composants, Centre de données, Skill Tech', biomes: ['desert'] },
  res_terres_rares:{ icon: 'gem', color: '#EC4899', label: 'Terres rares', desc: 'Minerais critiques pour la haute technologie.', usedFor: 'IA, Quantum, Skill Frappe à distance', biomes: ['desert'] },
  res_lithium:     { icon: 'battery', color: '#A78BFA', label: 'Lithium',      desc: 'Batterie du futur.', usedFor: 'Port spatial, Skill Nanotechnologie', biomes: ['tundra'] },
  res_cobalt:      { icon: 'dot_blue', color: '#3B82F6', label: 'Cobalt',       desc: 'Alliage pour batteries haute densité.', usedFor: 'Batteries avancées (combo lithium)', biomes: ['mountain'] },
  res_or:          { icon: '', color: '#FFD700', label: 'Or',           desc: 'Valeur refuge, liquidités mondiales.', usedFor: 'Routes commerciales, Monopole ressource, Skill Économie', biomes: ['mountain','desert'] },
  res_aluminium:   { icon: 'hex_coin', color: '#D1D5DB', label: 'Aluminium',    desc: 'Léger, conducteur, polyvalent.', usedFor: 'Constructions légères, Port spatial', biomes: ['industrial'] },
  res_composants:  { icon: 'plug', color: '#8B5CF6', label: 'Composants',   desc: 'Pièces électroniques assemblées.', usedFor: 'Centre de données, Skill IA, Cyberguerre', biomes: ['industrial','coastal'] },
  res_donnees:     { icon: 'chart_bar', color: '#60A5FA', label: 'Données',      desc: 'Information = pouvoir au XXIe siècle.', usedFor: 'Skill Tech, Influence, Infiltration, Vision carte', biomes: ['urban','landmark'] },
  res_influence:   { icon: 'grid_globe', color: '#C084FC', label: 'Influence',    desc: 'Capacité à convaincre, à rayonner.', usedFor: 'Skill Influence, Blocus, Soft power, Alliances', biomes: ['urban','landmark'] },
  res_main_oeuvre: { icon: 'worker', color: '#FCD34D', label: 'Main-d\'œuvre',desc: 'Population active de ton territoire.', usedFor: 'Fermes, Mines, Accélération builds', biomes: ['urban','rural'] },
  res_nourriture:  { icon: 'wheat', color: '#86EFAC', label: 'Nourriture',   desc: 'Nourrir la population = stabilité sociale.', usedFor: 'Résistance prolongée, Population, Croissance', biomes: ['rural','forest','coastal'] },
  res_eau:         { icon: 'water_drop', color: '#38BDF8', label: 'Eau',          desc: 'Ressource vitale et stratégique.', usedFor: 'Fermes, Réacteur (refroidissement), Stabilité', biomes: ['coastal','forest','rural'] },
  res_stabilite:   { icon: '', color: '#6EE7B7', label: 'Stabilité',   desc: 'Cohésion sociale de ton empire.', usedFor: 'Résistance défensive, Skill Influence, Expansion', biomes: ['forest','rural','landmark'] },
  res_hex_cristaux:{ icon: '⬡',  color: '#0099cc', label: 'HEX Cristaux', desc: 'La monnaie interne du jeu.', usedFor: 'Tous les builds, Skills, Marketplace', biomes: ['all'] },
}

interface Props {
  resource: string
  value?: number
  showValue?: boolean
  style?: React.CSSProperties
}

export function ResourceBadge({ resource, value, showValue = true, style }: Props) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const info = RESOURCE_INFO[resource]
  if (!info) return null

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help', ...style }}
      onMouseEnter={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 300) }}
      onMouseLeave={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 150) }}
      onTouchStart={() => setOpen(o => !o)}
    >
      <span style={{ fontSize: 14 }}><EmojiIcon emoji={info.icon} size={16} /></span>
      {showValue && value !== undefined && (
        <span style={{ fontSize: 11, color: info.color, fontFamily: 'monospace', fontWeight: 700 }}>
          {value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)}
        </span>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', bottom: '100%', left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 8, zIndex: 9999,
              width: 220,
              background: 'rgba(4,4,16,0.98)',
              border: `1px solid ${info.color}44`,
              borderRadius: 12, padding: '10px 12px',
              boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 16px ${info.color}22`,
              pointerEvents: 'none',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderTop: `6px solid ${info.color}44`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}><EmojiIcon emoji={info.icon} size={16} /></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: info.color }}>{info.label}</div>
                <div style={{ fontSize: 10, color: '#4B5563' }}>
                  {info.biomes[0] === 'all' ? 'Tous biomes' : info.biomes.join(', ')}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, lineHeight: 1.5 }}>
              {info.desc}
            </div>
            <div style={{
              fontSize: 10, color: info.color, padding: '5px 8px',
              background: `${info.color}12`, borderRadius: 6,
              borderLeft: `2px solid ${info.color}66`,
            }}>
              <span style={{ color: '#4B5563', marginRight: 4 }}>Utilisé pour :</span>
              {info.usedFor}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Affiche une grille compacte des ressources d'un territoire */
export function ResourceGrid({ resources, compact = false }: {
  resources: Record<string, number>; compact?: boolean
}) {
  const entries = Object.entries(resources)
    .filter(([k, v]) => k.startsWith('res_') && v > 0)
    .sort(([,a],[,b]) => b - a)

  if (!entries.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 6 : 8 }}>
      {entries.map(([k, v]) => (
        <ResourceBadge key={k} resource={k} value={v} />
      ))}
    </div>
  )
}
