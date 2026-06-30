import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/Finance-management-/ on GitHub Pages.
  base: '/Finance-management-/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
