import { useMemo, useCallback } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '../../lib/tanstack-db';
import type { EventType } from '@credopass/lib/schemas';
import Analytics from '../Analytics/index';
import Tables from '../Tables';
import { useEventSessionStore, useLauncher } from '../../stores/store';
import { launchEventForm } from '../../containers/EventForm/index';
import {
  Calendar,
  Users,
  QrCode,
  Plus,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import './home.css';

const GREETINGS: Record<string, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return GREETINGS.morning;
  if (hour < 17) return GREETINGS.afternoon;
  return GREETINGS.evening;
}

/** Luma-style action cards (like Invite Guests / Send a Blast / Share Event) */
const ACTION_CARDS = [
  {
    key: 'create',
    icon: Plus,
    label: 'Create Event',
    description: 'Set up a new event',
    action: 'create-event' as const,
  },
  {
    key: 'checkin',
    icon: QrCode,
    label: 'Check-In',
    description: 'Scan guests at the door',
    action: 'navigate-checkin' as const,
  },
  {
    key: 'members',
    icon: Users,
    label: 'Members',
    description: 'View your community',
    action: 'navigate-members' as const,
  },
] as const;

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
  const { openLauncher } = useLauncher();

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

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'create-event':
          launchEventForm({ isEditing: false }, openLauncher);
          break;
        case 'navigate-checkin':
          navigate({ to: '/checkin' });
          break;
        case 'navigate-members':
          navigate({ to: '/members' });
          break;
      }
    },
    [openLauncher, navigate],
  );

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

      {/* Luma-style action cards row */}
      <div className="home-actions">
        {ACTION_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              className="home-action-card"
              onClick={() => handleAction(card.action)}
            >
              <div className="home-action-icon">
                <Icon size={18} />
              </div>
              <div className="home-action-text">
                <span className="home-action-label">{card.label}</span>
                <span className="home-action-desc">{card.description}</span>
              </div>
            </button>
          );
        })}
      </div>

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
