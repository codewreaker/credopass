import { FC, useState, useRef, useCallback } from 'react'
import { EventType } from '@credopass/lib/schemas';
import {
    MapPin,
    ClockIcon,
    CalendarPlus as CalIcon,
    UserPlus as PeopleIcon,
    Hand,
    Download,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@credopass/ui/components/dialog';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { cn } from '@credopass/ui/lib/utils';
import './EventTicket.css';

// Helper: Map event status to Badge variant
export const mapStatusToBadgeVariant = (status: EventType['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
        case 'completed':
        case 'ongoing':
            return 'default';
        case 'cancelled':
            return 'destructive';
        default:
            return 'secondary';
    }
};

// Gradient SVG placeholder for event image (React Bits style)
const ImagePlaceholder: FC<{ className?: string }> = ({ className }) => (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900", className)}>
        <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 200"
            preserveAspectRatio="xMidYMid slice"
        >
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c6f135" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="#c6f135" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#1a1a1a" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c6f135" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {/* Background gradient shapes */}
            <ellipse cx="350" cy="30" rx="120" ry="80" fill="url(#grad1)" />
            <ellipse cx="50" cy="170" rx="100" ry="60" fill="url(#grad2)" />
            {/* Animated circles */}
            <circle cx="300" cy="100" r="40" fill="#c6f135" fillOpacity="0.03" filter="url(#glow)">
                <animate attributeName="r" values="40;50;40" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="80" r="25" fill="#c6f135" fillOpacity="0.05" filter="url(#glow)">
                <animate attributeName="r" values="25;35;25" dur="3s" repeatCount="indefinite" />
            </circle>
            {/* Grid pattern */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#c6f135" strokeWidth="0.3" strokeOpacity="0.1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Centered icon placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-4 rounded-full bg-zinc-800/50 backdrop-blur-sm">
                <CalIcon size={32} className="text-[#c6f135]/40" />
            </div>
        </div>
    </div>
);

// Expandable Description Component
const ExpandableDescription: FC<{
    description: string;
    maxLines?: number;
    className?: string;
}> = ({ description, maxLines = 2, className }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shouldTruncate = description.length > 120 || description.split('\n').length > maxLines;

    if (!description) return null;

    return (
        <div className={cn("space-y-1", className)}>
            <p className={cn(
                "text-zinc-500 text-sm transition-all duration-300",
                !isExpanded && shouldTruncate && "line-clamp-2"
            )}>
                {description}
            </p>
            {shouldTruncate && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="size-3" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="size-3" />
                            See more
                        </>
                    )}
                </button>
            )}
        </div>
    );
};




// ─── Perforated ticket divider ────────────────────────────────────────────────
const TicketDivider = () => (
    <div className="relative flex items-center h-0 my-0">
        <div className="absolute -left-5 w-10 h-10 rounded-full bg-[#0a0a0a] z-10" />
        <div className="flex-1 border-t-2 border-dashed border-zinc-700 mx-6" />
        <div className="absolute -right-5 w-10 h-10 rounded-full bg-[#0a0a0a] z-10" />
    </div>
);

export const EventTicket: FC<{ 
    ticketEvent: EventType; eventImage?: string, 
    onTicketDownload: (event: EventType) => void,
    onCheckin: () => void;
}> = ({ ticketEvent, eventImage, onTicketDownload, onCheckin }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const ticketRef = useRef<HTMLDivElement>(null);

    const startDate = ticketEvent.startTime instanceof Date ? ticketEvent.startTime : null;
    const endDate = ticketEvent.endTime instanceof Date ? ticketEvent.endTime : null;

    const formattedDate = startDate
        ? startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
        : 'Date not set';
    const startTimeStr = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';
    const endTimeStr = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';
    const timeRange = startTimeStr && endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;

    // Generate QR code data
    const qrData = JSON.stringify({
        eventId: ticketEvent.id,
        checkIn: true,
        timestamp: Date.now()
    });

    // Download ticket as PNG
    const handleDownload = useCallback(async () => {
        if (isDownloading) return;

        setIsDownloading(true);
        try {
            onTicketDownload?.(ticketEvent);
        } catch (error) {
            console.error('Failed to download ticket:', error);
        } finally {
            setIsDownloading(false);
        }
    }, [ticketEvent, onTicketDownload, isDownloading]);

    return (
        <div className="lg:sticky lg:top-6 lg:self-start">
            <div
                ref={ticketRef}
                className="rounded-3xl overflow-visible border border-zinc-800 shadow-2xl shadow-black/70 relative"
            >
                {/* Download button */}
                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={cn(
                        "ticket-download-btn absolute top-4 right-4 z-20 p-2.5 rounded-full",
                        "bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-sm",
                        "transition-all duration-200",
                        isDownloading && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label="Download ticket as image"
                >
                    <Download className={cn("size-4 text-zinc-300", isDownloading && "animate-pulse")} />
                </button>

                {/* Hero Section - Ticket and Status at top */}
                <div className="relative bg-linear-to-br from-[#141414] via-zinc-900 to-[#0d1a04] px-6 pt-6 pb-8 rounded-t-3xl overflow-hidden">
                    {/* Lime glow blobs */}
                    <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#c6f135]/6 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-[#c6f135]/4 rounded-full blur-2xl pointer-events-none" />

                    {/* Header row - Ticket ID and Status at TOP */}
                    <div className="flex justify-between items-start mb-4 relative z-10 pr-10">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-mono tracking-widest">TICKET</span>
                            <span className="text-[10px] text-zinc-600 font-mono tracking-widest">#{ticketEvent.id?.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <Badge variant={mapStatusToBadgeVariant(ticketEvent.status)}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                            {ticketEvent.status}
                        </Badge>
                    </div>

                    {/* Image placeholder or actual image */}
                    {eventImage ? (
                        <img
                            src={eventImage}
                            alt={ticketEvent.name}
                            className="w-full h-40 object-cover rounded-2xl mb-4"
                        />
                    ) : (
                        <ImagePlaceholder className="w-full h-40 mb-4" />
                    )}

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 relative z-10 mb-4">
                        {[
                            { label: "Date", value: formattedDate, icon: <CalIcon size={12} /> },
                            { label: "Time", value: timeRange, icon: <ClockIcon size={12} /> },
                            { label: "Location", value: ticketEvent.location, icon: <MapPin size={12} /> },
                            { label: "Capacity", value: ticketEvent.capacity ? `${ticketEvent.capacity} seats` : 'Unlimited', icon: <PeopleIcon size={12} /> },
                        ].map(({ label, value, icon }) => (
                            <div key={label}>
                                <p className="text-[9px] text-zinc-600 uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1.5">
                                    {icon}{label}
                                </p>
                                <p className="text-white text-sm font-bold">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Title and expandable description at BOTTOM of hero section */}
                    <div className="relative z-10 border-t border-zinc-800 pt-4">
                        <h1 className="text-[1.75rem] font-black text-white leading-[0.95] tracking-tight mb-2">
                            {ticketEvent.name}
                        </h1>
                        <ExpandableDescription
                            description={ticketEvent.description || ''}
                            maxLines={2}
                        />
                    </div>
                </div>

                {/* Perforated divider */}
                <div className="relative h-px bg-zinc-800">
                    <TicketDivider />
                </div>

                {/* Ticket stub bottom - QR Code section */}
                <div className="bg-[#111111] px-6 py-5 rounded-b-3xl">
                    <div className="flex items-center gap-5">
                        {/* Glowing QR Code - tap to expand */}
                        <GlowingQRCode
                            value={qrData}
                            size={70}
                            onClick={onCheckin}
                        />

                        {/* Ticket info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] mb-2">Check-in Code</p>
                            <p className="text-white font-black font-mono text-sm tracking-wide mb-3">
                                #{ticketEvent.id?.slice(0, 12).toUpperCase()}
                            </p>

                            {/* Instructions */}
                            <div className="flex items-center gap-2 text-zinc-500">
                                <Hand size={12} className="animate-bounce" />
                                <p className="text-[10px]">Tap QR code to expand</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
