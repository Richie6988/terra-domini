/**
 * HexCard — Hexod collectible territory card.
 *
 * Architecture Three.js:
 *   - Prism (ExtrudeGeometry, 1 material: sides)
 *   - Front flat hex (ShapeGeometry, canvas texture with all text)
 *   - Back flat hex  (ShapeGeometry, shiny canvas texture)
 *
 * Owned tabs:
 *   🃏 Carte   — Pokémon-style card info
 *   🔬 Royaume — Resources + radial skill tree (always fully deployed)
 *   💎 NFT     — Token, marketplace
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { Token3DViewer } from '../shared/Token3DViewer'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useStore, usePlayer } from '../../store'
import { ResourceBadge } from '../ui/ResourceTooltip'
import toast from 'react-hot-toast'

/* ── Rarity ─────────────────────────────────────────────── */
const RARITY: Record<string, {
  c:string; bg:string; accent:string; label:string; grade:string
  metalness:number; roughness:number
  // Aria visual specs per tier
  foil: 'none'|'subtle'|'shimmer'|'holographic'|'rainbow'|'prismatic'
  glow: number      // px glow radius
  scanlines: boolean
  particles: boolean
  borderStyle: 'solid'|'dashed'|'double'
  serieMax: number  // max per rarity for serie #X/MAX display
}> = {
  common:   { c:'#9CA3AF', bg:'#0d0f18', accent:'#E5E7EB', label:'Common',    grade:'F',  metalness:0.1, roughness:0.9, foil:'none',        glow:0,   scanlines:false, particles:false, borderStyle:'solid',  serieMax:10000 },
  uncommon: { c:'#10B981', bg:'#04100a', accent:'#34D399', label:'Uncommon',  grade:'C',  metalness:0.3, roughness:0.7, foil:'subtle',      glow:4,   scanlines:false, particles:false, borderStyle:'solid',  serieMax:5000  },
  rare:     { c:'#3B82F6', bg:'#030a1a', accent:'#93C5FD', label:'Rare',      grade:'B',  metalness:0.5, roughness:0.5, foil:'shimmer',     glow:8,   scanlines:true,  particles:false, borderStyle:'solid',  serieMax:1000  },
  epic:     { c:'#8B5CF6', bg:'#07030f', accent:'#C4B5FD', label:'Epic',      grade:'A',  metalness:0.7, roughness:0.3, foil:'holographic', glow:14,  scanlines:true,  particles:false, borderStyle:'double', serieMax:250   },
  legendary:{ c:'#F59E0B', bg:'#0f0700', accent:'#FCD34D', label:'Legendary', grade:'S',  metalness:0.9, roughness:0.1, foil:'rainbow',     glow:22,  scanlines:true,  particles:true,  borderStyle:'double', serieMax:50    },
  mythic:   { c:'#EC4899', bg:'#0f0008', accent:'#F9A8D4', label:'Mythic',    grade:'SS', metalness:0.95,roughness:0.05,foil:'prismatic',   glow:32,  scanlines:true,  particles:true,  borderStyle:'double', serieMax:10    },
}
type RK = keyof typeof RARITY

/* ── Biome resources ─────────────────────────────────────── */
const BIOME_RES: Record<string, { res:string; icon:string; base:number }[]> = {
  urban:    [{res:'Données',    icon:'📊',amount:12},{res:'Influence', icon:'🌐',amount:8},{res:'Main-d\'œuvre',icon:'👷',amount:15}],
  rural:    [{res:'Nourriture', icon:'🌾',amount:20},{res:'Eau',       icon:'💧',amount:15},{res:'Main-d\'œuvre',icon:'👷',amount:10}],
  forest:   [{res:'Nourriture', icon:'🌾',amount:15},{res:'Eau',       icon:'💧',amount:12},{res:'Stabilité',   icon:'⚖️',amount:8}],
  mountain: [{res:'Fer',        icon:'🪨',amount:18},{res:'Titanium',  icon:'🔷',amount:5},{res:'Charbon',      icon:'⬛',amount:10}],
  coastal:  [{res:'Nourriture', icon:'🌾',amount:12},{res:'Eau',       icon:'💧',amount:20},{res:'Gaz',         icon:'💨',amount:8}],
  desert:   [{res:'Pétrole',    icon:'🛢️',amount:15},{res:'Silicium',  icon:'💠',amount:10},{res:'Terres rares',icon:'💎',amount:4}],
  tundra:   [{res:'Gaz',        icon:'💨',amount:12},{res:'Uranium',   icon:'☢️',amount:3},{res:'Eau',          icon:'💧',amount:8}],
  industrial:[{res:'Acier',     icon:'⚙️',amount:15},{res:'Composants',icon:'🔌',amount:8},{res:'Pétrole',     icon:'🛢️',amount:10}],
  landmark: [{res:'Données',    icon:'📊',amount:10},{res:'Influence', icon:'🌐',amount:12},{res:'Stabilité',   icon:'⚖️',amount:10}],
  grassland:[{res:'Nourriture', icon:'🌾',amount:18},{res:'Main-d\'œuvre',icon:'👷',amount:8},{res:'Stabilité',icon:'⚖️',amount:6}],
}
const BIOME_RES_MAPPED = Object.fromEntries(Object.entries(BIOME_RES).map(([k,v])=>[k,v.map(r=>({...r,amount:r.base||10}))]))

/* ── Canvas painters ─────────────────────────────────────── */
function makeHexClip(ctx: CanvasRenderingContext2D, cx:number, cy:number, r:number) {
  ctx.beginPath()
  for (let i=0;i<6;i++) {
    const a=(Math.PI/3)*i-Math.PI/6
    i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
           : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
  }
  ctx.closePath()
}

// Dessine un réseau de traces circuit imprimé (style cyberpunk)
function drawCircuitTraces(ctx: CanvasRenderingContext2D, S:number, color:string, alpha:number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.lineCap = 'square'
  // Grille orthogonale avec noeuds
  const grid = 64
  for (let x=0; x<S; x+=grid) {
    for (let y=0; y<S; y+=grid) {
      const r = Math.random()
      if (r < 0.3) {
        // Trace horizontale
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+grid, y); ctx.stroke()
      } else if (r < 0.5) {
        // Trace verticale
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+grid); ctx.stroke()
      }
      // Noeud dot
      if (Math.random() < 0.15) {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2)
        ctx.fillStyle = color; ctx.fill()
      }
    }
  }
  ctx.restore()
}

// Dessine une grille hexagonale de fond
function drawHexGrid(ctx: CanvasRenderingContext2D, S:number, color:string, alpha:number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8
  const r = 40
  const w = r * 2
  const h = Math.sqrt(3) * r
  for (let row = -1; row < S/h + 1; row++) {
    for (let col = -1; col < S/w + 1; col++) {
      const cx = col * w * 0.75
      const cy = row * h + (col % 2 === 0 ? 0 : h/2)
      makeHexClip(ctx, cx, cy, r * 0.9)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// Barre de stat avec label
function drawStatBar(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, pct:number, color:string, label:string, value:string) {
  // Track
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill()
  // Fill
  const fw = Math.max(4, w * Math.min(1, pct))
  const g = ctx.createLinearGradient(x, 0, x+fw, 0)
  g.addColorStop(0, color+'cc'); g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.roundRect(x, y, fw, h, 3); ctx.fill()
  // Label left
  ctx.font = 'bold 14px Arial,sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y - 10)
  // Value right
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.fillText(value, x+w, y - 10)
}

function paintFrontCanvas(
  cfg: typeof RARITY[RK], name:string, grade:string,
  facts:string[], _imgUrl:string|null, isShiny:boolean,
  serieNum?: number, biome?: string, income?: number
): HTMLCanvasElement {
  const S=1024, cv=document.createElement('canvas')
  cv.width=S; cv.height=S
  const ctx=cv.getContext('2d')!

  // ── 1. FOND ────────────────────────────────────────────────────────────────
  // Base couleur profonde
  ctx.fillStyle = cfg.bg
  ctx.fillRect(0,0,S,S)
  // Radial ambiance centrale
  const amb = ctx.createRadialGradient(S/2, S*0.45, 0, S/2, S/2, S*0.8)
  amb.addColorStop(0, cfg.c+'22')
  amb.addColorStop(0.5, cfg.c+'08')
  amb.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = amb; ctx.fillRect(0,0,S,S)
  // Grille hexagonale de fond
  drawHexGrid(ctx, S, cfg.c, 0.06)
  // Traces circuit (rare+)
  if (['rare','epic','legendary','mythic'].includes(grade === 'F' ? 'common' : cfg.foil !== 'none' ? 'rare' : 'common')) {
    drawCircuitTraces(ctx, S, cfg.c, 0.08)
  }

  // ── 2. FOIL OVERLAY par rareté ─────────────────────────────────────────────
  if (cfg.foil === 'shimmer' || cfg.foil === 'holographic') {
    const foil = ctx.createLinearGradient(0,0,S,S*0.7)
    foil.addColorStop(0, 'rgba(255,255,255,0.03)')
    foil.addColorStop(0.3, cfg.c+'18')
    foil.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    foil.addColorStop(0.7, cfg.c+'12')
    foil.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = foil; ctx.fillRect(0,0,S,S)
  }
  if (cfg.foil === 'rainbow' || cfg.foil === 'prismatic') {
    const rainbow = ctx.createLinearGradient(0,0,S,S)
    rainbow.addColorStop(0,    'rgba(255,0,128,0.12)')
    rainbow.addColorStop(0.2,  'rgba(255,140,0,0.10)')
    rainbow.addColorStop(0.4,  'rgba(255,255,0,0.08)')
    rainbow.addColorStop(0.6,  'rgba(0,255,128,0.10)')
    rainbow.addColorStop(0.8,  'rgba(0,128,255,0.12)')
    rainbow.addColorStop(1,    'rgba(180,0,255,0.12)')
    ctx.fillStyle = rainbow; ctx.fillRect(0,0,S,S)
  }
  if (isShiny) {
    const shiny = ctx.createLinearGradient(S*0.2, 0, S*0.8, S)
    shiny.addColorStop(0, 'rgba(255,255,255,0.0)')
    shiny.addColorStop(0.4, cfg.c+'33')
    shiny.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    shiny.addColorStop(0.6, cfg.c+'33')
    shiny.addColorStop(1, 'rgba(255,255,255,0.0)')
    ctx.fillStyle = shiny; ctx.fillRect(0,0,S,S)
  }

  // ── 3. BORDURE CARTE (style selon rareté) ──────────────────────────────────
  const bw = cfg.borderStyle === 'double' ? 6 : 4
  ctx.strokeStyle = cfg.c
  ctx.lineWidth = bw
  ctx.globalAlpha = 0.8
  ctx.strokeRect(bw/2, bw/2, S-bw, S-bw)
  if (cfg.borderStyle === 'double') {
    ctx.strokeStyle = cfg.accent
    ctx.lineWidth = 1.5
    ctx.strokeRect(bw+4, bw+4, S-bw*2-8, S-bw*2-8)
  }
  // Coins découpés style cyberpunk
  ctx.globalAlpha = 1
  const cl = 28
  ctx.fillStyle = '#000'
  ;[[0,0],[S,0],[0,S],[S,S]].forEach(([cx,cy]) => {
    ctx.beginPath()
    if (cx===0&&cy===0) { ctx.moveTo(0,0); ctx.lineTo(cl,0); ctx.lineTo(0,cl) }
    else if (cx===S&&cy===0) { ctx.moveTo(S,0); ctx.lineTo(S-cl,0); ctx.lineTo(S,cl) }
    else if (cx===0&&cy===S) { ctx.moveTo(0,S); ctx.lineTo(cl,S); ctx.lineTo(0,S-cl) }
    else { ctx.moveTo(S,S); ctx.lineTo(S-cl,S); ctx.lineTo(S,S-cl) }
    ctx.closePath(); ctx.fill()
  })

  // ── 4. HEADER : rareté + grade badge + série ────────────────────────────────
  const headerH = 90
  // Bande header fond
  const hg = ctx.createLinearGradient(0,0,S,headerH)
  hg.addColorStop(0, cfg.c+'40'); hg.addColorStop(1, cfg.c+'10')
  ctx.fillStyle = hg; ctx.fillRect(0,0,S,headerH)
  ctx.strokeStyle = cfg.c+'66'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0,headerH); ctx.lineTo(S,headerH); ctx.stroke()

  // Grade badge hexagonal (gauche)
  ctx.save()
  makeHexClip(ctx, 58, headerH/2, 36)
  ctx.fillStyle = cfg.c; ctx.fill()
  ctx.strokeStyle = cfg.accent; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
  ctx.font = `900 28px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(grade, 58, headerH/2+1)

  // Label rareté (centre)
  ctx.font = `900 44px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = cfg.c
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  // Shadow glow
  if (cfg.glow > 0) {
    ctx.shadowColor = cfg.c; ctx.shadowBlur = cfg.glow
    ctx.fillText(cfg.label.toUpperCase(), S/2, headerH/2)
    ctx.shadowBlur = 0
  } else {
    ctx.fillText(cfg.label.toUpperCase(), S/2, headerH/2)
  }

  // Série (droite)
  if (serieNum != null) {
    const serieText = `#${serieNum}/${cfg.serieMax}`
    ctx.font = `bold 18px 'Courier New',monospace`
    ctx.fillStyle = cfg.accent + 'cc'
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(serieText, S-20, headerH/2)
  }
  if (isShiny) {
    ctx.font = `bold 22px Arial,sans-serif`
    ctx.fillStyle = '#FCD34D'
    ctx.shadowColor = '#FCD34D'; ctx.shadowBlur = 10
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('★ SHINY', S-20, serieNum != null ? headerH/2+20 : headerH/2)
    ctx.shadowBlur = 0
  }

  // ── 5. ZONE IMAGE : hex clipé avec terrain / biome overlay ─────────────────
  const imgTop = headerH + 12
  const imgH = 310
  const hexCX = S/2, hexCY = imgTop + imgH/2, hexR = 148

  ctx.save()
  makeHexClip(ctx, hexCX, hexCY, hexR)
  ctx.clip()
  // Fond biome avec dégradé directionnel
  const biomeColors: Record<string, [string,string]> = {
    urban:      ['#1a1f3a','#0d1128'], rural:    ['#1a2e12','#0d1a08'],
    forest:     ['#0e2415','#061209'], mountain: ['#1e1a14','#110f0a'],
    coastal:    ['#0d1e2e','#06121d'], desert:   ['#2e1e08','#1a1004'],
    tundra:     ['#12182e','#080d1a'], industrial:['#1a140e','#0d0908'],
    landmark:   ['#1a1228','#0d0914'], grassland: ['#152610','#0a1508'],
  }
  const [bc1, bc2] = biomeColors[biome || 'rural'] || ['#0d0f18','#020205']
  const bg2 = ctx.createLinearGradient(hexCX-hexR, imgTop, hexCX+hexR, imgTop+imgH)
  bg2.addColorStop(0, bc1); bg2.addColorStop(1, bc2)
  ctx.fillStyle = bg2; ctx.fillRect(0, imgTop, S, imgH)

  // Grille H3 de résolution 8 simulée dans la zone clip
  ctx.globalAlpha = 0.12; ctx.strokeStyle = cfg.c; ctx.lineWidth = 1
  const miniR = 22
  for (let row=-3; row<=4; row++) {
    for (let col=-4; col<=4; col++) {
      const mx = hexCX + col * miniR * 1.75
      const my = hexCY + row * miniR * Math.sqrt(3) + (col%2===0 ? 0 : miniR*Math.sqrt(3)/2)
      makeHexClip(ctx, mx, my, miniR * 0.88)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // Hex central mis en évidence
  ctx.strokeStyle = cfg.c; ctx.lineWidth = 3
  makeHexClip(ctx, hexCX, hexCY, miniR * 0.88)
  ctx.fillStyle = cfg.c+'30'; ctx.fill(); ctx.stroke()

  // Data overlay: coordonnées simulées
  ctx.font = `bold 13px 'Courier New',monospace`
  ctx.fillStyle = cfg.c + 'aa'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText(`${biome?.toUpperCase() || 'TERRAIN'} · RES.8`, hexCX, imgTop + imgH - 6)
  ctx.restore()

  // Bordure hex clipée
  ctx.save()
  makeHexClip(ctx, hexCX, hexCY, hexR)
  ctx.strokeStyle = cfg.c; ctx.lineWidth = 3
  if (cfg.glow > 0) { ctx.shadowColor = cfg.c; ctx.shadowBlur = cfg.glow }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()

  // Dégradé de fondu bas vers le fond
  const fadeOut = ctx.createLinearGradient(0, imgTop + imgH*0.6, 0, imgTop + imgH + 12)
  fadeOut.addColorStop(0, 'rgba(0,0,0,0)'); fadeOut.addColorStop(1, cfg.bg)
  ctx.fillStyle = fadeOut; ctx.fillRect(0, imgTop + imgH*0.6, S, imgH*0.4 + 12)

  // ── 6. NOM DU TERRITOIRE ───────────────────────────────────────────────────
  const nameY = imgTop + imgH + 14
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, nameY, S, 74)
  ctx.font = `900 42px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const shortName = name.length > 22 ? name.slice(0,20)+'…' : name
  ctx.fillText(shortName, S/2, nameY + 37)

  // Scanlines légers sur nom (rare+)
  if (cfg.scanlines) {
    ctx.save(); ctx.globalAlpha = 0.06
    for (let sy = nameY; sy < nameY+74; sy += 4) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, sy, S, 2)
    }
    ctx.restore()
  }

  // ── 7. SÉPARATEUR TECH ────────────────────────────────────────────────────
  const divY = nameY + 80
  ctx.strokeStyle = cfg.c + '60'; ctx.lineWidth = 1
  ctx.setLineDash([8, 4])
  ctx.beginPath(); ctx.moveTo(40, divY); ctx.lineTo(S-40, divY); ctx.stroke()
  ctx.setLineDash([])
  // Losange central sur séparateur
  ctx.save()
  ctx.translate(S/2, divY)
  ctx.rotate(Math.PI/4)
  ctx.fillStyle = cfg.c; ctx.fillRect(-5,-5,10,10)
  ctx.restore()

  // ── 8. STATS / PRODUCTION (barres de données) ─────────────────────────────
  const statsY = divY + 18
  const barW = S - 80
  const barH = 14
  const incomeVal = income || 10
  const maxIncome = 2000 // mythic max
  ;[
    { label: 'PRODUCTION HEX COIN', val: `+${incomeVal}/j`, pct: incomeVal/maxIncome, color: cfg.c },
    { label: 'INDICE GÉOPOLITIQUE',  val: `${Math.round(incomeVal/20 + 40)}/100`,    pct: (incomeVal/20+40)/100, color: cfg.accent },
  ].forEach((stat, i) => {
    drawStatBar(ctx, 40, statsY + i*52, barW, barH, stat.pct, stat.color, stat.label, stat.val)
  })

  // ── 9. 3 FACTS (liste compacte) ───────────────────────────────────────────
  const factStartY = statsY + 2*52 + 20
  ctx.fillStyle = cfg.c + 'aa'
  ctx.font = `bold 16px Arial,sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('INFORMATIONS', 40, factStartY)

  facts.slice(0,3).forEach((fact, i) => {
    const fy = factStartY + 28 + i * 54
    // Bullet hex
    ctx.save()
    makeHexClip(ctx, 54, fy+13, 12)
    ctx.fillStyle = cfg.c + '40'; ctx.fill()
    ctx.strokeStyle = cfg.c; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.restore()
    ctx.font = `bold 11px 'Courier New',monospace`
    ctx.fillStyle = cfg.c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${i+1}`, 54, fy+13)
    // Texte fact
    ctx.font = `16px Arial,sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    const maxW = S - 120
    const words = fact.split(' '); let line = '', ly = fy
    words.forEach(w => {
      const test = line ? line+' '+w : w
      if (ctx.measureText(test).width > maxW) { ctx.fillText(line,78,ly); line=w; ly+=18 }
      else line=test
    })
    ctx.fillText(line, 78, ly)
  })

  // ── 10. FOOTER ─────────────────────────────────────────────────────────────
  ctx.fillStyle = cfg.c + '20'; ctx.fillRect(0, S-46, S, 46)
  ctx.strokeStyle = cfg.c + '55'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, S-46); ctx.lineTo(S, S-46); ctx.stroke()
  ctx.font = `bold 15px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = cfg.c + 'cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('HEXOD  ·  SAISON 1  ·  ÉDITION GENÈSE', S/2, S-23)

  return cv
}

function paintBackCanvas(cfg: typeof RARITY[RK], h3:string, income:number, floor:number|null, isShiny:boolean, biome?: string, serieNum?: number): HTMLCanvasElement {
  const S=1024, cv=document.createElement('canvas')
  cv.width=S; cv.height=S
  const ctx=cv.getContext('2d')!

  // ── Fond ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = cfg.bg; ctx.fillRect(0,0,S,S)
  const amb = ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.7)
  amb.addColorStop(0, cfg.c+'1a'); amb.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle = amb; ctx.fillRect(0,0,S,S)

  // Tiling hexagone de fond (watermark)
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = cfg.c; ctx.lineWidth = 1
  const hr = 55
  for (let row=-1; row<S/hr/Math.sqrt(3)+1; row++) {
    for (let col=-1; col<S/(hr*1.5)+1; col++) {
      const hx = col * hr * 1.5 + hr * 0.75
      const hy = row * hr * Math.sqrt(3) + (col%2===0 ? 0 : hr*Math.sqrt(3)/2)
      makeHexClip(ctx, hx, hy, hr * 0.85)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // Bordure + coins cyberpunk (même style face avant)
  const bw = cfg.borderStyle === 'double' ? 6 : 4
  ctx.strokeStyle = cfg.c; ctx.lineWidth = bw; ctx.globalAlpha = 0.8
  ctx.strokeRect(bw/2,bw/2,S-bw,S-bw)
  if (cfg.borderStyle==='double') {
    ctx.strokeStyle=cfg.accent; ctx.lineWidth=1.5
    ctx.strokeRect(bw+4,bw+4,S-bw*2-8,S-bw*2-8)
  }
  ctx.globalAlpha = 1
  const cl=28; ctx.fillStyle='#000'
  ;[[0,0],[S,0],[0,S],[S,S]].forEach(([cx,cy])=>{
    ctx.beginPath()
    if(cx===0&&cy===0){ctx.moveTo(0,0);ctx.lineTo(cl,0);ctx.lineTo(0,cl)}
    else if(cx===S&&cy===0){ctx.moveTo(S,0);ctx.lineTo(S-cl,0);ctx.lineTo(S,cl)}
    else if(cx===0&&cy===S){ctx.moveTo(0,S);ctx.lineTo(cl,S);ctx.lineTo(0,S-cl)}
    else{ctx.moveTo(S,S);ctx.lineTo(S-cl,S);ctx.lineTo(S,S-cl)}
    ctx.closePath(); ctx.fill()
  })

  // Foil shiny
  if (isShiny) {
    const f=ctx.createLinearGradient(S*0.1,0,S*0.9,S)
    f.addColorStop(0,'rgba(0,0,0,0)'); f.addColorStop(0.35,cfg.c+'44')
    f.addColorStop(0.5,'rgba(255,255,255,0.14)'); f.addColorStop(0.65,cfg.c+'44')
    f.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=f; ctx.fillRect(0,0,S,S)
  }

  // ── Grand hex central avec HEXOD ──────────────────────────────────────────
  ctx.save()
  makeHexClip(ctx, S/2, S*0.35, 160)
  ctx.fillStyle = cfg.c+'12'; ctx.fill()
  ctx.strokeStyle = cfg.c; ctx.lineWidth = 3
  if (cfg.glow > 0) { ctx.shadowColor = cfg.c; ctx.shadowBlur = cfg.glow*1.5 }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()

  // Inner hex (double)
  ctx.save()
  makeHexClip(ctx, S/2, S*0.35, 130)
  ctx.strokeStyle = cfg.accent+'55'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()

  // Logo ⬡ + HEXOD
  ctx.font = `bold 70px Arial,sans-serif`
  ctx.fillStyle = cfg.c + '88'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('⬡', S/2, S*0.30)
  ctx.font = `900 54px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = cfg.accent
  if (cfg.glow>0) { ctx.shadowColor=cfg.c; ctx.shadowBlur=cfg.glow }
  ctx.fillText('HEXOD', S/2, S*0.39)
  ctx.shadowBlur = 0

  // ── Séparateur ────────────────────────────────────────────────────────────
  const sepY = S*0.49
  ctx.strokeStyle = cfg.c+'50'; ctx.lineWidth=1; ctx.setLineDash([6,4])
  ctx.beginPath(); ctx.moveTo(60,sepY); ctx.lineTo(S-60,sepY); ctx.stroke()
  ctx.setLineDash([])

  // ── Stats production (barres de données) ──────────────────────────────────
  const statsTop = sepY + 30
  const barW = S - 120
  const RARITY_MAX_INCOME: Record<string,number> = {common:10,uncommon:30,rare:80,epic:200,legendary:500,mythic:2000}
  const maxI = Math.max(...Object.values(RARITY_MAX_INCOME))
  ;[
    { label:'REVENU HEX COIN / JOUR', val:`+${income}`, pct: income/maxI, color: cfg.c },
    { label:'VALEUR PLANCHER',        val: floor ? `${floor} HEX` : 'N/A', pct: floor ? Math.min(1,floor/5000) : 0, color: cfg.accent },
  ].forEach((s, i) => {
    drawStatBar(ctx, 60, statsTop + i*58, barW, 16, s.pct, s.color, s.label, s.val)
  })

  // ── Metadata technique ────────────────────────────────────────────────────
  const metaTop = statsTop + 2*58 + 24
  ctx.fillStyle = cfg.c+'33'
  ctx.beginPath(); ctx.roundRect(60, metaTop, S-120, 140, 8); ctx.fill()
  ctx.strokeStyle = cfg.c+'44'; ctx.lineWidth=1; ctx.stroke()

  const metaItems = [
    ['BIOME',       biome?.toUpperCase() || 'UNKNOWN'],
    ['H3 INDEX',    h3.slice(0,15)+'…'],
    ['COLLECTION',  'SAISON 1 · GENÈSE'],
    ['STANDARD',    'METAPLEX · SOLANA'],
    ['ROYALTIES',   '5% · HEXOD TREASURY'],
    ['SÉRIE',       serieNum != null ? `#${serieNum}/${cfg.serieMax}` : 'UNIQUE'],
  ]
  metaItems.forEach(([k, v], i) => {
    const row = Math.floor(i/2)
    const col = i%2
    const mx = 80 + col * (S-120)/2
    const my = metaTop + 22 + row * 42
    ctx.font = `bold 12px 'Courier New',monospace`
    ctx.fillStyle = cfg.c+'88'; ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText(k, mx, my)
    ctx.font = `bold 14px 'Courier New',monospace`
    ctx.fillStyle = cfg.accent; ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText(v, mx, my+16)
  })

  // ── Hash H3 (QR-like pattern) ─────────────────────────────────────────────
  const qrTop = metaTop + 158
  const qrSize = 80; const cellSz = 8; const cols2 = Math.floor(qrSize/cellSz)
  // Générer pattern pseudo-aléatoire déterministe depuis h3
  let seed = h3.split('').reduce((a,c) => a+c.charCodeAt(0), 0)
  const rand = () => { seed=(seed*16807+1)%2147483647; return (seed%100)/100 }
  for (let r2=0; r2<cols2; r2++) {
    for (let c2=0; c2<cols2; c2++) {
      if (rand() > 0.5) {
        ctx.fillStyle = rand()>0.7 ? cfg.c : cfg.c+'66'
        ctx.fillRect(S/2 - qrSize/2 + c2*cellSz, qrTop + r2*cellSz, cellSz-1, cellSz-1)
      }
    }
  }
  // Label sous QR
  ctx.font = `11px 'Courier New',monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.fillText(h3.slice(0,18), S/2, qrTop + qrSize + 6)

  // ── Footer ────────────────────────────────────────────────────────────────
  ctx.fillStyle = cfg.c+'20'; ctx.fillRect(0,S-46,S,46)
  ctx.strokeStyle = cfg.c+'55'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(0,S-46); ctx.lineTo(S,S-46); ctx.stroke()
  ctx.font = `bold 15px 'Arial Black',Arial,sans-serif`
  ctx.fillStyle = cfg.c+'cc'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText('NFT · HEXOD · SAISON 1', S/2, S-23)

  return cv
}


const BRANCHES = [
  { id:'attack',    ang:-90,  color:'#EF4444', icon:'⚔️', label:'Attaque'     },
  { id:'defense',   ang:-26,  color:'#3B82F6', icon:'🛡️', label:'Défense'     },
  { id:'economy',   ang: 38,  color:'#F59E0B', icon:'💰', label:'Économie'    },
  { id:'influence', ang:102,  color:'#10B981', icon:'🌐', label:'Influence'   },
  { id:'tech',      ang:166,  color:'#8B5CF6', icon:'🔬', label:'Technologie' },
] as const

function SkillTreeSVG({ tree, kingdom, cfg, onUnlock }: {
  tree:Record<string,any[]>; kingdom:any; cfg:typeof RARITY[RK]; onUnlock:(id:number)=>void
}) {
  const [hover,setHover]=useState<number|null>(null)
  const [selectedBranch,setSelectedBranch]=useState<string|null>(null)
  const W=520,H=480,cx=W/2,cy=H/2-10
  const BR=125, NR=20, SR=14, GAP=50

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',margin:'0 auto',overflow:'visible'}}>
      <defs>
        {BRANCHES.map(b=>(
          <filter key={b.id} id={`gsf-${b.id}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="bl"/>
            <feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
        <filter id="gsf-center" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="bl"/>
          <feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {BRANCHES.map(b=>{
        const rad=(b.ang*Math.PI)/180
        const bx=cx+Math.cos(rad)*BR, by=cy+Math.sin(rad)*BR
        const skills=tree[b.id]||[]
        const isHigh=selectedBranch===b.id

        return (
          <g key={b.id}>
            {/* Center → branch */}
            <line x1={cx} y1={cy} x2={bx} y2={by}
              stroke={b.color} strokeWidth={isHigh?2.5:1.5}
              strokeOpacity={isHigh?0.95:0.35}
              strokeDasharray={isHigh?undefined:'5,4'} />

            {/* Branch root */}
            <g style={{cursor:'pointer'}} onClick={()=>setSelectedBranch(s=>s===b.id?null:b.id)}>
              <circle cx={bx} cy={by} r={NR+4} fill={b.color+'15'}
                stroke={b.color} strokeWidth={isHigh?2.5:1.5} strokeOpacity={isHigh?1:0.5}
                filter={isHigh?`url(#gsf-${b.id})`:undefined} />
              <text x={bx} y={by} textAnchor="middle" dominantBaseline="central"
                fontSize={16} style={{pointerEvents:'none'}}>{b.icon}</text>
              <text x={bx} y={by+NR+14} textAnchor="middle"
                fontSize={9} fill={b.color} fontWeight={700} style={{pointerEvents:'none'}}>
                {b.label}
              </text>
              {/* Unlocked count */}
              <text x={bx} y={by+NR+25} textAnchor="middle"
                fontSize={8} fill={b.color+'99'} style={{pointerEvents:'none'}}>
                {skills.filter((s:any)=>s.unlocked).length}/{skills.length}
              </text>
            </g>

            {/* ALL skills along branch — always visible */}
            {skills.map((s:any,i:number)=>{
              const dist=BR+NR+8+i*GAP
              const sx=cx+Math.cos(rad)*dist, sy=cy+Math.sin(rad)*dist
              const prevDist=i===0?BR:BR+NR+8+(i-1)*GAP
              const px=cx+Math.cos(rad)*prevDist, py=cy+Math.sin(rad)*prevDist
              const isHov=hover===s.id

              return (
                <g key={s.id}>
                  {/* Connector */}
                  <line x1={px} y1={py} x2={sx} y2={sy}
                    stroke={b.color} strokeWidth={1.5}
                    strokeOpacity={s.unlocked?0.85:0.2}
                    strokeDasharray={s.unlocked?undefined:'3,4'} />

                  {/* Skill node */}
                  <g style={{cursor:'pointer'}}
                    onMouseEnter={()=>setHover(s.id)} onMouseLeave={()=>setHover(null)}>
                    <circle cx={sx} cy={sy} r={SR+3} fill={s.unlocked?b.color+'22':'rgba(10,10,20,0.9)'}
                      stroke={b.color} strokeWidth={s.unlocked?2:1}
                      strokeOpacity={s.unlocked?1:0.35}
                      filter={s.unlocked?`url(#gsf-${b.id})`:undefined} />
                    <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central"
                      fontSize={11} style={{pointerEvents:'none'}} opacity={s.unlocked?1:0.5}>
                      {s.icon}
                    </text>
                    {/* Unlocked checkmark */}
                    {s.unlocked&&(
                      <circle cx={sx+SR+1} cy={sy-SR+1} r={7} fill="#00FF87">
                        <title>Débloquée</title>
                      </circle>
                    )}
                    {s.unlocked&&(
                      <text x={sx+SR+1} y={sy-SR+2} textAnchor="middle" dominantBaseline="central"
                        fontSize={8} fill="#000" fontWeight={900} style={{pointerEvents:'none'}}>✓</text>
                    )}

                    {/* Hover tooltip */}
                    {isHov&&(
                      <g>
                        <rect x={sx-90} y={sy-72} width={180} height={68} rx={7}
                          fill="rgba(4,4,20,0.98)" stroke={b.color} strokeWidth={1.5} />
                        <text x={sx} y={sy-57} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">
                          {s.name.slice(0,22)}
                        </text>
                        <text x={sx} y={sy-40} textAnchor="middle" fontSize={9} fill={b.color}>
                          {s.effect.slice(0,28)}
                        </text>
                        <text x={sx} y={sy-24} textAnchor="middle" fontSize={8} fill="#6B7280">
                          {s.cost_json.slice(0,2).join(' · ')}
                        </text>
                        {!s.unlocked&&kingdom?.is_main&&(
                          <text x={sx} y={sy-10} textAnchor="middle" fontSize={9} fill="#10B981"
                            style={{cursor:'pointer'}} onClick={()=>onUnlock(s.id)}>
                            ▶ Débloquer
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={34} fill="rgba(245,158,11,0.15)" stroke="#F59E0B" strokeWidth={2.5}
        filter="url(#gsf-center)" />
      <text x={cx} y={cy-5} textAnchor="middle" dominantBaseline="central" fontSize={24} fill="#F59E0B">⬡</text>
      <text x={cx} y={cy+18} textAnchor="middle" fontSize={9} fill="#F59E0B" fontWeight={800} letterSpacing="2">
        HEXOD
      </text>
    </svg>
  )
}



/* ── Kingdom tab ─────────────────────────────────────────── */
function KingdomTab({ t, cfg }: { t:any; cfg:typeof RARITY[RK] }) {
  const qc=useQueryClient()
  const clusterId=t.owner_kingdom_id||'main'

  const {data}=useQuery({
    queryKey:['kingdom-skills',clusterId],
    queryFn:()=>api.get(`/territories-geo/kingdom-skill-tree/?cluster_id=${clusterId}`).then(r=>r.data),
    staleTime:15000,
  })

  const unlock=useMutation({
    mutationFn:(id:number)=>api.post('/territories-geo/kingdom-unlock-skill/',{cluster_id:clusterId,skill_id:id}),
    onSuccess:()=>{ toast.success('Compétence débloquée!'); qc.invalidateQueries({queryKey:['kingdom-skills',clusterId]}) },
    onError:(e:any)=>toast.error(e?.response?.data?.error||'Ressources insuffisantes'),
  })

  const tree=data?.tree||{}
  const kingdom=data?.kingdom||{}
  const resources=kingdom.resources||{}
  const biomeRes=BIOME_RES_MAPPED[t.territory_type||'rural']||BIOME_RES_MAPPED.rural
  const income=Math.round((t.resource_credits||t.food_per_tick||10)*288)

  const RES_LABELS: Record<string,string> = {
    fer:'🪨',petrole:'🛢️',silicium:'💠',donnees:'📊',
    hex_cristaux:'💎',influence:'🌐',acier:'⚙️',
    terres_rares:'💎',composants:'🔌',uranium:'☢️',
  }

  return (
    <div>
      {/* Kingdom status */}
      <div style={{padding:'8px 10px',borderRadius:8,marginBottom:10,
        background:kingdom.is_main?`${cfg.c}12`:'rgba(255,255,255,0.03)',
        border:`1px solid ${kingdom.is_main?cfg.c+'33':'rgba(255,255,255,0.07)'}`}}>
        <span style={{fontSize:11,fontWeight:700,color:kingdom.is_main?cfg.c:'#6B7280'}}>
          {kingdom.is_main?'👑 Royaume Principal':kingdom.size<=1?'🏴 Territoire Isolé — arbre repart à 0':'🏰 Royaume Secondaire'}
        </span>
        <span style={{fontSize:10,color:'#4B5563',marginLeft:8}}>
          {kingdom.size||0} territoires · Tier {kingdom.tier||0}
        </span>
      </div>

      {/* Production */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Production / jour</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:12}}>
        {biomeRes.map((r:any)=>(
          <div key={r.res} style={{background:'rgba(255,255,255,0.04)',borderRadius:7,padding:'6px 4px',textAlign:'center'}}>
            <div style={{fontSize:14}}>{r.icon}</div>
            <div style={{fontSize:10,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{r.amount*288}</div>
            <div style={{fontSize:7,color:'#4B5563',marginTop:1}}>{r.res.slice(0,9)}</div>
          </div>
        ))}
        <div style={{background:`${cfg.c}12`,borderRadius:7,padding:'6px 4px',textAlign:'center',border:`1px solid ${cfg.c}22`}}>
          <div style={{fontSize:14}}>💠</div>
          <div style={{fontSize:10,fontWeight:800,color:cfg.c,fontFamily:'monospace'}}>+{income}</div>
          <div style={{fontSize:7,color:cfg.c,marginTop:1}}>HEX Coin</div>
        </div>
      </div>

      {/* Available resources for skill tree — avec tooltips (Marie spec) */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>
        Ressources du royaume — allouer aux compétences
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
        {Object.entries(resources)
          .filter(([k,v]) => k.startsWith('res_') && (v as number) > 0)
          .sort(([,a],[,b]) => (b as number)-(a as number))
          .map(([k,v]) => (
            <ResourceBadge key={k} resource={k} value={v as number} />
          ))}
        {Object.keys(resources).filter(k=>k.startsWith('res_')&&(resources[k] as number)>0).length===0&&(
          <span style={{fontSize:10,color:'#374151'}}>Aucune ressource — agrandissez votre royaume</span>
        )}
      </div>

      {/* Skill tree */}
      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>
        Arbre des compétences — hover pour détails · cliquer pour débloquer
      </div>
      <SkillTreeSVG tree={tree} kingdom={kingdom} cfg={cfg}
        onUnlock={(id)=>unlock.mutate(id)} />
    </div>
  )
}


/* ── WebGL Card with Context Lost + LOD + GPU fallback (Artist3D spec) ─── */
function WebGLCardWithFallback({ frontCv, backCv, cfg, showBack, isShiny, isNewClaim }: {
  frontCv: HTMLCanvasElement; backCv: HTMLCanvasElement
  cfg: typeof RARITY[RK]; showBack: boolean; isShiny: boolean; isNewClaim?: boolean
}) {
  const [revealed, setRevealed] = useState(!isNewClaim)

  useEffect(() => {
    if (!isNewClaim) { setRevealed(true); return }
    const t = setTimeout(() => setRevealed(true), 100)
    return () => clearTimeout(t)
  }, [isNewClaim])

  const revealStyle = isNewClaim && !revealed ? {
    transform: 'translateY(60px) rotateY(180deg) scale(0.6)',
    opacity: 0,
  } : {
    transform: 'translateY(0) rotateY(0deg) scale(1)',
    opacity: 1,
    transition: 'transform 0.9s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.5s ease',
  }

  // Always use CSS3D — WebGL causes Context Lost crashes in constrained environments
  return (
    <div style={{ zIndex:1, flexShrink:0, ...revealStyle }}>
      <CSS3DCard frontCv={frontCv} cfg={cfg} showBack={showBack} isShiny={isShiny} />
    </div>
  )
}

/* ── CSS 3D Card — no WebGL needed ──────────────────────── */
function CSS3DCard({ frontCv, cfg, showBack, isShiny }: {
  frontCv: HTMLCanvasElement; cfg: typeof RARITY[RK]; showBack: boolean; isShiny: boolean
}) {
  const [rotY, setRotY] = useState(-12)
  const [rotX, setRotX] = useState(6)
  const dragRef = useRef<{active:boolean;lx:number;ly:number;vy:number;vx:number}>({active:false,lx:0,ly:0,vy:-0.3,vx:0})
  const rafRef  = useRef<number>()
  const cardRef = useRef<HTMLDivElement>(null!)

  // Inertia animation
  useEffect(() => {
    const tick = () => {
      const d = dragRef.current
      if (!d.active) {
        d.vy *= 0.93; d.vx *= 0.93
        setRotY(r => r + d.vy)
        setRotX(r => Math.max(-25, Math.min(25, r + d.vx)))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const d = dragRef.current; d.active=true; d.lx=e.clientX; d.ly=e.clientY; d.vy=0; d.vx=0
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if(!d.active)return
    d.vy=(e.clientX-d.lx)*0.4; d.vx=-(e.clientY-d.ly)*0.25
    setRotY(r=>r+d.vy); setRotX(r=>Math.max(-25,Math.min(25,r+d.vx)))
    d.lx=e.clientX; d.ly=e.clientY
  }
  const onPointerUp = () => { dragRef.current.active=false }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    // Scale the card on wheel
    const el = cardRef.current?.parentElement
    if(el){ const s=parseFloat(el.style.transform?.match(/scale\((.*?)\)/)?.[1]||'1'); el.style.transform=`scale(${Math.max(0.5,Math.min(2,s-e.deltaY*0.001))})` }
  }

  // Get canvas dataURL for CSS background
  const frontUrl = useMemo(() => frontCv.toDataURL('image/png'), [frontCv])

  const shimmer = isShiny ? `linear-gradient(135deg, ${cfg.c}44 0%, rgba(255,215,0,0.3) 50%, ${cfg.c}44 100%)` : 'none'

  return (
    <div style={{ width:240, height:272, cursor:'grab', zIndex:1, flexShrink:0, perspective:800 }}
      ref={cardRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
    >
      <div style={{
        width:'100%', height:'100%', position:'relative',
        transformStyle:'preserve-3d',
        transform: `rotateY(${showBack?rotY+180:rotY}deg) rotateX(${rotX}deg)`,
        transition: 'transform 0.05s linear',
      }}>
        {/* FRONT FACE */}
        <div style={{
          position:'absolute', inset:0, backfaceVisibility:'hidden',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundImage: `url(${frontUrl})`,
          backgroundSize: 'cover',
          boxShadow: `0 0 30px ${cfg.c}66, 0 8px 32px rgba(0,0,0,0.8)`,
          border: `2px solid ${cfg.c}88`,
        }}>
          {isShiny && <div style={{
            position:'absolute', inset:0, borderRadius:12,
            backgroundImage: shimmer,
            animation: 'shinyShimmer 2s ease-in-out infinite',
          }} />}
        </div>

        {/* BACK FACE */}
        <div style={{
          position:'absolute', inset:0, backfaceVisibility:'hidden',
          transform: 'rotateY(180deg)',
          borderRadius: '14px',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${cfg.bg} 0%, #020205 100%)`,
          boxShadow: `0 0 30px ${cfg.c}66, 0 8px 32px rgba(0,0,0,0.8)`,
          border: `2px solid ${cfg.c}88`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Hex watermark pattern */}
          <div style={{
            position:'absolute', inset:0, opacity:0.08,
            backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='70'><text y='50' font-size='40' fill='${encodeURIComponent(cfg.c)}'>⬡</text></svg>")`,
            backgroundRepeat: 'repeat',
          }} />
          <div style={{ position:'relative', textAlign:'center' }}>
            <div style={{ fontSize:64, lineHeight:1 }}>⬡</div>
            <div style={{ fontSize:22, fontWeight:900, color:cfg.accent, letterSpacing:4, marginTop:8 }}>HEXOD</div>
            <div style={{ fontSize:11, color:cfg.c+'aa', marginTop:6 }}>Saison 1 · Édition Genèse</div>
          </div>
          {isShiny && <div style={{
            position:'absolute', inset:0, borderRadius:12,
            backgroundImage: shimmer,
            animation: 'shinyShimmer 2s ease-in-out infinite',
          }} />}
        </div>
      </div>

      <style>{`
        @keyframes shinyShimmer {
          0%,100% { opacity:0.4; background-position:0% 50%; }
          50%      { opacity:0.8; background-position:100% 50%; }
        }
      `}</style>
    </div>
  )
}

/* ── Main HexCard ────────────────────────────────────────── */
export function HexCard({ territory:t, onClose, onRequestClaim, isNewClaim = false }:{
  territory:any; onClose:()=>void; onRequestClaim?:()=>void; isNewClaim?: boolean
}) {
  const player=usePlayer()
  const isOwned=t.owner_id===player?.id
  const isEnemy=!!t.owner_id&&!isOwned
  const isFree=!t.owner_id
  const rarity=(t.rarity||'common') as RK
  const cfg=RARITY[rarity]??RARITY.common
  const isShiny=!!t.is_shiny

  const cardName=t.custom_name||t.poi_name||t.place_name||'Zone'
  const imgUrl=null  // No external images (rate limit)
  const income=Math.round((t.resource_credits||t.food_per_tick||10)*288)

  const facts=useMemo(()=>{
    const r=[]
    if(t.poi_visitors) r.push(`${(t.poi_visitors/1e6).toFixed(1)}M visiteurs / an`)
    if(t.poi_geo_score) r.push(`Score géopolitique : ${t.poi_geo_score}/100`)
    if(t.poi_fun_fact) r.push(t.poi_fun_fact.slice(0,90))
    if(t.poi_description&&r.length<3) r.push(t.poi_description.slice(0,90))
    while(r.length<3) r.push('Territoire unique · Hexod Saison 1')
    return r.slice(0,3)
  },[t])

  const biome  = t.territory_type || t.biome || 'rural'
  const serieNum = t.token_id ? (parseInt(String(t.token_id)) % cfg.serieMax) + 1 : undefined
  const frontCv = useMemo(() =>
    paintFrontCanvas(cfg, cardName, cfg.grade, facts, imgUrl, isShiny, serieNum, biome, income),
    [cfg, cardName, facts, imgUrl, isShiny, serieNum, biome, income]
  )
  const backCv  = useMemo(() =>
    paintBackCanvas(cfg, t.h3_index||'', income, t.poi_floor_price||null, isShiny, biome, serieNum),
    [cfg, t.h3_index, income, t.poi_floor_price, isShiny, biome, serieNum]
  )

  const [tab,setTab]=useState<'card'|'kingdom'|'nft'>('card')
  const [showBack,setShowBack]=useState(false)
  const [show3D,setShow3D]=useState(false)

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:'fixed',inset:0,zIndex:1200,display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:10,
        background:'rgba(0,0,0,0.92)',backdropFilter:'blur(20px)',padding:'10px'}}
    >
      {/* Ambient */}
      <div style={{position:'absolute',width:420,height:420,pointerEvents:'none',
        background:`radial-gradient(ellipse 55% 55% at 50% 42%,${cfg.c}1a 0%,transparent 70%)`,
        filter:'blur(50px)'}} />

      {/* Three.js 3D card — avec context lost handler + LOD + GPU detection */}
      <WebGLCardWithFallback
        frontCv={frontCv} backCv={backCv}
        cfg={cfg} showBack={showBack} isShiny={isShiny}
        isNewClaim={isNewClaim}
      />

      {/* Label + flip */}
      <div style={{display:'flex',alignItems:'center',gap:10,zIndex:1}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{cardName}</div>
          <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:3}}>
            <Chip color={cfg.c}>{cfg.label}</Chip>
            {isShiny&&<Chip color="#FCD34D">✨ Shiny</Chip>}
            <Chip color={cfg.c} big>Grade {cfg.grade}</Chip>
          </div>
        </div>
        <button onClick={()=>setShowBack(v=>!v)} style={{
          padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,
          background:`${cfg.c}18`,border:`1px solid ${cfg.c}44`,color:cfg.c,flexShrink:0,
        }}>{showBack?'🃏 Face':'🔄 Dos'}</button>
      </div>

      {/* Info panel */}
      {isOwned?(
        <div style={{width:330,background:'rgba(4,4,12,0.99)',border:`1px solid ${cfg.c}44`,
          borderRadius:14,overflow:'hidden',zIndex:1,maxHeight:'46vh',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',borderBottom:`1px solid ${cfg.c}22`,flexShrink:0}}>
            {(['card','kingdom','nft'] as const).map(tb=>(
              <button key={tb} onClick={()=>setTab(tb)} style={{
                flex:1,padding:'8px 0',border:'none',cursor:'pointer',
                fontSize:10,fontWeight:tab===tb?800:400,
                background:tab===tb?`${cfg.c}14`:'transparent',
                borderBottom:`2px solid ${tab===tb?cfg.c:'transparent'}`,
                color:tab===tb?cfg.c:'#4B5563',
              }}>{tb==='card'?'🃏 Carte':tb==='kingdom'?'⚗️ Royaume':'💎 NFT'}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
            {tab==='card'&&(
              <div>
                {imgUrl&&<img src={imgUrl} alt={cardName} style={{width:'100%',height:70,objectFit:'cover',borderRadius:7,marginBottom:8}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />}
                <div style={{padding:'8px 10px',borderRadius:8,background:`${cfg.c}0e`,border:`1px solid ${cfg.c}22`,marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:800,color:cfg.accent,marginBottom:5}}>Caractéristiques</div>
                  {facts.map((f,i)=>(
                    <div key={i} style={{display:'flex',gap:5,marginBottom:4}}>
                      <span style={{color:cfg.c,fontWeight:700,flexShrink:0}}>#{i+1}</span>
                      <span style={{fontSize:10,color:'#9CA3AF',lineHeight:1.4}}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Ressources produites par ce territoire (Marie: tooltip expliquant l'utilité) */}
                {(() => {
                  const resEntries = Object.entries(t as Record<string,any>)
                    .filter(([k,v]) => k.startsWith('res_') && typeof v === 'number' && v > 0)
                    .sort(([,a],[,b]) => (b as number)-(a as number))
                  if (!resEntries.length) return null
                  return (
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:9,color:'#4B5563',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>
                        Production journalière
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {resEntries.slice(0,6).map(([k,v])=>(
                          <ResourceBadge key={k} resource={k} value={v as number} />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <KV label="H3 Index" val={(t.h3_index||'').slice(0,16)+'…'} mono />
                <KV label="Grade" val={cfg.grade} color={cfg.c} />
                <KV label="Biome" val={(t.territory_type || t.biome || 'rural').toUpperCase()} />
              </div>
            )}
            {tab==='kingdom'&&<KingdomTab t={t} cfg={cfg} />}
            {tab==='nft'&&(
              <div>
                <div style={{padding:'10px 12px',background:'rgba(139,92,246,0.08)',borderRadius:10,border:'1px solid rgba(139,92,246,0.2)',marginBottom:10}}>
                  <KV label="Token ID" val={t.token_id||`HEX-${(t.h3_index||'').slice(0,8).toUpperCase()}`} mono />
                  <KV label="H3 Index" val={(t.h3_index||'').slice(0,18)+'…'} mono />
                  <KV label="Édition" val="Genèse · Saison 1" />
                  <KV label="Rareté" val={cfg.label} color={cfg.c} />
                  <KV label="Grade" val={cfg.grade} color={cfg.c} />
                  {isShiny&&<KV label="Shiny" val="✨ 1/64 — Rarissime" color="#FCD34D" />}
                  {t.poi_floor_price&&<KV label="Floor" val={`${t.poi_floor_price} HEX`} color={cfg.c} />}
                </div>
                <div style={{display:'flex',gap:7}}>
                  <button style={{flex:1,padding:'9px',border:`1px solid ${cfg.c}44`,borderRadius:8,cursor:'pointer',background:`${cfg.c}14`,color:cfg.c,fontSize:11,fontWeight:700}}>💎 Minter</button>
                  <button style={{flex:1,padding:'9px',border:'1px solid rgba(59,130,246,0.35)',borderRadius:8,cursor:'pointer',background:'rgba(59,130,246,0.1)',color:'#60A5FA',fontSize:11,fontWeight:700}}
                    onClick={()=>useStore.getState().setActivePanel('marketplace')}>🏪 Marché</button>
                </div>
                <button onClick={()=>setShow3D(true)} style={{
                  width:'100%',marginTop:7,padding:'10px',borderRadius:8,border:'none',cursor:'pointer',
                  background:'linear-gradient(90deg,#D4AF37,#CD7F32)',color:'#fff',
                  fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Orbitron',sans-serif",
                  boxShadow:'0 4px 15px rgba(212,175,55,0.3)',
                }}>◆ VIEW 3D — VAULT PRESTIGE</button>
              </div>
            )}
          </div>
        </div>
      ):(
        <div style={{width:290,background:'rgba(4,4,12,0.99)',border:`1px solid ${cfg.c}44`,borderRadius:14,padding:'12px 14px',zIndex:1}}>
          {t.poi_description&&<div style={{fontSize:11,color:'#9CA3AF',marginBottom:10,lineHeight:1.5}}>{t.poi_description.slice(0,110)}{t.poi_description.length>110?'…':''}</div>}
          <div style={{display:'flex',gap:10,marginBottom:12,fontSize:11}}>
            <span style={{color:'#F59E0B'}}>💰 +{income} HEX Coin/jour</span>
            {t.poi_floor_price&&<span style={{color:cfg.c}}>💎 {t.poi_floor_price} HEX</span>}
            {isEnemy&&<span style={{color:'#F87171'}}>👤 {t.owner_username}</span>}
          </div>
          {isFree&&player&&(
            <button onClick={onRequestClaim} style={{
              width:'100%',padding:'12px',border:'none',borderRadius:10,cursor:'pointer',
              background:`linear-gradient(135deg,${cfg.c}cc,${cfg.c})`,
              color:['legendary','mythic','epic'].includes(rarity)?'#000':'#fff',
              fontSize:14,fontWeight:900,
              boxShadow:`0 4px 24px ${cfg.c}44`,
            }}>🏴 Revendiquer {cardName.slice(0,20)}</button>
          )}
          {isEnemy&&(
            <button onClick={onRequestClaim} style={{
              width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',
              border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.1)',
              color:'#EF4444',fontSize:13,fontWeight:700,
            }}>⚔️ Attaquer · 💸 Acheter</button>
          )}
        </div>
      )}

      <div style={{fontSize:9,color:'#1F2937',zIndex:1}}>Glisser pour tourner · Cliquer hors pour fermer</div>

      <Token3DViewer
        visible={show3D}
        onClose={()=>setShow3D(false)}
        tokenName={cardName.toUpperCase()}
        category={(t.poi_category||biome).toUpperCase()}
        catColor={cfg.c}
        tier={rarity==='mythic'?'EMERALD':rarity==='legendary'?'GOLD':rarity==='epic'?'SILVER':'BRONZE'}
        serial={serieNum||1}
        maxSupply={cfg.serieMax}
        edition="GENESIS"
        biome={biome.toUpperCase()}
        power={t.poi_geo_score||Math.floor(Math.random()*50)+50}
        rarity={rarity==='mythic'?99:rarity==='legendary'?95:rarity==='epic'?85:rarity==='rare'?70:rarity==='uncommon'?50:30}
      />
    </motion.div>
  )
}

function Chip({children,color,big}:any) {
  return <span style={{fontSize:big?11:9,padding:big?'3px 9px':'2px 6px',borderRadius:4,background:`${color}18`,color,border:`1px solid ${color}33`,fontWeight:700}}>{children}</span>
}
function KV({label,val,color,mono}:any) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:11}}>
      <span style={{color:'#6B7280'}}>{label}</span>
      <span style={{color:color||'#E5E7EB',fontWeight:600,fontFamily:mono?'monospace':undefined}}>{val}</span>
    </div>
  )
}
