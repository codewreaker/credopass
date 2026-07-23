import { useParams, useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { Button } from '@credopass/ui/components/button';
import {
    ArrowLeft,
    ScanQrCodeIcon,
    Edit2,
} from 'lucide-react';
import { useToolbarContext } from '@credopass/lib/hooks';
import './event-detail.css';
import { EventTicket } from './EventTicket';
import { EventDetailsReadonly } from './EventDetails';

const handleAddToCalendar = (event: EventType) => {
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

function EventDetailPage() {
    const { eventId } = useParams({ from: '/events/$eventId' });
    const navigate = useNavigate();


    // Event detail page: no search, no secondary action
    const handleCheckinNav = () => navigate({ to: '/checkin/$eventId', params: { eventId } });

    useToolbarContext({
        action: { icon: ScanQrCodeIcon, label: 'Open Check-in', onClick: handleCheckinNav },
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

    const handleCheckin = () => {
        navigate({ to: '/checkin/$eventId', params: { eventId } });
    };

    const handleEdit = () => {
        if (!event) return;
        navigate({ to: '/events/$eventId/edit', params: { eventId } });
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
                    <p>The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                    <Button variant="outline" onClick={handleBack}>
                        <ArrowLeft size={16} />
                        Back to Events
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col w-full mx-auto relative" style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
            {/* Simplified Top Nav - just back button */}
            <div className="flex items-center gap-3 px-4 lg:px-8 pt-6 pb-4 max-w-7xl mx-auto w-full">
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
                    <ArrowLeft size={16} />
                    <span>Back to Events</span>
                </Button>

                <div className="flex-1" />

                <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
                    <Edit2 size={14} />
                    Edit
                </Button>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 px-4 lg:px-8 pb-10 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-8 lg:items-stretch">

                    {/* LEFT: TICKET */}
                    <EventTicket
                        ticketEvent={event}
                        onTicketDownload={handleAddToCalendar}
                        onCheckin={handleCheckin}
                    />

                    {/* RIGHT: map — attached under the ticket on mobile, fills the column on lg+ */}
                    <div className="-mt-5 lg:mt-0 lg:h-full">
                        <EventDetailsReadonly
                            event={event}
                            className="rounded-t-none border-t-0 pt-7 lg:pt-2 lg:rounded-t-xl lg:border-t"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetailPage;
