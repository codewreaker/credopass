import { CreateMemberPage } from '../../Pages/Members/MemberComposer'
import { createFileRoute } from '@tanstack/react-router'

/** Members are added onto an event, so the event rides in the search params. */
export interface MemberComposerSearch {
  eventId?: string
}

// Add Member route - standalone composer page (static path wins over $userId)
export const Route = createFileRoute('/members/new')({
  component: CreateMemberPage,
  validateSearch: (search: Record<string, unknown>): MemberComposerSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
