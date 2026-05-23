/**
 * Admin dashboard — manage projects, users, and view/export time reports.
 */
import { useState } from 'react'
import { ProjectManager } from '../components/admin/ProjectManager'
import { UserManager } from '../components/admin/UserManager'
import { ReportsPanel } from '../components/admin/ReportsPanel'

type AdminTab = 'reports' | 'projects' | 'users'

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('reports')

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <nav className="admin-tabs">
          <button
            type="button"
            className={tab === 'reports' ? 'tab active' : 'tab'}
            onClick={() => setTab('reports')}
          >
            Reports
          </button>
          <button
            type="button"
            className={tab === 'projects' ? 'tab active' : 'tab'}
            onClick={() => setTab('projects')}
          >
            Projects
          </button>
          <button
            type="button"
            className={tab === 'users' ? 'tab active' : 'tab'}
            onClick={() => setTab('users')}
          >
            Users
          </button>
        </nav>
      </header>

      {tab === 'reports' && <ReportsPanel />}
      {tab === 'projects' && <ProjectManager />}
      {tab === 'users' && <UserManager />}
    </div>
  )
}
