/**
 * One list: what you host and what you are going to.
 *
 * **Why they merged.** "My passes" shipped as its own tab, and that was the
 * wrong shape. Someone opening CredoPass is asking "what have I got on?", and
 * splitting the answer across two tabs made it depend on remembering which tab
 * you were in — an event you are speaking at and an event you are attending are
 * the same kind of thing on the same evening. Luma puts them in one list and
 * marks the difference on the row; so does this.
 *
 * **Two requests, two scopes, deliberately.** `/events` is organisation-scoped
 * (what your org runs) and `/me/tickets` is account-scoped (what you are on the
 * attendee list for, anywhere). They are not merged server-side and should not
 * be: the whole tenancy model rests on those being separate queries with
 * separate authorization, and one endpoint returning both would need to be
 * neither. They are joined here, in the client, where "what does this viewer
 * see" is a presentation question.
 *
 * **The hosting side wins a collision.** Register for your own event — which is
 * ordinary; you are at it — and the event appears in both. It is one row, and
 * it reads `Host`, because that is the relationship that carries the actions.
 */

import { useMemo } from 'react';
import {
  useEvents,
  useEventsSummary,
  useMyTickets,
  type Event,
  type Ticket,
  type TicketGroup,
} from '@credopass/api-client';
import type { EventRelationship } from '@credopass/ui/components/event-row';

/**
 * A row in the merged list.
 *
 * Host rows are a whole `Event`. Guest rows come from `/me/tickets`, which
 * deliberately does NOT return `organizationId`, `shortCode` or attendee
 * counts — an attendee has no business reading an organisation's id or how
 * many people are coming — so those three are optional here rather than
 * fabricated. Anything that needs them is a host-only action and narrows on
 * `relationship === 'host'` first.
 */
export type ListEvent = Omit<
  Event,
  'counts' | 'organizationId' | 'shortCode' | 'organizationName'
> &
  Partial<Pick<Event, 'counts' | 'organizationId' | 'shortCode'>> & {
    relationship: EventRelationship;
    /**
     * Nullable, unlike the host-facing `Event`.
     *
     * A guest row's organisation comes from `/me/tickets`, which withholds a
     * name the owner never chose rather than publishing someone's personal
     * name to the people they invited. The row renders no label when it is
     * null.
     */
    organizationName: string | null;
  };

/**
 * What the attendance state means to the person it is about.
 *
 * The one case worth spelling out: a PAST event still marked `registered`.
 * "Going" is plainly wrong in the past tense, "Went" would invent an arrival
 * nobody recorded, and "Missed" would accuse them of one — the job that writes
 * `no_show` on close may not have run. So it reads "Registered", which is the
 * only thing actually known.
 */
const relationshipFor = (ticket: Ticket): EventRelationship => {
  if (ticket.attendanceState === 'attended') return 'went';
  if (ticket.attendanceState === 'no_show') return 'missed';
  const isPast = ticket.status === 'completed' || ticket.status === 'cancelled';
  return isPast ? 'registered' : 'going';
};

const ticketToRow = (ticket: Ticket): ListEvent => ({
  id: ticket.eventId,
  name: ticket.name,
  description: null,
  status: ticket.status,
  startAt: ticket.startAt,
  endAt: ticket.endAt,
  location: ticket.location,
  meetingUrl: ticket.meetingUrl,
  format: ticket.format,
  capacity: null,
  organizationName: ticket.organizationName,
  allowSelfCheckIn: false,
  requireCheckOut: false,
  coverImageUrl: ticket.coverImageUrl,
  relationship: relationshipFor(ticket),
});

export interface MergedEvents {
  events: ListEvent[];
  /** Host rows by id, for the actions that only exist on them. */
  hosted: Map<string, Event>;
  /** How many of each, for the Upcoming ⇄ Past switch. */
  counts: { upcoming: number; past: number } | null;
  /**
   * The HOSTED half is paginated and this list shows its first page. Tickets
   * are capped server-side rather than paged, so this is only ever about the
   * events you run — which is the half a search is narrowing anyway.
   */
  hasMore: boolean;
  isLoading: boolean;
}

export function useMergedEvents({
  group,
  q,
}: {
  group: TicketGroup;
  q?: string;
}): MergedEvents {
  const hostedQuery = useEvents({ group, q });
  // The per-group totals live on `/events/summary`, not on the list response —
  // the list is one page, the counts are of everything. React Query dedupes
  // this with the page's own call.
  const summaryQuery = useEventsSummary();
  // Searching is an organisation-scoped capability — `/me/tickets` takes no
  // `q` — so a search narrows to events you host rather than silently
  // returning tickets the search box did not filter.
  const ticketsQuery = useMyTickets(group, { enabled: !q });

  return useMemo(() => {
    const hostedList = hostedQuery.data?.data ?? [];
    const hosted = new Map(hostedList.map((e) => [e.id, e]));

    const hostRows: ListEvent[] = hostedList.map((e) => ({ ...e, relationship: 'host' }));

    const guestRows = (ticketsQuery.data?.tickets ?? [])
      // Hosting wins. Registering for your own event must not produce two rows.
      .filter((t) => !hosted.has(t.eventId))
      .map(ticketToRow);

    // Sorted together, in the direction the group reads: upcoming runs
    // forwards from now, past runs backwards. Each half arrives sorted from
    // its own endpoint, so interleaving them is the only work left.
    const events = [...hostRows, ...guestRows].sort((a, b) => {
      const delta = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return group === 'past' ? -delta : delta;
    });

    const hostedCounts = summaryQuery.data?.groups ?? null;
    const ticketCounts = ticketsQuery.data?.counts ?? null;

    // `null` until BOTH have landed, so the switch shows a dash rather than a
    // number that is about to change under the reader (UI-REDESIGN R2).
    // During a search there are no ticket counts to wait for.
    const counts =
      hostedCounts && (ticketCounts || q)
        ? {
            upcoming: hostedCounts.upcoming + (ticketCounts?.upcoming ?? 0),
            past: hostedCounts.past + (ticketCounts?.past ?? 0),
          }
        : null;

    return {
      events,
      hosted,
      counts,
      hasMore: hostedQuery.data?.page.hasMore ?? false,
      isLoading: hostedQuery.isLoading || (!q && ticketsQuery.isLoading),
    };
  }, [
    hostedQuery.data,
    hostedQuery.isLoading,
    summaryQuery.data,
    ticketsQuery.data,
    ticketsQuery.isLoading,
    group,
    q,
  ]);
}
