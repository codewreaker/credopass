import EventsPage from "../../Pages/Events"
import { createFileRoute } from '@tanstack/react-router'

// Events route - Events page
export const Route = createFileRoute('/events/')({
  component: EventsPage,
})
