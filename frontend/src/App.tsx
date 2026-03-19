/**
 * App.tsx — root component with routing.
 * GameScreen — the main game UI (map + HUD + panels).
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

const LoginPage = lazy(() => import('./pages/LoginPage'))
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
  const { updateViewport, clickTerritory, subscribeTerritory } = useGameSocket()
  const setSelectedTerritory = useStore((s) => s.setSelectedTerritory)
  const selectedTerritory = useStore((s) => s.selectedTerritory)

  const handleViewportChange = (lat: number, lon: number, radius_km: number) => {
    updateViewport({ lat, lon, radius_km })
  }

  const handleTerritoryClick = (h3: string) => {
    clickTerritory(h3)
    subscribeTerritory(h3)
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a14' }}>
      {/* Base map layer */}
      <GameMap
        onViewportChange={handleViewportChange}
        onTerritoryClick={handleTerritoryClick}
      />

      {/* HUD overlay */}
      <GameHUD />

      {/* Territory detail panel */}
      <AnimatePresence>
        {selectedTerritory && <TerritoryPanel />}
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
            <Route path="/login" element={<LoginPage />} />
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
          error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
