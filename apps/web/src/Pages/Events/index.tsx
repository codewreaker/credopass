import { useCallback, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '../../lib/tanstack-db';
import type { EventType } from '@credopass/lib/schemas';
import { useEventSessionStore, useLauncher } from '../../stores/store';
import { launchEventForm } from '../../containers/EventForm/index';
import EventListView, { STATUS_MAPPING } from './EventListView';
import type { EventWithOrg } from './EventListView';
import { CalendarPlus, CalendarsIcon, Filter } from 'lucide-react';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import { Button } from "@credopass/ui/components/button"
import { ButtonGroup } from '@credopass/ui/components/button-group'
import { getGreeting, handleCollectionDeleteById } from '../../lib/utils';

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@credopass/ui/components/dropdown-menu"

import './events.css';
import { RightSidebarTrigger } from '../../containers/RightSidebar';
import ActionCards from '../../containers/ActionCards';
import { Separator } from '@credopass/ui';

/**
 * EventCalendar is a full blown calendar that can be accessed in the sidebar
 * should we want to make it available in the event view just import it here
 * import { EventCalendar } from '../../components/event-calendar';
 */



const handleDeleteEvent = (eventId: string) => handleCollectionDeleteById('events', eventId);

const StatusFilterMenu: React.FC<{
    menuItems: Record<EventType['status'], boolean>;
    clickHandler: (update: Record<EventType['status'], boolean>) => void;
}> = ({ menuItems, clickHandler }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='outline' size={'icon-sm'}><Filter /></Button>} />
            <DropdownMenuContent className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Show More Statuses</DropdownMenuLabel>
                    {Object.entries(STATUS_MAPPING).map(([status, entry]) => (
                        <DropdownMenuCheckboxItem
                            checked={menuItems[status as EventType['status']]}
                            onCheckedChange={(checked) =>
                                clickHandler({ ...menuItems, [status]: checked === true })
                            }>
                            {entry.icon}
                            {status}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu >
    )
}

const EventsPage = () => {
    const { openLauncher } = useLauncher();
    const { events: eventCollection, organizations: orgCollection } = getCollections();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusMenu, setStatusMenuItems] = useState<Record<EventType['status'], boolean>>({
        draft: false,
        scheduled: true,
        ongoing: true,
        completed: true,
        cancelled: false,
    });

    const userName = useEventSessionStore((s) => s.session.currentUserName);
    const firstName = useMemo(() => userName?.split(' ')[0] || 'there', [userName]);
    const greeting = useMemo(() => getGreeting(), []);

    const selStatus = useMemo(() => {
        const selArr = [];
        for (const k in statusMenu) {
            if (statusMenu[k as EventType['status']]) {
                selArr.push(k);
            }
        }
        return selArr as EventType['status'][];
    }, [statusMenu])

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

    const handleEditEvent = useCallback((event: EventWithOrg) => {
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
                        <RightSidebarTrigger icon={<CalendarsIcon />} />
                        <StatusFilterMenu menuItems={statusMenu} clickHandler={setStatusMenuItems} />
                    </ButtonGroup>
                </div>
            </div>

            <div className="events-content">
                <ActionCards />
                <Separator className={'my-5 bg-gradient-to-r from-transparent via-muted to-transparent'} />
                <EventListView
                    events={filteredEvents}
                    onCreateEvent={handleCreateEvent}
                    onEditEvent={handleEditEvent}
                    onDeleteEvent={handleDeleteEvent}
                    selectedStatus={selStatus}
                />
            </div>
        </div>
    );
};

export default EventsPage;
