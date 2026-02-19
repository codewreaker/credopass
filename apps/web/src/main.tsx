import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@credopass/lib/theme'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { configureAPIClient } from '@credopass/api-client'
import { API_BASE_URL } from './config'
import './index.css'

// Configure the API client with environment-specific settings
configureAPIClient({ baseURL: API_BASE_URL });

// Import explicit route configuration
import { routeTree } from './routes'

// Create a new router instance from the explicit route tree
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <RouterProvider router={router} />
      <Analytics />
      <SpeedInsights />
    </ThemeProvider>
  </StrictMode>,
)
