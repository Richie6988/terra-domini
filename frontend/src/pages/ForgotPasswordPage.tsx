/**
 * ForgotPasswordPage — Request password reset email.
 * POST /api/auth/password-reset/ with email → sends reset link via SMTP.
 */
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.15)',
  borderRadius: 10, outline: 'none', color: '#e0f0ff', fontSize: 15,
  fontFamily: "'Share Tech Mono', monospace",
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await api.post('/auth/password-reset/', { email: email.trim().toLowerCase() })
      setSent(true)
      toast.success('Reset email sent — check your inbox')
    } catch {
      // Backend always returns 200 to not reveal if email exists
      setSent(true)
    } finally {
      setLoading(false)
    }
  }, [email])

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
            PASSWORD RECOVERY
          </div>
        </div>

        {sent ? (
          /* Success state */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 12, color: '#e0f0ff', marginBottom: 8, fontWeight: 700, letterSpacing: 2 }}>
              CHECK YOUR INBOX
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontFamily: 'system-ui' }}>
              If <strong style={{ color: '#0099cc' }}>{email}</strong> is registered, 
              you'll receive a password reset link. Check your spam folder too.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 16, fontFamily: 'system-ui' }}>
              Link expires in 24 hours.
            </p>
            <Link to="/login" style={{
              display: 'inline-block', marginTop: 20, padding: '14px 28px',
              background: 'rgba(0,153,204,0.15)', border: '1px solid rgba(0,153,204,0.3)',
              borderRadius: 10, outline: 'none', color: '#0099cc', fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textDecoration: 'none',
            }}>
              ◆ BACK TO LOGIN
            </Link>
          </motion.div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, display: 'block', marginBottom: 6 }}>
              EMAIL ADDRESS
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="commander@hexod.io" style={inputSt}
              autoFocus
            />

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px 0', marginTop: 16,
              background: loading ? 'rgba(0,153,204,0.1)' : 'linear-gradient(135deg, #0099cc, #0077aa)',
              border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
              color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 3,
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: loading ? 'none' : '0 4px 20px rgba(0,153,204,0.3)',
            }}>
              {loading ? '◆ SENDING...' : '◆ SEND RESET LINK'}
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
