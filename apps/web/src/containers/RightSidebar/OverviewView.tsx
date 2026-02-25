import React, { useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import { EventCalendar } from '@credopass/ui/components/event-calendar';
import type { EventType } from '@credopass/lib/schemas';

const OverviewView: React.FC = () => {
  const { events: eventCollection } = getCollections();

  const { data: eventsData } = useLiveQuery((q) =>
    q
      .from({ eventCollection })
      .orderBy(({ eventCollection }) => eventCollection.startTime, 'asc')
      .select(({ eventCollection }) => ({ ...eventCollection }))
  );

  const events = useMemo<EventType[]>(
    () => (Array.isArray(eventsData) ? eventsData : []),
    [eventsData],
  );

  return <EventCalendar events={events} variant="compact" />;
};

export default OverviewView;
