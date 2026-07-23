import {
  Users,
  ChartNoAxesCombined,
  QrCode,
  UserRound
} from "lucide-react";

export type Tier = (typeof rewardTiers)[keyof typeof rewardTiers];

export const rewardTiers = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
} as const;

export const NAV_ITEMS = [
  { id: 'events', url: "/events", icon: QrCode, label: "Events", isActive: true },
  { id: 'members', url: "/members", icon: Users, label: "Members" },
  { id: 'analytics', url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  { id: 'profile', url: "/profile", icon: UserRound, label: "Profile" }
] as const;

export const tzList = Intl.supportedValuesOf('timeZone');