import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Required for GitHub Pages (repo name becomes the URL path)
  base: '/track_time_with_supabase/',
  plugins: [react()],
})
