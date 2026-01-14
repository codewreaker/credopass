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

/**
 * Represents the session state for signing users into an active event
 * This store manages data needed to generate QR codes and handle check-ins
 */
export interface EventSessionState {
    // Active event information
    activeEventId?: string;
    activeEventName?: string;
    activeEventLocation?: string;
    activeEventStatus?: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

    // Current user (event organizer/staff) managing the check-in
    currentUserId?: string;
    currentUserEmail?: string;
    currentUserName?: string;

    // Session/Authentication
    sessionToken?: string; // Auth token for API calls
    qrSessionId?: string; // Unique ID for this QR code session
    qrGeneratedAt?: number; // Timestamp when QR was generated
    qrExpiresAt?: number; // Timestamp when QR expires (typically 5 minutes)

    // Check-in context
    lastCheckInTime?: number; // Track last successful check-in for UI feedback
    checkInCount?: number; // Count of attendees checked in during this session
}

export const useEventSessionStore = create(
    devtools(
        combine({
            session: {
                activeEventId: undefined,
                activeEventName: undefined,
                activeEventLocation: undefined,
                activeEventStatus: undefined,
                currentUserId: undefined,
                currentUserEmail: undefined,
                currentUserName: undefined,
                sessionToken: undefined,
                qrSessionId: undefined,
                qrGeneratedAt: undefined,
                qrExpiresAt: undefined,
                lastCheckInTime: undefined,
                checkInCount: 0,
            } as EventSessionState,
        }, (set, get) => ({
            // Set the active event and associated session
            setActiveEvent: (eventId: string, eventData: {
                name: string;
                location: string;
                status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
            }) => set((state) => ({
                session: {
                    ...state.session,
                    activeEventId: eventId,
                    activeEventName: eventData.name,
                    activeEventLocation: eventData.location,
                    activeEventStatus: eventData.status,
                }
            })),

            // Set current user managing the check-in
            setCurrentUser: (userId: string, userData: {
                email: string;
                firstName: string;
                lastName: string;
            }) => set((state) => ({
                session: {
                    ...state.session,
                    currentUserId: userId,
                    currentUserEmail: userData.email,
                    currentUserName: `${userData.firstName} ${userData.lastName}`,
                }
            })),

            // Initialize session token and QR metadata
            initializeSession: (sessionToken: string) => set((state) => {
                const now = Date.now();
                const qrSessionId = `qr_${state.session.activeEventId}_${now}`;
                return {
                    session: {
                        ...state.session,
                        sessionToken,
                        qrSessionId,
                        qrGeneratedAt: now,
                        qrExpiresAt: now + 5 * 60 * 1000, // 5 minute expiry
                    }
                };
            }),

            // Record a successful check-in
            recordCheckIn: () => set((state) => ({
                session: {
                    ...state.session,
                    lastCheckInTime: Date.now(),
                    checkInCount: (state.session.checkInCount || 0) + 1,
                }
            })),

            // Clear current session
            clearSession: () => set({
                session: {
                    activeEventId: undefined,
                    activeEventName: undefined,
                    activeEventLocation: undefined,
                    activeEventStatus: undefined,
                    currentUserId: undefined,
                    currentUserEmail: undefined,
                    currentUserName: undefined,
                    sessionToken: undefined,
                    qrSessionId: undefined,
                    qrGeneratedAt: undefined,
                    qrExpiresAt: undefined,
                    lastCheckInTime: undefined,
                    checkInCount: 0,
                }
            }),

            // Check if the current QR code is still valid
            isQRValid: () => {
                const state = get().session;
                if (!state.qrExpiresAt) return false;
                return Date.now() < state.qrExpiresAt;
            },
        })),
        { name: 'EventSessionStore' }
    )
);