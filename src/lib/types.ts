/**
 * Shared TypeScript types matching the Supabase schema.
 */
export type UserRole = 'admin' | 'user'

export const WORK_LOCATIONS = ['home', 'office', 'abroad'] as const

export type WorkLocation = (typeof WORK_LOCATIONS)[number]

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  home: 'Home',
  office: 'Office',
  abroad: 'Abroad',
}

export function isWorkLocation(value: string): value is WorkLocation {
  return (WORK_LOCATIONS as readonly string[]).includes(value)
}

export function workLocationLabel(value: WorkLocation | null | undefined): string {
  if (!value) return '—'
  return WORK_LOCATION_LABELS[value]
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  assigned_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  project_id: string
  started_at: string
  ended_at: string | null
  note: string | null
  work_location: WorkLocation | null
  was_edited: boolean
  created_at: string
}

export interface TimeEntryWithRelations extends TimeEntry {
  profiles: Pick<Profile, 'full_name'> | null
  projects: Pick<Project, 'name'> | null
}

export interface ProjectWithTodayTotal extends Project {
  today_seconds: number
}
