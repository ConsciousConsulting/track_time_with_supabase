/**
 * Route guard — redirects unauthenticated or wrong-role users.
 */
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({
  children,
  adminOnly = false,
  userOnly = false,
}: {
  children: React.ReactNode
  adminOnly?: boolean
  userOnly?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="loading-screen">
        <p>Loading profile...</p>
      </div>
    )
  }

  if (adminOnly && profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (userOnly && profile.role === 'admin') {
    return <Navigate to="/admin/reports" replace />
  }

  return <>{children}</>
}
