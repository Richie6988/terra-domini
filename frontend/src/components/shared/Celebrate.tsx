/**
 * Celebrate — full-screen reward burst (confetti + big text) for the moments that matter:
 * harvest, battle won, lucky win, jackpot, rare card. Call celebrate('big', '+2,400 HEX') from anywhere.
 */
import { useEffect, useRef, useState } from 'react'

type Level = 'small' | 'big' | 'jackpot'
const EVT = 'hx:celebrate'
export const celebrate = (level: Level = 'small', text = '') =>
  window.dispatchEvent(new CustomEvent(EVT, { detail: { level, text } }))

const COLORS = ['#fbbf24', '#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ec4899', '#ffffff']

export function CelebrateHost() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [label, setLabel] = useState<{ text: string; level: Level; key: number } | null>(null)

  useEffect(() => {
    let raf = 0
    let parts: { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; s: number; hex: boolean }[] = []
    const tick = () => {
      const cv = ref.current, ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      ctx.clearRect(0, 0, cv.width, cv.height)
      parts = parts.filter(p => p.y < cv.height + 40)
      for (const p of parts) {
        p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.s
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c
        if (p.hex) { ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(p.r * Math.cos(i * Math.PI / 3), p.r * Math.sin(i * Math.PI / 3)); ctx.fill() }
        else ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
        ctx.restore()
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0
      if (!parts.length) ctx.clearRect(0, 0, cv.width, cv.height)
    }
    const on = (e: Event) => {
      const { level, text } = (e as CustomEvent).detail as { level: Level; text: string }
      const cv = ref.current
      if (!cv) return
      cv.width = window.innerWidth; cv.height = window.innerHeight
      const n = level === 'jackpot' ? 320 : level === 'big' ? 160 : 60
      const burst = (cx: number, cy: number, k: number) => {
        for (let i = 0; i < k; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2, sp = 6 + Math.random() * (level === 'small' ? 7 : 12)
          parts.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 4 + Math.random() * 6,
            c: COLORS[(Math.random() * COLORS.length) | 0], a: Math.random() * 6, s: (Math.random() - 0.5) * 0.3, hex: Math.random() < 0.4 })
        }
      }
      burst(cv.width / 2, cv.height * 0.55, n)
      if (level !== 'small') { burst(cv.width * 0.15, cv.height, n / 3); burst(cv.width * 0.85, cv.height, n / 3) }
      if (text) setLabel({ text, level, key: Date.now() })
      if (!raf) raf = requestAnimationFrame(tick)
      try { navigator.vibrate?.(level === 'jackpot' ? [60, 40, 60, 40, 120] : level === 'big' ? [40, 30, 60] : 25) } catch { /* ignore */ }
    }
    window.addEventListener(EVT, on)
    return () => { window.removeEventListener(EVT, on); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    if (!label) return
    const t = setTimeout(() => setLabel(null), label.level === 'jackpot' ? 3200 : 1900)
    return () => clearTimeout(t)
  }, [label])

  return (
    <>
      <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 2500, pointerEvents: 'none' }} />
      {label && (
        <div key={label.key} className={`hx-celebrate hx-celebrate--${label.level}`}>{label.text}</div>
      )}
    </>
  )
}
