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
    <>
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <Calendar className="icon-small" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="item-title">Event Name</ItemTitle>
          <ItemDescription className="item-description">{event.name}</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <MapPin className="icon-small" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="item-title">Location</ItemTitle>
          <ItemDescription className="item-description">{event.location || 'Not specified'}</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <Users className="icon-small" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="item-title">Capacity</ItemTitle>
          <ItemDescription className="item-description">{event.capacity || 'Unlimited'}</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <Clock className="icon-small" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="item-title">Status</ItemTitle>
          <ItemDescription>
            <Badge variant="outline" className={`${statusColors[event.status] || ''}`}>
              {event.status}
            </Badge>
          </ItemDescription>
        </ItemContent>
      </Item>
    </>
  );
};



interface ManualCheckInCardProps {
  onSubmit: (userData: Partial<User>) => void;
}

const ManualCheckInCard: React.FC<ManualCheckInCardProps> = ({ onSubmit }) => {
  return (
    <Card className="manual-checkin-card">
      <CardHeader>
        <CardTitle className="card-title">
          <Users className="icon-medium" />
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
    <div className="checkin-page loading-state">
      <div className="loading-content">
        <div className="spinner" />
        <p className="loading-text">Loading events...</p>
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
  const [showManualCheckIn, setShowManualCheckIn] = useState(false);

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
    <div className="checkin-page active-checkin-layout">
      <CheckInHeader
        eventName={session.activeEventName || 'Unknown Event'}
        eventLocation={session.activeEventLocation || null}
        checkInCount={checkInCount}
        onBack={() => {
          setSelectedEventId('');
          setCheckInCount(0);
        }}
      />

      <div className="main-grid">
        {!showManualCheckIn && <QRCodeDisplay
          qrCodeData={qrCodeData}
          hasValidSession={hasValidSession}
          timeRemaining={timeRemaining}
          onRefreshQR={handleRefreshQR}
          onManualCheckInClick={() => setShowManualCheckIn(true)}
        >
          {selectedEvent && (
            <EventDetailsCard event={selectedEvent} statusColors={statusColors} />
          )}
        </QRCodeDisplay>}


        <div className="right-column">
          {showManualCheckIn && <ManualCheckInCard onSubmit={handleManualSignIn} />}

        </div>

      </div>
    </div>
  );
};

export default CheckInPage;


