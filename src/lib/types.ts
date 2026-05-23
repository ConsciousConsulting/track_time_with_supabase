/**
 * Shared TypeScript types matching the Supabase schema.
 */
export type UserRole = 'admin' | 'user'

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
  created_at: string
}

export interface TimeEntryWithRelations extends TimeEntry {
  profiles: Pick<Profile, 'full_name'> | null
  projects: Pick<Project, 'name'> | null
}

export interface ProjectWithTodayTotal extends Project {
  today_seconds: number
}
