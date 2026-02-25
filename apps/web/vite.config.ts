import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Wraps the nxViteTsPaths plugin to fix a bug where tsconfig-paths resolves
 * wildcard path mappings (e.g. `@credopass/lib/*` → `packages/lib/src/*`) to
 * directory paths instead of their index files. The underlying `tsconfig-paths`
 * library uses `existsSync` which returns true for directories, so the
 * directory path is returned as-is — but Vite can't load a directory.
 *
 * This wrapper intercepts the resolveId result and appends `/index.{ext}` when
 * the resolved path is a directory.
 */
function nxViteTsPathsFixed(opts?: Parameters<typeof nxViteTsPaths>[0]): Plugin {
  const inner = nxViteTsPaths(opts) as Plugin
  const extensions = ['.ts', '.tsx', '.js', '.jsx']

  return {
    ...inner,
    name: 'nx-vite-ts-paths-fixed',
    resolveId(source, importer, options) {
      const result = (inner.resolveId as Function)?.call(this, source, importer, options)
      if (typeof result === 'string' && existsSync(result) && statSync(result).isDirectory()) {
        for (const ext of extensions) {
          const indexPath = resolve(result, `index${ext}`)
          if (existsSync(indexPath) && statSync(indexPath).isFile()) {
            return indexPath
          }
        }
      }
      return result
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}]
        ]
      }
    }),
    nxViteTsPathsFixed(),
    nxCopyAssetsPlugin(['*.md']),
    tailwindcss()
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core and router
          if (id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }

          // TanStack libraries
          if (id.includes('node_modules/@tanstack')) {
            return 'tanstack-vendor'
          }

          // AG Grid - heavy library (separate chunks for better caching)
          if (id.includes('node_modules/ag-grid-community')) {
            return 'ag-grid-community'
          }
          if (id.includes('node_modules/ag-grid-react')) {
            return 'ag-grid-react'
          }


          // Recharts
          if (id.includes('node_modules/recharts')) {
            return 'recharts-vendor'
          }

          // UI and utilities
          if (id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-grid-layout') ||
            id.includes('node_modules/zustand')) {
            return 'ui-vendor'
          }

          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
