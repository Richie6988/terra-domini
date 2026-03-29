/**
 * StakingView — HEX Power staking interface.
 * Lock HEX → earn multiplier bonuses → better kingdom production.
 * Displayed as a tab inside CryptoPanel.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CrystalIcon } from '../shared/CrystalIcon'
import { STAKE_TIERS, BURN_RATES, type StakeTier } from '../../types/blockchain.types'

interface Props {
  hexBalance: number
  currentStake: { amount: number; tier: StakeTier | null; lockDays: number; unlockDate: string | null } | null
  onStake: (amount: number, lockDays: number) => void
  onUnstake: () => void
}

export function StakingView({ hexBalance, currentStake, onStake, onUnstake }: Props) {
  const [selectedTier, setSelectedTier] = useState<StakeTier>('scout')
  const [amount, setAmount] = useState('')

  const tier = STAKE_TIERS.find(t => t.id === selectedTier)!
  const canStake = parseFloat(amount) >= tier.minHex && parseFloat(amount) <= hexBalance
  const isStaked = currentStake && currentStake.amount > 0
  const currentTierDef = currentStake?.tier ? STAKE_TIERS.find(t => t.id === currentStake.tier) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Current staking position */}
      {isStaked && currentTierDef && (
        <div style={{
          padding: 14, borderRadius: 10,
          background: `linear-gradient(135deg, ${currentTierDef.color}10, ${currentTierDef.color}04)`,
          border: `1.5px solid ${currentTierDef.color}25`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${currentTierDef.color}, ${currentTierDef.color}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: `0 0 15px ${currentTierDef.color}40`,
            }}>
              {currentTierDef.icon}
            </div>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 900, color: currentTierDef.color, letterSpacing: 3,
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}>
                {currentTierDef.name.toUpperCase()} TIER
              </div>
              <div style={{
                fontSize: 8, color: 'rgba(26,42,58,0.5)',
              }}>
                {currentTierDef.bonus}
              </div>
            </div>
            <div style={{
              marginLeft: 'auto', textAlign: 'right',
            }}>
              <div style={{
                fontSize: 16, fontWeight: 900, color: '#7950f2',
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                {currentStake.amount.toLocaleString()} HEX
              </div>
              <div style={{
                fontSize: 8, color: currentTierDef.color, fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
              }}>
                ×{currentTierDef.multiplier} MULTIPLIER
              </div>
            </div>
          </div>

          {/* Unlock date */}
          {currentStake.unlockDate && (
            <div style={{
              fontSize: 7, color: 'rgba(26,42,58,0.4)', textAlign: 'center',
              fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
            }}>
              UNLOCKS: {new Date(currentStake.unlockDate).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Tier selector */}
      <div>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)',
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 8,
        }}>
          {isStaked ? 'UPGRADE TIER' : 'CHOOSE STAKING TIER'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STAKE_TIERS.map(t => (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => setSelectedTier(t.id)}
              style={{
                width: '100%', padding: 10, borderRadius: 10,
                background: selectedTier === t.id ? `${t.color}10` : 'rgba(255,255,255,0.4)',
                border: `1.5px solid ${selectedTier === t.id ? `${t.color}30` : 'rgba(0,60,100,0.08)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 8, fontWeight: 800, color: t.color, letterSpacing: 2,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                }}>
                  {t.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 7, color: 'rgba(26,42,58,0.45)', marginTop: 2 }}>
                  {t.bonus}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 12, fontWeight: 900, color: t.color,
                  fontFamily: "'Share Tech Mono', monospace",
                }}>
                  ×{t.multiplier}
                </div>
                <div style={{
                  fontSize: 6, color: 'rgba(26,42,58,0.35)',
                  fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
                }}>
                  {t.lockDays}D LOCK · MIN {t.minHex} HEX
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Stake amount input */}
      <div>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)',
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 4,
        }}>
          AMOUNT TO STAKE
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Min ${tier.minHex}`}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,60,100,0.12)',
              color: '#1a2a3a', fontSize: 12, outline: 'none',
              fontFamily: "'Share Tech Mono', monospace",
              textTransform: 'none',
            }}
          />
          <button
            onClick={() => setAmount(String(hexBalance))}
            style={{
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(0,60,100,0.06)', border: '1px solid rgba(0,60,100,0.1)',
              color: 'rgba(26,42,58,0.45)', fontSize: 7, fontWeight: 700,
              fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
            }}
          >
            MAX
          </button>
        </div>
        <div style={{
          fontSize: 7, color: 'rgba(26,42,58,0.35)', marginTop: 4,
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          Available: {hexBalance.toLocaleString()} HEX
        </div>
      </div>

      {/* Stake preview */}
      <div style={{
        padding: 12, borderRadius: 10,
        background: 'rgba(121,80,242,0.04)',
        border: '1px solid rgba(121,80,242,0.12)',
      }}>
        <div style={{
          fontSize: 7, fontWeight: 700, letterSpacing: 2, color: 'rgba(26,42,58,0.35)',
          fontFamily: "'Orbitron', system-ui, sans-serif", marginBottom: 6,
        }}>
          STAKING PREVIEW
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', letterSpacing: 1 }}>TIER</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: tier.color }}>{tier.name.toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', letterSpacing: 1 }}>MULTIPLIER</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#7950f2' }}>×{tier.multiplier}</div>
          </div>
          <div>
            <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', letterSpacing: 1 }}>LOCK PERIOD</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#1a2a3a' }}>{tier.lockDays} DAYS</div>
          </div>
          <div>
            <div style={{ fontSize: 6, color: 'rgba(26,42,58,0.3)', letterSpacing: 1 }}>CRYSTAL BOOST</div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#00884a' }}>+{((tier.multiplier - 1) * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={() => canStake && onStake(parseFloat(amount), tier.lockDays)}
        disabled={!canStake}
        style={{
          width: '100%', padding: 14, borderRadius: 20, border: 'none', cursor: canStake ? 'pointer' : 'not-allowed',
          background: canStake
            ? `linear-gradient(90deg, ${tier.color}, ${tier.color}cc)`
            : 'rgba(0,60,100,0.08)',
          color: canStake ? '#fff' : 'rgba(26,42,58,0.3)',
          fontSize: 9, fontWeight: 700, letterSpacing: 3,
          fontFamily: "'Orbitron', system-ui, sans-serif",
          boxShadow: canStake ? `0 4px 15px ${tier.color}30` : 'none',
          opacity: canStake ? 1 : 0.5,
        }}
      >
        {isStaked ? `UPGRADE TO ${tier.name.toUpperCase()}` : `STAKE ${amount || '0'} HEX`}
      </button>

      {/* Burn transparency */}
      <div style={{
        padding: '8px 10px', borderRadius: 8,
        background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)',
        fontSize: 7, color: 'rgba(26,42,58,0.4)', lineHeight: 1.6,
        fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1,
      }}>
        🔥 DAILY BURN RATE: {BURN_RATES.maintenancePerTerritory} HEX/TERRITORY + {BURN_RATES.maintenancePerSkill} HEX/SKILL
        <br />
        STAKING REDUCES OR ELIMINATES MAINTENANCE COSTS
      </div>
    </div>
  )
}
