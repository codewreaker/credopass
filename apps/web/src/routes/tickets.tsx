import { createFileRoute } from '@tanstack/react-router';
import TicketsPage from '../Pages/Tickets';
import { requireAuth } from '../lib/auth-guard';

/**
 * The attendee's own list. Behind `requireAuth` because it is the caller's
 * personal scope — there is nothing to show a visitor, and `GET /me/tickets`
 * 401s without a token.
 */
export const Route = createFileRoute('/tickets')({
  beforeLoad: requireAuth,
  component: TicketsPage,
});
