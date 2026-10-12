import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed port: Google only redirects to pre-registered URIs (see the proxy headers below).
    port: 5173,
    strictPort: true,
    proxy: {
      // Dev has no local API — requests go to the deployed one, so this must point at the
      // project this repo deploys to (budget-app), or dev runs against stale routes and data.
      '/api': {
        target: 'https://budget-app-henna-seven.vercel.app',
        changeOrigin: true,
        // Tells /api/auth/google to send Google's redirect back to localhost, not production
        // (see api/_google.js). http://localhost:5173/api/auth/callback must be an authorised
        // redirect URI on the Google OAuth client for dev sign-in to work.
        headers: { 'x-oauth-dev-origin': 'http://localhost:5173' },
      },
    },
  },
})
