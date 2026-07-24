import { CreateMemberPage } from '../../Pages/Attendees/MemberComposer'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth-guard'

/** Attendees are added onto an event, so the event rides in the search params. */
export interface MemberComposerSearch {
  eventId?: string
}

// Add Attendee route - standalone composer page (static path wins over $userId)
export const Route = createFileRoute('/attendees/new')({
  beforeLoad: requireAuth,
  component: CreateMemberPage,
  validateSearch: (search: Record<string, unknown>): MemberComposerSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
