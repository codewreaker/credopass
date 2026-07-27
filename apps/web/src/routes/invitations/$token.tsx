import { createFileRoute } from '@tanstack/react-router'
import AcceptInvitationPage from '../../Pages/AcceptInvitation'

/**
 * Deliberately not behind `requireAuth`: the page needs to tell a signed-out
 * visitor *why* it is sending them to sign in, and which address to use.
 */
export const Route = createFileRoute('/invitations/$token')({
  component: AcceptInvitationPage,
})
