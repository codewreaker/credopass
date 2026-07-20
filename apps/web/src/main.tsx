import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@credopass/lib/theme'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { configureAPIClient } from '@credopass/api-client'
import { getAccessToken } from './supabase'
import { routeTree } from './routeTree.gen'
import './index.css'

// Create the router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Configure the API client with environment-specific settings.
// The API requires a verified Supabase JWT on every request.
configureAPIClient({
  baseURL: import.meta.env.VITE_API_URL || '/api/core',
  getAuthToken: getAccessToken,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <RouterProvider router={router} />
      <Analytics />
      <SpeedInsights />
    </ThemeProvider>
  </StrictMode>,
)