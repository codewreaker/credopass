import React from 'react';
import { QrCodeIcon, Clock, RefreshCw, UserPlus } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Button } from '@credopass/ui/components/button';

interface QRCodeDisplayProps {
    qrCodeData: string | null;
    hasValidSession: boolean;
    timeRemaining: string | null;
    onRefreshQR: () => void;
    onManualCheckInClick: () => void;
    size?: number;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
    qrCodeData,
    hasValidSession,
    timeRemaining,
    onRefreshQR,
    onManualCheckInClick,
    size = 256,
}) => {
    return (
        <div className="qr-display">
            {/* Title bar -- Luma: "Scan to Check In" centered */}
            <div className="qr-display-header">
                <h2 className="qr-display-title">Scan to Check In</h2>
                {timeRemaining && (
                    <div className="qr-display-timer">
                        <Clock size={12} />
                        <span className="font-mono">{timeRemaining}</span>
                    </div>
                )}
            </div>

            {/* QR Code area */}
            <div className="qr-display-body">
                {hasValidSession && qrCodeData ? (
                    <div className="qr-code-container">
                        <div className="qr-code-inner">
                            <QRCode
                                value={qrCodeData}
                                size={size}
                                level="H"
                                bgColor="#ffffff"
                                fgColor="#000000"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="qr-code-expired">
                        <QrCodeIcon size={48} />
                        <p>QR code expired</p>
                        <Button variant="outline" size="sm" onClick={onRefreshQR}>
                            Generate New Code
                        </Button>
                    </div>
                )}

                <p className="qr-display-hint">
                    Attendees scan this code with their phone to check in
                </p>
            </div>

            {/* Action buttons -- Luma: prominent row at bottom */}
            <div className="qr-display-actions">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefreshQR}
                    className="gap-1.5"
                >
                    <RefreshCw size={14} />
                    Refresh
                </Button>
                <Button
                    onClick={onManualCheckInClick}
                    size="default"
                    className="gap-1.5 flex-1"
                >
                    <UserPlus size={14} />
                    Manual Check-In
                </Button>
            </div>
        </div>
    );
};

export default QRCodeDisplay;
