import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * The four states an event can be in.
 *
 * Not read off the `events` table: there is no `status` column any more. The API
 * derives it from `cancelled_at`, `closed_at`, `start_at` and `end_at` and ships
 * it on every event it returns.
 */
export type DerivedEventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export const EVENTS_FILTER_GROUP_COOKIE_NAME = 'events_filter_group';
export const EVENTS_FILTER_ENABLED_COOKIE_NAME = 'events_filter_enabled';
export const EVENTS_ACTIONS_ENABLED_COOKIE_NAME = 'events_actions_enabled';
export const EVENTS_TIMEZONE_ENABLED_COOKIE_NAME = 'events_timezone_enabled';

/**
 * The list shows one of two groups at a time — a plain Upcoming ⇄ Past switch.
 * This is a grouping in the filtering layer only — rows keep their per-status
 * badge, icon and colour from STATUS_MAPPING, which is deliberately untouched.
 */
export type EventStatusGroup = 'upcoming' | 'past';

/** Order within a group is also the order the list renders its sections in. */
export const STATUS_GROUPS: Record<EventStatusGroup, DerivedEventStatus[]> = {
    upcoming: ['ongoing', 'scheduled'],
    past: ['completed', 'cancelled'],
};

export const STATUS_GROUP_KEYS = Object.keys(STATUS_GROUPS) as EventStatusGroup[];

const DEFAULT_GROUP: EventStatusGroup = 'upcoming';
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
 * Older builds persisted an array of raw statuses (and the pseudo-status
 * 'actions') under a different key. Coerce whatever we find into a single group
 * so upgrading users don't land on an empty list.
 */
export const migrateStoredGroup = (stored: unknown): EventStatusGroup => {
    if (typeof stored === 'string' && STATUS_GROUP_KEYS.includes(stored as EventStatusGroup)) {
        return stored as EventStatusGroup;
    }
    if (Array.isArray(stored)) {
        for (const entry of stored) {
            if (typeof entry !== 'string') continue;
            if (STATUS_GROUP_KEYS.includes(entry as EventStatusGroup)) return entry as EventStatusGroup;
            const group = groupForStatus(entry);
            if (group) return group;
        }
    }
    return DEFAULT_GROUP;
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
    // The list shows exactly one group at a time — a binary Upcoming ⇄ Past switch.
    const [activeGroup, setActiveGroupState] = useState<EventStatusGroup>(DEFAULT_GROUP);
    // Showing the shortcut cards has nothing to do with which events are listed,
    // so it owns its own persisted boolean.
    const [actionsEnabled, setActionsEnabledState] = useState<boolean>(true);
    // Timezone annotation on rows — an independent toggle, not a status filter.
    const [enableTimezone, setEnableTimezoneState] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from IndexedDB on mount
    useEffect(() => {
        const loadFromDB = async () => {
            const [storedEnabled, storedGroup, storedActions, storedTimezone] = await Promise.all([
                getFromDB<boolean>(EVENTS_FILTER_ENABLED_COOKIE_NAME),
                getFromDB<unknown>(EVENTS_FILTER_GROUP_COOKIE_NAME),
                getFromDB<boolean>(EVENTS_ACTIONS_ENABLED_COOKIE_NAME),
                getFromDB<boolean>(EVENTS_TIMEZONE_ENABLED_COOKIE_NAME),
            ]);

            if (storedEnabled !== undefined) setFilterEnabledState(storedEnabled);
            if (storedGroup !== undefined) setActiveGroupState(migrateStoredGroup(storedGroup));
            if (storedActions !== undefined) setActionsEnabledState(storedActions);
            if (storedTimezone !== undefined) setEnableTimezoneState(storedTimezone);
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

    const setActiveGroup = useCallback((group: EventStatusGroup) => {
        setActiveGroupState(group);
        setToDB(EVENTS_FILTER_GROUP_COOKIE_NAME, group);
    }, []);

    const setEnableTimezone = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setEnableTimezoneState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            setToDB(EVENTS_TIMEZONE_ENABLED_COOKIE_NAME, next);
            return next;
        });
    }, []);

    const toggleTimezone = useCallback(() => setEnableTimezone((prev) => !prev), [setEnableTimezone]);

    /** The raw statuses the list should render, expanded from the active group. */
    const selectedStatuses = useMemo<DerivedEventStatus[]>(
        () => STATUS_GROUPS[activeGroup],
        [activeGroup]
    );

    return {
        filterEnabled,
        setFilterEnabled,
        activeGroup,
        setActiveGroup,
        selectedStatuses,
        actionsEnabled,
        setActionsEnabled,
        toggleActions,
        enableTimezone,
        setEnableTimezone,
        toggleTimezone,
        isInitialized,
    };
}
