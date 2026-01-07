import { useCallback, useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { eventCollection } from '@dwellpass/tanstack-db';
import type { EventType } from '@dwellpass/validation';
import { useLauncher } from '../../stores/store';
import { launchEventForm, type EventFormProps } from '../../containers/EventForm/index';
import CalendarPage from './Calendar/index';


const EventsPage = () => {
    const { openLauncher } = useLauncher();

    // Fetch events using TanStack DB live query
    const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
    const events = useMemo<EventType[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);


    const launch = useCallback((args?: Omit<EventFormProps, 'collection'>) => {
        launchEventForm(args, openLauncher);
    }, [openLauncher]);

    return <CalendarPage events={events} launch={launch} collection={eventCollection} />;
};

export default EventsPage;