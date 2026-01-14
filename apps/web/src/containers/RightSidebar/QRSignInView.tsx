import React, { useMemo } from 'react';
import { QrCodeIcon, AlertCircle } from 'lucide-react';
import {QRCodeSVG as QRCode} from 'qrcode.react';
import { useEventSessionStore } from '../../stores/store';
import { API_BASE_URL } from '../../config';

/**
 * Generates sign-in params for QR code encoding
 * These params will be embedded in the QR code and used to authenticate users when scanned
 */
interface SignInParams {
    type: 'qr_signin';
    sessionToken?: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    timestamp: number;
    expiresAt: number; // Timestamp when QR code expires (5 minutes from generation)
    apiEndpoint: string;
}

/**
 * Generates QR code sign-in parameters from the current session state
 */
const generateSignInParams = (session: any): SignInParams => {
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // QR code expires in 5 minutes

    return {
        type: 'qr_signin',
        sessionToken: session.sessionToken,
        userId: session.userId,
        userEmail: session.userEmail,
        userName: session.userName,
        timestamp: now,
        expiresAt,
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

    // Generate QR code data from current session
    const qrCodeData = useMemo(() => {
        try {
            const params = generateSignInParams(session);
            // Encode params as JSON string for QR code
            return JSON.stringify(params);
        } catch (error) {
            console.error('Failed to generate QR code data:', error);
            return null;
        }
    }, [session]);

    // Check if session has required params for QR code
    const hasValidSession = useMemo(() => {
        return !!(session.sessionToken && session.userId);
    }, [session]);

    return (
        <div className="qr-signin-widget flex flex-col items-center justify-center p-6 gap-4">
            <div className="qr-signin-content flex flex-col items-center gap-4">
                <div className="qr-icon-container">
                    {hasValidSession ? (
                        <div className="qr-code-container bg-white p-4 rounded-lg shadow-md">
                            {qrCodeData ? (
                                <QRCode
                                    value={qrCodeData}
                                    size={256}
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
                </div>

                <div className="qr-info text-center">
                    <h3 className="text-lg font-semibold mb-2">Scan to Sign In</h3>
                    <p className="qr-description text-sm text-gray-600">
                        {hasValidSession
                            ? 'Scan this QR code to securely sign in'
                            : 'No active session - please sign in first'}
                    </p>
                </div>

                {hasValidSession && (
                    <div className="session-info text-sm bg-blue-50 p-3 rounded border border-blue-200 w-full">
                        <p className="text-blue-900">
                            <strong>User:</strong> {session.userEmail || session.userName || 'Unknown'}
                        </p>
                        <p className="text-blue-900 text-xs mt-1">
                            QR code expires in 5 minutes
                        </p>
                    </div>
                )}

                {!hasValidSession && (
                    <div className="no-session-alert flex items-center gap-2 bg-yellow-50 p-3 rounded border border-yellow-200 w-full">
                        <AlertCircle size={18} className="text-yellow-700" />
                        <p className="text-yellow-900 text-sm">
                            Please sign in to generate a QR code
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRSignInView;
