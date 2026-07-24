// ============================================================================
// FILE: packages/lib/src/analytics/index.ts
// Shared analytics contract — types + query schema used by BOTH the core
// service route and the web client. Keeping the shape here (framework-agnostic)
// means the fabricated generator can later be lifted into its own service
// without either side changing its imports.
// ============================================================================

import { z } from 'zod';

/** Granularity of the returned series. Also seeds the fabricated generator. */
export const AnalyticsRangeEnum = z.enum(['week', 'month', 'year']);
export type AnalyticsRange = z.infer<typeof AnalyticsRangeEnum>;

/** `all` = across every event; otherwise a single event id. */
export const AnalyticsQuerySchema = z.object({
  scope: z.string().default('all'),
  range: AnalyticsRangeEnum.default('month'),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

/** A trend direction for the small KPI badges. */
export type TrendDirection = 'up' | 'down';

/** Headline metric tile (icon is attached client-side by label). */
export interface StatTile {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: TrendDirection;
}

export interface AnalyticsKpis {
  /** Average share of registered people who showed up, as a percentage. */
  avgAttendanceRate: number;
  /** Change vs the previous comparable period, as a signed percentage. */
  avgAttendanceChange: number;
  totalCheckIns: number;
  uniqueAttendees: number;
  /** Share of registrations that never checked in, as a percentage. */
  noShowRate: number;
  /** Share of attendees who had been to a prior event, as a percentage. */
  repeatRate: number;
  newVsReturning: { new: number; returning: number };
  /** People checked in right now (only meaningful for a live event / all). */
  liveNow: number;
}

/** One point on a labelled time series. */
export interface SeriesPoint {
  label: string;
  value: number;
}

/** Registered → checked-in → attended, for the funnel panel. */
export interface AttendanceFunnel {
  registered: number;
  checkedIn: number;
  attended: number;
}

export interface AnalyticsResponse {
  scope: string;
  range: AnalyticsRange;
  /** ISO timestamp the payload was generated. */
  generatedAt: string;
  /** Human label for the scope (event name, or "All events"). */
  scopeLabel: string;

  kpis: AnalyticsKpis;
  stats: StatTile[];

  /** Hero sparkline — attendance rate over the range. */
  attendanceTrend: SeriesPoint[];
  /** Check-ins per period bucket (weekday for week, etc.). */
  checkInsSeries: SeriesPoint[];
  /** Stacked mix per period bucket. */
  attendanceMix: { label: string; members: number; guests: number; walkIns: number }[];
  /** NEW — arrivals bucketed by hour of day. */
  arrivalsByHour: { label: string; value: number }[];
  /** NEW — how people checked in (qr / manual / external_auth). */
  checkInMethods: { method: string; label: string; value: number }[];
  /** NEW — registered → checked-in → attended. */
  funnel: AttendanceFunnel;
  /** NEW — average minutes between check-in and check-out. */
  dwell: { avgMinutes: number; medianMinutes: number };

  tiers: { name: string; value: number }[];
  topEvents: { name: string; attendees: number; fillRate: number; trend: string }[];
  loyalty: { pointsIssued: number; tierUpgrades: number; activeStreaks: number };
  recentActivity: { action: string; time: string; highlight: boolean }[];

  /** Attendance goal gauge. */
  goal: { value: number; target: number };
}
