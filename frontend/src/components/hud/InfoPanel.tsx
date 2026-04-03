/**
 * InfoPanel — Game rules, tips, contact form.
 * Sprint E will flesh this out. Placeholder for dock wiring.
 */
import { GlassPanel } from '../shared/GlassPanel'

interface Props { onClose: () => void }

export function InfoPanel({ onClose }: Props) {
  return (
    <GlassPanel title="INFO" onClose={onClose} accent="#64748b">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Game overview */}
        <div style={{
          padding: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(0,153,204,0.06), rgba(0,153,204,0.02))',
          border: '1px solid rgba(0,153,204,0.15)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0099cc', letterSpacing: 3, fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>
            ⬡ HEXOD
          </div>
          <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.7)', lineHeight: 1.8 }}>
            HEXOD is a geo-strategic multiplayer game where real-world territories become blockchain-backed NFTs.
            Explore the map, claim hexagonal zones, build kingdoms, and trade unique tokens on Polygon.
          </div>
        </div>

        {/* Quick rules */}
        {[
          { icon: '🗺', title: 'EXPLORE', desc: 'Navigate the real-world map and discover unique territories with different rarities and resources.' },
          { icon: '🏴', title: 'CLAIM', desc: 'Your first territory is FREE. Then buy (50-125◆) or explore (1-2h timer) to expand your empire.' },
          { icon: '👑', title: 'BUILD', desc: 'Connected territories form kingdoms. Upgrade skills, recruit armies, and defend your borders.' },
          { icon: '⚔️', title: 'CONQUER', desc: 'Attack enemy territories with your military forces. Spy before you strike!' },
          { icon: '🎯', title: 'SAFARI', desc: 'Track rare creatures on the radar. Capture them to earn tokens and HEX coins.' },
          { icon: '📡', title: 'EVENTS', desc: 'Real-world events create special tokens. Register, test your luck, and win unique cards.' },
          { icon: '💰', title: 'TRADE', desc: 'Buy, sell, and auction unique territory NFTs on the marketplace.' },
        ].map(r => (
          <div key={r.title} style={{
            display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(0,60,100,0.06)',
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1a2a3a', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>{r.title}</div>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)', marginTop: 2 }}>{r.desc}</div>
            </div>
          </div>
        ))}

        {/* Contact */}
        <div style={{
          padding: 14, borderRadius: 10, textAlign: 'center',
          background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.12)',
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(26,42,58,0.4)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif", marginBottom: 4 }}>
            NEED HELP?
          </div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.5)' }}>
            Contact us at <strong style={{ color: '#0099cc' }}>support@hexod.io</strong>
          </div>
        </div>

        {/* Version */}
        <div style={{ textAlign: 'center', fontSize: 7, color: 'rgba(26,42,58,0.25)', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
          HEXOD v0.1.0 · SEASON 1 · POLYGON PoS
        </div>
      </div>
    </GlassPanel>
  )
}
