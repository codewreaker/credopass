import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'
import tailwindcss from '@tailwindcss/vite'

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
    nxViteTsPaths(),
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
