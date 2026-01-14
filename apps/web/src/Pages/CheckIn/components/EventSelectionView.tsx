import React from 'react';
import { Clock, MapPin, Users, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@credopass/ui';
import type { EventType } from '@credopass/lib/schemas';
import QuickSelectDropdown from './QuickSelectDropdown';

// EventCard Component
interface EventCardProps {
  event: EventType;
  onSelect: (eventId: string) => void;
  statusColors: Record<string, string>;
}

const EventCard: React.FC<EventCardProps> = ({ event, onSelect, statusColors }) => {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
      onClick={() => onSelect(event.id)}
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
  );
};

// EventsGrid Component
interface EventsGridProps {
  events: EventType[];
  onEventSelect: (eventId: string) => void;
  statusColors: Record<string, string>;
}

const EventsGrid: React.FC<EventsGridProps> = ({ events, onEventSelect, statusColors }) => {
  return (
    <div className="flex-1">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Available Events
        <Badge variant="secondary">{events.length}</Badge>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onSelect={onEventSelect}
            statusColors={statusColors}
          />
        ))}
      </div>
    </div>
  );
};

// Main EventSelectionView Component
interface EventSelectionViewProps {
  events: EventType[];
  onEventSelect: (eventId: string | null) => void;
  onCreateEvent: () => void;
  statusColors: Record<string, string>;
}

const EventSelectionView: React.FC<EventSelectionViewProps> = ({
  events,
  onEventSelect,
  onCreateEvent,
  statusColors,
}) => {
  return (
    <div className="checkin-page h-full flex flex-col p-6 gap-6 overflow-auto">
      <div className="flex flex-col gap-2 text-center md:text-left">
        <h1 className="text-3xl font-bold tracking-tight">Event Check-In</h1>
        <p className="text-muted-foreground text-lg">
          Select an event to start checking in attendees
        </p>
      </div>

      <QuickSelectDropdown
        events={events}
        onEventSelect={onEventSelect}
        onCreateEvent={onCreateEvent}
        statusColors={statusColors}
      />

      <EventsGrid
        events={events}
        onEventSelect={(id) => onEventSelect(id)}
        statusColors={statusColors}
      />
    </div>
  );
};

export default EventSelectionView;
