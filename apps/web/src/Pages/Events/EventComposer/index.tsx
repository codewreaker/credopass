import { useParams, useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { EventComposer } from './event-composer';
import { eventToFormValues } from './use-event-form';

/** `/events/new` — a blank composer. */
export function CreateEventPage() {
  // Composer owns its own submit CTA; nothing for the app toolbar to add.
  useToolbarContext({ search: { enabled: false, placeholder: '' } });
  return <EventComposer mode="create" />;
}

/** `/events/$eventId/edit` — the same composer, hydrated from the collection. */
export function EditEventPage() {
  // Route id keeps the `_` from `$eventId_.edit.tsx`, which un-nests this page
  // from the event detail route (that route renders no <Outlet/>).
  const { eventId } = useParams({ from: '/events/$eventId_/edit' });
  const navigate = useNavigate();
  useToolbarContext({ search: { enabled: false, placeholder: '' } });

  const { events: eventCollection } = getCollections();
  const { data: event, isLoading } = useLiveQuery((q) =>
    q
      .from({ eventCollection })
      .where(({ eventCollection }) => eq(eventCollection.id, eventId))
      .findOne()
  );

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
        <h2 className="text-lg font-semibold">Event not found</h2>
        <p className="text-sm text-muted-foreground">
          The event you&apos;re trying to edit doesn&apos;t exist or has been removed.
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
      initialValues={eventToFormValues(event as EventType)}
    />
  );
}
