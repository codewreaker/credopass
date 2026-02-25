import { useCallback, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType, Organization } from '@credopass/lib/schemas';
import { useEventSessionStore, useLauncher } from '@credopass/lib/stores';
import { launchEventForm } from '../../containers/EventForm/index';
import EventListView from './EventListView';
import EventCalendar from '@credopass/ui/components/event-calendar';
import { STATUS_MAPPING } from '@credopass/ui/components/event-row';
import { CalendarPlus, CalendarsIcon, ListFilterPlus, TimerIcon, FastForward } from 'lucide-react';
import { useStatusFilter, useToolbarContext } from '@credopass/lib/hooks';
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


const handleDeleteEvent = (eventId: string) => handleCollectionDeleteById('events', eventId);

// Create chip filter options from STATUS_MAPPING
const statusFilterOptions = (() => {
    const allOption: ChipFilterOption<'all'> = {
        value: 'all',
        label: 'All',
    };
    const statusOptions = Object.entries(STATUS_MAPPING).map(([status, config]) => ({
        value: status as EventTypeFilters,
        label: config.label,
        icon: config.icon
    }));

    const actionOption: ChipFilterOption<string>[] = [{
        label: 'Timezone',
        value: 'timezone',
        icon: <TimerIcon />
    },
        divider,
    {
        label: 'actions',
        value: 'actions',
        icon: <FastForward />
    }]


    const allFilters = [
        ...statusOptions,
        divider,
        ...actionOption
    ]

    return [allOption, ...allFilters];
})() as ChipFilterOption<EventTypeFilters>[];

const allFilters = Object.keys(STATUS_MAPPING).concat(['actions', 'timezone']) as Array<EventTypeFilters>;
/**
 * EventCalendar is a full blown calendar that can be accessed in the sidebar
 * should we want to make it available in the event view just import it here
 * import { EventCalendar } from '../../components/event-calendar';
 */
const EventsPage = () => {
    const { openLauncher } = useLauncher();
    const { events: eventCollection, organizations: orgCollection } = getCollections();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState<string>('');

    const {
        filterEnabled, setFilterEnabled,
        handleFilterChange, displayedFilterValue,
        selectedStatuses, enableActions, enableTimezone,
    } = useStatusFilter(allFilters);

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
        launchEventForm({ isEditing: false }, openLauncher);
    }, [openLauncher]);

    const handleEditEvent = useCallback((event: EventType & { orgCollection?: Organization }) => {
        launchEventForm({
            isEditing: true,
            initialData: {
                id: event.id,
                name: event.name,
                description: event.description || '',
                status: event.status,
                dateTimeRange: {
                    from: event.startTime ? new Date(event.startTime) : undefined,
                    to: event.endTime ? new Date(event.endTime) : undefined,
                },
                location: event.location || '',
                capacity: event.capacity?.toString() || '',
                organizationId: event.organizationId,
            },
        }, openLauncher);
    }, [openLauncher]);

    // Register toolbar context: secondary "Create Event" button + search
    useToolbarContext({
        action: { icon: CalendarPlus, label: 'Create Event', onClick: handleCreateEvent },
        search: { enabled: true, placeholder: 'Search events…', onSearch: setSearchQuery },
    });

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
                        {"Here\u2019s a summary of your events"}
                    </p>
                </div>

                <div className="events-header-right">
                    <ButtonGroup>
                        <Button variant='outline' className={'relative'} size={'icon-sm'} onClick={() => setFilterEnabled(prev => !prev)}>
                            {filterEnabled && <span className="absolute bottom-4 left-4 size-2 rounded-full bg-primary" />}
                            <ListFilterPlus />
                        </Button>
                        <RightSidebarTrigger icon={<CalendarsIcon />} />
                    </ButtonGroup>
                </div>
            </div>

            <div className="events-content">
                {/* Chip Filter for Status */}
                {filterEnabled && <ChipFilter
                    options={statusFilterOptions}
                    value={displayedFilterValue as EventTypeFilters[]}
                    onValueChange={handleFilterChange}
                    mode="multiple"
                    className='overflow-x-auto w-100vw py-6'
                />}
                {enableActions && <ActionCards />}
                <Separator className={'my-5 bg-gradient-to-r from-transparent via-muted to-transparent'} />

                <div className='flex gap-4 md:h-[calc(100vh-274px)]'>
                    <div className='w-full md:w-2/3 md:border-r'>
                        <EventListView
                            events={filteredEvents}
                            onCreateEvent={handleCreateEvent}
                            onEditEvent={handleEditEvent}
                            onDeleteEvent={handleDeleteEvent}
                            selectedStatus={selectedStatuses}
                            timezone={enableTimezone}
                        />
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
