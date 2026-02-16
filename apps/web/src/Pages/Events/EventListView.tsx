import React, { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    MapPin, Users, MoreVertical, Clock, ClockCheck, FileClock,
    CalendarClock, ClockAlert, Pencil, Trash2
} from 'lucide-react';
import { Badge } from '@credopass/ui/components/badge';
import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
    AvatarImage,
} from "@credopass/ui/components/avatar"

import type { EventType, Organization as OrganizationType } from '@credopass/lib/schemas';
import EmptyState from '../../components/empty-state';
import { getGroupedEventsData, groupEventsByStatus } from '../../lib/utils/events';
import { Separator } from '@credopass/ui';
import { useIsMobile } from '../../hooks/use-mobile';
import { useSwipeToReveal } from '../../hooks/use-swipe-to-reveal';

export type EventWithOrg = EventType & { orgCollection: OrganizationType };

export const STATUS_MAPPING: Record<EventType['status'], {
    icon?: React.JSX.Element;
    label: string;
    style: string;
}> = {
    draft: {
        icon: <FileClock size={14} className='text-yellow-500' />,
        label: 'Draft',
        style: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
    },
    scheduled: {
        icon: <CalendarClock size={14} className='text-primary/80' />,
        label: 'Scheduled',
        style: 'bg-primary/10 text-primary border-primary/30'
    },
    ongoing: {
        icon: <Clock size={14} className='text-green-500' />,
        label: 'Ongoing',
        style: 'bg-green-500/10 text-green-500 border-green-500/30'
    },
    completed: {
        icon: <ClockCheck size={14} className='text-blue-500/50' />,
        label: 'Completed',
        style: 'bg-blue-500/10 text-blue-500 border-blue-500/30'
    },
    cancelled: {
        icon: <ClockAlert size={14} className='text-red-500/50' />,
        label: 'Cancelled',
        style: 'bg-red-500/10 text-red-500 border-red-500/30'
    },
}



/** Luma-style date icon: month abbreviation on top, day number below */
const DateIcon: React.FC<Partial<{ date: Date, url: string, hour12: boolean }>> = ({ date, url, hour12 = true }) => {
    if (url || !date) {
        return (<div className="event-date-icon"><img src={url} /></div>)
    }
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12, minute: '2-digit' });
    return (
        <div className="event-date-icon">
            <span className="event-date-month">{month}</span>
            <span className="event-date-day">{day}</span>
            <span className="event-date-time">{time}</span>
        </div>
    );
};


/** Single event row -- inspired by Luma desktop event management */
const EventRow: React.FC<{
    event: EventWithOrg;
    onNavigate: (eventId: string) => void;
    onEdit: (event: EventWithOrg) => void;
    onDelete: (eventId: string) => void;
    isMobile: boolean;
}> = ({ event, onNavigate, onEdit, onDelete, isMobile }) => {
    const startDate = event.startTime ? new Date(event.startTime) : null;
    const endDate = event.endTime ? new Date(event.endTime) : null;
    const {
        offsetX, isSwiped, reset, toggle, onTouchStart, onTouchMove, onTouchEnd
    } = useSwipeToReveal();

    const timeString = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const endTimeString = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const handleClick = () => {
        // Don't navigate if the row is swiped open
        if (isSwiped) { reset(); return; }
        onNavigate(event.id);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        reset();
        onEdit(event);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        reset();
        onDelete(event.id);
    };

    const orgData = event?.orgCollection;

    const rowContent = (
        <>
            {startDate && <DateIcon date={startDate} />}

            <div className="event-row-details">
                <div className='event-row-top'>
                    <div className='flex items-center gap-1'>
                        <AvatarGroup>
                            <Avatar size='sm'>
                                <AvatarImage src="/icons/zap.png" className={"bg-primary"} />
                                <AvatarFallback>{orgData?.name?.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <Avatar size='sm'>
                                <AvatarFallback>{orgData?.plan}</AvatarFallback>
                            </Avatar>
                        </AvatarGroup>
                        <p className='text-muted-foreground text-xs'>{orgData?.name}</p>
                    </div>
                    <Badge
                        variant="outline"
                        className={`event-row-badge ${STATUS_MAPPING[event.status]?.style || ''}`}
                    >
                        {event.status}
                    </Badge>
                </div>
                <div className="event-row-title">
                    <span className="event-row-name">{event.name}</span>
                </div>

                <div className="event-row-meta">
                    {timeString && (
                        <span className="event-row-meta-item">
                            <Clock size={12} />
                            {timeString}
                            {endTimeString ? ` - ${endTimeString}` : ''}
                        </span>
                    )}
                    {event.location && (
                        <span className="event-row-meta-item">
                            <MapPin size={12} />
                            {event.location}
                        </span>
                    )}
                    <span className="event-row-meta-item">
                        <Users size={12} />
                        {event.capacity ? `${event.capacity} spots` : 'Unlimited'}
                    </span>
                </div>
            </div>
        </>
    );

    const handleMoreClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggle();
    };

    return (
        <div className="swipeable-row">
            {/* Action buttons revealed behind the row — only mount when swiping */}
            {offsetX !== 0 && (
                <div className="swipeable-actions">
                    <button type="button" className="swipe-action swipe-action-edit" onClick={handleEdit}>
                        <Pencil size={18} />
                        <span>Edit</span>
                    </button>
                    <button type="button" className="swipe-action swipe-action-delete" onClick={handleDelete}>
                        <Trash2 size={18} />
                        <span>Delete</span>
                    </button>
                </div>
            )}

            {/* Sliding content */}
            <button
                type="button"
                className="event-row swipeable-content"
                onClick={handleClick}
                onTouchStart={isMobile ? onTouchStart : undefined}
                onTouchMove={isMobile ? onTouchMove : undefined}
                onTouchEnd={isMobile ? onTouchEnd : undefined}
                style={{ transform: `translateX(${offsetX}px)` }}
            >
                {rowContent}

                {/* More button — desktop click trigger, hidden on mobile */}
                {!isMobile && (
                    <div
                        className="event-row-more"
                        role="button"
                        tabIndex={0}
                        onClick={handleMoreClick}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle(); } }}
                    >
                        <MoreVertical size={16} className='text-muted-foreground/50' />
                    </div>
                )}
            </button>
        </div>
    );
};


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

    const grouped = useMemo(() => getGroupedEventsData<EventWithOrg>(
        groupEventsByStatus(events), selectedStatus
    ), [events, selectedStatus]);

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
            {grouped.map(([statusLabel, eventsData]) => (
                <div key={statusLabel} className="event-list-group">
                    <div className="event-list-date-heading">
                        {STATUS_MAPPING[statusLabel].icon}
                        <h3>{STATUS_MAPPING[statusLabel].label}</h3>
                        <Badge variant={'secondary'} className='size-4'>{eventsData.length}</Badge>
                    </div>
                    <div className="event-list-items">
                        {eventsData.map((event, idx) => (
                            <React.Fragment key={event.id}>
                                {idx !== 0 && <Separator className={'bg-linear-to-r from-transparent via-muted to-transparent'} />}
                                <EventRow
                                    event={event}
                                    onNavigate={handleNavigateToEvent}
                                    onEdit={onEditEvent}
                                    onDelete={onDeleteEvent}
                                    isMobile={isMobile}
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
