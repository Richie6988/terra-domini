/**
 * LoginPage.tsx
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
}
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)',
}
const cardStyle: React.CSSProperties = {
  width: 400, padding: '40px 36px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, position: 'relative', zIndex: 1,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#9CA3AF',
  marginBottom: 6, marginTop: 16,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', fontSize: 14, boxSizing: 'border-box',
  outline: 'none',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 24,
  background: '#059669', border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
}


export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.player, data.access, data.refresh)
      navigate('/')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={pageStyle}>
      <div style={bgStyle} />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={cardStyle}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#10B981', letterSpacing: -1, marginBottom: 4 }}>
            TERRA DOMINI
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>Real-world territory strategy</div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="commander@example.com" />

          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••••" />

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Connecting…' : 'Enter the World'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          New commander?{' '}
          <Link to="/register" style={{ color: '#10B981', textDecoration: 'none' }}>Create account</Link>
        </div>
      </motion.div>
    </div>
  )
}

