import React, { useMemo, useState } from "react";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Clock,
  Target,
  Zap
} from "lucide-react";
import { useToolbarContext } from '@credopass/lib/hooks';
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  PieChart, 
  Pie, 
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  ResponsiveContainer,
  Legend
} from "recharts";
import type { ChartConfig } from "@credopass/ui/components/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@credopass/ui/components/tabs";
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { cn } from '@credopass/ui/lib/utils';
import "./style.css";

// Color palette - computed values for Recharts compatibility
const COLORS = {
  primary: '#d4ff00',
  secondary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#6b7280',
  chart1: '#d4ff00',
  chart2: '#22c55e',
  chart3: '#6366f1',
  chart4: '#f59e0b',
  chart5: '#ec4899',
};

// Monthly attendance data
const monthlyData = [
  { month: "Jan", attendance: 85, events: 12, members: 156 },
  { month: "Feb", attendance: 92, events: 15, members: 178 },
  { month: "Mar", attendance: 78, events: 10, members: 165 },
  { month: "Apr", attendance: 88, events: 18, members: 192 },
  { month: "May", attendance: 95, events: 22, members: 234 },
  { month: "Jun", attendance: 90, events: 19, members: 245 },
  { month: "Jul", attendance: 87, events: 16, members: 256 },
  { month: "Aug", attendance: 93, events: 21, members: 278 },
];

// Weekly trend data
const weeklyTrend = [
  { day: "Mon", checkIns: 45, checkOuts: 42 },
  { day: "Tue", checkIns: 52, checkOuts: 48 },
  { day: "Wed", checkIns: 38, checkOuts: 35 },
  { day: "Thu", checkIns: 65, checkOuts: 60 },
  { day: "Fri", checkIns: 78, checkOuts: 72 },
  { day: "Sat", checkIns: 85, checkOuts: 80 },
  { day: "Sun", checkIns: 42, checkOuts: 38 },
];

// Distribution data
const distributionData = [
  { name: "Present", value: 450, fill: COLORS.primary },
  { name: "Absent", value: 50, fill: COLORS.muted },
];

// Tier distribution
const tierData = [
  { name: "Bronze", value: 45, fill: '#CD7F32' },
  { name: "Silver", value: 30, fill: '#C0C0C0' },
  { name: "Gold", value: 18, fill: '#FFD700' },
  { name: "Platinum", value: 7, fill: '#E5E4E2' },
];

// Event types data
const eventTypesData = [
  { type: "Workshop", count: 24, attendees: 856 },
  { type: "Meetup", count: 18, attendees: 642 },
  { type: "Conference", count: 6, attendees: 1200 },
  { type: "Webinar", count: 32, attendees: 1890 },
  { type: "Social", count: 12, attendees: 480 },
];

// Chart configurations
const areaChartConfig = {
  checkIns: {
    label: "Check-ins",
    color: COLORS.primary,
  },
  checkOuts: {
    label: "Check-outs",
    color: COLORS.secondary,
  },
} satisfies ChartConfig;

const barChartConfig = {
  attendance: {
    label: "Attendance %",
    color: COLORS.primary,
  },
  events: {
    label: "Events",
    color: COLORS.secondary,
  },
} satisfies ChartConfig;

// Stats data
const stats = [
  {
    id: "stat-1",
    icon: Users,
    label: "Total Members",
    value: "1,284",
    change: "+12%",
    trend: "up" as const,
    description: "vs last month",
  },
  {
    id: "stat-2",
    icon: Calendar,
    label: "Events This Month",
    value: "24",
    change: "+8%",
    trend: "up" as const,
    description: "vs last month",
  },
  {
    id: "stat-3",
    icon: TrendingUp,
    label: "Avg Attendance",
    value: "89%",
    change: "+5%",
    trend: "up" as const,
    description: "vs last month",
  },
  {
    id: "stat-4",
    icon: Award,
    label: "Active Streaks",
    value: "342",
    change: "-3%",
    trend: "down" as const,
    description: "vs last month",
  },
];

// Stat Card Component
const StatCard: React.FC<{
  stat: typeof stats[0];
  compact?: boolean;
}> = ({ stat, compact }) => {
  const Icon = stat.icon;
  const TrendIcon = stat.trend === 'up' ? ArrowUpRight : ArrowDownRight;
  
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200",
      "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
      compact && "p-3"
    )}>
      <CardHeader className={cn("pb-2", compact && "p-0 pb-2")}>
        <div className="flex items-start justify-between">
          <div className={cn(
            "p-2 rounded-lg",
            "bg-primary/10"
          )}>
            <Icon size={compact ? 14 : 18} className="text-primary" />
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] font-semibold",
              stat.trend === 'up' 
                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                : "bg-red-500/10 text-red-500 border-red-500/20"
            )}
          >
            <TrendIcon size={10} className="mr-0.5" />
            {stat.change}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(compact && "p-0")}>
        <p className={cn(
          "font-bold text-foreground tracking-tight",
          compact ? "text-xl" : "text-2xl"
        )}>
          {stat.value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
        {!compact && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">{stat.description}</p>
        )}
      </CardContent>
    </Card>
  );
};

// Quick Action Button
const QuickAction: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}> = ({ icon: Icon, label, onClick }) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onClick}
    className="h-auto py-3 px-4 flex flex-col items-center gap-1.5 hover:border-primary/30 hover:bg-primary/5"
  >
    <Icon size={16} className="text-primary" />
    <span className="text-[10px] font-medium">{label}</span>
  </Button>
);

// Main Analytics Component
const Analytics: React.FC = () => {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  // Responsive chart height
  const chartHeight = isMobile ? 200 : 300;

  return (
    <div className={cn(
      "flex flex-col gap-6 p-4 md:p-6 overflow-auto",
      isMobile && "pb-20" // Extra padding for mobile navigation
    )}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your community engagement and event performance</p>
        </div>
        
        {/* Time Range Tabs */}
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList className="grid grid-cols-3 w-[200px]">
            <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
            <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Grid - Responsive */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-2" : "grid-cols-4"
      )}>
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} compact={isMobile} />
        ))}
      </div>

      {/* Quick Actions - Mobile Only */}
      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <QuickAction icon={Calendar} label="New Event" />
          <QuickAction icon={Users} label="Add Member" />
          <QuickAction icon={BarChart3} label="Export" />
          <QuickAction icon={Target} label="Goals" />
        </div>
      )}

      {/* Main Charts Grid */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
      )}>
        {/* Weekly Trend Chart - Area */}
        <Card className={cn(!isMobile && "lg:col-span-2")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-primary" />
                  Weekly Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  Check-ins and check-outs this week
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <ChartContainer config={areaChartConfig} className="w-full" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCheckIns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCheckOuts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="checkIns"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCheckIns)"
                  />
                  <Area
                    type="monotone"
                    dataKey="checkOuts"
                    stroke={COLORS.secondary}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCheckOuts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Attendance Distribution - Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon size={14} className="text-primary" />
              Attendance
            </CardTitle>
            <CardDescription className="text-xs">
              This month&apos;s distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <ChartContainer 
              config={{
                present: { label: "Present", color: COLORS.primary },
                absent: { label: "Absent", color: COLORS.muted },
              }} 
              className="w-full"
              style={{ height: isMobile ? 180 : 220 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 40 : 50}
                    outerRadius={isMobile ? 60 : 75}
                    paddingAngle={2}
                    strokeWidth={0}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex justify-center gap-4 mt-2">
              {distributionData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Bar Chart */}
        <Card className={cn(!isMobile && "lg:col-span-2")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 size={14} className="text-primary" />
              Monthly Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Attendance rate and event count
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <ChartContainer config={barChartConfig} className="w-full" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="attendance" 
                    fill={COLORS.primary} 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award size={14} className="text-primary" />
              Member Tiers
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution by loyalty tier
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className="space-y-3">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: tier.fill }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{tier.name}</span>
                      <span className="text-xs text-muted-foreground">{tier.value}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${tier.value}%`,
                          backgroundColor: tier.fill 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Event Types */}
        <Card className={cn(!isMobile && "lg:col-span-2")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              Event Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Events by type and total attendees
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-2" : "grid-cols-5"
            )}>
              {eventTypesData.map((event) => (
                <div 
                  key={event.type}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/20 transition-colors"
                >
                  <p className="text-lg font-bold text-foreground">{event.count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{event.type}</p>
                  <p className="text-xs text-primary mt-1">{event.attendees.toLocaleString()} attendees</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - Mobile Optimized */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            <div className="space-y-3">
              {[
                { action: "New member joined", time: "2m ago", highlight: true },
                { action: "Event created", time: "15m ago", highlight: false },
                { action: "Check-in recorded", time: "32m ago", highlight: false },
                { action: "Tier upgrade: Gold", time: "1h ago", highlight: true },
                { action: "Event completed", time: "2h ago", highlight: false },
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      item.highlight ? "bg-primary" : "bg-muted-foreground/30"
                    )} />
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
