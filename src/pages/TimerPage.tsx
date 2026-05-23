/**
 * User timer page — Time Doctor style: projects left, timer + controls right.
 */
import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import {
  durationSeconds,
  formatClock,
  formatDuration,
  startOfTodayIso,
} from '../lib/format'
import type { Project, TimeEntry } from '../lib/types'

interface ProjectToday {
  project: Project
  todaySeconds: number
}

export function TimerPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session!.user.id

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['my-projects', userId],
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)

      if (mErr) throw mErr
      const ids = memberships.map((m) => m.project_id)
      if (ids.length === 0) return [] as Project[]

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', ids)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data as Project[]
    },
  })

  const { data: activeEntry = null } = useQuery({
    queryKey: ['active-entry', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .is('ended_at', null)
        .maybeSingle()

      if (error) throw error
      return data as TimeEntry | null
    },
    refetchInterval: 30000,
  })

  const { data: todayEntries = [] } = useQuery({
    queryKey: ['today-entries', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', startOfTodayIso())
        .order('started_at', { ascending: false })

      if (error) throw error
      return data as TimeEntry[]
    },
    refetchInterval: 60000,
  })

  const isRunning = Boolean(activeEntry)
  const elapsed = useElapsedSeconds(activeEntry?.started_at ?? null, isRunning)

  const activeProject = projects.find((p) => p.id === activeEntry?.project_id)
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const projectTotals: ProjectToday[] = projects.map((project) => {
    const seconds = todayEntries
      .filter((e) => e.project_id === project.id)
      .reduce((sum, e) => sum + durationSeconds(e.started_at, e.ended_at), 0)
    return { project, todaySeconds: seconds }
  })

  const workedTodaySeconds = todayEntries.reduce(
    (sum, e) => sum + durationSeconds(e.started_at, e.ended_at),
    0,
  )

  useEffect(() => {
    if (activeEntry) {
      setSelectedProjectId(activeEntry.project_id)
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
  }, [activeEntry, projects, selectedProjectId])

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['active-entry', userId] })
    await queryClient.invalidateQueries({ queryKey: ['today-entries', userId] })
  }, [queryClient, userId])

  async function handleStart() {
    if (!selectedProjectId) {
      setActionError('Select a project first.')
      return
    }
    setActionError(null)
    setBusy(true)

    const { error } = await supabase.from('time_entries').insert({
      user_id: userId,
      project_id: selectedProjectId,
      started_at: new Date().toISOString(),
    })

    if (error) {
      setActionError(error.message)
    } else {
      setNote('')
      await invalidate()
    }
    setBusy(false)
  }

  async function handleStop() {
    if (!activeEntry) return
    setActionError(null)
    setBusy(true)

    const { error } = await supabase
      .from('time_entries')
      .update({
        ended_at: new Date().toISOString(),
        note: note.trim() || null,
      })
      .eq('id', activeEntry.id)

    if (error) {
      setActionError(error.message)
    } else {
      setNote('')
      await invalidate()
    }
    setBusy(false)
  }

  if (projectsLoading) {
    return <div className="page-loading">Loading projects...</div>
  }

  return (
    <div className="timer-page">
      <header className="timer-header">
        <div className="timer-header-left">
          <span className="timer-project-label">
            {isRunning ? activeProject?.name : selectedProject?.name ?? 'Select a project'}
          </span>
        </div>
        <div className="timer-header-right">
          <span className="timer-clock">{formatClock(isRunning ? elapsed : 0)}</span>
        </div>
      </header>

      <p className="worked-today">
        Worked today: <strong>{formatDuration(workedTodaySeconds)}</strong>
      </p>

      <div className="timer-body">
        <section className="project-panel">
          <h2>Projects</h2>
          {projects.length === 0 ? (
            <p className="muted">No projects assigned yet. Ask your admin to assign you.</p>
          ) : (
            <ul className="project-list">
              {projectTotals.map(({ project, todaySeconds }) => {
                const isActive = project.id === (activeEntry?.project_id ?? selectedProjectId)
                const isSelected = project.id === selectedProjectId
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={`project-item ${isSelected ? 'selected' : ''} ${isActive && isRunning ? 'running' : ''}`}
                      onClick={() => !isRunning && setSelectedProjectId(project.id)}
                      disabled={isRunning && project.id !== activeEntry?.project_id}
                    >
                      <span className="project-name">{project.name}</span>
                      <span className="project-time">{formatDuration(todaySeconds)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="timer-panel">
          <div className="timer-display">
            <div className="timer-display-clock">{formatClock(isRunning ? elapsed : 0)}</div>
            <p className="timer-display-label">
              {isRunning ? `Tracking: ${activeProject?.name}` : 'Ready to start'}
            </p>
          </div>

          <label className="note-field">
            What did you work on?
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note when you stop the timer..."
              rows={4}
              disabled={!isRunning && !activeEntry}
            />
          </label>

          {actionError && <div className="alert alert-error">{actionError}</div>}

          <div className="timer-actions">
            {!isRunning ? (
              <button
                type="button"
                className="btn btn-start"
                onClick={handleStart}
                disabled={busy || projects.length === 0}
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-stop"
                onClick={handleStop}
                disabled={busy}
              >
                Stop
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
