import React, { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { EventType } from '@credopass/lib/schemas';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { getGroupedEventsData, groupEventsByStatus, sortEventsByClosestToToday } from '@credopass/lib/utils';
import { Separator } from '@credopass/ui/components/separator';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { EventRow, STATUS_MAPPING, type EventWithOrg } from '@credopass/ui/components/event-row';
import { CalendarPlus } from 'lucide-react';

interface EventListViewProps {
  events: EventType[];
  selectedStatus: EventType['status'][];
  onCreateEvent: () => void;
  onEditEvent: (event: EventWithOrg) => void;
  onDeleteEvent: (eventId: string) => void;
  timezone?: boolean;
}

const EventListView: React.FC<EventListViewProps> = ({
  events,
  onCreateEvent,
  selectedStatus = [],
  onEditEvent,
  onDeleteEvent,
  timezone = false,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const grouped = useMemo(() => {
    const groupedMap = groupEventsByStatus(events);
    groupedMap.set('scheduled', sortEventsByClosestToToday(groupedMap.get('scheduled') || []));
    return getGroupedEventsData<EventWithOrg>(groupedMap, selectedStatus);
  }, [events, selectedStatus]);

  const hasOngoingOrUpcoming = useMemo(
    () => events.some(e => e.status === 'ongoing' || e.status === 'scheduled'),
    [events]
  );

  const handleNavigateToEvent = useCallback(
    (eventId: string) => navigate({ to: '/events/$eventId', params: { eventId } }),
    [navigate]
  );

  return (
    <div className="flex flex-col gap-6 h-full overflow-auto pr-1">
      {!hasOngoingOrUpcoming && (
        <EmptyState
          icon={<CalendarPlus size={24} />}
          title="No upcoming events"
          description="Create your first event to start tracking attendance."
          action={{ label: 'Create Event', onClick: onCreateEvent }}
        />
      )}

      {grouped.map(([statusLabel, eventsData]: [EventType['status'], EventWithOrg[]]) => (
        <div key={statusLabel} className="flex flex-col gap-1">
          {/* Group header */}
          <div className="flex items-center gap-1.5 pb-2 px-1">
            <span className="text-muted-foreground [&_svg]:size-3.5">{STATUS_MAPPING[statusLabel].icon}</span>
            <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {STATUS_MAPPING[statusLabel].label}
            </h3>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {eventsData.length}
            </span>
          </div>

          {/* Event rows */}
          <div className="flex flex-col">
            {eventsData.map((event: EventWithOrg, idx: number) => (
              <React.Fragment key={event.id}>
                {idx !== 0 && (
                  <Separator className="bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                )}
                <EventRow
                  event={event}
                  onNavigate={handleNavigateToEvent}
                  onEdit={onEditEvent}
                  onDelete={onDeleteEvent}
                  isMobile={isMobile}
                  timezone={timezone}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventListView;
