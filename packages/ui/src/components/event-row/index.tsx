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
import { useState } from 'react';

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
    /** NULL for an online event, or one with no venue decided yet (B3/F16). */
    location: string | null;
    capacity: number | null;
    organizationName?: string;
    counts?: { registered: number; attended: number };
    /**
     * The poster (F14). When present the row shows a thumbnail of it INSTEAD of
     * the date block — the date is still on the row, in the meta line, so
     * nothing is lost. An absent or broken poster falls back to the date.
     */
    coverImageUrl?: string | null;
    /**
     * What this event is TO THE VIEWER, which is the one thing a merged list
     * cannot leave to inference.
     *
     * `/events` shows what you host and what you are going to in a single
     * list, because that is the question someone opening the app is asking —
     * "what have I got on?" — and splitting it across two tabs made the
     * answer depend on remembering which tab you were in. Once they are
     * merged, every row has to say which it is, and a word on the poster is
     * how Luma does it: `Host` on the ones you run, `Going` / `Went` on the
     * ones you are a guest at.
     *
     * Undefined renders nothing, which is what every non-merged caller (the
     * calendar rail, the compact pickers) wants.
     */
    relationship?: EventRelationship;
}

/** @see EventRowModel.relationship */
export type EventRelationship = 'host' | 'going' | 'registered' | 'went' | 'missed';

/**
 * Five, and the fifth is the interesting one.
 *
 * `registered` is a past event whose attendance row still says `registered` —
 * nobody ever recorded the person arriving. It is NOT `went`, which would
 * invent a fact, and it is NOT `missed`, which would accuse them of one: the
 * job that writes `no_show` when an event closes may simply not have run.
 * "Registered" says the only thing that is actually known, which is rather the
 * point of a product whose whole claim is that attendance is a recorded fact
 * rather than a sign-up.
 *
 * `cancelled` attendance is absent because it stops being a row at all, and
 * the event's own status is already carried by the status badge beside it.
 */
const RELATIONSHIP: Record<EventRelationship, { label: string; className: string }> = {
    host: { label: 'Host', className: 'border-blue-500/40 text-blue-500' },
    going: { label: 'Going', className: 'border-primary/40 text-primary' },
    registered: { label: 'Registered', className: 'border-border text-muted-foreground' },
    went: { label: 'Went', className: 'border-green-500/40 text-green-500' },
    missed: { label: 'Missed', className: 'border-border text-muted-foreground' },
}

/**
 * The shared pill treatment: tinted text inside a tinted hairline, which is the
 * same idiom as the status badge on the other end of the row (`completed`,
 * `ongoing`, …) rather than a second, louder visual language beside it.
 *
 * The `bg-card/85` + blur is not decoration. These badges sit ON the poster,
 * and a 10%-alpha fill — which is what the status badges use, over a card —
 * is invisible against arbitrary artwork. The translucent card backing gives
 * the tint something to be a tint OF, so the pill reads the same way on a
 * black poster, a white one and the date block.
 */
const PILL_BASE =
    'pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border ' +
    'bg-card/85 px-1.5 py-px text-[0.5625rem] font-bold leading-[1.3] tracking-wide ' +
    'shadow-sm backdrop-blur-sm group-data-compact:text-[0.5rem]'

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

/**
 * The leading square on a row: the event's poster when it has one, otherwise a
 * Luma-style date block (month abbreviation over day number).
 *
 * The poster wins because it is the thing the organiser chose and the only part
 * of a row that is recognisable at a glance. The date is not lost — it stays in
 * the row's meta line either way.
 *
 * A broken image falls back to the date block rather than leaving a hole:
 * remembering WHICH url failed, rather than a boolean, means a new `url` starts
 * clean with no effect to reset it.
 */
const DateIcon: React.FC<Partial<{
    date: Date, url: string, hour12: boolean, compact: boolean,
    /** False once the poster has failed to load — the row owns that state. */
    showPoster: boolean,
    onPosterError: () => void,
}>> = ({ date, url, hour12 = true, compact = false, showPoster = true, onPosterError }) => {
    if (!date) {
        return url && showPoster ? (
            <div className="event-date-icon event-date-icon-poster w-16 h-16 group-data-compact:w-10 group-data-compact:h-10">
                <img src={url} alt="" loading="lazy" onError={onPosterError} />
            </div>
        ) : null;
    }

    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12, minute: '2-digit' });

    /*
      The date block is ALWAYS rendered, and the poster is layered over it.

      It used to be one or the other, chosen up front — and that produced a
      bordered empty square for as long as the image was in flight, which on a
      poster that 404s is permanent until the request gives up. It is exactly
      what "why do some of the event list show blank?" was pointing at.

      Layering removes the empty state entirely: the square always has the date
      in it, and the artwork covers it when and if the bytes arrive. A broken
      poster degrades to the date block without ever having shown a hole, and
      no load/error branch can leave nothing on screen, because the thing
      underneath does not depend on the network.
    */
    return (
        <div className="relative w-16 h-16 group-data-compact:w-10 group-data-compact:h-10 shrink-0">
            <div className="event-date-icon size-full group-data-compact:px-1.5 group-data-compact:py-1">
                <span className="event-date-month text-[0.7rem] group-data-compact:text-[0.5rem]">{month}</span>
                <span className="event-date-day text-[1.3rem] group-data-compact:text-[0.9375rem]">{day}</span>
                {!compact && <span className="event-date-time">{time}</span>}
            </div>
            {/* Transparent until the bytes land. It must NOT reuse
                `.event-date-icon`, which carries an opaque `var(--card)`
                fill — that is a second way to produce the very blank square
                this layering exists to remove, and a permanent one on a
                poster that never loads. */}
            {url && showPoster && (
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                    <img
                        src={url}
                        alt=""
                        loading="lazy"
                        onError={onPosterError}
                        className="block size-full object-cover"
                    />
                </div>
            )}
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

    /**
     * A row you are a GUEST on carries no edit, delete or attendee list.
     *
     * Those actions are the organiser's, and `/events` is a merged list now —
     * so offering them on an event somebody else runs would be a control the
     * API answers 403 to (§2.9: hide what the answer is no to). Swipe is
     * disabled on those rows for the same reason, rather than revealing
     * buttons that cannot work.
     *
     * `relationship` undefined means "nobody said", which is every caller
     * that is not the merged list — the calendar rail, the compact pickers —
     * and those keep the behaviour they had.
     */
    const isGuest = event.relationship != null && event.relationship !== 'host';
    const canManage = !isGuest;

    /**
     * Which square is showing, and therefore whether the meta line has to
     * carry the date.
     *
     * The leading square is EITHER the poster OR the date block — it cannot be
     * both, and the poster wins because it is the thing the organiser chose.
     * But the date then has nowhere else to live: the meta line showed the
     * time alone, so a row with a poster said "1:18 PM" and never which day.
     * Every event in the product now starts with a poster, so that was about
     * to become every row.
     *
     * Remembering WHICH url failed, rather than a boolean, means a new `url`
     * starts clean with no effect to reset it. It lives here rather than
     * inside `DateIcon` because the fallback flips the square back to the date
     * block, and the meta line has to stop repeating the date in the same
     * instant.
     */
    const [failedPoster, setFailedPoster] = useState<string | null>(null);
    const posterUrl = event.coverImageUrl ?? undefined;
    const showingPoster = !!posterUrl && failedPoster !== posterUrl;

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

    // Only when the poster took the date block's place. Printing it in both
    // would be the same fact twice, 60px apart.
    const dateString = startDate && showingPoster
        ? startDate.toLocaleDateString('en-US',
            compact ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })
        : '';

    // Registered/attended come off the row already counted — the list never
    // scans attendance to work them out.
    const headCount = event.counts
        ? `${event.counts.attended || event.counts.registered}`
        : event.capacity
            ? `${event.capacity}`
            : 'Unlimited';

    const relationship = event.relationship ? RELATIONSHIP[event.relationship] : null;

    const rowContent = (
        <>
            {/* The poster, with the viewer's relationship to the event centred
                on its bottom edge. Overhanging rather than inset: on a dark
                poster an inset pill reads as part of the artwork, and the
                whole job of this label is to be separable from it. */}
            <div className="relative shrink-0">
                <DateIcon
                    date={startDate ?? undefined}
                    url={posterUrl}
                    compact={compact}
                    showPoster={showingPoster}
                    onPosterError={() => posterUrl && setFailedPoster(posterUrl)}
                />
                {relationship && (
                    <span className={`${PILL_BASE} ${relationship.className}`}>
                        {relationship.label}
                    </span>
                )}
            </div>

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
                            {dateString && <span className="font-medium text-foreground/90">{dateString}</span>}
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
            {canManage && offsetX !== 0 && (
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
                onTouchStart={isMobile && canManage ? onTouchStart : undefined}
                onTouchMove={isMobile && canManage ? onTouchMove : undefined}
                onTouchEnd={isMobile && canManage ? onTouchEnd : undefined}
                style={{ transform: `translateX(${offsetX}px)` }}
            >
                {rowContent}

                {/* More button — desktop click trigger, hidden on mobile */}
                {!isMobile && canManage && (
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
