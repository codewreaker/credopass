import { useParams } from '@tanstack/react-router';
import { EventViewPage } from './EventView';

/**
 * `/e/$eventId` — the public, standalone shareable event page (no app shell).
 * This is what the event's QR opens; an attendee reads the details and checks
 * in. Same `EventView` component as the organiser's `/events/$eventId`.
 */
export default function PublicEventPage() {
  const { eventId } = useParams({ from: '/e/$eventId' });
  return (
    <div className="min-h-svh bg-background">
      <EventViewPage eventId={eventId} variant="public" />
    </div>
  );
}
