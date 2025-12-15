import { useCallback, useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { eventCollection } from '../../collections/events.js';
import type { Event } from '../../db/schema.js';
import { useLauncher } from '../../store.js';
import { launchEventForm, type EventFormProps } from '../../containers/EventForm/index.js';
import CalendarPage from './Calendar/index.js';


const EventsPage = () => {
    const { openLauncher } = useLauncher();

    // Fetch events using TanStack DB live query
    const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
    const events = useMemo<Event[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);


    const launch = useCallback((args?: Omit<EventFormProps, 'collection'>) => {
        launchEventForm(args, openLauncher);
    }, [openLauncher]);

    return <CalendarPage events={events} launch={launch} collection={eventCollection} />;
};

export default EventsPage;