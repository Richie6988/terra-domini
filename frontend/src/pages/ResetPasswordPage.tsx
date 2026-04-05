/**
 * ResetPasswordPage — Set new password via reset link from email.
 * URL: /reset-password/:uid/:token
 * POST /api/auth/password-reset-confirm/ with {uid, token, new_password}
 */
import { useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.15)',
  borderRadius: 10, color: '#e0f0ff', fontSize: 15, outline: 'none',
  fontFamily: "'Share Tech Mono', monospace",
}

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/password-reset-confirm/', {
        uid, token, new_password: password,
      })
      setDone(true)
      toast.success('Password reset! You can now login.')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Reset link expired or invalid'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [password, confirm, uid, token, navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'radial-gradient(ellipse at center, #0a0a12 0%, #000 70%)',
      fontFamily: "'Orbitron', system-ui, sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 400, padding: 32,
          background: 'rgba(5,5,15,0.9)', borderRadius: 16,
          border: '1px solid rgba(0,153,204,0.15)',
          boxShadow: '0 0 80px rgba(0,153,204,0.08)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: 6, marginBottom: 8 }}>
            HEX<span style={{ color: '#0099cc' }}>O</span>D
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3 }}>
            NEW PASSWORD
          </div>
        </div>

        {done ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 8, fontWeight: 700, letterSpacing: 2 }}>
              PASSWORD RESET
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}>
              Redirecting to login...
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, display: 'block', marginBottom: 6 }}>
              NEW PASSWORD (min 10 chars)
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••••" style={{ ...inputSt, marginBottom: 12 }}
              minLength={10} autoFocus
            />

            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, display: 'block', marginBottom: 6 }}>
              CONFIRM PASSWORD
            </label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required placeholder="••••••••••" style={inputSt}
              minLength={10}
            />

            {error && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                color: '#f87171', fontSize: 10, fontFamily: 'system-ui',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px 0', marginTop: 16,
              background: loading ? 'rgba(0,153,204,0.1)' : 'linear-gradient(135deg, #0099cc, #0077aa)',
              border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
              color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 3,
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: loading ? 'none' : '0 4px 20px rgba(0,153,204,0.3)',
            }}>
              {loading ? '◆ RESETTING...' : '◆ SET NEW PASSWORD'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10 }}>
          <Link to="/login" style={{ color: 'rgba(0,200,255,0.5)', textDecoration: 'none', letterSpacing: 2 }}>
            ← BACK TO LOGIN
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
