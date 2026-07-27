// Zustand Based Store to handle App State
import { create } from 'zustand'
import { combine, devtools } from 'zustand/middleware'

type ActionEvents = 'add' | 'delete' | 'update'

export interface ViewedItemState {
    id: string;
    content: any;
}

export const useAppStore = create(
    devtools(
        combine({
            sidebarOpen: { left: true, right: false },
            events: [] as ActionEvents[],
            viewedItem: null as ViewedItemState | null,
        }, (set) => ({
            toggleSidebar: (pos: 'left' | 'right', isOpen?: boolean) => set((state) => ({
                sidebarOpen: {
                    ...state.sidebarOpen,
                    [pos]: isOpen ?? !state.sidebarOpen[pos]
                }
            })),
            setViewedItem: <T extends ViewedItemState>(item: T | null) => set(() => ({ viewedItem: item })),
            addEvent: (eventName: ActionEvents) => set((state) => ({
                events: Array.from(new Set(state.events).add(eventName))
            })),
            removeEvent: (eventName: ActionEvents) => set((state) => {
                const newEvents = new Set(state.events);
                newEvents.delete(eventName);
                return { events: Array.from(newEvents) };
            }),
            hasEvent: (eventName: ActionEvents) =>
                useAppStore.getState().events.includes(eventName)
        })),
        { name: 'AppStore' } // shows in Redux DevTools
    ));

export interface LauncherState {
    isOpen: boolean;
    content: React.ReactElement | null;
    onClose?: () => void;
    onOpen?: () => void;
    launcherRef?: unknown;
}
export const useLauncherStore = create(
    devtools(
        combine({
            launcher: {
                isOpen: false, content: null,
            } as LauncherState,
        }, (set) => ({

            openLauncher: ({
                content,
                onClose,
                onOpen
            }: Omit<LauncherState, 'isOpen'>) => set({
                launcher: { isOpen: true, content, onClose, onOpen }
            }),
            // Simplified: no modalId param needed since we only support one modal at a time
            closeLauncher: () => set({
                launcher: {
                    isOpen: false, content: null, onClose: undefined, onOpen: undefined
                },
            }),
        })),
        { name: 'LauncherStore' } // shows in Redux DevTools
    ));

export { useLauncherStore as useLauncher }

/*
 * Two stores used to live below this line and both are gone.
 *
 * `useEventSessionStore` cached the active event, a QR session id and a
 * per-tab check-in counter — including a hardcoded default user. The kiosk
 * reads `GET /events/{id}` and `GET /events/{id}/checkin-state` now, so two
 * doors agree on the count and nobody's name is compiled in.
 *
 * `useOrganizationStore` held the active organization in localStorage and
 * called `window.location.reload()` on every switch. That moved to
 * `@credopass/api-client`, where the id is part of every org-scoped query key —
 * so switching re-keys the cache instead of reloading the page, and the
 * previous tenant's rows cannot survive the switch.
 */
