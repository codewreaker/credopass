import { lazy } from 'react'
import { createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout'

// --- Lazy-loaded page components (code-split per route) ---
const MembersPage = lazy(() => import('./Pages/Members/index'))
const EventsPage = lazy(() => import('./Pages/Events/index'))
const EventDetailPage = lazy(() => import('./Pages/Events/EventDetailPage'))
const Analytics = lazy(() => import('./Pages/Analytics/index'))
const TablesPage = lazy(() => import('./Pages/Tables/index'))
const CheckInPage = lazy(() => import('./Pages/CheckIn/index'))
const OrganizationsPage = lazy(() => import('./Pages/Organizations/index'))

// Root route - wraps all pages with layout (sidebar, topbar, etc.)
const rootRoute = createRootRoute({
  component: RootLayout,
})

// Default redirect path - change this to redirect '/' to any route
const DEFAULT_REDIRECT_PATH = '/events'

// Index route - redirects to the default path (currently /checkin)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: DEFAULT_REDIRECT_PATH })
  },
})

// Members route - Members management page
const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/members',
  component: MembersPage,
})

// Events route - Events page
const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: EventsPage,
})

// Event Detail route - Single event page with full details
const eventDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: EventDetailPage,
})

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: Analytics,
})

// Database route - Admin page to view all database tables
const databaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/database',
  component: TablesPage,
})

// CheckIn route - Check-in page for specific event
const checkInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkin/$eventId',
  component: CheckInPage,
})

// Organizations route - Manage organizations
const organizationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organizations',
  component: OrganizationsPage,
})

// Route tree - explicitly defines the structure
export const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  eventsRoute,
  eventDetailRoute,
  analyticsRoute,
  databaseRoute,
  checkInRoute,
  organizationsRoute,
])

// Export individual routes for type safety and easy access
export const routes = {
  root: rootRoute,
  members: membersRoute,
  checkIn: checkInRoute,
  events: eventsRoute,
  eventDetail: eventDetailRoute,
  organizations: organizationsRoute,
  analytics: analyticsRoute,
} as const
