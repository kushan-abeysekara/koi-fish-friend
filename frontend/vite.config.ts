import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api to backend (avoids CORS issues in local dev and localhost:8081 fallback)
      '/api': {
        target: 'https://backend.koifishfriend.online',
        changeOrigin: true,
        secure: true,
      },
      // Proxy /supabase-pg to self-hosted Supabase pg/query (avoids CORS issues)
      '/supabase-pg': {
        target: 'https://superbase.koifishfriend.online',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/supabase-pg/, '/pg/query'),
      },
      // Proxy /camera-api to Pi camera server (bypasses browser CORS / unreachable LAN IP)
      '/camera-api': {
        target: 'http://192.168.8.101:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/camera-api/, ''),
      },
    },
  },
})
