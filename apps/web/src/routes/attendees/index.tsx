import AttendeesPage from "../../Pages/Attendees";
import { createFileRoute } from "@tanstack/react-router";

/** Attendees list. Optionally scoped to one event via `?eventId=`. */
export interface AttendeesSearch {
  eventId?: string;
}

export const Route = createFileRoute('/attendees/')({
  component: AttendeesPage,
  validateSearch: (search: Record<string, unknown>): AttendeesSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
