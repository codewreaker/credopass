import { useParams } from '@tanstack/react-router';
import { CalendarX2, RotateCw } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { EventView } from './EventView';
import { usePublicEvent } from './use-public-event';

/**
 * `/e/$eventId` — the public, standalone shareable event page (no app shell).
 * This is what the event's QR opens. It fetches the token-optional public
 * endpoint (never the authenticated collection), so a logged-out visitor reads
 * the event with zero 401s and always lands on a real surface — the event, a
 * clear not-found, or a retryable error — never an infinite spinner (fixes B1).
 */
export default function PublicEventPage() {
  const { eventId } = useParams({ from: '/e/$eventId' });
  const state = usePublicEvent(eventId);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (state.status === 'notfound') {
    return (
      <PublicEventMessage
        icon={<CalendarX2 className="size-8 text-muted-foreground" />}
        title="Event not found"
        description="This event doesn’t exist or the link has expired. Double-check the link from the host."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <PublicEventMessage
        icon={<RotateCw className="size-8 text-muted-foreground" />}
        title="Couldn’t load this event"
        description={state.message}
        action={{ label: 'Try again', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <EventView event={state.event} variant="public" orgName={state.event.organizationName ?? undefined} />
    </div>
  );
}

function PublicEventMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card">{icon}</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action && (
          <Button className="mt-1 rounded-full" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
