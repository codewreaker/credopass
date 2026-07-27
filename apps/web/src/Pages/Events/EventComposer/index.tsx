import { useParams, useNavigate } from '@tanstack/react-router';
import { useEvent } from '@credopass/api-client';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { EventComposer } from './event-composer';
import { SignInOverlay } from './sign-in-overlay';
import { eventToFormValues } from './use-event-form';
import { errorMessage, isNotFound } from '../../../lib/errors';
import { useSession } from '../../../contexts/session';

/**
 * `/events/new` — a blank composer, and the front door (D21).
 *
 * This is the one private-looking route with no `requireAuth` guard. A visitor
 * arriving from the marketing site's "Create your first event" sees the real
 * composer with sign-in laid over it, rather than a login wall that explains
 * nothing about what they are signing up for. It renders no tenant data, so
 * there is nothing to leak.
 *
 * The `<fieldset disabled>` is what makes the form inert — one native element
 * rather than a `disabled` prop threaded through every field. It is a courtesy
 * to the visitor, not a control: `POST /events` is org-scoped and 401s without
 * a token, which is the actual boundary.
 */
export function CreateEventPage() {
  // Composer owns its own submit CTA; nothing for the app toolbar to add.
  useToolbarContext({ search: { enabled: false, placeholder: '' } });
  const { session, isAuthLoading } = useSession();

  // Wait for Supabase to replay the persisted session before deciding. Without
  // this a signed-in host sees the overlay flash on every load.
  if (isAuthLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (session) return <EventComposer mode="create" />;

  return (
    <div className="relative min-h-svh">
      <fieldset disabled aria-hidden="true" className="pointer-events-none">
        <EventComposer mode="create" />
      </fieldset>
      <SignInOverlay />
    </div>
  );
}

/** `/events/$eventId/edit` — the same composer, hydrated from `GET /events/{id}`. */
export function EditEventPage() {
  // Route id keeps the `_` from `$eventId_.edit.tsx`, which un-nests this page
  // from the event detail route (that route renders no <Outlet/>).
  const { eventId } = useParams({ from: '/events/$eventId_/edit' });
  const navigate = useNavigate();
  useToolbarContext({ search: { enabled: false, placeholder: '' } });

  const { data: event, isLoading, error } = useEvent(eventId);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">
          {isNotFound(error) ? 'Event not found' : 'Could not load this event'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isNotFound(error)
            ? "The event you're trying to edit doesn't exist or has been removed."
            : errorMessage(error)}
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/events' })}>
          <ArrowLeft size={16} /> Back to Events
        </Button>
      </div>
    );
  }

  return (
    <EventComposer
      // Remount once the event resolves so the form seeds from real values.
      key={event.id}
      mode="edit"
      eventId={eventId}
      initialValues={eventToFormValues(event)}
    />
  );
}
