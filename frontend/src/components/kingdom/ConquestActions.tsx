/**
 * ConquestActions — Territory acquisition UI.
 * Shows 3 conquest methods with cost preview.
 * Triggers kingdom creation for first-time claims.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { CrystalIcon } from '../shared/CrystalIcon'
import { useKingdomStore } from '../../store/kingdomStore'
import { useStore, usePlayer } from '../../store'
import { territoryApi } from '../../services/api'
import { EmojiIcon } from '../shared/emojiIcons'
import {
  calculateConquestCost,
  type ConquestMethod, type ConquestCost,
} from '../../types/kingdom.types'

interface Props {
  territory: {
    h3: string
    h3_index?: string
    type?: string
    rarity?: string
    is_landmark?: boolean
    owner_id?: number | null
    owner_username?: string | null
    lat?: number
    lng?: number
    place_name?: string
    landmark_name?: string
  }
  onClaimed?: () => void
}

// ── Kingdom Color Picker ──
const KINGDOM_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669',
  '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#e11d48',
]

// ── Kingdom Creation Wizard ──
function KingdomWizard({ territory, onCreated, onCancel }: {
  territory: Props['territory']
  onCreated: (kingdomId: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(KINGDOM_COLORS[0])
  const createKingdom = useKingdomStore(s => s.createKingdom)

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Kingdom needs a name, Commander'); return }
    if (name.length < 3) { toast.error('Name too short (min 3 chars)'); return }

    const h3 = territory.h3 || territory.h3_index || ''
    const center = { lat: territory.lat ?? 0, lng: territory.lng ?? 0 }
    const kingdom = createKingdom(name.trim(), color, h3, center)
    toast.success(`<EmojiIcon emoji="" /> ${kingdom.name} founded!`)
    onCreated(kingdom.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 16, borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(204,136,0,0.08), rgba(204,136,0,0.02))',
        border: '1.5px solid rgba(204,136,0,0.25)',
      }}
    >
      <div style={{
        fontSize: 9, fontWeight: 900, color: '#cc8800', letterSpacing: 3, marginBottom: 12,
        fontFamily: "'Orbitron', system-ui, sans-serif", textAlign: 'center',
      }}>
        <EmojiIcon emoji="" /> FOUND YOUR KINGDOM
      </div>

      <div style={{
        fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 12, textAlign: 'center',
      }}>
        This territory will become your capital. Name your kingdom and choose its banner color.
      </div>

      {/* Name input */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 4,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          KINGDOM NAME
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Empire of the Sun"
          maxLength={32}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
            fontFamily: "'Share Tech Mono', monospace",
            textTransform: 'none', letterSpacing: 0,
          }}
        />
      </div>

      {/* Color picker */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 6,
          fontFamily: "'Orbitron', system-ui, sans-serif",
        }}>
          BANNER COLOR
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {KINGDOM_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: c, border: color === c ? '3px solid #1a2a3a' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: color === c ? `0 0 12px ${c}50` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCreate}
          style={{
            flex: 1, padding: '10px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(90deg, #cc8800, #d97706)',
            color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            boxShadow: '0 4px 15px rgba(204,136,0,0.3)',
          }}
        >
          <EmojiIcon emoji="" /> FOUND KINGDOM
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px', borderRadius: 20, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.35)', fontSize: 8, fontWeight: 500,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}
        >
          CANCEL
        </button>
      </div>
    </motion.div>
  )
}

// ── Conquest Method Card ──
function MethodCard({ method, cost, onSelect, disabled }: {
  method: { id: ConquestMethod; name: string; icon: string; color: string; desc: string }
  cost: ConquestCost
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -2, scale: 1.01 } : {}}
      onClick={onSelect}
      disabled={disabled}
      style={{
        width: '100%', padding: 12, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.03)' : `linear-gradient(135deg, ${method.color}08, transparent)`,
        border: `1.5px solid ${disabled ? 'rgba(255,255,255,0.06)' : `${method.color}25`}`,
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}><EmojiIcon emoji={method.icon} size={16} /></span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 8, fontWeight: 900, color: method.color, letterSpacing: 2,
            fontFamily: "'Orbitron', system-ui, sans-serif",
          }}>
            {method.name}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {method.desc}
          </div>
        </div>
      </div>

      {/* Cost details */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <CostPill label="COST" value={`${cost.baseCost.toLocaleString()} ◆`} color="#7950f2" />
        {cost.successChance !== undefined && (
          <CostPill label="SUCCESS" value={`${Math.floor(cost.successChance * 100)}%`} color={cost.successChance > 0.6 ? '#00884a' : '#cc8800'} />
        )}
        <CostPill label="TIME" value={cost.duration < 60 ? 'Instant' : `${Math.ceil(cost.duration / 60)}min`} color="#0099cc" />
        {cost.influenceRequired > 0 && (
          <CostPill label="INFLUENCE" value={`${cost.influenceRequired}+`} color="#059669" />
        )}
      </div>
    </motion.button>
  )
}

function CostPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '3px 8px', borderRadius: 12,
      background: `${color}10`, border: `1px solid ${color}20`,
      fontSize: 6, fontWeight: 700, letterSpacing: 1,
      fontFamily: "'Share Tech Mono', monospace",
      display: 'flex', gap: 4, alignItems: 'center',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

// ── Main ConquestActions ──
export function ConquestActions({ territory, onClaimed }: Props) {
  const [mode, setMode] = useState<'methods' | 'wizard' | 'confirm'>('methods')
  const [selectedMethod, setSelectedMethod] = useState<ConquestMethod | null>(null)
  const [loading, setLoading] = useState(false)
  const player = usePlayer()
  const setSelectedTerritory = useStore(s => s.setSelectedTerritory)
  const { kingdoms, addTerritoryToKingdom } = useKingdomStore()

  const isUnclaimed = !territory.owner_id
  const isEnemy = territory.owner_id && String(territory.owner_id) !== String(player?.id)

  // Check if territory is adjacent to any of player's kingdoms
  // Simplified: for now always treat as non-adjacent (real impl needs H3 neighbors)
  const adjacent = false // TODO: H3 kRing check
  const rarity = territory.rarity ?? 'common'
  const isLandmark = territory.is_landmark ?? false

  const methods: { id: ConquestMethod; name: string; icon: string; color: string; desc: string }[] = [
    { id: 'purchase', name: 'PURCHASE', icon: 'money_bag', color: '#d97706', desc: isUnclaimed ? 'Claim with HEX. 100% success.' : 'Buy out the owner.' },
    { id: 'assault', name: 'ASSAULT', icon: 'swords', color: '#dc2626', desc: 'Military attack. Costs resources.' },
    { id: 'infiltration', name: 'INFILTRATE', icon: 'spy', color: '#059669', desc: 'Covert takeover with spies & data.' },
  ]

  const costs = methods.reduce((acc, m) => {
    acc[m.id] = calculateConquestCost(m.id, adjacent, rarity, isLandmark)
    return acc
  }, {} as Record<ConquestMethod, ConquestCost>)

  const handleSelectMethod = (method: ConquestMethod) => {
    setSelectedMethod(method)
    // If no kingdoms exist yet, trigger wizard
    if (kingdoms.length === 0 && (method === 'purchase' || isUnclaimed)) {
      setMode('wizard')
    } else {
      setMode('confirm')
    }
  }

  const handleExecuteConquest = async () => {
    if (!selectedMethod) return
    setLoading(true)
    try {
      // Call backend API
      if (selectedMethod === 'purchase' && isUnclaimed) {
        await territoryApi.claim(territory.h3 || territory.h3_index || '')
      } else {
        // For attack/infiltration, would call combat API
        await territoryApi.claim(territory.h3 || territory.h3_index || '')
      }

      // Add to kingdom
      if (kingdoms.length > 0) {
        const targetKingdom = kingdoms[0] // TODO: let user choose
        addTerritoryToKingdom(targetKingdom.id, territory.h3 || territory.h3_index || '')
      }

      toast.success('Territory conquered! <EmojiIcon emoji="" />')
      setSelectedTerritory({
        ...territory,
        owner_id: player?.id ?? null,
        owner_username: player?.username ?? null,
      } as any)
      onClaimed?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Conquest failed')
    } finally {
      setLoading(false)
      setMode('methods')
    }
  }

  const handleKingdomCreated = (kingdomId: string) => {
    // Kingdom was just created with this territory as capital
    // Execute the claim
    handleExecuteConquest()
  }

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Adjacency indicator */}
      <div style={{
        padding: '6px 10px', borderRadius: 8,
        background: adjacent ? 'rgba(0,136,74,0.06)' : 'rgba(204,136,0,0.06)',
        border: `1px solid ${adjacent ? 'rgba(0,136,74,0.15)' : 'rgba(204,136,0,0.15)'}`,
        fontSize: 7, letterSpacing: 1,
        color: adjacent ? '#00884a' : '#cc8800',
        fontFamily: "'Orbitron', system-ui, sans-serif",
      }}>
        {adjacent ? ' ADJACENT — REDUCED COST' : ' NON-ADJACENT — HIGHER COST (×3.5)'}
      </div>

      <AnimatePresence mode="wait">
        {/* Method selection */}
        {mode === 'methods' && (
          <motion.div
            key="methods"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <div style={{
              fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)',
              fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 2,
            }}>
              {isUnclaimed ? 'CLAIM METHOD' : 'CONQUEST METHOD'}
            </div>
            {methods.map(m => (
              <MethodCard
                key={m.id}
                method={m}
                cost={costs[m.id]}
                onSelect={() => handleSelectMethod(m.id)}
                disabled={m.id === 'assault' && isUnclaimed}
              />
            ))}
          </motion.div>
        )}

        {/* Kingdom creation wizard */}
        {mode === 'wizard' && (
          <KingdomWizard
            territory={territory}
            onCreated={handleKingdomCreated}
            onCancel={() => setMode('methods')}
          />
        )}

        {/* Confirmation */}
        {mode === 'confirm' && selectedMethod && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: 14, borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{
              fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 8,
              color: methods.find(m => m.id === selectedMethod)?.color,
              fontFamily: "'Orbitron', system-ui, sans-serif", textAlign: 'center',
            }}>
              {methods.find(m => m.id === selectedMethod)?.icon} CONFIRM {methods.find(m => m.id === selectedMethod)?.name}
            </div>

            {/* Cost summary */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>COST</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#7950f2', fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <CrystalIcon size="sm" /> {costs[selectedMethod].baseCost.toLocaleString()}
                </div>
              </div>
              {costs[selectedMethod].successChance !== undefined && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, fontFamily: "'Orbitron', system-ui, sans-serif" }}>SUCCESS</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: costs[selectedMethod].successChance! > 0.6 ? '#00884a' : '#dc2626', fontFamily: "'Share Tech Mono', monospace" }}>
                    {Math.floor(costs[selectedMethod].successChance! * 100)}%
                  </div>
                </div>
              )}
            </div>

            {/* Kingdom target */}
            {kingdoms.length > 0 && (
              <div style={{
                padding: '6px 10px', borderRadius: 8, marginBottom: 10,
                background: `${kingdoms[0].color}08`, border: `1px solid ${kingdoms[0].color}20`,
                fontSize: 8, color: kingdoms[0].color, textAlign: 'center',
                fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
              }}>
                ADD TO: <EmojiIcon emoji="" /> {kingdoms[0].name.toUpperCase()}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleExecuteConquest}
                disabled={loading}
                style={{
                  flex: 1, padding: '10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: methods.find(m => m.id === selectedMethod)?.color,
                  color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'EXECUTING…' : 'EXECUTE'}
              </button>
              <button
                onClick={() => setMode('methods')}
                style={{
                  padding: '10px 16px', borderRadius: 20, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.35)', fontSize: 8,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                }}
              >
                BACK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
