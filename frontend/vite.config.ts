import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /supabase-pg to self-hosted Supabase pg/query (avoids CORS issues)
      '/supabase-pg': {
        target: 'https://superbase.koifishfriend.online',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/supabase-pg/, '/pg/query'),
      },
    },
  },
})
