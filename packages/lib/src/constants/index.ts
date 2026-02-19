import {
  Users,
  ChartNoAxesCombined,
  Database,
  QrCode,
  Building2,
} from "lucide-react";

export type Tier = (typeof rewardTiers)[keyof typeof rewardTiers];

export const rewardTiers = {
    BRONZE: 'bronze',
    SILVER: 'silver',
    GOLD: 'gold',
    PLATINUM: 'platinum',
} as const; 

export const NAV_ITEMS = [
  {id:'events', url: "/events", icon: QrCode, label: "Events", isActive: true },
  {id:'members', url: "/members", icon: Users, label: "Members" },
  {id:'analytics', url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  {id:'organizations', url: "/organizations", icon: Building2, label: "Organisations" },
  {id:'database', url: "/database", icon: Database, label: "Tables" },
] as const;