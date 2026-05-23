/**
 * Admin reports — filter by project/user/date, view timeline, export CSV.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  downloadCsv,
  durationSeconds,
  formatDateTime,
  formatDuration,
  formatTime,
  toCsv,
} from '../../lib/format'
import type { Profile, Project, TimeEntryWithRelations } from '../../lib/types'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export function ReportsPanel() {
  const [projectId, setProjectId] = useState<string>('all')
  const [userId, setUserId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(weekAgoIsoDate())
  const [dateTo, setDateTo] = useState(todayIsoDate())

  const { data: projects = [] } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('name')
      if (error) throw error
      return data as Project[]
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin-reports', projectId, userId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, profiles(full_name), projects(name)')
        .gte('started_at', `${dateFrom}T00:00:00.000Z`)
        .lte('started_at', `${dateTo}T23:59:59.999Z`)
        .order('started_at', { ascending: false })

      if (projectId !== 'all') query = query.eq('project_id', projectId)
      if (userId !== 'all') query = query.eq('user_id', userId)

      const { data, error } = await query
      if (error) throw error
      return data as TimeEntryWithRelations[]
    },
  })

  const summary = useMemo(() => {
    const byUser: Record<string, { name: string; seconds: number }> = {}
    const byProject: Record<string, { name: string; seconds: number }> = {}

    for (const entry of entries) {
      const secs = durationSeconds(entry.started_at, entry.ended_at)
      const userName = entry.profiles?.full_name ?? 'Unknown'
      const projectName = entry.projects?.name ?? 'Unknown'

      if (!byUser[entry.user_id]) byUser[entry.user_id] = { name: userName, seconds: 0 }
      byUser[entry.user_id].seconds += secs

      if (!byProject[entry.project_id]) byProject[entry.project_id] = { name: projectName, seconds: 0 }
      byProject[entry.project_id].seconds += secs
    }

    return { byUser: Object.values(byUser), byProject: Object.values(byProject) }
  }, [entries])

  function exportCsv() {
    const rows = entries.map((e) => ({
      user: e.profiles?.full_name ?? '',
      project: e.projects?.name ?? '',
      started: formatDateTime(e.started_at),
      ended: e.ended_at ? formatDateTime(e.ended_at) : 'Running',
      duration: formatDuration(durationSeconds(e.started_at, e.ended_at)),
      note: e.note ?? '',
    }))
    downloadCsv(`time-report-${dateFrom}-to-${dateTo}.csv`, toCsv(rows))
  }

  return (
    <div className="admin-section">
      <div className="card filters-card">
        <h2>Timeline — detailed</h2>
        <div className="filters-row">
          <label>
            Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            User
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="all">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            CSV Export
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="card">
          <h3>Hours by user</h3>
          <ul className="summary-list">
            {summary.byUser.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <strong>{formatDuration(row.seconds)}</strong>
              </li>
            ))}
            {summary.byUser.length === 0 && <li className="muted">No data</li>}
          </ul>
        </div>
        <div className="card">
          <h3>Hours by project</h3>
          <ul className="summary-list">
            {summary.byProject.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <strong>{formatDuration(row.seconds)}</strong>
              </li>
            ))}
            {summary.byProject.length === 0 && <li className="muted">No data</li>}
          </ul>
        </div>
      </div>

      <div className="card">
        <h3>Timeline details</h3>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Project</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Duration</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.profiles?.full_name}</td>
                  <td>{entry.projects?.name}</td>
                  <td>{formatTime(entry.started_at)}</td>
                  <td>{entry.ended_at ? formatTime(entry.ended_at) : '—'}</td>
                  <td>{formatDuration(durationSeconds(entry.started_at, entry.ended_at))}</td>
                  <td>{entry.note ?? '—'}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No entries for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
