/**
 * RegisterPage.tsx
 */
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'

const pageStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #2d5a45, #1a3d2e)',
  position: 'relative', overflow: 'hidden', padding: '20px 0',
}
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(0,153,204,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(204,136,0,0.06) 0%, transparent 60%)',
}
const cardStyle: React.CSSProperties = {
  width: 420, padding: '36px 32px',
  background: 'linear-gradient(180deg, rgba(235,242,250,0.95) 0%, rgba(220,230,242,0.95) 100%)',
  backdropFilter: 'blur(30px) saturate(1.2)',
  border: '1px solid rgba(0,60,100,0.15)',
  borderRadius: 12, position: 'relative', zIndex: 1,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 8, color: 'rgba(26,42,58,0.45)',
  marginBottom: 5, marginTop: 12,
  fontFamily: "'Orbitron', system-ui, sans-serif",
  letterSpacing: 2, fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(0,60,100,0.12)', borderRadius: 8,
  color: '#1a2a3a', fontSize: 12, boxSizing: 'border-box',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'none', letterSpacing: 0,
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 13, marginTop: 20,
  background: '#0099cc', border: 'none', borderRadius: 20,
  color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer',
  fontFamily: "'Orbitron', system-ui, sans-serif",
  letterSpacing: 3,
  boxShadow: '0 4px 15px rgba(0,153,204,0.3)',
}


export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const setAuth = useStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 10) { toast.error('Mot de passe : 10 caractères minimum'); return }

    setLoading(true)
    try {
      const data = await authApi.register({
        email: form.email, username: form.username,
        password: form.password, display_name: form.display_name || form.username,
      })
      setAuth(data.player, data.access, data.refresh)
      // Auto-apply referral code if present in URL
      if (refCode) {
        try {
          await authApi.post?.('/social/join-referral/', { ref_code: refCode })
        } catch (_) {}
        toast.success(`Bienvenue sur Hexod, ${data.player.username} ! +50 💎 offerts par votre parrain 🎁`)
      } else {
        toast.success(`Bienvenue sur Hexod, ${data.player.username} ! 🌍`)
      }
      navigate('/')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Inscription échouée')
    } finally { setLoading(false) }
  }

  return (
    <div style={pageStyle}>
      <div style={bgStyle} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 4, color: '#0099cc' }}>⬡</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0099cc', letterSpacing: 6, marginBottom: 4,
            fontFamily: "'Orbitron', system-ui, sans-serif" }}>HEXOD</div>
          <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.45)', letterSpacing: 2,
            fontFamily: "'Orbitron', system-ui, sans-serif" }}>CLAIM YOUR FIRST TERRITORY. BUILD YOUR EMPIRE.</div>
          {refCode && (
            <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(0,153,204,0.08)',
              border: '1px solid rgba(0,153,204,0.2)', borderRadius: 20, fontSize: 8, color: '#0099cc',
              fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
              🎁 INVITATION ACCEPTED — <strong>+50 ◆</strong> BONUS ON REGISTRATION
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { key: 'email', label: 'EMAIL', type: 'email', placeholder: 'commander@example.com' },
            { key: 'username', label: 'USERNAME (3-32 CHARS)', type: 'text', placeholder: 'IronGeneral42' },
            { key: 'display_name', label: 'DISPLAY NAME (OPTIONAL)', type: 'text', placeholder: 'Iron General' },
            { key: 'password', label: 'PASSWORD (MIN 10 CHARS)', type: 'password', placeholder: '••••••••••••' },
            { key: 'confirm', label: 'CONFIRM PASSWORD', type: 'password', placeholder: '••••••••••••' },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form]}
                onChange={set(f.key)}
                placeholder={f.placeholder}
                required={f.key !== 'display_name'}
                style={inputStyle}
              />
            </div>
          ))}

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(0,153,204,0.06)',
            border: '1px solid rgba(0,153,204,0.12)', borderRadius: 8,
            fontSize: 8, color: 'rgba(26,42,58,0.6)', lineHeight: 1.8,
            fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
            🛡 BEGINNER PROTECTION 7 DAYS — NO ATTACKS WHILE YOU LEARN
            <br />
            ◆ FIRST TERRITORY → 100 CRYSTAL BONUS
          </div>

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'CREATING ACCOUNT…' : '⬡ BEGIN THE CONQUEST'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 8, color: 'rgba(26,42,58,0.45)',
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
          ALREADY A COMMANDER?{' '}
          <Link to="/login" style={{ color: '#0099cc', textDecoration: 'none', fontWeight: 700 }}>SIGN IN</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 7, color: 'rgba(26,42,58,0.3)',
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1, lineHeight: 1.6 }}>
          BY REGISTERING YOU ACCEPT THE TERMS OF SERVICE AND PRIVACY POLICY.
          HEX COIN IS A UTILITY TOKEN. NOT FINANCIAL ADVICE.
        </div>
      </motion.div>
    </div>
  )
}

