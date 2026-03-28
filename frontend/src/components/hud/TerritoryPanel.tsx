/**
 * TerritoryPanel — slides in from right on territory click.
 * Shows detail, actions (claim/attack/build), resource production.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sword, Shield, Hammer, TrendingUp, Eye, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore, useSelectedTerritory, usePlayer } from '../../store'
import { territoryApi, combatApi } from '../../services/api'
import { GlassPanel } from '../shared/GlassPanel'
import type { UnitType } from '../../types'

const RESOURCE_ICONS: Record<string, string> = {
  energy: '⚡', food: '🌾', credits: '💰', culture: '🎭', materials: '⚙️', intel: '🔍'
}
const DEFENSE_TIER_NAMES: Record<number, string> = {
  1: 'Outpost', 2: 'Fort', 3: 'Citadel', 4: 'Fortress', 5: 'Stronghold'
}
const BUILDING_ICONS: Record<string, string> = {
  farm: '🌾', mine: '⛏️', power_plant: '⚡', factory: '🏭', market: '🏪',
  barracks: '🏛️', radar: '📡', ad_billboard: '📢', culture_center: '🎭',
}
const UNIT_TYPES: UnitType[] = ['infantry', 'cavalry', 'artillery', 'air', 'naval']
const UNIT_ICONS: Record<UnitType, string> = {
  infantry: '⚔️', cavalry: '🐴', artillery: '💣', air: '✈️', naval: '⚓'
}
const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,60,100,0.12)',
  borderRadius: 6, color: 'rgba(26,42,58,0.6)', cursor: 'pointer',
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '12px', marginTop: 4,
  background: '#0099cc', border: 'none', borderRadius: 8,
  color: '#1a2a3a', fontSize: 14, fontWeight: 500, cursor: 'pointer',
}
const tagBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid',
  fontSize: 12, cursor: 'pointer', fontWeight: 500,
}
const numInput: React.CSSProperties = {
  width: 72, padding: '5px 8px',
  background: 'rgba(0,60,100,0.1)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: '#1a2a3a', fontSize: 13, textAlign: 'center',
}






export function TerritoryPanel() {
  const territory = useSelectedTerritory()
  const player = usePlayer()
  const setSelectedTerritory = useStore((s) => s.setSelectedTerritory)
  const addBattle = useStore((s) => s.addBattle)

  const [tab, setTab] = useState<'info' | 'attack' | 'build'>('info')
  const [attackUnits, setAttackUnits] = useState<Partial<Record<UnitType, number>>>({})
  const [attackType, setAttackType] = useState<'conquest' | 'raid' | 'surprise'>('conquest')
  const [buildingType, setBuildingType] = useState('')
  const [loading, setLoading] = useState(false)

  if (!territory) return null

  const isOwned = territory.owner_id === player?.id
  const isEnemy = territory.owner_id && territory.owner_id !== player?.id
  const isUnclaimed = !territory.owner_id

  const handleClaim = async () => {
    setLoading(true)
    try {
      await territoryApi.claim(territory.h3)
      toast.success('Territory claimed! 🏴')
      setSelectedTerritory({ ...territory, owner_id: player?.id ?? null, owner_username: player?.username ?? null })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Claim failed')
    } finally { setLoading(false) }
  }

  const handleAttack = async () => {
    if (Object.keys(attackUnits).length === 0) {
      toast.error('Select units to deploy')
      return
    }
    setLoading(true)
    try {
      const result = await combatApi.attack(territory.h3, attackUnits as Record<string, number>, attackType)
      toast.success(`⚔️ Attack launched! Resolves ${new Date(result.resolves_at).toLocaleTimeString()}`)
      // Battle will come via WebSocket
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Attack failed')
    } finally { setLoading(false) }
  }

  const handleBuild = async () => {
    if (!buildingType) { toast.error('Select a building'); return }
    setLoading(true)
    try {
      await territoryApi.build(territory.h3, buildingType)
      toast.success(`🏗️ Construction started!`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Build failed')
    } finally { setLoading(false) }
  }

  const production = territory.production_rates ?? {}
  const stockpile = territory.stockpile ?? {}

  const territoryTitle = territory.landmark_name || territory.place_name || (territory.h3 || territory.h3_index || '').slice(0, 10)

  return (
    <GlassPanel
      title={territoryTitle.toUpperCase()}
      onClose={() => setSelectedTerritory(null)}
      accent={getTerritoryTypeColor(territory.type)}
      width={360}
    >
        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Tag color={getTerritoryTypeColor(territory.type)}>{territory.type}</Tag>
          {territory.is_control_tower && <Tag color="#8b5cf6">CONTROL TOWER</Tag>}
          {territory.is_landmark && <Tag color="#cc8800">LANDMARK</Tag>}
          {territory.is_under_attack && <Tag color="#dc2626">⚔ UNDER ATTACK</Tag>}
          {territory.owner?.is_protected && <Tag color="#00884a">🛡 PROTECTED</Tag>}
        </div>

          {/* Owner */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {isOwned ? (
              <span style={{ color: '#10B981', fontSize: 13 }}>✓ Your territory</span>
            ) : isUnclaimed ? (
              <span style={{ color: 'rgba(26,42,58,0.45)', fontSize: 13 }}>Unclaimed</span>
            ) : (
              <span style={{ color: '#F87171', fontSize: 13 }}>
                {territory.alliance_tag ? `[${territory.alliance_tag}] ` : ''}{territory.owner_username}
              </span>
            )}
            <span style={{ color: 'rgba(26,42,58,0.35)', fontSize: 12 }}>
              {territory.country_code ? `• ${territory.country_code.toUpperCase()}` : ''}
            </span>
          </div>

          {/* Defense bar */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(26,42,58,0.6)', marginBottom: 4 }}>
              <span>Defense: {DEFENSE_TIER_NAMES[territory.defense_tier ?? 1]}</span>
              <span>{territory.defense_points?.toFixed(0)} / {territory.max_defense_points}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(0,60,100,0.12)', borderRadius: 2 }}>
              <div style={{
                height: '100%',
                width: `${((territory.defense_points ?? 0) / (territory.max_defense_points || 1)) * 100}%`,
                background: '#10B981',
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,60,100,0.1)' }}>
          {(['info', isOwned ? 'build' : null, territory.can_be_attacked ? 'attack' : null] as const)
            .filter(Boolean)
            .map(t => (
              <button key={t} onClick={() => setTab(t!)} style={{
                flex: 1, padding: '10px 0', fontSize: 12,
                color: tab === t ? '#fff' : '#6B7280',
                background: 'transparent', border: 'none',
                borderBottom: tab === t ? '2px solid #10B981' : '2px solid transparent',
                cursor: 'pointer', fontWeight: tab === t ? 500 : 400,
              }}>
                {t === 'info' ? 'Info' : t === 'attack' ? '⚔️ Attack' : '🔨 Build'}
              </button>
            ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── INFO TAB ──────────────────────────────────────────────────── */}
          {tab === 'info' && (
            <div>
              {/* Resources */}
              <SectionTitle icon={<TrendingUp size={13} />} title="Production (per 5 min)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                {Object.entries(production).map(([resource, rate]) => (
                  <ResourceRow
                    key={resource}
                    icon={RESOURCE_ICONS[resource] ?? '•'}
                    label={resource}
                    value={`+${(rate as number).toFixed(1)}`}
                    secondary={`${(stockpile[resource as keyof typeof stockpile] ?? 0).toFixed(0)} stored`}
                  />
                ))}
              </div>

              {/* Buildings */}
              {territory.buildings && territory.buildings.length > 0 && (
                <>
                  <SectionTitle icon={<Building2 size={13} />} title="Buildings" />
                  <div style={{ marginBottom: 16 }}>
                    {territory.buildings.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                        <span style={{ color: '#1a2a3a' }}>
                          {BUILDING_ICONS[b.building_type] ?? '🏗️'} {b.building_type.replace('_', ' ')} L{b.level}
                        </span>
                        <span style={{ color: b.under_construction ? '#F59E0B' : b.is_operational ? '#10B981' : '#6B7280', fontSize: 11 }}>
                          {b.under_construction ? '🔨 Building…' : b.is_operational ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Terrain */}
              <SectionTitle icon={<Eye size={13} />} title="Terrain modifiers" />
              <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)' }}>
                <div>ATK modifier: {((territory.terrain_attack_modifier ?? 1) * 100).toFixed(0)}%</div>
                <div>DEF modifier: {((territory.terrain_defense_modifier ?? 1) * 100).toFixed(0)}%</div>
                {territory.elevation_meters > 0 && <div>Elevation: {territory.elevation_meters.toFixed(0)}m</div>}
              </div>

              {/* Ad slot */}
              {territory.ad_slot_enabled && (
                <div style={{ marginTop: 16, padding: 10, background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', fontSize: 12 }}>
                  <div style={{ color: '#F59E0B', fontWeight: 500, marginBottom: 4 }}>📢 Ad Slot Active</div>
                  <div style={{ color: 'rgba(26,42,58,0.6)' }}>{territory.daily_viewer_count} viewers today</div>
                </div>
              )}

              {/* Claim button */}
              {isUnclaimed && player && (
                <button onClick={handleClaim} disabled={loading} style={primaryBtn}>
                  {loading ? 'Claiming…' : '🏴 Claim Territory'}
                </button>
              )}
            </div>
          )}

          {/* ── ATTACK TAB ───────────────────────────────────────────────── */}
          {tab === 'attack' && (
            <div>
              <div style={{ marginBottom: 12, fontSize: 12, color: 'rgba(26,42,58,0.6)' }}>
                Select units to deploy for this assault.
              </div>

              {/* Battle type */}
              <SectionTitle title="Battle type" />
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {(['conquest', 'raid', 'surprise'] as const).map(t => (
                  <button key={t} onClick={() => setAttackType(t)} style={{
                    ...tagBtn,
                    background: attackType === t ? '#EF4444' : 'rgba(255,255,255,0.06)',
                    color: attackType === t ? '#fff' : '#9CA3AF',
                    borderColor: attackType === t ? '#EF4444' : 'transparent',
                  }}>
                    {t === 'conquest' ? '⚔️ Conquest' : t === 'raid' ? '💨 Raid' : '⚡ Surprise'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginBottom: 16 }}>
                {attackType === 'conquest' && 'Capture the territory if you win.'}
                {attackType === 'raid' && 'Steal resources. No territory capture.'}
                {attackType === 'surprise' && 'Half timer, +30% attack, high risk if failed.'}
              </div>

              {/* Unit selection */}
              <SectionTitle title="Deploy units" />
              {UNIT_TYPES.map(unit => (
                <div key={unit} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 32, textAlign: 'center', fontSize: 18 }}>{UNIT_ICONS[unit]}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#1a2a3a', textTransform: 'capitalize' }}>{unit}</span>
                  <input
                    type="number" min={0}
                    value={attackUnits[unit] ?? ''}
                    onChange={e => setAttackUnits(prev => ({
                      ...prev,
                      [unit]: parseInt(e.target.value) || 0
                    }))}
                    style={numInput}
                    placeholder="0"
                  />
                </div>
              ))}

              <button onClick={handleAttack} disabled={loading} style={{ ...primaryBtn, background: '#DC2626', marginTop: 16 }}>
                {loading ? 'Launching…' : `⚔️ Launch ${attackType}`}
              </button>
            </div>
          )}

          {/* ── BUILD TAB ────────────────────────────────────────────────── */}
          {tab === 'build' && isOwned && (
            <div>
              <div style={{ fontSize: 12, color: 'rgba(26,42,58,0.6)', marginBottom: 12 }}>
                Select a building to construct. Costs resources from this territory.
              </div>
              {[
                { type: 'farm', cost: '200 food, 100 mat' },
                { type: 'mine', cost: '300 mat, 150 energy' },
                { type: 'power_plant', cost: '500 mat, 200 credits' },
                { type: 'market', cost: '600 credits, 200 mat' },
                { type: 'barracks', cost: '400 mat, 200 credits' },
                { type: 'radar', cost: '1000 mat, 200 intel' },
                { type: 'ad_billboard', cost: '300 mat, 500 credits' },
                { type: 'culture_center', cost: '400 mat, 300 culture' },
              ].map(b => (
                <button
                  key={b.type}
                  onClick={() => setBuildingType(b.type)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', marginBottom: 6,
                    background: buildingType === b.type ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${buildingType === b.type ? '#10B981' : 'rgba(0,60,100,0.1)'}`,
                    borderRadius: 8, cursor: 'pointer', color: '#1a2a3a',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {BUILDING_ICONS[b.type] ?? '🏗️'} {b.type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.45)', marginTop: 2 }}>Cost: {b.cost}</div>
                </button>
              ))}

              <button onClick={handleBuild} disabled={loading || !buildingType} style={{ ...primaryBtn, marginTop: 8 }}>
                {loading ? 'Starting…' : '🔨 Start Construction'}
              </button>
            </div>
          )}
        </div>
    </GlassPanel>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 4,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      fontWeight: 500, letterSpacing: 0.3,
    }}>{children}</span>
  )
}

function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(26,42,58,0.45)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
      {icon}{title}
    </div>
  )
}

function ResourceRow({ icon, label, value, secondary }: { icon: string; label: string; value: string; secondary: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '7px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#D1D5DB' }}>{icon} {label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#10B981' }}>{value}</span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.35)', marginTop: 2 }}>{secondary}</div>
    </div>
  )
}

function getTerritoryTypeColor(type: string): string {
  const colors: Record<string, string> = {
    urban: '#3B82F6', rural: '#22C55E', industrial: '#F59E0B',
    coastal: '#06B6D4', landmark: '#8B5CF6', mountain: '#78716C',
    forest: '#166534', water: '#60A5FA',
  }
  return colors[type] || '#6B7280'
}

// ─── Styles ──────────────────────────────────────────────────────────────────






