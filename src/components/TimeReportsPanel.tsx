/**
 * Time reports — shared admin/user views with filters, summaries, timeline, CSV export.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  downloadCsv,
  durationSeconds,
  formatDateTime,
  formatDuration,
  formatTime,
  toCsv,
} from '../lib/format'
import type { Profile, Project, TimeEntryWithRelations } from '../lib/types'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

interface TimeReportsPanelProps {
  variant: 'admin' | 'user'
  userId?: string
}

export function TimeReportsPanel({ variant, userId }: TimeReportsPanelProps) {
  const isAdmin = variant === 'admin'
  const [projectId, setProjectId] = useState<string>('all')
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(weekAgoIsoDate())
  const [dateTo, setDateTo] = useState(todayIsoDate())

  const { data: adminProjects = [] } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('name')
      if (error) throw error
      return data as Project[]
    },
    enabled: isAdmin,
  })

  const { data: userProjects = [] } = useQuery({
    queryKey: ['my-projects', userId],
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId!)

      if (mErr) throw mErr
      const ids = memberships.map((m) => m.project_id)
      if (ids.length === 0) return [] as Project[]

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', ids)
        .order('name')

      if (error) throw error
      return data as Project[]
    },
    enabled: !isAdmin && Boolean(userId),
  })

  const projects = isAdmin ? adminProjects : userProjects

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data as Profile[]
    },
    enabled: isAdmin,
  })

  const reportUsers = users.filter((u) => u.role === 'user')
  const scopedUserId = isAdmin ? (filterUserId !== 'all' ? filterUserId : undefined) : userId

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-reports', variant, scopedUserId, projectId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, profiles(full_name), projects(name)')
        .gte('started_at', `${dateFrom}T00:00:00.000Z`)
        .lte('started_at', `${dateTo}T23:59:59.999Z`)
        .order('started_at', { ascending: false })

      if (scopedUserId) query = query.eq('user_id', scopedUserId)
      if (projectId !== 'all') query = query.eq('project_id', projectId)

      const { data, error } = await query
      if (error) throw error
      return data as TimeEntryWithRelations[]
    },
    enabled: isAdmin || Boolean(userId),
  })

  const summary = useMemo(() => {
    const byUser: Record<string, { name: string; seconds: number }> = {}
    const byProject: Record<string, { name: string; seconds: number }> = {}
    let totalSeconds = 0

    for (const entry of entries) {
      const secs = durationSeconds(entry.started_at, entry.ended_at)
      totalSeconds += secs
      const userName = entry.profiles?.full_name ?? 'Unknown'
      const projectName = entry.projects?.name ?? 'Unknown'

      if (!byUser[entry.user_id]) byUser[entry.user_id] = { name: userName, seconds: 0 }
      byUser[entry.user_id].seconds += secs

      if (!byProject[entry.project_id]) byProject[entry.project_id] = { name: projectName, seconds: 0 }
      byProject[entry.project_id].seconds += secs
    }

    return { byUser: Object.values(byUser), byProject: Object.values(byProject), totalSeconds }
  }, [entries])

  function exportCsv() {
    const rows = entries.map((e) => {
      const base = {
        project: e.projects?.name ?? '',
        started: formatDateTime(e.started_at),
        ended: e.ended_at ? formatDateTime(e.ended_at) : 'Running',
        duration: formatDuration(durationSeconds(e.started_at, e.ended_at)),
        note: e.note ?? '',
      }
      return isAdmin ? { user: e.profiles?.full_name ?? '', ...base } : base
    })
    downloadCsv(`time-report-${dateFrom}-to-${dateTo}.csv`, toCsv(rows))
  }

  return (
    <div className="admin-section">
      <div className="card filters-card">
        <h2>{isAdmin ? 'Timeline — detailed' : 'My hours'}</h2>
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
          {isAdmin && (
            <label>
              User
              <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
                <option value="all">All users</option>
                {reportUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        {isAdmin ? (
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
        ) : (
          <div className="card">
            <h3>Total hours</h3>
            <ul className="summary-list">
              <li>
                <span>Selected period</span>
                <strong>{formatDuration(summary.totalSeconds)}</strong>
              </li>
            </ul>
          </div>
        )}
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
                {isAdmin && <th>User</th>}
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
                  {isAdmin && <td>{entry.profiles?.full_name}</td>}
                  <td>{entry.projects?.name}</td>
                  <td>{formatTime(entry.started_at)}</td>
                  <td>{entry.ended_at ? formatTime(entry.ended_at) : '—'}</td>
                  <td>{formatDuration(durationSeconds(entry.started_at, entry.ended_at))}</td>
                  <td>{entry.note ?? '—'}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="muted">
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
