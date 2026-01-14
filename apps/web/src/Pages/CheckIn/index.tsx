import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { QrCodeIcon, Plus, Clock } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useEventSessionStore, useLauncher } from '../../stores/store';
import { API_BASE_URL } from '../../config';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@credopass/ui';
import { Item, ItemContent, ItemDescription, ItemMedia } from '@credopass/ui/components/item';
import type { User } from '@credopass/lib/schemas';
import { getCollections } from '../../lib/tanstack-db';
import { launchEventForm } from '../../containers/EventForm';
import ManualSignInForm from './ManualSignInForm';
import SuccessCheckInScreen from './SuccessCheckInScreen';
import './style.css';

interface SignInParams {
  type: 'qr_event_signin';
  eventId: string;
  eventName: string;
  eventLocation: string;
  staffId: string;
  staffEmail: string;
  staffName: string;
  sessionToken: string;
  qrSessionId: string;
  timestamp: number;
  expiresAt: number;
  apiEndpoint: string;
}

const generateSignInParams = (session: any): SignInParams | null => {
  if (!session.activeEventId || !session.currentUserId || !session.sessionToken) {
    return null;
  }

  return {
    type: 'qr_event_signin',
    eventId: session.activeEventId,
    eventName: session.activeEventName || 'Unknown Event',
    eventLocation: session.activeEventLocation || 'Unknown Location',
    staffId: session.currentUserId,
    staffEmail: session.currentUserEmail || 'Unknown',
    staffName: session.currentUserName || 'Unknown',
    sessionToken: session.sessionToken,
    qrSessionId: session.qrSessionId,
    timestamp: session.qrGeneratedAt || Date.now(),
    expiresAt: session.qrExpiresAt || Date.now() + 5 * 60 * 1000,
    apiEndpoint: API_BASE_URL,
  };
};

export const generateSignInUrl = (params: SignInParams): string => {
  const queryString = new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return `${params.apiEndpoint}/signin?${queryString}`;
};

interface EventType {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  startTime: Date;
  endTime: Date;
  location: string;
  capacity: number | null;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
}

const CheckInPage: React.FC = () => {
  const { events: eventCollection } = getCollections();
  const { openLauncher } = useLauncher();

  const session = useEventSessionStore((state) => state.session);
  const isQRValid = useEventSessionStore((state) => state.isQRValid());
  const setActiveEvent = useEventSessionStore((state) => state.setActiveEvent);
  const setCurrentUser = useEventSessionStore((state) => state.setCurrentUser);
  const initializeSession = useEventSessionStore((state) => state.initializeSession);

  const [events, setEvents] = useState<EventType[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successUser, setSuccessUser] = useState<Partial<User> | null>(null);
  const [checkInCount, setCheckInCount] = useState(0);

  useEffect(() => {
    // Load initial events from the collection asynchronously to avoid cascading renders
    const timer = setTimeout(() => {
      if (eventCollection && typeof eventCollection === 'object') {
        const eventData = (eventCollection as any).queryClient ? [] : (eventCollection as any).data || [];
        if (Array.isArray(eventData) && eventData.length > 0) {
          setEvents(eventData);
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [eventCollection]);

  const mockStaffUser: Partial<User> = React.useMemo(
    () => ({
      id: 'staff-001',
      email: 'admin@dwell.com',
      firstName: 'Admin',
      lastName: 'User',
    }),
    []
  );

  const initializeEventSession = useCallback(
    (eventId: string) => {
      const selectedEvent = events.find((e) => e.id === eventId);
      if (!selectedEvent) return;

      try {
        setActiveEvent(selectedEvent.id, selectedEvent);
        setCurrentUser(mockStaffUser.id || '', mockStaffUser);
        const token = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        initializeSession(token);
        setSelectedEventId(eventId);
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    },
    [events, setActiveEvent, setCurrentUser, initializeSession, mockStaffUser]
  );

  const handleEventSelect = (eventId: string) => {
    initializeEventSession(eventId);
  };

  const handleManualSignIn = (userData: Partial<User>) => {
    setSuccessUser(userData);
    setCheckInCount((prev) => prev + 1);
    setShowSuccessScreen(true);

    setTimeout(() => {
      setShowSuccessScreen(false);
      setSuccessUser(null);
    }, 3000);
  };

  const handleCreateEvent = () => {
    launchEventForm(
      {
        initialData: {},
        isEditing: false,
      },
      openLauncher
    );
  };

  const qrCodeData = useMemo(() => {
    try {
      const params = generateSignInParams(session);
      if (!params) return null;
      return generateSignInUrl(params);
    } catch (error) {
      console.error('Failed to generate QR code data:', error);
      return null;
    }
  }, [session]);

  const hasValidSession = useMemo(() => {
    return !!(
      session.activeEventId &&
      session.currentUserId &&
      session.sessionToken &&
      isQRValid
    );
  }, [session, isQRValid]);

  const timeRemaining = useMemo(() => {
    if (!session.qrExpiresAt) return null;
    const remaining = Math.max(0, session.qrExpiresAt - new Date().getTime());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [session.qrExpiresAt]);

  if (showSuccessScreen && successUser) {
    return (
      <SuccessCheckInScreen
        user={successUser}
        checkInCount={checkInCount}
        eventName={session.activeEventName || 'Unknown Event'}
      />
    );
  }

  if (events.length === 0) {
    return (
      <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <QrCodeIcon className='size-20' />
            </EmptyMedia>
            <EmptyTitle>No Events</EmptyTitle>
            <EmptyDescription>
              Create or Pick an event to start checking in attendees
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={handleCreateEvent} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Pick an Event
            </Button>
            <Button onClick={handleCreateEvent} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Create New Event
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!selectedEventId) {
    return (
      <div className="checkin-page h-full flex flex-col p-6 gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Check-In</h1>
          <p className="text-muted-foreground">
            Select an event or create a new one to start checking in attendees
          </p>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleEventSelect(event.id)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <CardDescription>{event.location}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Status: {event.status}</span>
                    <span>Cap: {event.capacity}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button onClick={handleCreateEvent} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Create New Event
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkin-page h-full flex flex-col p-6 gap-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Check-In</h1>
          <p className="text-muted-foreground">{session.activeEventName}</p>
        </div>
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-center">
          <p className="text-sm font-medium">Check-ins</p>
          <p className="text-2xl font-bold">{checkInCount}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCodeIcon className="w-5 h-5" />
              QR Code Check-In
            </CardTitle>
            <CardDescription>
              {timeRemaining && (
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="w-4 h-4" />
                  Expires in {timeRemaining}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {hasValidSession && qrCodeData ? (
              <div className="bg-white p-4 rounded-lg shadow-md">
                <QRCode
                  value={qrCodeData}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
                <QrCodeIcon className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
            {hasValidSession && (
              <div className="w-full space-y-2">
                <Item variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <div className="size-4" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemDescription>
                      <p className="inline mr-2 font-semibold">Staff:</p>
                      {session.currentUserName}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Manual Check-In</CardTitle>
              <CardDescription>
                Enter attendee details for manual check-in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManualSignInForm onSubmit={handleManualSignIn} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Event', value: session.activeEventName },
                { label: 'Location', value: session.activeEventLocation },
                { label: 'Status', value: session.activeEventStatus },
                { label: 'Capacity', value: session.activeEventCapacity },
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">{item.label}:</span>
                  <span className="font-semibold">{item.value || 'N/A'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={() => {
          setSelectedEventId('');
          setCheckInCount(0);
        }}
        className="w-full"
      >
        Back to Events
      </Button>
    </div>
  );
};

export default CheckInPage;
