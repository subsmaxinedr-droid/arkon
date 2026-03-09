import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve, dirname } from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [
    viteSingleFile(),
    // Serve the service worker source at /service-worker.js in dev mode.
    // In production the SW is bundled separately by vite.sw.config.js.
    command === 'serve' && {
      name: 'serve-service-worker',
      configureServer(server) {
        server.middlewares.use('/service-worker.js', (_req, res, next) => {
          const swPath = resolve(__dirname, 'src/service-worker.js')
          try {
            const src = readFileSync(swPath, 'utf-8')
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Service-Worker-Allowed', '/')
            res.end(src)
          } catch {
            next()
          }
        })
      },
    },
  ].filter(Boolean),
  build: {
    target: 'esnext',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
}))
