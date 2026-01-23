// Zustand Based Store to handle App State
import type { DialogRootActions } from '@credopass/ui/components/dialog'
import { create, ExtractState } from 'zustand'
import { combine, devtools } from 'zustand/middleware'
import type { EventType, EventStatus, User, Organization } from '@credopass/lib/schemas'

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
    activeEventDescription?: string | null;
    activeEventLocation?: string;
    activeEventStatus?: EventStatus;
    activeEventStartTime?: Date;
    activeEventEndTime?: Date;
    activeEventCapacity?: number | null;
    activeEventOrganizationId?: string;

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

/**
 * Creates a default event for today with placeholder values
 */
const createDefaultEvent = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
        activeEventId: 'default-today',
        activeEventName: 'Today\'s Event',
        activeEventDescription: 'Default event for today',
        activeEventLocation: 'TBD',
        activeEventStatus: 'scheduled' as EventStatus,
        activeEventStartTime: today,
        activeEventEndTime: tomorrow,
        activeEventCapacity: null,
        activeEventOrganizationId: undefined,
        currentUserId: 'israel.agyeman.prempeh@gmail.com',
        currentUserEmail: 'israel.agyeman.prempeh@gmail.com',
        currentUserName: 'Israel Agyeman-Prempeh'
    };
};

export const useEventSessionStore = create(
    devtools(
        combine({
            session: {
                ...createDefaultEvent(),
                qrSessionId: undefined,
                qrGeneratedAt: undefined,
                qrExpiresAt: undefined,
                lastCheckInTime: undefined,
                checkInCount: 0,
            } as EventSessionState,
        }, (set, get) => ({
            // Set the active event and associated session
            setActiveEvent: (eventId: string, eventData: Partial<EventType>) => set((state) => ({
                session: {
                    ...state.session,
                    activeEventId: eventData.id || eventId,
                    activeEventName: eventData.name,
                    activeEventDescription: eventData.description,
                    activeEventLocation: eventData.location,
                    activeEventStatus: eventData.status,
                    activeEventStartTime: eventData.startTime,
                    activeEventEndTime: eventData.endTime,
                    activeEventCapacity: eventData.capacity,
                    activeEventOrganizationId: eventData.organizationId,
                }
            })),

            // Set current user managing the check-in
            setCurrentUser: (userId: string, userData: Partial<User>) => set((state) => ({
                session: {
                    ...state.session,
                    currentUserId: userId,
                    currentUserEmail: userData.email,
                    currentUserName: userData.firstName && userData.lastName
                        ? `${userData.firstName} ${userData.lastName}`
                        : userData.firstName,
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

            // Clear current session (reset to default event)
            clearSession: () => set({
                session: {
                    ...createDefaultEvent(),
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

/**
 * Organization Store
 * Manages the active organization context for multi-tenant operations
 */
export interface OrganizationState {
    activeOrganizationId: string | null;
    activeOrganization: Organization | null;
}

export const useOrganizationStore = create(
    devtools(
        combine({
            activeOrganizationId: null as string | null,
            activeOrganization: null as Organization | null,
        }, (set) => ({
            setActiveOrganization: (organizationId: string, organization?: Organization) => set({
                activeOrganizationId: organizationId,
                activeOrganization: organization ?? null,
            }),
            clearActiveOrganization: () => set({
                activeOrganizationId: null,
                activeOrganization: null,
            }),
        })),
        { name: 'OrganizationStore' }
    )
);

type UseOrganizationStoreState = ExtractState<typeof useOrganizationStore>;
export type { UseOrganizationStoreState };