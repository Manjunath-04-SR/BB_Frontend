import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Clear stale Vite dep cache on Windows to prevent EPERM rename errors
const viteCacheDir = path.resolve(__dirname, 'node_modules/.vite')
try { fs.rmSync(viteCacheDir, { recursive: true, force: true }) } catch {}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      usePolling: process.platform === 'win32',
    },
  },
  optimizeDeps: {
    force: true,
  },
})
