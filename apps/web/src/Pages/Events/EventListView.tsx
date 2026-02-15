import React, { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MapPin, Users, MoreHorizontal, Clock, ClockCheck, FileClock, CalendarClock, ClockAlert } from 'lucide-react';
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

export const STATUS_MAPPING: Record<EventType['status'], {
    icon?: React.JSX.Element;
    label: string;
    style: string;
}> = {
    draft: {
        icon: <FileClock size={14} className='text-yellow-500'/>,
        label: 'Draft',
        style: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
    },
    scheduled: {
        icon: <CalendarClock size={14} className='text-primary/80'/>,
        label: 'Scheduled',
        style: 'bg-primary/10 text-primary border-primary/30'
    },
    ongoing: {
        icon: <Clock size={14} className='text-green-500'/>,
        label: 'Ongoing',
        style: 'bg-green-500/10 text-green-500 border-green-500/30'
    },
    completed: {
        icon: <ClockCheck size={14} className='text-blue-500/50'/>,
        label: 'Completed',
        style: 'bg-blue-500/10 text-blue-500 border-blue-500/30'
    },
    cancelled: {
        icon: <ClockAlert size={14} className='text-red-500/50'/>,
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


const Organization: React.FC<OrganizationType> = (props) => {
    return (
        <AvatarGroup className="grayscale">
            <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
                <AvatarFallback>LR</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage
                    src="https://github.com/evilrabbit.png"
                    alt="@evilrabbit"
                />
                <AvatarFallback>ER</AvatarFallback>
            </Avatar>
        </AvatarGroup>
    )
}



/** Single event row -- inspired by Luma desktop event management (Screenshot 7) */
const EventRow: React.FC<{
    event: EventType;
    onNavigate: (eventId: string) => void;
}> = ({ event, onNavigate }) => {
    const startDate = event.startTime ? new Date(event.startTime) : null;
    const endDate = event.endTime ? new Date(event.endTime) : null;

    const timeString = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const endTimeString = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const handleClick = () => {
        onNavigate(event.id);
    };

    return (
        <button
            type="button"
            className="event-row"
            onClick={handleClick}
        >
            {/* Date icon render */}
            {startDate && <DateIcon date={startDate} />}

            {/* Event details */}
            <div className="event-row-details">
                <div className="event-row-top">
                    <span className="event-row-name">{event.name}</span>
                    <Badge
                        variant="outline"
                        className={`event-row-badge ${STATUS_MAPPING[event.status].style || ''}`}
                    >
                        {event.status}
                    </Badge>
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

            {/* More button */}
            <div className="event-row-more">
                <MoreHorizontal size={16} />
            </div>
        </button>
    );
};



interface EventListViewProps {
    events: EventType[];
    selectedStatus: EventType['status'][]
    onCreateEvent: () => void;
}


const EventListView: React.FC<EventListViewProps> = ({ events, onCreateEvent, selectedStatus = [] }) => {
    const navigate = useNavigate();

    const grouped = useMemo(() => getGroupedEventsData(groupEventsByStatus(events), selectedStatus), [events, selectedStatus]);

    const handleNavigateToEvent = (eventId: string) => {
        navigate({ to: '/events/$eventId', params: { eventId } });
    };

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
                        </div>
                        <div className="event-list-items">
                            {eventsData.map((event) => (
                                <EventRow key={event.id} event={event} onNavigate={handleNavigateToEvent} />
                            ))}
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default EventListView;
