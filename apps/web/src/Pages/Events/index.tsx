import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    hasProblemCode,
    ProblemCode,
    useCancelEvent,
    useDeleteEvent,
    useReissuePass,
    useEventsCalendar,
    useEventsSummary,
    useOrganizations,
    type Event,
} from '@credopass/api-client';
import EventListView from './EventListView';
import { useMergedEvents, type ListEvent } from './use-merged-events';
import { AnnouncementBanner } from './announcement-banner';
import EventCalendar from '@credopass/ui/components/event-calendar';
import { CalendarPlus, CalendarsIcon, MapPin, Users, Clock, ScanLine, ArrowUpRight, Plus, ChevronUp, ChevronDown, Sparkles, Pencil } from 'lucide-react';
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
import { useCan, useGreetingName, useSession } from '../../contexts/session';
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

    const { activeGroup, setActiveGroup, selectedStatuses } = useStatusFilter();

    const { firstName, isKnown: isNameKnown } = useGreetingName();
    const greeting = useMemo(() => getGreeting(), []);

    const { data: summary } = useEventsSummary();

    /**
     * One list: what this org hosts, and what this account is going to.
     *
     * Two scopes, joined here rather than server-side — `/events` is
     * organisation-scoped and `/me/tickets` is account-scoped, and the whole
     * tenancy model rests on those staying separate queries. See
     * `use-merged-events.ts` for why the two lists became one.
     */
    const {
        events,
        counts: mergedCounts,
        hasMore,
        isLoading,
    } = useMergedEvents({
        group: activeGroup,
        q: searchQuery.trim() || undefined,
    });
    const { data: calendar } = useEventsCalendar(monthKey(calendarMonth));
    const { data: organizations = [] } = useOrganizations();
    const activeOrganization = organizations.find((o) => o.id === organizationId);

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

    // `null` until BOTH halves have landed, so the switch shows a dash rather
    // than a number that is about to change under the reader (UI-REDESIGN R2).
    const groupCounts = mergedCounts;

    const cancelEvent = useCancelEvent();
    const deleteEvent = useDeleteEvent();
    const reissuePass = useReissuePass();

    const handleCreateEvent = useCallback(() => {
        navigate({ to: '/events/new' });
    }, [navigate]);

    const handleEditEvent = useCallback((event: ListEvent) => {
        navigate({ to: '/events/$eventId/edit', params: { eventId: event.id } });
    }, [navigate]);

    // Jump straight to the attendee list for this event.
    const handleViewAttendees = useCallback((eventId: string) => {
        navigate({ to: '/attendees', search: { eventId } });
    }, [navigate]);

    /**
     * Put an attendee's pass back in their hands.
     *
     * It MINTS a new pass rather than fetching the old one, because the old one
     * is genuinely not retrievable: only its SHA-256 is stored, and
     * `uq_passes_event_person_live` allows exactly one live pass per person per
     * event, so issuing revokes the previous link. The toast says so — the
     * person may have saved the earlier URL, and it has just stopped working.
     *
     * Guest rows only. A host reaching here would be a bug: their row offers
     * edit, attendees and delete instead, and `/me/tickets/{id}/pass` answers
     * 404 for an event they hold no attendance row on.
     */
    const handleViewPass = useCallback(async (eventId: string) => {
        try {
            const pass = await reissuePass.mutateAsync(eventId);
            toast.success('New pass issued — any earlier link you saved has stopped working.');
            navigate({ to: '/p/$token', params: { token: pass.token } });
        } catch (error) {
            toast.error(errorMessage(error, 'Could not reissue your pass'));
        }
    }, [reissuePass, navigate]);

    /**
     * Delete, falling back to cancel.
     *
     * `DELETE /events/{id}` refuses with 409 once anyone has registered, and it
     * is right to: those people hold pass URLs. Cancelling keeps the rows, the
     * URL and the history, and is what the organiser actually wants.
     */
    const handleDeleteEvent = useCallback(async (event: ListEvent) => {
        // A guest row offers no delete control, so reaching here with one
        // would be a bug rather than a permission question — but the list is
        // merged now, and "the UI does not render it" is not the same as
        // "the handler cannot be called".
        if (!canDelete || event.relationship !== 'host') return;
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
            {/* Greeting, then the one filter, then the two shortcuts.
                Three rows, each saying something the others do not (F2–F4). */}
            {/* Before the greeting, because it is about what strangers are
                already seeing rather than about this session. */}
            <AnnouncementBanner />

            <div className="events-header">
                <div className="events-header-left">
                    <h1 className="events-header-title">
                        {greeting},{' '}
                        {isNameKnown ? (
                            firstName
                        ) : (
                            // Never greet someone before we know who they are.
                            // `Good afternoon, there` used to sit here for the
                            // length of the bootstrap request (R2).
                            <span
                                aria-label="loading your name"
                                className="inline-block h-5 w-28 translate-y-0.5 animate-pulse rounded-md bg-muted align-middle"
                            />
                        )}
                        {/* Small on purpose: an affordance beside the name, not
                            a button competing with it. */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit your profile"
                            title="Edit your profile"
                            className="ml-1.5 size-6 translate-y-[-1px] rounded-full text-muted-foreground hover:text-foreground"
                            onClick={() => navigate({ to: '/account', search: { tab: 'profile' } })}
                        >
                            <Pencil size={12} />
                        </Button>
                    </h1>
                </div>

                {/* The counts live on the switch now. The summary line that used
                    to sit above it said the same thing twice (F3). */}
                <div className="events-header-right">
                    <StatusFilterSwitch
                        activeGroup={activeGroup}
                        onGroupChange={setActiveGroup}
                        counts={groupCounts}
                        ongoing={heroStats.ongoing}
                    />
                    {/* Calendar View / View Organisations, in the space the
                        timezone toggle used to take (F4). Always shown — they
                        were behind a toolbar toggle that hid them by default. */}
                    <ActionCards />
                </div>

                <ToolbarActionsSlot>
                    <ButtonGroup className="rounded-full border border-border bg-card p-1 gap-0.5">
                        <RightSidebarTrigger icon={<CalendarsIcon />} />
                    </ButtonGroup>
                </ToolbarActionsSlot>
            </div>

            <div className="events-content">
                <Separator className={'my-4 bg-linear-to-r from-transparent via-muted to-transparent'} />
                {/* No fixed height and no inner scroller (UI-REDESIGN R1).
                    This was `h-[calc(100vh-350px)]` — three hardcoded offsets
                    that had to be kept in step with the header, the action
                    cards and the separator, and were wrong the moment any of
                    them changed. The list now runs down the page and the
                    document scrolls. The calendar is sticky so it stays in
                    view beside a long list on desktop. */}
                <div className="flex gap-4 items-start">
                    <div className='w-full md:w-2/3 md:border-r md:pr-4'>
                        <div className='flex flex-col gap-4'>
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
                                onViewPass={handleViewPass}
                                selectedStatus={selectedStatuses}
                                timezone
                                activeGroup={activeGroup}
                                onShowPast={() => setActiveGroup('past')}
                                canCreate={canCreate}
                                isLoading={isLoading}
                            />
                            {hasMore && (
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
                        <div className='w-1/3 sticky top-20'>
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
