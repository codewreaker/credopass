import React, { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@credopass/ui/components/badge';


import type { EventType } from '@credopass/lib/schemas';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { getGroupedEventsData, groupEventsByStatus, sortEventsByClosestToToday } from '@credopass/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { EventRow, STATUS_MAPPING, type EventWithOrg } from '@credopass/ui/components/event-row';
import { TimelineRail } from '@credopass/ui/components/timeline';
import EmptyStateOne from '/empty-state-one.svg'
import EmptyStateTwo from '/empty-state-two.svg'


const randomizeImage = () => {
    const svgs = [EmptyStateOne, EmptyStateTwo];
    const random = Math.floor(Math.random() * svgs.length);
    return svgs[random];
}

interface EventListViewProps {
    events: EventType[];
    selectedStatus: EventType['status'][];
    onCreateEvent: () => void;
    onEditEvent: (event: EventWithOrg) => void;
    onDeleteEvent: (eventId: string) => void;
    onViewAttendees?: (eventId: string) => void;
    timezone?: boolean
    /** Which group the switch is on — lets the empty state nudge to the other one. */
    activeGroup?: 'upcoming' | 'past';
    /** Jump to the past-events group (B8: don't strand a user whose events are all past). */
    onShowPast?: () => void;
}


const EventListView: React.FC<EventListViewProps> = ({
    events,
    onCreateEvent,
    selectedStatus = [],
    onEditEvent,
    onDeleteEvent,
    onViewAttendees,
    timezone = false,
    activeGroup,
    onShowPast,
}) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    // Sort upcoming/scheduled event closest to today's date instead of just desc
    const grouped = useMemo(() => {
        const groupedMap = groupEventsByStatus(events);
        groupedMap.set('scheduled', sortEventsByClosestToToday(groupedMap.get('scheduled') || []));
        return getGroupedEventsData<EventWithOrg>(groupedMap, selectedStatus);
    }, [events, selectedStatus]);

    // Nothing in the *current* group. Two shapes: no events at all (create your
    // first), or events exist but they're all in the other group — most often a
    // brand-new/returning host whose events are all in the past (B8).
    const nothingInGroup = grouped.length === 0;
    const hasAnyEvents = events.length > 0;
    const canGuideToPast = nothingInGroup && hasAnyEvents && activeGroup === 'upcoming' && !!onShowPast;

    const handleNavigateToEvent = useCallback((eventId: string) => {
        navigate({ to: '/events/$eventId', params: { eventId } });
    }, [navigate]);

    // Show empty state ONLY if there are no ongoing or upcoming events
    // (past/completed events don't count toward having "active" events)
    return (
        <div className="event-list">
            {nothingInGroup && !hasAnyEvents && (<div className="flex items-center justify-center py-0">
                <EmptyState
                    iconUrl={randomizeImage()}
                    title="You have no events yet"
                    description="Create your first event and start checking people in within minutes."
                    action={{ label: 'Create Event', onClick: onCreateEvent }}
                />
            </div>)}
            {canGuideToPast && (<div className="flex items-center justify-center py-0">
                <EmptyState
                    iconUrl={randomizeImage()}
                    title="Nothing coming up"
                    description="You don’t have any upcoming events — but your past events are all here. Review who showed up, or plan the next one."
                    action={{ label: 'View past events', onClick: onShowPast! }}
                    secondaryAction={{ label: 'Create event', onClick: onCreateEvent }}
                />
            </div>)}
            {grouped.map(([statusLabel, eventsData]: [EventType['status'], EventWithOrg[]]) => (
                <div key={statusLabel} className="event-list-group">
                    <div className="event-list-date-heading">
                        {STATUS_MAPPING[statusLabel].icon}
                        <h3>{STATUS_MAPPING[statusLabel].label}</h3>
                        <Badge variant={'secondary'} className='size-4'>{eventsData.length}</Badge>
                    </div>
                    {/* The same connector motif as the composer's Start→End pair:
                        one line threaded behind the rows so a group of events
                        reads as a single timeline. */}
                    <div className="event-list-items relative">
                        {/* Aligned to the centre of the date icon: 0.75rem of row
                            padding + half of the 4rem icon. */}
                        {eventsData.length > 1 && <TimelineRail inset="2.75rem" insetY="2.75rem" />}
                        {eventsData.map((event: EventWithOrg) => (
                            <EventRow
                                key={event.id}
                                event={event}
                                onNavigate={handleNavigateToEvent}
                                onEdit={onEditEvent}
                                onDelete={onDeleteEvent}
                                onViewAttendees={onViewAttendees}
                                isMobile={isMobile}
                                timezone={timezone}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EventListView;
