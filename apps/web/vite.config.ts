import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
    tailwindcss()
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || 3000}`,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@dwellpass/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@dwellpass/validation": path.resolve(__dirname, "../../packages/validation/src"),
    },
  },
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

          // FullCalendar
          if (id.includes('node_modules/@fullcalendar')) {
            return 'fullcalendar-vendor'
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
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
