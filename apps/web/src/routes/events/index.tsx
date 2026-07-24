import EventsPage from "../../Pages/Events"
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from "../../lib/auth-guard"

// Events route - Events page
export const Route = createFileRoute('/events/')({
  beforeLoad: requireAuth,
  component: EventsPage,
})
