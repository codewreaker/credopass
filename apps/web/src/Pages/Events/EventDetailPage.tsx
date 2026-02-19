import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { Badge, Button, Card, Textarea } from '@credopass/ui';
import {
    ArrowLeft,
    MapPin as PinIcon,
    ClockIcon,
    CalendarPlus as CalIcon,
    UserPlus as PeopleIcon,
    Building2 as OrgIcon,
    QrCode as QRCodeIcon
} from 'lucide-react';
import { useLauncher } from '@credopass/lib/stores';
import { launchEventForm } from '../../containers/EventForm/index';
import { useToolbarContext } from '@credopass/lib/hooks';
import './event-detail.css';


// Helper: Map event status to Badge variant
const mapStatusToBadgeVariant = (status: EventType['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
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

function EventDetailPage() {
    const { eventId } = useParams({ from: '/events/$eventId' });
    const navigate = useNavigate();
    const { openLauncher } = useLauncher();
    const { events: eventCollection } = getCollections();

    const { data: eventsData, isLoading } = useLiveQuery((q) =>
        q.from({ eventCollection })
    );

    const event = useMemo<EventType | undefined>(() => {
        const events = Array.isArray(eventsData) ? eventsData : [];
        return events.find((e) => e.id === eventId);
    }, [eventsData, eventId]);

    const [activeTab, setActiveTab] = useState("details");
    const [noteText, setNoteText] = useState(event?.description || '');
    const [toast, setToast] = useState<string | null>(null);


    // Event detail page: no search, no secondary action
    useToolbarContext({
        action: null,
        search: { enabled: false, placeholder: '' },
    });

    const handleBack = () => {
        navigate({ to: '/events' });
    };

    const handleEdit = () => {
        if (!event) return;
        // startTime and endTime are already Date objects
        const startDate = event.startTime instanceof Date ? event.startTime : undefined;
        const endDate = event.endTime instanceof Date ? event.endTime : undefined;

        launchEventForm(
            {
                initialData: {
                    id: event.id,
                    name: event.name,
                    description: event.description || '',
                    status: event.status,
                    dateTimeRange: {
                        from: startDate,
                        to: endDate,
                    },
                    location: event.location || '',
                    capacity: event.capacity?.toString() || '',
                    organizationId: event.organizationId || '',
                },
                isEditing: true,
            },
            openLauncher
        );
    };

    const handleAddToCalendar = () => {
        if (!event) return;
        // startTime and endTime are already Date objects
        const startDate = event.startTime instanceof Date ? event.startTime : new Date();
        const endDate = event.endTime instanceof Date ? event.endTime : new Date();

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
            `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
            `SUMMARY:${event.name}`,
            `DESCRIPTION:${event.description || ''}`,
            `LOCATION:${event.location || ''}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${event.name.replace(/\s+/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    };

    const handleSaveNotes = () => {
        if (event) {
            // In a real app, this would update the database
            // For now, just show a success message
            showToast("Notes saved ✓");
        }
    };

    if (isLoading) {
        return (
            <div className="event-detail-page loading-state">
                <div className="loading-content">
                    <div className="spinner" />
                    <p className="loading-text">Loading event...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="event-detail-page not-found">
                <div className="not-found-content">
                    <h2>Event Not Found</h2>
                    <p>The event you're looking for doesn't exist or has been removed.</p>
                    <button type="button" className="back-button" onClick={handleBack}>
                        <ArrowLeft size={16} />
                        Back to Events
                    </button>
                </div>
            </div>
        );
    }

    // startTime and endTime are already Date objects from the database
    const startDate = event.startTime instanceof Date ? event.startTime : null;
    const endDate = event.endTime instanceof Date ? event.endTime : null;

    const formattedDate = startDate
        ? startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
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

    const isAddToCalendarDisabled = event.status === 'cancelled';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col max-w-md mx-auto relative" style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>

            {/* Toast */}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#c6f135] text-black text-xs font-black px-6 py-2.5 rounded-full shadow-xl shadow-[#c6f135]/25">
                    {toast}
                </div>
            )}

            {/* ── Top Nav ── */}
            <div className="flex items-center gap-3 px-4 pt-6 pb-4">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft size={16} />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Event Details</p>
                    <p className="text-base font-black text-white truncate leading-tight">{event.name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                </Button>
            </div>

            {/* ── TICKET ── */}
            <div className="mx-4 mb-5">
                <div className="rounded-3xl overflow-visible border border-zinc-800 shadow-2xl shadow-black/70 relative">

                    {/* Hero Section */}
                    <div className="relative bg-linear-to-br from-[#141414] via-zinc-900 to-[#0d1a04] px-6 pt-6 pb-8 rounded-t-3xl overflow-hidden">
                        {/* Lime glow blobs */}
                        <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#c6f135]/6 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-[#c6f135]/4 rounded-full blur-2xl pointer-events-none" />

                        {/* Header row */}
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <Badge variant={mapStatusToBadgeVariant(event.status)}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                                {event.status}
                            </Badge>
                            <span className="text-[10px] text-zinc-600 font-mono tracking-widest">{event.id.slice(0, 8).toUpperCase()}</span>
                        </div>

                        {/* Title */}
                        <div className="mb-7 relative z-10">
                            <h1 className="text-[2.6rem] font-black text-white leading-[0.95] tracking-tight mb-2">
                                {event.name}
                            </h1>
                            <p className="text-zinc-500 text-sm">{event.location}</p>
                        </div>

                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 relative z-10">
                            {[
                                { label: "Date", value: formattedDate, icon: <CalIcon size={12} /> },
                                { label: "Time", value: timeRange, icon: <ClockIcon size={12} /> },
                                { label: "Location", value: event.location, icon: <PinIcon size={12} /> },
                                { label: "Capacity", value: event.capacity ? `${event.capacity} seats` : 'Unlimited', icon: <PeopleIcon size={12} /> },
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
                                <span className="text-3xl font-black text-[#c6f135] leading-none capitalize">{event.status}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] text-zinc-600 uppercase tracking-[0.15em]">Event ID</p>
                                    <p className="text-white font-black font-mono text-sm tracking-wide">#{event.id.slice(0, 12).toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="mx-4 mb-4 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-1 flex gap-1">
                {[
                    { id: "details", label: "Details" },
                    { id: "notes", label: "Notes" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer
              ${activeTab === tab.id
                                ? "bg-[#c6f135] text-black shadow-md shadow-[#c6f135]/20"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        type="button"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 px-4 pb-10">

                {/* DETAILS */}
                {activeTab === "details" && (
                    <div className="space-y-3">
                        <Card className="p-5 space-y-4">
                            <InfoRow icon={<CalIcon size={16} />} label="Date & Time" value={`${formattedDate} · ${timeRange}`} />
                            <div className="h-px bg-zinc-800" />
                            <InfoRow icon={<PinIcon size={16} />} label="Location" value={event.location || 'Not specified'} />
                            <div className="h-px bg-zinc-800" />
                            <InfoRow icon={<PeopleIcon size={16} />} label="Capacity" value={event.capacity ? `${event.capacity} seats` : 'Unlimited'} />
                            <div className="h-px bg-zinc-800" />
                            <InfoRow icon={<OrgIcon size={16} />} label="Organization ID" value={event.organizationId.slice(0, 8)} />
                        </Card>

                        {event.description && (
                            <Card className="p-5">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 font-semibold">About</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{event.description}</p>
                            </Card>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full"
                                onClick={handleAddToCalendar}
                                disabled={isAddToCalendarDisabled}
                            >
                                <CalIcon size={16} className="mr-2" />
                                Add to Calendar
                            </Button>
                            <Button
                                variant="default"
                                size="lg"
                                className="w-full"
                                onClick={handleEdit}
                            >
                                Edit Details
                            </Button>
                        </div>
                    </div>
                )}

                {/* NOTES */}
                {activeTab === "notes" && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Event Notes</p>
                                <span className="text-[10px] text-zinc-600">{noteText?.length || 0} chars</span>
                            </div>
                            <Textarea
                                value={noteText || ''}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add notes, announcements, or any event details..."
                                rows={8}
                            />
                        </div>

                        <Button
                            variant="default"
                            size="lg"
                            className="w-full"
                            onClick={handleSaveNotes}
                        >
                            Save Notes
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Small reusable helpers ───────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[#c6f135] shrink-0">{icon}</div>
        <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
            <p className="text-sm text-white font-semibold">{value}</p>
        </div>
    </div>
);

export default EventDetailPage;
