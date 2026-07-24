import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType, Organization } from '@credopass/lib/schemas';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarPlus,
  CheckIcon,
  Clock,
  Copy,
  Edit2,
  Globe,
  MapPin,
  ScanLine,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';
import { format } from 'date-fns/format';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { TimelineMarker } from '@credopass/ui/components/timeline';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { supabase } from '../../../supabase';
import { EventDetailsReadonly } from '../EventDetails';
import { usePublicAttend, type PublicEvent } from '../use-public-event';

/**
 * The fields the shared `EventView` renders. `EventType` (organiser, from the
 * authenticated collection) and `PublicEvent` (attendee, from the public
 * endpoint) both satisfy it — so the same component drives both surfaces without
 * the public path ever touching an authenticated collection.
 */
type EventViewModel = Pick<EventType, 'id' | 'name' | 'status' | 'description' | 'capacity'> & {
  startTime: Date | null;
  endTime: Date | null;
  // Nullable so both EventType (non-null) and PublicEvent (nullable) satisfy it.
  location: string | null;
  organizationId?: string | null;
};

/**
 * Loads an event by id from the authenticated collection and renders the shared
 * read-only view (organiser / in-shell only). The public route uses
 * `PublicEventPage`, which fetches the token-optional endpoint instead.
 */
export function EventViewPage({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const { events: eventCollection, organizations: orgCollection } = getCollections();
  const { data: event, isLoading } = useLiveQuery((q) =>
    q
      .from({ eventCollection })
      .where(({ eventCollection }) => eq(eventCollection.id, eventId))
      .findOne()
  );
  const { data: org } = useLiveQuery((q) =>
    q
      .from({ orgCollection })
      .where(({ orgCollection }) => eq(orgCollection.id, (event as EventType | undefined)?.organizationId ?? ''))
      .findOne()
  );

  // Keep showing the spinner while the collection refetches (e.g. right after
  // create) rather than flashing "not found" at a row about to arrive.
  const isSyncing = isLoading || (!event && eventCollection.utils.isFetching);

  if (isSyncing) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">Event not found</h2>
        <p className="text-sm text-muted-foreground">
          This event doesn&apos;t exist or has been removed.
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/events' })}>
          <ArrowLeft size={16} /> Back to Events
        </Button>
      </div>
    );
  }

  return (
    <EventView
      event={event as EventType}
      variant="detail"
      orgName={(org as Organization | undefined)?.name}
    />
  );
}

/** GMT offset + zone, matching the composer's footer. */
const timeZoneLabel = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    return `GMT${sign}${hours}:${minutes} · ${zone}`;
  } catch {
    return '';
  }
};

const STATUS_STYLE: Record<EventType['status'], string> = {
  draft: 'bg-primary-foreground/10',
  scheduled: 'bg-primary-foreground/10',
  ongoing: 'bg-primary-foreground text-primary',
  completed: 'bg-primary-foreground/10',
  cancelled: 'bg-primary-foreground/10',
};

/**
 * The public-page primary action follows event state (§3.5): register ahead of
 * time, check in while it's live, nothing once it's over. This one rule makes
 * the register-vs-checkin split legible and stops offering check-in on a
 * finished event (B4).
 */
type PublicCta =
  | { kind: 'register' | 'checkin'; label: string }
  | { kind: 'ended'; label: string };

const publicCtaFor = (status: EventType['status']): PublicCta => {
  if (status === 'ongoing') return { kind: 'checkin', label: 'Check in' };
  if (status === 'completed' || status === 'cancelled') return { kind: 'ended', label: 'This event has ended' };
  return { kind: 'register', label: 'Register' };
};

/** Download an .ics for the event (same ICS the detail page produced). */
const downloadIcs = (event: EventViewModel) => {
  const start = event.startTime instanceof Date ? event.startTime : new Date();
  const end = event.endTime instanceof Date ? event.endTime : new Date();
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${event.name}`, `DESCRIPTION:${event.description || ''}`,
    `LOCATION:${event.location || ''}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.name.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface EventViewProps {
  event: EventViewModel;
  /** `detail` = organiser, in the app shell. `public` = attendee, standalone. */
  variant: 'detail' | 'public';
  /** Org name for the billboard pill (passed in so public never queries collections). */
  orgName?: string;
}

/**
 * The read-only twin of the event composer — same billboard + When/Where/What
 * layout, plus the shareable pass. One component, mounted both in-shell at
 * `/events/$eventId` (organiser) and standalone at `/e/$eventId` (attendee).
 */
export function EventView({ event, variant, orgName }: EventViewProps) {
  const navigate = useNavigate();
  const isPublic = variant === 'public';

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/e/${event.id}` : `/e/${event.id}`),
    [event.id]
  );

  const start = event.startTime ? new Date(event.startTime) : null;
  const end = event.endTime ? new Date(event.endTime) : null;

  const cta = publicCtaFor(event.status);
  const isEnded = event.status === 'completed' || event.status === 'cancelled';

  // The public check-in/register sheet, opened in whichever mode the state implies.
  const [attendOpen, setAttendOpen] = useState(false);
  const attendMode = cta.kind === 'checkin' ? 'checkin' : 'register';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Event link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const share = async () => {
    // Native share sheets don't always surface a plain "copy", so if sharing
    // isn't available (or is dismissed) we fall back to copying the link.
    try {
      if (navigator.share) {
        await navigator.share({ title: event.name, url: shareUrl });
      } else {
        await copyLink();
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  const openCheckinKiosk = () => navigate({ to: '/checkin/$eventId', params: { eventId: event.id } });
  const openAttend = () => setAttendOpen(true);

  // Organiser pass-card CTA is gated by status too: a completed event points at
  // the attendee summary instead of a live check-in kiosk (B4).
  const organiserPassPrimary = isEnded
    ? {
        label: 'View summary',
        icon: <Users size={14} />,
        onClick: () => navigate({ to: '/attendees', search: { eventId: event.id } }),
      }
    : {
        label: 'Check-in Guests',
        icon: <ScanLine size={14} />,
        onClick: openCheckinKiosk,
      };

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-140 flex-col gap-4 pb-24 md:max-w-160 lg:max-w-3xl',
        isPublic && 'px-4 pt-6'
      )}
    >
      {/* Back / organiser actions */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 gap-2 rounded-full"
          onClick={() => (isPublic ? share() : navigate({ to: '/events' }))}
        >
          {isPublic ? <Share2 size={15} /> : <ArrowLeft size={16} />}
          {isPublic ? 'Share' : 'Back to Events'}
        </Button>
        <div className="flex-1" />
        {!isPublic && (
          <>
            <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => navigate({ to: '/attendees', search: { eventId: event.id } })}>
              <Users size={14} />
              <span className="hidden sm:inline">Attendees</span>
            </Button>
            {!isEnded && (
              <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={openCheckinKiosk}>
                <ScanLine size={14} />
                <span className="hidden sm:inline">Check-in</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => navigate({ to: '/events/$eventId/edit', params: { eventId: event.id } })}>
              <Edit2 size={14} />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </>
        )}
      </div>

      {/* Lime billboard — mirrors the composer header */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-primary-foreground/10" />
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-32 size-64 rounded-full border border-primary-foreground/10" />

        <div className="relative flex items-center gap-2">
          {orgName && (
            <span className="min-w-0 truncate rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold">
              {orgName}
            </span>
          )}
          <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', STATUS_STYLE[event.status])}>
            {event.status}
          </span>
        </div>

        <h1 className="relative mt-4 text-3xl font-bold tracking-tight">{event.name}</h1>
        <div className="relative mt-2 flex items-center gap-2 text-xs font-medium text-primary-foreground/70">
          <Globe size={13} />
          {timeZoneLabel()}
        </div>
      </div>

      {/* Shareable pass — borrows the ticket look (perforated stub + QR + code)
          as one compact accent, not a second card duplicating the meta above. */}
      <div className="relative overflow-hidden rounded-2xl border-border bg-linear-to-br from-card via-secondary to-primary/10">
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full border-16 border-primary/6" />
        {/* Notched perforation edge */}
        <div className="pointer-events-none absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />
        <div className="pointer-events-none absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-background" />

        <div className="relative flex items-center gap-4 p-5">
          <GlowingQRCode
            value={shareUrl}
            size={92}
            onClick={isPublic ? (isEnded ? undefined : openAttend) : openCheckinKiosk}
            ariaLabel={isPublic ? 'Register or check in to this event' : 'Open the check-in kiosk'}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
              Check-in code
            </p>
            <p className="truncate font-mono text-sm font-black tracking-wide">
              #{event.id?.slice(0, 12).toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPublic
                ? isEnded
                  ? 'This event has ended.'
                  : cta.kind === 'checkin'
                    ? 'Scan or tap to check in.'
                    : 'Scan or tap to register.'
                : 'Scan to open the shareable page.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isPublic ? (
                !isEnded && (
                  <Button size="sm" className="rounded-full font-semibold" onClick={openAttend}>
                    {cta.kind === 'checkin' ? <Ticket size={14} /> : <CalendarCheck size={14} />}
                    {cta.label}
                  </Button>
                )
              ) : (
                <Button size="sm" className="rounded-full font-semibold" onClick={organiserPassPrimary.onClick}>
                  {organiserPassPrimary.icon}
                  {organiserPassPrimary.label}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={share}>
                <Share2 size={14} /> Share
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={copyLink}>
                <Copy size={14} /> Copy link
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* When */}
      <div className="rounded-2xl border border-border bg-card p-1.5">
        <div className="flex items-stretch gap-3 px-3 py-2.5">
          <TimelineMarker variant="filled" connectBelow className="-my-2.5" />
          <span className="flex w-12 shrink-0 items-center text-sm text-muted-foreground">Start</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm font-medium tabular-nums">
            {start ? `${format(start, 'EEE d MMM')} · ${format(start, 'HH:mm')}` : 'Not set'}
          </span>
        </div>
        <div className="flex items-stretch gap-3 px-3 py-2.5">
          <TimelineMarker variant="hollow" connectAbove className="-my-2.5" />
          <span className="flex w-12 shrink-0 items-center text-sm text-muted-foreground">End</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm font-medium tabular-nums">
            {end ? `${format(end, 'EEE d MMM')} · ${format(end, 'HH:mm')}` : 'Open ended'}
          </span>
        </div>
      </div>

      {/* Where — location + map */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
          <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex flex-col gap-0.5">
            <span className={cn('truncate text-sm font-medium', !event.location && 'text-muted-foreground')}>
              {event.location || 'No location set'}
            </span>
            <span className="text-xs text-muted-foreground">Offline location or virtual link</span>
          </span>
        </div>
        {event.location && <EventDetailsReadonly event={event as EventType} />}
      </div>

      {/* Description */}
      {event.description && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            About
          </span>
          <p className="whitespace-pre-wrap rounded-2xl border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
            {event.description}
          </p>
        </div>
      )}

      {/* Options — capacity */}
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Event Options
        </span>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users size={15} /> Capacity
          </span>
          <span className="text-sm font-medium tabular-nums">
            {event.capacity ? `${event.capacity} seats` : 'Unlimited'}
          </span>
        </div>
      </div>

      {/* Sticky attendee CTA on the public page — state-driven (§3.5) */}
      {isPublic && (
        <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 bg-linear-to-t from-background via-background to-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
          {isEnded ? (
            <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground">
              <Clock size={15} /> This event has ended
            </div>
          ) : (
            <>
              <Button variant="outline" className="h-12 flex-1 rounded-full font-semibold" onClick={() => downloadIcs(event)}>
                <CalendarPlus /> Add to calendar
              </Button>
              <Button className="h-12 flex-2 rounded-full font-semibold" onClick={openAttend}>
                {cta.kind === 'checkin' ? <Ticket /> : <CalendarCheck />}
                {cta.label}
              </Button>
            </>
          )}
        </div>
      )}

      {isPublic && !isEnded && (
        <AttendeeSelfServiceDialog
          open={attendOpen}
          onOpenChange={setAttendOpen}
          event={event as PublicEvent}
          mode={attendMode}
        />
      )}
    </div>
  );
}

/**
 * Self register / check-in against the token-optional public endpoint. Collects
 * name + email (soft-prefilled from a signed-in session where possible, M5) and,
 * on success, shows the personal pass QR the host scanner reads.
 */
function AttendeeSelfServiceDialog({
  open,
  onOpenChange,
  event,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicEvent;
  mode: 'register' | 'checkin';
}) {
  const { attend, isSubmitting } = usePublicAttend();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [done, setDone] = useState<'registered' | 'checkin' | null>(null);

  const isCheckin = mode === 'checkin';

  // Soft prefill (M5): a signed-in, non-anonymous session already knows who this
  // is — carry their email/name into the form so returning attendees barely type.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (cancelled || !user || user.is_anonymous) return;
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; first_name?: string; last_name?: string };
      if (user.email) setEmail((prev) => prev || user.email!);
      const full = meta.full_name || meta.name || '';
      const [firstFromFull, ...rest] = full.trim().split(/\s+/);
      const first = meta.first_name || firstFromFull || '';
      const last = meta.last_name || rest.join(' ') || '';
      if (first) setFirstName((prev) => prev || first);
      if (last) setLastName((prev) => prev || last);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const canSubmit = firstName.trim().length > 1 && lastName.trim().length > 1 && /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!canSubmit) return;
    const result = await attend(event.id, { firstName, lastName, email }, mode, 'manual');
    if (!result) return;
    setTicketId(result.userId);
    setDone(isCheckin ? 'checkin' : 'registered');
    if (isCheckin) {
      toast.success(result.alreadyExisted && result.attended ? 'You were already checked in' : "You're checked in!");
    } else {
      toast.success(result.alreadyExisted ? "You're on the list" : "You're registered — see you there!");
    }
  };

  // The personal pass the host scanner reads to confirm attendance.
  const ticketValue = ticketId ? `${event.id}:${ticketId}` : '';

  const title = ticketId ? 'Your pass' : isCheckin ? 'Check in' : 'Register';

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        ticketId ? (
          <Button size="sm" className="rounded-full px-4" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <Button size="sm" className="rounded-full px-4" disabled={!canSubmit || isSubmitting} onClick={submit}>
            {isCheckin ? <CheckIcon /> : <CalendarCheck />} {isCheckin ? 'Check in' : 'Register'}
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {ticketId ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <GlowingQRCode value={ticketValue} size={200} ariaLabel="Your event pass" />
          <p className="text-sm font-medium">
            {done === 'registered'
              ? 'Save your pass — show this at the door to check in.'
              : 'Show this to the host to confirm your attendance.'}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {done === 'registered' ? <CalendarCheck size={12} /> : <Clock size={12} />}
            {done === 'registered' ? 'Registered' : 'Checked in just now'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input autoFocus placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl" />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Input type="email" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
          <p className="px-1 text-xs text-muted-foreground">
            {isCheckin
              ? `We record your attendance for “${event.name}”.`
              : `Let the host know you’re coming to “${event.name}”. You’ll get a pass to check in at the door.`}
          </p>
        </>
      )}
    </SheetDialog>
  );
}
