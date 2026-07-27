/**
 * `/events/$eventId` — the organiser's view of one event.
 *
 * Every value on this page is the API's answer, not a computation:
 * `Event.status` is derived server-side, `Event.shortCode` is a real code
 * someone reads aloud at a door, and `Event.counts` are already counted. There
 * is no `useMemo` here that turns one into another, and there should not be
 * (§2.4).
 *
 * Two things the plan calls out as blocked stay blocked and say so rather than
 * pretending: there is no ICS endpoint and no media endpoint yet, so "Add to
 * calendar" and the cover photo are absent, not faked.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Copy,
  Edit2,
  Globe,
  MapPin,
  ScanLine,
  Share2,
  Users,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns/format';
import {
  useCancelEvent,
  useCloseEvent,
  useEvent,
  useRegisterAttendee,
  type Event,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { TimelineMarker } from '@credopass/ui/components/timeline';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { EventQrPoster, EventQrPosterButton, useEventQrPoster } from './event-qr-poster';
import { useCan } from '../../../contexts/session';
import { errorMessage, isNotFound } from '../../../lib/errors';

/** Status pill colours on the lime billboard. */
const STATUS_STYLE: Record<Event['status'], string> = {
  scheduled: 'bg-primary-foreground/10',
  ongoing: 'bg-primary-foreground text-primary',
  completed: 'bg-primary-foreground/10',
  cancelled: 'bg-primary-foreground/10',
};

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

export function EventViewPage({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const { data: event, isLoading, error } = useEvent(eventId);

  if (isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  // Another organization's event is a 404 by design — never a 403, which would
  // confirm the row exists. "Gone or never existed" is the only thing to say.
  if (!event) {
    return (
      <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">
          {isNotFound(error) ? 'Event not found' : 'Could not load this event'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isNotFound(error)
            ? "This event doesn't exist or has been removed."
            : errorMessage(error)}
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/events' })}>
          <ArrowLeft size={16} /> Back to Events
        </Button>
      </div>
    );
  }

  return <EventView event={event} />;
}

function EventView({ event }: { event: Event }) {
  const navigate = useNavigate();
  const canRecord = useCan('attendance:record');
  const canUpdate = useCan('event:update');
  const canCancel = useCan('event:cancel');

  const [addAttendeeOpen, setAddAttendeeOpen] = useState(false);
  const { open: posterOpen, setOpen: setPosterOpen, openPoster } = useEventQrPoster();
  const closeEvent = useCloseEvent();
  const cancelEvent = useCancelEvent();

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/e/${event.id}` : `/e/${event.id}`),
    [event.id]
  );

  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const isEnded = event.status === 'completed' || event.status === 'cancelled';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Event link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const share = async () => {
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

  /** Finalises no-shows — everyone registered who never arrived. */
  const endEvent = async () => {
    try {
      const result = await closeEvent.mutateAsync(event.id);
      toast.success(
        result.noShows === 0
          ? 'Event closed. Everyone who registered turned up.'
          : `Event closed. ${result.noShows} marked as no-show.`
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Could not close the event'));
    }
  };

  /** Cancel keeps the rows, the URL and the history. Delete does not. */
  const cancel = async () => {
    try {
      await cancelEvent.mutateAsync({ id: event.id });
      toast.success('Event cancelled. Everyone keeps their pass and the link still works.');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not cancel the event'));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-140 flex-col gap-4 pb-24 md:max-w-160 lg:max-w-3xl">
      {/* Back / organiser actions */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 gap-2 rounded-full"
          onClick={() => navigate({ to: '/events' })}
        >
          <ArrowLeft size={16} /> Back to Events
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => navigate({ to: '/attendees', search: { eventId: event.id } })}>
          <Users size={14} />
          <span className="hidden sm:inline">Attendees</span>
        </Button>
        {!isEnded && (
          <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={openCheckinKiosk}>
            <ScanLine size={14} />
            <span className="hidden sm:inline">Check in guests</span>
          </Button>
        )}
        {canUpdate && (
          <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => navigate({ to: '/events/$eventId/edit', params: { eventId: event.id } })}>
            <Edit2 size={14} />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
      </div>

      {/* Lime billboard — mirrors the composer header */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-primary-foreground/10" />
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-32 size-64 rounded-full border border-primary-foreground/10" />

        <div className="relative flex items-center gap-2">
          <span className="min-w-0 truncate rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold">
            {event.organizationName}
          </span>
          <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', STATUS_STYLE[event.status])}>
            {event.status}
          </span>
        </div>

        <h1 className="relative mt-4 text-3xl font-bold tracking-tight">{event.name}</h1>
        {event.cancellationReason && (
          <p className="relative mt-2 text-sm text-primary-foreground/80">{event.cancellationReason}</p>
        )}
        <div className="relative mt-2 flex items-center gap-2 text-xs font-medium text-primary-foreground/70">
          <Globe size={13} />
          {timeZoneLabel()}
        </div>

        {/* Counts, already counted by the API */}
        <div className="relative mt-5 flex items-stretch gap-6">
          <div>
            <p className="text-2xl font-semibold leading-none tabular-nums">{event.counts.registered}</p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
              Registered
            </p>
          </div>
          <div className="border-l border-primary-foreground/15 pl-6">
            <p className="text-2xl font-semibold leading-none tabular-nums">{event.counts.attended}</p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
              Attended
            </p>
          </div>
          {event.capacity != null && (
            <div className="border-l border-primary-foreground/15 pl-6">
              <p className="text-2xl font-semibold leading-none tabular-nums">{event.capacity}</p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                Capacity
              </p>
            </div>
          )}
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
            onClick={openCheckinKiosk}
            ariaLabel="Open the check-in kiosk"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
              Check-in code
            </p>
            {/* A real code, issued with the event — not a slice of the id. */}
            <p className="truncate font-mono text-sm font-black tracking-wide">
              #{event.shortCode}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Scan to open the shareable page.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full font-semibold"
                onClick={
                  isEnded
                    ? () => navigate({ to: '/attendees', search: { eventId: event.id } })
                    : openCheckinKiosk
                }
              >
                {isEnded ? <Users size={14} /> : <ScanLine size={14} />}
                {isEnded ? 'View summary' : 'Check in guests'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={share}>
                <Share2 size={14} /> Share
              </Button>
              <EventQrPosterButton onClick={openPoster} />
            </div>
          </div>
        </div>
      </div>

      {/* Add an attendee — registering returns a pass URL that must be shown */}
      {canRecord && !isEnded && (
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full"
          onClick={() => setAddAttendeeOpen(true)}
        >
          <UserPlus size={15} /> Add an attendee
        </Button>
      )}

      {/* When */}
      <div className="rounded-2xl border border-border bg-card p-1.5">
        <div className="flex items-stretch gap-3 px-3 py-2.5">
          <TimelineMarker variant="filled" connectBelow className="-my-2.5" />
          <span className="flex w-12 shrink-0 items-center text-sm text-muted-foreground">Start</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm font-medium tabular-nums">
            {`${format(start, 'EEE d MMM')} · ${format(start, 'HH:mm')}`}
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

      {/* Where. No map: geocoding moved server-side and the coordinates are not
          populated yet, so a map here would be a guess (§2.4). */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
        <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className={cn('truncate text-sm font-medium', !event.location && 'text-muted-foreground')}>
            {event.location || 'No location set'}
          </span>
          <span className="text-xs text-muted-foreground">Offline location or virtual link</span>
        </span>
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

      {/* Devices at this event (§2.10) */}

      {/* Ending the event, and cancelling it. Two different things. */}
      {!isEnded && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            When it's over
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              disabled={closeEvent.isPending}
              onClick={endEvent}
            >
              <CheckCircle2 size={14} /> End event
            </Button>
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full text-destructive hover:text-destructive"
                disabled={cancelEvent.isPending}
                onClick={cancel}
              >
                <XCircle size={14} /> Cancel event
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ending finalises no-shows. Cancelling keeps everyone's pass and the link working, and
            tells them it isn't happening.
          </p>
        </div>
      )}

      <AddAttendeeDialog
        open={addAttendeeOpen}
        onOpenChange={setAddAttendeeOpen}
        eventId={event.id}
        eventName={event.name}
      />

      <EventQrPoster
        open={posterOpen}
        onOpenChange={setPosterOpen}
        eventName={event.name}
        shareUrl={shareUrl}
      />
    </div>
  );
}

/**
 * Register someone onto the event from the organiser side.
 *
 * `POST /events/{id}/register` returns a pass URL, and that URL is the only copy
 * anyone gets — there is no email service yet. So the dialog stops on the link
 * and says to send it, rather than claiming anything was delivered (§1.6).
 */
function AddAttendeeDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
}) {
  const register = useRegisterAttendee(eventId);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [passUrl, setPassUrl] = useState<string | null>(null);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !register.isPending;

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassUrl(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const result = await register.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setPassUrl(result.pass.url);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not register that attendee'));
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={passUrl ? 'Their pass' : `Add an attendee to ${eventName}`}
      footer={
        passUrl ? (
          <Button size="sm" className="rounded-full px-4" onClick={() => { reset(); }}>
            Add another
          </Button>
        ) : (
          <Button size="sm" className="rounded-full px-4" disabled={!canSubmit} onClick={submit}>
            <CalendarCheck /> Register
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {passUrl ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <GlowingQRCode value={passUrl} size={190} ariaLabel="Attendee pass" />
          <p className="w-full truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
            {passUrl}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(passUrl);
                toast.success('Pass link copied');
              } catch {
                toast.error('Could not copy the link');
              }
            }}
          >
            <Copy size={14} /> Copy pass link
          </Button>
          <p className="text-xs text-muted-foreground">
            Send this to them yourself — CredoPass does not email passes yet, and this is the only
            copy.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input autoFocus placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl" />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Input type="email" inputMode="email" placeholder="you@email.com (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
          <p className="px-1 text-xs text-muted-foreground">
            Registering does not check anyone in — an attendance record means they actually turned
            up.
          </p>
        </>
      )}
    </SheetDialog>
  );
}
