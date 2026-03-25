import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = __dirname

// Dev server may read manuscript files via public/Stories → repo root
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
    // Symlinked manuscript tree under public/Stories — do not watch (avoids restarts, false tsconfig hits)
    watch: {
      ignored: ['**/public/Stories/**'],
    },
  },
})
