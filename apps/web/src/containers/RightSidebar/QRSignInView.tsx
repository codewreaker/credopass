import React, { useMemo, useEffect } from 'react';
import { QrCodeIcon, AlertCircle, BadgeCheckIcon } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useEventSessionStore } from '../../stores/store';
import { API_BASE_URL } from '../../config';
import { Item, ItemContent, ItemDescription, ItemMedia } from '@credopass/ui/components/item';
import type { EventType, User } from '@credopass/lib/schemas';

/**
 * Generates sign-in params for QR code encoding
 * These params will be embedded in the QR code and used to authenticate users when scanned
 */
interface SignInParams {
    type: 'qr_event_signin';
    // Event information
    eventId: string;
    eventName: string;
    eventLocation: string;
    // Organizer/Staff information
    staffId: string;
    staffEmail: string;
    staffName: string;
    // Session information
    sessionToken: string;
    qrSessionId: string;
    // Timing
    timestamp: number;
    expiresAt: number;
    apiEndpoint: string;
}

/**
 * Generates QR code sign-in parameters from the current event session state
 */
const generateSignInParams = (session: any): SignInParams | null => {
    // Validate required event and session data
    if (!session.activeEventId || !session.currentUserId || !session.sessionToken) {
        return null;
    }

    return {
        type: 'qr_event_signin',
        eventId: session.activeEventId,
        eventName: session.activeEventName || 'Unknown Event',
        eventLocation: session.activeEventLocation || 'Unknown Location',
        staffId: session.currentUserId,
        staffEmail: session.currentUserEmail || 'Unknown',
        staffName: session.currentUserName || 'Unknown',
        sessionToken: session.sessionToken,
        qrSessionId: session.qrSessionId,
        timestamp: session.qrGeneratedAt || Date.now(),
        expiresAt: session.qrExpiresAt || Date.now() + 5 * 60 * 1000,
        apiEndpoint: API_BASE_URL,
    };
};
/**
 * Generates a shareable URL from sign-in parameters
 */
export const generateSignInUrl = (params: SignInParams): string => {
    const queryString = new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
            acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return acc;
        }, {} as Record<string, string>)
    ).toString();
    
    return `${params.apiEndpoint}/signin?${queryString}`;
};

export const handleQRScan = () => {
    // TODO: Implement QR code scanner logic on mobile device
    console.log('Scanning QR code...');
};

export const handleManualSignIn = () => {
    // TODO: Implement manual sign-in logic
    console.log('Manual sign-in...');
};

/**
 * Mock data for demonstration - replace with actual API calls later
 */
const mockEventData: Partial<EventType> = {
    id: 'event-001',
    name: 'Community Gathering',
    description: 'A community event for networking and engagement',
    location: 'Community Center, Main Hall',
    status: 'ongoing',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
    capacity: 500,
    hostId: 'host-001',
};

const mockUserData: Partial<User> = {
    id: 'user-001',
    email: 'staff@example.com',
    firstName: 'John',
    lastName: 'Doe',
};

const mockSessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

const QRSignInView: React.FC = () => {
    const session = useEventSessionStore((state) => state.session);
    const isQRValid = useEventSessionStore((state) => state.isQRValid());
    const setActiveEvent = useEventSessionStore((state) => state.setActiveEvent);
    const setCurrentUser = useEventSessionStore((state) => state.setCurrentUser);
    const initializeSession = useEventSessionStore((state) => state.initializeSession);

    /**
     * Initialize the complete session using all store functions
     */
    const initializeCompleteSession = () => {
        try {
            // Step 1: Set the active event
            setActiveEvent(mockEventData.id || '', mockEventData);
            console.log('✓ Active event set:', mockEventData.name);

            // Step 2: Set the current user (event organizer/staff)
            setCurrentUser(mockUserData.id || '', mockUserData);
            console.log('✓ Current user set:', `${mockUserData.firstName} ${mockUserData.lastName}`);

            // Step 3: Initialize the session token and QR metadata
            initializeSession(mockSessionToken);
            console.log('✓ Session initialized with token');

            console.log('✓ Complete session initialized successfully');
        } catch (error) {
            console.error('✗ Failed to initialize session:', error);
        }
    };

    // Auto-initialize session when component mounts
    useEffect(() => {
        initializeCompleteSession();
    }, []);

    // Generate QR code data from current session
    const qrCodeData = useMemo(() => {
        try {
            const params = generateSignInParams(session);
            if (!params) return null;
            // Encode params as JSON string for QR code
            return generateSignInUrl(params);
        } catch (error) {
            console.error('Failed to generate QR code data:', error);
            return null;
        }
    }, [session]);

    // Check if session has required params for QR code
    const hasValidSession = useMemo(() => {
        return !!(
            session.activeEventId &&
            session.currentUserId &&
            session.sessionToken &&
            isQRValid
        );
    }, [session, isQRValid]);


    console.log('QRSignInView render - hasValidSession:', qrCodeData);


    // Calculate remaining time until QR expires
    const timeRemaining = useMemo(() => {
        if (!session.qrExpiresAt) return null;
        const remaining = Math.max(0, session.qrExpiresAt - (new Date().getTime()));
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [session.qrExpiresAt]);

    return (
        <div className="flex flex-col items-center justify-center p-6 gap-4">
            <div className="flex flex-col items-center gap-4 w-full">
                <>
                    {hasValidSession ? (
                        <div className="qr-code-container bg-white p-4 rounded-lg shadow-md">
                            {qrCodeData ? (
                                <QRCode
                                    value={qrCodeData}
                                    size={220}
                                    level="H"

                                />
                            ) : (
                                <div className="flex items-center justify-center w-64 h-64 bg-gray-100 rounded">
                                    <span className="text-gray-500">Error generating QR code</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center w-64 h-64 bg-gray-100 rounded">
                            <QrCodeIcon size={64} className="text-gray-400" />
                        </div>
                    )}
                </>

                <div className="qr-info text-center">
                    <h3 className="text-lg font-semibold mb-2">Event Check-in QR</h3>
                    <p className="qr-description text-sm text-gray-600">
                        {hasValidSession
                            ? `Scan to check in to ${session.activeEventName}`
                            : 'Initialize the session to generate QR code'}
                    </p>
                </div>

                {hasValidSession && (
                    <div className="session-info space-y-2 w-full">
                        {[
                            { title: 'Event', value: session.activeEventName || 'Unknown' },
                            { title: 'Location', value: session.activeEventLocation || 'Unknown' },
                            { title: 'Staff', value: session.currentUserName || 'Unknown' },
                            { title: 'Email', value: session.currentUserEmail || 'Unknown' },
                            { title: 'Expires In', value: timeRemaining || '-' },
                            { title: 'Check-ins', value: session.checkInCount || 0 },
                        ].map((item, index) => (
                            <Item key={index} variant="outline" size="sm">
                                <ItemMedia variant="icon">
                                    <BadgeCheckIcon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemDescription><p className='inline mr-2 font-extrabold text-accent-foreground'>{item.title}</p>{item.value}</ItemDescription>
                                </ItemContent>
                            </Item>
                        ))}
                    </div>
                )}

                {!hasValidSession && (
                    <div className="no-session-alert flex items-center gap-2 bg-yellow-50 p-3 rounded border border-yellow-200 w-full">
                        <AlertCircle size={18} className="text-yellow-700" />
                        <p className="text-yellow-900 text-sm">
                            {!session.activeEventId
                                ? 'Select an event to begin check-ins'
                                : !session.currentUserId
                                    ? 'Organizer info required'
                                    : 'Session expired - refresh to continue'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRSignInView;
