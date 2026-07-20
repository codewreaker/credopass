import React, { useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useNavigate } from '@tanstack/react-router';
import { getCollections } from '@credopass/api-client/collections';
import { useToolbarContext } from '@credopass/lib/hooks';
import type { EventType } from '@credopass/lib/schemas';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Card } from '@credopass/ui/components/card';
import { Badge } from '@credopass/ui/components/badge';
import { MapPin, Users, Clock, ScanQrCode } from 'lucide-react';
import { cn } from '@credopass/ui/lib/utils';
import { STATUS_MAPPING } from '@credopass/ui/components/event-row';

const CHECKINABLE_STATUSES: EventType['status'][] = ['ongoing', 'scheduled'];

const CheckInSelectorPage: React.FC = () => {
  const navigate = useNavigate();
  const { events: eventCollection } = getCollections();

  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  const { data: eventsData, isLoading } = useLiveQuery((q) =>
    q.from({ eventCollection })
  );

  const events = useMemo<EventType[]>(
    () => (Array.isArray(eventsData) ? eventsData : []),
    [eventsData]
  );

  const checkinableEvents = useMemo(
    () => events.filter((e) => CHECKINABLE_STATUSES.includes(e.status)),
    [events]
  );

  const ongoingEvents = useMemo(
    () => checkinableEvents.filter((e) => e.status === 'ongoing'),
    [checkinableEvents]
  );

  const scheduledEvents = useMemo(
    () => checkinableEvents.filter((e) => e.status === 'scheduled'),
    [checkinableEvents]
  );

  const handleSelectEvent = (eventId: string) => {
    navigate({ to: '/checkin/$eventId', params: { eventId } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-40 gap-4">
        <div className="w-7 h-7 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading events…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Check-in</h1>
        <p className="text-sm text-muted-foreground">Select an event to start scanning</p>
      </div>

      {checkinableEvents.length === 0 ? (
        <EmptyState
          icon={<ScanQrCode size={24} />}
          title="No active events"
          description="You have no ongoing or upcoming events to check in for. Create or activate an event from the Events page."
          action={{
            label: 'View Events',
            onClick: () => navigate({ to: '/events' }),
          }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {ongoingEvents.length > 0 && (
            <EventGroup label="Ongoing" events={ongoingEvents} onSelect={handleSelectEvent} />
          )}
          {scheduledEvents.length > 0 && (
            <EventGroup label="Scheduled" events={scheduledEvents} onSelect={handleSelectEvent} />
          )}
        </div>
      )}
    </div>
  );
};

interface EventGroupProps {
  label: string;
  events: EventType[];
  onSelect: (id: string) => void;
}

const EventGroup: React.FC<EventGroupProps> = ({ label, events, onSelect }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-1.5 pb-1 px-0.5">
      <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
        {events.length}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onSelect={onSelect} />
      ))}
    </div>
  </div>
);

const EventCard: React.FC<{ event: EventType; onSelect: (id: string) => void }> = ({
  event,
  onSelect,
}) => {
  const statusConfig = STATUS_MAPPING[event.status];
  const isOngoing = event.status === 'ongoing';

  const startDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const startTime = event.startTime
    ? new Date(event.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Card
      onClick={() => onSelect(event.id)}
      className={cn(
        'p-4 cursor-pointer transition-all duration-150 group',
        isOngoing
          ? 'ring-1 ring-primary/30 hover:ring-primary/60'
          : 'hover:ring-1 hover:ring-border-strong hover:shadow-elevation-2'
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ScanQrCode size={16} className="text-primary" />
          </div>
          <Badge
            variant={isOngoing ? 'default' : 'secondary'}
            className="shrink-0 flex items-center gap-1"
          >
            <span className="[&_svg]:size-2.5">{statusConfig?.icon}</span>
            {statusConfig?.label ?? event.status}
          </Badge>
        </div>

        {/* Name */}
        <div>
          <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-150">
            {event.name}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-1">
          {startDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} className="shrink-0" />
              <span className="tabular-nums">{startDate}{startTime ? ` · ${startTime}` : ''}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={11} className="shrink-0" />
              <span className="tabular-nums">{event.capacity} capacity</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CheckInSelectorPage;
