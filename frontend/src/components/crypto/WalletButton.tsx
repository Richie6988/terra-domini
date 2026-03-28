/**
 * WalletButton — Bouton wallet Solana, top-right de la carte.
 * CDC: Phantom / Solflare / Backpack — connexion top-right mobile
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from './WalletProvider'

export function WalletButton() {
  const { publicKey, connected, connecting, walletName, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)

  if (connected && publicKey) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.35)',
            color: '#00FF87', fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00884a', flexShrink: 0 }} />
          {publicKey.slice(0,4)}…{publicKey.slice(-4)}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'rgba(235,242,250,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: 12, minWidth: 200, zIndex: 2000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 8 }}>{walletName}</div>
              <div style={{
                fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 6, marginBottom: 10,
                wordBreak: 'break-all',
              }}>
                {publicKey}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(publicKey); }}
                style={{ width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 11 }}
              >
                📋 Copier l'adresse
              </button>
              <button
                onClick={() => { disconnect(); setOpen(false) }}
                style={{ width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 11, fontWeight: 700 }}
              >
                Déconnecter
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={connecting}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 20, cursor: connecting ? 'wait' : 'pointer',
          background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#E5E7EB', fontSize: 11, fontWeight: 600,
        }}
      >
        {connecting ? '⏳ Connexion…' : '🔗 Wallet'}
      </button>

      <AnimatePresence>
        {open && !connecting && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: 'rgba(235,242,250,0.95)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: 12, minWidth: 200, zIndex: 2000,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Choisir un wallet Solana</div>
            {[
              { id: 'phantom'  as const, label: 'Phantom',  icon: '👻', color: '#AB9FF2' },
              { id: 'solflare' as const, label: 'Solflare', icon: '🔆', color: '#FC8C28' },
              { id: 'backpack' as const, label: 'Backpack', icon: '🎒', color: '#E33B3B' },
            ].map(w => (
              <button
                key={w.id}
                onClick={() => { connect(w.id); setOpen(false) }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                  marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${w.color}22`,
                  color: '#E5E7EB', fontSize: 12, fontWeight: 600, textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{w.icon}</span>
                <span>{w.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: w.color }}>Solana</span>
              </button>
            ))}
            <div style={{ fontSize: 9, color: '#374151', marginTop: 6, textAlign: 'center' }}>
              Pas de wallet ? <a href="https://phantom.app" target="_blank" rel="noreferrer" style={{ color: '#AB9FF2' }}>Installer Phantom</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
