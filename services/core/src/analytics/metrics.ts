// ============================================================================
// FILE: services/core/src/analytics/metrics.ts
// Pure builders for each block of the analytics payload. All fabricated, all
// deterministic (seeded via Rng). No Hono, no DB.
// ============================================================================

import type {
  AnalyticsKpis,
  AnalyticsRange,
  SeriesPoint,
  StatTile,
} from '@credopass/lib/analytics';
import { Rng } from './seed';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The x-axis buckets for a range: weekdays, weeks-of-month, or months. */
export function bucketsFor(range: AnalyticsRange, now = new Date()): string[] {
  if (range === 'week') return WEEKDAYS;
  if (range === 'month') return ['W1', 'W2', 'W3', 'W4', 'W5'];
  // year → trailing 12 months ending at the current month
  const start = now.getMonth() + 1;
  return Array.from({ length: 12 }, (_, i) => MONTHS[(start + i) % 12]);
}

/** A single event pulls smaller numbers than the whole programme. */
function scaleFor(scope: string): number {
  return scope === 'all' ? 1 : 0.14;
}

export function buildKpis(rng: Rng, scope: string): AnalyticsKpis {
  const scale = scaleFor(scope);
  const avgAttendanceRate = rng.int(72, 94);
  const totalCheckIns = Math.round(rng.int(1800, 4200) * scale);
  const uniqueAttendees = Math.round(totalCheckIns * rng.range(0.55, 0.78));
  const noShowRate = rng.int(6, 22);
  const repeatRate = rng.int(38, 67);
  const returning = Math.round(uniqueAttendees * (repeatRate / 100));
  return {
    avgAttendanceRate,
    avgAttendanceChange: rng.int(-6, 9),
    totalCheckIns,
    uniqueAttendees,
    noShowRate,
    repeatRate,
    newVsReturning: { new: uniqueAttendees - returning, returning },
    liveNow: scope === 'all' ? rng.int(0, 60) : rng.int(0, 120),
  };
}

export function buildStats(rng: Rng, scope: string): StatTile[] {
  const scale = scaleFor(scope);
  const events = scope === 'all' ? rng.int(12, 34) : 1;
  const members = Math.round(rng.int(640, 1480) * (scope === 'all' ? 1 : 0.3));
  const streaks = Math.round(rng.int(120, 460) * scale);
  const sign = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
  return [
    {
      id: 'events',
      label: scope === 'all' ? 'Events this period' : 'Sessions',
      value: events.toLocaleString(),
      change: sign(rng.int(-4, 12)),
      trend: rng.chance(0.7) ? 'up' : 'down',
    },
    {
      id: 'members',
      label: scope === 'all' ? 'Total members' : 'Registered',
      value: members.toLocaleString(),
      change: sign(rng.int(-3, 15)),
      trend: rng.chance(0.75) ? 'up' : 'down',
    },
    {
      id: 'streaks',
      label: 'Active streaks',
      value: streaks.toLocaleString(),
      change: sign(rng.int(-5, 8)),
      trend: rng.chance(0.6) ? 'up' : 'down',
    },
  ];
}

const series = (labels: string[], values: number[]): SeriesPoint[] =>
  labels.map((label, i) => ({ label, value: values[i] ?? 0 }));

export function buildAttendanceTrend(rng: Rng, buckets: string[], base: number): SeriesPoint[] {
  // Attendance *rate* trend (percent), gently rising toward `base`.
  const values = rng.walk(buckets.length, base - 8, 4, 55, 99);
  return series(buckets, values);
}

export function buildCheckInsSeries(rng: Rng, buckets: string[], scope: string): SeriesPoint[] {
  const base = Math.round(rng.int(45, 90) * (scope === 'all' ? 1 : 3));
  return series(buckets, rng.walk(buckets.length, base, base * 0.35, 0));
}

export function buildAttendanceMix(rng: Rng, buckets: string[], scope: string) {
  // Keep the stacked chart readable — at most the last 6 buckets.
  const shown = buckets.slice(-6);
  return shown.map((label) => {
    const members = Math.round(rng.int(80, 160) * (scope === 'all' ? 1 : 2.2));
    return {
      label,
      members,
      guests: Math.round(members * rng.range(0.28, 0.42)),
      walkIns: Math.round(members * rng.range(0.1, 0.22)),
    };
  });
}

export function buildArrivalsByHour(rng: Rng, scope: string) {
  // Event-day arrival curve: builds toward a start-time peak, then tapers.
  const hours = ['4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p'];
  const shape = [0.15, 0.35, 0.7, 1, 0.85, 0.55, 0.3, 0.12];
  const peak = Math.round(rng.int(60, 130) * (scope === 'all' ? 1.6 : 1));
  return hours.map((label, i) => ({
    label,
    value: Math.max(0, Math.round(peak * shape[i] * rng.range(0.85, 1.15))),
  }));
}

export function buildCheckInMethods(rng: Rng, totalCheckIns: number) {
  // qr dominates; manual next; external the tail — matches CheckInMethodEnum.
  const qr = rng.range(0.58, 0.74);
  const manual = rng.range(0.16, 0.28);
  const external = Math.max(0, 1 - qr - manual);
  const parts: { method: string; label: string; frac: number }[] = [
    { method: 'qr', label: 'QR scan', frac: qr },
    { method: 'manual', label: 'Manual', frac: manual },
    { method: 'external_auth', label: 'External', frac: external },
  ];
  return parts.map(({ method, label, frac }) => ({
    method,
    label,
    value: Math.round(totalCheckIns * frac),
  }));
}

export function buildTiers(rng: Rng) {
  // Weighted toward the lower tiers, normalised to 100.
  const raw = {
    Bronze: rng.range(40, 52),
    Silver: rng.range(24, 34),
    Gold: rng.range(12, 20),
    Platinum: rng.range(4, 9),
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.entries(raw).map(([name, v]) => ({ name, value: Math.round((v / total) * 100) }));
}

const EVENT_NAMES = [
  'Summer Rooftop Mixer',
  'Design Review Summit',
  'Founders Breakfast',
  'Community Workshop',
  'Product Launch Night',
  'Members-only Tasting',
  'Onboarding Social',
  'Quarterly Town Hall',
];

export function buildTopEvents(rng: Rng, scope: string, scopeLabel: string) {
  if (scope !== 'all') {
    // Single-event scope: show just this event.
    const attendees = rng.int(60, 210);
    return [
      {
        name: scopeLabel,
        attendees,
        fillRate: rng.int(58, 96),
        trend: `${rng.chance(0.7) ? '+' : '-'}${rng.int(2, 22)}%`,
      },
    ];
  }
  const names = [...EVENT_NAMES];
  const out: { name: string; attendees: number; fillRate: number; trend: string }[] = [];
  let ceiling = rng.int(160, 200);
  for (let i = 0; i < 4; i++) {
    const idx = rng.int(0, names.length - 1);
    const name = names.splice(idx, 1)[0];
    const attendees = Math.round(ceiling * rng.range(0.72, 0.98));
    ceiling = attendees;
    out.push({
      name,
      attendees,
      fillRate: rng.int(58, 96),
      trend: `${rng.chance(0.7) ? '+' : '-'}${rng.int(2, 22)}%`,
    });
  }
  return out;
}

const ACTIVITY = [
  'New member joined',
  'Event created',
  'Check-in recorded',
  'Tier upgrade: Gold',
  'Event completed',
  'Bulk import finished',
  'Refund processed',
  'Waitlist promoted',
];

export function buildRecentActivity(rng: Rng) {
  const times = ['2m ago', '15m ago', '32m ago', '1h ago', '2h ago'];
  return times.map((time, i) => ({
    action: rng.pick(ACTIVITY),
    time,
    highlight: i === 0 || rng.chance(0.3),
  }));
}
