import { useCallback, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType, Organization } from '@credopass/lib/schemas';
import { useEventSessionStore } from '@credopass/lib/stores';
import EventListView from './EventListView';
import EventCalendar from '@credopass/ui/components/event-calendar';
import { STATUS_MAPPING } from '@credopass/ui/components/event-row';
import { CalendarPlus, CalendarsIcon, ListFilterPlus, TimerIcon, FastForward, MapPin, Users, Clock, ScanLine, ArrowUpRight, Plus, ChevronUp, ChevronDown, CalendarClock, History, Sparkles } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useStatusFilter, useToolbarContext, STATUS_GROUPS } from '@credopass/lib/hooks';
import type { EventTypeFilters } from '@credopass/lib/hooks';
export { EVENTS_FILTER_COOKIE_NAME, EVENTS_FILTER_ENABLED_COOKIE_NAME } from '@credopass/lib/hooks';
import { ButtonGroup } from '@credopass/ui/components/button-group';
import { getGreeting } from '@credopass/lib/utils';
import { handleCollectionDeleteById } from '@credopass/api-client/collections';
import { ChipFilter, divider, type ChipFilterOption } from '@credopass/ui/components/chip-filter';


import './events.css';
import { RightSidebarTrigger } from '../../containers/RightSidebar';
import ActionCards from '../../containers/ActionCards';
import { Separator } from '@credopass/ui/components/separator';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { Button } from '@credopass/ui/components/button';
import { usePremium } from '../../contexts/premium';


const handleDeleteEvent = (eventId: string) => handleCollectionDeleteById('events', eventId);

/** Lime spotlight hero — surfaces the next ongoing/scheduled event with quick actions. */
const HERO_COLLAPSED_KEY = 'credopass:events-hero-collapsed';

const HeroSpotlight = ({
    nextEvent,
    stats,
    onCreateEvent,
}: {
    nextEvent: EventType | null;
    stats: { total: number; upcoming: number; ongoing: number };
    onCreateEvent: () => void;
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
    const startDate = nextEvent?.startTime ? new Date(nextEvent.startTime) : null;
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

    return (
        <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-5 lg:p-6 shrink-0">
            <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-[18px] border-primary-foreground/6" />
            {nextEvent && (
                <button
                    type="button"
                    onClick={toggleCollapsed}
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
                            {nextEvent.capacity != null && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Users size={13} />
                                    {nextEvent.capacity}
                                </span>
                            )}
                        </div>

                        {/* CTAs */}
                        <div className="flex items-center gap-2.5 mt-4">
                            <button
                                type="button"
                                onClick={() => navigate({ to: '/checkin/$eventId', params: { eventId: nextEvent.id } })}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground text-primary px-4 h-9 text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <ScanLine size={14} />
                                Open check-in
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate({ to: '/events/$eventId', params: { eventId: nextEvent.id } })}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary-foreground/25 px-4 h-9 text-[13px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-primary-foreground/10"
                            >
                                Details
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>

                    {statBlocks}
                </div>
            ) : (
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-1.5">Get started</p>
                        <h2 className="text-xl lg:text-2xl font-semibold tracking-tight mb-1">Plan your next event</h2>
                        <p className="text-[13px] font-medium text-primary-foreground/70 mb-4">Create an event and start checking people in within minutes.</p>
                        <button
                            type="button"
                            onClick={onCreateEvent}
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground text-primary px-4 h-9 text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus size={14} />
                            Create Event
                        </button>
                    </div>
                    {statBlocks}
                </div>
            )}
        </div>
    );
};

/**
 * Two status chips instead of five. The grouping lives in the filter layer only —
 * rows keep their own per-status badge and colour from STATUS_MAPPING.
 */
const statusFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming', icon: <CalendarClock size={14} className="text-primary/80" /> },
    { value: 'past', label: 'Past', icon: <History size={14} className="text-muted-foreground" /> },
    divider,
    { value: 'timezone', label: 'Timezone', icon: <TimerIcon /> },
] as ChipFilterOption<EventTypeFilters>[];

/**
 * Upgrade prompt as a list card rather than top-bar chrome. It borrows the
 * spotlight's shape and rhythm but stays on a dark surface — the lime hero above
 * it is the page's one lime moment.
 */
const UpgradeSpotlight = ({ onUpgrade }: { onUpgrade: () => void }) => (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 shrink-0">
        <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-18 border-primary/6" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="hidden size-16 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground md:flex">
                <Sparkles size={24} />
            </div>
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
    </div>
);

/** Secondary layer: narrow the Past group down to one status. */
const pastSubFilterOptions = STATUS_GROUPS.past.map((status) => ({
    value: status,
    label: STATUS_MAPPING[status].label,
    icon: STATUS_MAPPING[status].icon,
}));
/**
 * EventCalendar is a full blown calendar that can be accessed in the sidebar
 * should we want to make it available in the event view just import it here
 * import { EventCalendar } from '../../components/event-calendar';
 */
const EventsPage = () => {
    const navigate = useNavigate();
    const { events: eventCollection, organizations: orgCollection } = getCollections();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState<string>('');


    const {
        filterEnabled, setFilterEnabled,
        handleFilterChange, displayedFilterValue,
        selectedStatuses, enableTimezone,
        isPastVisible, pastSubFilter, setPastSubFilter,
        actionsEnabled, toggleActions,
    } = useStatusFilter();

    const { isPremium } = usePremium();
    const userName = useEventSessionStore((s) => s.session.currentUserName);
    const firstName = useMemo(() => userName?.split(' ')[0] || 'there', [userName]);
    const greeting = useMemo(() => getGreeting(), []);

    const { data: eventsData } = useLiveQuery((q) => q
        .from({ eventCollection })
        .join(
            { orgCollection },
            ({ eventCollection, orgCollection }) => eq(eventCollection.organizationId, orgCollection.id)
        )
        .orderBy(({ eventCollection }) => eventCollection.startTime, 'desc')
        .select(({ eventCollection, orgCollection }) => ({
            ...eventCollection,
            orgCollection,
        }))
    );
    const events = useMemo<EventType[]>(
        () => (Array.isArray(eventsData) ? eventsData : []),
        [eventsData],
    );


    const handleCreateEvent = useCallback(() => {
        navigate({ to: '/events/new' });
    }, [navigate]);

    const handleEditEvent = useCallback((event: EventType & { orgCollection?: Organization }) => {
        navigate({ to: '/events/$eventId/edit', params: { eventId: event.id } });
    }, [navigate]);

    // Members only exist on an event, so the composer opens already bound to one.
    const handleAddMember = useCallback((eventId: string) => {
        navigate({ to: '/members/new', search: { eventId } });
    }, [navigate]);

    // Register toolbar context: secondary "Create Event" button + search
    useToolbarContext({
        action: { icon: CalendarPlus, label: 'Create Event', onClick: handleCreateEvent },
        search: { enabled: true, placeholder: 'Search events…', onSearch: setSearchQuery },
    });

    // Read the clock once on mount rather than during render, which isn't pure.
    const [now] = useState(() => Date.now());

    // Next ongoing event, else soonest upcoming scheduled event — feeds the hero spotlight
    const nextEvent = useMemo<EventType | null>(() => {
        const ongoing = events.find((e) => e.status === 'ongoing');
        if (ongoing) return ongoing;
        const upcoming = events
            .filter((e) => e.status === 'scheduled' && e.startTime && new Date(e.startTime).getTime() >= now)
            .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
        return upcoming[0] ?? events.find((e) => e.status === 'scheduled') ?? null;
    }, [events, now]);

    const heroStats = useMemo(() => ({
        total: events.length,
        upcoming: events.filter((e) => e.status === 'scheduled').length,
        ongoing: events.filter((e) => e.status === 'ongoing').length,
    }), [events]);

    // Filter events by search query (name, location, description)
    const filteredEvents = useMemo<EventType[]>(() => {
        if (!searchQuery.trim()) return events;
        const q = searchQuery.toLowerCase();
        return events.filter(
            (e) =>
                e.name?.toLowerCase().includes(q) ||
                e.location?.toLowerCase().includes(q) ||
                e.description?.toLowerCase().includes(q),
        );
    }, [events, searchQuery]);



    return (
        <div className="events-page">
            <div className="events-header">
                {/* Greeting */}
                <div className="events-header-left">
                    <h1 className="events-header-title">
                        {greeting}, {firstName}
                    </h1>
                    <p className="events-header-subtitle">
                        {`${heroStats.total} event${heroStats.total === 1 ? '' : 's'} \u00b7 ${heroStats.upcoming} upcoming \u00b7 ${heroStats.ongoing} live now`}
                    </p>
                </div>

                {/* Inline chip filters — share the header row on wide screens */}
                {filterEnabled && (
                    <div className="hidden xl:block flex-1 min-w-0 px-2">
                        <ChipFilter
                            options={statusFilterOptions}
                            value={displayedFilterValue as EventTypeFilters[]}
                            onValueChange={handleFilterChange}
                            mode="multiple"
                            className='overflow-x-auto justify-center'
                        />
                    </div>
                )}

                <div className="events-header-right">
                    <ButtonGroup className="rounded-full border border-border bg-card p-1 gap-0.5">
                        <Button variant='ghost' className={`relative rounded-full ${filterEnabled ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} size={'icon-sm'} onClick={() => setFilterEnabled(prev => !prev)}>
                            {filterEnabled && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
                            <ListFilterPlus />
                        </Button>
                        {/* Independent toggle — shows/hides the shortcut cards and
                            has no bearing on which events are listed. */}
                        <Button variant='ghost' aria-pressed={actionsEnabled} title="Toggle shortcuts" className={`relative rounded-full ${actionsEnabled ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} size={'icon-sm'} onClick={toggleActions}>
                            {actionsEnabled && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
                            <FastForward />
                        </Button>
                        <RightSidebarTrigger icon={<CalendarsIcon />} />
                    </ButtonGroup>
                </div>
            </div>

            <div className="events-content">
                {/* Chip Filter for Status — below header on narrow screens */}
                {filterEnabled && <ChipFilter
                    options={statusFilterOptions}
                    value={displayedFilterValue as EventTypeFilters[]}
                    onValueChange={handleFilterChange}
                    mode="multiple"
                    className='overflow-x-auto w-100vw py-4 xl:hidden'
                />}

                {/* Secondary layer: once you are looking at past events, narrow to
                    one status. Hidden while Past isn't part of the selection. */}
                {filterEnabled && isPastVisible && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 xl:pt-2">
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            Past
                        </span>
                        <button
                            type="button"
                            onClick={() => setPastSubFilter(null)}
                            className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold transition-colors ${pastSubFilter === null ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            All
                        </button>
                        {pastSubFilterOptions.map(({ value, label, icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setPastSubFilter(pastSubFilter === value ? null : value)}
                                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors ${pastSubFilter === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {actionsEnabled && <ActionCards />}
                <Separator className={'my-4 bg-linear-to-r from-transparent via-muted to-transparent'} />
                <div className={`flex gap-4 md:h-[calc(100vh-274px)] ${actionsEnabled ? 'h-[calc(100vh-420px)]' : 'h-[calc(100vh-320px)]'}`}>
                    <div className='w-full md:w-2/3 md:border-r md:pr-4 min-h-0'>
                        <div className='h-full overflow-auto flex flex-col gap-4'>
                            <HeroSpotlight
                                nextEvent={nextEvent}
                                stats={heroStats}
                                onCreateEvent={handleCreateEvent}
                            />
                            <EventListView
                                events={filteredEvents}
                                onCreateEvent={handleCreateEvent}
                                onEditEvent={handleEditEvent}
                                onDeleteEvent={handleDeleteEvent}
                                onAddMember={handleAddMember}
                                selectedStatus={selectedStatuses}
                                timezone={enableTimezone}
                            />
                            {!isPremium && (
                                <UpgradeSpotlight onUpgrade={() => navigate({ to: '/upgrade' })} />
                            )}
                        </div>
                    </div>
                    {!isMobile && (
                        <div className='w-1/3'>
                            <EventCalendar events={filteredEvents} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsPage;
