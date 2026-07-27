/**
 * The analytics payload shape, as plain TypeScript.
 *
 * Why here and not in a Zod schema: rule 5 — nothing under `src/services/` may
 * import a framework, and the OpenAPI `z` comes from `@hono/zod-openapi`. The
 * route owns the Zod schema; this file owns the types the generator is written
 * against. They cannot drift silently: the handler returns `buildAnalytics(...)`
 * straight into a `c.json()` that is typed by the route's response schema, so a
 * mismatch is a compile error rather than a wrong response.
 *
 * These types previously lived in `@credopass/lib/analytics` and were imported
 * by both sides. The web app no longer needs them from there — it reads the
 * generated OpenAPI types through `@credopass/api-client`, like every other
 * endpoint.
 */

export type AnalyticsRange = 'week' | 'month' | 'year';

/** A trend direction for the small KPI badges. */
export type TrendDirection = 'up' | 'down';

/** Headline metric tile (the icon is attached client-side, by id). */
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

/**
 * One point on a labelled time series. A `type` alias (not an interface) on
 * purpose: it keeps an implicit index signature, so arrays of these stay
 * assignable to the charts' `Record<string, unknown>[]` data prop.
 */
export type SeriesPoint = {
  label: string;
  value: number;
};

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
  /**
   * Always `true` today. It is in the contract, not just the UI, so a client
   * cannot render these numbers as real by forgetting a banner — and so the day
   * real aggregates land, the flag flips server-side and every client follows.
   */
  fabricated: boolean;

  kpis: AnalyticsKpis;
  stats: StatTile[];

  /** Hero sparkline — attendance rate over the range. */
  attendanceTrend: SeriesPoint[];
  /** Check-ins per period bucket (weekday for week, etc.). */
  checkInsSeries: SeriesPoint[];
  /** Stacked mix per period bucket. */
  attendanceMix: { label: string; members: number; guests: number; walkIns: number }[];
  /** Arrivals bucketed by hour of day. */
  arrivalsByHour: SeriesPoint[];
  /** How people checked in (qr / manual / external_auth). */
  checkInMethods: { method: string; label: string; value: number }[];
  /** Registered → checked-in → attended. */
  funnel: AttendanceFunnel;
  /** Average minutes between check-in and check-out. */
  dwell: { avgMinutes: number; medianMinutes: number };

  topEvents: { name: string; attendees: number; fillRate: number; trend: string }[];
  recentActivity: { action: string; time: string; highlight: boolean }[];

  /** Attendance goal gauge. */
  goal: { value: number; target: number };
}
