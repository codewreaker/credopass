import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Disable React Compiler for now if it's causing issues
          ['babel-plugin-react-compiler', {}]
        ]
      }
    })
  ],
  server: {
    host: true,
    https: {
      key: fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/cert.pem'),
    },
    proxy: {
      '/api': {
        target: `https://localhost:${process.env.PORT || 3000}`,
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core and router
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/@tanstack/react-router')) {
            return 'react-vendor'
          }
          
          // AG Grid - heavy library (separate chunks for better caching)
          if (id.includes('node_modules/ag-grid-community')) {
            return 'ag-grid-community'
          }
          if (id.includes('node_modules/ag-grid-react')) {
            return 'ag-grid-react'
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
    // Increase chunk size warning limit to 1MB
    chunkSizeWarningLimit: 1000,
  },
})
