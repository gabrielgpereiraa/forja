import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // Ambiente da Vercel no build (production/preview/development) — usado pela trava da nota v2.
  define: { 'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? '') },
  server: { port: 5180 },
  build: { chunkSizeWarningLimit: 700 },
})
