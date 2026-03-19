/**
 * App.tsx — root component with routing and panel system.
 */
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { useGameSocket } from './hooks/useGameSocket'
import { GameMap } from './components/map/GameMap'
import { GameHUD } from './components/hud/GameHUD'
import { TerritoryPanel } from './components/hud/TerritoryPanel'
import { CombatPanel } from './components/hud/CombatPanel'
import { EventsPanel } from './components/hud/EventsPanel'
import { ProfilePanel } from './components/hud/ProfilePanel'
import { AlliancePanel } from './components/alliance/AlliancePanel'

const LoginPage    = lazy(() => import('./pages/LoginPage'))
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
  const activePanel          = useStore((s) => s.activePanel)
  const setActivePanel       = useStore((s) => s.setActivePanel)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a14' }}>
      {/* Base map */}
      <GameMap
        onViewportChange={(lat, lon, radius_km) => sendViewport({ lat, lon, radius_km })}
        onTerritoryClick={(h3) => subscribeTerritory(h3)}
      />

      {/* HUD */}
      <GameHUD />

      {/* Territory detail panel (bottom sheet) */}
      <AnimatePresence>
        {selectedTerritory && <TerritoryPanel />}
      </AnimatePresence>

      {/* Side panels — triggered by bottom nav */}
      <AnimatePresence>
        {activePanel === 'combat'   && <CombatPanel    onClose={() => setActivePanel(null)} />}
        {activePanel === 'alliance' && <AlliancePanel  onClose={() => setActivePanel(null)} />}
        {activePanel === 'events'   && <EventsPanel    onClose={() => setActivePanel(null)} />}
        {activePanel === 'profile'  && <ProfilePanel   onClose={() => setActivePanel(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a14', color: '#10B981', fontSize: 18 }}>
            Loading Terra Domini…
          </div>
        }>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <PrivateRoute>
                <GameScreen />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

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
