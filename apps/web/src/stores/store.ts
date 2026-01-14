// Zustand Based Store to handle App State
import type { DialogRootActions } from '@credopass/ui/components/dialog'
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
            setViewedItem: <T>(item: T) => set(() => ({ viewedItem: item })),
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
    launcherRef?: React.RefObject<DialogRootActions> | unknown;
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