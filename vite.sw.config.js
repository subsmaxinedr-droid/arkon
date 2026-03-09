import { defineConfig } from 'vite'

/**
 * Separate build config for the PWA service worker.
 * Outputs dist/service-worker.js (ES module bundle, inlined for SW compatibility).
 *
 * Usage: vite build --config vite.sw.config.js
 */
export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/service-worker.js',
      formats: ['es'],
      fileName: () => 'service-worker',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
