import EventDetailPage from '../../Pages/Events/EventDetailPage'
import { createFileRoute } from '@tanstack/react-router'

// Event Detail route - Single event page with full details
export const Route = createFileRoute('/events/$eventId')({
  component: EventDetailPage,
})
