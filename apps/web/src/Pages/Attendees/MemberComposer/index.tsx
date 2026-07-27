import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEvent, usePerson } from '@credopass/api-client';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { MemberComposer } from './member-composer';
import { personToFormValues } from './use-member-form';
import { errorMessage, isNotFound } from '../../../lib/errors';

const Loading = () => (
  <div className="flex min-h-40 items-center justify-center">
    <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
  </div>
);

/** `/attendees/new` — a blank composer, usually opened from an event. */
export function CreateMemberPage() {
  // Composer owns its own submit CTA; nothing for the app toolbar to add.
  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });
  const { eventId } = useSearch({ from: '/attendees/new' });
  const { data: event } = useEvent(eventId);

  return <MemberComposer mode="create" eventId={eventId} event={event ?? null} />;
}

/** `/attendees/$userId/edit` — the same composer, hydrated from `GET /people/{id}`. */
export function EditMemberPage() {
  // Route id keeps the `_` from `$userId_.edit.tsx`, which un-nests this page.
  const { userId } = useParams({ from: '/attendees/$userId_/edit' });
  const { eventId } = useSearch({ from: '/attendees/$userId_/edit' });
  const navigate = useNavigate();
  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });

  const { data: person, isLoading, error } = usePerson(userId);
  const { data: event } = useEvent(eventId);

  if (isLoading) return <Loading />;

  if (!person) {
    return (
      <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">
          {isNotFound(error) ? 'Attendee not found' : 'Could not load this attendee'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isNotFound(error)
            ? "The attendee you're trying to edit doesn't exist or has been removed."
            : errorMessage(error)}
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/attendees' })}>
          <ArrowLeft size={16} /> Back to Attendees
        </Button>
      </div>
    );
  }

  return (
    <MemberComposer
      // Remount once the person resolves so the form seeds from real values.
      key={person.id}
      mode="edit"
      personId={userId}
      eventId={eventId}
      event={event ?? null}
      initialValues={personToFormValues(person)}
    />
  );
}
