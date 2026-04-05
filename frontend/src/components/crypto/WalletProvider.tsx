/**
 * WalletProvider — Solana wallet integration (Phantom / Solflare / Backpack).
 *
 * Stratégie V0 : pas de SDK lourd — on utilise window.solana (Phantom standard)
 * et window.solflare directement. Suffit pour connect + sign + get address.
 *
 * Expose via useWallet() hook :
 *   - publicKey: string | null
 *   - connected: boolean
 *   - connect(): Promise<void>
 *   - disconnect(): void
 *   - walletName: string | null
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface WalletCtx {
  publicKey:  string | null
  connected:  boolean
  connecting: boolean
  walletName: string | null
  connect:    (preferred?: 'phantom' | 'solflare' | 'backpack') => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletCtx>({
  publicKey: null, connected: false, connecting: false, walletName: null,
  connect: async () => {}, disconnect: () => {},
})

export function useWallet() { return useContext(WalletContext) }

function getProvider(preferred?: string) {
  const w = window as any
  if (preferred === 'solflare' && w.solflare?.isSolflare) return { p: w.solflare, name: 'Solflare' }
  if (preferred === 'backpack' && w.backpack?.isBackpack) return { p: w.backpack, name: 'Backpack' }
  // Default: Phantom
  if (w.solana?.isPhantom) return { p: w.solana, name: 'Phantom' }
  if (w.phantom?.solana?.isPhantom) return { p: w.phantom.solana, name: 'Phantom' }
  if (w.solflare?.isSolflare) return { p: w.solflare, name: 'Solflare' }
  if (w.backpack?.isBackpack) return { p: w.backpack, name: 'Backpack' }
  return null
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey,  setPublicKey]  = useState<string | null>(
    () => localStorage.getItem('hx_wallet_pk') || null  // restore immédiat
  )
  const [connected,  setConnected]  = useState(
    () => !!localStorage.getItem('hx_wallet_pk')
  )
  const [connecting, setConnecting] = useState(false)
  const [walletName, setWalletName] = useState<string | null>(
    () => localStorage.getItem('hx_wallet') || null
  )

  // Auto-reconnect silencieux — essai onlyIfTrusted, pas de popup
  useEffect(() => {
    const savedWallet = localStorage.getItem('hx_wallet')
    const savedPk     = localStorage.getItem('hx_wallet_pk')
    if (!savedWallet) return

    const provider = getProvider()
    if (!provider) return

    if (savedPk) {
      // On a déjà la clé en cache — sync backend silencieusement
      setPublicKey(savedPk); setConnected(true); setWalletName(provider.name)
      api.patch('/players/update-profile/', { wallet_address: savedPk }).catch(() => {})
    }

    // Tenter la reconnexion on-chain (vérification fresh publicKey)
    provider.p.connect({ onlyIfTrusted: true })
      .then((res: any) => {
        const pk = res.publicKey?.toString()
        if (pk) {
          setPublicKey(pk); setConnected(true); setWalletName(provider.name)
          localStorage.setItem('hx_wallet_pk', pk)
          if (pk !== savedPk) {
            // Clé a changé (changement de compte wallet) → resync backend
            api.patch('/players/update-profile/', { wallet_address: pk }).catch(() => {})
          }
        }
      })
      .catch(() => {
        // onlyIfTrusted refusé → garder la session cachée, pas d'erreur visible
      })
  }, [])

  const connect = useCallback(async (preferred?: 'phantom' | 'solflare' | 'backpack') => {
    const provider = getProvider(preferred)
    if (!provider) {
      toast.error('No Solana wallet detected. Install Phantom, Solflare or Backpack.')
      window.open('https://phantom.app', '_blank')
      return
    }
    setConnecting(true)
    try {
      const res = await provider.p.connect()
      const pk  = res.publicKey?.toString()
      if (!pk) throw new Error('No public key')

      setPublicKey(pk)
      setConnected(true)
      setWalletName(provider.name)
      localStorage.setItem('hx_wallet', provider.name)
      localStorage.setItem('hx_wallet_pk', pk)
      localStorage.setItem('hx_wallet_connected_at', Date.now().toString())

      // Sync wallet + vérifier ownership NFTs
      await api.patch('/players/update-profile/', { wallet_address: pk }).catch(() => {})

      // Vérification ownership on-chain (SOLANA spec — prévenir spoofing)
      api.post('/solana/verify-ownership/', { wallet_address: pk })
        .then(r => {
          if (r.data.owns === false) {
            toast('⚠️ Wallet connecté mais aucun NFT Hexod détecté', { icon: '🔍' })
          }
        }).catch(() => {})

      toast.success(`${provider.name} connecté · ${pk.slice(0,4)}…${pk.slice(-4)}`)
    } catch (e: any) {
      if (e?.code !== 4001) toast.error('Connexion annulée')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    const provider = getProvider()
    provider?.p?.disconnect?.()
    setPublicKey(null)
    setConnected(false)
    setWalletName(null)
    localStorage.removeItem('hx_wallet')
    localStorage.removeItem('hx_wallet_pk')
  }, [])

  // Listen for wallet disconnect events
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return
    const onDisconnect = () => { setConnected(false); setPublicKey(null) }
    provider.p.on?.('disconnect', onDisconnect)
    return () => { provider.p.off?.('disconnect', onDisconnect) }
  }, [])

  return (
    <WalletContext.Provider value={{ publicKey, connected, connecting, walletName, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}
