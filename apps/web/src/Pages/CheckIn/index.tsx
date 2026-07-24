import React, { useCallback, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '@credopass/lib/hooks';
import type { EventType, User, UserType } from '@credopass/lib/schemas';
import { getCollections } from '@credopass/api-client/collections';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { QrCodeIcon, ArrowLeft, ScanLine, UserRoundPlus } from 'lucide-react';
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

  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });

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

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/e/${eventId}` : `/e/${eventId}`),
    [eventId]
  );

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
      const [scannedEventId, userId] = value.split(':');
      if (!userId || scannedEventId !== ev.id) {
        toast.error('Not a valid ticket for this event');
        return;
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        toast.error('Ticket not recognised');
        return;
      }
      const result = await checkIn(
        ev,
        { firstName: user.firstName, lastName: user.lastName, email: user.email },
        'qr'
      );
      if (!result) return;
      if (result.alreadyCheckedIn) toast.info(`${user.firstName} was already checked in`);
      celebrate(user);
    },
    [event, users, checkIn, celebrate]
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
              {m === 'display' ? 'Event QR' : 'Scan'}
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
          </div>
        ) : (
          <QRScanner onResult={handleScan} className="aspect-square w-full" />
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
    </div>
  );
};

export default CheckInPage;
