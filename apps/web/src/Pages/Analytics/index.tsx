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
  Crown
} from "lucide-react";
import { useToolbarContext } from '@credopass/lib/hooks';
import { useNavigate } from '@tanstack/react-router';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import type { EventType } from '@credopass/lib/schemas';
import { toast } from '@credopass/ui/components/sonner';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@credopass/ui/components/select';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ResponsiveContainer
} from "recharts";
import type { ChartConfig } from "@credopass/ui/components/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
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
import { Tabs, TabsList, TabsTrigger } from "@credopass/ui/components/tabs";
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { cn } from '@credopass/ui/lib/utils';

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

// ---- Demo series (stats to be wired to the API later) ----

// Attendance trend inside the lime hero card
const heroTrend = [
  { month: "Jan", rate: 71 }, { month: "Feb", rate: 78 }, { month: "Mar", rate: 74 },
  { month: "Apr", rate: 80 }, { month: "May", rate: 86 }, { month: "Jun", rate: 82 },
  { month: "Jul", rate: 89 }, { month: "Aug", rate: 93 },
];

// Weekly check-ins — pill bars with a highlighted peak
const weeklyCheckIns = [
  { day: "Mon", checkIns: 45 },
  { day: "Tue", checkIns: 52 },
  { day: "Wed", checkIns: 38 },
  { day: "Thu", checkIns: 65 },
  { day: "Fri", checkIns: 78 },
  { day: "Sat", checkIns: 85 },
  { day: "Sun", checkIns: 42 },
];

// Monthly composition — stacked rounded segments with surface gaps
const monthlyMix = [
  { month: "Apr", members: 96, guests: 34, walkIns: 18 },
  { month: "May", members: 122, guests: 41, walkIns: 22 },
  { month: "Jun", members: 108, guests: 37, walkIns: 15 },
  { month: "Jul", members: 141, guests: 52, walkIns: 26 },
  { month: "Aug", members: 156, guests: 48, walkIns: 31 },
];

const tierData = [
  { name: "Bronze", value: 45, fill: 'var(--tier-bronze)' },
  { name: "Silver", value: 30, fill: 'var(--tier-silver)' },
  { name: "Gold", value: 18, fill: 'var(--tier-gold)' },
  { name: "Platinum", value: 7, fill: 'var(--tier-platinum)' },
];

const topEvents = [
  { name: "Summer Rooftop Mixer", attendees: 186, fillRate: 93, trend: "+12%" },
  { name: "Design Review Summit", attendees: 142, fillRate: 88, trend: "+8%" },
  { name: "Founders Breakfast", attendees: 96, fillRate: 80, trend: "+20%" },
  { name: "Community Workshop", attendees: 74, fillRate: 62, trend: "-4%" },
];

const recentActivity = [
  { action: "New member joined", time: "2m ago", highlight: true },
  { action: "Event created", time: "15m ago", highlight: false },
  { action: "Check-in recorded", time: "32m ago", highlight: false },
  { action: "Tier upgrade: Gold", time: "1h ago", highlight: true },
  { action: "Event completed", time: "2h ago", highlight: false },
];

const stats = [
  { id: "stat-2", icon: Calendar, label: "Events this month", value: "24", change: "+8%", trend: "up" as const },
  { id: "stat-1", icon: Users, label: "Total members", value: "1,284", change: "+12%", trend: "up" as const },
  { id: "stat-4", icon: Flame, label: "Active streaks", value: "342", change: "-3%", trend: "down" as const },
];

const pillBarConfig = {
  checkIns: { label: "Check-ins", color: COLORS.primary },
} satisfies ChartConfig;

const mixConfig = {
  members: { label: "Members", color: COLORS.primary },
  guests: { label: "Guests", color: COLORS.secondary },
  walkIns: { label: "Walk-ins", color: COLORS.muted },
} satisfies ChartConfig;

// ---- Building blocks ----

/** Lime hero: headline metric + trend pill + dark chart inside the card */
const HeroAttendanceCard: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <Card className="relative overflow-hidden border-0 bg-primary text-primary-foreground h-full flex flex-col">
    <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full border-[16px] border-primary-foreground/8" />
    <CardHeader className="pb-0 relative z-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/60 mb-2">Avg attendance</p>
          <div className="flex items-end gap-3">
            <span className={cn("font-bold tracking-tight leading-none tabular-nums", compact ? "text-4xl" : "text-5xl")}>89%</span>
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground text-primary px-2.5 py-1 text-[11px] font-bold">
              <ArrowUpRight size={11} />
              +5%
            </span>
          </div>
          <p className="text-[11px] font-medium text-primary-foreground/55 mt-2">compared to last month</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary shrink-0">
          <TrendingUp size={16} />
        </div>
      </div>
    </CardHeader>
    <CardContent className="relative z-10 flex-1 flex flex-col justify-end pt-4 pb-3 px-3">
      <ResponsiveContainer width="100%" height={compact ? 110 : 150}>
        <AreaChart data={heroTrend} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-foreground)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary-foreground)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'color-mix(in oklch, var(--primary-foreground) 55%, transparent)' }}
            interval="preserveStartEnd"
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--primary-foreground)"
            strokeWidth={2.5}
            fill="url(#heroFill)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--primary-foreground)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const StatCard: React.FC<{ stat: typeof stats[0]; compact?: boolean }> = ({ stat, compact }) => {
  const Icon = stat.icon;
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
        <CardDescription className="text-xs">Monthly target {goal}%</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
        <svg viewBox="0 0 160 92" className="w-full max-w-[220px]">
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

// Main Analytics Component
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

  const peakDay = useMemo(
    () => weeklyCheckIns.reduce((max, d) => (d.checkIns > max.checkIns ? d : max), weeklyCheckIns[0]),
    []
  );

  return (
    <div className={cn(
      "flex flex-col gap-5 overflow-auto",
      isMobile && "pb-20"
    )}>
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
              <SelectValue placeholder="All events" />
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

      {/* Bento: lime hero (2x2) + stat tiles */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="col-span-2 row-span-2">
          <HeroAttendanceCard compact={isMobile} />
        </div>
        {stats.map((stat) => (
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
            <p className={cn("font-bold tracking-tight tabular-nums", isMobile ? "text-xl" : "text-2xl xl:text-3xl")}>38</p>
            <p className="text-xs text-muted-foreground mt-0.5">checked in right now</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Mobile Only */}
      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {[{ icon: Calendar, label: "New Event" }, { icon: Users, label: "Add Member" }, { icon: BarChart3, label: "Export" }, { icon: Target, label: "Goals" }].map(({ icon: Icon, label }) => (
            <Button key={label} variant="outline" size="sm" className="h-auto py-3 px-4 flex flex-col items-center gap-1.5 rounded-xl hover:border-primary/30 hover:bg-primary/5">
              <Icon size={16} className="text-primary" />
              <span className="text-[10px] font-medium">{label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Row: weekly pill bars + goal gauge */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-primary" />
                  Weekly check-ins
                </CardTitle>
                <CardDescription className="text-xs">
                  Busiest day: {peakDay.day} · {peakDay.checkIns} check-ins
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full text-[10px] font-semibold bg-primary/10 text-primary border-primary/25">
                405 total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <ChartContainer config={pillBarConfig} className="w-full !block !aspect-auto" style={{ height: isMobile ? 200 : 260 }}>
              <BarChart data={weeklyCheckIns} margin={{ top: 24, right: 8, left: -22, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)' }} />
                  <ChartTooltip cursor={{ fill: 'oklch(1 0 0 / 4%)' }} content={<ChartTooltipContent />} />
                  <Bar dataKey="checkIns" radius={[10, 10, 10, 10]} maxBarSize={38}>
                    {weeklyCheckIns.map((d) => (
                      <Cell key={d.day} fill={d.day === peakDay.day ? COLORS.primary : COLORS.barRest} />
                    ))}
                  </Bar>
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <GoalGauge value={89} goal={95} />
      </div>

      {/* Row: monthly stacked mix + member tiers */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" />
                  Attendance mix
                </CardTitle>
                <CardDescription className="text-xs">Members, guests and walk-ins per month</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                Members
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: COLORS.secondary }} />
                Guests
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: COLORS.muted }} />
                Walk-ins
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <ChartContainer config={mixConfig} className="w-full !block !aspect-auto" style={{ height: isMobile ? 210 : 260 }}>
              <BarChart data={monthlyMix} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="34%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)' }} />
                  <ChartTooltip cursor={{ fill: 'oklch(1 0 0 / 4%)' }} content={<ChartTooltipContent />} />
                  <Bar dataKey="members" stackId="mix" fill={COLORS.primary} radius={[6, 6, 6, 6]} maxBarSize={34} stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="guests" stackId="mix" fill={COLORS.secondary} radius={[6, 6, 6, 6]} maxBarSize={34} stroke="var(--card)" strokeWidth={2} />
                  <Bar dataKey="walkIns" stackId="mix" fill={COLORS.muted} radius={[6, 6, 6, 6]} maxBarSize={34} stroke="var(--card)" strokeWidth={2} />
                </BarChart>
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
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tier.fill }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium">{tier.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{tier.value}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${tier.value}%`, backgroundColor: tier.fill }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-primary/8 border border-primary/20 p-3 flex items-center gap-2.5">
              <Crown size={14} className="text-primary shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                <span className="text-foreground font-semibold">32 members</span> are within 200 pts of the next tier
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row: top events + recent activity */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              Top events
            </CardTitle>
            <CardDescription className="text-xs">Ranked by attendance this quarter</CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col">
              {topEvents.map((event, idx) => (
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className="space-y-3">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
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
    </div>
  );
};

export default Analytics;
