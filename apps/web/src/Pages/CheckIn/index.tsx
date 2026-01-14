import React, { useMemo, useState, useCallback } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useEventSessionStore, useLauncher } from '../../stores/store';
import type { User, EventType } from '@credopass/lib/schemas';
import { getCollections } from '../../lib/tanstack-db';
import { launchEventForm } from '../../containers/EventForm';
import SuccessCheckInScreen from './SuccessCheckInScreen';
import EmptyEventsState from './components/EmptyEventsState';
import EventSelectionView from './components/EventSelectionView';
import { generateSignInParams, generateSignInUrl } from './utils/qrCodeUtils';
import { statusColors } from './utils/constants';
import './style.css';



import CheckInHeader from './components/CheckInHeader';
import QRCodeDisplay from './components/QRCodeDisplay';
import { Users } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge
} from '@credopass/ui';

import ManualSignInForm from './ManualSignInForm';

import { Calendar, MapPin, Clock } from 'lucide-react';

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@credopass/ui/components/item';

interface EventDetailsCardProps {
  event: EventType;
  statusColors: Record<string, string>;
}

const EventDetailsCard: React.FC<EventDetailsCardProps> = ({ event, statusColors }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Event Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Calendar className="w-4 h-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-xs text-muted-foreground">Event Name</ItemTitle>
            <ItemDescription className="font-medium">{event.name}</ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <MapPin className="w-4 h-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-xs text-muted-foreground">Location</ItemTitle>
            <ItemDescription className="font-medium">{event.location || 'Not specified'}</ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Users className="w-4 h-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-xs text-muted-foreground">Capacity</ItemTitle>
            <ItemDescription className="font-medium">{event.capacity || 'Unlimited'}</ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <Clock className="w-4 h-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-xs text-muted-foreground">Status</ItemTitle>
            <ItemDescription>
              <Badge variant="outline" className={`${statusColors[event.status] || ''}`}>
                {event.status}
              </Badge>
            </ItemDescription>
          </ItemContent>
        </Item>
      </CardContent>
    </Card>
  );
};



interface ManualCheckInCardProps {
  onSubmit: (userData: Partial<User>) => void;
}

const ManualCheckInCard: React.FC<ManualCheckInCardProps> = ({ onSubmit }) => {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Manual Check-In
        </CardTitle>
        <CardDescription>
          Enter attendee details for manual check-in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ManualSignInForm onSubmit={onSubmit} />
      </CardContent>
    </Card>
  );
};

const LoadingState: React.FC = () => {
  return (
    <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    </div>
  );
};

const CheckInPage: React.FC = () => {
  const { events: eventCollection } = getCollections();
  const { openLauncher } = useLauncher();

  // Fetch events using TanStack DB live query
  const { data: eventsData, isLoading } = useLiveQuery((q) => q.from({ eventCollection }));
  const events = useMemo<EventType[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);

  const session = useEventSessionStore((state) => state.session);
  const isQRValid = useEventSessionStore((state) => state.isQRValid());
  const setActiveEvent = useEventSessionStore((state) => state.setActiveEvent);
  const setCurrentUser = useEventSessionStore((state) => state.setCurrentUser);
  const initializeSession = useEventSessionStore((state) => state.initializeSession);

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successUser, setSuccessUser] = useState<Partial<User> | null>(null);
  const [checkInCount, setCheckInCount] = useState(0);

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

  const handleEventSelect = (eventId: string | null) => {
    if (eventId) {
      initializeEventSession(eventId);
    }
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

  const handleRefreshQR = () => {
    if (selectedEventId) {
      initializeEventSession(selectedEventId);
    }
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

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Success screen overlay
  if (showSuccessScreen && successUser) {
    return (
      <SuccessCheckInScreen
        user={successUser}
        checkInCount={checkInCount}
        eventName={session.activeEventName || 'Unknown Event'}
      />
    );
  }

  // Empty state - no events
  if (events.length === 0) {
    return <EmptyEventsState onCreateEvent={handleCreateEvent} />;
  }

  // Event selection state
  if (!selectedEventId) {
    return (
      <EventSelectionView
        events={events}
        onEventSelect={handleEventSelect}
        onCreateEvent={handleCreateEvent}
        statusColors={statusColors}
      />
    );
  }



  // Active check-in session
  return (
    <div className="checkin-page h-full flex flex-col p-6 gap-6 overflow-auto">
      <CheckInHeader
        eventName={session.activeEventName || 'Unknown Event'}
        eventLocation={session.activeEventLocation || null}
        checkInCount={checkInCount}
        onBack={() => {
          setSelectedEventId('');
          setCheckInCount(0);
        }}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QRCodeDisplay
          qrCodeData={qrCodeData}
          hasValidSession={hasValidSession}
          timeRemaining={timeRemaining}
          onRefreshQR={handleRefreshQR}
        />

        <div className="flex flex-col gap-6">
          <ManualCheckInCard onSubmit={handleManualSignIn} />
          {selectedEvent && (
            <EventDetailsCard event={selectedEvent} statusColors={statusColors} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;


