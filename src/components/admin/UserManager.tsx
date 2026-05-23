/**
 * Admin — list users, change roles. New users are created in Supabase Auth dashboard.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../lib/types'

export function UserManager() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error: err } = await supabase.from('profiles').select('*').order('full_name')
      if (err) throw err
      return data as Profile[]
    },
  })

  async function updateRole(userId: string, role: UserRole) {
    setError(null)
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (err) {
      setError(err.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  }

  if (isLoading) return <p>Loading users...</p>

  return (
    <div className="admin-section">
      <div className="card info-card">
        <h2>Add new users</h2>
        <ol>
          <li>Open your Supabase project → <strong>Authentication</strong> → <strong>Users</strong></li>
          <li>Click <strong>Add user</strong> → enter email and password</li>
          <li>The user appears here automatically (profile is created on signup)</li>
          <li>Assign them to projects in the <strong>Projects</strong> tab</li>
        </ol>
        <p className="muted">
          Tip: disable email confirmation under Authentication → Providers → Email for internal teams.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Team members</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>
                  <span className={`badge badge-${user.role}`}>{user.role}</span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  {user.role === 'admin' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => updateRole(user.id, 'user')}
                    >
                      Make user
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => updateRole(user.id, 'admin')}
                    >
                      Make admin
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
