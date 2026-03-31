import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = __dirname

// Dev server reads manuscripts via public/Books → ../Books
export default defineConfig({
  // Relative base so JS/CSS load correctly inside the Capacitor Android WebView
  base: './',
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
    watch: {
      ignored: ['**/public/Books/**'],
    },
  },
})
