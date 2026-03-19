/**
 * RegisterPage.tsx
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'

const pageStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', background: '#0a0a14', position: 'relative', overflow: 'hidden',
  padding: '20px 0',
}
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(16,185,129,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(139,92,246,0.06) 0%, transparent 60%)',
}
const cardStyle: React.CSSProperties = {
  width: 420, padding: '36px 32px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, position: 'relative', zIndex: 1,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#9CA3AF', marginBottom: 5, marginTop: 12,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', fontSize: 13, boxSizing: 'border-box',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 13, marginTop: 20,
  background: '#059669', border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
}


export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 10) { toast.error('Password must be at least 10 characters'); return }

    setLoading(true)
    try {
      const data = await authApi.register({
        email: form.email, username: form.username,
        password: form.password, display_name: form.display_name || form.username,
      })
      setAuth(data.player, data.access, data.refresh)
      toast.success(`Welcome to Terra Domini, ${data.player.username}! 🌍`)
      navigate('/')
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={pageStyle}>
      <div style={bgStyle} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981', letterSpacing: -1, marginBottom: 4 }}>JOIN TERRA DOMINI</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>Claim your first territory. Build your empire.</div>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { key: 'email', label: 'Email', type: 'email', placeholder: 'commander@example.com' },
            { key: 'username', label: 'Username (3-32 chars)', type: 'text', placeholder: 'IronGeneral42' },
            { key: 'display_name', label: 'Display Name (optional)', type: 'text', placeholder: 'Iron General' },
            { key: 'password', label: 'Password (min 10 chars)', type: 'password', placeholder: '••••••••••••' },
            { key: 'confirm', label: 'Confirm Password', type: 'password', placeholder: '••••••••••••' },
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

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
            🛡️ Beginner protection for 7 days. No attacks while you learn the game.
            <br />
            🪙 First territory earns you 100 TDC bonus.
          </div>

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Creating account…' : '🌍 Begin the Conquest'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#6B7280' }}>
          Already a commander?{' '}
          <Link to="/login" style={{ color: '#10B981', textDecoration: 'none' }}>Sign in</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#374151' }}>
          By registering you accept the Terms of Service and Privacy Policy.
          TDC is a utility token. Not financial advice.
        </div>
      </motion.div>
    </div>
  )
}

