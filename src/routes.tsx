import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout.js'
import HomePage from './Pages/Home/index.js'
import MembersPage from './Pages/Members/index.js'
import EventsPage from './Pages/Events/index.js'
import Analytics from './Pages/Analytics/index.js'
import TablesPage from './Pages/Tables/index.js'
import { ComponentExample } from "@/components/component-example.js";

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

// Tailwinfd Sample
const tailwindExample = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tailwind',
  component: ComponentExample,
})

// Route tree - explicitly defines the structure
export const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  eventsRoute,
  analyticsRoute,
  databaseRoute,
  tailwindExample
])

// Export individual routes for type safety and easy access
export const routes = {
  root: rootRoute,
  home: indexRoute,
  members: membersRoute,
  events: eventsRoute,
  analytics: analyticsRoute
} as const
