import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType, UserType } from '@credopass/lib/schemas';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Button } from '@credopass/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { MemberComposer } from './member-composer';
import { userToFormValues } from './use-member-form';

/** Looks up the event a member is being scoped to, if there is one. */
function useScopedEvent(eventId?: string) {
  const { events: eventCollection } = getCollections();
  const { data } = useLiveQuery((q) =>
    q
      .from({ eventCollection })
      .where(({ eventCollection }) => eq(eventCollection.id, eventId ?? ''))
      .findOne()
  );
  return eventId ? ((data as EventType | undefined) ?? null) : null;
}

const Loading = () => (
  <div className="flex min-h-40 items-center justify-center">
    <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
  </div>
);

/** `/members/new` — a blank composer, usually opened from an event. */
export function CreateMemberPage() {
  // Composer owns its own submit CTA; nothing for the app toolbar to add.
  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });
  const { eventId } = useSearch({ from: '/members/new' });
  const event = useScopedEvent(eventId);

  return <MemberComposer mode="create" eventId={eventId} event={event} />;
}

/** `/members/$userId/edit` — the same composer, hydrated from the collection. */
export function EditMemberPage() {
  // Route id keeps the `_` from `$userId_.edit.tsx`, which un-nests this page.
  const { userId } = useParams({ from: '/members/$userId_/edit' });
  const { eventId } = useSearch({ from: '/members/$userId_/edit' });
  const navigate = useNavigate();
  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });

  const { users: userCollection, eventMembers: eventMemberCollection } = getCollections();
  const { data: user, isLoading } = useLiveQuery((q) =>
    q
      .from({ userCollection })
      .where(({ userCollection }) => eq(userCollection.id, userId))
      .findOne()
  );

  const { data: memberships } = useLiveQuery((q) =>
    q
      .from({ eventMemberCollection })
      .where(({ eventMemberCollection }) => eq(eventMemberCollection.userId, userId))
  );

  const event = useScopedEvent(eventId);

  if (isLoading) return <Loading />;

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">Member not found</h2>
        <p className="text-sm text-muted-foreground">
          The member you&apos;re trying to edit doesn&apos;t exist or has been removed.
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/members' })}>
          <ArrowLeft size={16} /> Back to Members
        </Button>
      </div>
    );
  }

  const currentRole = eventId
    ? (Array.isArray(memberships) ? memberships : []).find((m) => m.eventId === eventId)?.role
    : undefined;

  return (
    <MemberComposer
      // Remount once the user resolves so the form seeds from real values.
      key={user.id}
      mode="edit"
      userId={userId}
      eventId={eventId}
      event={event}
      initialValues={userToFormValues(user as UserType, currentRole ?? 'staff')}
    />
  );
}
