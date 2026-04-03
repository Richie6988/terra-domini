/**
 * TermsPage — Legal information, privacy policy, terms of service.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(180deg, #f0f4f8, #e2e8f0)',
      display: 'flex', justifyContent: 'center', padding: '40px 16px',
    }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 720, padding: '40px 36px',
          background: 'rgba(255,255,255,0.95)', borderRadius: 16,
          border: '1px solid rgba(0,60,100,0.1)', boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, color: '#0099cc', marginBottom: 4 }}>⬡</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0099cc', letterSpacing: 4, fontFamily: "'Orbitron', sans-serif" }}>HEXOD</div>
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.4)', letterSpacing: 2, marginTop: 4 }}>TERMS OF SERVICE & PRIVACY POLICY</div>
        </div>

        {[
          { title: '1. Acceptance of Terms', body: 'By accessing HEXOD, you agree to these Terms of Service. If you do not agree, do not use the platform. HEXOD reserves the right to update these terms at any time.' },
          { title: '2. Account & Age Requirements', body: 'You must be at least 13 years old to create an account. You are responsible for maintaining the security of your account credentials. One account per person.' },
          { title: '3. Virtual Currency & NFTs', body: 'HEX Coins (◆) are virtual in-game currency with no guaranteed real-world value. Territory NFTs are ERC-721 tokens on Polygon PoS. Blockchain transactions are irreversible. HEXOD is not a financial product.' },
          { title: '4. Gameplay Rules', body: 'Cheating, botting (unauthorized), account sharing, exploiting bugs, or using modified clients is prohibited and will result in permanent ban. GPS spoofing detection is active.' },
          { title: '5. Privacy & Data Collection', body: 'We collect: email, username, IP address (for geolocation), gameplay data, and device fingerprints (anti-cheat). We do NOT sell personal data to third parties. Data is stored on EU servers.' },
          { title: '6. Intellectual Property', body: 'All HEXOD content (graphics, code, game mechanics, SVG icons) is proprietary. Territory NFTs grant ownership of the token, not the underlying intellectual property.' },
          { title: '7. Limitation of Liability', body: 'HEXOD is provided "as is" without warranty. We are not liable for: loss of virtual currency, blockchain network issues, server downtime, or changes to game mechanics.' },
          { title: '8. Contact', body: 'For questions, contact support@hexod.io or use the in-game contact form.' },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2a3a', marginBottom: 6, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(26,42,58,0.6)', lineHeight: 1.8 }}>{s.body}</div>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(0,60,100,0.08)' }}>
          <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.3)', letterSpacing: 2 }}>Last updated: April 2026</div>
          <Link to="/login" style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', borderRadius: 8, background: '#0099cc', color: '#fff', fontSize: 10, fontWeight: 700, textDecoration: 'none', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
            BACK TO LOGIN
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
