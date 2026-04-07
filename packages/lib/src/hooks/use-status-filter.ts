import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventType } from '../schemas';

export const EVENTS_FILTER_COOKIE_NAME = 'events_filter_selection';
export const EVENTS_FILTER_ENABLED_COOKIE_NAME = 'events_filter_enabled';

export type EventTypeFilters = EventType['status'] | 'actions' | 'timezone';

const DEFAULT_FILTERS: EventTypeFilters[] = ['scheduled', 'ongoing', 'actions'];
const DB_NAME = 'credopass_settings';
const STORE_NAME = 'filters';
const DB_VERSION = 1;

// IndexedDB helper functions
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const getFromDB = async <T>(key: string): Promise<T | undefined> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch {
        return undefined;
    }
};

const setToDB = async <T>(key: string, value: T): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch {
        // Silently fail if IndexedDB is not available
    }
};

export function useStatusFilter(allFilters: EventTypeFilters[]) {
    const [filterEnabled, setFilterEnabledState] = useState<boolean>(true);
    const [selectedFilters, setSelectedFiltersState] = useState<EventTypeFilters[]>(DEFAULT_FILTERS);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from IndexedDB on mount
    useEffect(() => {
        const loadFromDB = async () => {
            const [storedEnabled, storedFilters] = await Promise.all([
                getFromDB<boolean>(EVENTS_FILTER_ENABLED_COOKIE_NAME),
                getFromDB<EventTypeFilters[]>(EVENTS_FILTER_COOKIE_NAME),
            ]);
            
            if (storedEnabled !== undefined) {
                setFilterEnabledState(storedEnabled);
            }
            if (storedFilters !== undefined) {
                setSelectedFiltersState(storedFilters);
            }
            setIsInitialized(true);
        };
        
        loadFromDB();
    }, []);

    const setFilterEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setFilterEnabledState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            setToDB(EVENTS_FILTER_ENABLED_COOKIE_NAME, next);
            return next;
        });
    }, []);

    const setSelectedFilters = useCallback((values: EventTypeFilters[]) => {
        setSelectedFiltersState(values);
        setToDB(EVENTS_FILTER_COOKIE_NAME, values);
    }, []);

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
        isInitialized,
    };
}
