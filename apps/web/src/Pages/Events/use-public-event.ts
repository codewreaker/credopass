import { useCallback, useEffect, useState } from 'react';
import { getAPIBaseURL } from '@credopass/api-client';
import type { EventType } from '@credopass/lib/schemas';
import { toast } from '@credopass/ui/components/sonner';

/**
 * The read-only projection the public event endpoint returns. A structural
 * subset of `EventType` — exactly the fields the shared `EventView` renders —
 * so the public page never touches the authenticated collections (which would
 * 401 a logged-out visitor and hang forever; that was the #10 blocker, B1).
 */
export interface PublicEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startTime: Date | null;
  endTime: Date | null;
  capacity: number | null;
  status: EventType['status'];
  organizationId: string | null;
  organizationName: string | null;
}

export type PublicEventState =
  | { status: 'loading' }
  | { status: 'ready'; event: PublicEvent }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Fetch a single event from the token-optional public endpoint. Resolves to an
 * explicit state — loading / ready / not-found / error — so the page always
 * reaches a real surface instead of spinning forever.
 */
export function usePublicEvent(eventId: string): PublicEventState {
  const [state, setState] = useState<PublicEventState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`${getAPIBaseURL()}/public/events/${eventId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: 'notfound' });
          return;
        }
        if (!res.ok) throw new Error(`Couldn’t load this event (HTTP ${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setState({
          status: 'ready',
          event: {
            ...data,
            startTime: toDate(data.startTime),
            endTime: toDate(data.endTime),
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Something went wrong loading this event.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}

export interface AttendDetails {
  firstName: string;
  lastName: string;
  email: string;
}

export interface AttendResult {
  userId: string;
  attended: boolean;
  alreadyExisted: boolean;
}

/**
 * Self-service register / check-in against the token-optional public endpoint.
 * Works whether or not the visitor is signed in — the whole point of the public
 * attendee flow. `register` writes an RSVP (attended=false); `checkin` records
 * arrival (attended=true) and, if a prior RSVP exists, flips it.
 */
export function usePublicAttend() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attend = useCallback(
    async (
      eventId: string,
      details: AttendDetails,
      mode: 'register' | 'checkin',
      method: 'qr' | 'manual' | 'external_auth' = 'manual'
    ): Promise<AttendResult | null> => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`${getAPIBaseURL()}/public/events/${eventId}/attend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: details.firstName.trim(),
            lastName: details.lastName.trim(),
            email: details.email.trim(),
            mode,
            method,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        return { userId: data.userId, attended: data.attended, alreadyExisted: data.alreadyExisted };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { attend, isSubmitting };
}
