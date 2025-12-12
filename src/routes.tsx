import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout'
import HomePage from './Pages/Home'
import MembersPage from './Pages/Members'
import CalendarPage from './Pages/Calendar'
import Analytics from './Pages/Analytics'
import DatabasePage from './Pages/Database'

// Root route - wraps all pages with layout (sidebar, topbar, etc.)
const rootRoute = createRootRoute({
  component: RootLayout,
})

// Home route - Dashboard with HeroPanel and AttendanceTable
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Members route - Members management page
const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/members',
  component: MembersPage,
})

// Calendar route - Events calendar page
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
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
  component: DatabasePage,
})

// Route tree - explicitly defines the structure
export const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  calendarRoute,
  analyticsRoute,
  databaseRoute
])

// Export individual routes for type safety and easy access
export const routes = {
  root: rootRoute,
  home: indexRoute,
  members: membersRoute,
  calendar: calendarRoute,
  analytics: analyticsRoute
} as const
