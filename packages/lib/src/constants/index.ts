import {
  Users,
  ChartNoAxesCombined,
  QrCode,
  UserRound
} from "lucide-react";

/**
 * There is NO separate "Passes" tab, and adding one back would be a regression.
 *
 * It existed for about a day. `Events` is one list of everything you have on —
 * what you host and what you are going to — because that is the question
 * someone opening the app is asking, and splitting the answer across two tabs
 * made it depend on remembering which tab you were in. The difference between
 * the two is carried on the row instead, as a pill on the poster: `Host` on
 * the ones you run, `Going` / `Went` on the ones you are a guest at.
 *
 * `/tickets` still resolves — it redirects — because pass links in the wild
 * point at it.
 */
export const NAV_ITEMS = [
  { id: 'events', url: "/events", icon: QrCode, label: "Events", isActive: true },
  { id: 'attendees', url: "/attendees", icon: Users, label: "Attendees" },
  { id: 'analytics', url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  { id: 'account', url: "/account", icon: UserRound, label: "Account" }
] as const;

export const tzList = Intl.supportedValuesOf('timeZone');