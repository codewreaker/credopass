import React from 'react';
import { Users, Calendar, TrendingUp, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './HeroPanel.css';

const activityData = [
  { month: 'Jan', attendance: 85 },
  { month: 'Feb', attendance: 92 },
  { month: 'Mar', attendance: 78 },
  { month: 'Apr', attendance: 88 },
  { month: 'May', attendance: 95 },
  { month: 'Jun', attendance: 90 },
  { month: 'Jul', attendance: 87 },
  { month: 'Aug', attendance: 93 },
];

const pieData = [
  { name: 'Present', value: 450 },
  { name: 'Absent', value: 50 },
];

const COLORS = ['#d4ff00', '#333333'];

export const HeroPanel: React.FC = () => {
  const stats = [
    { id: 1, icon: Users, label: 'Total Members', value: '1,284', change: '+12%', trend: 'up' },
    { id: 2, icon: Calendar, label: 'Events This Month', value: '24', change: '+8%', trend: 'up' },
    { id: 3, icon: TrendingUp, label: 'Avg Attendance', value: '89%', change: '+5%', trend: 'up' },
    { id: 4, icon: Award, label: 'Active Streaks', value: '342', change: '+18%', trend: 'up' },
  ];

  return (
    <div className="hero-panel">
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.id} className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <Icon size={22} />
                </div>
                <span className={`stat-change ${stat.trend}`}>{stat.change}</span>
              </div>
              <div className="stat-content">
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Monthly Attendance Trend</h3>
            <select className="chart-filter">
              <option>Last 8 Months</option>
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#a0a0a0" fontSize={12} />
                <YAxis stroke="#a0a0a0" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#252525', 
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="attendance" fill="#d4ff00" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="chart-card">
          <div className="chart-header">
            <h3>Attendance Distribution</h3>
            <span className="chart-subtitle">This Month</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#252525', 
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: COLORS[0] }} />
                <span>Present: {pieData?.[0]?.value}</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: COLORS[1] }} />
                <span>Absent: {pieData?.[1]?.value}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
