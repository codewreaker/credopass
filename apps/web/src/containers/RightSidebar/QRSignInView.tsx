import React, { useMemo } from 'react';
import { QrCodeIcon, AlertCircle, Clock } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useEventSessionStore } from '../../stores/store';
import { API_BASE_URL } from '../../config';

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

export const handleQRScan = () => {
    // TODO: Implement QR code scanner logic on mobile device
    console.log('Scanning QR code...');
};

export const handleManualSignIn = () => {
    // TODO: Implement manual sign-in logic
    console.log('Manual sign-in...');
};

const QRSignInView: React.FC = () => {
    const session = useEventSessionStore((state) => state.session);
    const isQRValid = useEventSessionStore((state) => state.isQRValid());

    // Generate QR code data from current session
    const qrCodeData = useMemo(() => {
        try {
            const params = generateSignInParams(session);
            if (!params) return null;
            // Encode params as JSON string for QR code
            return JSON.stringify(params);
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


    console.log('QRSignInView render - hasValidSession:', session.activeEventId,
        session.currentUserId,
        session.sessionToken,
        session.qrExpiresAt,
        isQRValid);


    // Calculate remaining time until QR expires
    const timeRemaining = useMemo(() => {
        if (!session.qrExpiresAt) return null;
        const remaining = Math.max(0, session.qrExpiresAt - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [session.qrExpiresAt]);

    return (
        <div className="qr-signin-widget flex flex-col items-center justify-center p-6 gap-4">
            <div className="qr-signin-content flex flex-col items-center gap-4 w-full">
                <div className="qr-icon-container">
                    {hasValidSession ? (
                        <div className="qr-code-container bg-white p-4 rounded-lg shadow-md">
                            {qrCodeData ? (
                                <QRCode
                                    value={qrCodeData}
                                    size={256}
                                    level="H"
                                    downloadFileName={`${session.activeEventName}-signin-qr`}
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
                </div>

                <div className="qr-info text-center">
                    <h3 className="text-lg font-semibold mb-2">Event Check-in QR</h3>
                    <p className="qr-description text-sm text-gray-600">
                        {hasValidSession
                            ? `Scan to check in to ${session.activeEventName}`
                            : 'No active event session - select an event to begin'}
                    </p>
                </div>

                {hasValidSession && (
                    <div className="session-info space-y-2 w-full">
                        <div className="text-sm bg-blue-50 p-3 rounded border border-blue-200">
                            <p className="text-blue-900 font-medium">
                                Event: {session.activeEventName}
                            </p>
                            <p className="text-blue-800 text-xs">
                                Location: {session.activeEventLocation}
                            </p>
                        </div>

                        <div className="text-sm bg-green-50 p-3 rounded border border-green-200">
                            <p className="text-green-900">
                                <strong>Staff:</strong> {session.currentUserName}
                            </p>
                            <p className="text-green-800 text-xs">
                                {session.currentUserEmail}
                            </p>
                        </div>

                        <div className="text-sm bg-amber-50 p-3 rounded border border-amber-200 flex items-center gap-2">
                            <Clock size={16} className="text-amber-700" />
                            <div>
                                <p className="text-amber-900 font-medium">
                                    Expires in: {timeRemaining}
                                </p>
                                <p className="text-amber-800 text-xs">
                                    Check-ins: {session.checkInCount || 0}
                                </p>
                            </div>
                        </div>
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
