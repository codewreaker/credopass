import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    hasProblemCode,
    ProblemCode,
    useCancelEvent,
    useDeleteEvent,
    useEvents,
    useEventsCalendar,
    useEventsSummary,
    useOrganizations,
    type Event,
} from '@credopass/api-client';
import EventListView from './EventListView';
import EventCalendar from '@credopass/ui/components/event-calendar';
import { CalendarPlus, CalendarsIcon, FastForward, MapPin, Users, Clock, ScanLine, ArrowUpRight, Plus, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { useStatusFilter, useToolbarContext } from '@credopass/lib/hooks';
export { EVENTS_FILTER_GROUP_COOKIE_NAME, EVENTS_FILTER_ENABLED_COOKIE_NAME } from '@credopass/lib/hooks';
import { ButtonGroup } from '@credopass/ui/components/button-group';
import { getGreeting } from '@credopass/lib/utils';
import { toast } from '@credopass/ui/components/sonner';

import './events.css';
import { RightSidebarTrigger } from '../../containers/RightSidebar';
import ActionCards from '../../containers/ActionCards';
import { ToolbarActionsSlot } from '../../containers/TopNavBar/toolbar-slot';
import { StatusFilterSwitch } from './StatusFilterSwitch';
import { Separator } from '@credopass/ui/components/separator';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { Button } from '@credopass/ui/components/button';
import { useCan, useDisplayName, useSession } from '../../contexts/session';
import { errorMessage } from '../../lib/errors';

/** Lime spotlight hero — surfaces the next ongoing/scheduled event with quick actions. */
const HERO_COLLAPSED_KEY = 'credopass:events-hero-collapsed';

const HeroSpotlight = ({
    nextEvent,
    stats,
    onCreateEvent,
    canCreate,
}: {
    nextEvent: Event | null;
    stats: { total: number; upcoming: number; ongoing: number };
    onCreateEvent: () => void;
    canCreate: boolean;
}) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem(HERO_COLLAPSED_KEY) === '1'; } catch { return false; }
    });
    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            try { localStorage.setItem(HERO_COLLAPSED_KEY, prev ? '0' : '1'); } catch { /* noop */ }
            return !prev;
        });
    };
    const startDate = nextEvent?.startAt ? new Date(nextEvent.startAt) : null;
    // Derived server-side. Never recompute it from the timestamps here.
    const isLive = nextEvent?.status === 'ongoing';

    // Minimized: a compact strip that reads like the other rows
    if (collapsed && nextEvent) {
        return (
            <button
                type="button"
                onClick={toggleCollapsed}
                className="group flex w-full items-center gap-3 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 shrink-0 cursor-pointer transition-all duration-200 hover:brightness-105 text-left"
            >
                <span className="rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] shrink-0">
                    {isLive ? 'Live' : 'Up next'}
                </span>
                <span className="text-sm font-semibold truncate flex-1">{nextEvent.name}</span>
                {startDate && (
                    <span className="text-[11px] font-medium text-primary-foreground/70 tabular-nums shrink-0 hidden sm:inline">
                        {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                )}
                <ChevronDown size={14} className="shrink-0 text-primary-foreground/60 group-hover:text-primary-foreground transition-colors" />
            </button>
        );
    }

    const statBlocks = (
        <div className="hidden xl:flex items-stretch gap-4 lg:gap-6 shrink-0">
            {[
                { label: 'Events', value: stats.total },
                { label: 'Upcoming', value: stats.upcoming },
                { label: 'Live now', value: stats.ongoing },
            ].map(({ label, value }, i) => (
                <div key={label} className={`flex flex-col justify-center pl-4 lg:pl-6 ${i === 0 ? 'border-l-0 pl-0 lg:pl-0' : 'border-l border-primary-foreground/15'}`}>
                    <span className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight leading-none tabular-nums">{value}</span>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60 mt-1.5">{label}</span>
                </div>
            ))}
        </div>
    );

    // The whole spotlight is the "Details" affordance now, so the inner buttons
    // have to stop the click from bubbling up into this navigation.
    const openNextEvent = () => {
        if (nextEvent) navigate({ to: '/events/$eventId', params: { eventId: nextEvent.id } });
    };

    return (
        <div
            className={`relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-5 lg:p-6 shrink-0${nextEvent ? ' cursor-pointer' : ''}`}
            {...(nextEvent
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Open ${nextEvent.name}`,
                    onClick: openNextEvent,
                    onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openNextEvent();
                        }
                    },
                }
                : {})}
        >
            <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-18 border-primary-foreground/6" />
            {nextEvent && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapsed();
                    }}
                    aria-label="Minimize spotlight"
                    className="absolute top-3 right-3 z-20 flex size-7 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors duration-150 cursor-pointer"
                >
                    <ChevronUp size={14} />
                </button>
            )}

            {nextEvent ? (
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    {/* Date chip */}
                    {startDate && (
                        <div className="hidden md:flex flex-col items-center justify-center size-16 rounded-xl bg-primary-foreground text-primary shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                                {startDate.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="text-2xl font-semibold leading-tight tabular-nums">{startDate.getDate()}</span>
                        </div>
                    )}

                    {/* Event info */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${isLive ? 'bg-green-600 text-black' : 'bg-primary-foreground/10'}`}>
                                {isLive && <span className="size-1.5 rounded-full bg-secondary animate-pulse" />}
                                {isLive ? 'Live now' : 'Up next'}
                            </span>
                        </div>
                        <h2 className="text-xl lg:text-2xl font-semibold tracking-tight truncate mb-1.5">{nextEvent.name}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-primary-foreground/70">
                            {startDate && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock size={13} />
                                    {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                            )}
                            {nextEvent.location && (
                                <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <MapPin size={13} className="shrink-0" />
                                    <span className="truncate">{nextEvent.location}</span>
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <Users size={13} />
                                {nextEvent.counts.registered} registered
                            </span>
                        </div>

                        {/* CTAs */}
                        <div className="flex items-center gap-2.5 mt-4">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate({ to: '/checkin/$eventId', params: { eventId: nextEvent.id } });
                                }}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground text-primary px-4 h-9 text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <ScanLine size={14} />
                                Check in guests
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate({ to: '/attendees', search: { eventId: nextEvent.id } });
                                }}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary-foreground/25 px-4 h-9 text-[13px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-primary-foreground/10"
                            >
                                <Users size={14} />
                                Attendees
                            </button>
                        </div>
                    </div>

                    {statBlocks}
                </div>
            ) : (
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1.5">Get started</p>
                        {/* This used to branch on `needsOnboarding` and ask for an
                            organization first. Signing in commissions one (D22), so
                            there is always something to create an event on. */}
                        <h2 className="text-xl lg:text-2xl font-semibold tracking-tight mb-1">
                            Plan your next event
                        </h2>
                        <p className="text-[13px] font-medium text-primary-foreground/70 mb-4">
                            Create an event and start checking people in within minutes.
                        </p>
                        {canCreate && (
                            <button
                                type="button"
                                onClick={onCreateEvent}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground text-primary px-4 h-9 text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus size={14} />
                                Create Event
                            </button>
                        )}
                    </div>
                    {statBlocks}
                </div>
            )}
        </div>
    );
};


/**
 * Upgrade prompt as a list card rather than top-bar chrome. It borrows the
 * spotlight's shape and rhythm but stays on a dark surface — the lime hero above
 * it is the page's one lime moment.
 */
const UpgradeSpotlight = ({ onUpgrade }: { onUpgrade: () => void }) => (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 shrink-0">
        <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-18 border-primary/6" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="min-w-0 flex-1">
                <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    <Sparkles size={10} />
                    Credopass Pro
                </span>
                <h2 className="mb-1.5 truncate text-xl font-semibold tracking-tight lg:text-2xl">
                    Unlimited events and full analytics
                </h2>
                <p className="text-[13px] font-medium text-muted-foreground">
                    Export reports, dig into attendance trends and drop the event cap.
                </p>
            </div>
            <button
                type="button"
                onClick={onUpgrade}
                className="mt-4 inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
                Upgrade
                <ArrowUpRight size={14} />
            </button>
        </div>
    </div>
);

/** `2026-07` — the month key `GET /events/calendar` expects. */
const monthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * The console's home.
 *
 * Every number on this page comes off the wire. The counts are
 * `GET /events/summary`, the spotlight is `summary.next`, the list is
 * `GET /events?group=…&q=…`, and the calendar rail is
 * `GET /events/calendar?month=`. What used to be four `useMemo`s over a
 * full-table cache is now four requests that the server already knows the
 * answers to (§2.3).
 */
const EventsPage = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

    const { organizationId } = useSession();
    const canCreate = useCan('event:create');
    const canDelete = useCan('event:delete');
    const canCancel = useCan('event:cancel');

    const {
        activeGroup, setActiveGroup,
        selectedStatuses, enableTimezone, toggleTimezone,
        actionsEnabled, toggleActions,
    } = useStatusFilter();

    const firstName = useDisplayName().split(' ')[0];
    const greeting = useMemo(() => getGreeting(), []);

    const { data: summary } = useEventsSummary();
    const { data: page, isLoading } = useEvents({
        group: activeGroup,
        q: searchQuery.trim() || undefined,
    });
    const { data: calendar } = useEventsCalendar(monthKey(calendarMonth));
    const { data: organizations = [] } = useOrganizations();
    const activeOrganization = organizations.find((o) => o.id === organizationId);

    const events = page?.data ?? [];

    // The calendar rail shows the whole month, independent of the Upcoming/Past
    // switch — a month is a month.
    const calendarEvents = useMemo<Event[]>(
        () => (calendar?.days ?? []).flatMap((day) => day.events),
        [calendar]
    );

    const heroStats = {
        total: summary?.total ?? 0,
        upcoming: summary?.upcoming ?? 0,
        ongoing: summary?.ongoing ?? 0,
    };

    const cancelEvent = useCancelEvent();
    const deleteEvent = useDeleteEvent();

    const handleCreateEvent = useCallback(() => {
        navigate({ to: '/events/new' });
    }, [navigate]);

    const handleEditEvent = useCallback((event: Event) => {
        navigate({ to: '/events/$eventId/edit', params: { eventId: event.id } });
    }, [navigate]);

    // Jump straight to the attendee list for this event.
    const handleViewAttendees = useCallback((eventId: string) => {
        navigate({ to: '/attendees', search: { eventId } });
    }, [navigate]);

    /**
     * Delete, falling back to cancel.
     *
     * `DELETE /events/{id}` refuses with 409 once anyone has registered, and it
     * is right to: those people hold pass URLs. Cancelling keeps the rows, the
     * URL and the history, and is what the organiser actually wants.
     */
    const handleDeleteEvent = useCallback(async (event: Event) => {
        if (!canDelete) return;
        try {
            await deleteEvent.mutateAsync(event.id);
            toast.success(`${event.name} deleted`);
        } catch (error) {
            if (hasProblemCode(error, ProblemCode.CONFLICT, ProblemCode.HAS_EVENTS) || (error as { status?: number })?.status === 409) {
                if (!canCancel) {
                    toast.error('People have already registered — an admin needs to cancel this event.');
                    return;
                }
                toast.error('People have already registered', {
                    description: 'Cancel it instead — everyone keeps their pass and the link still works.',
                    action: {
                        label: 'Cancel event',
                        onClick: async () => {
                            try {
                                await cancelEvent.mutateAsync({ id: event.id });
                                toast.success(`${event.name} cancelled`);
                            } catch (cancelError) {
                                toast.error(errorMessage(cancelError, 'Could not cancel the event'));
                            }
                        },
                    },
                });
                return;
            }
            toast.error(errorMessage(error, 'Could not delete the event'));
        }
    }, [canDelete, canCancel, deleteEvent, cancelEvent]);

    // Register toolbar context: secondary "Create Event" button + search
    useToolbarContext({
        action: canCreate
            ? { icon: CalendarPlus, label: 'Create Event', onClick: handleCreateEvent }
            : null,
        search: { enabled: true, placeholder: 'Search events…', onSearch: setSearchQuery },
    });

    return (
        <div className="events-page">
            <div className="events-header">
                {/* Greeting — the name is the account's, from GET /me/context */}
                <div className="events-header-left">
                    <h1 className="events-header-title">
                        {greeting}, {firstName}
                    </h1>
                    <p className="events-header-subtitle">
                        {`${heroStats.total} event${heroStats.total === 1 ? '' : 's'} · ${heroStats.upcoming} upcoming · ${heroStats.ongoing} live now`}
                    </p>
                </div>

                {/* The Upcoming/Past switch is always visible now — it lives where
                    the action group used to sit; the group portals into the top bar. */}
                <div className="events-header-right">
                    <StatusFilterSwitch
                        activeGroup={activeGroup}
                        onGroupChange={setActiveGroup}
                        enableTimezone={enableTimezone}
                        onToggleTimezone={toggleTimezone}
                    />
                </div>

                {/* Action group — rendered up in the top bar next to Create Event.
                    The filter show/hide toggle is gone: filters are always shown. */}
                <ToolbarActionsSlot>
                    <ButtonGroup className="rounded-full border border-border bg-card p-1 gap-0.5">
                        {/* Independent toggle — shows/hides the shortcut cards and
                            has no bearing on which events are listed. */}
                        <Button variant='ghost' aria-pressed={actionsEnabled} title="Toggle shortcuts" className={`relative rounded-full ${actionsEnabled ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} size={'icon-sm'} onClick={toggleActions}>
                            {actionsEnabled && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
                            <FastForward />
                        </Button>
                        <RightSidebarTrigger icon={<CalendarsIcon />} />
                    </ButtonGroup>
                </ToolbarActionsSlot>
            </div>

            <div className="events-content">
                {actionsEnabled && <ActionCards />}
                <Separator className={'my-4 bg-linear-to-r from-transparent via-muted to-transparent'} />
                <div className={`flex gap-4 md:h-[calc(100vh-274px)] ${actionsEnabled ? 'h-[calc(100vh-400px)]' : 'h-[calc(100vh-350px)]'}`}>
                    <div className='w-full md:w-2/3 md:border-r md:pr-4 min-h-0'>
                        <div className='h-full overflow-auto flex flex-col gap-4'>
                            <HeroSpotlight
                                nextEvent={summary?.next ?? null}
                                stats={heroStats}
                                onCreateEvent={handleCreateEvent}
                                canCreate={canCreate}
                            />
                            <EventListView
                                events={events}
                                onCreateEvent={handleCreateEvent}
                                onEditEvent={handleEditEvent}
                                onDeleteEvent={handleDeleteEvent}
                                onViewAttendees={handleViewAttendees}
                                selectedStatus={selectedStatuses}
                                timezone={enableTimezone}
                                activeGroup={activeGroup}
                                onShowPast={() => setActiveGroup('past')}
                                canCreate={canCreate}
                                isLoading={isLoading}
                            />
                            {page?.page.hasMore && (
                                <p className="shrink-0 pb-2 text-center text-xs text-muted-foreground">
                                    Showing the first {events.length}. Narrow the search to find more.
                                </p>
                            )}
                            {/* Entitlement is the organization's plan, from the API —
                                not a localStorage flag (§2.12). */}
                            {activeOrganization?.plan === 'free' && (
                                <UpgradeSpotlight onUpgrade={() => navigate({ to: '/upgrade' })} />
                            )}
                        </div>
                    </div>
                    {!isMobile && (
                        <div className='w-1/3'>
                            <EventCalendar
                                events={calendarEvents}
                                month={calendarMonth}
                                onMonthChange={setCalendarMonth}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsPage;
