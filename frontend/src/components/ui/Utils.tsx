/**
 * ErrorBoundary — catches React errors in any child tree.
 * Usage: <ErrorBoundary fallback={<FallbackUI />}><Component /></ErrorBoundary>
 */
import { Component, type ReactNode, type ErrorInfo, useState, useEffect, useRef } from 'react'
import L from 'leaflet'

// ── ErrorBoundary ────────────────────────────────────────────────────────────
interface EBProps { children: ReactNode; fallback?: ReactNode; label?: string }
interface EBState { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label || 'unknown'}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '12px 16px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10,
          color: '#F87171', fontSize: 11,
        }}>
          Composant indisponible {this.props.label ? `(${this.props.label})` : ''}
        </div>
      )
    }
    return this.props.children
  }
}

// ── useLeafletLayer — cleanup safe ──────────────────────────────────────────
/**
 * Crée et nettoie un L.LayerGroup de façon sûre.
 * Gère les re-renders rapides et StrictMode.
 * Usage: const layer = useLeafletLayer(map)
 */
export function useLeafletLayer(map: L.Map | null): L.LayerGroup | null {
  const layerRef = useRef<L.LayerGroup | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!map) return
    if (mountedRef.current && layerRef.current) return  // Already mounted

    const layer = L.layerGroup().addTo(map)
    layerRef.current = layer
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (layerRef.current) {
        layerRef.current.clearLayers()
        try { map.removeLayer(layerRef.current) } catch {}
        layerRef.current = null
      }
    }
  }, [map])

  return layerRef.current
}

// ── Skeleton components ──────────────────────────────────────────────────────
const PULSE_STYLE = `
  @keyframes skPulse {
    0%,100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
  .sk { animation: skPulse 1.4s ease-in-out infinite; background: rgba(255,255,255,0.07); border-radius: 6px; }
`
function injectSkeletonStyles() {
  if (typeof document === 'undefined' || document.getElementById('sk-styles')) return
  const s = document.createElement('style')
  s.id = 'sk-styles'; s.textContent = PULSE_STYLE
  document.head.appendChild(s)
}

interface SkProps { width?: string | number; height?: number; borderRadius?: number; style?: React.CSSProperties }

export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }: SkProps) {
  injectSkeletonStyles()
  return <div className="sk" style={{ width, height, borderRadius, ...style }} />
}

export function SkeletonCard() {
  injectSkeletonStyles()
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <SkeletonBlock width={36} height={36} borderRadius={8} />
        <div style={{ flex: 1 }}>
          <SkeletonBlock height={13} style={{ marginBottom: 6, width: '70%' }} />
          <SkeletonBlock height={10} style={{ width: '50%' }} />
        </div>
        <SkeletonBlock width={40} height={18} />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return <>{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</>
}

export function SkeletonStatGrid({ cols = 4 }: { cols?: number }) {
  injectSkeletonStyles()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 6, marginBottom: 14 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '10px 8px' }}>
          <SkeletonBlock height={14} style={{ marginBottom: 6, width: '60%', margin: '0 auto 6px' }} />
          <SkeletonBlock height={10} style={{ width: '80%', margin: '0 auto' }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPanel() {
  return (
    <div style={{ padding: '16px 18px' }}>
      <SkeletonStatGrid cols={4} />
      <SkeletonList count={5} />
    </div>
  )
}

// ── WebSocket reconnect hook (exponential backoff) ───────────────────────────
// Already implemented in useGameSocket.ts — this is the helper types export
export const WS_RECONNECT_CONFIG = {
  BASE_MS: 3000,
  MAX_ATTEMPTS: 8,
  MAX_DELAY_MS: 30000,
  getDelay: (attempt: number) => Math.min(3000 * Math.pow(1.5, attempt), 30000),
}
