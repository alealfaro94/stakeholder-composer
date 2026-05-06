import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // In local dev, proxy /api/* to a local functions emulator or leave unset
  // (Vercel handles /api/* routing automatically in production)
  server: {
    port: 5173,
  },
})
