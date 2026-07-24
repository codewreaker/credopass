import EventDetailPage from '../../Pages/Events/EventDetailPage'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth-guard'

// Event Detail route - Single event page with full details
export const Route = createFileRoute('/events/$eventId')({
  beforeLoad: requireAuth,
  component: EventDetailPage,
})
