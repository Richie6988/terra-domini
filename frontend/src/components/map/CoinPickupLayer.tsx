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

/** The coin flies into the HEX balance (top right), a "+N" pops where it was, the balance pulses. */
function flyToBalance(from: DOMRect, amount: number, golden: boolean) {
  const target = document.querySelector('.hxh-hex-value') as HTMLElement | null
  const to = target?.getBoundingClientRect()
  const pop = document.createElement('div')
  pop.className = 'hx-coinpop'; pop.textContent = `+${amount}`
  pop.style.left = `${from.left + from.width / 2}px`; pop.style.top = `${from.top}px`
  document.body.appendChild(pop)
  setTimeout(() => pop.remove(), 1100)
  const n = golden ? 8 : 4
  for (let i = 0; i < n; i++) {
    const coin = document.createElement('div')
    coin.className = `hx-coinfly${golden ? ' is-golden' : ''}`
    coin.style.left = `${from.left}px`; coin.style.top = `${from.top}px`
    document.body.appendChild(coin)
    const dx = (to ? to.left + to.width / 2 : window.innerWidth - 80) - from.left - from.width / 2
    const dy = (to ? to.top + to.height / 2 : 40) - from.top - from.height / 2
    const sx = (Math.random() - 0.5) * 120, sy = -60 - Math.random() * 60
    coin.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${sx}px,${sy}px) scale(1.2)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${dx}px,${dy}px) scale(0.5)`, opacity: 0.9 },
    ], { duration: 750 + i * 70, easing: 'cubic-bezier(.5,0,.75,.5)' }).onfinish = () => {
      coin.remove()
      if (target && i === n - 1) { target.classList.remove('hx-pulse'); void target.offsetWidth; target.classList.add('hx-pulse') }
    }
  }
}

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
            m.on('click', async (ev: L.LeafletMouseEvent) => {
              if (ev.originalEvent) L.DomEvent.stop(ev.originalEvent)   // never opens the hex underneath
              const el = (m.getElement()?.querySelector('.hx-coin__disc') as HTMLElement) || null
              const from = el?.getBoundingClientRect()
              layer.removeLayer(m)                                      // instant feedback
              try {
                const { data: r } = await api.post('/pickups/collect/', { h3: c.h3 })
                playSound(r.golden ? 'bonus' : 'collect')
                if (from) flyToBalance(from, r.amount, r.golden)
                if (r.golden) celebrate('big', `+${r.amount} HEX`)
                const s = useStore.getState(); s.setBalance({ ...(s.balance || {}), in_game: r.balance } as any)
                if (r.left_today <= 5) toast(`${r.left_today} coins left to pick today`)
                ;['player', 'wallet', 'loop-status'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
              } catch (e: any) {
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
