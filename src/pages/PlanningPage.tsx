/**
 * Weekly planning — Mon–Fri day cards with add / edit / delete / check items.
 * Depends on: planning_items table, AuthContext, React Query.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { PlanningItem } from '../lib/types'
import {
  addDays,
  formatWeekdayCard,
  formatWeekRangeFull,
  isSameLocalDay,
  startOfWeekMonday,
  toDateKey,
  weekdaysMonToFri,
} from '../lib/week'

const TITLE_MAX = 500

type PlanningQueryKey = readonly ['planning', string, string, string]

export function PlanningPage() {
  const { session } = useAuth()
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(new Date()))
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const weekDays = useMemo(() => weekdaysMonToFri(weekAnchor), [weekAnchor])
  const monday = weekDays[0]
  const friday = weekDays[4]
  const fromKey = toDateKey(monday)
  const toKey = toDateKey(friday)
  const isThisWeek = isSameLocalDay(monday, startOfWeekMonday(new Date()))
  const queryKey: PlanningQueryKey = ['planning', userId, fromKey, toKey]

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_items')
        .select('id, user_id, plan_date, title, is_done, sort_order, created_at')
        .eq('user_id', userId)
        .gte('plan_date', fromKey)
        .lte('plan_date', toKey)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as PlanningItem[]
    },
  })

  const itemsByDate = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {}
    for (const day of weekDays) {
      map[toDateKey(day)] = []
    }
    for (const item of items) {
      const key = item.plan_date
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return map
  }, [items, weekDays])

  const addMutation = useMutation({
    mutationFn: async ({ planDate, title }: { planDate: string; title: string }) => {
      const dayItems = itemsByDate[planDate] ?? []
      const sort_order = dayItems.length
      const { data, error } = await supabase
        .from('planning_items')
        .insert({
          user_id: userId,
          plan_date: planDate,
          title,
          sort_order,
        })
        .select('id, user_id, plan_date, title, is_done, sort_order, created_at')
        .single()
      if (error) throw error
      return data as PlanningItem
    },
    onMutate: async ({ planDate }) => {
      setActionError(null)
      setDrafts((prev) => ({ ...prev, [planDate]: '' }))
    },
    onSuccess: (created) => {
      queryClient.setQueryData<PlanningItem[]>(queryKey, (prev = []) => [...prev, created])
    },
    onError: (err: Error, variables) => {
      setDrafts((prev) => ({ ...prev, [variables.planDate]: variables.title }))
      setActionError(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<PlanningItem, 'title' | 'is_done'>>
    }) => {
      const { error } = await supabase
        .from('planning_items')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => {
      setActionError(null)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PlanningItem[]>(queryKey)
      queryClient.setQueryData<PlanningItem[]>(queryKey, (prev = []) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      )
      if (patch.title !== undefined) {
        setEditingId(null)
        setEditTitle('')
      }
      return { previous }
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setActionError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planning_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onMutate: async (id) => {
      setActionError(null)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PlanningItem[]>(queryKey)
      queryClient.setQueryData<PlanningItem[]>(queryKey, (prev = []) =>
        prev.filter((item) => item.id !== id),
      )
      return { previous }
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setActionError(err.message)
    },
  })

  const pendingItemId =
    (updateMutation.isPending ? updateMutation.variables?.id : null) ??
    (deleteMutation.isPending ? deleteMutation.variables : null) ??
    null
  const pendingAddDate = addMutation.isPending ? addMutation.variables?.planDate : null

  function goPrevWeek() {
    setWeekAnchor((prev) => addDays(startOfWeekMonday(prev), -7))
  }

  function goNextWeek() {
    setWeekAnchor((prev) => addDays(startOfWeekMonday(prev), 7))
  }

  function goThisWeek() {
    setWeekAnchor(startOfWeekMonday(new Date()))
  }

  function onPickDate(value: string) {
    if (!value) return
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return
    setWeekAnchor(startOfWeekMonday(new Date(y, m - 1, d)))
  }

  function handleAdd(planDate: string) {
    const title = (drafts[planDate] ?? '').trim()
    if (!title) {
      setActionError('Enter a task before adding.')
      return
    }
    if (title.length > TITLE_MAX) {
      setActionError(`Task must be ${TITLE_MAX} characters or fewer.`)
      return
    }
    addMutation.mutate({ planDate, title })
  }

  function startEdit(item: PlanningItem) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setActionError(null)
  }

  function saveEdit(id: string) {
    const title = editTitle.trim()
    if (!title) {
      setActionError('Task cannot be empty.')
      return
    }
    if (title.length > TITLE_MAX) {
      setActionError(`Task must be ${TITLE_MAX} characters or fewer.`)
      return
    }
    updateMutation.mutate({ id, patch: { title } })
  }

  return (
    <div className="planning-page">
      <header className="planning-header">
        <div className="planning-header-text">
          <h1>Planning</h1>
          <p className="planning-week-label">
            {isThisWeek ? 'This week · ' : ''}
            {formatWeekRangeFull(monday, friday)}
          </p>
        </div>
        <div className="planning-week-controls">
          <button type="button" className="btn btn-ghost" onClick={goPrevWeek} aria-label="Previous week">
            ←
          </button>
          {!isThisWeek && (
            <button type="button" className="btn btn-ghost" onClick={goThisWeek}>
              This week
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={goNextWeek} aria-label="Next week">
            →
          </button>
          <label className="planning-pick-week">
            Pick week
            <input type="date" value={fromKey} onChange={(e) => onPickDate(e.target.value)} />
          </label>
        </div>
      </header>

      {actionError && <div className="alert alert-error planning-error">{actionError}</div>}

      {isLoading ? (
        <div className="page-loading">Loading plan...</div>
      ) : (
        <div className="planning-days">
          {weekDays.map((day) => {
            const dateKey = toDateKey(day)
            const dayItems = itemsByDate[dateKey] ?? []
            const addingHere = pendingAddDate === dateKey
            return (
              <section key={dateKey} className="planning-day-card card">
                <h2 className="planning-day-title">{formatWeekdayCard(day)}</h2>
                <ul className="planning-item-list">
                  {dayItems.map((item) => {
                    const rowBusy = pendingItemId === item.id
                    return (
                      <li key={item.id} className={`planning-item ${item.is_done ? 'done' : ''}`}>
                        {editingId === item.id ? (
                          <div className="planning-edit-row">
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={TITLE_MAX}
                              autoFocus
                              disabled={rowBusy}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  saveEdit(item.id)
                                }
                                if (e.key === 'Escape') {
                                  setEditingId(null)
                                  setEditTitle('')
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={rowBusy}
                              onClick={() => saveEdit(item.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={rowBusy}
                              onClick={() => {
                                setEditingId(null)
                                setEditTitle('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <label className="planning-item-main">
                              <input
                                type="checkbox"
                                checked={item.is_done}
                                disabled={rowBusy}
                                onChange={() =>
                                  updateMutation.mutate({
                                    id: item.id,
                                    patch: { is_done: !item.is_done },
                                  })
                                }
                              />
                              <span className="planning-item-title">{item.title}</span>
                            </label>
                            <div className="planning-item-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={rowBusy}
                                onClick={() => startEdit(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={rowBusy}
                                onClick={() => deleteMutation.mutate(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div className="planning-add-row">
                  <input
                    value={drafts[dateKey] ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [dateKey]: e.target.value }))
                    }
                    placeholder="Add a task..."
                    maxLength={TITLE_MAX}
                    disabled={addingHere}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAdd(dateKey)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={addingHere}
                    onClick={() => handleAdd(dateKey)}
                  >
                    Add
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
