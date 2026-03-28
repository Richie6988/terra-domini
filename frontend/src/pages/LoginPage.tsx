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
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #2d5a45, #1a3d2e)',
  position: 'relative', overflow: 'hidden',
}
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(0,153,204,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(204,136,0,0.06) 0%, transparent 60%)',
}
const cardStyle: React.CSSProperties = {
  width: 400, padding: '40px 36px',
  background: 'linear-gradient(180deg, rgba(235,242,250,0.95) 0%, rgba(220,230,242,0.95) 100%)',
  backdropFilter: 'blur(30px) saturate(1.2)',
  border: '1px solid rgba(0,60,100,0.15)',
  borderRadius: 12, position: 'relative', zIndex: 1,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 8, color: 'rgba(26,42,58,0.45)',
  marginBottom: 6, marginTop: 16,
  fontFamily: "'Orbitron', system-ui, sans-serif",
  letterSpacing: 2, fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(0,60,100,0.12)', borderRadius: 8,
  color: '#1a2a3a', fontSize: 12, boxSizing: 'border-box',
  outline: 'none',
  fontFamily: "'Share Tech Mono', monospace",
  textTransform: 'none', letterSpacing: 0,
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 24,
  background: '#0099cc', border: 'none', borderRadius: 20,
  color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer',
  fontFamily: "'Orbitron', system-ui, sans-serif",
  letterSpacing: 3,
  boxShadow: '0 4px 15px rgba(0,153,204,0.3)',
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
          <div style={{ fontSize: 42, marginBottom: 6, color: '#0099cc' }}>⬡</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0099cc', letterSpacing: 6, marginBottom: 4,
            fontFamily: "'Orbitron', system-ui, sans-serif" }}>
            HEXOD
          </div>
          <div style={{ fontSize: 8, color: 'rgba(26,42,58,0.45)', letterSpacing: 3,
            fontFamily: "'Orbitron', system-ui, sans-serif" }}>
            GEOPOLITICAL STRATEGY GAME
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="commander@example.com" />

          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••••" />

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'CONNECTING…' : '⬡ ENTER THE WORLD'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 8, color: 'rgba(26,42,58,0.45)',
          fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: 1 }}>
          NEW COMMANDER?{' '}
          <Link to="/register" style={{ color: '#0099cc', textDecoration: 'none', fontWeight: 700 }}>CREATE ACCOUNT</Link>
        </div>
      </motion.div>
    </div>
  )
}

