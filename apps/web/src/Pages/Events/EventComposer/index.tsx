import { useParams, useNavigate } from '@tanstack/react-router';
import { useEvent } from '@credopass/api-client';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { EventComposer } from './event-composer';
import { eventToFormValues } from './use-event-form';
import { errorMessage, isNotFound } from '../../../lib/errors';

/** `/events/new` — a blank composer. */
export function CreateEventPage() {
  // Composer owns its own submit CTA; nothing for the app toolbar to add.
  useToolbarContext({ search: { enabled: false, placeholder: '' } });
  return <EventComposer mode="create" />;
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
