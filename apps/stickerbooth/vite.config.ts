import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig(() => {
  const useDist = process.env.DEPLOY_USE_DIST === '1'
  const base = process.env.VITE_BASE || '/'
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: useDist
        ? {
            // Use built library output in CI deploy builds
            '@proeftuin/brother-ql-web': resolve(
              __dirname,
              '../../packages/brother-ql-web/dist/index.js'
            ),
          }
        : {
            // Local dev: import from source
            '@proeftuin/brother-ql-web': resolve(
              __dirname,
              '../../packages/brother-ql-web/src/index.ts'
            ),
          },
    },
    server: {
      fs: {
        allow: [
          resolve(__dirname, '.'),
          resolve(__dirname, '../..'),
          resolve(__dirname, '../../packages/brother-ql-web'),
        ],
      },
    },
  }
})
