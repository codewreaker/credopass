import React, { useMemo } from 'react';
import { MapPin, Users, MoreHorizontal, Clock } from 'lucide-react';
import { Badge } from '@credopass/ui';
import type { EventType } from '@credopass/lib/schemas';
import type { EventFormProps } from '../../containers/EventForm/index';
import EmptyState from '../../components/empty-state';

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    scheduled: 'bg-primary/10 text-primary border-primary/30',
    ongoing: 'bg-green-500/10 text-green-500 border-green-500/30',
    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
};

/** Luma-style date icon: month abbreviation on top, day number below */
const DateIcon: React.FC<{ date: Date }> = ({ date }) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    return (
        <div className="event-date-icon">
            <span className="event-date-month">{month}</span>
            <span className="event-date-day">{day}</span>
        </div>
    );
};

/** Single event row -- inspired by Luma desktop event management (Screenshot 7) */
const EventRow: React.FC<{
    event: EventType;
    onEdit: (args?: Omit<EventFormProps, 'collection'>) => void;
}> = ({ event, onEdit }) => {
    const startDate = event.startTime ? new Date(event.startTime) : null;
    const endDate = event.endTime ? new Date(event.endTime) : null;

    const timeString = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const endTimeString = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    const handleClick = () => {
        onEdit({
            initialData: {
                id: event.id,
                name: event.name,
                description: event.description || '',
                status: event.status,
                dateTimeRange: {
                    from: startDate || undefined,
                    to: endDate || undefined,
                },
                location: event.location || '',
                capacity: event.capacity?.toString() || '',
                organizationId: event.organizationId || '',
            },
            isEditing: true,
        });
    };

    return (
        <button
            type="button"
            className="event-row"
            onClick={handleClick}
        >
            {/* Date icon */}
            {startDate && <DateIcon date={startDate} />}

            {/* Event details */}
            <div className="event-row-details">
                <div className="event-row-top">
                    <span className="event-row-name">{event.name}</span>
                    <Badge
                        variant="outline"
                        className={`event-row-badge ${STATUS_STYLES[event.status] || ''}`}
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

/** Group events by date -- Luma groups upcoming events by day */
function groupEventsByDate(events: EventType[]): Map<string, EventType[]> {
    const groups = new Map<string, EventType[]>();
    const sorted = [...events].sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return aTime - bTime;
    });

    for (const event of sorted) {
        const date = event.startTime
            ? new Date(event.startTime).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
              })
            : 'No date';
        const existing = groups.get(date) || [];
        existing.push(event);
        groups.set(date, existing);
    }
    return groups;
}

interface EventListViewProps {
    events: EventType[];
    onEditEvent: (args?: Omit<EventFormProps, 'collection'>) => void;
    onCreateEvent: () => void;
}

const EventListView: React.FC<EventListViewProps> = ({ events, onEditEvent, onCreateEvent }) => {
    const grouped = useMemo(() => groupEventsByDate(events), [events]);

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
            {Array.from(grouped.entries()).map(([dateLabel, dateEvents]) => (
                <div key={dateLabel} className="event-list-group">
                    <h3 className="event-list-date-heading">{dateLabel}</h3>
                    <div className="event-list-items">
                        {dateEvents.map((event) => (
                            <EventRow key={event.id} event={event} onEdit={onEditEvent} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EventListView;
