import { useParams } from '@tanstack/react-router';
import { ScanQrCodeIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '@credopass/lib/hooks';
import './event-detail.css';
import { EventViewPage } from './EventView';

/**
 * `/events/$eventId` — the organiser's in-shell view of an event. Renders the
 * shared read-only `EventView` (same component the public `/e/$eventId` page
 * uses), so the two stay in lockstep.
 */
function EventDetailPage() {
  const { eventId } = useParams({ from: '/events/$eventId' });
  const navigate = useNavigate();

  // Toolbar: quick jump to the check-in kiosk; no search here.
  useToolbarContext({
    action: {
      icon: ScanQrCodeIcon,
      label: 'Open Check-in',
      onClick: () => navigate({ to: '/checkin/$eventId', params: { eventId } }),
    },
    search: { enabled: false, placeholder: '' },
  });

  return <EventViewPage eventId={eventId} variant="detail" />;
}

export default EventDetailPage;
