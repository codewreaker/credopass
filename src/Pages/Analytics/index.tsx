import React, { useMemo } from "react";
import { Users, Calendar, TrendingUp, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { GridLayout } from "../../utils/GridLayout";
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
  { name: "Present", value: 450 },
  { name: "Absent", value: 50 },
];

const COLORS = ["#d4ff00", "#333333"];

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
        <div key={stat.id} className="grid-item stat-card">
          <div className="drag-handle">⋮⋮</div>
          <div className="stat-header">
            <div className="stat-icon">
              <Icon size={16} />
            </div>
            <span className={`stat-change ${stat.trend}`}>{stat.change}</span>
          </div>
          <div className="stat-content">
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-label">{stat.label}</p>
          </div>
        </div>
      );
    });
  }, [stats]);

  return (
    <div className="hero-panel">
      <GridLayout
        layouts={layouts}
        rowHeight={30}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        margin={[10, 10]}
        containerPadding={[0, 0]}
        onLayoutChange={console.log}
      >
        {statCards}
        <div key="chart-1" className="grid-item chart-card">
          <div className="drag-handle">⋮⋮</div>
          <div className="chart-header">
            <h3>Monthly Attendance Trend</h3>
            <select className="chart-filter">
              <option>Last 8 Months</option>
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#a0a0a0" fontSize={9} />
                <YAxis stroke="#a0a0a0" fontSize={9} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#252525",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="attendance"
                  fill="#d4ff00"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div key="chart-2" className="grid-item chart-card">
          <div className="drag-handle">⋮⋮</div>
          <div className="chart-header">
            <h3>Attendance Distribution</h3>
            <span className="chart-subtitle">This Month</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={37.5}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#252525",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: COLORS[0] }}
                />
                <span>Present: {pieData?.[0]?.value}</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: COLORS[1] }}
                />
                <span>Absent: {pieData?.[1]?.value}</span>
              </div>
            </div>
          </div>
        </div>
      </GridLayout>
    </div>
  );
};

export default Analytics