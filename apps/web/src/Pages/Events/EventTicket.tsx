import { FC, useState, useRef, useCallback } from 'react'
import { EventType } from '@credopass/lib/schemas';
import {
    MapPin,
    UserPlus as PeopleIcon,
    Download,
    ChevronDown,
    ChevronUp,
    ScanLine
} from 'lucide-react';
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

// Placeholder image: brand SVG rendered as a translucent silhouette mask
const ImagePlaceholder: FC<{ className?: string }> = ({ className }) => (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted/40 border border-border", className)}>
        <div
            aria-hidden
            className="absolute inset-4 bg-primary/25"
            style={{
                content: 'url(/empty-state-two.svg)',
                WebkitMaskImage: 'url(/empty-state-two.svg)',
                maskImage: 'url(/empty-state-two.svg)',
            }}
        />
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
                "text-muted-foreground text-sm transition-all duration-300",
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
        <div className="absolute -left-5 w-10 h-10 rounded-full bg-background z-10" />
        <div className="flex-1 border-t-2 border-dashed border-border-strong mx-6" />
        <div className="absolute -right-5 w-10 h-10 rounded-full bg-background z-10" />
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

    const fmtTimelinePoint = (d: Date | null) =>
        d
            ? {
                date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            }
            : null;
    const startPoint = fmtTimelinePoint(startDate);
    const endPoint = fmtTimelinePoint(endDate);

    return (
        <div className="lg:sticky lg:top-6 lg:self-start">
            <div
                ref={ticketRef}
                className="rounded-3xl overflow-visible shadow-2xl shadow-black/70 relative"
            >
                {/* ── Hero section ── */}
                <div className="relative bg-linear-to-br from-card via-secondary to-primary/10 border border-b-0 border-border px-6 pt-6 pb-7 rounded-t-3xl overflow-hidden">
                    <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full border-[18px] border-primary/6" />

                    {/* Header row: ticket id + status + download */}
                    <div className="flex justify-between items-center mb-5 relative z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-muted-foreground">TICKET</span>
                            <span className="text-[10px] font-mono tracking-widest text-muted-foreground/60">#{ticketEvent.id?.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                                <span className="size-1.5 rounded-full bg-primary" />
                                {ticketEvent.status}
                            </span>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className={cn(
                                    "ticket-download-btn flex size-8 items-center justify-center rounded-full",
                                    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 cursor-pointer",
                                    isDownloading && "opacity-50 cursor-not-allowed"
                                )}
                                aria-label="Download ticket as calendar file"
                            >
                                <Download className={cn("size-3.5", isDownloading && "animate-pulse")} />
                            </button>
                        </div>
                    </div>

                    {/* Event name */}
                    <h1 className="relative z-10 text-[1.9rem] font-black text-foreground leading-[0.98] tracking-tight mb-4">
                        {ticketEvent.name}
                    </h1>

                    {/* Image */}
                    {eventImage ? (
                        <img
                            src={eventImage}
                            alt={ticketEvent.name}
                            className="relative z-10 w-full h-36 object-cover rounded-2xl"
                        />
                    ) : (
                        <ImagePlaceholder className="relative z-10 w-full h-36" />
                    )}
                </div>

                {/* Perforated divider */}
                <div className="relative h-px bg-muted">
                    <TicketDivider />
                </div>

                {/* ── Dark stub: route timeline + meta + QR + CTA ── */}
                <div className="bg-card border border-t-0 border-border px-6 py-5 rounded-b-3xl">
                    {/* Route-style timeline: start → end */}
                    <div className="flex gap-3.5 mb-5">
                        <div className="flex flex-col items-center pt-1.5">
                            <span className="size-2.5 rounded-full bg-primary shrink-0" />
                            <span className="flex-1 w-px border-l-2 border-dashed border-border-strong my-1.5" />
                            <span className="size-2.5 rounded-full border-2 border-primary bg-transparent shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                            <div>
                                <p className="text-[9px] text-muted-foreground/70 uppercase tracking-[0.16em] mb-0.5">Doors open</p>
                                <p className="text-sm font-bold text-foreground tabular-nums">
                                    {startPoint ? `${startPoint.date} · ${startPoint.time}` : 'Date not set'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] text-muted-foreground/70 uppercase tracking-[0.16em] mb-0.5">Wraps up</p>
                                <p className="text-sm font-bold text-foreground tabular-nums">
                                    {endPoint ? `${endPoint.date} · ${endPoint.time}` : 'Open ended'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2 mb-5">
                        {ticketEvent.location && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground min-w-0">
                                <MapPin size={11} className="shrink-0 text-primary" />
                                <span className="truncate max-w-52">{ticketEvent.location}</span>
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            <PeopleIcon size={11} className="text-primary" />
                            {ticketEvent.capacity ? `${ticketEvent.capacity} seats` : 'Unlimited'}
                        </span>
                    </div>

                    {/* Description */}
                    {ticketEvent.description && (
                        <ExpandableDescription
                            description={ticketEvent.description}
                            maxLines={2}
                            className="mb-5"
                        />
                    )}

                    {/* QR + check-in CTA */}
                    <div className="flex items-center gap-4 pt-4 border-t border-dashed border-border-strong">
                        <GlowingQRCode
                            value={qrData}
                            size={64}
                            onClick={onCheckin}
                            ariaLabel="Open check-in kiosk"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-muted-foreground/70 uppercase tracking-[0.15em] mb-1">Check-in code</p>
                            <p className="text-foreground font-black font-mono text-sm tracking-wide mb-3 truncate">
                                #{ticketEvent.id?.slice(0, 12).toUpperCase()}
                            </p>
                            <button
                                type="button"
                                onClick={onCheckin}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-primary text-primary-foreground px-4 h-9 text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_16px_-4px] shadow-primary/40"
                            >
                                <ScanLine size={14} />
                                Open check-in
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
