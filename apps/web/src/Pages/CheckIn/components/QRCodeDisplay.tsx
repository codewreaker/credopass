import React from 'react';
import { QrCodeIcon, Clock, RefreshCw, UserPlus } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import {
    Button,
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@credopass/ui';

interface QRCodeDisplayProps {
    qrCodeData: string | null;
    hasValidSession: boolean;
    timeRemaining: string | null;
    onRefreshQR: () => void;
    onManualCheckInClick: () => void;
    children?: React.ReactNode;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
    qrCodeData,
    hasValidSession,
    timeRemaining,
    onRefreshQR,
    onManualCheckInClick,
    children
}) => {
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <QrCodeIcon className="w-5 h-5 text-primary" />
                        QR Code Check-In
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefreshQR}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
                {timeRemaining && (
                    <CardDescription className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Expires in <span className="font-mono font-semibold">{timeRemaining}</span>
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
                {hasValidSession && qrCodeData ? (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border">
                        <QRCode
                            value={qrCodeData}
                            size={220}
                            level="H"
                        />
                    </div>
                ) : (
                    <div className="w-64 h-64 bg-muted rounded-2xl flex flex-col items-center justify-center gap-4">
                        <QrCodeIcon className="w-16 h-16 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground text-center px-4">
                            QR code expired or not generated
                        </p>
                        <Button variant="outline" size="sm" onClick={onRefreshQR}>
                            Generate New Code
                        </Button>
                    </div>
                )}
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Attendees can scan this code with their phone to check in instantly
                </p>
                <div className="w-full">
                    {children}
                </div>
            </CardContent>
            <CardFooter className='justify-center'>
                <CardAction>
                    <Button
                        onClick={onManualCheckInClick}
                        className="w-full gap-2"
                        size="lg"
                    >
                        <UserPlus className="w-4 h-4" />
                        {'Manual Check-In'}
                    </Button>
                </CardAction>
            </CardFooter>
        </Card>
    );
};

export default QRCodeDisplay;
