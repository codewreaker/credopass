/**
 * `/tickets` — the events you are GOING to, as opposed to the ones you run.
 *
 * **Why this exists.** The product had one list of events and it was the
 * hosting list. Someone who registers for three events a month and hosts none
 * opened CredoPass to an empty screen and a "create your first event" button —
 * the app held their attendance and showed them none of it. Luma makes the
 * distinction the first thing on the page; this is that distinction.
 *
 * The data comes from `GET /me/tickets`, which is `scope: 'account'` and takes
 * no organisation. That is the whole point: these rows span every
 * organisation the account has ever attended anything in, and the active-org
 * switcher must not filter them. Appearing here means an organisation holds a
 * `people` row claimed by this account — **not** that the account is a member
 * of that organisation (T29).
 *
 * A pass is reissued rather than fetched. Only the SHA-256 of a pass token is
 * stored, so the link handed over at registration genuinely is the only copy;
 * "Show my pass" mints a new one and revokes the old, which the button says.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  MapPin,
  QrCode,
  Ticket as TicketIcon,
  UserX,
  Video,
} from 'lucide-react';
import { format } from 'date-fns/format';
import { useMyTickets, useReissuePass, type Ticket, type TicketGroup } from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { errorMessage } from '../../lib/errors';

/**
 * How an attendance state reads to the person it is about.
 *
 * The host-facing vocabulary ("no_show") is a record; this is the same fact
 * said to the human it describes, which is why `no_show` is "Missed" and not
 * an accusation. `cancelled` is the attendance being withdrawn, not the event.
 */
const STATE_CHIP: Record<
  Ticket['attendanceState'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  attended: {
    label: 'You went',
    icon: CheckCircle2,
    className: 'border-success/30 bg-success/10 text-success',
  },
  registered: {
    label: 'Going',
    icon: CalendarClock,
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  no_show: {
    label: 'Missed',
    icon: UserX,
    className: 'border-border bg-muted text-muted-foreground',
  },
  cancelled: {
    label: 'Cancelled',
    icon: CalendarX2,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

const GROUPS: { value: TicketGroup; label: string; icon: typeof CalendarClock }[] = [
  { value: 'upcoming', label: 'Going', icon: CalendarClock },
  { value: 'past', label: 'Went', icon: History },
];

export default function TicketsPage() {
  const [group, setGroup] = useState<TicketGroup>('upcoming');
  const { data, isLoading } = useMyTickets(group);

  const tickets = data?.tickets ?? [];
  // `null` until the request lands. A count of `0` that was never fetched is
  // the most repeated defect in this product (UI-REDESIGN R2).
  const counts = data?.counts ?? null;
  const activeIndex = GROUPS.findIndex((g) => g.value === group);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <TicketIcon size={18} className="text-primary" />
            My passes
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Events you are attending — whoever is running them.
          </p>
        </div>

        {/* The same two-position slider the hosting list uses, so the two
            screens read as two views of one idea rather than two features. */}
        <div
          role="radiogroup"
          aria-label="Filter your passes by timing"
          className="relative grid shrink-0 grid-cols-2 rounded-full border border-border bg-card p-1"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {GROUPS.map(({ value, label, icon: Icon }) => {
            const active = value === group;
            const n = counts ? counts[value] : null;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={n === null ? label : `${label}, ${n} events`}
                onClick={() => setGroup(value)}
                className={cn(
                  'relative z-10 inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-4 text-[11px] font-semibold transition-colors duration-150',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon size={12} />
                {label}
                <span
                  className={cn(
                    'tabular-nums',
                    active ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
                  )}
                >
                  {n === null ? '–' : n}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {!isLoading && tickets.length === 0 && (
        <EmptyStateForGroup group={group} hasOther={!!counts && counts[group === 'upcoming' ? 'past' : 'upcoming'] > 0} onSwitch={() => setGroup(group === 'upcoming' ? 'past' : 'upcoming')} />
      )}

      {tickets.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.eventId} ticket={ticket} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyStateForGroup({
  group,
  hasOther,
  onSwitch,
}: {
  group: TicketGroup;
  hasOther: boolean;
  onSwitch: () => void;
}) {
  // Nothing on this side but something on the other is a different situation
  // from having nothing at all, and sending someone to the other tab beats
  // telling them they have no history when they do.
  if (hasOther) {
    return (
      <div className="flex items-center justify-center py-4">
        <EmptyState
          iconUrl="/empty-state-two.svg"
          title={group === 'upcoming' ? 'Nothing coming up' : 'Nothing behind you yet'}
          description={
            group === 'upcoming'
              ? 'You have no events coming up — but the ones you have been to are all here.'
              : 'You have not been to an event yet. The ones you are going to are under Going.'
          }
          action={{ label: group === 'upcoming' ? 'See where you went' : 'See what is coming', onClick: onSwitch }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-4">
      <EmptyState
        iconUrl="/empty-state-one.svg"
        title="No passes yet"
        description="When you register for an event, it lands here — and so does the record that you turned up. Open an event link from a host to get started."
      />
    </div>
  );
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  const navigate = useNavigate();
  const reissue = useReissuePass();
  const chip = STATE_CHIP[ticket.attendanceState];
  const start = new Date(ticket.startAt);
  const end = new Date(ticket.endAt);

  // Only worth offering while the pass can still get you through a door. For a
  // past event the record is the point, not the QR.
  const passIsUseful =
    ticket.status !== 'cancelled' &&
    ticket.status !== 'completed' &&
    ticket.attendanceState !== 'cancelled';

  const showPass = useCallback(async () => {
    try {
      const pass = await reissue.mutateAsync(ticket.eventId);
      navigate({ to: '/p/$token', params: { token: pass.token } });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not get your pass'));
    }
  }, [navigate, reissue, ticket.eventId]);

  return (
    <li className="group relative flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-colors hover:border-border-strong">
      {/* The poster, small. It is the thing that makes a list of names read as
          a list of events — but it is never the reason a row is tappable, so
          it stays decorative and the heading carries the link. */}
      <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:block">
        {ticket.coverImageUrl ? (
          <img
            src={ticket.coverImageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <CalendarClock size={20} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a
              href={`/e/${ticket.eventId}`}
              className="truncate text-sm font-semibold outline-none after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ticket.name}
            </a>
            <p className="truncate text-xs text-muted-foreground">{ticket.organizationName}</p>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]',
              chip.className
            )}
          >
            <chip.icon size={10} />
            {chip.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock size={12} />
            {format(start, 'EEE d MMM')} · {format(start, 'HH:mm')}
            {end.getTime() !== start.getTime() ? `–${format(end, 'HH:mm')}` : ''}
          </span>
          {ticket.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{ticket.location}</span>
            </span>
          ) : ticket.meetingUrl ? (
            <span className="inline-flex items-center gap-1">
              <Video size={12} /> Online
            </span>
          ) : null}
          {ticket.checkInTime && (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 size={12} />
              Checked in {format(new Date(ticket.checkInTime), 'HH:mm')}
            </span>
          )}
        </div>

        {/* Above the stretched link so they stay clickable. */}
        <div className="relative z-10 mt-0.5 flex flex-wrap items-center gap-1.5">
          {passIsUseful && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-full px-3 text-[11px]"
              disabled={reissue.isPending}
              onClick={showPass}
              // Said on the control, not after it: a new pass invalidates the
              // link the attendee may already have saved.
              title="Issues a new pass and replaces any earlier link"
            >
              <QrCode size={12} />
              {reissue.isPending ? 'Getting your pass…' : 'Show my pass'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-3 text-[11px] text-muted-foreground"
            render={(props) => <a {...props} href={`/e/${ticket.eventId}`} />}
          >
            <ExternalLink size={12} /> Event page
          </Button>
        </div>
      </div>
    </li>
  );
}
