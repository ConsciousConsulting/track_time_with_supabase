/**
 * App root — routing, auth provider, and React Query.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { TimerPage } from './pages/TimerPage'
import { UserReportsPage } from './pages/UserReportsPage'
import { AdminPage } from './pages/AdminPage'
import { ReportsPanel } from './components/admin/ReportsPanel'
import { ProjectManager } from './components/admin/ProjectManager'
import { UserManager } from './components/admin/UserManager'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
})

// GitHub Pages serves the app from /track_time_with_supabase/ — must match vite.config base
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={routerBasename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <ProtectedRoute userOnly>
                    <TimerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute userOnly>
                    <UserReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="reports" replace />} />
                <Route path="reports" element={<ReportsPanel />} />
                <Route path="projects" element={<ProjectManager />} />
                <Route path="users" element={<UserManager />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
