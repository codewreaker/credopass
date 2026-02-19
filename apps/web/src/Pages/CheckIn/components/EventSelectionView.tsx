import React from 'react';
import { Clock, MapPin, Users, Calendar, ArrowRight } from 'lucide-react';
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

// EventCard Component -- Luma-inspired: clean, spacious, subtle hover
interface EventCardProps {
  event: EventType;
  onSelect: (eventId: string) => void;
  statusColors: Record<string, string>;
}

const EventCard: React.FC<EventCardProps> = ({ event, onSelect, statusColors }) => {
  const formattedDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'No date set';

  return (
    <Card
      className="cursor-pointer group relative overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-[0_8px_30px_-12px_rgba(212,255,0,0.12)]"
      onClick={() => onSelect(event.id)}
    >
      {/* Top accent bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
            {event.name}
          </CardTitle>
          <Badge variant="outline" className={`text-[0.625rem] shrink-0 ${statusColors[event.status] || ''}`}>
            {event.status}
          </Badge>
        </div>
        {event.description && (
          <CardDescription className="line-clamp-2 text-xs leading-relaxed mt-1">
            {event.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{event.capacity ? `${event.capacity}` : 'Unlimited'}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">
          Available Events
        </h2>
        <Badge variant="secondary" className="text-[0.625rem] h-5 px-1.5">
          {events.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

// Main EventSelectionView Component -- Luma-inspired: clean, centered header
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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Event Check-In</h1>
        <p className="text-sm text-muted-foreground">
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
