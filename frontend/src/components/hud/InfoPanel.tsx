/**
 * InfoPanel — Game rules, tips, contact.
 * RULE 4: Zero emoji — only MiniIcon SVGs.
 */
import { GlassPanel } from '../shared/GlassPanel'
import { MiniIcon } from '../shared/MiniIcons'

interface Props { onClose: () => void }

const RULES = [
  { icon: 'map', color: '#0099cc', title: 'EXPLORE', desc: 'Navigate the real-world map and discover territories with different rarities and resources.' },
  { icon: 'flag', color: '#22c55e', title: 'CLAIM', desc: 'First territory is FREE. Then buy (50-125 HEX) or explore (1-2h timer) to expand.' },
  { icon: 'crown', color: '#cc8800', title: 'BUILD', desc: 'Connected territories form kingdoms. Upgrade skills, recruit armies, defend borders.' },
  { icon: 'sword', color: '#dc2626', title: 'CONQUER', desc: 'Attack enemy territories with military forces. Send spies before you strike.' },
  { icon: 'target', color: '#22c55e', title: 'SAFARI', desc: 'Track rare creatures on the radar. Capture them to earn tokens and HEX coins.' },
  { icon: 'signal', color: '#8b5cf6', title: 'EVENTS', desc: 'Real-world events create special tokens. Register, test your luck, win unique cards.' },
  { icon: 'gem', color: '#f59e0b', title: 'TRADE', desc: 'Buy, sell, and auction unique territory NFTs on the marketplace.' },
]

export function InfoPanel({ onClose }: Props) {
  return (
    <GlassPanel
      title="INFO" onClose={onClose} accent="#38bdf8" width={760}
      icon={<MiniIcon id="info" size={20} color="#38bdf8" />}
      subtitle="How to play · Support"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hero */}
        <div className="hx-card hx-card--accent" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg viewBox="0 0 48 52" width={48} height={52} style={{ flexShrink: 0, filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.5))' }}>
            <polygon points="24,2 45,14 45,38 24,50 3,38 3,14" fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="2.5" />
            <polygon points="24,14 34,20 34,32 24,38 14,32 14,20" fill="#38bdf8" opacity="0.8" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', letterSpacing: 5, fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 14px rgba(56,189,248,0.4)' }}>HEXOD</div>
            <div style={{ fontSize: 11, color: 'var(--hx-text-2)', lineHeight: 1.6, marginTop: 4 }}>
              Geo-strategic multiplayer game. Real-world territories become blockchain-backed NFTs on Polygon.
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="hx-chip hx-chip--accent">SEASON 1</span>
              <span className="hx-chip">POLYGON POS</span>
              <span className="hx-chip">V0.1.0</span>
            </div>
          </div>
        </div>

        <div>
          <div className="hx-section-title">HOW TO PLAY</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {RULES.map((r, i) => (
              <div key={r.title} className="hx-card hx-rise" style={{ ['--accent' as any]: r.color, animationDelay: `${i * 40}ms`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: `linear-gradient(180deg, ${r.color}30, ${r.color}0d)`, border: `1px solid ${r.color}55`,
                  boxShadow: `0 0 12px ${r.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MiniIcon id={r.icon} size={20} color={r.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 10, color: r.color, fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#e2e8f0', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>{r.title}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--hx-text-2)', marginTop: 4, lineHeight: 1.55 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact support — no player-facing backend endpoint yet (RULE 1: no fake "sent" toast) */}
        <div className="hx-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="hx-section-title" style={{ margin: 0 }}>CONTACT SUPPORT</div>
            <span className="hx-chip">SOON</span>
          </div>
          <select disabled className="hx-input" style={{ marginBottom: 8, opacity: 0.6, cursor: 'not-allowed' }}>
            <option value="bug">Bug Report</option>
            <option value="suggestion">Suggestion</option>
            <option value="abuse">Report Abuse</option>
            <option value="account">Account Issue</option>
            <option value="other">Other</option>
          </select>
          <textarea disabled placeholder="In-game support inbox is coming soon." rows={3} className="hx-input"
            style={{ resize: 'none', opacity: 0.6, cursor: 'not-allowed', fontFamily: 'system-ui', display: 'block' }} />
          <button className="btn-game btn-game-glass" disabled aria-disabled="true" style={{ width: '100%', marginTop: 10 }}>
            SEND MESSAGE · SOON
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--hx-text-3)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>HEXOD v0.1.0 — SEASON 1 — POLYGON PoS</div>
      </div>
    </GlassPanel>
  )
}
