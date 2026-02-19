/**
 * Event Utilities
 * Helper functions for event operations
 */

import type { EventType } from '../schemas';

/** Group events by status */
export function groupEventsByStatus(events: EventType[]): Map<EventType['status'], EventType[]> {
  const groups = new Map<EventType['status'], EventType[]>();
  for (const event of events) {
    const statusType = event.status;
    const existing = groups.get(statusType) || [];
    existing.push(event);
    groups.set(statusType, existing);
  }
  return groups;
}

type GroupedEvents = ReturnType<typeof groupEventsByStatus>;

export function getGroupedEventsData<T extends EventType>(
  groupedEventMap: GroupedEvents,
  statuses: Array<T['status']>
): Array<[T['status'], T[]]> {
  const result: Array<[EventType['status'], T[]]> = [];
  statuses.forEach((s) => {
    const events = groupedEventMap.get(s);
    if (events && events.length !== 0) {
      result.push([s, events as T[]]);
    }
  });
  return result;
}


export function sortEventsByClosestToToday(events: EventType[]): EventType[] {
  const now = new Date();

  return [...events].sort((a, b) => {
    const diffA = a.startTime.getTime() - now.getTime();
    const diffB = b.startTime.getTime() - now.getTime();

    // Prioritize future/ongoing events over past events
    const absA = diffA >= 0 ? diffA : Math.abs(diffA) + Number.MAX_SAFE_INTEGER / 2;
    const absB = diffB >= 0 ? diffB : Math.abs(diffB) + Number.MAX_SAFE_INTEGER / 2;

    return absA - absB;
  });
};

export function getMonthEvents(month: Date, events: EventType[]): EventType[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  return events
    .filter((ev) => {
      const s = new Date(ev.startTime);
      return s.getFullYear() === y && s.getMonth() === m;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

// useful for calendar day cells: given a date, return a string key like "2024-09-08" for direct comparison and map lookups 
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
