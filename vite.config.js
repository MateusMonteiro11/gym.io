import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  server: {
    fs: {
      // Local runtime credentials must never be served by Vite, even outside public/.
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/supabase/**'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
