/**
 * LoginPage — Cinematic entry point for HEXOD.
 * Canvas-animated hex grid + holographic logo + live stats.
 * This is what investors and friends see FIRST.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'

// ── Animated hex grid background ──
function HexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
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
      const W = canvas.width, H = canvas.height

      const bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.8)
      bg.addColorStop(0, '#0a1628'); bg.addColorStop(0.5, '#060e1a'); bg.addColorStop(1, '#020408')
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
          ctx.strokeStyle = `rgba(0, 153, 204, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.stroke()

          if (pulse > 0.85 && dist < 0.6) {
            ctx.fillStyle = `rgba(0, 153, 204, ${alpha * 0.3})`
            ctx.fill()
          }
        }
      }

      const g1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W * 0.25)
      g1.addColorStop(0, 'rgba(0, 153, 204, 0.06)'); g1.addColorStop(1, 'transparent')
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)

      const g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, W * 0.2)
      g2.addColorStop(0, 'rgba(204, 136, 0, 0.04)'); g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 200, 255, ${p.a * (0.5 + Math.sin(time * 3 + p.x * 0.01) * 0.5)})`
        ctx.fill()
      })

      const scanY = (time * 80) % H
      ctx.fillStyle = 'rgba(0, 153, 204, 0.03)'
      ctx.fillRect(0, scanY, W, 2)
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

  return <span>{texts[textIndex].slice(0, charIndex)}<span style={{ opacity: 0.6, animation: 'blink 1s step-end infinite' }}>|</span></span>
}

// ── Animated stat counter ──
function AnimStat({ target, label, suffix = '' }: { target: number; label: string; suffix?: string }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const dur = 2000, start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    const t = setTimeout(() => requestAnimationFrame(tick), 800)
    return () => clearTimeout(t)
  }, [target])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0099cc', fontFamily: "'Orbitron', monospace", letterSpacing: 2 }}>
        {value.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginTop: 4, fontFamily: "'Orbitron', sans-serif" }}>
        {label}
      </div>
    </div>
  )
}

// ── Main ──
export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.player, data.access, data.refresh)
      navigate('/')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Login failed')
    } finally { setLoading(false) }
  }, [email, password, setAuth, navigate])

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: 'rgba(0,153,204,0.06)', border: '1px solid rgba(0,153,204,0.15)',
    borderRadius: 10, color: '#e0f0ff', fontSize: 13, outline: 'none',
    fontFamily: "'Share Tech Mono', monospace",
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <HexBackground />
      <style>{`@keyframes blink { 50% { opacity: 0 } } @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } } @keyframes shimmer { 0% { background-position: -200% center } 100% { background-position: 200% center } }`}</style>

      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20,
      }}>
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ textAlign: 'center', marginBottom: 36 }}>

          <div style={{ animation: 'float 4s ease-in-out infinite', marginBottom: 12 }}>
            <svg width="56" height="56" viewBox="0 0 60 60">
              <defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0099cc"/><stop offset="50%" stopColor="#00ccff"/><stop offset="100%" stopColor="#0077aa"/>
              </linearGradient></defs>
              <polygon points="30,2 55,16 55,44 30,58 5,44 5,16" fill="none" stroke="url(#hg)" strokeWidth="2" opacity="0.8"/>
              <polygon points="30,10 47,20 47,40 30,50 13,40 13,20" fill="none" stroke="#0099cc" strokeWidth="1" opacity="0.4"/>
              <text x="30" y="36" textAnchor="middle" fill="#0099cc" fontSize="18" fontWeight="900" fontFamily="Orbitron, monospace">◆</text>
            </svg>
          </div>

          <div style={{
            fontSize: 42, fontWeight: 900, letterSpacing: 12, fontFamily: "'Orbitron', monospace",
            background: 'linear-gradient(90deg, #0099cc, #00ccff, #cc8800, #0099cc)',
            backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'shimmer 4s linear infinite',
          }}>HEXOD</div>

          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 6, marginTop: 8,
            fontFamily: "'Orbitron', sans-serif", height: 16,
          }}>
            <Typewriter texts={[
              'OWN THE WORLD · HEX BY HEX',
              '5 MILLION TERRITORIES · YOUR EMPIRE',
              'CAPTURE · BUILD · TRADE · CONQUER',
              'REAL MAP · REAL STRATEGY · REAL STAKES',
            ]} />
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}
          style={{
            display: 'flex', gap: 40, marginBottom: 36, padding: '14px 40px', borderRadius: 30,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,153,204,0.1)',
          }}>
          <AnimStat target={4842201} label="TERRITORIES" />
          <AnimStat target={195} label="COUNTRIES" />
          <AnimStat target={0} label="PLAYERS" suffix="+" />
        </motion.div>

        {/* Login card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            width: 380, padding: '36px 32px',
            background: 'rgba(10, 18, 32, 0.85)', backdropFilter: 'blur(30px) saturate(1.4)',
            border: '1px solid rgba(0,153,204,0.15)', borderRadius: 16,
            boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,153,204,0.1)',
          }}>
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 8, color: 'rgba(0,200,255,0.4)', letterSpacing: 3, fontFamily: "'Orbitron', sans-serif", marginBottom: 6 }}>
              COMMANDER EMAIL
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="commander@hexod.io" style={inputSt}
              onFocus={e => e.target.style.borderColor = 'rgba(0,153,204,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(0,153,204,0.15)'} />

            <label style={{ display: 'block', fontSize: 8, color: 'rgba(0,200,255,0.4)', letterSpacing: 3, fontFamily: "'Orbitron', sans-serif", marginBottom: 6, marginTop: 18 }}>
              ACCESS CODE
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••••" style={inputSt}
              onFocus={e => e.target.style.borderColor = 'rgba(0,153,204,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(0,153,204,0.15)'} />

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 15, marginTop: 26, border: 'none', borderRadius: 12,
              cursor: loading ? 'wait' : 'pointer',
              background: loading ? 'rgba(0,153,204,0.2)' : 'linear-gradient(135deg, #0099cc, #0077aa)',
              color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 4,
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: loading ? 'none' : '0 6px 24px rgba(0,153,204,0.3)',
              transition: 'all 0.3s',
            }}>
              {loading ? '◆ CONNECTING...' : '◆ ENTER THE WORLD'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, fontSize: 8, fontFamily: "'Orbitron', sans-serif" }}>
            <Link to="/register" style={{ color: 'rgba(0,200,255,0.5)', textDecoration: 'none', letterSpacing: 2 }}>NEW COMMANDER</Link>
            <Link to="/forgot-password" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', letterSpacing: 1, fontSize: 7 }}>FORGOT PASSWORD?</Link>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          style={{ marginTop: 36, fontSize: 7, color: 'rgba(255,255,255,0.15)', letterSpacing: 4, fontFamily: "'Orbitron', sans-serif" }}>
          HEXOD v0.1 · SEASON 1 · POLYGON POS · MADE IN FRANCE 🇫🇷
        </motion.div>
      </div>
    </div>
  )
}
