import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType, Organization } from '@credopass/lib/schemas';
import {
  ArrowLeft,
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
import { EventImage } from '../EventComposer/fields/event-image';
import { EventDetailsReadonly } from '../EventDetails';
import { useAttendeeCheckIn } from '../use-attendee-checkin';

/**
 * Loads an event by id and renders the shared read-only view, with loading and
 * not-found states. Used by both the in-shell detail route and the public route.
 */
export function EventViewPage({ eventId, variant }: { eventId: string; variant: 'detail' | 'public' }) {
  const navigate = useNavigate();
  const { events: eventCollection } = getCollections();
  const { data: event, isLoading } = useLiveQuery((q) =>
    q
      .from({ eventCollection })
      .where(({ eventCollection }) => eq(eventCollection.id, eventId))
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
        {variant === 'detail' && (
          <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/events' })}>
            <ArrowLeft size={16} /> Back to Events
          </Button>
        )}
      </div>
    );
  }

  return <EventView event={event as EventType} variant={variant} />;
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

/** Download an .ics for the event (same ICS the detail page produced). */
const downloadIcs = (event: EventType) => {
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
  event: EventType;
  /** `detail` = organiser, in the app shell. `public` = attendee, standalone. */
  variant: 'detail' | 'public';
}

/**
 * The read-only twin of the event composer — same billboard + When/Where/What
 * layout, plus the shareable ticket. One component, mounted both in-shell at
 * `/events/$eventId` (organiser) and standalone at `/e/$eventId` (attendee).
 */
export function EventView({ event, variant }: EventViewProps) {
  const navigate = useNavigate();
  const isPublic = variant === 'public';

  // Org name for the billboard pill (parity with the composer's OrgField).
  const { organizations: orgCollection } = getCollections();
  const { data: org } = useLiveQuery((q) =>
    q
      .from({ orgCollection })
      .where(({ orgCollection }) => eq(orgCollection.id, event.organizationId ?? ''))
      .findOne()
  );
  const orgName = (org as Organization | undefined)?.name;

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/e/${event.id}` : `/e/${event.id}`),
    [event.id]
  );

  const start = event.startTime ? new Date(event.startTime) : null;
  const end = event.endTime ? new Date(event.endTime) : null;

  const [checkInOpen, setCheckInOpen] = useState(false);

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
            <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={openCheckinKiosk}>
              <ScanLine size={14} />
              <span className="hidden sm:inline">Check-in</span>
            </Button>
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
            onClick={isPublic ? () => setCheckInOpen(true) : openCheckinKiosk}
            ariaLabel={isPublic ? 'Check in to this event' : 'Open the check-in kiosk'}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
              Check-in code
            </p>
            <p className="truncate font-mono text-sm font-black tracking-wide">
              #{event.id?.slice(0, 12).toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPublic ? 'Scan or tap to check in.' : 'Scan to open the shareable page.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full font-semibold"
                onClick={isPublic ? () => setCheckInOpen(true) : openCheckinKiosk}
              >
                {isPublic ? <Ticket size={14} /> : <ScanLine size={14} />}
                {isPublic ? 'Check-in to Event' : 'Check-in Guests'}
              </Button>
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
        {event.location && <EventDetailsReadonly event={event} />}
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

      <EventImage />

      {/* Sticky attendee CTA on the public page */}
      {isPublic && (
        <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 bg-linear-to-t from-background via-background to-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
          <Button variant="outline" className="h-12 flex-1 rounded-full font-semibold" onClick={() => downloadIcs(event)}>
            <CalendarPlus /> Add to calendar
          </Button>
          <Button className="h-12 flex-2 rounded-full font-semibold" onClick={() => setCheckInOpen(true)}>
            <Ticket /> Check in
          </Button>
        </div>
      )}

      {isPublic && (
        <AttendeeCheckInDialog open={checkInOpen} onOpenChange={setCheckInOpen} event={event} />
      )}
    </div>
  );
}

/** Self check-in: collect name/email, write attendance, then show the ticket QR. */
function AttendeeCheckInDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventType;
}) {
  const { checkIn, isSubmitting } = useAttendeeCheckIn();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);

  const canSubmit = firstName.trim().length > 1 && lastName.trim().length > 1 && /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!canSubmit) return;
    const result = await checkIn(event, { firstName, lastName, email }, 'manual');
    if (!result) return;
    setTicketId(result.userId);
    toast.success(result.alreadyCheckedIn ? 'You were already checked in' : "You're checked in!");
  };

  // The personal ticket the host scanner reads to confirm attendance.
  const ticketValue = ticketId ? `${event.id}:${ticketId}` : '';

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={ticketId ? 'Your ticket' : 'Check in'}
      footer={
        ticketId ? (
          <Button size="sm" className="rounded-full px-4" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <Button size="sm" className="rounded-full px-4" disabled={!canSubmit || isSubmitting} onClick={submit}>
            <CheckIcon /> Check in
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {ticketId ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <GlowingQRCode value={ticketValue} size={200} ariaLabel="Your check-in ticket" />
          <p className="text-sm font-medium">Show this to the host to confirm your attendance.</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} /> Checked in just now
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
            We record your attendance for “{event.name}”.
          </p>
        </>
      )}
    </SheetDialog>
  );
}
