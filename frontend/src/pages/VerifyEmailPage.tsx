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
import { EmojiIcon } from '../components/shared/emojiIcons'

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
      toast.success(`Welcome to HEXOD, ${data.player.username}! <EmojiIcon emoji="🌍" />`)
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
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'radial-gradient(ellipse at center, #0a0a12 0%, #000 70%)',
      fontFamily: "'Orbitron', system-ui, sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 440, padding: 36, textAlign: 'center',
          background: 'rgba(5,5,15,0.9)', borderRadius: 16,
          border: '1px solid rgba(0,153,204,0.15)',
          boxShadow: '0 0 80px rgba(0,153,204,0.08)',
        }}
      >
        {/* Header */}
        <div style={{ fontSize: 40, marginBottom: 16 }}><EmojiIcon emoji="📧" /></div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: 4, marginBottom: 8 }}>
          VERIFY EMAIL
        </div>
        <p style={{ fontSize: 11, color: 'rgba(180,210,240,0.6)', lineHeight: 1.6, fontFamily: 'system-ui', marginBottom: 24 }}>
          We sent a 6-digit code to <strong style={{ color: '#0099cc' }}>{email || 'your email'}</strong>.
          Enter it below to activate your account.
        </p>

        {/* 6-digit code input */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }} onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              style={{
                ...digitStyle,
                borderColor: digit ? '#0099cc' : 'rgba(0,153,204,0.2)',
                boxShadow: digit ? '0 0 12px rgba(0,153,204,0.15)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading || code.join('').length < 6} style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          background: loading ? 'rgba(0,153,204,0.1)' : 'linear-gradient(135deg, #0099cc, #0077aa)',
          color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 3, cursor: loading ? 'wait' : 'pointer',
          fontFamily: "'Orbitron', sans-serif",
          boxShadow: loading ? 'none' : '0 4px 20px rgba(0,153,204,0.3)',
          opacity: code.join('').length < 6 ? 0.5 : 1,
        }}>
          {loading ? '◆ VERIFYING...' : '◆ ACTIVATE ACCOUNT'}
        </button>

        {/* Resend */}
        <div style={{ marginTop: 20, fontSize: 9, color: 'rgba(180,210,240,0.4)' }}>
          Didn't receive the code?{' '}
          <button onClick={handleResend} disabled={resending} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#0099cc', fontSize: 9, fontWeight: 700, letterSpacing: 1,
            textDecoration: 'underline', fontFamily: "'Orbitron', sans-serif",
          }}>
            {resending ? 'SENDING...' : 'RESEND CODE'}
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 10 }}>
          <Link to="/login" style={{ color: 'rgba(100,210,255,0.5)', textDecoration: 'none', letterSpacing: 2 }}>
            ← BACK TO LOGIN
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
