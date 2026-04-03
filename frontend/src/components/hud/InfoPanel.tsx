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
    <GlassPanel title="INFO" onClose={onClose} accent="#64748b">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,153,204,0.06), rgba(0,153,204,0.02))', border: '1px solid rgba(0,153,204,0.15)' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0099cc', letterSpacing: 3, fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>HEXOD</div>
          <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.7)', lineHeight: 1.8 }}>
            Geo-strategic multiplayer game. Real-world territories become blockchain-backed NFTs on Polygon.
          </div>
        </div>

        {RULES.map(r => (
          <div key={r.title} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${r.color}10`, border: `1px solid ${r.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MiniIcon id={r.icon} size={16} color={r.color} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1a2a3a', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>{r.title}</div>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)', marginTop: 2 }}>{r.desc}</div>
            </div>
          </div>
        ))}

        <div style={{ padding: 14, borderRadius: 10, textAlign: 'center', background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.12)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif", marginBottom: 4 }}>NEED HELP?</div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)' }}>Contact us at <strong style={{ color: '#0099cc' }}>support@hexod.io</strong></div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 7, color: 'rgba(26,42,58,0.25)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>HEXOD v0.1.0 — SEASON 1 — POLYGON PoS</div>
      </div>
    </GlassPanel>
  )
}
