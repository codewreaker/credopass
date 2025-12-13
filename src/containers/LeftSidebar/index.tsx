import React from 'react';
import {
  LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import { useAppStore } from "../../store";
import './style.css';
import Tooltip from '../../components/ui/Tooltip';




interface LeftSidebarProps {
  menuConfig: Array<{
    path: string
    icon: React.ElementType,
    label: string
  }>
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  menuConfig
}) => {

  const { pathname } = useLocation();
  const isCollapsed = useAppStore(({ sidebarOpen }) => (sidebarOpen['left']))
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar)
  
  const onToggleCollapse=()=>toggleSidebar('left')
  console.log('LeftSidebar rendered with isCollapsed:', isCollapsed);

  return (
    <aside className={`left-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="collapse-toggle" onClick={onToggleCollapse}>
        {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      <div className="sidebar-menu">
        {menuConfig.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === pathname;
          return (
            <Tooltip content={item.label} delay={isCollapsed ? 0 : 500} position='right' key={item.path} >
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <Icon size={16} />
              {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
            </Tooltip>
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
