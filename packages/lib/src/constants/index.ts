import {
  Users,
  ChartNoAxesCombined,
  QrCode,
  Ticket,
  UserRound
} from "lucide-react";

/**
 * `Events` is what you HOST. `My Passes` is what you ATTEND.
 *
 * They are two different lists over two different scopes — `/events` is
 * organisation-scoped and `/tickets` is account-scoped — and the product
 * shipped for a long time with only the first, so someone who attends events
 * and hosts none opened CredoPass to an empty screen. Keeping them adjacent in
 * the nav is what makes the distinction legible.
 *
 * Order matters on a phone: the bottom bar shows the first four and folds the
 * rest under More, so anything demoted past the fourth position needs another
 * way in. `Account` has one (the user menu in the top bar); the first four do
 * not.
 */
export const NAV_ITEMS = [
  { id: 'events', url: "/events", icon: QrCode, label: "Events", isActive: true },
  // "Passes", not "My Passes": the bottom bar gives each item 56pt and a
  // two-word label wraps onto two lines there, which makes the one new item
  // in the nav look like a mistake.
  { id: 'tickets', url: "/tickets", icon: Ticket, label: "Passes" },
  { id: 'attendees', url: "/attendees", icon: Users, label: "Attendees" },
  { id: 'analytics', url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  { id: 'account', url: "/account", icon: UserRound, label: "Account" }
] as const;

export const tzList = Intl.supportedValuesOf('timeZone');