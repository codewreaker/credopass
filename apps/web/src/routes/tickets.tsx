import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/tickets` → `/events`.
 *
 * This was its own screen for a day. The events list shows what you host and
 * what you are attending together now, so there is nothing left here — but
 * pass screens and messages in the wild link to it, and a dead link on the
 * one surface an attendee reaches us through is not acceptable.
 *
 * `replace`, so Back does not bounce through the redirect.
 */
export const Route = createFileRoute('/tickets')({
  beforeLoad: () => {
    throw redirect({ to: '/events', replace: true });
  },
});
