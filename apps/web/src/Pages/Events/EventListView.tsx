import React, { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@credopass/ui/components/badge';


import type { EventType } from '@credopass/lib/schemas';
import EmptyState from '../../components/empty-state';
import { getGroupedEventsData, groupEventsByStatus, sortEventsByClosestToToday } from '@credopass/lib/utils';
import { Separator } from '@credopass/ui';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { EventRow, STATUS_MAPPING, type EventWithOrg } from '../../components/event-row';


interface EventListViewProps {
    events: EventType[];
    selectedStatus: EventType['status'][];
    onCreateEvent: () => void;
    onEditEvent: (event: EventWithOrg) => void;
    onDeleteEvent: (eventId: string) => void;
}


const EventListView: React.FC<EventListViewProps> = ({
    events,
    onCreateEvent,
    selectedStatus = [],
    onEditEvent,
    onDeleteEvent,
}) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    //sort upcoming/scheduled event closest to todays date instead of just desc
    const grouped = useMemo(() => {
        const groupedMap = groupEventsByStatus(events);
        groupedMap.set('scheduled', sortEventsByClosestToToday(groupedMap.get('scheduled') || []));
        return getGroupedEventsData<EventWithOrg>(groupedMap, selectedStatus);
    }, [events, selectedStatus]);

    const handleNavigateToEvent = useCallback((eventId: string) => {
        navigate({ to: '/events/$eventId', params: { eventId } });
    }, [navigate]);

    if (events.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <EmptyState
                    title="No events yet"
                    description="Create your first event to get started. You can set dates, locations, and capacity."
                    action={{ label: 'Create Event', onClick: onCreateEvent }}
                />
            </div>
        );
    }

    return (
        <div className="event-list">
            {grouped.map(([statusLabel, eventsData]: [EventType['status'], EventWithOrg[]]) => (
                <div key={statusLabel} className="event-list-group">
                    <div className="event-list-date-heading">
                        {STATUS_MAPPING[statusLabel].icon}
                        <h3>{STATUS_MAPPING[statusLabel].label}</h3>
                        <Badge variant={'secondary'} className='size-4'>{eventsData.length}</Badge>
                    </div>
                    <div className="event-list-items">
                        {eventsData.map((event: EventWithOrg, idx: number) => (
                            <React.Fragment key={event.id}>
                                {idx !== 0 && <Separator className={'bg-gradient-to-r from-transparent via-muted to-transparent'} />}
                                <EventRow
                                    event={event}
                                    onNavigate={handleNavigateToEvent}
                                    onEdit={onEditEvent}
                                    onDelete={onDeleteEvent}
                                    isMobile={isMobile}
                                    compact
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
