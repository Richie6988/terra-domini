/**
 * RegisterPage.tsx
 */
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'
import { Mail, User, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, ChevronRight, ShieldCheck, Gift } from 'lucide-react'
import { HexBackground, AuthBrand } from './LoginPage'

const FIELDS = [
  { key: 'email', label: 'EMAIL', type: 'email', placeholder: 'commander@example.com', icon: Mail, auto: 'email' },
  { key: 'username', label: 'USERNAME', hint: '3–32 chars', type: 'text', placeholder: 'IronGeneral42', icon: User, auto: 'username' },
  { key: 'display_name', label: 'DISPLAY NAME', hint: 'optional', type: 'text', placeholder: 'Iron General', icon: User, auto: 'nickname' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const setAuth = useStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  const pwMatch = form.password && form.confirm && form.password === form.confirm
  const pwMismatch = form.confirm.length > 0 && form.password !== form.confirm
  const pwTooShort = form.password.length > 0 && form.password.length < 10

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 10) { toast.error('Password: 10 characters minimum'); return }

    setLoading(true)
    setError('')
    try {
      await authApi.register({
        email: form.email, username: form.username,
        password: form.password, display_name: form.display_name || form.username,
      })
      toast.success('Account created — check your email for verification code!')
      navigate('/verify-email', { state: { email: form.email.toLowerCase().trim() } })
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Registration failed')
      toast.error(e?.response?.data?.error ?? 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper">
        <div className="auth-shell">
          <motion.div className="auth-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <AuthBrand />
            <div className="auth-typewriter">CLAIM YOUR FIRST TERRITORY. BUILD YOUR EMPIRE.</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
            <div className="auth-card__head">
              <div className="auth-title">CREATE ACCOUNT</div>
              <div className="auth-subtitle">Join the war for the real-world map. It takes 30 seconds.</div>
              {refCode && (
                <div className="hx-chip hx-chip--accent" style={{ marginTop: 12, ['--accent' as any]: '#0CC5FF', fontSize: 10 }}>
                  <Gift size={14} /> INVITATION ACCEPTED — +50 HEX BONUS ON REGISTRATION
                </div>
              )}
            </div>
            {error && (
              <div className="auth-error" role="alert"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              {FIELDS.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={f.key} className={i ? 'auth-spacer' : undefined}>
                    <label className="auth-label" htmlFor={`reg-${f.key}`}>
                      {f.label}{f.hint && <span className="auth-label__status" style={{ color: 'rgba(226,232,240,0.45)' }}>{f.hint}</span>}
                    </label>
                    <div className="auth-field">
                      <Icon size={18} className="auth-field__icon" />
                      <input
                        id={`reg-${f.key}`}
                        type={f.type}
                        value={form[f.key as keyof typeof form]}
                        onChange={set(f.key)}
                        placeholder={f.placeholder}
                        autoComplete={f.auto}
                        required={f.key !== 'display_name'}
                        className="auth-input auth-input--icon"
                      />
                    </div>
                  </div>
                )
              })}

              {/* Password with eye toggle */}
              <div className="auth-spacer">
                <label className="auth-label" htmlFor="reg-password">
                  PASSWORD
                  {pwTooShort && <span className="auth-label__status" style={{ color: '#fbbf24' }}>too short (min 10)</span>}
                  {form.password.length >= 10 && <span className="auth-label__status" style={{ color: '#22c55e' }}><Check size={14} /> strong enough</span>}
                  {!form.password && <span className="auth-label__status" style={{ color: 'rgba(226,232,240,0.45)' }}>min 10 chars</span>}
                </label>
                <div className="auth-field">
                  <Lock size={18} className="auth-field__icon" />
                  <input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    className={`auth-input auth-input--icon auth-input--toggle${pwTooShort ? ' is-invalid' : ''}`}
                  />
                  <button type="button" className="auth-field__toggle" onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm password with eye toggle + match indicator */}
              <div className="auth-spacer">
                <label className="auth-label" htmlFor="reg-confirm">
                  CONFIRM PASSWORD
                  {pwMatch && <span className="auth-label__status" style={{ color: '#22c55e' }}><Check size={14} /> match</span>}
                  {pwMismatch && <span className="auth-label__status" style={{ color: '#f87171' }}>does not match</span>}
                </label>
                <div className="auth-field">
                  <Lock size={18} className="auth-field__icon" />
                  <input
                    id="reg-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={set('confirm')}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    className={`auth-input auth-input--icon auth-input--toggle${pwMatch ? ' is-valid' : pwMismatch ? ' is-invalid' : ''}`}
                  />
                  <button type="button" className="auth-field__toggle" onClick={() => setShowConfirm(v => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-note">
                <div><ShieldCheck size={18} color="#22c55e" style={{ flexShrink: 0 }} /> 7-day beginner protection: no attacks while you learn.</div>
                <div><Check size={18} color="#0CC5FF" style={{ flexShrink: 0 }} /> Your first territory is free to claim.</div>
              </div>

              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <><Loader2 size={18} className="auth-spin" /> CREATING ACCOUNT…</> : <>BEGIN THE CONQUEST <ChevronRight size={18} strokeWidth={3} /></>}
              </button>
            </form>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <span style={{ color: '#fff', textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>ALREADY A COMMANDER?</span>
              <Link to="/login">SIGN IN</Link>
            </div>

            <div className="auth-hint">
              By registering you accept the <Link to="/terms" style={{ color: '#0CC5FF' }}>Terms of Service and Privacy Policy</Link>.
              HEX Coin is a utility token. Not financial advice.
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

