import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '@credopass/lib/hooks';
import type { EventType, User, UserType } from '@credopass/lib/schemas';
import { getCollections } from '@credopass/api-client/collections';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { QrCodeIcon, ArrowLeft, ScanLine, UserRoundPlus, Bug, Trash2, CalendarCheck, Users, Maximize2, Minimize2, MapPin } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';

import './style.css';
import CheckInHeader from './components/CheckInHeader';
import { QRScanner } from './components/QRScanner';
import ManualSignInForm from './ManualSignInForm';
import SuccessCheckInScreen from './SuccessCheckInScreen';
import { useAttendeeCheckIn } from '../Events/use-attendee-checkin';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';

type KioskMode = 'display' | 'scan';

const LoadingState: React.FC = () => (
  <div className="checkin-page active-checkin-layout" aria-busy="true">
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-9 w-16 rounded-lg" />
    </div>
    <Skeleton className="h-105 rounded-2xl" />
  </div>
);

const CheckInPage: React.FC = () => {
  const { eventId } = useParams({ from: '/checkin/$eventId' });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { events: eventCollection, users: userCollection } = getCollections();

  // DEV drawer — a running log of scans, parse outcomes and errors so check-in
  // (especially the camera scanner on real devices) can be debugged in place.
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<{ at: string; kind: 'scan' | 'ok' | 'error' | 'info'; msg: string }[]>([]);
  const [lastDecodeError, setLastDecodeError] = useState<string | null>(null);
  const pushLog = useCallback(
    (kind: 'scan' | 'ok' | 'error' | 'info', msg: string) =>
      setDebugLog((l) => [{ at: new Date().toLocaleTimeString(), kind, msg }, ...l].slice(0, 50)),
    []
  );

  // Expose the DEV drawer as this view's contextual toolbar action.
  useToolbarContext({
    action: { icon: Bug, label: 'Debug check-in', onClick: () => setDebugOpen(true) },
    search: { enabled: false, placeholder: '' },
  });

  const { data: event, isLoading } = useLiveQuery((q) =>
    q.from({ eventCollection }).where(({ eventCollection }) => eq(eventCollection.id, eventId)).findOne()
  );
  const { data: usersData } = useLiveQuery((q) => q.from({ userCollection }));
  const users = useMemo<UserType[]>(() => (Array.isArray(usersData) ? usersData : []), [usersData]);

  const { checkIn } = useAttendeeCheckIn();

  const [mode, setMode] = useState<KioskMode>('display');
  const [manualOpen, setManualOpen] = useState(false);
  const [checkInCount, setCheckInCount] = useState(0);
  const [successUser, setSuccessUser] = useState<Partial<User> | null>(null);

  const [maximised, setMaximised] = useState(false);

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/e/${eventId}` : `/e/${eventId}`),
    [eventId]
  );

  // Maximise fills the *app window* only — deliberately no `requestFullscreen()`.
  // Taking over the whole screen is the OS's business and the user's choice; they
  // can hit F11 (or the browser's own control) on top of this if they want it.
  const enterMaximised = useCallback(() => setMaximised(true), []);
  const exitMaximised = useCallback(() => setMaximised(false), []);

  useEffect(() => {
    if (!maximised) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') exitMaximised();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximised, exitMaximised]);

  // Size the maximised QR off the shorter viewport edge so it stays square and
  // fully visible — recomputed on resize, since a door tablet gets rotated. The
  // wide breakpoint puts the details beside the code rather than under it, so it
  // gets a smaller share; the cap stops it ballooning on a desktop monitor.
  const [maxQrSize, setMaxQrSize] = useState(320);
  useEffect(() => {
    if (!maximised) return;
    const fit = () => {
      const short = Math.min(window.innerWidth, window.innerHeight);
      const share = window.innerWidth >= 1024 ? 0.5 : 0.62;
      setMaxQrSize(Math.round(Math.max(200, Math.min(short * share, 460))));
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [maximised]);

  const celebrate = useCallback((user: Partial<User>) => {
    setSuccessUser(user);
    setCheckInCount((c) => c + 1);
    setTimeout(() => setSuccessUser(null), 2600);
  }, []);

  // Manual check-in → attendance API.
  const handleManual = useCallback(
    async (details: Partial<User>) => {
      const ev = event as EventType | undefined;
      if (!ev) return;
      const result = await checkIn(
        ev,
        { firstName: details.firstName ?? '', lastName: details.lastName ?? '', email: details.email ?? '' },
        'manual'
      );
      if (!result) return;
      setManualOpen(false);
      if (result.alreadyCheckedIn) toast.info('Already checked in');
      celebrate(details);
    },
    [event, checkIn, celebrate]
  );

  // Scanned an attendee ticket (`eventId:userId`) → attendance API.
  const handleScan = useCallback(
    async (value: string) => {
      const ev = event as EventType | undefined;
      if (!ev) return;
      pushLog('scan', value);
      const [scannedEventId, userId] = value.split(':');
      if (!userId || scannedEventId !== ev.id) {
        pushLog(
          'error',
          value.includes('/e/')
            ? "That's the event's shareable link, not an attendee ticket."
            : `Not a valid ticket for this event (got eventId "${scannedEventId ?? ''}").`
        );
        toast.error('Not a valid ticket for this event');
        return;
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        pushLog('error', `No local user matches ticket userId "${userId}".`);
        toast.error('Ticket not recognised');
        return;
      }
      const result = await checkIn(
        ev,
        { firstName: user.firstName, lastName: user.lastName, email: user.email },
        'qr'
      );
      if (!result) {
        pushLog('error', `Check-in write failed for ${user.firstName} ${user.lastName}.`);
        return;
      }
      pushLog('ok', `${result.alreadyCheckedIn ? 'Already in' : 'Checked in'}: ${user.firstName} ${user.lastName}`);
      if (result.alreadyCheckedIn) toast.info(`${user.firstName} was already checked in`);
      celebrate(user);
    },
    [event, users, checkIn, celebrate, pushLog]
  );

  if (isLoading) return <LoadingState />;

  if (!event) {
    return (
      <div className="checkin-page flex h-full flex-col items-center justify-center p-6">
        <EmptyState
          error
          icon={<QrCodeIcon className="size-16 text-primary" />}
          title="Event Not Found"
          description="The event you're trying to check in to doesn't exist or has been removed."
          action={{ label: 'Back to Events', icon: <ArrowLeft className="h-5 w-5" />, onClick: () => navigate({ to: '/events' }) }}
        />
      </div>
    );
  }

  const ev = event as EventType;

  // Collections synced from PostgREST can hand back timestamps as ISO strings on
  // the first read, so coerce rather than trusting `instanceof Date`.
  const startDate = ev.startTime ? new Date(ev.startTime) : null;

  // Once an event is over, the kiosk stops offering a live check-in and points
  // the organiser at the attendance summary instead (B4 / §3.5).
  if (ev.status === 'completed' || ev.status === 'cancelled') {
    return (
      <div className="checkin-page flex h-full flex-col items-center justify-center p-6">
        <EmptyState
          icon={<CalendarCheck className="size-16 text-primary" />}
          title={ev.status === 'cancelled' ? 'This event was cancelled' : 'This event has ended'}
          description={
            ev.status === 'cancelled'
              ? 'Check-in is closed. You can still review who was signed up.'
              : 'Check-in is closed. Review who attended and who didn’t in the attendance summary.'
          }
          action={{
            label: 'View attendance summary',
            icon: <Users className="h-5 w-5" />,
            onClick: () => navigate({ to: '/attendees', search: { eventId } }),
          }}
          secondaryAction={{ label: 'Back to event', onClick: () => navigate({ to: '/events/$eventId', params: { eventId } }) }}
        />
      </div>
    );
  }

  if (successUser) {
    return <SuccessCheckInScreen user={successUser} checkInCount={checkInCount} eventName={ev.name} />;
  }

  return (
    <div className="checkin-page active-checkin-layout">
      <CheckInHeader
        eventName={ev.name}
        eventLocation={ev.location || null}
        eventStatus={ev.status}
        eventCapacity={ev.capacity}
        checkInCount={checkInCount}
        onBack={() => navigate({ to: '/events/$eventId', params: { eventId } })}
      />

      {/* Mode slider: show the event QR (walk-ins scan) vs scan attendee tickets */}
      <div className="mx-auto flex w-full max-w-md">
        <div className="relative grid w-full grid-cols-2 rounded-full border border-border bg-card p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
            style={{ transform: mode === 'scan' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {(['display', 'scan'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'relative z-10 inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors',
                mode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'display' ? <QrCodeIcon size={14} /> : <ScanLine size={14} />}
              {m === 'display' ? 'Event QR' : 'Scan passes'}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        {mode === 'display' ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6 text-center">
            <GlowingQRCode value={shareUrl} size={isMobile ? 220 : 280} ariaLabel="Event check-in QR" />
            <div>
              <p className="text-sm font-semibold">Scan to open this event</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Attendees scan with their phone to view the event and check in.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={enterMaximised}>
              <Maximize2 size={14} /> Maximise
            </Button>
          </div>
        ) : (
          <QRScanner
            onResult={handleScan}
            onDecodeError={(m) => setLastDecodeError(m)}
            onUseManual={() => setManualOpen(true)}
            paused={!!successUser}
            className="aspect-square w-full"
          />
        )}
      </div>

      {/* Manual check-in — always available as a third path */}
      <div className="mx-auto w-full max-w-md">
        <Button variant="outline" className="w-full gap-2 rounded-full" onClick={() => setManualOpen(true)}>
          <UserRoundPlus size={15} />
          Manual check-in
        </Button>
      </div>

      <SheetDialog open={manualOpen} onOpenChange={setManualOpen} title="Manual check-in" contentClassName="flex flex-col gap-3">
        <ManualSignInForm onSubmit={handleManual} onBack={() => setManualOpen(false)} showBack={false} />
      </SheetDialog>

      {/* DEV drawer — scan/parse/error log for debugging check-in on device */}
      <SheetDialog
        open={debugOpen}
        onOpenChange={setDebugOpen}
        title="Check-in debug"
        footerStart={
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => setDebugLog([])}>
            <Trash2 size={13} /> Clear
          </Button>
        }
        contentClassName="flex flex-col gap-3"
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          <dt className="text-muted-foreground">Event id</dt>
          <dd className="truncate font-mono">{event.id}</dd>
          <dt className="text-muted-foreground">Mode</dt>
          <dd className="font-mono">{mode}</dd>
          <dt className="text-muted-foreground">Share URL</dt>
          <dd className="truncate font-mono">{shareUrl}</dd>
          <dt className="text-muted-foreground">Ticket format</dt>
          <dd className="font-mono">{'{eventId}:{userId}'}</dd>
          <dt className="text-muted-foreground">Last decode err</dt>
          <dd className="truncate font-mono text-muted-foreground">{lastDecodeError ?? '—'}</dd>
        </dl>

        <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Log ({debugLog.length})
        </p>
        {debugLog.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            No scans yet. Switch to Scan and point at a ticket QR — the raw contents show here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {debugLog.map((e, i) => (
              <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      e.kind === 'ok' && 'bg-success/10 text-success',
                      e.kind === 'error' && 'bg-destructive/10 text-destructive',
                      e.kind === 'scan' && 'bg-primary/10 text-primary',
                      e.kind === 'info' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {e.kind}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{e.at}</span>
                </div>
                <p className="mt-1 break-all font-mono text-xs">{e.msg}</p>
              </div>
            ))}
          </div>
        )}
      </SheetDialog>

      {/* Door-tablet mode — a CredoPass billboard, not a bare QR. Same lime panel,
          logo lockup and decorative rings as the auth screen, so anyone walking up
          to the tablet can tell what they're scanning and who it belongs to.
          Stacks on a phone / portrait; goes side-by-side once there's width. */}
      {maximised && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-primary text-primary-foreground p-6 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={`${event.name} check-in QR`}
        >
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-28 border-primary-foreground/8" />
          <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-16 size-64 rounded-full border-22 border-primary-foreground/6" />

          {/* Brand lockup + exit */}
          <div className="relative z-10 flex shrink-0 items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
              <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={exitMaximised}
            >
              <Minimize2 size={15} /> Minimise
            </Button>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 lg:flex-row lg:gap-14">
            {/* Dark frame around the code's white quiet zone — the same
                primary-foreground-on-lime lockup the auth billboard uses, and it
                keeps the QR's contrast off the lime for reliable scanning. */}
            <div className="shrink-0 rounded-3xl bg-primary-foreground p-4 shadow-2xl md:p-6">
              <GlowingQRCode
                value={shareUrl}
                size={maxQrSize}
                showGlow={false}
                ariaLabel="Event check-in QR"
              />
            </div>

            {/* Event details */}
            <div className="min-w-0 max-w-lg text-center lg:text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
                {ev.status === 'ongoing' ? 'Checking in now' : 'Check in here'}
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl lg:text-5xl">
                {event.name}
              </h2>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {startDate && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3.5 py-1.5 text-[13px] font-medium">
                    <CalendarCheck size={14} />
                    {startDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    {startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-primary-foreground/10 px-3.5 py-1.5 text-[13px] font-medium">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-3.5 py-1.5 text-[13px] font-bold text-primary">
                  <Users size={14} />
                  <span className="tabular-nums">{checkInCount}</span> checked in
                </span>
              </div>

              <p className="mt-6 text-base font-medium text-primary-foreground/70 md:text-lg">
                Scan this code with your phone camera to register and get your pass.
              </p>
            </div>
          </div>

          <p className="relative z-10 shrink-0 pt-4 text-center text-[11px] text-primary-foreground/45">
            Press Esc to minimise · credopass.com
          </p>
        </div>
      )}
    </div>
  );
};

export default CheckInPage;
