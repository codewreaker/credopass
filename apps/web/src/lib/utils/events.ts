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

export function getGroupedEventsData(groupedEventMap: GroupedEvents, statuses:Array<EventType['status']>):Array<[EventType['status'], EventType[]]>{
    const result:Array<[EventType['status'], EventType[]]> = [];
    statuses.forEach((s)=>{
        const events = groupedEventMap.get(s);
        if(events && events.length !== 0){
            result.push([s,  events])
        }
    });
    return result;

}