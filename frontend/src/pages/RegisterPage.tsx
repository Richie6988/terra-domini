/**
 * RegisterPage.tsx
 */
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'
import { EmojiIcon } from '../components/shared/emojiIcons'

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
  width: 420, maxWidth: '95vw', padding: '28px 32px',
  background: 'linear-gradient(180deg, rgba(235,242,250,0.95) 0%, rgba(220,230,242,0.95) 100%)',
  backdropFilter: 'blur(30px) saturate(1.2)',
  border: '1px solid rgba(0,60,100,0.15)',
  borderRadius: 16, position: 'relative', zIndex: 1,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
  maxHeight: '90vh', overflowY: 'auto',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--fs-auth-label)', color: 'rgba(26,42,58,0.55)',
  marginBottom: 6, marginTop: 12,
  fontFamily: "var(--font-heading)",
  letterSpacing: 2, fontWeight: 700,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(0,60,100,0.12)', borderRadius: 10,
  color: '#1a2a3a', fontSize: 'var(--fs-auth-input)' as any, boxSizing: 'border-box',
  fontFamily: "var(--font-mono)",
  textTransform: 'none', letterSpacing: 0, outline: 'none',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 20,
  background: 'linear-gradient(135deg, #0099cc, #0077aa)', border: 'none', borderRadius: 12,
  color: '#fff', fontSize: 'var(--fs-auth-button)' as any, fontWeight: 900, cursor: 'pointer',
  fontFamily: "var(--font-heading)",
  letterSpacing: 4,
  boxShadow: '0 6px 24px rgba(0,153,204,0.3)',
}


export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const setAuth = useStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const pwMatch = form.password && form.confirm && form.password === form.confirm
  const pwMismatch = form.confirm.length > 0 && form.password !== form.confirm
  const pwTooShort = form.password.length > 0 && form.password.length < 10

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 10) { toast.error('Mot de passe : 10 caractères minimum'); return }

    setLoading(true)
    try {
      await authApi.register({
        email: form.email, username: form.username,
        password: form.password, display_name: form.display_name || form.username,
      })
      toast.success('Account created — check your email for verification code!')
      navigate('/verify-email', { state: { email: form.email.toLowerCase().trim() } })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Registration failed')
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
          <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.45)', letterSpacing: 2,
            fontFamily: "'Orbitron', system-ui, sans-serif" }}>CLAIM YOUR FIRST TERRITORY. BUILD YOUR EMPIRE.</div>
          {refCode && (
            <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(0,153,204,0.08)',
              border: '1px solid rgba(0,153,204,0.2)', borderRadius: 20, fontSize: 10, color: '#0099cc',
              fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
              <EmojiIcon emoji="" /> INVITATION ACCEPTED — <strong>+50 ◆</strong> BONUS ON REGISTRATION
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { key: 'email', label: 'EMAIL', type: 'email', placeholder: 'commander@example.com' },
            { key: 'username', label: 'USERNAME (3-32 CHARS)', type: 'text', placeholder: 'IronGeneral42' },
            { key: 'display_name', label: 'DISPLAY NAME (OPTIONAL)', type: 'text', placeholder: 'Iron General' },
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

          {/* Password with eye toggle */}
          <div>
            <label style={labelStyle}>
              PASSWORD (MIN 10 CHARS)
              {pwTooShort && <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 9, fontFamily: 'system-ui' }}> too short</span>}
              {form.password.length >= 10 && <span style={{ color: '#22c55e', marginLeft: 8, fontSize: 9, fontFamily: 'system-ui' }}></span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••••••"
                required
                minLength={10}
                style={inputStyle}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                color: 'rgba(26,42,58,0.4)', padding: 4,
              }}>
                {showPw ? '◉' : '◎'}
              </button>
            </div>
          </div>

          {/* Confirm password with eye toggle + match indicator */}
          <div>
            <label style={labelStyle}>
              CONFIRM PASSWORD
              {pwMatch && <span style={{ color: '#22c55e', marginLeft: 8, fontSize: 9, fontFamily: 'system-ui' }}> match</span>}
              {pwMismatch && <span style={{ color: '#dc2626', marginLeft: 8, fontSize: 9, fontFamily: 'system-ui' }}><EmojiIcon emoji="" /> mismatch</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="••••••••••••"
                required
                minLength={10}
                style={{
                  ...inputStyle,
                  borderColor: pwMatch ? 'rgba(34,197,94,0.4)' : pwMismatch ? 'rgba(220,38,38,0.4)' : inputStyle.borderColor,
                }}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                color: 'rgba(26,42,58,0.4)', padding: 4,
              }}>
                {showConfirm ? '◉' : '◎'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(0,153,204,0.06)',
            border: '1px solid rgba(0,153,204,0.12)', borderRadius: 8,
            fontSize: 10, color: 'rgba(26,42,58,0.6)', lineHeight: 1.8,
            fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
            <EmojiIcon emoji="" /> BEGINNER PROTECTION 7 DAYS — NO ATTACKS WHILE YOU LEARN
            <br />
            ◆ FIRST TERRITORY → 100 HEX BONUS
          </div>

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'CREATING ACCOUNT…' : '⬡ BEGIN THE CONQUEST'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: 'rgba(26,42,58,0.45)',
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
          ALREADY A COMMANDER?{' '}
          <Link to="/login" style={{ color: '#0099cc', textDecoration: 'none', fontWeight: 700 }}>SIGN IN</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 9, color: 'rgba(26,42,58,0.3)',
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1, lineHeight: 1.6 }}>
          BY REGISTERING YOU ACCEPT THE TERMS OF SERVICE AND PRIVACY POLICY.
          HEX COIN IS A UTILITY TOKEN. NOT FINANCIAL ADVICE.
        </div>
      </motion.div>
    </div>
  )
}

