import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout.js'
import HomePage from './Pages/Home'
import MembersPage from './Pages/Members'
import EventsPage from './Pages/Events'
import Analytics from './Pages/Analytics'
import TablesPage from './Pages/Tables'
import { ComponentExample } from './components/component-example.js'

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

// Component Example route - UI component showcase
const componentExampleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/component-example',
  component: ComponentExample,
})



// Route tree - explicitly defines the structure
export const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  eventsRoute,
  analyticsRoute,
  databaseRoute,
  componentExampleRoute
])

// Export individual routes for type safety and easy access
export const routes = {
  root: rootRoute,
  home: indexRoute,
  members: membersRoute,
  events: eventsRoute,
  componentExample: componentExampleRoute,
  analytics: analyticsRoute
} as const
