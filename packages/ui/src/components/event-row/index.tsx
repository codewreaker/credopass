import {
    MapPin, Users, MoreVertical, Clock, Pencil, Trash2,
    ClockCheck, CalendarClock, ClockAlert
} from 'lucide-react';

import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
    AvatarImage,
} from "@credopass/ui/components/avatar"
import { Badge } from '@credopass/ui/components/badge';

/**
 * What a row needs to render.
 *
 * Structurally the API's `EventSummary`, restated here so the design system does
 * not import the database schema — `startAt` is an ISO string off the wire, not
 * a `Date`, and `status` is **derived server-side** from the timestamps. There
 * is no `draft`: an event either has a start time or it does not exist yet.
 */
export interface EventRowModel {
    id: string;
    name: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    startAt: string;
    endAt: string;
    location: string;
    capacity: number | null;
    organizationName?: string;
    counts?: { registered: number; attended: number };
}

/** @deprecated Kept as an alias while call sites migrate. Use `EventRowModel`. */
export type EventWithOrg = EventRowModel;

import { useSwipeToReveal } from '../../../../../packages/ui/src/hooks/use-swipe-to-reveal';
import './index.css'

export const STATUS_MAPPING: Record<EventRowModel['status'], {
    icon?: React.JSX.Element;
    label: string;
    style: string;
}> = {
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

const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** GMT offset for the viewer's zone, e.g. `GMT+1`. */
const timeZoneLabel = (at: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: userTimeZone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value ?? '';

/** Luma-style date icon: month abbreviation on top, day number below */
const DateIcon: React.FC<Partial<{ date: Date, url: string, hour12: boolean, compact: boolean }>> = ({ date, url, hour12 = true, compact = false }) => {
    if (url || !date) {
        return (<div className="event-date-icon w-16 h-16 group-data-[compact]:w-14 group-data-[compact]:h-12"><img src={url} /></div>)
    }
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12, minute: '2-digit' });
    return (
        <div className="event-date-icon w-16 h-16 group-data-compact:w-10 group-data-compact:h-10 group-data-compact:px-1.5 group-data-compact:py-1">
            <span className="event-date-month text-[0.7rem] group-data-compact:text-[0.5rem]">{month}</span>
            <span className="event-date-day text-[1.3rem] group-data-compact:text-[0.9375rem]">{day}</span>
            {!compact && <span className="event-date-time">{time}</span>}
        </div>
    );
};


/** Single event row -- inspired by Luma desktop event management */
export const EventRow: React.FC<{
    event: EventRowModel;
    onNavigate?: (eventId: string) => void;
    onEdit?: (event: EventRowModel) => void;
    onDelete?: (eventId: string) => void;
    /** Opens the attendee list scoped to this event. Omit to hide the action. */
    onViewAttendees?: (eventId: string) => void;
    isMobile?: boolean;
    compact?: boolean;
    timezone?: boolean;
}> = ({ event, onNavigate, onEdit, onDelete, onViewAttendees, timezone, isMobile = false, compact = false }) => {
    const startDate = event.startAt ? new Date(event.startAt) : null;
    const {
        offsetX, isSwiped, actionWidth, reset, toggle, onTouchStart, onTouchMove, onTouchEnd
    } = useSwipeToReveal(onViewAttendees ? 3 : 2);


    const handleClick = () => {
        // Don't navigate if the row is swiped open
        if (isSwiped) { reset(); return; }
        onNavigate?.(event.id);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        reset();
        onEdit?.(event);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        reset();
        onDelete?.(event.id);
    };

    const handleViewAttendees = (e: React.MouseEvent) => {
        e.stopPropagation();
        reset();
        onViewAttendees?.(event.id);
    };

    const timeString = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    // Registered/attended come off the row already counted — the list never
    // scans attendance to work them out.
    const headCount = event.counts
        ? `${event.counts.attended || event.counts.registered}`
        : event.capacity
            ? `${event.capacity}`
            : 'Unlimited';

    const rowContent = (
        <>
            {startDate && <DateIcon date={startDate} compact={compact} />}

            <div className="event-row-details group-data-compact:gap-0.2">
                {<div className='event-row-top group-data-compact:absolute group-data-compact:right-5'>
                    {!compact && event.organizationName && <div className='flex items-center gap-1'>
                        <AvatarGroup>
                            <Avatar size='xs'>
                                <AvatarImage src="/icons/zap.png" className={"bg-primary"} />
                                <AvatarFallback>{event.organizationName.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                        </AvatarGroup>
                        <p className='text-muted-foreground text-xs'>{event.organizationName}</p>
                    </div>}
                    <Badge
                        variant="outline"
                        className={`event-row-badge group-data-compact:h-3.5  ${STATUS_MAPPING[event.status]?.style || ''}`}
                    >
                        {!compact && event.status}
                    </Badge>
                </div>}
                <div className="event-row-title">
                    <span className="event-row-name group-data-compact:text-[0.8125rem] group-data-compact:font-medium">{event.name}</span>
                </div>

                <div className="event-row-meta group-data-compact:gap-2">
                    {timeString && (
                        <span className="event-row-meta-item group-data-compact:text-[0.6875rem]">
                            <Clock size={12} />
                            {timeString}
                            {timezone && startDate && <span className="text-lime-400 text-xs">{timeZoneLabel(startDate)}</span>}
                        </span>
                    )}
                    {event.location && (
                        <span className="event-row-meta-item group-data-compact:text-[0.6875rem]">
                            <MapPin size={12} />
                            {event.location}
                        </span>
                    )}
                    {!compact && (
                        <span className="event-row-meta-item">
                            <Users size={12} />
                            {headCount}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const handleMoreClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggle();
    };

    return (
        <div className="swipeable-row group" data-compact={compact ? "true" : undefined}>
            {/* Action buttons revealed behind the row — only mount when swiping */}
            {offsetX !== 0 && (
                <div className="swipeable-actions" style={{ width: actionWidth }}>
                    {onViewAttendees && (
                        <button type="button" className="swipe-action swipe-action-member" onClick={handleViewAttendees}>
                            <Users size={18} />
                            <span>Attendees</span>
                        </button>
                    )}
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
                className="event-row swipeable-content group-data-[compact]:gap-2.5 group-data-[compact]:px-2.5 group-data-[compact]:py-2"
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
