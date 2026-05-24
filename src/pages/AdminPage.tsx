/**
 * Admin layout shell — sub-pages render via sidebar navigation.
 */
import { Outlet } from 'react-router-dom'

export function AdminPage() {
  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
      </header>
      <Outlet />
    </div>
  )
}
