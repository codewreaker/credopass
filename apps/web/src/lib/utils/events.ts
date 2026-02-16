import type { EventType } from '@credopass/lib/schemas';

/** Group events by date -- Luma groups upcoming events by day */
export function groupEventsByStatus(events: EventType[]): Map<EventType['status'], EventType[]> {
    const groups = new Map<EventType['status'], EventType[]>();
    for (const event of events) {
        const statusType = event.status
        const existing = groups.get(statusType) || [];
        existing.push(event);
        groups.set(statusType, existing);
    }
    return groups;
}

type GroupedEvents = ReturnType<typeof groupEventsByStatus>;

export function getGroupedEventsData<T extends EventType>(
    groupedEventMap: GroupedEvents, statuses: Array<T['status']>
): Array<[T['status'], T[]]> {
    const result: Array<[EventType['status'], T[]]> = [];
    statuses.forEach((s) => {
        const events = groupedEventMap.get(s);
        if (events && events.length !== 0) {
            result.push([s, events as T[]])
        }
    });
    return result;

}