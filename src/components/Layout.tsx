/**
 * App shell with sidebar navigation for timer and admin views.
 */
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Conscious Consulting</div>
        <nav className="sidebar-nav">
          {!isAdmin && (
            <>
              <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Timer
              </NavLink>
              <NavLink
                to="/reports"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                My hours
              </NavLink>
            </>
          )}
          {isAdmin && (
            <>
              <NavLink
                to="/admin/reports"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Reports
              </NavLink>
              <NavLink
                to="/admin/projects"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Projects
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                Users
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <p className="user-name">{profile?.full_name}</p>
          <p className="user-role">{profile?.role}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
