import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '../../lib/tanstack-db';
import type { EventType } from '@credopass/lib/schemas';
import { useLauncher } from '../../stores/store';
import { launchEventForm, type EventFormProps } from '../../containers/EventForm/index';
import CalendarPage from './Calendar/index';
import EventListView from './EventListView';
import { Calendar, List, Plus } from 'lucide-react';
import './events.css';

type ViewMode = 'calendar' | 'list';

const EventsPage = () => {
    const { openLauncher } = useLauncher();
    const { events: eventCollection } = getCollections();
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
    const events = useMemo<EventType[]>(
        () => (Array.isArray(eventsData) ? eventsData : []),
        [eventsData],
    );

    const launch = useCallback(
        (args?: Omit<EventFormProps, 'collection'>) => {
            launchEventForm(args, openLauncher);
        },
        [openLauncher],
    );

    const handleCreateEvent = useCallback(() => {
        launchEventForm({ isEditing: false }, openLauncher);
    }, [openLauncher]);

    return (
        <div className="events-page">
            <div className="events-header">
                <div className="events-header-left">
                    <h1 className="events-title">Events</h1>
                    <span className="events-count">{events.length}</span>
                </div>

                <div className="events-header-right">
                    <div className="view-toggle" role="tablist" aria-label="View mode">
                        <button
                            role="tab"
                            type="button"
                            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            aria-selected={viewMode === 'list'}
                            aria-label="List view"
                        >
                            <List size={15} />
                        </button>
                        <button
                            role="tab"
                            type="button"
                            className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                            onClick={() => setViewMode('calendar')}
                            aria-selected={viewMode === 'calendar'}
                            aria-label="Calendar view"
                        >
                            <Calendar size={15} />
                        </button>
                    </div>

                    <button
                        type="button"
                        className="events-create-btn"
                        onClick={handleCreateEvent}
                    >
                        <Plus size={15} />
                        <span>Create Event</span>
                    </button>
                </div>
            </div>

            <div className="events-content">
                {viewMode === 'calendar' ? (
                    <CalendarPage events={events} launch={launch} />
                ) : (
                    <EventListView
                        events={events}
                        onCreateEvent={handleCreateEvent}
                    />
                )}
            </div>
        </div>
    );
};

export default EventsPage;
