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
import { useLauncher } from '@credopass/lib/stores';
import { EventTicket } from './EventTicket';
import { EventDetailsReadonly } from './EventDetails';
import { launchEventForm } from '../../containers/EventForm';

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
    const { openLauncher } = useLauncher();


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

    const handleCheckin = () => {
        navigate({ to: '/checkin/$eventId', params: { eventId } });
    };

    const handleEdit = () => {
        if (!event) return;
        const startDate = event.startTime instanceof Date ? event.startTime : undefined;
        const endDate = event.endTime instanceof Date ? event.endTime : undefined;

        // Launch the shared EventForm via command launcher
        launchEventForm({
            initialData: {
                id: event.id,
                name: event.name,
                description: event.description || '',
                status: event.status,
                dateTimeRange: { from: startDate, to: endDate },
                location: event.location || '',
                capacity: event.capacity?.toString() || '',
                organizationId: event.organizationId || '',
            },
            isEditing: true,
        }, openLauncher);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-40 gap-4">
                <div className="w-7 h-7 rounded-full border-2 border-border border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading event…</p>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-60 gap-4 text-center">
                <p className="text-base font-medium">Event Not Found</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                    The event you&apos;re looking for doesn&apos;t exist or has been removed.
                </p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                    <ArrowLeft size={14} />
                    Back to Events
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col w-full mx-auto relative">
            {/* Simplified Top Nav - just back button */}
            <div className="flex items-center gap-3 px-4 lg:px-8 pt-6 pb-4 max-w-6xl mx-auto w-full">
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 text-muted-foreground hover:text-foreground">
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
            <div className="flex-1 px-4 lg:px-8 pb-10 max-w-6xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 lg:mt-4">

                    {/* LEFT: TICKET */}
                    <EventTicket
                        ticketEvent={event}
                        onTicketDownload={handleAddToCalendar}
                        onCheckin={handleCheckin}
                    />

                    {/* RIGHT: Info */}
                    <div className="space-y-4">
                        <EventDetailsReadonly event={event} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetailPage;
