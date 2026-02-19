import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, CalendarDayButton } from '@credopass/ui/components/calendar';
import type { EventType } from '@credopass/lib/schemas';
import { cn } from '@credopass/ui/lib/utils';

import './event-calendar.css';
import { EventRow } from '../event-row';

// ---- Status colour mapping (dot indicator) ----
const STATUS_DOT_COLORS: Record<EventType['status'], string> = {
  draft: 'bg-muted-foreground',
  scheduled: 'bg-blue-500',
  ongoing: 'bg-green-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
};

// ---- Helpers ----

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Build a map of ISO-date-string → EventType[] for quick day lookups */
function buildEventMap(events: EventType[]): Map<string, EventType[]> {
  const map = new Map<string, EventType[]>();
  for (const ev of events) {
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (cursor <= endDay) {
      const key = toDateKey(cursor);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}

// ---- Component Props ----
export interface EventCalendarProps {
  events: EventType[];
  /** "compact" for the sidebar widget, "full" for the events page */
  variant?: 'compact' | 'full';
  className?: string;
}

interface MonthEventsProps {
  event: EventType;
  isEventActive: (ev: EventType) => boolean;
  handleEventRowClick: (ev: EventType) => void;
  handleEventNavigate: (eventId: string) => void;
}

const MonthEvents = ({ event: ev, isEventActive, handleEventRowClick, handleEventNavigate }: MonthEventsProps) => (
<div
  className={cn(
    'event-calendar-item',
    isEventActive(ev) && 'event-calendar-item--active',
  )}
  onDoubleClick={() => handleEventNavigate(ev.id)}
>
  <EventRow event={ev} onNavigate={() => handleEventRowClick(ev)} compact isMobile />
</div>)

// ---- Component ----
export default function EventCalendar({
  events,
  variant = 'full',
  className,
}: EventCalendarProps) {
  const navigate = useNavigate();
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const eventMap = useMemo(() => buildEventMap(events), [events]);

  /** Events whose start falls in the currently viewed month */
  const monthEvents = useMemo<EventType[]>(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return events
      .filter((ev) => {
        const s = new Date(ev.startTime);
        return s.getFullYear() === y && s.getMonth() === m;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, month]);

  /** All dates that have at least one event → used for modifiers */
  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    for (const key of eventMap.keys()) {
      dates.push(new Date(key + 'T00:00:00'));
    }
    return dates;
  }, [eventMap]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
  }, []);

  /** Click an event row → select its start date on the calendar */
  const handleEventRowClick = useCallback(
    (ev: EventType) => {
      const start = new Date(ev.startTime);
      setSelectedDate(start);
      // If the event is in a different month, navigate the calendar there
      if (start.getFullYear() !== month.getFullYear() || start.getMonth() !== month.getMonth()) {
        setMonth(start);
      }
    },
    [month],
  );

  const handleEventNavigate = useCallback(
    (eventId: string) => {
      navigate({ to: '/events/$eventId', params: { eventId } });
    },
    [navigate],
  );

  /** Is a given event "active" (its start date matches the selected date)? */
  const isEventActive = useCallback(
    (ev: EventType) => {
      if (!selectedDate) return false;
      const key = toDateKey(selectedDate);
      const evDays = eventMap.get(key);
      return evDays?.some((e) => e.id === ev.id) ?? false;
    },
    [selectedDate, eventMap],
  );

  const isCompact = variant === 'compact';

  return (
    <div className={cn('event-calendar', isCompact && 'event-calendar--compact', className)}>
      <div className="event-calendar-grid">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={selectedDate}
          onSelect={handleDateSelect}
          numberOfMonths={1}
          captionLayout="dropdown"
          className={cn(
            'ec-calendar',
            'rounded-2xl',
            isCompact
              ? '[--cell-size:--spacing(7)]'
              : '[--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]',
          )}
          classNames={{
            root: 'w-full',
          }}
          formatters={{
            formatMonthDropdown: (date) =>
              date.toLocaleString('default', { month: 'long' }),
          }}
          modifiers={{
            hasEvent: eventDates,
          }}
          modifiersClassNames={{
            hasEvent: 'day-has-event',
          }}
          components={{
            DayButton: ({ children, modifiers, day, ...props }) => {
              const dateKey = toDateKey(day.date);
              const dayEvents = eventMap.get(dateKey) ?? [];
              const hasEvents = dayEvents.length > 0 && !modifiers.outside;

              return (
                <CalendarDayButton day={day} modifiers={modifiers} {...props}>
                  {children}
                  {hasEvents && (
                    <span className="event-calendar-dots">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <span
                          key={ev.id ?? i}
                          className={cn('event-calendar-dot', STATUS_DOT_COLORS[ev.status])}
                        />
                      ))}
                    </span>
                  )}
                </CalendarDayButton>
              );
            },
          }}
        />
      </div>

      {/* Month event list — always visible */}
      <div className="event-calendar-detail">
        <h4 className="event-calendar-detail-title">
          {month.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          <span className="event-calendar-count">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</span>
        </h4>

        {monthEvents.length === 0 ? (
          <p className="event-calendar-empty">No events this month</p>
        ) : (
          <div className="event-calendar-list">
            {monthEvents.map((ev) => (
              <MonthEvents 
                key={ev.id}
                event={ev}
                isEventActive={isEventActive}
                handleEventRowClick={handleEventRowClick}
                handleEventNavigate={handleEventNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
