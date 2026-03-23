/**
 * App.tsx — root component with routing and panel system.
 */
import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { api } from './services/api'
import { useGameSocket } from './hooks/useGameSocket'
import { ErrorBoundary } from './components/ui/Utils'
import { GameMap } from './components/map/GameMap'
import { WakeUpDigest } from './components/onboarding/Tutorial'
import { OnboardingHotspots } from './components/onboarding/OnboardingHotspots'

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
import { GameHUD } from './components/hud/GameHUD'
import { TerritoryPanel } from './components/hud/TerritoryPanel'
import { CombatPanel } from './components/hud/CombatPanel'
import { EventsPanel } from './components/hud/EventsPanel'
import { ProfilePanel } from './components/hud/ProfilePanel'
import { AlliancePanel } from './components/alliance/AlliancePanel'
import { TradePanel } from './components/hud/TradePanel'
import { CryptoPanel } from './components/crypto/CryptoPanel'
import { LeaderboardPanel } from './components/leaderboard/LeaderboardPanel'
import { ShopPanel }        from './components/shop/ShopPanel'
import { LadderPanel }      from './components/hud/LadderPanel'
import { MetaDashboard }    from './components/hud/MetaDashboard'
import { DailyClicker } from './components/clicker/DailyClicker'
import { WalletProvider } from './components/crypto/WalletProvider'
import { MarketplacePanel } from './components/crypto/MarketplacePanel'

import { WarTicker } from './components/hud/WarTicker'

const LoginPage    = lazy(() => import('./pages/LoginPage'))
const Tutorial     = lazy(() => import('./components/onboarding/Tutorial'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

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
  const [showClicker, setShowClicker] = useState(false)
  const setActivePanel       = useStore((s) => s.setActivePanel)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a14' }}>
      {/* Base map */}
      <ErrorBoundary label="GameMap">
        <GameMap
          onViewportChange={(lat, lon, radius_km) => sendViewport({ lat, lon, radius_km })}
          onTerritoryClick={(h3) => subscribeTerritory(h3)}
        />
      </ErrorBoundary>

      {/* HUD */}
      <ErrorBoundary label="GameHUD">
        <GameHUD onClickerOpen={() => setShowClicker(true)} />
      </ErrorBoundary>

      {/* Live war ticker */}
      <ErrorBoundary label="WarTicker">
        <WarTicker />
      </ErrorBoundary>

      {/* Territory detail panel (bottom sheet) */}
      <AnimatePresence>
        {selectedTerritory && <TerritoryPanel />}
      </AnimatePresence>

      {/* Side panels — triggered by bottom nav */}
      <AnimatePresence>
        {activePanel === 'combat'      && <CombatPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'alliance'    && <AlliancePanel   onClose={() => setActivePanel(null)} />}
        {activePanel === 'events'      && <EventsPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'profile'     && <ProfilePanel    onClose={() => setActivePanel(null)} />}
        {activePanel === 'trade'       && <TradePanel      onClose={() => setActivePanel(null)} />}
        {activePanel === 'crypto'      && <CryptoPanel     onClose={() => setActivePanel(null)} />}
        {activePanel === 'marketplace' && <MarketplacePanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'leaderboard' && <LeaderboardPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'shop'        && <ShopPanel        onClose={() => setActivePanel(null)} />}
        {activePanel === 'ladder'      && <LadderPanel      onClose={() => setActivePanel(null)} />}
        {activePanel === 'meta'        && <MetaDashboard    onClose={() => setActivePanel(null)} />}
        {showClicker && <DailyClicker onClose={() => setShowClicker(false)} />}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a14', color: '#10B981', fontSize: 18 }}>
            Loading Hexod…
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
            background: '#1F2937',
            color: '#E5E7EB',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            fontSize: 13,
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
