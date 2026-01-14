import React from 'react';
import type { User, EventType } from '@credopass/lib/schemas';
import CheckInHeader from './CheckInHeader';
import QRCodeDisplay from './QRCodeDisplay';
import { Users } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge
} from '@credopass/ui';

import ManualSignInForm from '../ManualSignInForm';

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


interface ActiveCheckInViewProps {
  eventName: string;
  eventLocation: string | null;
  checkInCount: number;
  qrCodeData: string | null;
  hasValidSession: boolean;
  timeRemaining: string | null;
  selectedEvent: EventType | undefined;
  statusColors: Record<string, string>;
  onBack: () => void;
  onRefreshQR: () => void;
  onManualSignIn: (userData: Partial<User>) => void;
}

const ActiveCheckInView: React.FC<ActiveCheckInViewProps> = ({
  eventName,
  eventLocation,
  checkInCount,
  qrCodeData,
  hasValidSession,
  timeRemaining,
  selectedEvent,
  statusColors,
  onBack,
  onRefreshQR,
  onManualSignIn,
}) => {
  return (
    <div className="checkin-page h-full flex flex-col p-6 gap-6 overflow-auto">
      <CheckInHeader
        eventName={eventName}
        eventLocation={eventLocation}
        checkInCount={checkInCount}
        onBack={onBack}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QRCodeDisplay
          qrCodeData={qrCodeData}
          hasValidSession={hasValidSession}
          timeRemaining={timeRemaining}
          onRefreshQR={onRefreshQR}
        />

        <div className="flex flex-col gap-6">
          <ManualCheckInCard onSubmit={onManualSignIn} />
          {selectedEvent && (
            <EventDetailsCard event={selectedEvent} statusColors={statusColors} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveCheckInView;
