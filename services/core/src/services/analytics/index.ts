/**
 * Composes the full fabricated analytics payload.
 *
 * Pure and deterministic — the only entry point the route needs. Every number
 * below is invented. `fabricated: true` rides along in the response so that
 * fact travels with the data instead of living only in a banner someone can
 * forget to render.
 *
 * When real aggregates land, they land *inside this function*: the route, the
 * generated OpenAPI types and the whole dashboard stay as they are.
 */

import { Rng } from './seed';
import type { AnalyticsRange, AnalyticsResponse } from './types';
import {
  bucketsFor,
  buildArrivalsByHour,
  buildAttendanceMix,
  buildAttendanceTrend,
  buildCheckInMethods,
  buildCheckInsSeries,
  buildKpis,
  buildRecentActivity,
  buildStats,
  buildTopEvents,
} from './metrics';

export type * from './types';

export interface BuildAnalyticsInput {
  scope: string;
  range: AnalyticsRange;
  /** Human label for the scope; falls back to a generic one. */
  scopeLabel?: string;
  /**
   * Mixed into the seed so two organisations never see identical dashboards.
   * Fabricated numbers that match across tenants look like a leak.
   */
  organizationId: string;
  now?: Date;
}

export function buildAnalytics({
  scope,
  range,
  scopeLabel,
  organizationId,
  now = new Date(),
}: BuildAnalyticsInput): AnalyticsResponse {
  const rng = new Rng(`${organizationId}|${scope}|${range}`);
  const label = scopeLabel ?? (scope === 'all' ? 'All events' : 'This event');

  const buckets = bucketsFor(range, now);
  const kpis = buildKpis(rng, scope);
  const stats = buildStats(rng, scope);
  const checkInMethods = buildCheckInMethods(rng, kpis.totalCheckIns);

  // Funnel is internally consistent: registered ≥ checked-in ≥ attended.
  const registered = Math.round(kpis.uniqueAttendees / (1 - kpis.noShowRate / 100));
  const checkedIn = kpis.uniqueAttendees;
  const attended = Math.round(checkedIn * rng.range(0.9, 0.99));

  const avgDwell = rng.int(45, 140);

  return {
    scope,
    range,
    generatedAt: now.toISOString(),
    scopeLabel: label,
    fabricated: true,

    kpis,
    stats,

    attendanceTrend: buildAttendanceTrend(rng, buckets, kpis.avgAttendanceRate),
    checkInsSeries: buildCheckInsSeries(rng, buckets, scope),
    attendanceMix: buildAttendanceMix(rng, buckets, scope),
    arrivalsByHour: buildArrivalsByHour(rng, scope),
    checkInMethods,
    funnel: { registered, checkedIn, attended },
    dwell: { avgMinutes: avgDwell, medianMinutes: Math.round(avgDwell * rng.range(0.8, 0.95)) },

    topEvents: buildTopEvents(rng, scope, label),
    recentActivity: buildRecentActivity(rng),

    goal: {
      value: kpis.avgAttendanceRate,
      target: Math.min(99, kpis.avgAttendanceRate + rng.int(3, 10)),
    },
  };
}
