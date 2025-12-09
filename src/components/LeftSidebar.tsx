import React from 'react';
import { LayoutDashboard, Users, Calendar, BarChart3, Settings, FileText, LogOut } from 'lucide-react';
import './LeftSidebar.css';

interface LeftSidebarProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeMode, onModeChange }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'members', icon: Users, label: 'Members' },
    { id: 'events', icon: Calendar, label: 'Events' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'reports', icon: FileText, label: 'Reports' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="left-sidebar">
      <div className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`sidebar-item ${activeMode === item.id ? 'active' : ''}`}
              onClick={() => onModeChange(item.id)}
              title={item.label}
            >
              <Icon size={22} />
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      
      <div className="sidebar-footer">
        <button className="sidebar-item" title="Logout">
          <LogOut size={22} />
          <span className="sidebar-label">Logout</span>
        </button>
      </div>
    </aside>
  );
};
