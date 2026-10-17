/**
 * ForgotPasswordPage — Request password reset email.
 * POST /api/auth/password-reset/ with email → sends reset link via SMTP.
 */
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { Mail, MailCheck, ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import { HexBackground, AuthBrand } from './LoginPage'


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
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <AuthBrand small />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
          {sent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="auth-center">
              <div className="auth-badge auth-badge--ok"><MailCheck size={30} /></div>
              <div className="auth-title">CHECK YOUR INBOX</div>
              <div className="auth-subtitle">
                If <strong>{email}</strong> is registered, you'll receive a password reset link. Check your spam folder too.
              </div>
              <div className="auth-hint">The link expires in 24 hours.</div>
              <Link to="/login" className="auth-btn auth-btn--ghost">BACK TO LOGIN</Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-card__head">
                <div className="auth-title">PASSWORD RECOVERY</div>
                <div className="auth-subtitle">Enter your account email and we'll send you a reset link.</div>
              </div>
              <label className="auth-label" htmlFor="forgot-email">EMAIL ADDRESS</label>
              <div className="auth-field">
                <Mail size={18} className="auth-field__icon" />
                <input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="commander@hexod.io" autoComplete="email" className="auth-input auth-input--icon" autoFocus />
              </div>
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <><Loader2 size={18} className="auth-spin" /> SENDING…</> : <>SEND RESET LINK <ChevronRight size={18} strokeWidth={3} /></>}
              </button>
            </form>
          )}
        </motion.div>
        <div className="auth-footer" style={{ marginTop: 24 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> BACK TO LOGIN</Link>
        </div>
      </div>
    </div>
  )
}
