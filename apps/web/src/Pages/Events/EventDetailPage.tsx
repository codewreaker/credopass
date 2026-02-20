import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { Badge, Button, Card, Textarea, Input, Label, DateTimeRangePicker } from '@credopass/ui';
import {
    ArrowLeft,
    CalendarPlus as CalIcon,
    ScanQrCodeIcon,
    X as CloseIcon,
    Check as CheckIcon
} from 'lucide-react';
import { useToolbarContext } from '@credopass/lib/hooks';
import './event-detail.css';
import { EventTicket, mapStatusToBadgeVariant } from './EventTicket';



function EventDetailPage() {
    const [draftData, setDraftData] = useState<Partial<EventType>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const { eventId } = useParams({ from: '/events/$eventId' });
    const navigate = useNavigate();

    // Event detail page: no search, no secondary action
    useToolbarContext({
        action: { icon: ScanQrCodeIcon, label: 'Scan Qr Code', onClick: () => console.log("LAUNCH SCANNER") },
        search: { enabled: false, placeholder: '' },
    });

    const { events: eventCollection } = getCollections();
    const { data: event, isLoading } = useLiveQuery((q) =>
        q.from({ eventCollection })
            .where(({ eventCollection }) => eq(eventCollection.id, eventId))
            .findOne()
    );


    const handleBack = () => {
        navigate({ to: '/events' });
    };

    const handleEdit = () => {
        if (!event) return;
        const startDate = event.startTime instanceof Date ? event.startTime : undefined;
        const endDate = event.endTime instanceof Date ? event.endTime : undefined;
        
        setDraftData({
            id: event.id,
            name: event.name,
            description: event.description || '',
            status: event.status,
            startTime: startDate,
            endTime: endDate,
            location: event.location || '',
            capacity: event.capacity,
            organizationId: event.organizationId || '',
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setDraftData({});
    };

    const handleSave = async () => {
        if (!event || !draftData) return;
        
        try {
            // TODO: Update event in database
            // await eventCollection.update(event.id, draftData);
            
            showToast("Event updated ✓");
            setIsEditing(false);
        } catch (error) {
            showToast("Error saving event");
            console.error(error);
        }
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

    const updateField = (field: keyof EventType, value: any) => {
        setDraftData(prev => ({ ...prev, [field]: value }));
    };

    const updateDateTimeRange = (range: { from?: Date; to?: Date } | undefined) => {
        setDraftData(prev => ({
            ...prev,
            startTime: range?.from,
            endTime: range?.to,
        }));
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
    const displayEvent = isEditing ? { ...event, ...draftData } : event;


    const isAddToCalendarDisabled = event.status === 'cancelled';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col w-full mx-auto relative" style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>

            {/* Toast */}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#c6f135] text-black text-xs font-black px-6 py-2.5 rounded-full shadow-xl shadow-[#c6f135]/25">
                    {toast}
                </div>
            )}

            {/* ── Top Nav ── */}
            <div className="flex items-center gap-3 px-4 lg:px-8 pt-6 pb-4 max-w-7xl mx-auto w-full">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft size={16} />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Event Details</p>
                    <p className="text-base font-black text-white truncate leading-tight">{displayEvent.name}</p>
                </div>
                {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                    </Button>
                ) : (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCancel}>
                            <CloseIcon size={14} />
                            Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave}>
                            <CheckIcon size={14} />
                            Save
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Main Content Grid ── */}
            <div className="flex-1 px-4 lg:px-8 pb-10 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                    {/* LEFT: TICKET */}
                    <EventTicket ticketEvent={displayEvent}/>

                    {/* RIGHT: Info & Form */}
                    <div className="space-y-4">
                        {!isEditing ? (
                            /* ──── READONLY VIEW ──── */
                            <>
                                {/* Event Description */}
                                <Card className="p-5">
                                    <div>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3">About Event</p>
                                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                                            {displayEvent.description || 'No description provided.'}
                                        </p>
                                    </div>
                                </Card>

                                {/* Event Details */}
                                <Card className="p-5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-4">Event Information</p>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Event Name</p>
                                            <p className="text-white font-semibold">{displayEvent.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Location</p>
                                            <p className="text-white font-semibold">{displayEvent.location || 'Not specified'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Capacity</p>
                                                <p className="text-white font-semibold">{displayEvent.capacity || 'Unlimited'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Status</p>
                                                <Badge variant={mapStatusToBadgeVariant(displayEvent.status)} className="capitalize">
                                                    {displayEvent.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Action Buttons */}
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
                            </>
                        ) : (
                            /* ──── EDIT VIEW ──── */
                            <>
                                <Card className="p-5">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-4">Edit Event</p>
                                    <div className="space-y-5">
                                        {/* Event Name */}
                                        <div className="space-y-2">
                                            <Label htmlFor="event-name" className="text-xs text-zinc-400 uppercase tracking-wider">
                                                Event Name
                                            </Label>
                                            <Input
                                                id="event-name"
                                                value={draftData.name || ''}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                placeholder="Enter event name"
                                                className="bg-zinc-900/50"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="space-y-2">
                                            <Label htmlFor="event-description" className="text-xs text-zinc-400 uppercase tracking-wider">
                                                Description
                                            </Label>
                                            <Textarea
                                                id="event-description"
                                                value={draftData.description || ''}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                placeholder="Enter event description"
                                                rows={6}
                                                className="bg-zinc-900/50"
                                            />
                                        </div>

                                        {/* Date & Time */}
                                        <div className="space-y-2">
                                            <Label htmlFor="event-datetime" className="text-xs text-zinc-400 uppercase tracking-wider">
                                                Date & Time
                                            </Label>
                                            <DateTimeRangePicker
                                                id="event-datetime"
                                                value={{
                                                    from: draftData.startTime,
                                                    to: draftData.endTime,
                                                }}
                                                onChange={updateDateTimeRange}
                                                className="bg-zinc-900/50"
                                            />
                                        </div>

                                        {/* Location */}
                                        <div className="space-y-2">
                                            <Label htmlFor="event-location" className="text-xs text-zinc-400 uppercase tracking-wider">
                                                Location
                                            </Label>
                                            <Input
                                                id="event-location"
                                                value={draftData.location || ''}
                                                onChange={(e) => updateField('location', e.target.value)}
                                                placeholder="Enter event location"
                                                className="bg-zinc-900/50"
                                            />
                                        </div>

                                        {/* Capacity */}
                                        <div className="space-y-2">
                                            <Label htmlFor="event-capacity" className="text-xs text-zinc-400 uppercase tracking-wider">
                                                Capacity
                                            </Label>
                                            <Input
                                                id="event-capacity"
                                                type="number"
                                                value={draftData.capacity || ''}
                                                onChange={(e) => updateField('capacity', parseInt(e.target.value) || undefined)}
                                                placeholder="Enter max capacity"
                                                className="bg-zinc-900/50"
                                            />
                                        </div>
                                    </div>
                                </Card>

                                {/* Save/Cancel Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="w-full"
                                        onClick={handleCancel}
                                    >
                                        <CloseIcon size={16} className="mr-2" />
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="lg"
                                        className="w-full"
                                        onClick={handleSave}
                                    >
                                        <CheckIcon size={16} className="mr-2" />
                                        Save Changes
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetailPage;
