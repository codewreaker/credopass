import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@credopass/lib/theme'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { configureAPIClient } from '@credopass/api-client'
import { getAccessToken } from './supabase'
import { queryClient } from './lib/query-client'
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

/**
 * Point the client at `/api/v1/core` and tell it how to authenticate.
 *
 * One credential, always: the Supabase session. A door tablet used to hold a
 * `cpd_…` device token instead, which took precedence over any session on the
 * same browser — whoever is working the entrance signs in as themselves with
 * the `checkin` role now (D24).
 *
 * `X-Organization-Id` is not configured here — the client reads it from the
 * active-organization store, which the session bootstrap resolves from
 * `/me/context`.
 */
configureAPIClient({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1/core',
  getAuthToken: getAccessToken,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <RouterProvider router={router} />
        <Analytics />
        <SpeedInsights />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
