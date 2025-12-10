import React from 'react';
import { 
  LogOut, ChevronLeft, ChevronRight
 } from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import './style.css';

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  menuConfig: Array<{
    path:string
    icon: React.ElementType,
    label: string
  }>
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  isCollapsed,
  onToggleCollapse,
  menuConfig
}) => {
  const {pathname} = useLocation();
  
  return (
    <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="collapse-toggle" onClick={onToggleCollapse}>
        {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      
      <div className="sidebar-menu">
        {menuConfig.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === pathname;
          console.log(item.path, location)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <Icon size={16} />
              {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          );
        })}
      </div>
      
      <div className="sidebar-footer">
        <button className="sidebar-item" title="Logout">
          <LogOut size={16} />
          {!isCollapsed && <span className="sidebar-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
};
