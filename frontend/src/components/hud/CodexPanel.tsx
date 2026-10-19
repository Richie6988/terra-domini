/**
 * CodexPanel — the token album: one tab per card family (rare places, biomes, resources, creatures, history, events),
 * each a Panini grid of 2D tokens that open in 3D (CodexCards).
 * The old category Overview / Favorites tabs were removed (owner 2026-10-19: "doesn't work, no use any more"); the
 * category icons stay in the icon bank (shared/iconBank, shared/radarIconData) where the tokens pick them.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../shared/GlassPanel'
import { IconSVG } from '../shared/iconBank'
import { Search } from 'lucide-react'
import { CodexCards, type CardFamily } from './CodexCards'

interface Props { onClose: () => void }

const CODEX_TABS: { id: CardFamily; label: string; iconId: string }[] = [
  { id: 'rare',      label: 'Rare cards',  iconId: 'gem' },
  { id: 'biomes',    label: 'Biomes',      iconId: 'globe' },
  { id: 'resources', label: 'Resources',   iconId: 'pickaxe' },
  { id: 'creatures', label: 'Creatures',   iconId: 'dinosaur' },
  { id: 'history',   label: 'History',     iconId: 'history' },
  { id: 'events',    label: 'Events',      iconId: 'trophy' },
]

export function CodexPanel({ onClose }: Props) {
  const [tab, setTab] = useState<CardFamily>('rare')
  const [filter, setFilter] = useState('')

  return (
    <GlassPanel title="ALBUM" onClose={onClose} accent="#7950f2"
      icon={<IconSVG id="museum" size={24} />} subtitle="Collect them all">
      <div className="hx-tabs" role="tablist">
        {CODEX_TABS.map(t => (
          <button key={t.id} role="tab" className="hx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <IconSVG id={t.iconId} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--hx-text-3)' }} />
        <input className="hx-input" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search cards..." aria-label="Search cards" style={{ paddingLeft: 36 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <CodexCards family={tab} filter={filter} />
        </motion.div>
      </AnimatePresence>
    </GlassPanel>
  )
}
