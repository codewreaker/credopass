import { EditMemberPage } from '../../Pages/Attendees/MemberComposer'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth-guard'
import type { MemberComposerSearch } from './new'

// Edit Attendee route - same composer as /attendees/new, hydrated from the collection
export const Route = createFileRoute('/attendees/$userId_/edit')({
  beforeLoad: requireAuth,
  component: EditMemberPage,
  validateSearch: (search: Record<string, unknown>): MemberComposerSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
