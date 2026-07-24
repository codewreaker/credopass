import { redirect } from '@tanstack/react-router';
import { supabase } from '../supabase';

/**
 * Route-level auth boundary for the private console (§3.4 / M2).
 *
 * A verified session — including an anonymous *guest* session, which is a real
 * session — passes through. A visitor with no session at all is bounced to
 * `/login?redirect=<where they were going>`; `/login` auto-signs them in as a
 * guest and returns them to that destination (see `useGuestAutoLogin`).
 *
 * Attach as `beforeLoad` on each private route:
 *   export const Route = createFileRoute('/events/')({ beforeLoad: requireAuth, ... })
 *
 * Public routes (`/e/:id`) and `/login` deliberately do NOT use this.
 */
export async function requireAuth({ location }: { location: { href: string } }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: '/login', search: { view: 'social', redirect: location.href } });
  }
}
