import { FC } from 'react'
import { EventType } from '@credopass/lib/schemas';
import {
    MapPin,
    ClockIcon,
    CalendarPlus as CalIcon,
    UserPlus as PeopleIcon,
    QrCode as QRCodeIcon
} from 'lucide-react';
import { Badge } from '@credopass/ui/components/badge';

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

// ─── Perforated ticket divider ────────────────────────────────────────────────
const TicketDivider = () => (
    <div className="relative flex items-center h-0 my-0">
        <div className="absolute -left-5 w-10 h-10 rounded-full bg-[#0a0a0a] z-10" />
        <div className="flex-1 border-t-2 border-dashed border-zinc-700 mx-6" />
        <div className="absolute -right-5 w-10 h-10 rounded-full bg-[#0a0a0a] z-10" />
    </div>
);

export const EventTicket: FC<{ ticketEvent: EventType }> = ({ ticketEvent }) => {

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

    return (
        <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl overflow-visible border border-zinc-800 shadow-2xl shadow-black/70 relative">

                {/* Hero Section */}
                <div className="relative bg-linear-to-br from-[#141414] via-zinc-900 to-[#0d1a04] px-6 pt-6 pb-8 rounded-t-3xl overflow-hidden">
                    {/* Lime glow blobs */}
                    <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#c6f135]/6 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-[#c6f135]/4 rounded-full blur-2xl pointer-events-none" />

                    {/* Header row */}
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <Badge variant={mapStatusToBadgeVariant(ticketEvent.status)}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                            {ticketEvent.status}
                        </Badge>
                        <span className="text-[10px] text-zinc-600 font-mono tracking-widest">{ticketEvent.id?.slice(0, 8).toUpperCase()}</span>
                    </div>

                    {/* Title */}
                    <div className="mb-4 relative z-10">
                        <h1 className="text-[2rem] font-black text-white leading-[0.95] tracking-tight mb-3">
                            {ticketEvent.name}
                        </h1>
                        <p className="text-zinc-500 text-sm">{ticketEvent.description}</p>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 relative z-10">
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
                </div>

                {/* Perforated divider */}
                <div className="relative h-px bg-zinc-800">
                    <TicketDivider />
                </div>

                {/* Ticket stub bottom */}
                <div className="bg-[#111111] px-6 py-5 rounded-b-3xl flex items-center gap-5">
                    {/* QR placeholder */}
                    <div className="bg-white rounded-2xl p-3 shrink-0 shadow-lg shadow-black/40 flex items-center justify-center">
                        <QRCodeIcon size={70} className="text-black" />
                    </div>
                    {/* Ticket info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] mb-1">Event Status</p>
                        <div className="flex items-end gap-1.5 mb-2.5">
                            <span className="text-3xl font-black text-[#c6f135] leading-none capitalize">{ticketEvent.status}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em]">Event ID</p>
                                <p className="text-white font-black font-mono text-sm tracking-wide">#{ticketEvent.id?.slice(0, 12).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}