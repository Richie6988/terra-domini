/**
 * Open the shop — on the "GET HEX" packs when the player is short of HEX (owner 2026-10-19: "when the user needs it,
 * he is taken straight to that section"). ShopPanel reads the focus once on mount.
 */
import { useStore } from '../../store'

let focus: 'hex' | null = null

export function openShop(section: 'hex' | null = null) {
  focus = section
  const s = useStore.getState()
  s.setActivePanel(null as any)
  setTimeout(() => useStore.getState().setActivePanel('shop'), 80)
}

/** ShopPanel: the section to scroll to on open (consumed). */
export function takeShopFocus(): 'hex' | null {
  const f = focus
  focus = null
  return f
}
