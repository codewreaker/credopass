import React, { useMemo, useState } from 'react';
import { useEventsCalendar, type Event } from '@credopass/api-client';
import { EventCalendar } from '@credopass/ui/components/event-calendar';

/** `2026-07` — the month key `GET /events/calendar` expects. */
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * The calendar rail.
 *
 * One month at a time, fetched. The old version pulled every event the browser
 * had ever cached and filtered it down — which meant the rail was only ever as
 * complete as the cache happened to be.
 */
const OverviewView: React.FC = () => {
  const [month, setMonth] = useState<Date>(() => new Date());
  const { data: calendar } = useEventsCalendar(monthKey(month));

  const events = useMemo<Event[]>(
    () => (calendar?.days ?? []).flatMap((day) => day.events),
    [calendar]
  );

  return (
    <EventCalendar events={events} variant="compact" month={month} onMonthChange={setMonth} />
  );
};

export default OverviewView;
