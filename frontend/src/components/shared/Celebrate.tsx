/**
 * Celebrate — reward moment for what matters: harvest, battle won, lucky win, jackpot, rare card.
 * Premium and quiet (owner 2026-10-19: "no confetti, it looks cheap"): a soft golden bloom, a thin hexagonal ring
 * opening from the centre (two for big, three for jackpot) and the big text. Call celebrate('big', '+2,400 HEX').
 */
import { useEffect, useRef, useState } from 'react'

type Level = 'small' | 'big' | 'jackpot'
const EVT = 'hx:celebrate'
export const celebrate = (level: Level = 'small', text = '') =>
  window.dispatchEvent(new CustomEvent(EVT, { detail: { level, text } }))

export function CelebrateHost() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [label, setLabel] = useState<{ text: string; level: Level; key: number } | null>(null)

  useEffect(() => {
    let raf = 0, start = 0, level: Level = 'small'
    const DUR = { small: 900, big: 1300, jackpot: 1900 }
    const tick = (now: number) => {
      const cv = ref.current, ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      if (!start) start = now
      const t = (now - start) / DUR[level]
      ctx.clearRect(0, 0, cv.width, cv.height)
      if (t >= 1) { raf = 0; return }
      const cx = cv.width / 2, cy = cv.height * 0.45, R = Math.hypot(cv.width, cv.height) * 0.5
      const ease = 1 - Math.pow(1 - t, 3)
      // bloom: warm light that swells then fades
      const ga = Math.sin(Math.PI * Math.min(1, t * 1.4)) * (level === 'small' ? 0.28 : 0.4)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.35 + 0.35 * ease))
      g.addColorStop(0, `rgba(255,214,120,${ga})`); g.addColorStop(0.5, `rgba(251,191,36,${ga * 0.35})`); g.addColorStop(1, 'rgba(251,191,36,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height)
      // thin hexagonal rings opening outwards
      const rings = level === 'jackpot' ? 3 : level === 'big' ? 2 : 1
      for (let k = 0; k < rings; k++) {
        const tk = Math.max(0, Math.min(1, (t - k * 0.14) / 0.8))
        if (tk <= 0) continue
        const r = R * 0.12 + R * 0.75 * (1 - Math.pow(1 - tk, 3))
        ctx.save(); ctx.translate(cx, cy)
        ctx.beginPath()
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)) }
        ctx.closePath()
        ctx.lineWidth = 2.5 * (1 - tk) + 0.5
        ctx.strokeStyle = `rgba(253,230,138,${0.85 * (1 - tk)})`
        ctx.shadowColor = 'rgba(251,191,36,0.9)'; ctx.shadowBlur = 18
        ctx.stroke(); ctx.restore()
      }
      raf = requestAnimationFrame(tick)
    }
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { level: Level; text: string }
      const cv = ref.current
      if (!cv) return
      cv.width = window.innerWidth; cv.height = window.innerHeight
      level = d.level; start = 0
      if (d.text) setLabel({ text: d.text, level: d.level, key: Date.now() })
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
