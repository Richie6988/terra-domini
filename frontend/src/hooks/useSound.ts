/**
 * useSound — Minimal sound engine for HEXOD using Web Audio API.
 * No external files — generates tones procedurally.
 * 
 * Usage:
 *   const { play } = useSound()
 *   play('claim')    // territory claimed
 *   play('battle')   // attack initiated
 *   play('reward')   // HEX earned
 *   play('click')    // UI button click
 *   play('error')    // action failed
 *   play('notify')   // notification received
 *   play('levelup')  // achievement/rank up
 *   play('open')     // panel opened
 *   play('close')    // panel closed
 *   play('capture')  // safari creature captured
 */
import { useCallback, useRef, useEffect } from 'react'

type SoundId = 'claim' | 'battle' | 'reward' | 'click' | 'error' | 'notify' | 'levelup' | 'open' | 'close' | 'capture'

let audioCtx: AudioContext | null = null
let globalMuted = false

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try { audioCtx = new AudioContext() } catch { return null }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  const ctx = getCtx()
  if (!ctx || globalMuted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function playSequence(notes: [number, number, OscillatorType?, number?][]) {
  const ctx = getCtx()
  if (!ctx || globalMuted) return
  let t = ctx.currentTime
  for (const [freq, dur, type, gain] of notes) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type || 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain ?? 0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur)
    t += dur * 0.7
  }
}

const SOUNDS: Record<SoundId, () => void> = {
  claim:   () => playSequence([[523, 0.1], [659, 0.1], [784, 0.2]]),           // C-E-G ascending
  battle:  () => playSequence([[220, 0.08, 'sawtooth'], [165, 0.08, 'sawtooth'], [220, 0.15, 'sawtooth']]),
  reward:  () => playSequence([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.25]]), // C-E-G-C octave up
  click:   () => tone(800, 0.05, 'sine', 0.06),
  error:   () => playSequence([[300, 0.1, 'square', 0.08], [200, 0.2, 'square', 0.06]]),
  notify:  () => playSequence([[660, 0.1], [880, 0.15]]),
  levelup: () => playSequence([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1319, 0.3]]),
  open:    () => tone(600, 0.08, 'sine', 0.04),
  close:   () => tone(400, 0.08, 'sine', 0.04),
  capture: () => playSequence([[440, 0.08], [554, 0.08], [659, 0.08], [880, 0.2, 'triangle']]),
}

export function useSound() {
  const mutedRef = useRef(globalMuted)

  // Listen to mute toggle from SoundToggle
  useEffect(() => {
    const handler = (e: Event) => {
      const muted = (e as CustomEvent).detail?.muted ?? false
      globalMuted = muted
      mutedRef.current = muted
    }
    window.addEventListener('hexod:audio', handler)
    return () => window.removeEventListener('hexod:audio', handler)
  }, [])

  const play = useCallback((id: SoundId) => {
    if (globalMuted) return
    try { SOUNDS[id]?.() } catch {}
  }, [])

  return { play }
}

// Global play function for non-hook contexts
export function playSound(id: SoundId) {
  if (globalMuted) return
  try { SOUNDS[id]?.() } catch {}
}
