/**
 * VerifyEmailPage — Enter 6-digit verification code received by email.
 * POST /api/auth/verify-email/ {email, code} → JWT tokens + redirect to game.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useStore } from '../store'
import { MailCheck, ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import { HexBackground, AuthBrand } from './LoginPage'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as any)?.email || ''
  const setAuth = useStore(s => s.setAuth)

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input
  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const handleDigit = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    setCode(prev => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [code])

  // Handle paste of full code
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) { toast.error('Enter all 6 digits'); return }
    if (!email) { toast.error('Email not found — please register again'); return }

    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-email/', { email, code: fullCode })
      setAuth(data.player, data.access, data.refresh)
      toast.success(`Welcome to HEXOD, ${data.player.username}!`)
      navigate('/')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid code'
      toast.error(msg)
    } finally { setLoading(false) }
  }, [code, email, setAuth, navigate])

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (code.every(d => d) && code.join('').length === 6) {
      handleSubmit()
    }
  }, [code, handleSubmit])

  const handleResend = useCallback(async () => {
    if (!email) return
    setResending(true)
    try {
      await api.post('/auth/resend-verification/', { email })
      toast.success('New code sent — check your inbox')
    } catch { toast.error('Failed to resend') }
    finally { setResending(false) }
  }, [email])

  const digitStyle: React.CSSProperties = {
    width: 48, height: 56, textAlign: 'center',
    fontSize: 24, fontWeight: 900, fontFamily: "'Share Tech Mono', monospace",
    background: 'rgba(0,153,204,0.06)', border: '2px solid rgba(0,153,204,0.2)',
    borderRadius: 12, color: '#0099cc', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <AuthBrand small />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card auth-center">
          <div className="auth-badge"><MailCheck size={30} /></div>
          <div className="auth-title">VERIFY YOUR EMAIL</div>
          <div className="auth-subtitle" style={{ marginBottom: 22 }}>
            We sent a 6-digit code to <strong>{email || 'your email'}</strong>. Enter it below to activate your account.
          </div>

          {/* 6-digit code input */}
          <div className="auth-code" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`}
                maxLength={1}
                value={digit}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={e => e.target.select()}
                className={digit ? 'is-filled' : undefined}
              />
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading || code.join('').length < 6} className="auth-btn"
            style={{ opacity: !loading && code.join('').length < 6 ? 0.55 : 1, cursor: code.join('').length < 6 ? 'not-allowed' : undefined }}>
            {loading ? <><Loader2 size={18} className="auth-spin" /> VERIFYING…</> : <>ACTIVATE ACCOUNT <ChevronRight size={18} strokeWidth={3} /></>}
          </button>

          <div className="auth-hint" style={{ marginTop: 18 }}>
            Didn't receive the code?{' '}
            <button onClick={handleResend} disabled={resending} className="auth-link" style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, textDecoration: 'underline' }}>
              {resending ? 'SENDING…' : 'RESEND CODE'}
            </button>
          </div>
        </motion.div>
        <div className="auth-footer" style={{ marginTop: 24 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> BACK TO LOGIN</Link>
        </div>
      </div>
    </div>
  )
}
