/**
 * Admin — list team members. New users are created in Supabase Auth dashboard.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

export function UserManager() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error: err } = await supabase.from('profiles').select('*').order('full_name')
      if (err) throw err
      return data as Profile[]
    },
  })

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
          To make someone an admin, run the admin SQL in Supabase. Tip: disable email confirmation
          under Authentication → Providers → Email for internal teams.
        </p>
      </div>

      <div className="card">
        <h2>Team members</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
