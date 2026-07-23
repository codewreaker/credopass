import { EditMemberPage } from '../../Pages/Members/MemberComposer'
import { createFileRoute } from '@tanstack/react-router'
import type { MemberComposerSearch } from './new'

// Edit Member route - same composer as /members/new, hydrated from the collection
export const Route = createFileRoute('/members/$userId_/edit')({
  component: EditMemberPage,
  validateSearch: (search: Record<string, unknown>): MemberComposerSearch => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
})
