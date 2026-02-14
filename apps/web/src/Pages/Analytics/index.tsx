import React, { useMemo } from "react";
import { Users, Calendar, TrendingUp, Award } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie } from "recharts";
import type { ChartConfig } from "@credopass/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@credopass/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@credopass/ui";
import GridLayout from "@credopass/lib/layout";
import "./style.css";

// --- Module-level constants (hoisted per AGENTS.md Rule 6.3) ---

const activityData = [
  { month: "Jan", attendance: 85 },
  { month: "Feb", attendance: 92 },
  { month: "Mar", attendance: 78 },
  { month: "Apr", attendance: 88 },
  { month: "May", attendance: 95 },
  { month: "Jun", attendance: 90 },
  { month: "Jul", attendance: 87 },
  { month: "Aug", attendance: 93 },
] as const;

const pieData = [
  { name: "Present", value: 450, fill: "var(--color-present)" },
  { name: "Absent", value: 50, fill: "var(--color-absent)" },
] as const;

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "#d4ff00",
  },
} satisfies ChartConfig;

const pieChartConfig = {
  present: {
    label: "Present",
    color: "#d4ff00",
  },
  absent: {
    label: "Absent",
    color: "#333333",
  },
} satisfies ChartConfig;

const STAT_DIM = {
  sm: { w: 1, h: 4 },
  xxs: { w: 1, h: 4 },
} as const;

const layouts = {
  lg: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4 },
    { i: "stat-2", x: 2, y: 0, w: 2, h: 4 },
    { i: "stat-3", x: 4, y: 0, w: 2, h: 4 },
    { i: "stat-4", x: 0, y: 0, w: 2, h: 6 },
    { i: "chart-1", x: 6, y: 0, w: 6, h: 10 },
    { i: "chart-2", x: 2, y: 4, w: 4, h: 6 },
  ],
  md: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4 },
    { i: "stat-2", x: 2, y: 0, w: 2, h: 4 },
    { i: "stat-3", x: 4, y: 0, w: 3, h: 4 },
    { i: "stat-4", x: 7, y: 0, w: 3, h: 4 },
    { i: "chart-1", x: 0, y: 4, w: 5, h: 8 },
    { i: "chart-2", x: 6, y: 4, w: 5, h: 8 },
  ],
  sm: [
    { i: "stat-1", x: 0, y: 0, ...STAT_DIM.sm },
    { i: "stat-2", x: 1, y: 0, ...STAT_DIM.sm },
    { i: "stat-3", x: 0, y: 2, ...STAT_DIM.sm },
    { i: "stat-4", x: 1, y: 2, ...STAT_DIM.sm },
    { i: "chart-1", x: 2, y: 10, w: 4, h: 8 },
    { i: "chart-2", x: 2, y: 4, w: 2, h: 8 },
  ],
  xxs: [
    { i: "stat-1", x: 0, y: 0, ...STAT_DIM.xxs },
    { i: "stat-2", x: 1, y: 0, ...STAT_DIM.xxs },
    { i: "stat-3", x: 0, y: 2, ...STAT_DIM.xxs },
    { i: "stat-4", x: 1, y: 2, ...STAT_DIM.xxs },
    { i: "chart-1", x: 2, y: 10, w: 4, h: 8 },
    { i: "chart-2", x: 2, y: 4, w: 2, h: 8 },
  ],
} as const;

const stats = [
  {
    id: "stat-1",
    icon: Users,
    label: "Total Members",
    value: "1,284",
    change: "+12%",
    trend: "up" as const,
  },
  {
    id: "stat-2",
    icon: Calendar,
    label: "Events This Month",
    value: "24",
    change: "+8%",
    trend: "up" as const,
  },
  {
    id: "stat-3",
    icon: TrendingUp,
    label: "Avg Attendance",
    value: "89%",
    change: "+5%",
    trend: "up" as const,
  },
  {
    id: "stat-4",
    icon: Award,
    label: "Active Streaks",
    value: "342",
    change: "+18%",
    trend: "up" as const,
  },
] as const;

// --- Component ---

const Analytics: React.FC = () => {
  const statCards = useMemo(() => {
    return stats.map((stat) => {
      const Icon = stat.icon;
      return (
        <Card key={stat.id} className="stat-card-premium">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xs font-medium text-muted-foreground tracking-wide">
                {stat.label}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className={`stat-change ${stat.trend}`}>{stat.change}</span>
              <div className="drag-handle">&#8942;&#8942;</div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 px-4 py-0">
            <div className="stat-value-display">{stat.value}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-auto pb-3">
              <Icon size={12} className="text-primary" />
              <span>{stat.trend === 'up' ? 'Trending up' : 'Trending down'}</span>
            </div>
          </CardContent>
        </Card>
      );
    });
  }, []);

  return (
    <div className="hero-panel">
      <GridLayout
        layouts={layouts}
        gridConfig={{ containerPadding: [0, 0] }}
      >
        {statCards}

        <Card key="chart-1" className="chart-card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Monthly Attendance</CardTitle>
              <CardDescription className="text-xs mt-1 text-muted-foreground">
                Attendance trend over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select className="chart-filter">
                <option>Last 8 Months</option>
                <option>Last 6 Months</option>
                <option>Last Year</option>
              </select>
              <div className="drag-handle">&#8942;&#8942;</div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-4">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={[...activityData]} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                  fontSize={11}
                  tick={{ fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  tick={{ fill: 'var(--muted-foreground)' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="attendance"
                  fill="var(--color-attendance)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card key="chart-2" className="chart-card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Distribution</CardTitle>
              <CardDescription className="text-xs mt-1 text-muted-foreground">
                This month
              </CardDescription>
            </div>
            <div className="drag-handle">&#8942;&#8942;</div>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-4">
            <ChartContainer config={pieChartConfig} className="h-full w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={[...pieData]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                />
                <ChartLegend
                  content={<ChartLegendContent />}
                  className="flex-wrap gap-2 *:basis-1/4 *:justify-center"
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </GridLayout>
    </div>
  );
};

export default Analytics;
