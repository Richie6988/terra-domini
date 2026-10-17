/**
 * LoginPage — Cinematic entry point for HEXOD.
 * Canvas-animated hex grid + holographic logo + live stats.
 * This is what investors and friends see FIRST.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { authApi } from '../services/api'
import { useStore } from '../store'
import { IconSVG } from '../components/shared/iconBank'

// ── Animated hex grid background ──
export function HexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const cv = canvas // non-null alias for closures
    let animId = 0
    let time = 0

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const hexSize = 40
    const hexH = hexSize * Math.sqrt(3)
    const hexW = hexSize * 2

    function drawHex(x: number, y: number, size: number) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = x + size * Math.cos(angle)
        const py = y + size * Math.sin(angle)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
    }

    const particles: { x:number; y:number; vx:number; vy:number; r:number; a:number }[] = []
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * 2000, y: Math.random() * 1200,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5, a: Math.random() * 0.5 + 0.1,
      })
    }

    function animate() {
      animId = requestAnimationFrame(animate)
      time += 0.005
      const W = canvas!.width, H = canvas!.height

      const bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.8)
      bg.addColorStop(0, '#5cc0ff'); bg.addColorStop(0.5, '#2f7bea'); bg.addColorStop(1, '#1a3c9a')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      const cols = Math.ceil(W / (hexW * 0.75)) + 2
      const rows = Math.ceil(H / hexH) + 2

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * hexW * 0.75
          const y = row * hexH + (col % 2) * hexH * 0.5
          const dx = x - W * 0.35, dy = y - H * 0.45
          const dist = Math.sqrt(dx * dx + dy * dy) / (W * 0.5)
          const pulse = Math.sin(time * 2 + dist * 4) * 0.5 + 0.5
          const alpha = Math.max(0.02, (1 - dist * 0.8) * 0.12 * pulse)

          drawHex(x, y, hexSize * 0.95)
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 1.3})`
          ctx.lineWidth = 2
          ctx.stroke()

          if (pulse > 0.85 && dist < 0.6) {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`
            ctx.fill()
          }
        }
      }

      const g1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W * 0.25)
      g1.addColorStop(0, 'rgba(255, 255, 255, 0.10)'); g1.addColorStop(1, 'transparent')
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)

      const g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, W * 0.2)
      g2.addColorStop(0, 'rgba(255, 210, 63, 0.10)'); g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${p.a * (0.5 + Math.sin(time * 3 + p.x * 0.01) * 0.5)})`
        ctx.fill()
      })

    }

    animate()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
}

// ── Typewriter tagline ──
function Typewriter({ texts }: { texts: string[] }) {
  const [textIndex, setTextIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const text = texts[textIndex]
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIndex < text.length) setCharIndex(c => c + 1)
        else setTimeout(() => setDeleting(true), 2500)
      } else {
        if (charIndex > 0) setCharIndex(c => c - 1)
        else { setDeleting(false); setTextIndex(i => (i + 1) % texts.length) }
      }
    }, deleting ? 30 : 60)
    return () => clearTimeout(timeout)
  }, [charIndex, deleting, textIndex, texts])

  return <span>{texts[textIndex].slice(0, charIndex)}<span style={{ opacity: 0.6, animation: 'auth-blink 1s step-end infinite' }}>|</span></span>
}

// ── Brand block (hex logo + wordmark + tagline) — shared by all auth pages ──
const hexPts = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')

export function AuthBrand({ small = false }: { small?: boolean }) {
  const ring = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (Math.PI / 3) * i
    return [32 + 10.6 * Math.cos(a), 32 + 10.6 * Math.sin(a)]
  })
  const size = small ? 44 : 64
  return (
    <div className="auth-brand">
      <div className="auth-logo">
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
          <defs>
            <linearGradient id="auth-hg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6cc4ff" /><stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="auth-hc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#cc8800" />
            </linearGradient>
          </defs>
          <polygon points={hexPts(32, 32, 29)} fill="url(#auth-hg)" stroke="#12245e" strokeWidth="3" strokeLinejoin="round" />
          {ring.map(([x, y], i) => (
            <polygon key={i} points={hexPts(x, y, 5.4)} fill="#ffffff" stroke="#12245e" strokeWidth="1.5" strokeLinejoin="round" />
          ))}
          <polygon points={hexPts(32, 32, 5.4)} fill="url(#auth-hc)" stroke="#7a3e00" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={small ? 'auth-wordmark auth-wordmark--sm' : 'auth-wordmark'}>HEXOD</div>
      <div className="auth-tagline">OWN THE WORLD. <em>HEX BY HEX.</em></div>
    </div>
  )
}

const FEATURES = [
  { icon: 'grid_globe', title: 'THE REAL WORLD IS THE BOARD', text: 'Every street on Earth is a hex you can claim.' },
  { icon: 'castle',     title: 'BUILD YOUR KINGDOM',          text: 'Grow territory, produce resources, upgrade your empire.' },
  { icon: 'swords',     title: 'RAID, DEFEND, ALLY',          text: 'Train armies and conquer rivals with your alliance.' },
]

// ── Main ──
export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await authApi.login(email, password)
      setAuth(data.player, data.access, data.refresh)
      navigate('/')
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.requires_verification) {
        toast.error('Email not verified — check your inbox')
        navigate('/verify-email', { state: { email: data.email || email } })
      } else {
        setError(data?.error || data?.detail || 'Login failed — check your email and password.')
        toast.error(data?.error || data?.detail || 'Login failed')
      }
    } finally { setLoading(false) }
  }, [email, password, setAuth, navigate])

  const inputSt: React.CSSProperties = {} // Now using .auth-input class

  return (
    <div className="auth-page">
      <HexBackground />
      <div className="auth-wrapper">
        <div className="auth-shell">
          {/* Hero */}
          <motion.div className="auth-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
            <AuthBrand />
            <div className="auth-typewriter">
              <Typewriter texts={[
                'CAPTURE · BUILD · TRADE · CONQUER',
                'REAL MAP · REAL STRATEGY · REAL STAKES',
                'POLYGON · ERC-721 · PLAY TO EARN',
              ]} />
            </div>
            <ul className="auth-features">
              {FEATURES.map((f, i) => (
                <li key={f.title} className="auth-feature hx-rise" style={{ animationDelay: `${300 + i * 120}ms` }}>
                  <IconSVG id={f.icon} size={48} />
                  <div>
                    <div className="auth-feature__title">{f.title}</div>
                    <div className="auth-feature__text">{f.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Login card */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="auth-card">
            <div className="auth-card__head">
              <div className="auth-title">SIGN IN</div>
              <div className="auth-subtitle">Welcome back, Commander. Your territory awaits.</div>
            </div>
            {error && (
              <div className="auth-error" role="alert"><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>
            )}
            <form onSubmit={handleSubmit}>
              <label className="auth-label" htmlFor="login-email">EMAIL</label>
              <div className="auth-field">
                <Mail size={18} className="auth-field__icon" />
                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  autoComplete="email" placeholder="commander@hexod.io" className="auth-input auth-input--icon" />
              </div>

              <label className="auth-label auth-spacer" htmlFor="login-password">PASSWORD</label>
              <div className="auth-field">
                <Lock size={18} className="auth-field__icon" />
                <input id="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••••" className="auth-input auth-input--icon auth-input--toggle" />
                <button type="button" className="auth-field__toggle" onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? <><Loader2 size={18} className="auth-spin" /> CONNECTING…</> : <>ENTER THE WORLD <ChevronRight size={18} strokeWidth={3} /></>}
              </button>
            </form>

            <div className="auth-links">
              <Link to="/register">NEW COMMANDER? CREATE ACCOUNT</Link>
              <Link to="/forgot-password" className="auth-link--muted">FORGOT PASSWORD?</Link>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="auth-footer">
          HEXOD v0.1 · SEASON 1 · POLYGON POS · MADE IN FRANCE · <Link to="/terms">TERMS</Link>
        </motion.div>
      </div>
    </div>
  )
}
