/**
 * usePendingClaims — active explorations (territory claims in progress).
 * react-query key 'pending-claims': HexCard invalidates it when an exploration starts,
 * so the progress bar shows at once (30s poll as fallback).
 * completeClaim finalizes a finished exploration and makes it visible (toast + owned hex + live HUD).
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useStore } from '../store'
import type { ClaimProgress } from '../components/shared/ClaimProgressBar'
import { playSound } from './useSound'

export function usePendingClaims() {
  const isAuth = useStore(s => s.isAuthenticated)
  const qc = useQueryClient()
  const { data: claims = [], refetch } = useQuery<ClaimProgress[]>({
    queryKey: ['pending-claims'],
    queryFn: () => api.get('/territories/pending-claims/').then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    enabled: isAuth,
    refetchInterval: 30000,
  })

  const completeClaim = useCallback(async (claimId: number) => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) return
    try {
      const res = await api.post('/territories/claim/', { h3_index: claim.h3_index, method: 'explore' })
      if (res.data?.status === 'in_progress' || res.data?.status === 'exploration_started') return
      const s = useStore.getState()
      const t = s.territories?.[claim.h3_index] || { h3_index: claim.h3_index }
      s.setTerritories([{ ...t, owner_id: s.player?.id, owner_username: s.player?.username } as any])
      if (typeof res.data?.balance === 'number') s.setBalance({ ...(s.balance || {}), in_game: res.data.balance } as any)
      playSound('claim')
      toast.success('Exploration complete — territory claimed!')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not finish the claim')
    } finally {
      ;['pending-claims', 'player', 'wallet', 'kingdoms', 'my-territories', 'loop-status', 'daily-missions']
        .forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    }
  }, [claims, qc])

  return { claims, refresh: refetch, completeClaim }
}
