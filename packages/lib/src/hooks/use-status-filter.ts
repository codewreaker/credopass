import { useCallback, useMemo, useState } from 'react';
import type { EventType } from '../schemas';
import { useCookies } from './use-cookies';

export const EVENTS_FILTER_COOKIE_NAME = 'events_filter_selection';
export const EVENTS_FILTER_ENABLED_COOKIE_NAME = 'events_filter_enabled';

export type EventTypeFilters = EventType['status'] | 'actions' | 'timezone';

const DEFAULT_FILTERS: EventTypeFilters[] = ['scheduled', 'ongoing', 'actions'];

export function useStatusFilter(allFilters: EventTypeFilters[]) {
    const [filterEnabledCookie, setFilterEnabledCookie] = useCookies(EVENTS_FILTER_ENABLED_COOKIE_NAME);
    const [filterEnabled, setFilterEnabledState] = useState<boolean>(
        filterEnabledCookie !== undefined ? filterEnabledCookie === 'true' : true
    );

    const [filterCookie, setFilterCookie] = useCookies(EVENTS_FILTER_COOKIE_NAME);
    const [selectedFilters, setSelectedFiltersState] = useState<EventTypeFilters[]>(() => {
        try {
            return filterCookie ? JSON.parse(filterCookie) : DEFAULT_FILTERS;
        } catch {
            return DEFAULT_FILTERS;
        }
    });

    const setFilterEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setFilterEnabledState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            setFilterEnabledCookie(String(next), { path: '/', expires: 7 });
            return next;
        });
    }, [setFilterEnabledCookie]);

    const setSelectedFilters = useCallback((values: EventTypeFilters[]) => {
        setSelectedFiltersState(values);
        setFilterCookie(JSON.stringify(values), { path: '/', expires: 7 });
    }, [setFilterCookie]);

    const handleFilterChange = useCallback((value: EventTypeFilters | EventTypeFilters[]) => {
        const values = Array.isArray(value) ? value : [value];
        const isAllMode = allFilters.every(f => selectedFilters.includes(f));

        if (isAllMode) {
            // In all-mode: isolate to the clicked filter, or no-op if "All" itself was clicked
            const specific = values.filter(v => v !== ('all' as EventTypeFilters));
            if (specific.length > 0) setSelectedFilters(specific);
        } else if (values.includes('all' as EventTypeFilters)) {
            // "All" clicked from non-all-mode → enable everything
            setSelectedFilters(allFilters);
        } else {
            setSelectedFilters(values);
        }
    }, [allFilters, selectedFilters, setSelectedFilters]);

    // Swap the real selection for ['all'] when every filter is active, so the "All" chip highlights
    const displayedFilterValue = useMemo((): (EventTypeFilters | 'all')[] => {
        const isAllMode = allFilters.every(f => selectedFilters.includes(f));
        return isAllMode ? ['all'] : selectedFilters;
    }, [allFilters, selectedFilters]);

    const selectedStatuses = useMemo(
        () => selectedFilters.filter(f => !['actions', 'timezone'].includes(f)) as EventType['status'][],
        [selectedFilters]
    );

    const enableActions = useMemo(() => selectedFilters.includes('actions'), [selectedFilters]);
    const enableTimezone = useMemo(() => selectedFilters.includes('timezone'), [selectedFilters]);

    return {
        filterEnabled,
        setFilterEnabled,
        selectedFilters,
        handleFilterChange,
        displayedFilterValue,
        selectedStatuses,
        enableActions,
        enableTimezone,
    };
}
