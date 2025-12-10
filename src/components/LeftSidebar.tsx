import React from 'react';
import { LayoutDashboard, Users, Calendar, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import './LeftSidebar.css';

interface LeftSidebarProps {
  activeMode: string;
  onModeChange: (mode: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  activeMode, 
  onModeChange,
  isCollapsed,
  onToggleCollapse
}) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'members', icon: Users, label: 'Members' },
    { id: 'events', icon: Calendar, label: 'Events' },
  ];

  return (
    <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="collapse-toggle" onClick={onToggleCollapse}>
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
      
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
              {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
            </button>
          );
        })}
      </div>
      
      <div className="sidebar-footer">
        <button className="sidebar-item" title="Logout">
          <LogOut size={22} />
          {!isCollapsed && <span className="sidebar-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
};