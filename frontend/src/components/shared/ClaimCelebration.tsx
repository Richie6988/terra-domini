/**
 * ClaimCelebration — Full-screen particle explosion + victory flash.
 * Plays when a player claims a territory. The dopamine moment.
 */
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  visible: boolean
  territoryName: string
  rarity: string
  onComplete: () => void
}

const RARITY_CONFIG: Record<string, { color: string; particles: number; label: string }> = {
  common:    { color: '#9CA3AF', particles: 40,  label: 'TERRITORY CLAIMED' },
  uncommon:  { color: '#10B981', particles: 60,  label: 'UNCOMMON CAPTURED!' },
  rare:      { color: '#3B82F6', particles: 80,  label: 'RARE DISCOVERY!' },
  epic:      { color: '#8B5CF6', particles: 120, label: 'EPIC CONQUEST!' },
  legendary: { color: '#F59E0B', particles: 180, label: 'LEGENDARY PRIZE!' },
  mythic:    { color: '#EC4899', particles: 250, label: 'MYTHIC ' },
}

export function ClaimCelebration({ visible, territoryName, rarity, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common

  useEffect(() => {
    if (!visible || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    // Generate particles
    type Particle = { x:number; y:number; vx:number; vy:number; r:number; color:string; life:number; maxLife:number; type:'hex'|'dot'|'ring' }
    const particles: Particle[] = []

    for (let i = 0; i < cfg.particles; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 6
      const life = 60 + Math.random() * 90
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        r: 2 + Math.random() * 6,
        color: Math.random() > 0.3 ? cfg.color : '#fbbf24',
        life, maxLife: life,
        type: Math.random() > 0.8 ? 'hex' : Math.random() > 0.5 ? 'ring' : 'dot',
      })
    }

    let frame = 0
    let animId = 0

    function drawHex(x: number, y: number, size: number) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        const px = x + size * Math.cos(a), py = y + size * Math.sin(a)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
    }

    function animate() {
      animId = requestAnimationFrame(animate)
      frame++

      ctx.clearRect(0, 0, W, H)

      // Flash burst (first 15 frames)
      if (frame < 15) {
        const flashAlpha = (1 - frame / 15) * 0.6
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`
        ctx.fillRect(0, 0, W, H)
      }

      // Expanding hex ring
      if (frame < 60) {
        const ringR = frame * 8
        ctx.strokeStyle = cfg.color
        ctx.lineWidth = Math.max(1, 4 - frame * 0.06)
        ctx.globalAlpha = Math.max(0, 1 - frame / 60)
        drawHex(cx, cy, ringR); ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Second ring
      if (frame > 10 && frame < 70) {
        const ringR = (frame - 10) * 6
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = Math.max(1, 3 - (frame - 10) * 0.04)
        ctx.globalAlpha = Math.max(0, 1 - (frame - 10) / 60)
        drawHex(cx, cy, ringR); ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        p.vy += 0.03 // gravity
        p.vx *= 0.995 // drag
        p.life--

        const alpha = Math.max(0, p.life / p.maxLife)
        ctx.globalAlpha = alpha

        if (p.type === 'hex') {
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.5
          drawHex(p.x, p.y, p.r * 1.5); ctx.stroke()
        } else if (p.type === 'ring') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2)
          ctx.fillStyle = p.color; ctx.fill()
        }
        ctx.globalAlpha = 1
      })

      // End after all particles die
      if (frame > 180) {
        cancelAnimationFrame(animId)
        onComplete()
      }
    }

    animate()
    return () => cancelAnimationFrame(animId)
  }, [visible, cfg, onComplete])

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 3000, pointerEvents: 'none' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

        {/* Victory text */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center', fontFamily: "'Orbitron', monospace",
          }}
        >
          <div style={{
            fontSize: 14, fontWeight: 900, letterSpacing: 6,
            color: cfg.color,
            textShadow: `0 0 30px ${cfg.color}88, 0 0 60px ${cfg.color}44`,
          }}>
            {cfg.label}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              fontSize: 24, fontWeight: 900, letterSpacing: 4, marginTop: 8,
              color: '#fff',
              textShadow: '0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            {territoryName}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1.2 }}
            style={{ fontSize: 9, color: '#fff', letterSpacing: 4, marginTop: 12 }}
          >
            ADDED TO YOUR EMPIRE
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
