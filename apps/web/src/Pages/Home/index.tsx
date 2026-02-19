import { useMemo, useCallback } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import Analytics from '../Analytics/index';
import Tables from '../Tables';
import { useEventSessionStore } from '@credopass/lib/stores';
import {
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import './home.css';
import { getGreeting } from '../../lib/utils';
import ActionCards from '../../containers/ActionCards';



/** Upcoming event card -- mini version of Luma's event card */
function UpcomingEventCard({ event }: { event: EventType }) {
  const startDate = event.startTime ? new Date(event.startTime) : null;
  const month = startDate?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() || '';
  const day = startDate?.getDate() || '';
  const timeStr = startDate?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) || '';

  return (
    <div className="upcoming-event-card">
      <div className="upcoming-event-date">
        <span className="upcoming-event-month">{month}</span>
        <span className="upcoming-event-day">{day}</span>
      </div>
      <div className="upcoming-event-info">
        <span className="upcoming-event-name">{event.name}</span>
        <div className="upcoming-event-meta">
          {timeStr && (
            <span className="upcoming-event-meta-item">
              <Clock size={11} />
              {timeStr}
            </span>
          )}
          {event.location && (
            <span className="upcoming-event-meta-item">
              <MapPin size={11} />
              {event.location}
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={14} className="upcoming-event-arrow" />
    </div>
  );
}

export default function HomePage() {
  const userName = useEventSessionStore((s) => s.session.currentUserName);
  const firstName = useMemo(() => userName?.split(' ')[0] || 'there', [userName]);
  const greeting = useMemo(() => getGreeting(), []);
  const navigate = useNavigate();

  // Dashboard: settings button, no search
  const handleOpenSettings = useCallback(() => {
    navigate({ to: '/organizations' });
  }, [navigate]);

  useToolbarContext({
    action: { icon: Settings, label: 'Settings', onClick: handleOpenSettings },
    search: { enabled: false, placeholder: '' },
  });

  const { events: eventCollection } = getCollections();
  const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
  const events = useMemo<EventType[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);

  // Get upcoming events (next 3 sorted by start time)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.startTime && new Date(e.startTime) >= now && e.status !== 'cancelled')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3);
  }, [events]);



  return (
    <div className="home-page">
      {/* Greeting */}
      <div className="home-greeting">
        <h1 className="home-greeting-title">
          {greeting}, {firstName}
        </h1>
        <p className="home-greeting-subtitle">
          {"Here\u2019s what\u2019s happening with your events."}
        </p>
      </div>

     <ActionCards/>

      {/* Upcoming events -- Luma "When & Where" section style */}
      {upcomingEvents.length > 0 && (
        <div className="home-upcoming">
          <div className="home-section-header">
            <Calendar size={14} className="text-muted-foreground" />
            <h2 className="home-section-title">Upcoming Events</h2>
          </div>
          <div className="home-upcoming-list">
            {upcomingEvents.map((event) => (
              <UpcomingEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Analytics grid */}
      <Analytics />

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Recent data tables */}
      <Tables />
    </div>
  );
}
