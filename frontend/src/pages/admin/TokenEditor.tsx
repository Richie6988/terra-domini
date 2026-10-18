/**
 * TokenEditor — GOD MODE > TOKENS (owner 2026-10-18): quality editing and generation of place tokens,
 * straight on the database (API /api/gm/tokens/). Live 3D preview (front + engraved back) updates as you type.
 * Data governance: "Validated by X on DD/MM/YYYY"; any later content change clears the validation.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import L from 'leaflet'
import { latLngToCell, cellToBoundary } from 'h3-js'
import { api } from '../../services/api'
import { createTokenViewer, type TierKey } from '../../components/shared/hexodToken3D'
import { iconFor } from '../../components/shared/poiIcons'

interface Token {
  id?: string; db_uid?: string; name: string; title: string; description: string; fun_fact: string
  category: string; rarity: string; color: string; lat: number; lon: number; h3_index?: string
  country_code: string; wiki_url: string; image_url: string; is_active: boolean; is_featured: boolean
  source?: string; validated_by?: string | null; validated_at?: string | null; owner?: string | null
}
const RARITY_TIER: Record<string, TierKey> = { common: 'BRONZE', uncommon: 'BRONZE', rare: 'SILVER', epic: 'GOLD', legendary: 'EMERALD', mythic: 'DIAMOND' }
const RARITY_COLOR: Record<string, string> = { common: '#94a3b8', uncommon: '#22c55e', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f59e0b', mythic: '#ef4444' }
const EMPTY: Token = { name: '', title: '', description: '', fun_fact: '', category: 'anomaly', rarity: 'common', color: '#3b82f6',
  lat: 48.8566, lon: 2.3522, country_code: '', wiki_url: '', image_url: '', is_active: true, is_featured: false }
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : ''
const label: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#cfe0ff', marginBottom: 4, display: 'block', fontFamily: 'Nunito, sans-serif' }
const box: React.CSSProperties = { background: 'linear-gradient(180deg, #2a55c4, #1f3f98)', border: '3px solid #0f2266', borderRadius: 16, boxShadow: '0 5px 0 #0f2266', padding: 14 }

function Preview({ t }: { t: Token }) {
  const ref = useRef<HTMLDivElement>(null)
  const viewer = useRef<ReturnType<typeof createTokenViewer> | null>(null)
  useEffect(() => {
    if (!ref.current) return
    try { viewer.current = createTokenViewer(ref.current, {}) } catch { /* WebGL unavailable */ }
    return () => { viewer.current?.dispose(); viewer.current = null }
  }, [])
  useEffect(() => {
    viewer.current?.update({
      tier: RARITY_TIER[t.rarity] || 'BRONZE', category: (t.category || '').replace(/_/g, ' ').toUpperCase(), catColor: t.color,
      tokenName: (t.name || 'NEW TOKEN').toUpperCase(), biome: (t.country_code || 'WORLD').toUpperCase(),
      description: [t.title, t.description].filter(Boolean).join(' — ').slice(0, 240), iconSvg: iconFor(t.category),
      imageSrc: t.image_url || undefined,
      back: { h3Index: t.h3_index || latLngToCell(t.lat, t.lon, 8), lat: t.lat, lon: t.lon, rarity: t.rarity, owner: t.owner || null,
        capturedAt: null, hexPerDay: 0, region: null, continent: null, resources: [], tokenId: null, minted: false },
    })
  }, [t])
  return <div ref={ref} style={{ width: '100%', height: 420, borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 45%, #22304d, #0a0f1c)' }} />
}

function LocationPicker({ lat, lon, onPick }: { lat: number; lon: number; onPick: (lat: number, lon: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const hex = useRef<L.Polygon | null>(null)
  useEffect(() => {
    if (!ref.current || map.current) return
    const m = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([lat, lon], 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; OpenStreetMap' } as any).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => onPick(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)))
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const m = map.current
    if (!m) return
    hex.current?.remove()
    hex.current = L.polygon(cellToBoundary(latLngToCell(lat, lon, 8)) as [number, number][], { color: '#ffd23f', weight: 3, fillOpacity: 0.25 }).addTo(m)
    if (!m.getBounds().contains([lat, lon])) m.setView([lat, lon], m.getZoom())
  }, [lat, lon])
  return <div ref={ref} style={{ height: 220, borderRadius: 12, border: '3px solid #0f2266' }} />
}

export function TokenEditor() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [validated, setValidated] = useState<'' | '0' | '1'>('0')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<Token>(EMPTY)
  const [saving, setSaving] = useState(false)

  const { data: meta } = useQuery<any>({ queryKey: ['gm-token-meta'], queryFn: () => api.get('/gm/tokens/meta/').then(r => r.data) })
  const { data: list } = useQuery<any>({
    queryKey: ['gm-tokens', q, validated, rarity, page],
    queryFn: () => api.get('/gm/tokens/', { params: { q, validated, rarity, page } }).then(r => r.data),
  })
  const { data: detail } = useQuery<Token>({
    queryKey: ['gm-token', selected],
    queryFn: () => api.get(`/gm/tokens/${selected}/`).then(r => r.data),
    enabled: !!selected && selected !== 'new',
  })
  useEffect(() => { if (detail) setForm({ ...EMPTY, ...detail, title: detail.title || '' }) }, [detail])
  const set = (k: keyof Token, v: any) => setForm(f => ({ ...f, [k]: v }))
  const dirty = useMemo(() => !detail || JSON.stringify({ ...EMPTY, ...detail }) !== JSON.stringify(form), [detail, form])

  const save = async (validate: boolean) => {
    setSaving(true)
    try {
      const body = { ...form, validate }
      const r = selected === 'new' ? await api.post('/gm/tokens/', body) : await api.patch(`/gm/tokens/${selected}/`, body)
      toast.success(validate ? `Saved and validated: ${r.data.name}` : `Saved: ${r.data.name}`)
      setSelected(r.data.id); setForm({ ...EMPTY, ...r.data })
      qc.setQueryData(['gm-token', r.data.id], r.data)
      qc.invalidateQueries({ queryKey: ['gm-tokens'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const input = (k: keyof Token, ph = '', max?: number) => (
    <input className="hx-input" value={String(form[k] ?? '')} placeholder={ph} maxLength={max}
      onChange={e => set(k, e.target.value)} style={{ textTransform: 'none' }} />
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 14, alignItems: 'start' }} className="hx-token-editor">
      <style>{`@media (max-width: 900px) { .hx-token-editor { grid-template-columns: 1fr !important } }`}</style>

      {/* ── List ── */}
      <div style={box}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="hx-input" placeholder="Search a token…" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} style={{ textTransform: 'none' }} />
          <button className="btn-game btn-game-gold" onClick={() => { setSelected('new'); setForm(EMPTY) }} style={{ whiteSpace: 'nowrap' }}>+ NEW</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {([['0', 'TO VALIDATE'], ['1', 'VALIDATED'], ['', 'ALL']] as const).map(([v, l]) => (
            <button key={l} className="hx-chip" onClick={() => { setValidated(v); setPage(1) }}
              style={{ cursor: 'pointer', background: validated === v ? '#ffd23f' : undefined, color: validated === v ? '#12245e' : undefined }}>{l}</button>
          ))}
          <select className="hx-input" value={rarity} onChange={e => { setRarity(e.target.value); setPage(1) }} style={{ padding: '4px 8px', minHeight: 30, width: 'auto' }}>
            <option value="">all rarities</option>
            {meta?.rarities?.map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#cfe0ff', marginBottom: 6, fontFamily: 'Nunito, sans-serif', fontWeight: 800 }}>
          {list ? `${list.total} tokens · ${list.validated_total} validated` : '…'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '62vh', overflowY: 'auto' }}>
          {list?.results?.map((t: any) => (
            <button key={t.id} onClick={() => setSelected(t.id)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: '2px solid #0f2266', cursor: 'pointer',
              background: selected === t.id ? '#ffd23f' : 'rgba(8,20,60,0.45)', color: selected === t.id ? '#12245e' : '#fff',
              display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: RARITY_COLOR[t.rarity], flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.validated && <span title="Validated" style={{ color: '#22c55e', fontSize: 15 }}>&#10003;</span>}
            </button>
          ))}
        </div>
        {list && list.total > 50 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button className="btn-game btn-game-glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>PREV</button>
            <span style={{ alignSelf: 'center', fontSize: 12 }}>{page} / {Math.ceil(list.total / 50)}</span>
            <button className="btn-game btn-game-glass" disabled={page * 50 >= list.total} onClick={() => setPage(p => p + 1)}>NEXT</button>
          </div>
        )}
      </div>

      {/* ── Editor ── */}
      {!selected ? (
        <div style={{ ...box, textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 800 }}>Pick a token on the left, or create a new one.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Preview t={form} />
            <div style={{ fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 800, textAlign: 'center',
              color: form.validated_at ? '#86efac' : '#fde68a' }}>
              {form.validated_at ? `Token validated by ${form.validated_by} on ${fmtDate(form.validated_at)}` : 'Not validated yet'}
              {form.source && <span style={{ color: '#cfe0ff' }}> · source {form.source}{form.db_uid ? ` (${form.db_uid})` : ''}</span>}
              {form.owner && <span style={{ color: '#fca5a5' }}> · held by {form.owner}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#cfe0ff', textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>Drag the token to see its engraved back.</div>
          </div>

          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><span style={label}>NAME</span>{input('name', 'Eiffel Tower', 300)}</div>
            <div><span style={label}>TITLE (front headline)</span>{input('title', 'Iron Lady of Paris', 200)}</div>
            <div>
              <span style={label}>DESCRIPTION ({form.description.length}/240 shown on the token)</span>
              <textarea className="hx-input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} style={{ textTransform: 'none', resize: 'vertical' }} />
            </div>
            <div><span style={label}>FUN FACT</span>
              <textarea className="hx-input" rows={2} value={form.fun_fact} onChange={e => set('fun_fact', e.target.value)} style={{ textTransform: 'none', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 8 }}>
              <div><span style={label}>CATEGORY</span>
                <select className="hx-input" value={form.category} onChange={e => set('category', e.target.value)}>
                  {meta?.categories?.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div><span style={label}>RARITY</span>
                <select className="hx-input" value={form.rarity} onChange={e => set('rarity', e.target.value)}>
                  {meta?.rarities?.map((r: string) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><span style={label}>COLOUR</span>
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: '100%', height: 40, border: '3px solid #0f2266', borderRadius: 10, background: 'none' }} />
              </div>
            </div>
            <div><span style={label}>IMAGE URL (https)</span>{input('image_url', 'https://upload.wikimedia.org/…')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
              <div><span style={label}>WIKIPEDIA URL</span>{input('wiki_url', 'https://en.wikipedia.org/wiki/…')}</div>
              <div><span style={label}>COUNTRY</span>{input('country_code', 'FR', 4)}</div>
            </div>
            <div>
              <span style={label}>LOCATION — click the map ({form.lat.toFixed(5)}, {form.lon.toFixed(5)})</span>
              <LocationPicker lat={form.lat} lon={form.lon} onPick={(lat, lon) => setForm(f => ({ ...f, lat, lon }))} />
            </div>
            <div style={{ display: 'flex', gap: 14, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13 }}>
              <label><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> on the map</label>
              <label><input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} /> featured</label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-game btn-game-blue" disabled={saving || (!dirty && selected !== 'new')} onClick={() => save(false)} style={{ flex: 1 }}>SAVE</button>
              <button className="btn-game btn-game-green" disabled={saving} onClick={() => save(true)} style={{ flex: 1 }}>SAVE &amp; VALIDATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
