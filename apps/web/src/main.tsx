import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@credopass/lib/theme'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { configureAPIClient } from '@credopass/api-client'
import { getAccessToken } from './supabase'
import { getDeviceToken } from './lib/device-token'
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
 * Two credentials reach the API the same way. A paired door tablet holds a
 * `cpd_…` device token and no account at all, and it takes precedence: a tablet
 * that has been paired is a tablet, and a leftover guest session on it must not
 * silently downgrade the door back into account mode.
 *
 * `X-Organization-Id` is not configured here — the client reads it from the
 * active-organization store, which the session bootstrap resolves from
 * `/me/context`.
 */
configureAPIClient({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1/core',
  getAuthToken: async () => getDeviceToken() ?? (await getAccessToken()),
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
