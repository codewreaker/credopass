import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './Pages/Layout'
import HomePage from './Pages/Home/index'
import MembersPage from './Pages/Members/index'
import EventsPage from './Pages/Events/index'
import Analytics from './Pages/Analytics/index'
import TablesPage from './Pages/Tables/index'
import { ComponentExample } from './components/component-example'

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
