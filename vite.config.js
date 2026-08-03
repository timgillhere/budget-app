import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev has no local API — requests go to the deployed one, so this must point at the
      // project this repo deploys to (budget-app), or dev runs against stale routes and data.
      '/api': {
        target: 'https://budget-app-henna-seven.vercel.app',
        changeOrigin: true,
      },
    },
  },
})
