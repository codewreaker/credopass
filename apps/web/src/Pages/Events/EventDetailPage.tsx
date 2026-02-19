import React, { useMemo } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { Badge } from '@credopass/ui';
import {
    ArrowLeft,
    MapPin,
    Clock,
    Users,
    CalendarPlus,
    QrCode,
    UserPlus,
    Edit,
    Settings,
} from 'lucide-react';
import { useLauncher } from '@credopass/lib/stores';
import { launchEventForm } from '../../containers/EventForm/index';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import './event-detail.css';

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    scheduled: 'bg-primary/10 text-primary border-primary/30',
    ongoing: 'bg-green-500/10 text-green-500 border-green-500/30',
    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const EventDetailPage: React.FC = () => {
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
        const startDate = event.startTime ? new Date(event.startTime) : undefined;
        const endDate = event.endTime ? new Date(event.endTime) : undefined;

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

    const handleRegister = () => {
        // TODO: Implement registration logic
        console.log('Register clicked for event:', eventId);
    };

    const handleAddToCalendar = () => {
        if (!event) return;
        // Generate ICS file or open calendar
        const startDate = event.startTime ? new Date(event.startTime) : new Date();
        const endDate = event.endTime ? new Date(event.endTime) : new Date();

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

    const handleCheckin = () => {
        navigate({ to: '/checkin/$eventId', params: { eventId } });
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

    const startDate = event.startTime ? new Date(event.startTime) : null;
    const endDate = event.endTime ? new Date(event.endTime) : null;

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

    // Determine button states based on event status
    // Always show all buttons but disable based on logic
    const isRegisterDisabled = event.status === 'completed' || event.status === 'cancelled';
    const isCheckinDisabled = event.status === 'completed' || event.status === 'cancelled';
    const isAddToCalendarDisabled = event.status === 'cancelled';

    return (
        <div className="event-detail-page">
            {/* Header with back button */}
            <div className="event-detail-header">
                <button type="button" className="back-button" onClick={handleBack}>
                    <ArrowLeft size={18} />
                    <span>Back to Events</span>
                </button>
                <div className="header-actions">
                    <button type="button" className="edit-button" onClick={handleEdit}>
                        <Edit size={16} />
                        <span>Edit</span>
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="event-detail-content">
                {/* Event title and status */}
                <div className="event-title-section">
                    <h1 className="event-title">{event.name}</h1>
                    <Badge
                        variant="outline"
                        className={`event-status-badge ${STATUS_STYLES[event.status] || ''}`}
                    >
                        {event.status}
                    </Badge>
                </div>

                {/* Event description */}
                {event.description && (
                    <p className="event-description">{event.description}</p>
                )}

                {/* Event info cards */}
                <div className="event-info-grid">
                    {/* Date & Time Card */}
                    <div className="info-card">
                        <div className="info-card-icon">
                            <Clock size={20} />
                        </div>
                        <div className="info-card-content">
                            <span className="info-card-label">Date & Time</span>
                            <span className="info-card-value">{formattedDate}</span>
                            {timeRange && <span className="info-card-sub">{timeRange}</span>}
                        </div>
                    </div>

                    {/* Capacity Card */}
                    <div className="info-card">
                        <div className="info-card-icon">
                            <Users size={20} />
                        </div>
                        <div className="info-card-content">
                            <span className="info-card-label">Capacity</span>
                            <span className="info-card-value">
                                {event.capacity ? `${event.capacity} attendees` : 'Unlimited'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Location Section with Map */}
                {event.location && (
                    <div className="location-section">
                        <div className="location-header">
                            <MapPin size={20} />
                            <div className="location-info">
                                <span className="location-label">Location</span>
                                <span className="location-value">{event.location}</span>
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="map-placeholder">
                            <div className="map-overlay">
                                <MapPin size={32} className="map-pin-icon" />
                                <span className="map-text">Map View</span>
                                <span className="map-subtext">
                                    Interactive map coming soon
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Check-in Methods */}
                {event.checkInMethods && event.checkInMethods.length > 0 && (
                    <div className="checkin-methods-section">
                        <div className="section-header">
                            <Settings size={18} />
                            <span>Check-in Methods</span>
                        </div>
                        <div className="checkin-methods">
                            {event.checkInMethods.map((method) => (
                                <span key={method} className="checkin-method-badge">
                                    {method === 'qr' && 'QR Code'}
                                    {method === 'manual' && 'Manual Entry'}
                                    {method === 'external_auth' && 'External Auth'}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="event-actions">
                    <button
                        type="button"
                        className="action-button register-button"
                        onClick={handleRegister}
                        disabled={isRegisterDisabled}
                    >
                        <UserPlus size={18} />
                        <span>Register</span>
                    </button>

                    <button
                        type="button"
                        className="action-button calendar-button"
                        onClick={handleAddToCalendar}
                        disabled={isAddToCalendarDisabled}
                    >
                        <CalendarPlus size={18} />
                        <span>Add to Calendar</span>
                    </button>

                    <button
                        type="button"
                        className="action-button checkin-button"
                        onClick={handleCheckin}
                        disabled={isCheckinDisabled}
                    >
                        <QrCode size={18} />
                        <span>Check In</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventDetailPage;
