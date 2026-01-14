import React, { useMemo, useState, useCallback } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { QrCodeIcon, Plus, Clock, Calendar, MapPin, Users, ArrowLeft, RefreshCw } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@credopass/ui';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@credopass/ui/components/item';
import type { User, EventType } from '@credopass/lib/schemas';
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
  // Create compact payload with only essential data
  const payload = {
    e: params.eventId,           // event ID       // staff ID
    q: params.qrSessionId, 
  };
  
  // Encode to JSON then base64 URL-safe
  const jsonStr = JSON.stringify(payload);
  const base64 = btoa(jsonStr)
    .replace(/\+/g, '-')  // Replace + with -
    .replace(/\//g, '_')  // Replace / with _
    .replace(/=+$/, '');  // Remove trailing =
  
  const finalUrl = `${params.apiEndpoint}/signin?d=${base64}`;
  console.log('Generated Sign-In URL:', finalUrl);
  console.log('Payload length:', base64.length, 'chars');
  return finalUrl;
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
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
    return (
      <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
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
    return (
      <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-linear-to-br from-primary/20 to-primary/5 p-6 rounded-full">
                  <QrCodeIcon className="size-16 text-primary" />
                </div>
              </div>
            </EmptyMedia>
            <EmptyTitle className="text-2xl">No Events Available</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Create your first event to start checking in attendees. Events help you track attendance and engage with your community.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="gap-3">
            <Button onClick={handleCreateEvent} size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Create New Event
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  // Event selection state
  if (!selectedEventId) {
    return (
      <div className="checkin-page h-full flex flex-col p-6 gap-6 overflow-auto">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Event Check-In</h1>
          <p className="text-muted-foreground text-lg">
            Select an event to start checking in attendees
          </p>
        </div>

        {/* Quick select dropdown */}
        <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Quick Select
            </CardTitle>
            <CardDescription>
              Choose an event from the dropdown or browse below
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Select onValueChange={handleEventSelect}>
              <SelectTrigger className="flex-1">
                <SelectValue>Select an event...</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex items-center gap-2">
                        <span>{event.name}</span>
                        <Badge variant="outline" className={`text-xs ${statusColors[event.status] || ''}`}>
                          {event.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={handleCreateEvent} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </CardContent>
        </Card>

        {/* Event cards grid */}
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Available Events
            <Badge variant="secondary">{events.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
                onClick={() => handleEventSelect(event.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {event.name}
                    </CardTitle>
                    <Badge variant="outline" className={`${statusColors[event.status] || ''}`}>
                      {event.status}
                    </Badge>
                  </div>
                  {event.description && (
                    <CardDescription className="line-clamp-2">
                      {event.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{event.location || 'No location'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Capacity: {event.capacity || 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {event.startTime
                          ? new Date(event.startTime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'No date set'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active check-in session
  return (
    <div className="checkin-page h-full flex flex-col p-6 gap-6 overflow-auto">
      {/* Header with check-in count */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedEventId('');
              setCheckInCount(0);
            }}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{session.activeEventName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4" />
              {session.activeEventLocation || 'No location'}
            </div>
          </div>
        </div>

        {/* Check-in counter */}
        <div className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl px-6 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <p className="text-xs font-medium opacity-90">Check-ins Today</p>
              <p className="text-3xl font-bold">{checkInCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Section */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="w-5 h-5 text-primary" />
                QR Code Check-In
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshQR}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
            {timeRemaining && (
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Expires in <span className="font-mono font-semibold">{timeRemaining}</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
            {hasValidSession && qrCodeData ? (
              <div className="bg-white p-6 rounded-2xl shadow-lg border">
                <QRCode
                  value={qrCodeData}
                  size={220}
                  level="H"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-2xl flex flex-col items-center justify-center gap-4">
                <QrCodeIcon className="w-16 h-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  QR code expired or not generated
                </p>
                <Button variant="outline" size="sm" onClick={handleRefreshQR}>
                  Generate New Code
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Attendees can scan this code with their phone to check in instantly
            </p>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Manual Check-In Card */}
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
              <ManualSignInForm onSubmit={handleManualSignIn} />
            </CardContent>
          </Card>

          {/* Event Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedEvent && (
                <>
                  <Item variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <Calendar className="w-4 h-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-xs text-muted-foreground">Event Name</ItemTitle>
                      <ItemDescription className="font-medium">{selectedEvent.name}</ItemDescription>
                    </ItemContent>
                  </Item>
                  <Item variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <MapPin className="w-4 h-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-xs text-muted-foreground">Location</ItemTitle>
                      <ItemDescription className="font-medium">{selectedEvent.location || 'Not specified'}</ItemDescription>
                    </ItemContent>
                  </Item>
                  <Item variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <Users className="w-4 h-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-xs text-muted-foreground">Capacity</ItemTitle>
                      <ItemDescription className="font-medium">{selectedEvent.capacity || 'Unlimited'}</ItemDescription>
                    </ItemContent>
                  </Item>
                  <Item variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <Clock className="w-4 h-4" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-xs text-muted-foreground">Status</ItemTitle>
                      <ItemDescription>
                        <Badge variant="outline" className={`${statusColors[selectedEvent.status] || ''}`}>
                          {selectedEvent.status}
                        </Badge>
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;
