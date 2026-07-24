import AttendeesPage from "../../Pages/Attendees";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "../../lib/auth-guard";

/** Attendees list. Optionally scoped to one event via `?eventId=`. */
export interface AttendeesSearch {
  eventId?: string;
}

export const Route = createFileRoute('/attendees/')({
  beforeLoad: requireAuth,
  component: AttendeesPage,
  validateSearch: (search: Record<string, unknown>): AttendeesSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
