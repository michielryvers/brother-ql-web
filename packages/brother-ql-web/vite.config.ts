import { defineConfig } from 'vite'

// Library build for @proeftuin/brother-ql-web
// Outputs: packages/brother-ql-web/dist/index.js (ES module)
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // No externals for now; bundle dependencies like pica
    },
    sourcemap: true,
  },
})
