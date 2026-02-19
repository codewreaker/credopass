import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useEventSessionStore, useLauncher } from '@credopass/lib/stores';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import type { User, EventType } from '@credopass/lib/schemas';
import { getCollections } from '@credopass/api-client/collections';
import { launchEventForm } from '../../containers/EventForm';
import SuccessCheckInScreen from './SuccessCheckInScreen';
import { generateSignInParams, generateSignInUrl } from '@credopass/lib/utils';
import { API_BASE_URL } from '../../config';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { Plus, RefreshCcw, QrCodeIcon, ArrowLeft } from 'lucide-react';

import './style.css';


import CheckInHeader from './components/CheckInHeader';
import QRCodeDisplay from './components/QRCodeDisplay';
import ManualSignInForm from './ManualSignInForm';
import EmptyState from '../../components/empty-state';
import { toast } from 'sonner';


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
  const { eventId } = useParams({ from: '/checkin/$eventId' });
  const navigate = useNavigate();
  const { events: eventCollection } = getCollections();
  const { openLauncher } = useLauncher();
  const isMobile = useIsMobile();

  // Check-in page: no search, no secondary action
  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  // Fetch events using TanStack DB live query
  const { data: eventsData, isLoading } = useLiveQuery((q) => q.from({ eventCollection }));

  const events = useMemo<EventType[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);

  const session = useEventSessionStore((state) => state.session);
  const isQRValid = useEventSessionStore((state) => state.isQRValid());
  const setActiveEvent = useEventSessionStore((state) => state.setActiveEvent);
  const setCurrentUser = useEventSessionStore((state) => state.setCurrentUser);
  const initializeSession = useEventSessionStore((state) => state.initializeSession);

  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successUser, setSuccessUser] = useState<Partial<User> | null>(null);
  const [checkInCount, setCheckInCount] = useState(0);
  const [showManualCheckIn, setShowManualCheckIn] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);


  const isError = eventCollection.utils.isError;
  const errorDetails = eventCollection.utils.lastError;
  const clearError = eventCollection.utils.refetch;

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
    (targetEventId: string) => {
      const selectedEvent = events.find((e) => e.id === targetEventId);
      if (!selectedEvent) return false;

      try {
        setActiveEvent(selectedEvent.id, selectedEvent);
        setCurrentUser(mockStaffUser.id || '', mockStaffUser);
        const token = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        initializeSession(token);
        setSessionInitialized(true);
        return true;
      } catch (error) {
        console.error('Failed to initialize session:', error);
        return false;
      }
    },
    [events, setActiveEvent, setCurrentUser, initializeSession, mockStaffUser]
  );

  // Initialize session when eventId and events are available
  useEffect(() => {
    if (eventId && events.length > 0 && !sessionInitialized) {
      initializeEventSession(eventId);
    }
  }, [eventId, events, sessionInitialized, initializeEventSession]);

  const handleBack = () => {
    navigate({ to: '/events/$eventId', params: { eventId } });
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
    if (eventId) {
      setSessionInitialized(false);
      initializeEventSession(eventId);
    }
  };

  const qrCodeData = useMemo(() => {
    try {
      const params = generateSignInParams(session);
      if (!params) return null;
      // Set API endpoint from config
      params.apiEndpoint = API_BASE_URL;
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
    return events.find((e) => e.id === eventId);
  }, [events, eventId]);



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



  // Event not found state
  if (!selectedEvent) {
    return (
      <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
        <EmptyState
          error={true}
          icon={
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-linear-to-br from-primary/20 to-primary/5 p-6 rounded-full">
                <QrCodeIcon className="size-16 text-primary" />
              </div>
            </div>
          }
          title="Event Not Found"
          description="The event you're trying to check in to doesn't exist or has been removed."
          action={{ 
            label: "Back to Events", 
            icon: <ArrowLeft className="w-5 h-5" />, 
            onClick: () => navigate({ to: '/events' }) 
          }}
        />

      </div>
    )
  }



  // Active check-in session
  return (
    <div className="checkin-page active-checkin-layout">
      <CheckInHeader
        eventName={session.activeEventName || 'Unknown Event'}
        eventLocation={session.activeEventLocation || null}
        eventStatus={selectedEvent?.status}
        eventCapacity={selectedEvent?.capacity}
        checkInCount={checkInCount}
        onBack={handleBack}
      />

      <div className="main-grid">
        {!showManualCheckIn && <QRCodeDisplay
          qrCodeData={qrCodeData}
          hasValidSession={hasValidSession}
          timeRemaining={timeRemaining}
          onRefreshQR={handleRefreshQR}
          onManualCheckInClick={() => setShowManualCheckIn(true)}
          size={isMobile ? 220 : 326}
        />}


        <div className="right-column">
          {showManualCheckIn && <ManualSignInForm onSubmit={handleManualSignIn} onBack={() => setShowManualCheckIn(false)} />}
        </div>

      </div>
    </div>
  );
};

export default CheckInPage;


