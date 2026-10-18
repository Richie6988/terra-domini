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
 *   …and collect, explore, probe, purchase, booster, card(_rare/_epic/_legendary), mission, bonus, win, lose, reinforce, flee
 * Procedural (no audio files): layered voices + filtered noise into a light compressor. Nothing plays before a user gesture.
 */
import { useCallback, useRef, useEffect } from 'react'
import { useStore } from '../store'

type SoundId = 'claim' | 'battle' | 'reward' | 'click' | 'error' | 'notify' | 'levelup' | 'open' | 'close' | 'capture'
  | 'collect' | 'explore' | 'probe' | 'purchase' | 'booster' | 'card' | 'card_rare' | 'card_epic' | 'card_legendary'
  | 'mission' | 'bonus' | 'win' | 'lose' | 'reinforce' | 'flee'

// Categorize each sound as 'sfx' or 'music' (all procedural sfx for now)
const SOUND_CATEGORY: Partial<Record<SoundId, 'sfx' | 'music'>> = {}

let audioCtx: AudioContext | null = null
let master: GainNode | null = null
let globalMuted = false

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
      // Light bus compression so layered sounds never clip, then a modest master volume
      const comp = audioCtx.createDynamicsCompressor()
      comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15
      master = audioCtx.createGain(); master.gain.value = 0.55
      comp.connect(master); master.connect(audioCtx.destination)
      ;(audioCtx as any)._bus = comp
    } catch { return null }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}
const bus = (ctx: AudioContext): AudioNode => (ctx as any)._bus || ctx.destination
const detune = () => (Math.random() - 0.5) * 12   // cents: repeats never sound robotic

/** One voice: oscillator with ADSR, optional pitch glide and filter. */
function voice(ctx: AudioContext, at: number, o: { f: number; to?: number; dur: number; type?: OscillatorType; gain?: number;
  attack?: number; release?: number; lp?: number }) {
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = o.type || 'sine'
  osc.frequency.setValueAtTime(o.f, at)
  osc.detune.value = detune()
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + o.dur)
  const peak = o.gain ?? 0.18, atk = o.attack ?? 0.008, rel = o.release ?? o.dur
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + atk)
  g.gain.exponentialRampToValueAtTime(0.0001, at + atk + rel)
  let node: AudioNode = osc
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f }
  node.connect(g); g.connect(bus(ctx))
  osc.start(at); osc.stop(at + atk + rel + 0.05)
}

/** Filtered noise burst (whoosh, impact, paper). */
function noise(ctx: AudioContext, at: number, dur: number, o: { gain?: number; from?: number; to?: number; type?: BiquadFilterType } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = 1.2
  f.frequency.setValueAtTime(o.from ?? 800, at)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + dur)
  const g = ctx.createGain(); g.gain.setValueAtTime(o.gain ?? 0.2, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f); f.connect(g); g.connect(bus(ctx))
  src.start(at); src.stop(at + dur + 0.02)
}

const N = (semi: number, base = 523.25) => base * Math.pow(2, semi / 12)   // semitones from C5
const arp = (ctx: AudioContext, t: number, semis: number[], step: number, o: Partial<Parameters<typeof voice>[2]> = {}) =>
  semis.forEach((s, i) => voice(ctx, t + i * step, { f: N(s), dur: 0.22, type: 'triangle', gain: 0.14, ...o }))

const SOUNDS: Record<SoundId, (ctx: AudioContext, t: number) => void> = {
  click:   (c, t) => voice(c, t, { f: 1400, to: 900, dur: 0.05, type: 'triangle', gain: 0.06 }),
  open:    (c, t) => { noise(c, t, 0.12, { from: 600, to: 2400, gain: 0.06 }); voice(c, t, { f: 660, to: 990, dur: 0.12, gain: 0.05 }) },
  close:   (c, t) => { noise(c, t, 0.1, { from: 2000, to: 500, gain: 0.05 }); voice(c, t, { f: 760, to: 480, dur: 0.1, gain: 0.04 }) },
  notify:  (c, t) => arp(c, t, [7, 12], 0.09, { type: 'sine', gain: 0.1 }),
  error:   (c, t) => { voice(c, t, { f: 220, to: 150, dur: 0.22, type: 'square', gain: 0.07, lp: 900 }); voice(c, t + 0.1, { f: 180, to: 120, dur: 0.25, type: 'square', gain: 0.06, lp: 700 }) },
  // Coin cascade: bright metallic pings tumbling down
  collect: (c, t) => { for (let i = 0; i < 7; i++) { const f = 1800 + Math.random() * 1400; voice(c, t + i * 0.045, { f, to: f * 0.98, dur: 0.18, type: 'triangle', gain: 0.09 }); voice(c, t + i * 0.045, { f: f * 2.01, dur: 0.08, gain: 0.03 }) } },
  reward:  (c, t) => { arp(c, t, [0, 4, 7, 12], 0.07); voice(c, t + 0.28, { f: N(16), dur: 0.5, type: 'sine', gain: 0.08 }) },
  claim:   (c, t) => { noise(c, t, 0.18, { from: 300, to: 3000, gain: 0.1 }); arp(c, t + 0.05, [0, 7, 12, 16], 0.08); voice(c, t + 0.05, { f: N(-12), dur: 0.6, type: 'sine', gain: 0.12 }) },
  explore: (c, t) => { noise(c, t, 0.5, { from: 400, to: 1600, gain: 0.07 }); voice(c, t, { f: 440, to: 660, dur: 0.4, type: 'sine', gain: 0.07 }) },
  probe:   (c, t) => { voice(c, t, { f: 1200, dur: 0.06, type: 'sine', gain: 0.1 }); voice(c, t + 0.08, { f: 1200, dur: 0.25, type: 'sine', gain: 0.05 }) },
  capture: (c, t) => { noise(c, t, 0.25, { from: 2000, to: 200, gain: 0.12, type: 'lowpass' }); arp(c, t + 0.1, [0, 4, 7, 11, 14], 0.07, { type: 'square', gain: 0.06, lp: 3000 }) },
  flee:    (c, t) => { noise(c, t, 0.35, { from: 3000, to: 300, gain: 0.1 }); voice(c, t, { f: 600, to: 200, dur: 0.35, type: 'sawtooth', gain: 0.05, lp: 1500 }) },
  battle:  (c, t) => { noise(c, t, 0.25, { from: 200, to: 80, gain: 0.25, type: 'lowpass' }); voice(c, t, { f: 110, to: 55, dur: 0.35, type: 'sawtooth', gain: 0.12, lp: 600 }); arp(c, t + 0.15, [-12, -5, 0], 0.09, { type: 'sawtooth', gain: 0.07, lp: 1800 }) },
  reinforce: (c, t) => { noise(c, t, 0.15, { from: 150, gain: 0.2, type: 'lowpass' }); voice(c, t, { f: 196, dur: 0.3, type: 'square', gain: 0.07, lp: 900 }); voice(c, t + 0.12, { f: 262, dur: 0.35, type: 'square', gain: 0.07, lp: 900 }) },
  win:     (c, t) => { arp(c, t, [0, 4, 7, 12, 16, 19], 0.08, { type: 'square', gain: 0.07, lp: 4000 }); voice(c, t + 0.48, { f: N(24), dur: 0.8, gain: 0.08 }) },
  lose:    (c, t) => arp(c, t, [7, 3, 0, -5], 0.14, { type: 'triangle', gain: 0.1, dur: 0.3 }),
  purchase:(c, t) => { voice(c, t, { f: 1318, dur: 0.12, type: 'triangle', gain: 0.1 }); voice(c, t + 0.07, { f: 1760, dur: 0.3, type: 'triangle', gain: 0.1 }); noise(c, t, 0.08, { from: 5000, gain: 0.04 }) },
  booster: (c, t) => { noise(c, t, 0.6, { from: 200, to: 4000, gain: 0.12 }); voice(c, t, { f: 220, to: 880, dur: 0.6, type: 'sawtooth', gain: 0.06, lp: 2500 }) },
  card:    (c, t) => { noise(c, t, 0.08, { from: 3000, gain: 0.08 }); voice(c, t, { f: N(7), dur: 0.2, type: 'triangle', gain: 0.1 }) },
  card_rare: (c, t) => { noise(c, t, 0.1, { from: 3000, gain: 0.08 }); arp(c, t, [0, 7, 12], 0.06) },
  card_epic: (c, t) => { noise(c, t, 0.2, { from: 500, to: 5000, gain: 0.1 }); arp(c, t, [0, 4, 7, 11, 14], 0.06, { type: 'square', gain: 0.06, lp: 3500 }) },
  card_legendary: (c, t) => { noise(c, t, 0.5, { from: 200, to: 6000, gain: 0.14 }); arp(c, t + 0.05, [0, 4, 7, 12, 16, 19, 24], 0.07, { type: 'square', gain: 0.07, lp: 5000 }); voice(c, t + 0.5, { f: N(24), dur: 1.2, gain: 0.09 }) },
  mission: (c, t) => { arp(c, t, [0, 5, 9], 0.08); voice(c, t + 0.24, { f: N(12), dur: 0.4, gain: 0.08 }) },
  bonus:   (c, t) => { SOUNDS.collect(c, t); arp(c, t + 0.3, [0, 4, 7, 12, 16], 0.08, { type: 'square', gain: 0.06, lp: 4000 }) },
  levelup: (c, t) => { arp(c, t, [0, 4, 7, 12, 16], 0.09, { type: 'square', gain: 0.07, lp: 4000 }); voice(c, t + 0.45, { f: N(19), dur: 0.7, gain: 0.08 }) },
}

export function useSound() {
  const mutedRef = useRef(globalMuted)
  const masterSound = useStore(s => s.masterSound)
  const musicEnabled = useStore(s => s.musicEnabled)
  const sfxEnabled = useStore(s => s.sfxEnabled)

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
    if (!masterSound) return
    const cat = SOUND_CATEGORY[id] || 'sfx'
    if (cat === 'sfx' && !sfxEnabled) return
    if (cat === 'music' && !musicEnabled) return
    try { const c = getCtx(); if (c) SOUNDS[id]?.(c, c.currentTime + 0.01) } catch {}
  }, [masterSound, musicEnabled, sfxEnabled])

  return { play }
}

// Global play function for non-hook contexts (e.g. non-React handlers)
export type { SoundId }
export function playSound(id: SoundId) {
  if (globalMuted) return
  const s = useStore.getState()
  if (!s.masterSound) return
  const cat = SOUND_CATEGORY[id] || 'sfx'
  if (cat === 'sfx' && !s.sfxEnabled) return
  if (cat === 'music' && !s.musicEnabled) return
  try { const c = getCtx(); if (c) SOUNDS[id]?.(c, c.currentTime + 0.01) } catch {}
}
