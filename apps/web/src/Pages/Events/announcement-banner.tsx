import { Info, Megaphone, PartyPopper, Sparkles, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@credopass/ui/components/button';
import {
  liveAnnouncements,
  type Announcement,
  type AnnouncementIcon,
} from '../../announcements';

const DISMISSED_KEY = 'credopass:announcements-dismissed';

/**
 * The one banner above the greeting on /events.
 *
 * **It used to be the host-name prompt**, which nagged owners whose
 * organisation was still called `Israel's organization` to go and rename it.
 * That prompt has done its job: a new organisation is now named after the
 * person who created it, and the seed repairs a generated name rather than
 * leaving it to a banner. What was worth keeping is the slot — the screen a
 * host opens every time is the one place a message actually gets read — so the
 * component stayed and the content became publishable.
 *
 * Content comes from `src/announcements.ts` and nowhere else. One at a time,
 * because two stacked banners is how people learn to ignore the first.
 *
 * Dismissal is per announcement id and sticks. A banner that cannot be silenced
 * is one people look past, and these are messages rather than errors — anything
 * that must be acted on belongs in the flow it blocks, not up here.
 */

const ICONS: Record<AnnouncementIcon, typeof Info> = {
  megaphone: Megaphone,
  sparkles: Sparkles,
  wrench: Wrench,
  party: PartyPopper,
  info: Info,
};

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private window, blocked storage, or something that is not JSON. Showing
    // the banner is the safe failure: the worst case is one extra message.
    return [];
  }
};

export function AnnouncementBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const announcement: Announcement | undefined = liveAnnouncements().find(
    (a) => !dismissed.includes(a.id)
  );

  if (!announcement) return null;

  const Icon = ICONS[announcement.icon ?? 'megaphone'];
  const primary = (announcement.tone ?? 'primary') === 'primary';
  const canDismiss = announcement.dismissible !== false;

  const dismiss = () => {
    const next = [...dismissed, announcement.id];
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* nothing to remember it in; it will show again next time */
    }
    setDismissed(next);
  };

  const act = () => {
    if (!announcement.action) return;
    if ('href' in announcement.action) {
      window.open(announcement.action.href, '_blank', 'noopener,noreferrer');
      return;
    }
    // The route is authored in `announcements.ts` by hand, so it is checked by
    // the person writing it rather than by the router's generated union. The
    // cast is confined to this line.
    navigate({ to: announcement.action.to as '/events' });
  };

  return (
    <div
      className={`relative flex items-start gap-3 rounded-2xl border px-4 py-3 ${
        primary ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
          primary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon size={14} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{announcement.title}</p>
        {announcement.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {announcement.body}
          </p>
        )}
        {announcement.action && (
          <Button size="sm" className="mt-2.5 h-7 rounded-full px-3 text-[11px]" onClick={act}>
            {announcement.action.label}
          </Button>
        )}
      </div>

      {canDismiss && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default AnnouncementBanner;
