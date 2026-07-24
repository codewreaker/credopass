import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventType } from '../schemas';

export const EVENTS_FILTER_COOKIE_NAME = 'events_filter_selection';
export const EVENTS_FILTER_ENABLED_COOKIE_NAME = 'events_filter_enabled';
export const EVENTS_ACTIONS_ENABLED_COOKIE_NAME = 'events_actions_enabled';

/**
 * Five status chips was too many, so the filter UI works in two groups.
 * This is a grouping in the filtering layer only — rows keep their per-status
 * badge, icon and colour from STATUS_MAPPING, which is deliberately untouched.
 */
export type EventStatusGroup = 'upcoming' | 'past';

/** Order within a group is also the order the list renders its sections in. */
export const STATUS_GROUPS: Record<EventStatusGroup, EventType['status'][]> = {
    upcoming: ['ongoing', 'scheduled'],
    past: ['completed', 'cancelled', 'draft'],
};

export const STATUS_GROUP_KEYS = Object.keys(STATUS_GROUPS) as EventStatusGroup[];

/** Everything the chip row can hold: the two groups plus standalone toggles. */
export type EventTypeFilters = EventStatusGroup | 'timezone';

/** Toggles that ride along in the same array but are not status filters. */
const TOGGLE_FILTERS: EventTypeFilters[] = ['timezone'];

const DEFAULT_FILTERS: EventTypeFilters[] = ['upcoming'];
const DB_NAME = 'credopass_settings';
const STORE_NAME = 'filters';
const DB_VERSION = 1;

/** Reverse lookup: which group does a raw status belong to? */
const groupForStatus = (status: string): EventStatusGroup | null => {
    for (const group of STATUS_GROUP_KEYS) {
        if ((STATUS_GROUPS[group] as string[]).includes(status)) return group;
    }
    return null;
};

/**
 * Persisted selections predate the grouping: they hold raw statuses, and used to
 * hold the pseudo-status 'actions' (which never belonged in the filter array at
 * all). Fold old entries into their group, drop anything we no longer recognise,
 * and fall back to the defaults if nothing survives.
 */
export const migrateStoredFilters = (stored: unknown): EventTypeFilters[] => {
    if (!Array.isArray(stored)) return DEFAULT_FILTERS;

    const migrated = new Set<EventTypeFilters>();
    for (const entry of stored) {
        if (typeof entry !== 'string') continue;
        if (entry === 'timezone') {
            migrated.add('timezone');
        } else if (STATUS_GROUP_KEYS.includes(entry as EventStatusGroup)) {
            migrated.add(entry as EventStatusGroup);
        } else {
            const group = groupForStatus(entry);
            if (group) migrated.add(group);
        }
        // 'actions' and anything else stale is intentionally dropped.
    }

    const result = [...migrated];
    // A selection of only toggles would list nothing, so treat it as "no selection".
    return result.some((f) => !TOGGLE_FILTERS.includes(f)) ? result : DEFAULT_FILTERS;
};

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

export function useStatusFilter() {
    const [filterEnabled, setFilterEnabledState] = useState<boolean>(true);
    const [selectedFilters, setSelectedFiltersState] = useState<EventTypeFilters[]>(DEFAULT_FILTERS);
    // Showing the shortcut cards has nothing to do with which events are listed,
    // so it owns its own persisted boolean rather than sitting in the filter array.
    const [actionsEnabled, setActionsEnabledState] = useState<boolean>(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from IndexedDB on mount
    useEffect(() => {
        const loadFromDB = async () => {
            const [storedEnabled, storedFilters, storedActions] = await Promise.all([
                getFromDB<boolean>(EVENTS_FILTER_ENABLED_COOKIE_NAME),
                getFromDB<unknown>(EVENTS_FILTER_COOKIE_NAME),
                getFromDB<boolean>(EVENTS_ACTIONS_ENABLED_COOKIE_NAME),
            ]);

            if (storedEnabled !== undefined) {
                setFilterEnabledState(storedEnabled);
            }
            if (storedFilters !== undefined) {
                setSelectedFiltersState(migrateStoredFilters(storedFilters));
            }
            if (storedActions !== undefined) {
                setActionsEnabledState(storedActions);
            } else if (Array.isArray(storedFilters)) {
                // First run after the split: inherit the old pseudo-status.
                setActionsEnabledState(storedFilters.includes('actions'));
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

    const setActionsEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setActionsEnabledState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            setToDB(EVENTS_ACTIONS_ENABLED_COOKIE_NAME, next);
            return next;
        });
    }, []);

    const toggleActions = useCallback(() => setActionsEnabled((prev) => !prev), [setActionsEnabled]);

    const setSelectedFilters = useCallback((values: EventTypeFilters[]) => {
        setSelectedFiltersState(values);
        setToDB(EVENTS_FILTER_COOKIE_NAME, values);
    }, []);

    const handleFilterChange = useCallback((value: EventTypeFilters | EventTypeFilters[]) => {
        const values = Array.isArray(value) ? value : [value];
        const toggles = TOGGLE_FILTERS.filter((t) => values.includes(t));
        const groups = values.filter((v): v is EventStatusGroup =>
            STATUS_GROUP_KEYS.includes(v as EventStatusGroup)
        );
        const clickedAll = values.includes('all' as EventTypeFilters);
        const wasAllMode = STATUS_GROUP_KEYS.every((g) => selectedFilters.includes(g));

        // In all-mode the chips display ['all', ...toggles], so anything the user
        // hits arrives alongside 'all'. An emission without 'all' therefore means
        // "All" itself was clicked, and there is nothing to isolate to.
        if (wasAllMode && !clickedAll) return;

        let nextGroups: EventStatusGroup[];
        if (wasAllMode) {
            // Isolate to what was clicked; no group means a toggle was hit, so the
            // group selection stays as it was.
            nextGroups = groups.length > 0 ? groups : STATUS_GROUP_KEYS;
        } else if (clickedAll) {
            nextGroups = STATUS_GROUP_KEYS;
        } else {
            nextGroups = groups;
        }

        // Toggles never gate the list; carry them through the group change.
        setSelectedFilters([...nextGroups, ...toggles]);
    }, [selectedFilters, setSelectedFilters]);

    // Swap the groups for 'all' when both are active, so the "All" chip highlights
    const displayedFilterValue = useMemo((): (EventTypeFilters | 'all')[] => {
        const isAllMode = STATUS_GROUP_KEYS.every((g) => selectedFilters.includes(g));
        if (!isAllMode) return selectedFilters;
        return ['all', ...selectedFilters.filter((f) => TOGGLE_FILTERS.includes(f))];
    }, [selectedFilters]);

    const selectedGroups = useMemo(
        () => selectedFilters.filter((f): f is EventStatusGroup => STATUS_GROUP_KEYS.includes(f as EventStatusGroup)),
        [selectedFilters]
    );

    /** The raw statuses the list should render, expanded from the selected groups. */
    const selectedStatuses = useMemo<EventType['status'][]>(() => {
        const statuses = selectedGroups.flatMap((group) => STATUS_GROUPS[group]);
        return [...new Set(statuses)];
    }, [selectedGroups]);

    const enableTimezone = useMemo(() => selectedFilters.includes('timezone'), [selectedFilters]);

    return {
        filterEnabled,
        setFilterEnabled,
        selectedFilters,
        handleFilterChange,
        displayedFilterValue,
        selectedGroups,
        selectedStatuses,
        actionsEnabled,
        setActionsEnabled,
        toggleActions,
        enableTimezone,
        isInitialized,
    };
}
