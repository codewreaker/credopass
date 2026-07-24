import PublicEventPage from '../../Pages/Events/PublicEventPage'
import { createFileRoute } from '@tanstack/react-router'

// Public shareable event page — standalone (no app shell), what the QR opens.
export const Route = createFileRoute('/e/$eventId')({
  component: PublicEventPage,
})
