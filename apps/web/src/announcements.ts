/**
 * Messages the product shows its users.
 *
 * This is the publishing surface for the banner that sits above the greeting on
 * /events. Add an entry, ship, and it appears; remove it, and it goes. There is
 * no admin screen and no endpoint behind it — announcements are part of the
 * release, which is the right shape while there is one person publishing them.
 * If that changes, the component reads from here and nowhere else, so swapping
 * this array for a fetch is a one-file change.
 *
 * Three rules worth keeping:
 *
 *   · `id` is permanent. Dismissal is stored against it, so reusing an id means
 *     everybody who dismissed the old message never sees the new one. Changing
 *     the wording of a live announcement is fine; changing what it is about
 *     needs a new id.
 *   · `until` is a kindness to your future self. A banner about an event that
 *     has happened is worse than no banner, and nobody remembers to delete it.
 *   · One at a time. The banner renders the first entry that is live and not
 *     dismissed, because two stacked banners is how people learn to ignore the
 *     first one.
 */

export type AnnouncementTone = 'info' | 'primary';
export type AnnouncementIcon = 'megaphone' | 'sparkles' | 'wrench' | 'party' | 'info';

export interface Announcement {
  /** Permanent. Dismissal is keyed on it — never reuse one. */
  id: string;
  title: string;
  /** Optional second line. Keep it to a sentence or two. */
  body?: string;
  icon?: AnnouncementIcon;
  tone?: AnnouncementTone;
  /** ISO date. After this instant the banner hides itself. */
  until?: string;
  /** ISO date. Before this instant it stays hidden — schedule one ahead. */
  from?: string;
  /** Optional call to action. `to` is an in-app route; `href` opens a URL. */
  action?: { label: string; to: string } | { label: string; href: string };
  /** `false` pins it until it expires. Default is dismissible. */
  dismissible?: boolean;
}

/**
 * Live announcements. Empty is the normal state.
 *
 * Example — delete or replace:
 *
 *   {
 *     id: 'passes-2026-11',
 *     title: 'You can get your pass back now',
 *     body: 'Swipe any event you are going to and tap Pass. It issues a fresh QR — the old link stops working.',
 *     icon: 'sparkles',
 *     action: { label: 'See your events', to: '/events' },
 *     until: '2026-12-01T00:00:00Z',
 *   }
 */
export const ANNOUNCEMENTS: Announcement[] = [];

/** Live right now: inside its window, in declaration order. */
export function liveAnnouncements(now: Date = new Date()): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => {
    if (a.from && new Date(a.from) > now) return false;
    if (a.until && new Date(a.until) <= now) return false;
    return true;
  });
}
