import { redirect } from '@tanstack/react-router';
import { supabase } from '../supabase';

/**
 * Route-level auth boundary for the private console (§3.4 / M2).
 *
 * A verified session passes through. A visitor with no session is bounced to
 * `/login?redirect=<where they were going>` and returned there afterwards.
 *
 * Attach as `beforeLoad` on each private route:
 *   export const Route = createFileRoute('/events/')({ beforeLoad: requireAuth, ... })
 *
 * Three kinds of route deliberately do NOT use this:
 *   · public attendee surfaces — `/e/:id`, `/p/:token`
 *   · `/login` itself
 *   · `/events/new`, which renders the composer to a signed-out visitor and
 *     overlays sign-in on top of it (D21). Redirecting there would defeat the
 *     point: the visitor is meant to SEE what they are signing up for. Nothing
 *     is at risk, because `POST /events` is org-scoped and 401s without a token
 *     — the overlay is presentation, the middleware is the control.
 */
export async function requireAuth({ location }: { location: { href: string } }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: '/login', search: { view: 'social', redirect: location.href } });
  }
}
