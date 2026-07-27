import {
  Users,
  ChartNoAxesCombined,
  QrCode,
  UserRound
} from "lucide-react";

export const NAV_ITEMS = [
  { id: 'events', url: "/events", icon: QrCode, label: "Events", isActive: true },
  { id: 'attendees', url: "/attendees", icon: Users, label: "Attendees" },
  { id: 'analytics', url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  { id: 'account', url: "/account", icon: UserRound, label: "Account" }
] as const;

export const tzList = Intl.supportedValuesOf('timeZone');