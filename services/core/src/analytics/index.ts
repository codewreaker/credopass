// ============================================================================
// FILE: services/core/src/analytics/index.ts
// Composes the full fabricated analytics payload. Pure and deterministic — the
// only public entry point the route needs. Portable: no Hono, no DB, so this
// folder can move into its own service unchanged.
// ============================================================================

import type { AnalyticsRange, AnalyticsResponse } from '@credopass/lib/analytics';
import { Rng } from './seed';
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
  buildTiers,
  buildTopEvents,
} from './metrics';

export interface BuildAnalyticsInput {
  scope: string;
  range: AnalyticsRange;
  /** Human label for the scope; falls back to a generic one. */
  scopeLabel?: string;
  now?: Date;
}

/**
 * Build a believable analytics payload for a scope + range. Deterministic: the
 * same inputs always return the same numbers (seeded by `scope|range`), so
 * re-fetches don't flicker and demos are reproducible. When real data is wired
 * in later, only the internals here change — the response shape is the shared
 * contract in `@credopass/lib/analytics`.
 */
export function buildAnalytics({
  scope,
  range,
  scopeLabel,
  now = new Date(),
}: BuildAnalyticsInput): AnalyticsResponse {
  const rng = new Rng(`${scope}|${range}`);
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

    kpis,
    stats,

    attendanceTrend: buildAttendanceTrend(rng, buckets, kpis.avgAttendanceRate),
    checkInsSeries: buildCheckInsSeries(rng, buckets, scope),
    attendanceMix: buildAttendanceMix(rng, buckets, scope),
    arrivalsByHour: buildArrivalsByHour(rng, scope),
    checkInMethods,
    funnel: { registered, checkedIn, attended },
    dwell: { avgMinutes: avgDwell, medianMinutes: Math.round(avgDwell * rng.range(0.8, 0.95)) },

    tiers: buildTiers(rng),
    topEvents: buildTopEvents(rng, scope, label),
    loyalty: {
      pointsIssued: Math.round(rng.int(8000, 42000) * (scope === 'all' ? 1 : 0.15)),
      tierUpgrades: Math.round(rng.int(6, 60) * (scope === 'all' ? 1 : 0.2)),
      activeStreaks: rng.int(40, 480),
    },
    recentActivity: buildRecentActivity(rng),

    goal: { value: kpis.avgAttendanceRate, target: Math.min(99, kpis.avgAttendanceRate + rng.int(3, 10)) },
  };
}
