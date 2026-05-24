/**
 * User reports page — own hours with project/date filters.
 */
import { TimeReportsPanel } from '../components/TimeReportsPanel'
import { useAuth } from '../context/AuthContext'

export function UserReportsPage() {
  const { session } = useAuth()

  return (
    <div className="user-reports-page">
      <header className="admin-header">
        <h1>Dashboard</h1>
      </header>
      <TimeReportsPanel variant="user" userId={session!.user.id} />
    </div>
  )
}
