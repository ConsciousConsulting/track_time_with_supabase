/**
 * Admin layout shell — sub-pages render via sidebar navigation.
 */
import { Outlet } from 'react-router-dom'

export function AdminPage() {
  return (
    <div className="admin-page">
      <Outlet />
    </div>
  )
}
