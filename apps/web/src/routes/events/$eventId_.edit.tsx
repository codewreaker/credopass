import { EditEventPage } from '../../Pages/Events/EventComposer'
import { createFileRoute } from '@tanstack/react-router'

// Edit Event route - same composer as /events/new, hydrated from the collection
export const Route = createFileRoute('/events/$eventId_/edit')({
  component: EditEventPage,
})
