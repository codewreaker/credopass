import { CreateEventPage } from '../../Pages/Events/EventComposer'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth-guard'

// Create Event route - standalone composer page (static path wins over $eventId)
export const Route = createFileRoute('/events/new')({
  beforeLoad: requireAuth,
  component: CreateEventPage,
})
