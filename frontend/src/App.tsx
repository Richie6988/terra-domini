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
import { RadarTrigger, RadarFilterPanel } from './components/shared/RadarFilterPanel'
import { RadarWidget } from './components/shared/RadarWidget'
import { SoundToggle } from './components/shared/SoundToggle'

// ─── Panel Components ───────────────────────────────────────
import { GameHUD } from './components/hud/GameHUD'
import { TerritoryPanel } from './components/hud/TerritoryPanel'
import { CombatPanel } from './components/hud/CombatPanel'
import { EventsPanel } from './components/hud/EventsPanel'
import { ProfilePanel } from './components/hud/ProfilePanel'
import { AlliancePanel } from './components/alliance/AlliancePanel'
import { TradePanel } from './components/hud/TradePanel'
import { CryptoPanel } from './components/crypto/CryptoPanel'
import { ShopPanel } from './components/shop/ShopPanel'
import { LadderPanel } from './components/hud/LadderPanel'
import { MetaDashboard } from './components/hud/MetaDashboard'
import { MarketplacePanel } from './components/crypto/MarketplacePanel'
import { KingdomPanel } from './components/kingdom/KingdomPanel'
import { CodexPanel } from './components/hud/CodexPanel'
import { WarTicker } from './components/hud/WarTicker'

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
  const selectedTerritory    = useStore((s) => s.selectedTerritory)
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
  const [radarOpen, setRadarOpen] = useState(false)
  const [radarActive, setRadarActive] = useState(false)
  const setActivePanel       = useStore((s) => s.setActivePanel)

  // Keyboard: 'R' toggles radar panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setRadarOpen(v => !v)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'relative', width: '100vw', height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #2d5a45, #1a3d2e)',
      }}
    >
      {/* ═══ HEXOD SHELL ═══ */}

      {/* News ticker — 28px fixed top */}
      <ErrorBoundary label="NewsTicker">
        <NewsTicker />
      </ErrorBoundary>

      {/* Top HUD — glassmorphism, below ticker */}
      <ErrorBoundary label="HexodTopHUD">
        <HexodTopHUD />
      </ErrorBoundary>

      {/* Radar trigger (left edge) + filter panel */}
      <RadarTrigger
        onClick={() => setRadarOpen(v => !v)}
        scanning={radarActive}
      />
      <RadarFilterPanel
        open={radarOpen}
        onClose={() => setRadarOpen(false)}
        onFilterChange={(ids) => setRadarActive(ids.size > 0)}
      />

      {/* Base map — full screen background */}
      <ErrorBoundary label="GameMap">
        <GameMap
          onViewportChange={(lat, lon, radius_km) => sendViewport({ lat, lon, radius_km })}
          onTerritoryClick={(h3) => subscribeTerritory(h3)}
        />
      </ErrorBoundary>

      {/* Bottom dock — hex-shaped buttons */}
      <ErrorBoundary label="HexodDock">
        <HexodDock />
      </ErrorBoundary>

      {/* Radar widget — SVG bottom-right */}
      <RadarWidget />

      {/* Sound toggle — bottom-left */}
      <SoundToggle />

      {/* Legacy HUD elements (coalition alert, missions widget) */}
      <ErrorBoundary label="GameHUD">
        <GameHUD />
      </ErrorBoundary>

      {/* Live war ticker */}
      <ErrorBoundary label="WarTicker">
        <WarTicker />
      </ErrorBoundary>

      {/* Territory detail panel */}
      {selectedTerritory && <TerritoryPanel />}

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
        {activePanel === 'kingdom'     && <KingdomPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'codex'       && <CodexPanel       onClose={() => setActivePanel(null)} />}
      </AnimatePresence>

      {/* Auto-tutorial for new players */}
      <Suspense fallback={null}>
        {player && !player.tutorial_completed && (
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
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #2d5a45, #1a3d2e)',
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
            <Route path="/gm"       element={<AdminPanel />} />
            <Route path="/" element={
              <PrivateRoute>
                <GameScreen />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </WalletProvider>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(235, 242, 250, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#1a2a3a',
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
