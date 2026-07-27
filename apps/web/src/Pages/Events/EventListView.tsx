import React, { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Badge } from '@credopass/ui/components/badge';

import type { Event } from '@credopass/api-client';
import type { DerivedEventStatus } from '@credopass/lib/hooks';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { EventRow, STATUS_MAPPING } from '@credopass/ui/components/event-row';
import { TimelineRail } from '@credopass/ui/components/timeline';
import EmptyStateOne from '/empty-state-one.svg'
import EmptyStateTwo from '/empty-state-two.svg'


const randomizeImage = () => {
    const svgs = [EmptyStateOne, EmptyStateTwo];
    const random = Math.floor(Math.random() * svgs.length);
    return svgs[random];
}

interface EventListViewProps {
    events: Event[];
    /** Which statuses this group renders, and in what order. */
    selectedStatus: DerivedEventStatus[];
    onCreateEvent: () => void;
    onEditEvent: (event: Event) => void;
    onDeleteEvent: (event: Event) => void;
    onViewAttendees?: (eventId: string) => void;
    timezone?: boolean
    /** Which group the switch is on — lets the empty state nudge to the other one. */
    activeGroup?: 'upcoming' | 'past';
    /** Jump to the past-events group (B8: don't strand a user whose events are all past). */
    onShowPast?: () => void;
    /** The caller may create events. Hides the CTA rather than rendering a 403. */
    canCreate?: boolean;
    /** True while the first page is in flight — suppresses the empty state. */
    isLoading?: boolean;
}

/**
 * The events list.
 *
 * Order and membership are the server's: `?group=upcoming|past` decides which
 * events arrive and in what order. All that happens here is sectioning them by
 * the status each row already carries — no re-sorting, no re-deriving.
 *
 * One consequence looks like a bug and is not: a **cancelled future event
 * appears under Past**. It is not going to happen, so it belongs with what
 * didn't (§2.3).
 */
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
    canCreate = true,
    isLoading = false,
}) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const grouped = useMemo<Array<[DerivedEventStatus, Event[]]>>(() => {
        const sections: Array<[DerivedEventStatus, Event[]]> = [];
        for (const status of selectedStatus) {
            const inSection = events.filter((event) => event.status === status);
            if (inSection.length > 0) sections.push([status, inSection]);
        }
        return sections;
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

    const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

    return (
        <div className="event-list">
            {!isLoading && nothingInGroup && !hasAnyEvents && (<div className="flex items-center justify-center py-0">
                <EmptyState
                    iconUrl={randomizeImage()}
                    title="You have no events yet"
                    description="Create your first event and start checking people in within minutes."
                    action={canCreate ? { label: 'Create Event', onClick: onCreateEvent } : undefined}
                />
            </div>)}
            {canGuideToPast && (<div className="flex items-center justify-center py-0">
                <EmptyState
                    iconUrl={randomizeImage()}
                    title="Nothing coming up"
                    description="You don’t have any upcoming events — but your past events are all here. Review who showed up, or plan the next one."
                    action={{ label: 'View past events', onClick: onShowPast! }}
                    secondaryAction={canCreate ? { label: 'Create event', onClick: onCreateEvent } : undefined}
                />
            </div>)}
            {grouped.map(([statusLabel, eventsData]) => (
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
                        {eventsData.map((event) => (
                            <EventRow
                                key={event.id}
                                event={event}
                                onNavigate={handleNavigateToEvent}
                                onEdit={(row) => {
                                    const target = eventsById.get(row.id);
                                    if (target) onEditEvent(target);
                                }}
                                onDelete={(id) => {
                                    const target = eventsById.get(id);
                                    if (target) onDeleteEvent(target);
                                }}
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
