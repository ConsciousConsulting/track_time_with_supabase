-- =============================================================================
-- Track Time App — Supabase Schema
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Custom types
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'user');

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- Profiles extend auth.users (role stored here, NOT in user_metadata)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Projects created by admin
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Which users are assigned to which projects
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- Time tracking entries
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint time_entries_valid_range check (
    ended_at is null or ended_at > started_at
  )
);

-- Only one running timer per user at a time
create unique index time_entries_one_active_per_user
  on public.time_entries (user_id)
  where ended_at is null;

-- Performance indexes for admin reports
create index time_entries_user_id_idx on public.time_entries (user_id);
create index time_entries_project_id_idx on public.time_entries (project_id);
create index time_entries_started_at_idx on public.time_entries (started_at desc);
create index project_members_user_id_idx on public.project_members (user_id);

-- -----------------------------------------------------------------------------
-- 3. Auto-create profile when a user signs up
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.time_entries enable row level security;

-- Helper: admin check (inline in policies via subquery)

-- PROFILES
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Users can update own name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- PROJECTS
create policy "Members and admins can read projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.user_id = auth.uid()
    )
  );

create policy "Admins can insert projects"
  on public.projects for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can update projects"
  on public.projects for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can delete projects"
  on public.projects for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- PROJECT MEMBERS
create policy "Users can read own memberships"
  on public.project_members for select
  using (user_id = auth.uid());

create policy "Admins can read all memberships"
  on public.project_members for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can manage memberships"
  on public.project_members for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can remove memberships"
  on public.project_members for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- TIME ENTRIES
create policy "Users can read own time entries"
  on public.time_entries for select
  using (user_id = auth.uid());

create policy "Admins can read all time entries"
  on public.time_entries for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Users can start timer on assigned projects"
  on public.time_entries for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = time_entries.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Users can update own time entries"
  on public.time_entries for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can update any time entry"
  on public.time_entries for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Create your first admin (run AFTER you sign up in the app once)
-- Replace the email below with your account email, then run this block:
-- -----------------------------------------------------------------------------
-- update public.profiles
-- set role = 'admin'
-- where id = (
--   select id from auth.users where email = 'your-email@example.com'
-- );
