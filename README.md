# Track Time (React + Supabase)

Time tracking app inspired by Time Doctor. Users pick a project, start/stop a timer, and add notes. Admins manage projects, assign users, and export reports.

## Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Supabase (Auth + Postgres + RLS)
- **Hosting:** Free tiers on Vercel, Netlify, Cloudflare Pages, or GitHub Pages

---

## 1. Supabase setup (do this first)

### Step 1 — Create project

1. Go to [supabase.com](https://supabase.com) and create a project (free tier is fine).
2. Wait until the database is ready.

### Step 2 — Run the database schema

1. Open **SQL Editor** in your Supabase dashboard.
2. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Paste and click **Run**.

This creates:

| Table | Purpose |
|-------|---------|
| `profiles` | User name + role (`admin` / `user`) |
| `projects` | Projects created by admin |
| `project_members` | Which users belong to which project |
| `time_entries` | Start/stop times + notes |

### Step 3 — Disable email confirmation (recommended for internal teams)

1. **Authentication** → **Providers** → **Email**
2. Turn off **Confirm email**
3. Save

### Step 4 — Create your first user

1. **Authentication** → **Users** → **Add user**
2. Enter your email and password
3. The `profiles` row is created automatically by the trigger

### Step 5 — Make yourself admin

In **SQL Editor**, run (replace the email):

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'your-email@example.com'
);
```

### Step 6 — Get API keys

1. **Project Settings** → **API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## 2. Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Edit `.env` and paste your Supabase URL and anon key. Open `http://localhost:5173`.

---

## 3. Build for production

```bash
npm run build
```

Output goes to the `dist/` folder.

---

## 4. Free hosting — step by step

All platforms serve the same `dist/` folder. Every user opens **one URL** and shares data through **your Supabase project**.

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on the hosting platform. Never put the `service_role` key in the frontend.

### Option A — Vercel (easiest)

**Cost:** Free hobby tier

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project**.
3. Import your GitHub repo.
4. Framework preset: **Vite**
5. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**.

`vercel.json` is included for SPA routing.

### Option B — Netlify

**Cost:** Free tier

1. Push repo to GitHub.
2. [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add env vars under **Site settings → Environment variables**.
6. Deploy.

`netlify.toml` handles SPA routing.

### Option C — Cloudflare Pages

**Cost:** Free

1. Push repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env vars in **Settings → Environment variables**.
6. Deploy.

`public/_redirects` handles SPA routing.

### Option D — GitHub Pages

**Cost:** Free

1. Set `base` in `vite.config.ts` to your repo name, e.g. `'/track_time_with_supabase/'`.
2. Add GitHub secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Enable Pages from GitHub Actions (workflow included in `.github/workflows/deploy.yml`).

---

## 5. How to use the app

### Admin

1. **Projects:** create projects and assign users.
2. **Users:** change roles. New users are added in Supabase Auth dashboard.
3. **Reports:** filter by project/user/date, export CSV.

### User

1. Select a project on the left.
2. Click **Start**.
3. Add a note.
4. Click **Stop**.

---

## 6. Security

- RLS is enabled on all tables.
- Users see only assigned projects and own entries.
- Admins see all data via role-based policies.
