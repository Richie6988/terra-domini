/**
 * Kingdom customisation — server is the source of truth (was localStorage only, so the map never showed it).
 * POST /territories-geo/customize/ {scope:'kingdom'} writes name + colours on every hex of the connected kingdom;
 * GET /territories-geo/kingdoms/ returns them (name, fill_color, border_color, embed_url) and the map draws them.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayer } from '../../store'

export interface KingdomCustom { name?: string | null; fillColor?: string | null; borderColor?: string | null; imageUrl?: string | null }

/** Server kingdom containing this hex (customisation fields included). */
export function useServerKingdomCustom(anchorH3?: string): KingdomCustom {
  const player = usePlayer()
  const { data } = useQuery<any>({
    queryKey: ['kingdoms', player?.id],
    queryFn: () => api.get('/territories-geo/kingdoms/').then(r => r.data),
    staleTime: 30000,
    enabled: !!player,
  })
  const k = (data?.kingdoms || []).find((x: any) => anchorH3 && x.h3_indexes?.includes(anchorH3))
  return k ? { name: k.name, fillColor: k.fill_color, borderColor: k.border_color, imageUrl: k.embed_url } : {}
}

export function useSaveKingdomCustom() {
  const qc = useQueryClient()
  return async (anchorH3: string, c: KingdomCustom) => {
    const r = await api.post('/territories-geo/customize/', {
      h3_index: anchorH3, scope: 'kingdom',
      display_name: c.name || '', fill_color: c.fillColor, border_color: c.borderColor,
      embed_type: c.imageUrl ? 'image' : 'none', embed_url: c.imageUrl || '', embed_title: c.name || '',
    })
    ;['kingdoms', 'territories', 'my-territories'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
    return r.data
  }
}
