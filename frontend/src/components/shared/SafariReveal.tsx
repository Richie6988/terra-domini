/**
 * SafariReveal — the end of a radar hunt (owner 2026-10-19: "tap the territory hiding the beast → a majestic reveal of
 * the new safari token and a +1 animation flying to the codex"). Opened by window event 'hx:safari-reveal'
 * {target, hex_earned, won_hex} after POST /safari/probe/ answers 'captured'.
 * 1. golden burst + the creature's name   2. its token in 3D (picture, family, rarity, back = its hex)
 * 3. on CONTINUE: a "+1" chip flies to the Codex button of the dock, which pulses.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Token3DViewer } from './Token3DViewer'
import { IconSVG } from './iconBank'
import { playSound } from '../../hooks/useSound'
import { celebrate } from './Celebrate'
import { rarityLabel } from '../../services/balance'

const FAMILY: Record<string, { label: string; icon: string }> = {
  animal: { label: 'ANIMAL', icon: 'lion' }, fossil: { label: 'DINOSAUR', icon: 'dinosaur' }, insect: { label: 'INSECT', icon: 'butterfly' },
  vegetal: { label: 'PLANT', icon: 'orchid' }, mushroom: { label: 'FUNGUS', icon: 'fungus' }, microOrganism: { label: 'MICROBE', icon: 'microscope' },
  fantasy: { label: 'FANTASTIC CREATURE', icon: 'dragon' },
}

type Reveal = { target: any; hex_earned: number; won_hex: string | null }

export function SafariReveal() {
  const [r, setR] = useState<Reveal | null>(null)
  const [stage, setStage] = useState<'burst' | 'token'>('burst')
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const on = (e: Event) => {
      setR((e as CustomEvent).detail); setStage('burst'); playSound('card_legendary')
      setTimeout(() => setStage('token'), 1400)
    }
    window.addEventListener('hx:safari-reveal', on)
    return () => window.removeEventListener('hx:safari-reveal', on)
  }, [])

  const close = () => {
    const btn = document.querySelector('button[aria-label="Codex"]') as HTMLElement | null
    const rect = btn?.getBoundingClientRect()
    setR(null)
    if (rect) {
      setFly({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      setTimeout(() => { setFly(null); btn?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450 }) }, 900)
    }
    celebrate('small', '+1 in your album')
  }

  const t = r?.target
  const fam = FAMILY[t?.creature_category] || FAMILY.animal
  return createPortal(<>
    <AnimatePresence>
      {r && stage === 'burst' && (
        <motion.div key="burst" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            background: 'radial-gradient(circle at 50% 50%, rgba(253,230,138,0.55), rgba(245,158,11,0.18) 35%, rgba(2,6,16,0.85) 70%)' }}>
          <motion.div initial={{ rotate: 0, scale: 0.6 }} animate={{ rotate: 90, scale: 1.4 }} transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{ position: 'absolute', width: 600, height: 600, background: 'repeating-conic-gradient(rgba(253,230,138,0.22) 0 10deg, transparent 10deg 30deg)', borderRadius: '50%' }} />
          <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.15, 1], opacity: 1 }} transition={{ duration: 0.8 }}
            style={{ textAlign: 'center', fontFamily: "'Lilita One', sans-serif", color: '#fff', textShadow: '0 3px 0 #7c2d12, 0 0 24px #f59e0b' }}>
            <IconSVG id={fam.icon} size={84} />
            <div style={{ fontSize: 16, letterSpacing: 3, color: '#fde68a', marginTop: 8 }}>YOU FOUND IT</div>
            <div style={{ fontSize: 30, maxWidth: '90vw' }}>{t?.creature_name}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {r && stage === 'token' && (
      <Token3DViewer visible onClose={close} tokenName={(t?.creature_name || '').toUpperCase()} category={fam.label}
        iconId={fam.icon} rarityKey={t?.rarity} imageSrc={t?.creature_image || ''} h3Index={t?.target_h3}
        description={t?.creature_description ? String(t.creature_description).slice(0, 220) : undefined}
        infoPanel={
          <div className="hx-card" style={{ width: 'min(520px, calc(100vw - 24px))', textAlign: 'center', borderColor: '#fde68a' }}>
            <div style={{ fontFamily: "'Lilita One', sans-serif", fontSize: 18, color: '#fde68a' }}>
              {rarityLabel(t?.rarity)} · {fam.label} · NEW IN YOUR ALBUM</div>
            <div style={{ fontSize: 13, color: 'var(--hx-text-2)', margin: '6px 0 10px', textTransform: 'none', letterSpacing: 0 }}>
              +{(r.hex_earned || 0).toLocaleString()} HEX{r.won_hex ? ' · its territory is yours: a new base, however far from home' : ''}
            </div>
            <button className="btn-game btn-game-gold" onClick={close} style={{ width: '100%', minHeight: 46, fontSize: 14 }}>ADD TO MY ALBUM</button>
          </div>
        } />
    )}
    <AnimatePresence>
      {fly && (
        <motion.div key="fly" initial={{ left: window.innerWidth / 2, top: window.innerHeight / 2, scale: 1.6, opacity: 1 }}
          animate={{ left: fly.x, top: fly.y, scale: 0.7, opacity: 0.9 }} exit={{ opacity: 0 }} transition={{ duration: 0.85, ease: [0.5, 0, 0.3, 1] }}
          style={{ position: 'fixed', zIndex: 2200, transform: 'translate(-50%,-50%)', pointerEvents: 'none', padding: '6px 14px', borderRadius: 999,
            background: 'rgba(11,22,38,0.92)', border: '2px solid #fde68a', color: '#fde68a', font: "20px 'Lilita One', sans-serif",
            boxShadow: '0 0 18px rgba(253,230,138,0.6)' }}>+1</motion.div>
      )}
    </AnimatePresence>
  </>, document.body)
}
