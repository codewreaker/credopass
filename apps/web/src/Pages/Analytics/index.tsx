import React, { useMemo, useState } from "react";
import {
  Users,
  Calendar,
  Lock,
  TrendingUp,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Clock,
  Target,
  Zap,
  Flame,
  Crown,
  Sparkles,
  ScanLine,
  Filter,
  Repeat,
  UserCheck,
  Hourglass,
} from "lucide-react";
import { useToolbarContext } from '@credopass/lib/hooks';
import { useNavigate } from '@tanstack/react-router';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { usePremium } from '../../contexts/premium';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import type { AnalyticsResponse, StatTile } from '@credopass/lib/analytics';
import { toast } from '@credopass/ui/components/sonner';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@credopass/ui/components/select';
import type { ChartConfig } from "@credopass/ui/components/chart";
import {
  AreaChart,
  BarChart,
  ChartContainer,
} from "@credopass/ui/components/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@credopass/ui/components/card";
import { Badge } from "@credopass/ui/components/badge";
import { Button } from "@credopass/ui/components/button";
import { Skeleton } from "@credopass/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@credopass/ui/components/tabs";
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { cn } from '@credopass/ui/lib/utils';
import { useAnalytics } from './use-analytics';

// Chart colors resolve through the design-token system so both themes
// (and any future palette change) flow into the charts automatically.
const COLORS = {
  primary: 'var(--primary)',
  secondary: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--destructive)',
  muted: 'var(--chart-neutral)',
  barRest: 'oklch(0.28 0.005 260)',
};

const TIER_COLORS: Record<string, string> = {
  Bronze: 'var(--tier-bronze)',
  Silver: 'var(--tier-silver)',
  Gold: 'var(--tier-gold)',
  Platinum: 'var(--tier-platinum)',
};

const METHOD_COLORS: Record<string, string> = {
  qr: COLORS.primary,
  manual: COLORS.secondary,
  external_auth: COLORS.muted,
};

// Headline tiles get their icon by id (the API sends no icons).
const STAT_ICONS: Record<string, typeof Calendar> = {
  events: Calendar,
  members: Users,
  streaks: Flame,
};

const heroConfig = {
  value: { label: "Attendance", color: 'var(--primary-foreground)' },
} satisfies ChartConfig;

const pillBarConfig = {
  value: { label: "Check-ins", color: COLORS.primary },
} satisfies ChartConfig;

const arrivalsConfig = {
  value: { label: "Arrivals", color: COLORS.secondary },
} satisfies ChartConfig;

const mixConfig = {
  members: { label: "Members", color: COLORS.primary },
  guests: { label: "Guests", color: COLORS.secondary },
  walkIns: { label: "Walk-ins", color: COLORS.muted },
} satisfies ChartConfig;

// ---- Building blocks ----

/** Lime hero: headline metric + trend pill + dark chart inside the card */
const HeroAttendanceCard: React.FC<{
  rate: number;
  change: number;
  trend: { label: string; value: number }[];
  compact?: boolean;
}> = ({ rate, change, trend, compact }) => {
  const up = change >= 0;
  return (
    <Card className="relative overflow-hidden border-0 bg-primary text-primary-foreground h-full flex flex-col">
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full border-[16px] border-primary-foreground/8" />
      <CardHeader className="pb-0 relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-2">Avg attendance</p>
            <div className="flex items-end gap-3">
              <span className={cn("font-bold tracking-tight leading-none tabular-nums", compact ? "text-4xl" : "text-5xl")}>{rate}%</span>
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground text-primary px-2.5 py-1 text-[11px] font-bold">
                {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {up ? '+' : ''}{change}%
              </span>
            </div>
            <p className="text-[11px] font-medium text-primary-foreground/55 mt-2">compared to last period</p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary shrink-0">
            <TrendingUp size={16} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 flex flex-col justify-end pt-4 pb-3 px-3">
        <ChartContainer
          config={heroConfig}
          className="w-full !block !aspect-auto"
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
    <Card className={cn("relative overflow-hidden h-full transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5", compact && "p-3")}>
      <CardHeader className={cn("pb-2", compact && "p-0 pb-2")}>
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon size={compact ? 14 : 16} className="text-primary" />
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold rounded-full",
              stat.trend === 'up'
                ? "bg-chart-positive/10 text-chart-positive border-chart-positive/20"
                : "bg-chart-negative/10 text-chart-negative border-chart-negative/20"
            )}
          >
            <TrendIcon size={10} className="mr-0.5" />
            {stat.change}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(compact && "p-0")}>
        <p className={cn("font-bold text-foreground tracking-tight tabular-nums", compact ? "text-xl" : "text-2xl xl:text-3xl")}>{stat.value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
      </CardContent>
    </Card>
  );
};

/** A small labelled KPI with an icon — used in the secondary metrics strip. */
const MiniKpi: React.FC<{ icon: typeof Users; label: string; value: string; hint?: string }> = ({
  icon: Icon,
  label,
  value,
  hint,
}) => (
  <Card className="p-3 flex flex-row items-center gap-3">
    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
      <Icon size={15} className="text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-bold tabular-nums tracking-tight leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{hint ?? label}</p>
    </div>
  </Card>
);

/** Goal gauge — SVG semi-arc with lime progress */
const GoalGauge: React.FC<{ value: number; goal: number }> = ({ value, goal }) => {
  const pct = Math.min(1, value / goal);
  const r = 64;
  const circumference = Math.PI * r; // semicircle
  const dash = circumference * pct;
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target size={14} className="text-primary" />
          Attendance goal
        </CardTitle>
        <CardDescription className="text-xs">Target {goal}%</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
        <svg viewBox="0 0 160 92" className="w-full max-w-[220px]">
          <path d="M 16 84 A 64 64 0 0 1 144 84" fill="none" stroke="var(--muted)" strokeWidth={12} strokeLinecap="round" />
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
          />
          <text x="80" y="66" textAnchor="middle" className="fill-foreground" style={{ font: '700 26px "Inter Variable", sans-serif' }}>
            {value}%
          </text>
          <text x="80" y="84" textAnchor="middle" className="fill-muted-foreground" style={{ font: '500 9px "Inter Variable", sans-serif', letterSpacing: '0.08em' }}>
            OF {goal}% GOAL
          </text>
        </svg>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <p className="text-[11px] text-muted-foreground">{Math.round(pct * 100)}% of the way there</p>
        </div>
      </CardContent>
    </Card>
  );
};

/** A labelled proportion bar row — reused by tiers, methods and the funnel. */
const BarRow: React.FC<{ label: string; value: number; max: number; color: string; suffix?: string }> = ({
  label,
  value,
  max,
  color,
  suffix,
}) => (
  <div className="flex items-center gap-3">
    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium truncate">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {value.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`, backgroundColor: color }}
        />
      </div>
    </div>
  </div>
);

/**
 * Frosts everything inside it for non-premium accounts.
 */
const PremiumGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPremium } = usePremium();
  const navigate = useNavigate();

  if (isPremium) return <>{children}</>;

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
            <p className="text-sm font-semibold">Full analytics is a Pro feature</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock check-in trends, attendance mix, tiers and exports.
            </p>
          </div>
          <Button size="sm" className="rounded-full font-semibold" onClick={() => navigate({ to: '/upgrade' })}>
            <Sparkles size={13} />
            Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---- Main Analytics Component ----
const Analytics: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [scope, setScope] = useState<string>('all');

  // Per-event vs across-the-board analytics scope
  const { events: eventCollection } = getCollections();
  const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
  const scopeEvents = useMemo<EventType[]>(() => (Array.isArray(eventsData) ? eventsData : []), [eventsData]);
  const scopedEvent = useMemo(() => scopeEvents.find((e) => e.id === scope) ?? null, [scopeEvents, scope]);

  // Fabricated (for now) analytics from the core service.
  const { data, isLoading, error } = useAnalytics(scope, timeRange);

  const handleExport = () => {
    toast.info('Exporting analytics is a Pro feature', {
      description: 'Upgrade to download CSV and PDF reports.',
      action: { label: 'Upgrade', onClick: () => navigate({ to: '/upgrade' }) },
    });
  };

  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  const peakPoint = useMemo(() => {
    const series = data?.checkInsSeries ?? [];
    return series.reduce<{ label: string; value: number } | null>(
      (max, d) => (!max || d.value > max.value ? d : max),
      null
    );
  }, [data]);

  return (
    <div className={cn("flex flex-col gap-5 overflow-auto", isMobile && "pb-20")}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {scopedEvent ? `Performance for “${scopedEvent.name}”` : 'Across all events and your whole community'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Scope: one event vs across the board */}
          <Select value={scope} onValueChange={(v) => setScope(v ?? 'all')}>
            <SelectTrigger className="h-9 w-[180px] rounded-full text-xs">
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
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <TabsList className="grid grid-cols-3 w-[180px] rounded-full">
              <TabsTrigger value="week" className="text-xs rounded-full">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs rounded-full">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs rounded-full">Year</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 rounded-full gap-1.5 text-xs">
            <Lock size={12} className="text-primary" />
            Export
          </Button>
          <UpgradeCTA size="md" className="hidden xl:inline-flex" onClick={() => navigate({ to: '/upgrade' })} />
        </div>
      </div>

      {error && !data ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold">Couldn’t load analytics</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </Card>
      ) : !data ? (
        <AnalyticsSkeleton isMobile={isMobile} />
      ) : (
        <AnalyticsBody data={data} isMobile={isMobile} loading={isLoading} peakLabel={peakPoint?.label} />
      )}
    </div>
  );
};

/** Skeleton shown on the very first load (before any payload). */
const AnalyticsSkeleton: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div className="flex flex-col gap-5" aria-busy="true">
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <Skeleton className="col-span-2 row-span-2 h-52 rounded-xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className={cn("rounded-xl", isMobile ? "h-24" : "h-28")} />
      ))}
    </div>
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <Skeleton className="md:col-span-2 h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  </div>
);

/** The full dashboard, driven entirely by the analytics payload. */
const AnalyticsBody: React.FC<{
  data: AnalyticsResponse;
  isMobile: boolean;
  loading: boolean;
  peakLabel?: string;
}> = ({ data, isMobile, loading, peakLabel }) => {
  const { kpis } = data;
  const totalCheckIns = data.checkInsSeries.reduce((s, d) => s + d.value, 0);
  const methodMax = Math.max(...data.checkInMethods.map((m) => m.value), 1);
  const funnelMax = data.funnel.registered || 1;

  return (
    <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")}>
      {/* Bento: lime hero (2x2) + stat tiles */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
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
        <Card className={cn("relative overflow-hidden h-full flex flex-col justify-between", isMobile && "p-3")}>
          <CardHeader className={cn("pb-0", isMobile && "p-0")}>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Live now</p>
            </div>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-0")}>
            <p className={cn("font-bold tracking-tight tabular-nums", isMobile ? "text-xl" : "text-2xl xl:text-3xl")}>{kpis.liveNow}</p>
            <p className="text-xs text-muted-foreground mt-0.5">checked in right now</p>
          </CardContent>
        </Card>
      </div>

      {/* Everything past the four headline cards is premium-only */}
      <PremiumGate>
        <div className="flex flex-col gap-5">
          {/* Secondary KPI strip */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MiniKpi icon={UserCheck} label="Unique attendees" value={kpis.uniqueAttendees.toLocaleString()} hint="Unique attendees" />
            <MiniKpi icon={Filter} label="No-show rate" value={`${kpis.noShowRate}%`} hint="No-show rate" />
            <MiniKpi icon={Repeat} label="Repeat rate" value={`${kpis.repeatRate}%`} hint="Repeat attendees" />
            <MiniKpi icon={Hourglass} label="Avg dwell" value={`${data.dwell.avgMinutes}m`} hint="Avg time on site" />
          </div>

          {/* Row: check-ins bars + goal gauge */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity size={14} className="text-primary" />
                      Check-ins
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {peakLabel ? `Busiest: ${peakLabel} · ${peak(data)} check-ins` : 'Per period'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-semibold bg-primary/10 text-primary border-primary/25">
                    {totalCheckIns.toLocaleString()} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer config={pillBarConfig} className="w-full !block !aspect-auto" style={{ height: isMobile ? 200 : 260 }}>
                  <BarChart
                    data={data.checkInsSeries}
                    xKey="label"
                    series={[{
                      key: 'value',
                      colors: data.checkInsSeries.map((d) => (d.label === peakLabel ? COLORS.primary : COLORS.barRest)),
                    }]}
                    radius={10}
                    maxBarWidth={38}
                    categoryGap="28%"
                  />
                </ChartContainer>
              </CardContent>
            </Card>

            <GoalGauge value={data.goal.value} goal={data.goal.target} />
          </div>

          {/* Row: arrivals-by-hour (NEW) + check-in methods (NEW) */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  Arrivals by hour
                </CardTitle>
                <CardDescription className="text-xs">When attendees actually check in on the day</CardDescription>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer config={arrivalsConfig} className="w-full !block !aspect-auto" style={{ height: isMobile ? 190 : 230 }}>
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
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ScanLine size={14} className="text-primary" />
                  Check-in method
                </CardTitle>
                <CardDescription className="text-xs">How people got in</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
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

          {/* Row: attendance mix + member tiers */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 size={14} className="text-primary" />
                      Attendance mix
                    </CardTitle>
                    <CardDescription className="text-xs">Members, guests and walk-ins</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  {[['Members', COLORS.primary], ['Guests', COLORS.secondary], ['Walk-ins', COLORS.muted]].map(([label, color]) => (
                    <span key={label} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <ChartContainer config={mixConfig} className="w-full !block !aspect-auto" style={{ height: isMobile ? 210 : 260 }}>
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award size={14} className="text-primary" />
                  Member tiers
                </CardTitle>
                <CardDescription className="text-xs">Distribution by loyalty tier</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {data.tiers.map((tier) => (
                    <BarRow
                      key={tier.name}
                      label={tier.name}
                      value={tier.value}
                      max={100}
                      color={TIER_COLORS[tier.name] ?? COLORS.muted}
                      suffix="%"
                    />
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-primary/8 border border-primary/20 p-3 flex items-center gap-2.5">
                  <Crown size={14} className="text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    <span className="text-foreground font-semibold">{data.loyalty.tierUpgrades} upgrades</span> and {data.loyalty.pointsIssued.toLocaleString()} pts issued this period
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row: funnel (NEW) + top events */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Filter size={14} className="text-primary" />
                  Attendance funnel
                </CardTitle>
                <CardDescription className="text-xs">Registered → checked-in → attended</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <BarRow label="Registered" value={data.funnel.registered} max={funnelMax} color={COLORS.muted} />
                <BarRow label="Checked in" value={data.funnel.checkedIn} max={funnelMax} color={COLORS.secondary} />
                <BarRow label="Attended" value={data.funnel.attended} max={funnelMax} color={COLORS.primary} />
                <p className="text-[11px] text-muted-foreground pt-1">
                  {Math.round((data.funnel.attended / funnelMax) * 100)}% of registrations attended
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
                      className="flex items-center gap-3 py-3 px-2 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors rounded-lg"
                    >
                      <span className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
                        idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">{event.name}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{event.attendees} attendees</p>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
                        <span className="text-[10px] text-muted-foreground tabular-nums">{event.fillRate}% full</span>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${event.fillRate}%` }} />
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] font-semibold shrink-0",
                          event.trend.startsWith('+')
                            ? "bg-chart-positive/10 text-chart-positive border-chart-positive/20"
                            : "bg-chart-negative/10 text-chart-negative border-chart-negative/20"
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
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock size={14} className="text-primary" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {data.recentActivity.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 md:last:border-b">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", item.highlight ? "bg-primary" : "bg-muted-foreground/30")} />
                      <span className="text-xs">{item.action}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PremiumGate>
    </div>
  );
};

/** Peak check-in value for the given payload (used in the card description). */
function peak(data: AnalyticsResponse): number {
  return data.checkInsSeries.reduce((max, d) => Math.max(max, d.value), 0);
}

export default Analytics;
