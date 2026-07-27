/**
 * `/analytics` — the attendance dashboard.
 *
 * **Every figure on this page is invented.** `GET /analytics/overview` runs a
 * deterministic generator, not an aggregate query, and says so in the payload:
 * `fabricated: true`. The banner at the top is driven by that flag rather than
 * hard-coded, so the day real aggregates land the server flips one boolean and
 * this page stops calling itself a demo — no release required.
 *
 * A previous pass deleted this dashboard outright on the grounds that people
 * screenshot charts. The banner is the answer to that, not deletion: the layout
 * IS the specification for what the real endpoint has to return, and throwing it
 * away meant rebuilding it from a screenshot later.
 *
 * Two things changed on the way back from the old `/api/core` version:
 *
 *   · Data comes from `useAnalytics` / `useEvents` (`@credopass/api-client`).
 *     The TanStack DB collections it used to read are gone.
 *   · The loyalty tier and points panels went with them. Loyalty was deleted
 *     from the product; placeholder numbers for a shipped feature are one thing,
 *     a whole invented feature on a dashboard is another. That slot now shows
 *     new vs returning, which maps onto attendance data that genuinely exists.
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock,
  Filter,
  FlaskConical,
  Hourglass,
  Lock,
  Repeat,
  ScanLine,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useToolbarContext } from '@credopass/lib/hooks';
import {
  useAnalytics,
  useEvents,
  useOrganizations,
  usePlans,
  type Analytics,
  type AnalyticsRange,
  type StatTile,
} from '@credopass/api-client';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { toast } from '@credopass/ui/components/sonner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@credopass/ui/components/select';
import type { ChartConfig } from '@credopass/ui/components/chart';
import { AreaChart, BarChart, ChartContainer } from '@credopass/ui/components/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@credopass/ui/components/card';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@credopass/ui/components/tabs';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { cn } from '@credopass/ui/lib/utils';
import { useSession } from '../../contexts/session';

// Chart colours resolve through the design-token system so both themes (and any
// future palette change) flow into the charts automatically.
const COLORS = {
  primary: 'var(--primary)',
  secondary: 'var(--info)',
  muted: 'var(--chart-neutral)',
  barRest: 'oklch(0.28 0.005 260)',
};

const METHOD_COLORS: Record<string, string> = {
  qr: COLORS.primary,
  manual: COLORS.secondary,
  external_auth: COLORS.muted,
};

// Headline tiles get their icon by id (the API sends no icons).
const STAT_ICONS: Record<string, typeof CalendarDays> = {
  events: CalendarDays,
  people: Users,
  repeat: Repeat,
};

const heroConfig = {
  value: { label: 'Attendance', color: 'var(--primary-foreground)' },
} satisfies ChartConfig;

const pillBarConfig = {
  value: { label: 'Check-ins', color: COLORS.primary },
} satisfies ChartConfig;

const arrivalsConfig = {
  value: { label: 'Arrivals', color: COLORS.secondary },
} satisfies ChartConfig;

const mixConfig = {
  members: { label: 'Members', color: COLORS.primary },
  guests: { label: 'Guests', color: COLORS.secondary },
  walkIns: { label: 'Walk-ins', color: COLORS.muted },
} satisfies ChartConfig;

// ---- Building blocks ----

/** Lime hero: headline metric + trend pill + dark chart inside the card. */
const HeroAttendanceCard: React.FC<{
  rate: number;
  change: number;
  trend: { label: string; value: number }[];
  compact?: boolean;
}> = ({ rate, change, trend, compact }) => {
  const up = change >= 0;
  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-0 bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full border-16 border-primary-foreground/8" />
      <CardHeader className="relative z-10 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60">
              Avg attendance
            </p>
            <div className="flex items-end gap-3">
              <span
                className={cn(
                  'font-bold leading-none tracking-tight tabular-nums',
                  compact ? 'text-4xl' : 'text-5xl'
                )}
              >
                {rate}%
              </span>
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground px-2.5 py-1 text-[11px] font-bold text-primary">
                {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {up ? '+' : ''}
                {change}%
              </span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-primary-foreground/55">
              compared to last period
            </p>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground text-primary">
            <TrendingUp size={16} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-1 flex-col justify-end px-3 pb-3 pt-4">
        <ChartContainer
          config={heroConfig}
          className="block! w-full aspect-auto!"
          style={{ height: compact ? 110 : 150 }}
        >
          <AreaChart
            data={trend}
            xKey="label"
            series={[{ key: 'value' }]}
            axisColor="var(--primary-foreground)"
            axisOpacity={0.55}
            hideTooltip
          />
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

const StatCard: React.FC<{ stat: StatTile; compact?: boolean }> = ({ stat, compact }) => {
  const Icon = STAT_ICONS[stat.id] ?? Activity;
  const TrendIcon = stat.trend === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <Card
      className={cn(
        'relative h-full overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5',
        compact && 'p-3'
      )}
    >
      <CardHeader className={cn('pb-2', compact && 'p-0 pb-2')}>
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon size={compact ? 14 : 16} className="text-primary" />
          </div>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full text-[10px] font-semibold',
              stat.trend === 'up'
                ? 'border-chart-positive/20 bg-chart-positive/10 text-chart-positive'
                : 'border-chart-negative/20 bg-chart-negative/10 text-chart-negative'
            )}
          >
            <TrendIcon size={10} className="mr-0.5" />
            {stat.change}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(compact && 'p-0')}>
        <p
          className={cn(
            'font-bold tracking-tight tabular-nums text-foreground',
            compact ? 'text-xl' : 'text-2xl xl:text-3xl'
          )}
        >
          {stat.value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
      </CardContent>
    </Card>
  );
};

/** A small labelled KPI with an icon — used in the secondary metrics strip. */
const MiniKpi: React.FC<{
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}> = ({ icon: Icon, label, value, hint }) => (
  <Card className="flex flex-row items-center gap-3 p-3">
    <div className="shrink-0 rounded-lg bg-primary/10 p-2">
      <Icon size={15} className="text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-bold leading-tight tracking-tight tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{hint ?? label}</p>
    </div>
  </Card>
);

/** Goal gauge — SVG semi-arc with lime progress. */
const GoalGauge: React.FC<{ value: number; goal: number }> = ({ value, goal }) => {
  const pct = Math.min(1, value / goal);
  const circumference = Math.PI * 64; // semicircle of r=64
  const dash = circumference * pct;
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Target size={14} className="text-primary" />
          Attendance goal
        </CardTitle>
        <CardDescription className="text-xs">Target {goal}%</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center pt-2">
        <svg viewBox="0 0 160 92" className="w-full max-w-55">
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="var(--muted)"
            strokeWidth={12}
            strokeLinecap="round"
          />
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
          />
          <text
            x="80"
            y="66"
            textAnchor="middle"
            className="fill-foreground"
            style={{ font: '700 26px "Inter Variable", sans-serif' }}
          >
            {value}%
          </text>
          <text
            x="80"
            y="84"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ font: '500 9px "Inter Variable", sans-serif', letterSpacing: '0.08em' }}
          >
            OF {goal}% GOAL
          </text>
        </svg>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          <p className="text-[11px] text-muted-foreground">
            {Math.round(pct * 100)}% of the way there
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

/** A labelled proportion bar row — reused by methods, the funnel and the mix. */
const BarRow: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}> = ({ label, value, max, color, suffix }) => (
  <div className="flex items-center gap-3">
    <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="truncate text-xs font-medium">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  </div>
);

/**
 * Frosts everything inside it for organizations whose plan does not include
 * analytics. `included` comes from `/plans` — which tiers get which features is
 * a pricing decision, and it stays server-side.
 */
const PlanGate: React.FC<{ included: boolean; children: React.ReactNode }> = ({
  included,
  children,
}) => {
  const navigate = useNavigate();

  if (included) return <>{children}</>;

  return (
    <div className="relative isolate">
      <div aria-hidden inert className="pointer-events-none select-none blur-[6px] saturate-50">
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-start justify-center overflow-hidden rounded-2xl bg-background/40 supports-backdrop-filter:backdrop-blur-sm">
        <div className="sticky top-8 mt-16 flex max-w-xs flex-col items-center gap-3 rounded-3xl border border-primary/20 bg-card/80 p-6 text-center shadow-lg supports-backdrop-filter:backdrop-blur-md">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Lock size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">Full analytics is a paid feature</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock check-in trends, attendance mix, the arrival curve and exports.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-full font-semibold"
            onClick={() => navigate({ to: '/upgrade' })}
          >
            <Sparkles size={13} />
            Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Says plainly that the numbers are made up.
 *
 * Driven by `data.fabricated`, so it disappears on its own when the endpoint
 * starts returning real aggregates — and, more to the point, cannot be
 * forgotten while it still applies.
 */
const FabricatedBanner: React.FC = () => (
  <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-4">
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
      <FlaskConical size={15} />
    </span>
    <div className="min-w-0">
      <p className="text-sm font-semibold">These numbers are made up</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
        This dashboard runs on a placeholder service — a deterministic generator, not your
        attendance records. It is here so the layout, the contract and the permissions are real
        before the aggregates are. Don&rsquo;t report anything from this page.
      </p>
    </div>
  </div>
);

// ---- Page ----

const AnalyticsPage: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { organizationId } = useSession();
  const [timeRange, setTimeRange] = useState<AnalyticsRange>('month');
  const [scope, setScope] = useState<string>('all');

  // Per-event vs across-the-board scope. The picker only needs names and ids.
  const { data: eventPage } = useEvents({ limit: 100 });
  const scopeEvents = useMemo(() => eventPage?.data ?? [], [eventPage]);
  const scopedEvent = useMemo(
    () => scopeEvents.find((e) => e.id === scope) ?? null,
    [scopeEvents, scope]
  );

  const { data, isLoading, error } = useAnalytics(scope, timeRange);

  // Whether this org's plan includes analytics — asked of the API, not inferred.
  const { data: organizations = [] } = useOrganizations();
  const { data: plans = [] } = usePlans();
  const currentPlan = organizations.find((o) => o.id === organizationId)?.plan;
  const included = plans.find((p) => p.id === currentPlan)?.fullAnalytics ?? false;

  const handleExport = () => {
    if (!included) {
      toast.info('Exporting analytics is a paid feature', {
        description: 'Upgrade to download CSV and PDF reports.',
        action: { label: 'Upgrade', onClick: () => navigate({ to: '/upgrade' }) },
      });
      return;
    }
    // Honest about the state of things: there is no export endpoint yet, and a
    // spinner that never resolves would be worse than saying so.
    toast.info('Export isn’t built yet', {
      description: 'It lands with the real analytics endpoint — these figures are placeholders.',
    });
  };

  useToolbarContext({ action: null, search: { enabled: false, placeholder: '' } });

  const peakPoint = useMemo(() => {
    const series = data?.checkInsSeries ?? [];
    return series.reduce<{ label: string; value: number } | null>(
      (max, d) => (!max || d.value > max.value ? d : max),
      null
    );
  }, [data]);

  return (
    <div className={cn('flex flex-col gap-5 overflow-auto', isMobile && 'pb-20')}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {scopedEvent
              ? `Performance for “${scopedEvent.name}”`
              : 'Across all events and your whole community'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Scope: one event vs across the board */}
          <Select value={scope} onValueChange={(v) => setScope(v ?? 'all')}>
            <SelectTrigger className="h-9 w-45 rounded-full text-xs">
              {/* base-ui renders the raw value by default, so map it to the name. */}
              <SelectValue placeholder="All events">
                {(value) =>
                  value && value !== 'all'
                    ? (scopeEvents.find((e) => e.id === value)?.name ?? 'Event')
                    : 'All events'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All events</SelectItem>
                {scopeEvents.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as AnalyticsRange)}>
            <TabsList className="grid w-45 grid-cols-3 rounded-full">
              <TabsTrigger value="week" className="rounded-full text-xs">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="rounded-full text-xs">
                Month
              </TabsTrigger>
              <TabsTrigger value="year" className="rounded-full text-xs">
                Year
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 gap-1.5 rounded-full text-xs"
          >
            <Lock size={12} className="text-primary" />
            Export
          </Button>
          {!included && (
            <UpgradeCTA
              size="md"
              className="hidden xl:inline-flex"
              onClick={() => navigate({ to: '/upgrade' })}
            />
          )}
        </div>
      </div>

      {data?.fabricated && <FabricatedBanner />}

      {error && !data ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold">Couldn&rsquo;t load analytics</p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        </Card>
      ) : !data ? (
        <AnalyticsSkeleton isMobile={isMobile} />
      ) : (
        <AnalyticsBody
          data={data}
          isMobile={isMobile}
          loading={isLoading}
          peakLabel={peakPoint?.label}
          included={included}
        />
      )}
    </div>
  );
};

/** Skeleton shown on the very first load (before any payload). */
const AnalyticsSkeleton: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div className="flex flex-col gap-5" aria-busy="true">
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Skeleton className="col-span-2 row-span-2 h-52 rounded-xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className={cn('rounded-xl', isMobile ? 'h-24' : 'h-28')} />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Skeleton className="h-64 rounded-xl md:col-span-2" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  </div>
);

/** The full dashboard, driven entirely by the analytics payload. */
const AnalyticsBody: React.FC<{
  data: Analytics;
  isMobile: boolean;
  loading: boolean;
  peakLabel?: string;
  included: boolean;
}> = ({ data, isMobile, loading, peakLabel, included }) => {
  const { kpis } = data;
  const totalCheckIns = data.checkInsSeries.reduce((s, d) => s + d.value, 0);
  const peakValue = data.checkInsSeries.reduce((max, d) => Math.max(max, d.value), 0);
  const methodMax = Math.max(...data.checkInMethods.map((m) => m.value), 1);
  const funnelMax = data.funnel.registered || 1;
  const audienceMax = Math.max(kpis.newVsReturning.new, kpis.newVsReturning.returning, 1);

  return (
    <div className={cn('flex flex-col gap-5 transition-opacity', loading && 'opacity-60')}>
      {/* Bento: lime hero (2x2) + stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="col-span-2 row-span-2">
          <HeroAttendanceCard
            rate={kpis.avgAttendanceRate}
            change={kpis.avgAttendanceChange}
            trend={data.attendanceTrend}
            compact={isMobile}
          />
        </div>
        {data.stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} compact={isMobile} />
        ))}
        {/* Live now mini tile */}
        <Card
          className={cn(
            'relative flex h-full flex-col justify-between overflow-hidden',
            isMobile && 'p-3'
          )}
        >
          <CardHeader className={cn('pb-0', isMobile && 'p-0')}>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Live now
              </p>
            </div>
          </CardHeader>
          <CardContent className={cn(isMobile && 'p-0')}>
            <p
              className={cn(
                'font-bold tracking-tight tabular-nums',
                isMobile ? 'text-xl' : 'text-2xl xl:text-3xl'
              )}
            >
              {kpis.liveNow}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">checked in right now</p>
          </CardContent>
        </Card>
      </div>

      {/* Everything past the four headline cards is plan-gated */}
      <PlanGate included={included}>
        <div className="flex flex-col gap-5">
          {/* Secondary KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniKpi
              icon={UserCheck}
              label="Unique attendees"
              value={kpis.uniqueAttendees.toLocaleString()}
              hint="Unique attendees"
            />
            <MiniKpi
              icon={Filter}
              label="No-show rate"
              value={`${kpis.noShowRate}%`}
              hint="No-show rate"
            />
            <MiniKpi
              icon={Repeat}
              label="Repeat rate"
              value={`${kpis.repeatRate}%`}
              hint="Repeat attendees"
            />
            <MiniKpi
              icon={Hourglass}
              label="Avg dwell"
              value={`${data.dwell.avgMinutes}m`}
              hint="Avg time on site"
            />
          </div>

          {/* Row: check-ins bars + goal gauge */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Activity size={14} className="text-primary" />
                      Check-ins
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {peakLabel ? `Busiest: ${peakLabel} · ${peakValue} check-ins` : 'Per period'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/25 bg-primary/10 text-[10px] font-semibold text-primary"
                  >
                    {totalCheckIns.toLocaleString()} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer
                  config={pillBarConfig}
                  className="block! w-full aspect-auto!"
                  style={{ height: isMobile ? 200 : 260 }}
                >
                  <BarChart
                    data={data.checkInsSeries}
                    xKey="label"
                    series={[
                      {
                        key: 'value',
                        colors: data.checkInsSeries.map((d) =>
                          d.label === peakLabel ? COLORS.primary : COLORS.barRest
                        ),
                      },
                    ]}
                    radius={10}
                    maxBarWidth={38}
                    categoryGap="28%"
                  />
                </ChartContainer>
              </CardContent>
            </Card>

            <GoalGauge value={data.goal.value} goal={data.goal.target} />
          </div>

          {/* Row: arrivals-by-hour + check-in methods */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Clock size={14} className="text-primary" />
                  Arrivals by hour
                </CardTitle>
                <CardDescription className="text-xs">
                  When attendees actually check in on the day
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer
                  config={arrivalsConfig}
                  className="block! w-full aspect-auto!"
                  style={{ height: isMobile ? 190 : 230 }}
                >
                  <BarChart
                    data={data.arrivalsByHour}
                    xKey="label"
                    series={[{ key: 'value', color: COLORS.secondary }]}
                    radius={8}
                    maxBarWidth={30}
                    categoryGap="24%"
                  />
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ScanLine size={14} className="text-primary" />
                  Check-in method
                </CardTitle>
                <CardDescription className="text-xs">How people got in</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {data.checkInMethods.map((m) => (
                  <BarRow
                    key={m.method}
                    label={m.label}
                    value={m.value}
                    max={methodMax}
                    color={METHOD_COLORS[m.method] ?? COLORS.muted}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Row: attendance mix + new vs returning */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 size={14} className="text-primary" />
                  Attendance mix
                </CardTitle>
                <CardDescription className="text-xs">Members, guests and walk-ins</CardDescription>
                <div className="flex items-center gap-4 pt-1">
                  {[
                    ['Members', COLORS.primary],
                    ['Guests', COLORS.secondary],
                    ['Walk-ins', COLORS.muted],
                  ].map(([label, color]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer
                  config={mixConfig}
                  className="block! w-full aspect-auto!"
                  style={{ height: isMobile ? 210 : 260 }}
                >
                  <BarChart
                    data={data.attendanceMix}
                    xKey="label"
                    series={[
                      { key: 'members', stackId: 'mix' },
                      { key: 'guests', stackId: 'mix' },
                      { key: 'walkIns', stackId: 'mix' },
                    ]}
                    radius={6}
                    maxBarWidth={34}
                    categoryGap="34%"
                    grid={{ top: 8 }}
                    segmentBorderColor="var(--card)"
                  />
                </ChartContainer>
              </CardContent>
            </Card>

            {/*
              This slot used to hold loyalty tiers. Loyalty is gone from the
              product, so it answers the same question ("who was in the room?")
              with a concept that still exists.
            */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus size={14} className="text-primary" />
                  New vs returning
                </CardTitle>
                <CardDescription className="text-xs">Who showed up this period</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <BarRow
                    label="Returning"
                    value={kpis.newVsReturning.returning}
                    max={audienceMax}
                    color={COLORS.primary}
                  />
                  <BarRow
                    label="First time"
                    value={kpis.newVsReturning.new}
                    max={audienceMax}
                    color={COLORS.secondary}
                  />
                </div>
                <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/8 p-3">
                  <Repeat size={14} className="shrink-0 text-primary" />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground">{kpis.repeatRate}%</span> of
                    attendees had been to one of your events before
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row: funnel + top events */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Filter size={14} className="text-primary" />
                  Attendance funnel
                </CardTitle>
                <CardDescription className="text-xs">
                  Registered → checked-in → attended
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <BarRow
                  label="Registered"
                  value={data.funnel.registered}
                  max={funnelMax}
                  color={COLORS.muted}
                />
                <BarRow
                  label="Checked in"
                  value={data.funnel.checkedIn}
                  max={funnelMax}
                  color={COLORS.secondary}
                />
                <BarRow
                  label="Attended"
                  value={data.funnel.attended}
                  max={funnelMax}
                  color={COLORS.primary}
                />
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {Math.round((data.funnel.attended / funnelMax) * 100)}% of registrations attended
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Zap size={14} className="text-primary" />
                  Top events
                </CardTitle>
                <CardDescription className="text-xs">Ranked by attendance</CardDescription>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <div className="flex flex-col">
                  {data.topEvents.map((event, idx) => (
                    <div
                      key={event.name}
                      className="flex items-center gap-3 rounded-lg border-b border-border/50 px-2 py-3 transition-colors last:border-0 hover:bg-muted/30"
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums',
                          idx === 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{event.name}</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {event.attendees} attendees
                        </p>
                      </div>
                      <div className="hidden w-28 shrink-0 flex-col items-end gap-1 sm:flex">
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {event.fillRate}% full
                        </span>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${event.fillRate}%` }}
                          />
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 rounded-full text-[10px] font-semibold',
                          event.trend.startsWith('+')
                            ? 'border-chart-positive/20 bg-chart-positive/10 text-chart-positive'
                            : 'border-chart-negative/20 bg-chart-negative/10 text-chart-negative'
                        )}
                      >
                        {event.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock size={14} className="text-primary" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {data.recentActivity.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b border-border/50 py-2 last:border-0 md:last:border-b"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'size-1.5 rounded-full',
                          item.highlight ? 'bg-primary' : 'bg-muted-foreground/30'
                        )}
                      />
                      <span className="text-xs">{item.action}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PlanGate>
    </div>
  );
};

export default AnalyticsPage;
