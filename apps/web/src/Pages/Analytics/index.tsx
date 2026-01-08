import React, { useMemo } from "react";
import { Users, Calendar, TrendingUp, Award } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie } from "recharts";
import type { ChartConfig } from "@credopass/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@credopass/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@credopass/ui";
import GridLayout from "../../lib/grid-layout";
import "./style.css";

const activityData = [
  { month: "Jan", attendance: 85 },
  { month: "Feb", attendance: 92 },
  { month: "Mar", attendance: 78 },
  { month: "Apr", attendance: 88 },
  { month: "May", attendance: 95 },
  { month: "Jun", attendance: 90 },
  { month: "Jul", attendance: 87 },
  { month: "Aug", attendance: 93 },
];

const pieData = [
  { name: "Present", value: 450, fill: "var(--color-present)" },
  { name: "Absent", value: 50, fill: "var(--color-absent)" },
];

// Chart configuration for shadcn charts
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

const minDims = { minW: 2, minH: 3 };

const layouts = {
  lg: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4, ...minDims },
    { i: "stat-2", x: 2, y: 0, w: 2, h: 4, ...minDims },
    { i: "stat-3", x: 0, y: 4, w: 2, h: 6, ...minDims },
    { i: "stat-4", x: 4, y: 0, w: 2, h: 4, ...minDims },
    // Charts
    { i: "chart-1", x: 6, y: 0, w: 6, h: 10, minW: 4, minH: 6 },
    { i: "chart-2", x: 2, y: 4, w: 4, h: 6, minW: 4, minH: 6 },
  ],
  md: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "stat-2", x: 2, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "stat-3", x: 7, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "stat-4", x: 4, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: "chart-1", x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 6 },
    { i: "chart-2", x: 4, y: 4, w: 6, h: 6, minW: 4, minH: 6 }
  ],
  sm: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "stat-2", x: 2, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "stat-3", x: 4, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "stat-4", x: 0, y: 4, w: 2, h: 6, minW: 2, minH: 3 },
    { i: "chart-1", x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 6 },
    { i: "chart-2", x: 2, y: 4, w: 4, h: 6, minW: 4, minH: 6 }
  ]
  // xs and xxs can be omitted - they'll fall back to items if provided
};

const stats = [
  {
    id: "stat-1",
    icon: Users,
    label: "Total Members",
    value: "1,284",
    change: "+12%",
    trend: "up",
  },
  {
    id: "stat-2",
    icon: Calendar,
    label: "Events This Month",
    value: "24",
    change: "+8%",
    trend: "up",
  },
  {
    id: "stat-3",
    icon: TrendingUp,
    label: "Avg Attendance",
    value: "89%",
    change: "+5%",
    trend: "up",
  },
  {
    id: "stat-4",
    icon: Award,
    label: "Active Streaks",
    value: "342",
    change: "+18%",
    trend: "up",
  },
];


const Analytics: React.FC = () => {
  const statCards = useMemo(() => {
    return stats.map((stat) => {
      const Icon = stat.icon;
      return (
        <Card key={stat.id} className="relative h-full flex flex-col p-0 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className={`stat-change ${stat.trend}`}>{stat.change}</span>
              <div className="drag-handle">⋮⋮</div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 px-3 py-0">
            <div className="text-3xl font-bold mb-auto">{stat.value}</div>
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
        onLayoutChange={(layout, allLayouts) => console.log(layout, allLayouts)}
      >
        {statCards}
        <Card key="chart-1" className="relative h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Monthly Attendance Trend</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <select className="chart-filter">
                <option>Last 8 Months</option>
                <option>Last 6 Months</option>
                <option>Last Year</option>
              </select>
              <div className="drag-handle">⋮⋮</div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={activityData} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="attendance"
                  fill="var(--color-attendance)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card key="chart-2" className="relative h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Attendance Distribution</CardTitle>
              <CardDescription className="text-xs mt-1">This Month</CardDescription>
            </div>
            <div className="drag-handle">⋮⋮</div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={pieChartConfig} className="h-full w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
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