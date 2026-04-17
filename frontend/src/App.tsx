/**
 * App.tsx — HEXOD root component with routing and panel system.
 */
import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { api } from './services/api'
import { useGameSocket } from './hooks/useGameSocket'
import { ErrorBoundary } from './components/ui/Utils'
import { GameMap } from './components/map/GameMap'
import { WakeUpDigest } from './components/onboarding/Tutorial'
import { OnboardingHotspots } from './components/onboarding/OnboardingHotspots'

// ─── HEXOD Shell Components ─────────────────────────────────
import { NewsTicker } from './components/shared/NewsTicker'
import { HexodTopHUD } from './components/shared/HexodTopHUD'
import { HexodDock } from './components/shared/HexodDock'
import { RadarWidget } from './components/shared/RadarWidget'
import { IconSVG } from './components/shared/iconBank'
import { ClaimProgressBar } from './components/shared/ClaimProgressBar'
import { usePendingClaims } from './hooks/usePendingClaims'
import { DayCycleWidget } from './components/shared/DayCycleWidget'
import { LoadingGlobe } from './components/shared/LoadingGlobe'

// ─── Panel Components ───────────────────────────────────────
import { CombatPanel } from './components/hud/CombatPanel'
import { EventsPanel } from './components/hud/EventsPanel'
import { ProfilePanel } from './components/hud/ProfilePanel'
import { AlliancePanel } from './components/alliance/AlliancePanel'
import { TradePanel } from './components/hud/TradePanel'
import { CryptoPanel } from './components/crypto/CryptoPanel'
import { ShopPanel } from './components/shop/ShopPanel'
import { LadderPanel } from './components/hud/LadderPanel'
import { MetaDashboard } from './components/hud/MetaDashboard'
import { InfoPanel } from './components/hud/InfoPanel'
import { MarketplacePanel } from './components/crypto/MarketplacePanel'
import { KingdomPanel } from './components/kingdom/KingdomPanel'
import { EmpirePanel } from './components/kingdom/EmpirePanel'
import { CodexPanel } from './components/hud/CodexPanel'
import { DailyHuntPanel } from './components/hud/DailyHuntPanel'
import { TaskCenter } from './components/hud/TaskCenter'
import { AuctionPanel } from './components/hud/AuctionPanel'

// ─── Providers ──────────────────────────────────────────────
import { WalletProvider } from './components/crypto/WalletProvider'

// WakeUpDigest connecté à l'API
function WakeUpDigestConnected() {
  const [show, setShow] = useState(false)
  const [digestData, setDigestData] = useState<any>(null)
  const player = useStore(s => s.player)
  const isAuthenticated = useStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated || !player) return
    const lastLogin = localStorage.getItem('hx_last_login')
    const now = Date.now()
    const offlineMs = lastLogin ? now - parseInt(lastLogin) : 0
    const offlineH = offlineMs / 3600000
    localStorage.setItem('hx_last_login', String(now))
    if (offlineH < 0.5) return  // Moins de 30min offline → pas de digest

    api.get('/progression/offline-summary/').then(r => {
      const d = r.data
      if (d.new_tdc > 0 || d.battles?.length > 0) {
        setDigestData({ ...d, offlineHours: offlineH })
        setShow(true)
      }
    }).catch(() => {})
  }, [isAuthenticated])

  if (!show || !digestData) return null
  return (
    <WakeUpDigest
      offlineHours={digestData.offlineHours}
      resources={{ energy:0, food:0, credits: Math.round(digestData.new_tdc || 0), materials:0 }}
      battles={digestData.battles || []}
      newTDC={digestData.new_tdc || 0}
      onDismiss={() => setShow(false)}
    />
  )
}

const LoginPage    = lazy(() => import('./pages/LoginPage'))
const Tutorial     = lazy(() => import('./components/onboarding/Tutorial'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const AdminPanel   = lazy(() => import('./pages/AdminPanel'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage    = lazy(() => import('./pages/VerifyEmailPage'))
const TermsPage          = lazy(() => import('./pages/TermsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function GameScreen() {
  const { sendViewport, subscribeTerritory } = useGameSocket()
  const setSelectedTerritory = useStore((s) => s.setSelectedTerritory)
  const player               = useStore((s) => s.player)
  const activePanel          = useStore((s) => s.activePanel)
  const accessToken          = useStore((s) => s.accessToken)

  // Show session expired toast when token is cleared while on game screen
  const [wasLoggedIn, setWasLoggedIn] = useState(false)
  useEffect(() => {
    if (accessToken) setWasLoggedIn(true)
    else if (wasLoggedIn) {
      toast.error('Session expired — please log in again', { duration: 5000 })
      setWasLoggedIn(false)
    }
  }, [accessToken])
  const setActivePanel       = useStore((s) => s.setActivePanel)
  const { claims, completeClaim } = usePendingClaims()
  const [mapLoaded, setMapLoaded] = useState(false)
  const [playerCoords, setPlayerCoords] = useState<[number, number]>([48.8566, 2.3522])

  // Get player location for loading globe
  useEffect(() => {
    fetch('/api/geoip/').then(r => r.json())
      .then(d => { if (d.lat && d.lon) setPlayerCoords([d.lat, d.lon]) })
      .catch(() => navigator.geolocation?.getCurrentPosition(
        p => setPlayerCoords([p.coords.latitude, p.coords.longitude]), () => {}
      ))
  }, [])

  // Prevent browser zoom (Ctrl+wheel) everywhere except map. Allow normal scroll in panels.
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      // Only block Ctrl+wheel (browser zoom gesture) outside the map
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement
        if (!target.closest('.leaflet-container')) {
          e.preventDefault()
        }
      }
    }
    const touchHandler = (e: TouchEvent) => {
      // Block pinch-zoom (2+ fingers) outside map
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement
        if (!target.closest('.leaflet-container')) {
          e.preventDefault()
        }
      }
    }
    window.addEventListener('wheel', handler, { passive: false })
    window.addEventListener('touchmove', touchHandler, { passive: false })
    return () => {
      window.removeEventListener('wheel', handler)
      window.removeEventListener('touchmove', touchHandler)
    }
  }, [])

  // Keyboard: 'R' toggles Codex (collection) panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setActivePanel(activePanel === 'codex' ? null : 'codex')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activePanel, setActivePanel])

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'relative', width: '100vw', height: '100vh',
        overflow: 'hidden',
        background: '#060e1a',
      }}
    >
      {/* ═══ HEXOD SHELL ═══ */}

      {/* 3D Globe loading animation — blocks ALL UI until complete */}
      {!mapLoaded && (
        <LoadingGlobe
          playerLat={playerCoords[0]}
          playerLon={playerCoords[1]}
          onComplete={() => setMapLoaded(true)}
        />
      )}

      {/* ═══ GAME UI — only renders after globe completes ═══ */}
      {mapLoaded && (<>

      {/* News ticker — 28px fixed top */}
      <ErrorBoundary label="NewsTicker">
        <NewsTicker />
      </ErrorBoundary>

      {/* Top HUD — glassmorphism, below ticker */}
      <ErrorBoundary label="HexodTopHUD">
        <HexodTopHUD />
      </ErrorBoundary>

      {/* Day cycle timer — auto-processes kingdoms */}
      <div style={{ position: 'fixed', top: 68, right: 16, zIndex: 900 }}>
        <DayCycleWidget />
      </div>

      {/* Base map — full screen background, z-index isolated to prevent Leaflet bleeding */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <ErrorBoundary label="GameMap">
          <GameMap
            onViewportChange={(lat, lon, radius_km) => sendViewport({ lat, lon, radius_km })}
            onTerritoryClick={(h3) => subscribeTerritory(h3)}
          />
        </ErrorBoundary>
      </div>

      {/* Bottom dock — hex-shaped buttons */}
      <ErrorBoundary label="HexodDock">
        <HexodDock />
      </ErrorBoundary>

      {/* Radar widget — bottom-right */}
      <RadarWidget />

      {/* Pending territory claims — floating progress bars */}
      {claims.length > 0 && (
        <div style={{
          position: 'fixed', top: 80, right: 12, zIndex: 900,
          display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 220,
        }}>
          {claims.slice(0, 3).map(c => (
            <ClaimProgressBar key={c.id} claim={c} compact onComplete={() => completeClaim(c.id)} />
          ))}
        </div>
      )}

      {/* Missions — left side below HUD */}
      <div
        onClick={() => setActivePanel(activePanel === 'tasks' ? null : 'tasks')}
        className="glass-panel"
        style={{
          position: 'fixed', top: 108, left: 16, zIndex: 900,
          padding: '10px 16px', borderRadius: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'auto',
          border: activePanel === 'tasks' ? '2px solid #cc8800' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: activePanel === 'tasks' ? '0 0 16px rgba(204,136,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
          animation: activePanel !== 'tasks' ? 'taskPulse 3s ease-in-out infinite' : 'none',
        }}
      >
        <div style={{ filter: 'drop-shadow(0 1px 4px rgba(204,136,0,0.4))' }}>
          <IconSVG id="daily_task" size={22} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#cc8800', letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>MISSIONS</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontFamily: "'Share Tech Mono', monospace" }}>DAILY REWARDS</div>
        </div>
      </div>
      <style>{`@keyframes taskPulse { 0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.08); } 50% { box-shadow: 0 4px 16px rgba(204,136,0,0.3), 0 0 24px rgba(204,136,0,0.15); } }`}</style>

      {/* Side panels — triggered by HexodDock */}
      <AnimatePresence>
        {activePanel === 'combat'      && <CombatPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'alliance'    && <AlliancePanel   onClose={() => setActivePanel(null)} />}
        {activePanel === 'events'      && <EventsPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'profile'     && <ProfilePanel    onClose={() => setActivePanel(null)} />}
        {activePanel === 'trade'       && <TradePanel      onClose={() => setActivePanel(null)} />}
        {activePanel === 'crypto'      && <CryptoPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'marketplace' && <MarketplacePanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'shop'        && <ShopPanel        onClose={() => setActivePanel(null)} />}
        {activePanel === 'ladder'      && <LadderPanel      onClose={() => setActivePanel(null)} />}
        {activePanel === 'meta'        && <MetaDashboard    onClose={() => setActivePanel(null)} />}
        {activePanel === 'tasks'       && <TaskCenter       onClose={() => setActivePanel(null)} />}
        {activePanel === 'auction'     && <AuctionPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'kingdom'     && <KingdomPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'empire'      && <EmpirePanel      onClose={() => setActivePanel(null)} />}
        {activePanel === 'info'        && <InfoPanel        onClose={() => setActivePanel(null)} />}
        {activePanel === 'codex'       && <CodexPanel       onClose={() => setActivePanel(null)} />}
        {activePanel === 'hunt'        && <DailyHuntPanel   onClose={() => setActivePanel(null)} />}
      </AnimatePresence>

      {/* Auto-tutorial for new players */}
      <Suspense fallback={null}>
        {player && !(player as any).tutorial_completed && (
          <Tutorial onComplete={() => {
            Promise.resolve().then(() =>
              api.post('/progression/tutorial-complete/').catch(() => {})
            )
            useStore.getState().updatePlayer({ tutorial_completed: true } as any)
          }} />
        )}
      </Suspense>

      {/* WakeUp Digest — résumé offline à la reconnexion */}
      <WakeUpDigestConnected />

      {/* Hotspots onboarding — cercles pulsants sur éléments cliquables */}
      <OnboardingHotspots />

      </>)}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
      <BrowserRouter>
        <div onContextMenu={e => e.preventDefault()} style={{ minHeight: '100vh' }}>
        <Suspense fallback={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh',
            background: '#060e1a',
            color: '#0099cc',
            fontSize: 12,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            letterSpacing: 3,
          }}>
            INITIALIZING HEXOD…
          </div>
        }>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
            <Route path="/gm"       element={<AdminPanel />} />
            <Route path="/" element={
              <PrivateRoute>
                <GameScreen />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </div>
      </BrowserRouter>
      </WalletProvider>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(235, 242, 250, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#e2e8f0',
            border: '1px solid rgba(0, 153, 204, 0.2)',
            borderRadius: 8,
            fontSize: 10,
            fontFamily: "'Orbitron', system-ui, sans-serif",
            letterSpacing: 1,
            textTransform: 'uppercase' as const,
          },
          success: { iconTheme: { primary: '#00884a', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
