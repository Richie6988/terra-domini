/**
 * usePendingClaims — Polls backend for active territory claims.
 * Auto-refreshes every 30s. Provides claim list + complete handler.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { useStore } from '../store'
import type { ClaimProgress } from '../components/shared/ClaimProgressBar'

export function usePendingClaims() {
  const [claims, setClaims] = useState<ClaimProgress[]>([])
  const isAuth = useStore(s => s.isAuthenticated)

  const refresh = useCallback(async () => {
    if (!isAuth) return
    try {
      const r = await api.get('/territories/pending-claims/')
      setClaims(Array.isArray(r.data) ? r.data : [])
    } catch {
      // Endpoint might not exist yet (needs migration)
      setClaims([])
    }
  }, [isAuth])

  // Poll every 30s
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [refresh])

  const completeClaim = useCallback(async (claimId: number) => {
    try {
      // Try to finalize the claim (re-POST with explore method)
      const claim = claims.find(c => c.id === claimId)
      if (claim) {
        await api.post('/territories/claim/', {
          h3_index: claim.h3_index,
          method: 'explore',
        })
      }
      refresh()
    } catch {}
  }, [claims, refresh])

  return { claims, refresh, completeClaim }
}
