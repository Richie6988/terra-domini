/**
 * TermsPage — Legal information, privacy policy, terms of service.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { HexBackground, AuthBrand } from './LoginPage'

export default function TermsPage() {
  return (
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper" style={{ justifyContent: 'flex-start' }}>
        <div style={{ marginBottom: 24 }}><AuthBrand small /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card auth-card--wide auth-legal">
          <div className="auth-card__head">
            <div className="auth-title">TERMS OF SERVICE &amp; PRIVACY POLICY</div>
            <div className="auth-subtitle">Last updated: April 2026</div>
          </div>
        {[
          { title: '1. Acceptance of Terms', body: 'By accessing HEXOD, you agree to these Terms of Service. If you do not agree, do not use the platform. HEXOD reserves the right to update these terms at any time.' },
          { title: '2. Account & Age Requirements', body: 'You must be at least 13 years old to create an account. You are responsible for maintaining the security of your account credentials. One account per person.' },
          { title: '3. Virtual Currency & NFTs', body: 'HEX Coins are virtual in-game currency with no guaranteed real-world value. Territory NFTs are ERC-721 tokens on Polygon PoS. Blockchain transactions are irreversible. HEXOD is not a financial product.' },
          { title: '4. Gameplay Rules', body: 'Cheating, botting (unauthorized), account sharing, exploiting bugs, or using modified clients is prohibited and will result in permanent ban. GPS spoofing detection is active.' },
          { title: '5. Privacy & Data Collection', body: 'We collect: email, username, IP address (for geolocation), gameplay data, and device fingerprints (anti-cheat). We do NOT sell personal data to third parties. Data is stored on EU servers.' },
          { title: '6. Intellectual Property', body: 'All HEXOD content (graphics, code, game mechanics, SVG icons) is proprietary. Territory NFTs grant ownership of the token, not the underlying intellectual property.' },
          { title: '7. Limitation of Liability', body: 'HEXOD is provided "as is" without warranty. We are not liable for: loss of virtual currency, blockchain network issues, server downtime, or changes to game mechanics.' },
          { title: '8. Contact', body: 'For questions, contact support@hexod.io or use the in-game contact form.' },
        ].map(s => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </section>
        ))}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/login" className="auth-btn auth-btn--ghost" style={{ display: 'inline-flex', width: 'auto', padding: '12px 28px', marginTop: 0 }}>
              <ArrowLeft size={16} /> BACK TO LOGIN
            </Link>
          </div>
      </motion.div>
      </div>
    </div>
  )
}
