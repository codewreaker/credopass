import { lazy } from 'react'
import { createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout'

// --- Lazy-loaded page components (code-split per route) ---
const HomePage = lazy(() => import('./Pages/Home/index'))
const MembersPage = lazy(() => import('./Pages/Members/index'))
const EventsPage = lazy(() => import('./Pages/Events/index'))
const Analytics = lazy(() => import('./Pages/Analytics/index'))
const TablesPage = lazy(() => import('./Pages/Tables/index'))
const CheckInPage = lazy(() => import('./Pages/CheckIn/index'))
const OrganizationsPage = lazy(() => import('./Pages/Organizations/index'))

// Root route - wraps all pages with layout (sidebar, topbar, etc.)
const rootRoute = createRootRoute({
  component: RootLayout,
})

// Default redirect path - change this to redirect '/' to any route
const DEFAULT_REDIRECT_PATH = '/checkin'

// Index route - redirects to the default path (currently /checkin)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: DEFAULT_REDIRECT_PATH })
  },
})

// Dashboard route - Dashboard with HeroPanel and AttendanceTable
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: HomePage,
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

// CheckIn route - Check-in page for event attendees
const checkInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkin',
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
  dashboardRoute,
  membersRoute,
  eventsRoute,
  analyticsRoute,
  databaseRoute,
  checkInRoute,
  organizationsRoute,
])

// Export individual routes for type safety and easy access
export const routes = {
  root: rootRoute,
  dashboard: dashboardRoute,
  members: membersRoute,
  checkIn: checkInRoute,
  events: eventsRoute,
  organizations: organizationsRoute,
  analytics: analyticsRoute,
} as const
