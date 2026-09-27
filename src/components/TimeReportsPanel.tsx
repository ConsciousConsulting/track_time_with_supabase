/**
 * Time reports — shared admin/user views with filters, summaries, timeline, CSV export,
 * and manual add / edit / delete. Edited rows are flagged by the database when
 * project, time, or note changes.
 */
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  downloadCsv,
  durationSeconds,
  formatDateTime,
  formatDuration,
  formatTime,
  fromLocalDateTime,
  toCsv,
  toLocalDateInput,
  toLocalTimeInput,
} from '../lib/format'
import {
  WORK_LOCATIONS,
  WORK_LOCATION_LABELS,
  isWorkLocation,
  workLocationLabel,
  type Profile,
  type Project,
  type TimeEntryWithRelations,
  type WorkLocation,
} from '../lib/types'

const NOTE_MAX_LENGTH = 2000

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

function localToday(): string {
  return toLocalDateInput(new Date().toISOString())
}

interface MembershipRef {
  project_id: string
  user_id: string
}

interface EntryDraft {
  userId: string
  projectId: string
  location: WorkLocation | ''
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  note: string
}

function emptyDraft(userId: string, projectId: string): EntryDraft {
  const today = localToday()
  return {
    userId,
    projectId,
    location: '',
    startDate: today,
    startTime: '',
    endDate: today,
    endTime: '',
    note: '',
  }
}

interface TimeReportsPanelProps {
  variant: 'admin' | 'user'
  userId?: string
}

export function TimeReportsPanel({ variant, userId }: TimeReportsPanelProps) {
  const isAdmin = variant === 'admin'
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState<string>('all')
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(weekAgoIsoDate())
  const [dateTo, setDateTo] = useState(todayIsoDate())
  const [editor, setEditor] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft('', ''))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  const { data: memberships = [] } = useQuery({
    queryKey: ['admin-memberships'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_members').select('project_id, user_id')
      if (error) throw error
      return data as MembershipRef[]
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

  const editingEntry = entries.find((entry) => entry.id === editingId) ?? null

  function projectsFor(targetUserId: string): Project[] {
    if (!isAdmin) return projects
    const allowed = new Set(
      memberships.filter((member) => member.user_id === targetUserId).map((member) => member.project_id),
    )
    return adminProjects.filter((project) => allowed.has(project.id))
  }

  const formOwnerId = isAdmin ? draft.userId : (userId ?? '')
  const assignedProjects = projectsFor(formOwnerId)
  const currentProject = projects.find((project) => project.id === draft.projectId)
  const formProjects =
    editor === 'edit' && currentProject && !assignedProjects.some((project) => project.id === currentProject.id)
      ? [currentProject, ...assignedProjects]
      : assignedProjects

  function exportCsv() {
    const rows = entries.map((e) => {
      const base = {
        project: e.projects?.name ?? '',
        where: workLocationLabel(e.work_location),
        started: formatDateTime(e.started_at),
        ended: e.ended_at ? formatDateTime(e.ended_at) : 'Running',
        duration: formatDuration(durationSeconds(e.started_at, e.ended_at)),
        note: e.note ?? '',
        edited: e.was_edited ? 'yes' : 'no',
      }
      return isAdmin ? { user: e.profiles?.full_name ?? '', ...base } : base
    })
    downloadCsv(`time-report-${dateFrom}-to-${dateTo}.csv`, toCsv(rows))
  }

  function openAdd() {
    const firstUser = isAdmin ? (reportUsers[0]?.id ?? '') : (userId ?? '')
    const firstProject = projectsFor(firstUser)[0]?.id ?? ''
    setEditor('add')
    setEditingId(null)
    setDraft(emptyDraft(firstUser, firstProject))
    setFormError(null)
    setDeleteId(null)
  }

  function openEdit(entry: TimeEntryWithRelations) {
    setEditor('edit')
    setEditingId(entry.id)
    setDraft({
      userId: entry.user_id,
      projectId: entry.project_id,
      location: entry.work_location ?? '',
      startDate: toLocalDateInput(entry.started_at),
      startTime: toLocalTimeInput(entry.started_at),
      endDate: entry.ended_at ? toLocalDateInput(entry.ended_at) : '',
      endTime: entry.ended_at ? toLocalTimeInput(entry.ended_at) : '',
      note: entry.note ?? '',
    })
    setFormError(null)
    setDeleteId(null)
  }

  function closeEditor() {
    setEditor(null)
    setEditingId(null)
    setFormError(null)
  }

  function onDraftUserChange(nextUserId: string) {
    const options = projectsFor(nextUserId)
    setDraft((prev) => ({
      ...prev,
      userId: nextUserId,
      projectId: options.some((project) => project.id === prev.projectId)
        ? prev.projectId
        : (options[0]?.id ?? ''),
    }))
  }

  function validateDraft(): string | null {
    const allowedIds = new Set(formProjects.map((project) => project.id))
    if (!draft.projectId || !allowedIds.has(draft.projectId)) {
      return 'Choose a project this person is assigned to.'
    }
    if (isAdmin && editor === 'add' && !reportUsers.some((user) => user.id === draft.userId)) {
      return 'Choose a team member.'
    }
    if (editor === 'add' && !isWorkLocation(draft.location)) {
      return 'Select where the work happened: Home, Office, or Abroad.'
    }
    if (draft.location && !isWorkLocation(draft.location)) {
      return 'Location must be Home, Office, or Abroad.'
    }
    if (draft.note.trim().length > NOTE_MAX_LENGTH) {
      return `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`
    }

    const startedAt = fromLocalDateTime(draft.startDate, draft.startTime)
    if (!startedAt) return 'Enter a valid start date and time.'

    const endProvided = draft.endDate !== '' || draft.endTime !== ''
    if (editor === 'add' && !endProvided) return 'Enter an end date and time.'
    if (endProvided) {
      const endedAt = fromLocalDateTime(draft.endDate, draft.endTime)
      if (!endedAt) return 'Enter a valid end date and time.'
      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        return 'End time must be after the start time.'
      }
    } else if (editingEntry?.ended_at) {
      return 'Enter an end date and time.'
    }

    return null
  }

  async function refreshEntries() {
    await queryClient.invalidateQueries({ queryKey: ['time-reports'] })
    await queryClient.invalidateQueries({ queryKey: ['today-entries'] })
    await queryClient.invalidateQueries({ queryKey: ['active-entry'] })
  }

  async function saveEntry() {
    const message = validateDraft()
    if (message) {
      setFormError(message)
      return
    }

    let startedAt = fromLocalDateTime(draft.startDate, draft.startTime)
    const endProvided = draft.endDate !== '' || draft.endTime !== ''
    let endedAt = endProvided ? fromLocalDateTime(draft.endDate, draft.endTime) : null
    if (!startedAt || (endProvided && !endedAt)) return

    // Keep the stored timestamp when the visible minute did not change, so a
    // location-only save does not look like an edit.
    if (editor === 'edit' && editingEntry) {
      if (
        toLocalDateInput(editingEntry.started_at) === draft.startDate &&
        toLocalTimeInput(editingEntry.started_at) === draft.startTime
      ) {
        startedAt = editingEntry.started_at
      }
      if (
        editingEntry.ended_at &&
        endedAt &&
        toLocalDateInput(editingEntry.ended_at) === draft.endDate &&
        toLocalTimeInput(editingEntry.ended_at) === draft.endTime
      ) {
        endedAt = editingEntry.ended_at
      }
    }

    setFormError(null)
    setSaving(true)

    const noteUnchanged =
      editor === 'edit' && editingEntry != null && draft.note === (editingEntry.note ?? '')
    const fields = {
      project_id: draft.projectId,
      started_at: startedAt,
      ended_at: endedAt,
      note: noteUnchanged && editingEntry ? editingEntry.note : draft.note.trim() || null,
      work_location: isWorkLocation(draft.location) ? draft.location : null,
    }

    const { error } =
      editor === 'add'
        ? await supabase.from('time_entries').insert({
            ...fields,
            user_id: isAdmin ? draft.userId : userId,
          })
        : await supabase.from('time_entries').update(fields).eq('id', editingId!)

    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }

    closeEditor()
    await refreshEntries()
  }

  async function confirmDelete(entryId: string) {
    setSaving(true)
    setFormError(null)
    const { error } = await supabase.from('time_entries').delete().eq('id', entryId)
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setDeleteId(null)
    if (editingId === entryId) closeEditor()
    await refreshEntries()
  }

  const columnCount = (isAdmin ? 8 : 7)

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
        <div className="section-heading">
          <h3>Timeline details</h3>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            Add
          </button>
        </div>
        {formError && !editor && <div className="alert alert-error">{formError}</div>}
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && <th>User</th>}
                  <th>Project</th>
                  <th>Where</th>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Duration</th>
                  <th>Note</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    {isAdmin && <td>{entry.profiles?.full_name}</td>}
                    <td>
                      <span className="project-cell">
                        <span>{entry.projects?.name}</span>
                        {entry.was_edited && <span className="badge badge-edited">Edited</span>}
                      </span>
                    </td>
                    <td>{workLocationLabel(entry.work_location)}</td>
                    <td>{formatTime(entry.started_at)}</td>
                    <td>{entry.ended_at ? formatTime(entry.ended_at) : '—'}</td>
                    <td>{formatDuration(durationSeconds(entry.started_at, entry.ended_at))}</td>
                    <td>{entry.note ?? '—'}</td>
                    <td className="actions-cell">
                      {deleteId === entry.id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => confirmDelete(entry.id)}
                            disabled={saving}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setDeleteId(null)}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => openEdit(entry)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="muted">
                      No entries for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor && (
        <div className="modal-backdrop">
          <div className="modal card entry-modal">
            <h3>{editor === 'add' ? 'Add time' : 'Edit time'}</h3>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="entry-form">
              {isAdmin && editor === 'add' && (
                <label className="full">
                  Team member
                  <select value={draft.userId} onChange={(e) => onDraftUserChange(e.target.value)}>
                    {reportUsers.length === 0 && <option value="">No team members</option>}
                    {reportUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="full">
                Project
                <select
                  value={draft.projectId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, projectId: e.target.value }))}
                >
                  {formProjects.length === 0 && <option value="">No assigned projects</option>}
                  {formProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Where
                <select
                  value={draft.location}
                  onChange={(e) => {
                    const next = e.target.value
                    setDraft((prev) => ({
                      ...prev,
                      location: isWorkLocation(next) ? next : '',
                    }))
                  }}
                >
                  <option value="">Select location</option>
                  {WORK_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {WORK_LOCATION_LABELS[location]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                      endDate: prev.endDate === prev.startDate ? e.target.value : prev.endDate,
                    }))
                  }
                  required
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                  required={editor === 'add'}
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
              </label>
              <label>
                End time
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                  required={editor === 'add'}
                />
              </label>
              <label className="full">
                Note
                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="What did you work on?"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEntry} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
