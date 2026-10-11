import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { pushPublicConfigPlugin } from './tools/pushPublicConfig.js'

export default defineConfig(({mode})=>({
  server: {
    fs: {
      // Local runtime credentials must never be served by Vite, even outside public/.
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/supabase/**'],
    },
  },
  plugins: [
    pushPublicConfigPlugin(process.env.VITE_SUPABASE_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
}))
