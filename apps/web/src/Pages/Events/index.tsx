import { useCallback, useMemo, useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '../../lib/tanstack-db';
import type { EventType } from '@credopass/lib/schemas';
import { useEventSessionStore, useLauncher } from '../../stores/store';
import { useAppStore } from '../../stores/store';
import { launchEventForm } from '../../containers/EventForm/index';
import EventListView, { STATUS_MAPPING } from './EventListView';
import { Calendar, CalendarPlus, Filter } from 'lucide-react';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import { Button } from "@credopass/ui/components/button"
import { getGreeting } from '../../lib/utils';

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@credopass/ui/components/dropdown-menu"

import './events.css';

/**
 * EventCalendar is a full blown calendar that can be accessed in the sidebar
 * should we want to make it available in the event view just import it here
 * import { EventCalendar } from '../../components/event-calendar';
 */

type ViewMode = 'calendar' | 'list';


const StatusFilterMenu: React.FC<{
    menuItems: Record<EventType['status'], boolean>;
    clickHandler: (update: Record<EventType['status'], boolean>) => void;
}> = ({ menuItems, clickHandler }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Button variant='outline' className='p-3' size={'icon-xs'}><Filter /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Show More Statuses</DropdownMenuLabel>
                    {Object.entries(STATUS_MAPPING).map(([status, entry]) => (
                        <DropdownMenuCheckboxItem
                            key={status}
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
        </DropdownMenu>
    )
}

const EventsPage = () => {
    const { openLauncher } = useLauncher();
    const { events: eventCollection, organizations: orgCollection } = getCollections();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusMenu, setStatusMenuItems] = useState<Record<EventType['status'], boolean>>({
        draft: false,
        scheduled: true,
        ongoing: true,
        completed: false,
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
                    <Button
                        variant='outline'
                        className='p-3'
                        size={'icon-xs'}
                        onClick={() => {
                            useAppStore.getState().setViewedItem({ id: 'calendar', content: null });
                            useAppStore.getState().toggleSidebar('right', true);
                        }}
                    >
                        <Calendar />
                    </Button>
                    <StatusFilterMenu menuItems={statusMenu} clickHandler={setStatusMenuItems} />
                </div>
            </div>

            <div className="events-content">
                <EventListView
                    events={filteredEvents}
                    onCreateEvent={handleCreateEvent}
                    selectedStatus={selStatus}
                />
            </div>
        </div>
    );
};

export default EventsPage;
