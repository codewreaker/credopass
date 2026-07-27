import { CreateEventPage } from '../../Pages/Events/EventComposer'
import { createFileRoute } from '@tanstack/react-router'

/**
 * Create Event — standalone composer page (static path wins over `$eventId`).
 *
 * Deliberately NOT guarded by `requireAuth` (D21). This is the destination of
 * the marketing site's primary call to action, so a signed-out visitor must
 * reach it and see the composer; the page overlays sign-in on top rather than
 * redirecting. Nothing tenant-scoped renders before there is a session, and
 * `POST /events` refuses unauthenticated callers regardless.
 */
export const Route = createFileRoute('/events/new')({
  component: CreateEventPage,
})
