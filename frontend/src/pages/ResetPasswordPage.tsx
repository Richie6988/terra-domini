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
import { Lock, ArrowLeft, Loader2, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { HexBackground, AuthBrand } from './LoginPage'


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
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <AuthBrand small />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
          {done ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="auth-center">
              <div className="auth-badge auth-badge--ok"><CheckCircle2 size={30} /></div>
              <div className="auth-title" style={{ color: '#22c55e' }}>PASSWORD RESET</div>
              <div className="auth-subtitle">Redirecting to login…</div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-card__head">
                <div className="auth-title">NEW PASSWORD</div>
                <div className="auth-subtitle">Choose a new password (at least 10 characters).</div>
              </div>
              {error && (
                <div className="auth-error" role="alert"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>
              )}
              <label className="auth-label" htmlFor="reset-pw">NEW PASSWORD</label>
              <div className="auth-field">
                <Lock size={18} className="auth-field__icon" />
                <input id="reset-pw" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••••" autoComplete="new-password" className="auth-input auth-input--icon"
                  minLength={10} autoFocus />
              </div>
              <label className="auth-label auth-spacer" htmlFor="reset-confirm">CONFIRM PASSWORD</label>
              <div className="auth-field">
                <Lock size={18} className="auth-field__icon" />
                <input id="reset-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required placeholder="••••••••••" autoComplete="new-password" className="auth-input auth-input--icon"
                  minLength={10} />
              </div>
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <><Loader2 size={18} className="auth-spin" /> RESETTING…</> : <>SET NEW PASSWORD <ChevronRight size={18} strokeWidth={3} /></>}
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
