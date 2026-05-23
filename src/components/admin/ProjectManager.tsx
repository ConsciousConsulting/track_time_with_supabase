/**
 * Admin — create/edit projects and assign team members.
 */
import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Profile, Project } from '../../lib/types'

export function ProjectManager() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const { data: projects = [] } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('projects')
        .select('*')
        .order('name')
      if (err) throw err
      return data as Project[]
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error: err } = await supabase.from('profiles').select('*').order('full_name')
      if (err) throw err
      return data as Profile[]
    },
  })

  const { data: memberships = [] } = useQuery({
    queryKey: ['admin-memberships'],
    queryFn: async () => {
      const { data, error: err } = await supabase.from('project_members').select('*')
      if (err) throw err
      return data
    },
  })

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return

    const { error: err } = await supabase.from('projects').insert({
      name: trimmed,
      description: description.trim() || null,
      created_by: session!.user.id,
    })

    if (err) {
      setError(err.message)
      return
    }

    setName('')
    setDescription('')
    await queryClient.invalidateQueries({ queryKey: ['admin-projects'] })
  }

  async function toggleProjectActive(project: Project) {
    await supabase.from('projects').update({ is_active: !project.is_active }).eq('id', project.id)
    await queryClient.invalidateQueries({ queryKey: ['admin-projects'] })
  }

  function openAssign(projectId: string) {
    setAssignProjectId(projectId)
    const memberIds = memberships.filter((m) => m.project_id === projectId).map((m) => m.user_id)
    setSelectedUserIds(memberIds)
  }

  async function saveAssignments() {
    if (!assignProjectId) return
    setError(null)

    const current = memberships.filter((m) => m.project_id === assignProjectId).map((m) => m.user_id)
    const toAdd = selectedUserIds.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !selectedUserIds.includes(id))

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', assignProjectId)
        .in('user_id', toRemove)
      if (delErr) {
        setError(delErr.message)
        return
      }
    }

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase.from('project_members').insert(
        toAdd.map((user_id) => ({ project_id: assignProjectId, user_id })),
      )
      if (addErr) {
        setError(addErr.message)
        return
      }
    }

    setAssignProjectId(null)
    await queryClient.invalidateQueries({ queryKey: ['admin-memberships'] })
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  return (
    <div className="admin-section">
      <form className="card form-card" onSubmit={handleCreateProject}>
        <h2>Create project</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Project name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description (optional)
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary">
          Add project
        </button>
      </form>

      <div className="card">
        <h2>All projects</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const count = memberships.filter((m) => m.project_id === project.id).length
              return (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.is_active ? 'Active' : 'Inactive'}</td>
                  <td>{count}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn-sm" onClick={() => openAssign(project.id)}>
                      Assign users
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleProjectActive(project)}>
                      {project.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {assignProjectId && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h3>Assign users to project</h3>
            <ul className="checkbox-list">
              {users.map((user) => (
                <li key={user.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    {user.full_name} ({user.role})
                  </label>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAssignProjectId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveAssignments}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
