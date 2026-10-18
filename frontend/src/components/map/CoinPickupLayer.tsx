/**
 * CoinPickupLayer — HEX coins lying around the map (GET /api/pickups/, POST /api/pickups/collect/).
 * New coins every day, the same for everyone; worth more far from your land, golden ones are rare. Tap to pick up.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useLeafletLayer } from '../ui/Utils'
import { api } from '../../services/api'
import { useStore } from '../../store'
import { playSound } from '../../hooks/useSound'
import { celebrate } from '../shared/Celebrate'

export const COIN_MIN_ZOOM = 13

export function CoinPickupLayer({ map, zoom, center }: { map: L.Map | null; zoom: number; center: [number, number] }) {
  const layer = useLeafletLayer(map)
  const qc = useQueryClient()
  const reqId = useRef(0)
  const isAuth = useStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!map || !layer || !isAuth) return
    if (zoom < COIN_MIN_ZOOM) { layer.clearLayers(); return }
    const b = map.getBounds()
    const id = ++reqId.current
    const t = setTimeout(() => {
      api.get('/pickups/', { params: { lat_min: b.getSouth(), lat_max: b.getNorth(), lon_min: b.getWest(), lon_max: b.getEast() } })
        .then(({ data }) => {
          // markers swapped during a zoom animation crash Leaflet (_leaflet_pos): skip, the next move redraws
          if (id !== reqId.current || (map as any)._animatingZoom) return
          layer.clearLayers()
          if (!data.left_today) return
          for (const c of data.coins || []) {
            const icon = L.divIcon({
              className: '', iconSize: [34, 34], iconAnchor: [17, 17],
              html: `<div class="hx-coin${c.golden ? ' is-golden' : ''}"><b>+${c.value}</b>
                       <i class="hx-coin__disc" style="animation-delay:${(Math.random() * 1.5).toFixed(2)}s"><span>${c.golden ? '★' : 'H'}</span></i></div>`,
            })
            const m = L.marker([c.lat, c.lon], { icon, zIndexOffset: 900, bubblingMouseEvents: false })
            m.on('click', async () => {
              try {
                const { data: r } = await api.post('/pickups/collect/', { h3: c.h3 })
                layer.removeLayer(m)
                playSound('collect')
                celebrate(r.golden ? 'big' : 'small', `+${r.amount} HEX`)
                const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
                if (r.left_today <= 5) toast(`${r.left_today} coins left to pick today`)
                ;['player', 'wallet', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
              } catch (e: any) {
                layer.removeLayer(m)
                toast.error(e?.response?.data?.error || 'Coin gone')
              }
            })
            layer.addLayer(m)
          }
        }).catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [map, layer, zoom, center[0], center[1], isAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
