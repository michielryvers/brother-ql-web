import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
  // app directory (this project)
  resolve(__dirname, '.'),
  // workspace root
  resolve(__dirname, '../..'),
        // allow importing sources from the monorepo package path
        resolve(__dirname, '../../packages/brother-ql-web'),
      ],
    },
  },
})
